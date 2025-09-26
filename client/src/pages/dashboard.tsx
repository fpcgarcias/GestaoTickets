import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TimeMetricCard } from '@/components/ui/time-metric-card';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Clock, CheckCircle2, Users, Calendar, MoreHorizontal, Building } from 'lucide-react';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useBusinessHoursRefetchInterval } from '../hooks/use-business-hours';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModernPieChart } from '@/components/charts/modern-pie-chart';
import { ModernBarChart } from '@/components/charts/modern-bar-chart';
import { ComparisonArrow } from '@/components/ui/comparison-arrow';

// Definir tipos para os dados das consultas
interface TicketStats {
  total: number;
  byStatus: {
    new: number;
    ongoing: number;
    resolved: number;
    [key: string]: number; // Para outros status que possam existir
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
    [key: string]: number; // Para prioridades customizadas
  };
}

interface RecentTicket {
  id: number;
  title: string;
  status: 'new' | 'ongoing' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  customer?: {
    name: string;
  };
}

interface Official {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  company_id?: number;
  supervisor_id?: number;
  manager_id?: number;
}

// Opções de períodos pré-definidos
const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Mês Atual' },
  { value: 'last_month', label: 'Mês Passado' },
  { value: 'current_year', label: 'Ano Atual' },
  { value: 'custom', label: 'Personalizado' }
];

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

// Função utilitária para normalizar prioridade (primeira letra maiúscula, resto minúsculo)
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

