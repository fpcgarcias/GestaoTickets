import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TimeMetricCard } from '@/components/ui/time-metric-card';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Clock, CheckCircle2 } from 'lucide-react';
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
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface RecentTicket {
  id: number;
  title: string;
  customer: { email?: string };
  created_at: string;
  status: 'new' | 'ongoing' | 'resolved';
  priority: string;
}

export default function Dashboard() {
  // Utilizamos as rotas que já filtram tickets baseados no papel do usuário
  const { data: ticketStatsData, isLoading: isStatsLoading } = useQuery<TicketStats>({ // Tipo explícito
    queryKey: ['/api/tickets/stats'],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: recentTicketsData, isLoading: isRecentLoading } = useQuery<RecentTicket[]>({ // Tipo explícito
    queryKey: ['/api/tickets/recent'],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: avgFirstResponseData, isLoading: isFirstResponseLoading } = useQuery<{ averageTime: number }>({
    queryKey: ['/api/tickets/average-first-response-time'],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: avgResolutionData, isLoading: isResolutionLoading } = useQuery<{ averageTime: number }>({
    queryKey: ['/api/tickets/average-resolution-time'],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Garantir que os dados não sejam undefined antes de acessar propriedades
  const ticketStats = ticketStatsData || { 
    total: 0, 
    byStatus: { new: 0, ongoing: 0, resolved: 0 }, // Garantir que as chaves existam
    byPriority: { low: 0, medium: 0, high: 0, critical: 0 } // Garantir que as chaves existam
  };
  const recentTickets = Array.isArray(recentTicketsData) ? recentTicketsData : [];

  // Dados de status transformados para português
  const statusData = [
    { name: 'Novos', value: ticketStats.byStatus.new, color: '#F59E0B' },
    { name: 'Em Andamento', value: ticketStats.byStatus.ongoing, color: '#3B82F6' },
    { name: 'Resolvidos', value: ticketStats.byStatus.resolved, color: '#10B981' },
  ];

  // Filtrar dados para o gráfico (apenas status com valor > 0)
  const statusDataForChart = statusData.filter(item => item.value > 0);

  const priorityData = [
    { name: 'Baixa', Qtde: ticketStats.byPriority.low }, // Acesso direto agora é seguro
    { name: 'Média', Qtde: ticketStats.byPriority.medium }, // Acesso direto agora é seguro
    { name: 'Alta', Qtde: ticketStats.byPriority.high }, // Acesso direto agora é seguro
    { name: 'Crítica', Qtde: ticketStats.byPriority.critical }, // Acesso direto agora é seguro
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Painel de Controle</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
      </div>
      
      {/* Nova seção para métricas de tempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TimeMetricCard
          title="Tempo Médio de Primeira Resposta"
          description="Tempo médio entre a criação e primeira resposta dos chamados"
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
            ) : (
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
                        {ticket.customer.email} • {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
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
}

const StatCard: React.FC<StatCardProps> = ({ title, value, isLoading, status }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-2">
          {status && <StatusDot status={status} className="mr-2" />}
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
