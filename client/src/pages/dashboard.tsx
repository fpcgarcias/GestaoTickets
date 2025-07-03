import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TimeMetricCard } from '@/components/ui/time-metric-card';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Clock, CheckCircle2, Users, Calendar, MoreHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/hooks/use-auth';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

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

export default function Dashboard() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  
  // Estados para filtro de período
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);

  // Função para calcular datas baseado no período selecionado
  const getPeriodDates = () => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'current_month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth)
        };
      case 'current_year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now)
        };
      case 'custom':
        return {
          startDate: customStartDate || startOfMonth(now),
          endDate: customEndDate || endOfMonth(now)
        };
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
    }
  };

  const { startDate, endDate } = getPeriodDates();

  const [selectedOfficialId, setSelectedOfficialId] = useState<string>('all');

  // Verificar se deve exibir o filtro de atendentes
  // APENAS admin, company_admin, manager, supervisor e support devem ver o dropdown
  // customer, viewer, etc. NÃO devem ver
  const shouldShowOfficialFilter = user?.role && ['admin', 'company_admin', 'manager', 'supervisor', 'support'].includes(user.role);

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
    
    // Adicionar datas do período
    periodParams.append('start_date', startDate.toISOString());
    periodParams.append('end_date', endDate.toISOString());
    
    return periodParams.toString();
  };

  // Utilizamos as rotas que já filtram tickets baseados no papel do usuário
  const { data: ticketStatsData, isLoading: isStatsLoading } = useQuery<TicketStats>({
    queryKey: ['tickets/stats', startDate.toISOString(), endDate.toISOString(), selectedOfficialId],
    queryFn: async () => {
      const params = getQueryParamsWithPeriod();
      const url = `/api/tickets/stats${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: recentTicketsData, isLoading: isRecentLoading } = useQuery<RecentTicket[]>({
    queryKey: ['tickets/recent', startDate.toISOString(), endDate.toISOString(), selectedOfficialId],
    queryFn: async () => {
      const params = getQueryParamsWithPeriod();
      const url = `/api/tickets/recent${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch recent tickets');
      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: avgFirstResponseData, isLoading: isFirstResponseLoading } = useQuery<{ averageTime: number }>({
    queryKey: ['tickets/average-first-response-time', startDate.toISOString(), endDate.toISOString(), selectedOfficialId],
    queryFn: async () => {
      const params = getQueryParamsWithPeriod();
      const url = `/api/tickets/average-first-response-time${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch avg first response time');
      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: avgResolutionData, isLoading: isResolutionLoading } = useQuery<{ averageTime: number }>({
    queryKey: ['tickets/average-resolution-time', startDate.toISOString(), endDate.toISOString(), selectedOfficialId],
    queryFn: async () => {
      const params = getQueryParamsWithPeriod();
      const url = `/api/tickets/average-resolution-time${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch avg resolution time');
      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Garantir que os dados não sejam undefined antes de acessar propriedades
  const ticketStats = ticketStatsData || { 
    total: 0, 
    byStatus: { new: 0, ongoing: 0, resolved: 0 }, 
    byPriority: { low: 0, medium: 0, high: 0, critical: 0 } 
  };
  const recentTickets = Array.isArray(recentTicketsData) ? recentTicketsData : [];

  // Calcular chamados com outros status (qualquer status que não seja new, ongoing ou resolved)
  const otherStatusCount = Object.entries(ticketStats.byStatus)
    .filter(([status]) => !['new', 'ongoing', 'resolved'].includes(status))
    .reduce((sum, [_, count]) => sum + count, 0);

  // Dados de status transformados para português
  const statusData = [
    { name: 'Novos', value: ticketStats.byStatus.new, color: '#F59E0B' },
    { name: 'Em Andamento', value: ticketStats.byStatus.ongoing, color: '#3B82F6' },
    { name: 'Resolvidos', value: ticketStats.byStatus.resolved, color: '#10B981' },
  ];

  // Filtrar dados para o gráfico (apenas status com valor > 0)
  const statusDataForChart = statusData.filter(item => item.value > 0);

  // Processar dados de prioridade para incluir todas as prioridades (customizadas e padrão)
  const priorityData = Object.entries(ticketStats.byPriority)
    .map(([priority, count]) => {
      // Mapear nomes de prioridade para exibição
      const priorityNames: Record<string, string> = {
        low: 'Baixa',
        medium: 'Média',
        high: 'Alta',
        critical: 'Crítica',
        // Adicionar mapeamentos para prioridades customizadas se necessário
      };
      
      return {
        name: priorityNames[priority] || priority.charAt(0).toUpperCase() + priority.slice(1),
        Qtde: count
      };
    })
    .filter(item => item.Qtde > 0) // Filtrar apenas prioridades com tickets
    .sort((a, b) => b.Qtde - a.Qtde); // Ordenar por quantidade decrescente

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Painel de Controle</h1>
        
        {/* Filtros */}
        <div className="flex items-center gap-4">
          {/* Filtro de período */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <Select value={selectedPeriod} onValueChange={(value) => {
              setSelectedPeriod(value);
              setIsCustomPeriod(value === 'custom');
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Calendários para período personalizado */}
            {isCustomPeriod && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-32">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'dd/MM', { locale: ptBR }) : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-32">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'dd/MM', { locale: ptBR }) : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
            
            {/* Indicador discreto do período */}
            <span className="text-xs text-muted-foreground">
              {format(startDate, 'dd/MM/yy', { locale: ptBR })} - {format(endDate, 'dd/MM/yy', { locale: ptBR })}
            </span>
          </div>
          
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
                  {filteredOfficials.map((official: Official) => (
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
          value={ticketStats.total} // Acesso direto agora é seguro
          isLoading={isStatsLoading}
        />
        <StatCard 
          title="Chamados Novos" 
          value={ticketStats.byStatus.new} // Acesso direto agora é seguro
          isLoading={isStatsLoading}
          status={TICKET_STATUS.NEW as 'new'} // Cast para o tipo literal
        />
        <StatCard 
          title="Chamados em Andamento" 
          value={ticketStats.byStatus.ongoing} // Acesso direto agora é seguro
          isLoading={isStatsLoading}
          status={TICKET_STATUS.ONGOING as 'ongoing'} // Cast para o tipo literal
        />
        <StatCard 
          title="Chamados Resolvidos" 
          value={ticketStats.byStatus.resolved} // Acesso direto agora é seguro
          isLoading={isStatsLoading}
          status={TICKET_STATUS.RESOLVED as 'resolved'} // Cast para o tipo literal
        />
        <StatCard 
          title="Outros Status" 
          value={otherStatusCount}
          isLoading={isStatsLoading}
          icon="other" // Ícone especial para outros status
        />
      </div>
      
      {/* Nova seção para métricas de tempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TimeMetricCard
          title="Tempo Médio de Início de Atendimento"
          description="Tempo médio entre a criação e início de atendimento dos chamados"
          value={avgFirstResponseData?.averageTime || 0}
          isLoading={isFirstResponseLoading}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
        />
        <TimeMetricCard
          title="Tempo Médio de Resolução"
          description="Tempo médio entre a criação e resolução dos chamados"
          value={avgResolutionData?.averageTime || 0}
          isLoading={isResolutionLoading}
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
            {isStatsLoading ? (
              <Skeleton className="w-full h-72" />
            ) : statusDataForChart.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDataForChart}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusDataForChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Legenda customizada mostrando todos os status */}
                <div className="flex justify-center mt-4">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {statusData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-gray-600">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center h-72">
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">Nenhum chamado cadastrado</p>
                    <p className="text-sm text-gray-400">Os dados aparecerão aqui quando houver chamados no sistema</p>
                  </div>
                </div>
                
                {/* Legenda sempre visível mesmo sem dados */}
                <div className="flex justify-center mt-4">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {statusData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-gray-600">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Chamados por Prioridade</CardTitle>
            <CardDescription>Número de chamados para cada nível de prioridade</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <Skeleton className="w-full h-72" />
            ) : priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={priorityData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Qtde" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-72">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">Nenhum chamado cadastrado</p>
                  <p className="text-sm text-gray-400">Os dados aparecerão aqui quando houver chamados no sistema</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Chamados Recentes</CardTitle>
          <CardDescription>Chamados mais recentes que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          {isRecentLoading ? (
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
  isLoading: boolean;
  status?: 'new' | 'ongoing' | 'resolved'; // Tipo mais específico para status
  icon?: string; // Adicionar suporte para ícone customizado
}

const StatCard: React.FC<StatCardProps> = ({ title, value, isLoading, status, icon }) => {
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
          <p className="text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
};
