import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search, Calendar } from 'lucide-react';
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
import { Ticket, Official, Department } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function TicketsIndex() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('this-week');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ 
    from: undefined, 
    to: undefined 
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Pegar estado de autenticação
  const { user, isLoading: isAuthLoading } = useAuth();

  // Busca tickets com base no papel do usuário
  const { data: tickets, isLoading: isTicketsLoading } = useQuery<Ticket[]>({
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
            <div key={i} className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm">
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
        <h1 className="text-2xl font-semibold text-neutral-900">Chamados</h1>
        <Button onClick={() => navigate('/tickets/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </div>

      {/* Filters Section */}
      <div className="space-y-4 mb-6">
        {/* Primeira linha: Busca e Período */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
            <Input 
              placeholder="Buscar chamado" 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Segunda linha: Filtros de Prioridade, Departamento e Atendente */}
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.LOW}>Baixa</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Média</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.HIGH}>Alta</SelectItem>
              <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Crítica</SelectItem>
            </SelectContent>
          </Select>

          {/* 🆕 Filtro de Departamento */}
          <Select
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Departamentos</SelectItem>
              {departments && departments.length > 0 && (
                departments.map((department) => (
                  <SelectItem key={department.id} value={department.id.toString()}>
                    {department.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* 🆕 Filtro de Atendente */}
          <Select
            value={assignedToFilter}
            onValueChange={setAssignedToFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Atendentes</SelectItem>
              <SelectItem value="unassigned">Não Atribuídos</SelectItem>
              {officials && officials.length > 0 && (
                officials.map((official) => (
                  <SelectItem key={official.id} value={official.id.toString()}>
                    {official.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs 
        defaultValue="all" 
        value={statusFilter}
        onValueChange={setStatusFilter}
        className="mb-6"
      >
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
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Novos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados em Andamento</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Resolvidos</span>
          </div>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {isTicketsLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm">
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
        ) : filteredTickets?.length ? (
          filteredTickets.map(ticket => (
            <TicketCard 
              key={ticket.id} 
              ticket={ticket} 
              onAssignTicket={handleAssignTicket}
              isAssigning={assignTicketMutation.isPending && assignTicketMutation.variables?.ticketId === ticket.id}
            />
          ))
        ) : (
          <div className="bg-white rounded-md border border-neutral-200 p-8 text-center">
            <h3 className="text-lg font-medium text-neutral-700 mb-2">Nenhum chamado encontrado</h3>
            <p className="text-neutral-500 mb-4">
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

      {/* Pagination */}
      {filteredTickets && filteredTickets.length > 0 && (
        <div className="flex justify-end mt-6">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" className="bg-primary text-white hover:bg-primary/90">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
