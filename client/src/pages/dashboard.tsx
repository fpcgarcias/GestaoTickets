import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
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
import { Button } from '@/components/ui/button';
import { LayoutDashboard, AlertTriangle } from 'lucide-react';

// Novos imports padronizados
import { StandardPage, EmptyState } from '@/components/layout/admin-page-layout';

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
  const { data: ticketStatsData, isLoading: isStatsLoading, error: statsError } = useQuery<TicketStats>({ // Tipo explícito
    queryKey: ['/api/tickets/stats'],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: recentTicketsData, isLoading: isRecentLoading, error: recentError } = useQuery<RecentTicket[]>({ // Tipo explícito
    queryKey: ['/api/tickets/recent'],
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

  // Estado de erro
  if (statsError || recentError) {
    return (
      <StandardPage
        icon={LayoutDashboard}
        title="Painel de Controle"
        description="Visão geral dos chamados e estatísticas do sistema"
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {statsError?.message || recentError?.message || 'Ocorreu um erro inesperado'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Dashboard
          </Button>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      icon={LayoutDashboard}
      title="Painel de Controle"
      description="Visão geral dos chamados e estatísticas do sistema"
      isLoading={isStatsLoading && isRecentLoading}
    >
      {/* Cards de Estatísticas */}
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

      {/* Gráficos */}
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
                        <span className="text-sm text-muted-foreground">
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
                    <p className="text-muted-foreground mb-2">Nenhum chamado cadastrado</p>
                    <p className="text-sm text-muted-foreground">Os dados aparecerão aqui quando houver chamados no sistema</p>
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
                        <span className="text-sm text-muted-foreground">
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
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Qtde" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tickets Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Chamados Recentes</CardTitle>
          <CardDescription>Últimos chamados criados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isRecentLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentTickets.length > 0 ? (
            <div className="space-y-3">
              {recentTickets.slice(0, 10).map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <StatusDot status={ticket.status} />
                    <div>
                      <p className="font-medium text-sm">#{ticket.id} - {ticket.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.customer?.email || 'Cliente não informado'} • {' '}
                        {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      ticket.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {PRIORITY_LEVELS[ticket.priority as keyof typeof PRIORITY_LEVELS] || ticket.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={LayoutDashboard}
              title="Nenhum chamado recente"
              description="Não há chamados recentes para exibir. Os novos chamados aparecerão aqui."
            />
          )}
        </CardContent>
      </Card>
    </StandardPage>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {status && <StatusDot status={status} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? <Skeleton className="h-8 w-16" /> : value}
        </div>
      </CardContent>
    </Card>
  );
};
