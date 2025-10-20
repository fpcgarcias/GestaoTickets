import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search, Calendar } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
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
import { Ticket, Official, Department } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { usePriorities } from '@/hooks/use-priorities';

// Utilitário para converter data local (Brasília) para UTC ISO string (yyyy-mm-ddTHH:MM:SSZ)
function toBrasiliaISOString(date: Date, endOfDay = false) {
  // CORREÇÃO: Para converter de UTC-3 para UTC, devemos ADICIONAR 3 horas
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  if (endOfDay) {
    local.setHours(23, 59, 59, 999);
  } else {
    local.setHours(0, 0, 0, 0);
  }
  return local.toISOString();
}

export default function TicketsIndex() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('this-month');
  const [includeOpenOutsidePeriod, setIncludeOpenOutsidePeriod] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');
  const [hideResolved, setHideResolved] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ 
    from: undefined, 
    to: undefined 
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Pegar estado de autenticação
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Reset page when any filter changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching
  };
  
  const handleFilterChange = (setter: (value: any) => void) => {
    return (value: any) => {
      setter(value);
      setCurrentPage(1); // Reset to first page when filtering
    };
  };
  
  const handleCheckboxChange = (setter: (value: boolean) => void) => {
    return (checked: boolean | "indeterminate") => {
      setter(checked as boolean);
      setCurrentPage(1); // Reset to first page when filtering
    };
  };

  // Calcular datas exatamente como o dashboard faz
  const getPeriodDates = () => {
    const now = new Date();
    let from: Date;
    let to: Date;
    
    switch (timeFilter) {
      case 'this-week':
        from = startOfWeek(now, { weekStartsOn: 1 }); // segunda-feira
        to = endOfWeek(now, { weekStartsOn: 1 }); // domingo
        break;
      case 'last-week': {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case 'this-month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'custom':
        from = dateRange.from ? dateRange.from : startOfMonth(now);
        to = dateRange.to ? dateRange.to : endOfMonth(now);
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }
    return { startDate: from, endDate: to };
  };

  // Busca tickets com base no papel do usuário com paginação e filtros
  const { data: ticketsResponse, isLoading: isTicketsLoading } = useQuery({
    queryKey: ['/api/tickets/user-role', currentPage, searchQuery, statusFilter, priorityFilter, departmentFilter, assignedToFilter, hideResolved, timeFilter, dateRange, includeOpenOutsidePeriod],
    queryFn: async () => {
      const { startDate, endDate } = getPeriodDates();
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter && priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(departmentFilter && departmentFilter !== 'all' && { department_id: departmentFilter }),
        ...(assignedToFilter && assignedToFilter !== 'all' && { assigned_to_id: assignedToFilter }),
        ...(hideResolved && { hide_resolved: 'true' }),
        // SEMPRE enviar start_date e end_date como o dashboard faz
        start_date: toBrasiliaISOString(startDate, false),
        end_date: toBrasiliaISOString(endDate, true),
        ...(timeFilter === 'this-month' && includeOpenOutsidePeriod ? { include_open_outside_period: 'true' } : {}),
      });
      
      const res = await fetch(`/api/tickets/user-role?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar tickets');
      return res.json();
    },
    enabled: !!user,
  });

  const tickets = ticketsResponse?.data || [];
  const pagination = ticketsResponse?.pagination;

  // 🆕 Busca departamentos (filtrado por empresa automaticamente no backend)
  const { data: departmentsResponse, isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ['/api/departments', { active_only: true }],
    queryFn: async () => {
      const res = await fetch('/api/departments?active_only=true');
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: !!user,
  });

  const departments = departmentsResponse?.departments || departmentsResponse || [];

  // Buscar prioridades do departamento selecionado
  // Se nenhum departamento selecionado, pega prioridades padrão (sem departmentId)
  const selectedDeptId = departmentFilter !== 'all' ? parseInt(departmentFilter) : undefined;
  const { data: departmentPriorities = [], isLoading: prioritiesLoading } = usePriorities(selectedDeptId);
  
  // Para o filtro, sempre mostrar prioridades disponíveis (padrão quando nenhum departamento selecionado)
  const availablePriorities = departmentPriorities || [];

  // 🆕 Busca atendentes (filtrado por empresa automaticamente no backend)  
  const { data: officialsResponse, isLoading: isOfficialsLoading } = useQuery({
    queryKey: ['/api/officials'],
    queryFn: async () => {
      const res = await fetch('/api/officials?limit=1000'); // Buscar todos para o dropdown
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    enabled: !!user,
  });

  const officials = officialsResponse?.data || [];

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

  // Os filtros agora são aplicados no backend, não precisamos mais filtrar no frontend

  // Mostrar Skeleton enquanto a autenticação está carregando OU o usuário ainda não foi definido
  if (isAuthLoading || !user) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-4 mb-6">
          {/* Primeira linha de filtros */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-44" />
          </div>
          {/* Segunda linha de filtros */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[200px]" />
          </div>
        </div>
        <Skeleton className="h-10 w-full mb-6" /> {/* Tabs */}
        <Skeleton className="h-16 w-full mb-6" /> {/* Legend */}
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-md border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-10 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Chamados</h1>
        <Button onClick={() => navigate('/tickets/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </div>

      {/* Filters Section */}
      <div className="space-y-4 mb-6">
        {/* Primeira linha: Busca e Período */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Buscar chamado" 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

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
                    setCurrentPage(1); // Reset to first page when date range changes
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
                handleFilterChange(setTimeFilter)(value);
                if (value === 'custom') {
                  setTimeout(() => setCalendarOpen(true), 100);
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
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

        {/* Segunda linha: Filtros de Departamento, Prioridade, Status e Atendente */}
        <div className="flex flex-wrap items-center gap-4">
          {/* 🏢 Filtro de Departamento - PRIMEIRO (prioridades dependem dele) */}
          <Select
            value={departmentFilter}
            onValueChange={(value) => {
              handleFilterChange(setDepartmentFilter)(value);
              // Limpar filtro de prioridade quando departamento muda
              if (value !== departmentFilter) {
                setPriorityFilter('all');
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Departamentos</SelectItem>
              {departments && departments.length > 0 && (
                departments.map((department: any) => (
                  <SelectItem key={department.id} value={department.id.toString()}>
                    {department.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* 🎯 Filtro de Prioridade - SEGUNDO (depende do departamento) */}
          <Select
            value={priorityFilter}
            onValueChange={handleFilterChange(setPriorityFilter)}
            disabled={prioritiesLoading}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={prioritiesLoading ? "Carregando..." : "Prioridade"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              {availablePriorities.map((priority: any) => (
                <SelectItem key={priority.id} value={priority.value}>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: priority.color }}
                    />
                    <span>{priority.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ✅ Filtro de Status */}
          <Select
            value={statusFilter}
            onValueChange={handleFilterChange(setStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="new">🆕 Novo</SelectItem>
              <SelectItem value="ongoing">⚡ Em Andamento</SelectItem>
              <SelectItem value="suspended">⏸️ Suspenso</SelectItem>
              <SelectItem value="waiting_customer">⏳ Aguardando Cliente</SelectItem>
              <SelectItem value="escalated">🚨 Escalado</SelectItem>
              <SelectItem value="in_analysis">🔍 Em Análise</SelectItem>
              <SelectItem value="pending_deployment">🚀 Aguardando Deploy</SelectItem>
              <SelectItem value="reopened">🔄 Reaberto</SelectItem>
              <SelectItem value="resolved">✅ Resolvido</SelectItem>
            </SelectContent>
          </Select>

          {/* 🆕 Filtro de Atendente */}
          <Select
            value={assignedToFilter}
            onValueChange={handleFilterChange(setAssignedToFilter)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Atendentes</SelectItem>
              <SelectItem value="unassigned">Não Atribuídos</SelectItem>
              {officials && officials.length > 0 && (
                [...officials].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map((official: any) => (
                  <SelectItem key={official.id} value={official.id.toString()}>
                    {official.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Terceira linha: Checkboxes de resolvidos e incluir abertos anteriores */}
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideResolved"
              checked={hideResolved}
              onCheckedChange={handleCheckboxChange(setHideResolved)}
            />
            <Label
              htmlFor="hideResolved"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Ocultar chamados resolvidos
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeOpenOutsidePeriod"
              checked={includeOpenOutsidePeriod}
              // Só faz sentido quando o período é "Este Mês"
              disabled={timeFilter !== 'this-month'}
              onCheckedChange={(checked) => {
                setIncludeOpenOutsidePeriod(!!checked);
                setCurrentPage(1);
              }}
            />
            <Label
              htmlFor="includeOpenOutsidePeriod"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incluir abertos de períodos anteriores
            </Label>
          </div>
        </div>
      </div>

      {/* Status Tabs - Mantido para navegação rápida */}
      <Tabs 
        defaultValue="all" 
        value={statusFilter}
        onValueChange={handleFilterChange(setStatusFilter)}
        className="mb-6"
      >
        <TabsList className="border-b border-border w-full justify-start rounded-none bg-transparent">
          <TabsTrigger value="all" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Todos os Chamados
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.NEW} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            🆕 Novos
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.ONGOING} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            ⚡ Em Andamento
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.SUSPENDED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            ⏸️ Suspensos
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.WAITING_CUSTOMER} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            ⏳ Aguardando Cliente
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.ESCALATED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            🚨 Escalados
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.RESOLVED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            ✅ Resolvidos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {isTicketsLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-md border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-10 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))
        ) : tickets?.length ? (
          tickets.map((ticket: any) => (
            <TicketCard 
              key={ticket.id} 
              ticket={ticket} 
              onAssignTicket={handleAssignTicket}
              isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
            />
          ))
        ) : (
          <div className="bg-card rounded-md border border-border p-8 text-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum chamado encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Tente ajustar seus termos de busca' : 'Crie seu primeiro chamado para começar'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/tickets/new">Criar Chamado</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} chamados
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!pagination.hasPrev}
              onClick={() => pagination.hasPrev && setCurrentPage(pagination.page - 1)}
            >
              Anterior
            </Button>
            
            {/* Páginas numeradas */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={pagination.page === pageNum ? "bg-primary text-white hover:bg-primary/90" : ""}
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!pagination.hasNext}
              onClick={() => pagination.hasNext && setCurrentPage(pagination.page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