export default function Dashboard() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  
  // Novo filtro de datas igual ao index.tsx
  const [timeFilter, setTimeFilter] = useState('this-month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Filtro de departamento
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');

  // Função para calcular datas igual ao index.tsx
  function getPeriodDates() {
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
  }
  const { startDate, endDate } = getPeriodDates();

  const [selectedOfficialId, setSelectedOfficialId] = useState<string>('all');

  // Verificar se deve exibir o filtro de atendentes
  // APENAS admin, company_admin, manager, supervisor e support devem ver o dropdown
  // customer, viewer, etc. NÃO devem ver
  const shouldShowOfficialFilter = user?.role && ['admin', 'company_admin', 'manager', 'supervisor', 'support'].includes(user.role);

  // Verificar se deve exibir o filtro de departamentos
  // APENAS admin, company_admin, manager e supervisor devem ver o dropdown
  // Outras roles (support, customer, viewer, etc.) NÃO devem ver
  const shouldShowDepartmentFilter = user?.role && ['admin', 'company_admin', 'manager', 'supervisor'].includes(user.role);

  // Buscar departamentos apenas se necessário
  // O endpoint /api/departments já filtra automaticamente baseado na role:
  // - Admin/Company_admin: retorna todos os departamentos
  // - Manager/Supervisor: retorna apenas departamentos vinculados ao usuário
  const { data: departmentsResponse, isLoading: isDepartmentsLoading } = useQuery({
    queryKey: ['/api/departments', { active_only: true }, user?.role, user?.id],
    queryFn: async () => {
      const res = await fetch('/api/departments?active_only=true');
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: shouldShowDepartmentFilter,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const departments = departmentsResponse?.departments || departmentsResponse || [];

  // Buscar atendentes apenas se necessário
  const { data: officialsResponse, isLoading: isOfficialsLoading } = useQuery({
    queryKey: ['/api/officials', user?.id, user?.role], // Incluir user.id e role na chave
    queryFn: async () => {
      const res = await fetch('/api/officials?limit=1000'); // Buscar todos para o dashboard
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    enabled: shouldShowOfficialFilter,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const officials = officialsResponse?.data || [];

  // Filtrar atendentes baseado na role do usuário
  const getFilteredOfficials = () => {
    if (!officials || !user) return [];
    
    // A API já está filtrando corretamente por role, então apenas retornamos os dados
    return officials.filter((official: Official) => official.is_active);
  };

  const filteredOfficials = getFilteredOfficials();

  // Construir query key com filtro de atendente
  const getQueryKey = (endpoint: string) => {
    const baseKey = [endpoint];
    if (selectedOfficialId !== 'all') {
      baseKey.push(`official_${selectedOfficialId}`);
    }
    return baseKey;
  };

  // Construir query params para as APIs
  const getQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedOfficialId !== 'all') {
      params.append('official_id', selectedOfficialId);
    }
    return params.toString();
  };

  // Construir parâmetros de query incluindo período
  const getQueryParamsWithPeriod = () => {
    const periodParams = new URLSearchParams();
    // Adicionar filtro de atendente se selecionado
    if (selectedOfficialId !== 'all') {
      periodParams.append('official_id', selectedOfficialId);
    }
    // Adicionar datas do período (ajustadas para UTC-3)
    periodParams.append('start_date', toBrasiliaISOString(startDate, false));
    periodParams.append('end_date', toBrasiliaISOString(endDate, true));
    return periodParams.toString();
  };

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(60000);

  // Query única para todas as métricas do dashboard
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard-metrics', startDate.toISOString(), endDate.toISOString(), selectedOfficialId, selectedDepartmentId],
    queryFn: async () => {
      let params = getQueryParamsWithPeriod();
      // Adicionar filtro de departamento se selecionado
      if (selectedDepartmentId !== 'all') {
        const urlParams = new URLSearchParams(params);
        urlParams.append('department_id', selectedDepartmentId);
        params = urlParams.toString();
      }
      const url = `/api/tickets/dashboard-metrics${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
      return response.json();
    },
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
    refetchIntervalInBackground: false,
  });

  // Adaptar os dados para o formato esperado
  const ticketStats = dashboardData?.stats || { 
    total: 0, 
    byStatus: { new: 0, ongoing: 0, resolved: 0 }, 
    byPriority: { low: 0, medium: 0, high: 0, critical: 0 } 
  };
  const avgFirstResponseData = { averageTime: dashboardData?.averageFirstResponseTime || 0 };
  const avgResolutionData = { averageTime: dashboardData?.averageResolutionTime || 0 };
  const recentTickets = Array.isArray(dashboardData?.recentTickets) ? dashboardData.recentTickets : [];

  // Dados de comparação do período anterior
  const previousTicketStats = dashboardData?.previousStats || null;
  const previousAvgFirstResponseTime = dashboardData?.previousAverageFirstResponseTime || null;
  const previousAvgResolutionTime = dashboardData?.previousAverageResolutionTime || null;

  // Calcular chamados com outros status (qualquer status que não seja new, ongoing ou resolved)
  const otherStatusCount = Object.entries(ticketStats.byStatus)
    .filter(([status]) => !['new', 'ongoing', 'resolved'].includes(status))
    .reduce((sum, [_, count]) => sum + (count as number), 0);

  // Calcular valores anteriores para comparação (removido previousOtherStatusCount - não é mais usado)

  // Dados de status transformados para português
  const statusData = [
    { name: 'Novos', value: ticketStats.byStatus.new, color: '#F59E0B' },
    { name: 'Em Andamento', value: ticketStats.byStatus.ongoing, color: '#3B82F6' },
    { name: 'Resolvidos', value: ticketStats.byStatus.resolved, color: '#10B981' },
    { name: 'Outros Status', value: otherStatusCount, color: '#8B5CF6' },
  ];

  // Os novos componentes modernos lidam com dados vazios internamente

  // Processar dados de prioridade - agrupar case-insensitive e exibir padronizado
  const prioridadeMap: Record<string, { name: string; Qtde: number }> = {};
  Object.entries(ticketStats.byPriority).forEach(([priority, count]) => {
    const key = normalizarPrioridade(priority);
    if (!prioridadeMap[key]) {
      prioridadeMap[key] = { name: key, Qtde: 0 };
    }
    prioridadeMap[key].Qtde += Number(count ?? 0);
  });
  const priorityData = Object.values(prioridadeMap)
    .filter(item => item.Qtde > 0)
    .sort((a, b) => b.Qtde - a.Qtde);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Painel de Controle</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <DateRangeFilter
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              dateRange={dateRange}
              setDateRange={setDateRange}
              calendarOpen={calendarOpen}
              setCalendarOpen={setCalendarOpen}
            />
            {/* Indicador discreto do período */}
            <span className="text-xs text-muted-foreground">
              {format(startDate, 'dd/MM/yy', { locale: ptBR })} - {format(endDate, 'dd/MM/yy', { locale: ptBR })}
            </span>
          </div>
          {/* Filtro de Departamento */}
          {shouldShowDepartmentFilter && (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-neutral-500" />
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos os Departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Departamentos</SelectItem>
                  {departments.map((department: any) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Filtro de Atendente */}
          {shouldShowOfficialFilter && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-500" />
              <Select value={selectedOfficialId} onValueChange={setSelectedOfficialId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos os Atendentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Atendentes</SelectItem>
                  {[...filteredOfficials].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map((official: Official) => (
                    <SelectItem key={official.id} value={official.id.toString()}>
                      {official.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <StatCard 
          title="Total de Chamados" 
          value={ticketStats.total}
          previousValue={previousTicketStats?.total}
          isLoading={isDashboardLoading}
        />
        <StatCard 
          title="Chamados Novos" 
          value={ticketStats.byStatus.new}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.NEW as 'new'}
        />
        <StatCard 
          title="Chamados em Andamento" 
          value={ticketStats.byStatus.ongoing}
          previousValue={previousTicketStats?.byStatus.ongoing}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.ONGOING as 'ongoing'}
        />
        <StatCard 
          title="Chamados Resolvidos" 
          value={ticketStats.byStatus.resolved}
          previousValue={previousTicketStats?.byStatus.resolved}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.RESOLVED as 'resolved'}
        />
        <StatCard 
          title="Outros Status" 
          value={otherStatusCount}
          isLoading={isDashboardLoading}
          icon="other"
        />
      </div>
      
      {/* Nova seção para métricas de tempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TimeMetricCard
          title="Tempo Médio de Início de Atendimento"
          description="Tempo médio entre a criação e início de atendimento dos chamados"
          value={avgFirstResponseData?.averageTime || 0}
          previousValue={previousAvgFirstResponseTime}
          isLoading={isDashboardLoading}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
        />
        <TimeMetricCard
          title="Tempo Médio de Resolução"
          description="Tempo médio entre a criação e resolução dos chamados"
          value={avgResolutionData?.averageTime || 0}
          previousValue={previousAvgResolutionTime}
          isLoading={isDashboardLoading}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Chamados por Status</CardTitle>
            <CardDescription>Distribuição de chamados por diferentes status</CardDescription>
          </CardHeader>
          <CardContent>
            <ModernPieChart 
              data={statusData} 
              isLoading={isDashboardLoading}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Chamados por Prioridade</CardTitle>
            <CardDescription>Número de chamados para cada nível de prioridade</CardDescription>
          </CardHeader>
          <CardContent>
            <ModernBarChart 
              data={priorityData} 
              isLoading={isDashboardLoading}
            />
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Chamados Recentes</CardTitle>
          <CardDescription>Chamados mais recentes que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          {isDashboardLoading ? (
            <div className="space-y-4">
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.slice(0, 5).map((ticket: RecentTicket) => (
                <div key={ticket.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center">
                    <StatusDot status={ticket.status} className="mr-2" />
                    <div>
                      <p className="font-medium">{ticket.title}</p>
                      <p className="text-sm text-neutral-500">
                        {ticket.customer?.name} • {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {ticket.priority === PRIORITY_LEVELS.HIGH && (
                      <span className="text-xs font-medium text-white bg-status-high px-2 py-1 rounded">
                        Alta Prioridade
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  previousValue?: number; // Valor anterior para comparação
  isLoading: boolean;
  status?: 'new' | 'ongoing' | 'resolved'; // Tipo mais específico para status
  icon?: string; // Adicionar suporte para ícone customizado
}

const StatCard: React.FC<StatCardProps> = ({ title, value, previousValue, isLoading, status, icon }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-2">
          {status && <StatusDot status={status} className="mr-2" />}
          {icon === 'other' && <MoreHorizontal className="h-4 w-4 mr-2 text-gray-500" />}
          <h3 className="font-medium">{title}</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-16" />
        ) : (
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold">{value}</p>
            {previousValue !== undefined && (
              <ComparisonArrow 
                currentValue={value} 
                previousValue={previousValue}
                format="number"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
