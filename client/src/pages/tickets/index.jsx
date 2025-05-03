import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search, Calendar } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";
import { TicketCard } from '@/components/tickets/ticket-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function TicketsIndex() {
    var _a = useLocation(), navigate = _a[1];
    var _b = useState(''), searchQuery = _b[0], setSearchQuery = _b[1];
    var _c = useState('this-week'), timeFilter = _c[0], setTimeFilter = _c[1];
    var _d = useState(''), priorityFilter = _d[0], setPriorityFilter = _d[1];
    var _e = useState('all'), statusFilter = _e[0], setStatusFilter = _e[1];
    var _f = useState({
        from: undefined,
        to: undefined
    }), dateRange = _f[0], setDateRange = _f[1];
    var _g = useState(false), calendarOpen = _g[0], setCalendarOpen = _g[1];
    
    // Estado para filtro por atendente
    var _r = useState('all'), officialFilter = _r[0], setOfficialFilter = _r[1];
    
    // Estados para paginação
    var _p = useState(1), currentPage = _p[0], setCurrentPage = _p[1];
    var _q = useState(10), pageSize = _q[0], setPageSize = _q[1];
    
    // Estado para controlar a atribuição de atendentes
    var _h = useState(null), assigningTicketId = _h[0], setAssigningTicketId = _h[1];
    
    // Obtemos informações do usuário atual
    var authContext = useContext(AuthContext);
    var user = authContext === null || authContext === void 0 ? void 0 : authContext.user;
    
    // Query client para invalidar queries quando necessário
    var queryClient = useQueryClient();
    
    // Busca todos os atendentes para o filtro
    var officialsQuery = useQuery({
        queryKey: ['/api/officials'],
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
    
    var officials = officialsQuery.data || [];
    
    // Busca tickets com base no papel do usuário
    var _i = useQuery({
        queryKey: ['/api/tickets/user-role'],
        // Só busca se o usuário estiver autenticado
        enabled: !!user,
    }), tickets = _i.data, isLoading = _i.isLoading;
    
    // Mutation para atualizar atendente do ticket
    var assignTicketMutation = useMutation({
        mutationFn: function(params) {
            var ticketId = params.ticketId, assignedToId = params.assignedToId;
            var url = "/api/tickets/".concat(ticketId);
            var requestBody = { assignedToId: assignedToId };
            
            console.log("[DEBUG] Enviando requisição para atribuir atendente:", {
                url: url,
                method: "PATCH",
                body: JSON.stringify(requestBody)
            });
            
            return fetch(url, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }).then(function(response) {
                console.log("[DEBUG] Resposta da atribuição:", {
                    status: response.status,
                    ok: response.ok
                });
                
                if (!response.ok) {
                    return response.text().then(function(text) {
                        throw new Error("Erro ao atribuir atendente: " + (text || response.status));
                    });
                }
                return response.json();
            }).then(function(data) {
                console.log("[DEBUG] Dados retornados:", data);
                if (!data || (data.assignedToId !== assignedToId && assignedToId !== null)) {
                    throw new Error("Erro ao salvar atendente: os dados retornados não refletem a alteração");
                }
                return data;
            });
        },
        onMutate: function(variables) {
            setAssigningTicketId(variables.ticketId);
            console.log("[DEBUG] Iniciando mutação para ticketId:", variables.ticketId, "assignedToId:", variables.assignedToId);
        },
        onSuccess: function(data) {
            console.log("[DEBUG] Mutação realizada com sucesso:", data);
            
            // Atualizar o estado local imediatamente com o ticket atualizado
            // Isso garantirá que a interface reflita as mudanças sem precisar esperar pelo refetch
            if (tickets) {
                // Fazer uma cópia profunda dos tickets para evitar mutações diretas
                const updatedTickets = JSON.parse(JSON.stringify(tickets)).map(ticket => {
                    if (ticket.id === data.id) {
                        console.log("[DEBUG] Substituindo ticket no estado local:", ticket.id);
                        // Garantir que todos os dados do ticket original sejam preservados, atualizando apenas o assignedToId
                        return {
                            ...ticket,
                            assignedToId: data.assignedToId,
                            // Se o ticket retornado tiver official, incluir isto também
                            official: data.official || ticket.official
                        };
                    }
                    return ticket;
                });
                
                // Atualizar diretamente o cache do React Query com os tickets atualizados
                queryClient.setQueryData(['/api/tickets/user-role'], updatedTickets);
                console.log("[DEBUG] Estado atualizado imediatamente com novos dados");
            }
            
            // Mostrar toast após atualização do cache
            toast({
                title: "Atendente atribuído com sucesso",
                variant: "default",
            });
            
            // Ainda invalidamos a query para garantir sincronização com o servidor,
            // mas com um atraso maior para não interferir com a atualização da UI
            setTimeout(() => {
                queryClient.invalidateQueries({ 
                    queryKey: ['/api/tickets/user-role'],
                    // Forçar refetch para atualizar dados
                    refetchType: 'active'
                });
            }, 500);
        },
        onError: function(error) {
            console.error("[DEBUG] Erro na mutação:", error.message);
            toast({
                title: "Erro ao atribuir atendente",
                description: error.message,
                variant: "destructive",
            });
        },
        onSettled: function() {
            setAssigningTicketId(null);
        },
    });
    
    // Função para lidar com a atribuição de atendente
    var handleAssignTicket = function(ticketId, assignedToId) {
        assignTicketMutation.mutate({ ticketId: ticketId, assignedToId: assignedToId });
    };
    
    var filteredTickets = tickets === null || tickets === void 0 ? void 0 : tickets.filter(function (ticket) {
        console.log("[DEBUG] Filtrando ticket:", ticket.id, "status:", ticket.status, "filtro:", statusFilter, "match:", ticket.status === statusFilter);
        
        // Apply search filter
        if (searchQuery && !ticket.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        
        // Apply status filter
        if (statusFilter !== 'all') {
            // Certifique-se de que o status do ticket corresponde exatamente ao filtro
            if (statusFilter === TICKET_STATUS.NEW && ticket.status !== TICKET_STATUS.NEW) {
                return false;
            }
            if (statusFilter === TICKET_STATUS.ONGOING && ticket.status !== TICKET_STATUS.ONGOING) {
                return false;
            }
            if (statusFilter === TICKET_STATUS.RESOLVED && ticket.status !== TICKET_STATUS.RESOLVED) {
                return false;
            }
        }
        
        // Apply priority filter
        if (priorityFilter && priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
            return false;
        }
        
        // Apply official filter (atendente)
        if (officialFilter && officialFilter !== 'all') {
            if (officialFilter === 'unassigned') {
                // Filtrar tickets não atribuídos (sem atendente)
                if (ticket.assignedToId !== null && ticket.assignedToId !== undefined) {
                    return false;
                }
            } else {
                // Filtrar por atendente específico
                const officialId = parseInt(officialFilter);
                if (ticket.assignedToId !== officialId) {
                    return false;
                }
            }
        }
        
        // Apply time filter
        if (timeFilter && ticket.createdAt) {
            var ticketDate = new Date(ticket.createdAt);
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Início da semana (domingo)
            var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            switch (timeFilter) {
                case 'this-week':
                    if (ticketDate < weekStart)
                        return false;
                    break;
                case 'last-week':
                    var lastWeekStart = new Date(weekStart);
                    lastWeekStart.setDate(weekStart.getDate() - 7);
                    if (ticketDate < lastWeekStart || ticketDate >= weekStart)
                        return false;
                    break;
                case 'this-month':
                    if (ticketDate < monthStart)
                        return false;
                    break;
                case 'custom':
                    // Filtro personalizado com range de datas
                    if (dateRange.from) {
                        var startDate = new Date(dateRange.from);
                        startDate.setHours(0, 0, 0, 0); // Início do dia
                        if (ticketDate < startDate)
                            return false;
                    }
                    if (dateRange.to) {
                        var endDate = new Date(dateRange.to);
                        endDate.setHours(23, 59, 59, 999); // Final do dia
                        if (ticketDate > endDate)
                            return false;
                        // Verifica se o ticketDate é do mesmo dia do endDate
                        // Se sim, verificamos se o ticket foi criado depois do horário atual
                        var currentDate = new Date();
                        var isTicketSameDay = (ticketDate.getDate() === currentDate.getDate() &&
                            ticketDate.getMonth() === currentDate.getMonth() &&
                            ticketDate.getFullYear() === currentDate.getFullYear());
                        // Se for o mesmo dia, não considerar tickets criados depois do horário atual
                        if (isTicketSameDay && ticketDate.getTime() > currentDate.getTime()) {
                            return false;
                        }
                    }
                    break;
            }
        }
        return true;
    });
    
    // Calcular o número total de páginas
    var totalPages = Math.ceil((filteredTickets?.length || 0) / pageSize);
    
    // Obter os tickets apenas da página atual
    var paginatedTickets = React.useMemo(function() {
        if (!filteredTickets) return [];
        
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        return filteredTickets.slice(startIndex, endIndex);
    }, [filteredTickets, currentPage, pageSize]);
    
    // Função para navegar para uma página específica
    function goToPage(page) {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    }
    
    // Função para navegar para a próxima página
    function goToNextPage() {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    }
    
    // Função para navegar para a página anterior
    function goToPreviousPage() {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    }
    
    // Função para mudar o tamanho da página
    function handlePageSizeChange(size) {
        setPageSize(parseInt(size));
        setCurrentPage(1); // Resetar para a primeira página ao mudar o tamanho
    }
    
    // Resetar para a primeira página quando os filtros mudarem
    useEffect(function() {
        setCurrentPage(1);
    }, [searchQuery, timeFilter, priorityFilter, statusFilter, dateRange, officialFilter]);
    
    return (<div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Chamados</h1>
        <Button onClick={function () { return navigate('/tickets/new'); }}>
          <Plus className="mr-2 h-4 w-4"/>
          Novo Chamado
        </Button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4"/>
          <Input placeholder="Buscar chamado" className="pl-10" value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }}/>
        </div>

        {timeFilter === 'custom' ? (<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4"/>
                {dateRange.from ? (dateRange.to ? (<>
                      {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} {' - '} 
                      {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                    </>) : (format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }))) : (<span>Período Personalizado</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="range" selected={{
                from: dateRange.from,
                to: dateRange.to
            }} onSelect={function (range) {
                setDateRange({
                    from: range === null || range === void 0 ? void 0 : range.from,
                    to: range === null || range === void 0 ? void 0 : range.to
                });
                if ((range === null || range === void 0 ? void 0 : range.from) && (range === null || range === void 0 ? void 0 : range.to)) {
                    setTimeout(function () { return setCalendarOpen(false); }, 500);
                }
            }} locale={ptBR} initialFocus/>
            </PopoverContent>
          </Popover>) : (<Select value={timeFilter} onValueChange={function (value) {
                setTimeFilter(value);
                if (value === 'custom') {
                    setTimeout(function () { return setCalendarOpen(true); }, 100);
                }
            }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">Esta Semana</SelectItem>
              <SelectItem value="last-week">Semana Passada</SelectItem>
              <SelectItem value="this-month">Este Mês</SelectItem>
              <SelectItem value="custom">Período Personalizado</SelectItem>
            </SelectContent>
          </Select>)}

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecionar Prioridade"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.LOW}>Baixa</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Média</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.HIGH}>Alta</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Crítica</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={officialFilter} onValueChange={setOfficialFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecionar Atendente"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Atendentes</SelectItem>
            <SelectItem value="unassigned">Não Atribuídos</SelectItem>
            {officials.map(function(official) {
              return (
                <SelectItem key={official.id} value={official.id.toString()}>
                  {official.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Status Tabs */}
      <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList className="border-b border-neutral-200 w-full justify-start rounded-none bg-transparent">
          <TabsTrigger value="all" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Todos os Chamados
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.NEW} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Novos
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.ONGOING} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Em Andamento
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.RESOLVED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Resolvidos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status Legend */}
      <div className="mb-6 bg-white p-4 rounded-md border border-neutral-200 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-new mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Novos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-ongoing mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados em Andamento</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-resolved mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Resolvidos</span>
          </div>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {isLoading ? (Array(3).fill(0).map(function (_, i) { return (<div key={i} className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40"/>
                <Skeleton className="h-4 w-24"/>
              </div>
              <Skeleton className="h-6 w-3/4 mb-2"/>
              <Skeleton className="h-10 w-full mb-4"/>
              <div className="flex justify-between">
                <Skeleton className="h-7 w-28 rounded-full"/>
                <Skeleton className="h-5 w-20"/>
              </div>
            </div>); })) : (paginatedTickets.length) ? (paginatedTickets.map(function (ticket) { 
              return (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  onAssignTicket={handleAssignTicket} 
                  isAssigning={assigningTicketId === ticket.id} 
                />
              ); 
            })) : (<div className="bg-white rounded-md border border-neutral-200 p-8 text-center">
            <h3 className="text-lg font-medium text-neutral-700 mb-2">Nenhum chamado encontrado</h3>
            <p className="text-neutral-500 mb-4">
              {searchQuery ? 'Tente ajustar seus termos de busca' : 'Crie seu primeiro chamado para começar'}
            </p>
            {!searchQuery && (<Button asChild>
                <Link href="/tickets/new">Criar Chamado</Link>
              </Button>)}
          </div>)}
      </div>

      {/* Pagination */}
      {filteredTickets && filteredTickets.length > 0 && (
        <div className="flex flex-wrap justify-between items-center mt-6">
          {/* Registros por página */}
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <span className="text-sm text-neutral-600">Registros por página:</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            
            <span className="text-sm text-neutral-600 ml-4">
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, filteredTickets.length)} - {Math.min(currentPage * pageSize, filteredTickets.length)} de {filteredTickets.length}
            </span>
          </div>
          
          {/* Botões de navegação */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            {/* Botões de página */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Lógica para mostrar as páginas ao redor da página atual
              let pageNum;
              if (totalPages <= 5) {
                // Se houver 5 ou menos páginas, mostrar todas
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                // Se estiver nas primeiras páginas
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                // Se estiver nas últimas páginas
                pageNum = totalPages - 4 + i;
              } else {
                // Se estiver no meio
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button 
                  key={pageNum}
                  variant="outline" 
                  size="sm" 
                  className={currentPage === pageNum ? "bg-primary text-white hover:bg-primary/90" : ""}
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>);
}
