import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search, Calendar, Ticket, AlertTriangle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TicketCard } from '@/components/tickets/ticket-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Ticket as TicketType, Official, Department } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Novos imports padronizados
import { StandardPage, EmptyState } from '@/components/layout/admin-page-layout';

export default function TicketsIndex() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('this-week');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ 
    from: undefined, 
    to: undefined 
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Pegar estado de autenticação
  const { user, isLoading: isAuthLoading } = useAuth();

  // Handlers padronizados
  const handleCreateTicket = () => {
    navigate('/tickets/new');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Busca tickets com base no papel do usuário
  const { data: tickets, isLoading: isTicketsLoading, error: ticketsError } = useQuery<TicketType[]>({
    queryKey: ['/api/tickets/user-role'],
    enabled: !!user,
  });

  // 🆕 Busca departamentos (filtrado por empresa automaticamente no backend)
  const { data: departments, isLoading: isDepartmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: !!user,
  });

  // 🆕 Busca atendentes (filtrado por empresa automaticamente no backend)  
  const { data: officials, isLoading: isOfficialsLoading } = useQuery<Official[]>({
    queryKey: ['/api/officials'],
    enabled: !!user,
  });

  // Mutação para atribuir atendente
  const assignTicketMutation = useMutation({
    mutationFn: async ({ ticketId, assignedToId }: { ticketId: number; assignedToId: number | null }) => {
      const response = await apiRequest('PATCH', `/api/tickets/${ticketId}`, { assigned_to_id: assignedToId });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Sucesso!",
        description: `Chamado #${variables.ticketId} atribuído com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/user-role'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/recent'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${variables.ticketId}`] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atribuir o chamado",
        variant: "destructive",
      });
    },
  });

  const handleAssignTicket = (ticketId: number, assignedToId: number | null) => {
    assignTicketMutation.mutate({ ticketId, assignedToId });
  };

  const filteredTickets = tickets?.filter(ticket => {
    // Apply search filter
    if (searchQuery && !ticket.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply status filter
    if (statusFilter !== 'all' && ticket.status !== statusFilter) {
      return false;
    }
    
    // Apply priority filter
    if (priorityFilter && priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
      return false;
    }
    
    // 🆕 Apply department filter
    if (departmentFilter && departmentFilter !== 'all' && ticket.department_id !== parseInt(departmentFilter)) {
      return false;
    }
    
    // 🆕 Apply assigned to filter
    if (assignedToFilter && assignedToFilter !== 'all') {
      if (assignedToFilter === 'unassigned' && ticket.assigned_to_id !== null) {
        return false;
      }
      if (assignedToFilter !== 'unassigned' && ticket.assigned_to_id !== parseInt(assignedToFilter)) {
        return false;
      }
    }
    
    // Apply time filter
    if (timeFilter && ticket.created_at) {
      const ticketDate = new Date(ticket.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Corrigindo o cálculo do início da semana (domingo → segunda)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Segunda-feira
      weekStart.setHours(0, 0, 0, 0); // Começo do dia
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      switch (timeFilter) {
        case 'this-week':
          // Não mostrar tickets se criados antes do início da semana atual
          if (ticketDate < weekStart) return false;
          break;
        case 'last-week':
          const lastWeekStart = new Date(weekStart);
          lastWeekStart.setDate(weekStart.getDate() - 7); // Segunda-feira da semana passada
          
          const lastWeekEnd = new Date(weekStart);
          lastWeekEnd.setHours(0, 0, 0, -1); // Um milissegundo antes do início desta semana
          
          if (ticketDate < lastWeekStart || ticketDate > lastWeekEnd) return false;
          break;
        case 'this-month':
          if (ticketDate < monthStart) return false;
          break;
        case 'custom':
          // Filtro personalizado com range de datas
          if (dateRange.from) {
            const startDate = new Date(dateRange.from);
            startDate.setHours(0, 0, 0, 0); // Início do dia
            if (ticketDate < startDate) return false;
          }
          if (dateRange.to) {
            const endDate = new Date(dateRange.to);
            endDate.setHours(23, 59, 59, 999); // Final do dia
            if (ticketDate > endDate) return false;
            
            // Verifica se o ticketDate é do mesmo dia do endDate
            // Se sim, verificamos se o ticket foi criado depois do horário atual
            const currentDate = new Date();
            const isTicketSameDay = (
              ticketDate.getDate() === currentDate.getDate() &&
              ticketDate.getMonth() === currentDate.getMonth() &&
              ticketDate.getFullYear() === currentDate.getFullYear()
            );
            
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

  // Mostrar Skeleton enquanto a autenticação está carregando OU o usuário ainda não foi definido
  if (isAuthLoading || !user) {
    return (
      <StandardPage
        icon={Ticket}
        title="Chamados"
        description="Gerencie todos os chamados do sistema"
        createButtonText="Novo Chamado"
        onCreateClick={handleCreateTicket}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Buscar chamado..."
        isLoading={true}
      >
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </StandardPage>
    );
  }

  // Estado de erro
  if (ticketsError) {
    return (
      <StandardPage
        icon={Ticket}
        title="Chamados"
        description="Gerencie todos os chamados do sistema"
        createButtonText="Novo Chamado"
        onCreateClick={handleCreateTicket}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Buscar chamado..."
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar chamados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {ticketsError instanceof Error ? ticketsError.message : 'Ocorreu um erro inesperado'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      icon={Ticket}
      title="Chamados"
      description="Gerencie todos os chamados do sistema"
      createButtonText="Novo Chamado"
      onCreateClick={handleCreateTicket}
      onSearchChange={handleSearchChange}
      searchValue={searchQuery}
      searchPlaceholder="Buscar chamado..."
      isLoading={isTicketsLoading}
    >
      {/* Filtros Avançados */}
      <div className="space-y-4 mb-6">
        {/* Primeira linha: Período */}
        <div className="flex flex-wrap items-center gap-4">
          <Label className="text-sm font-medium">Período:</Label>
          {timeFilter === 'custom' ? (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[280px] justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} {' - '} 
                        {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Período Personalizado</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to
                  }}
                  onSelect={(range: DateRange | undefined) => {
                    setDateRange({ 
                      from: range?.from,
                      to: range?.to
                    });
                    if (range?.from && range?.to) {
                      setTimeout(() => setCalendarOpen(false), 500);
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Select
              value={timeFilter}
              onValueChange={(value) => {
                setTimeFilter(value);
                if (value === 'custom') {
                  setTimeout(() => setCalendarOpen(true), 100);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">Esta Semana</SelectItem>
                <SelectItem value="last-week">Semana Passada</SelectItem>
                <SelectItem value="this-month">Este Mês</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Segunda linha: Filtros de Prioridade, Status, Departamento e Atendente */}
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.LOW}>Baixa</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Média</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.HIGH}>Alta</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Crítica</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value={TICKET_STATUS.NEW}>Novos</SelectItem>
              <SelectItem value={TICKET_STATUS.ONGOING}>Em Andamento</SelectItem>
              <SelectItem value={TICKET_STATUS.RESOLVED}>Resolvidos</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Departamento */}
          <Select
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Atendente */}
          <Select
            value={assignedToFilter}
            onValueChange={setAssignedToFilter}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unassigned">Não Atribuídos</SelectItem>
              {officials?.map((official) => (
                <SelectItem key={official.id} value={official.id.toString()}>
                  {official.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {filteredTickets ? `${filteredTickets.length} chamado(s) encontrado(s)` : ''}
        </div>
      </div>

      {/* Lista de Tickets */}
      {filteredTickets && filteredTickets.length === 0 ? (
        <EmptyState
          icon={searchQuery ? Search : Ticket}
          title={searchQuery ? "Nenhum chamado encontrado" : "Nenhum chamado cadastrado"}
          description={searchQuery 
            ? `Não foram encontrados chamados com o termo "${searchQuery}".` 
            : "Não há chamados cadastrados no sistema. Clique no botão abaixo para criar o primeiro chamado."
          }
          actionLabel={searchQuery ? "Limpar busca" : "Criar Primeiro Chamado"}
          onAction={searchQuery ? () => setSearchQuery('') : handleCreateTicket}
        />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              Todos ({filteredTickets?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="new">
              Novos ({filteredTickets?.filter(t => t.status === TICKET_STATUS.NEW).length || 0})
            </TabsTrigger>
            <TabsTrigger value="ongoing">
              Em Andamento ({filteredTickets?.filter(t => t.status === TICKET_STATUS.ONGOING).length || 0})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolvidos ({filteredTickets?.filter(t => t.status === TICKET_STATUS.RESOLVED).length || 0})
            </TabsTrigger>
          </TabsList>

                     <TabsContent value="all" className="space-y-4 mt-6">
             {filteredTickets?.map((ticket) => (
               <TicketCard 
                 key={ticket.id} 
                 ticket={ticket} 
                 onAssignTicket={handleAssignTicket}
                 isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
               />
             ))}
           </TabsContent>

           <TabsContent value="new" className="space-y-4 mt-6">
             {filteredTickets?.filter(t => t.status === TICKET_STATUS.NEW).map((ticket) => (
               <TicketCard 
                 key={ticket.id} 
                 ticket={ticket} 
                 onAssignTicket={handleAssignTicket}
                 isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
               />
             ))}
           </TabsContent>

           <TabsContent value="ongoing" className="space-y-4 mt-6">
             {filteredTickets?.filter(t => t.status === TICKET_STATUS.ONGOING).map((ticket) => (
               <TicketCard 
                 key={ticket.id} 
                 ticket={ticket} 
                 onAssignTicket={handleAssignTicket}
                 isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
               />
             ))}
           </TabsContent>

           <TabsContent value="resolved" className="space-y-4 mt-6">
             {filteredTickets?.filter(t => t.status === TICKET_STATUS.RESOLVED).map((ticket) => (
               <TicketCard 
                 key={ticket.id} 
                 ticket={ticket} 
                 onAssignTicket={handleAssignTicket}
                 isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
               />
             ))}
           </TabsContent>
        </Tabs>
      )}
    </StandardPage>
  );
}
