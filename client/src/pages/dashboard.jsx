import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
export default function Dashboard() {
    // Queries
    var _a = useQuery({
        queryKey: ['/api/tickets/stats'],
        refetchInterval: 30000, // Atualiza a cada 30 segundos
    }), ticketStatsData = _a.data, isStatsLoading = _a.isLoading;
    var _b = useQuery({
        queryKey: ['/api/tickets/recent'],
        refetchInterval: 30000, // Atualiza a cada 30 segundos
    }), recentTicketsData = _b.data, isRecentLoading = _b.isLoading;
    // Garantir que os dados não sejam undefined antes de acessar propriedades
    var ticketStats = ticketStatsData || {
        total: 0,
        byStatus: { new: 0, ongoing: 0, resolved: 0 }, // Garantir que as chaves existam
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 } // Garantir que as chaves existam
    };
    var recentTickets = Array.isArray(recentTicketsData) ? recentTicketsData : [];
    // Dados de status transformados para português
    var statusData = [
        { name: 'Novos', value: ticketStats.byStatus.new, color: '#42A5F5' }, // Acesso direto agora é seguro
        { name: 'Em Andamento', value: ticketStats.byStatus.ongoing, color: '#FFA726' }, // Acesso direto agora é seguro
        { name: 'Resolvidos', value: ticketStats.byStatus.resolved, color: '#66BB6A' }, // Acesso direto agora é seguro
    ];
    var priorityData = [
        { name: 'Baixa', Qtde: ticketStats.byPriority.low }, // Acesso direto agora é seguro
        { name: 'Média', Qtde: ticketStats.byPriority.medium }, // Acesso direto agora é seguro
        { name: 'Alta', Qtde: ticketStats.byPriority.high }, // Acesso direto agora é seguro
        { name: 'Crítica', Qtde: ticketStats.byPriority.critical }, // Acesso direto agora é seguro
    ];
    return (<div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Painel de Controle</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total de Chamados" value={ticketStats.total} // Acesso direto agora é seguro
     isLoading={isStatsLoading}/>
        <StatCard title="Chamados Novos" value={ticketStats.byStatus.new} // Acesso direto agora é seguro
     isLoading={isStatsLoading} status={TICKET_STATUS.NEW} // Cast para o tipo literal
    />
        <StatCard title="Chamados em Andamento" value={ticketStats.byStatus.ongoing} // Acesso direto agora é seguro
     isLoading={isStatsLoading} status={TICKET_STATUS.ONGOING} // Cast para o tipo literal
    />
        <StatCard title="Chamados Resolvidos" value={ticketStats.byStatus.resolved} // Acesso direto agora é seguro
     isLoading={isStatsLoading} status={TICKET_STATUS.RESOLVED} // Cast para o tipo literal
    />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Chamados por Status</CardTitle>
            <CardDescription>Distribuição de chamados por diferentes status</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (<Skeleton className="w-full h-72"/>) : (<ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={true} outerRadius={80} fill="#8884d8" dataKey="value" label={function (_a) {
            var name = _a.name, percent = _a.percent;
            return "".concat(name, ": ").concat((percent * 100).toFixed(0), "%");
        }}>
                    {statusData.map(function (entry, index) { return (<Cell key={"cell-".concat(index)} fill={entry.color}/>); })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Chamados por Prioridade</CardTitle>
            <CardDescription>Número de chamados para cada nível de prioridade</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (<Skeleton className="w-full h-72"/>) : (<ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData} margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
            }}>
                  <XAxis dataKey="name"/>
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Qtde" fill="#8884d8"/>
                </BarChart>
              </ResponsiveContainer>)}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Chamados Recentes</CardTitle>
          <CardDescription>Chamados mais recentes que precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          {isRecentLoading ? (<div className="space-y-4">
              <Skeleton className="w-full h-16"/>
              <Skeleton className="w-full h-16"/>
              <Skeleton className="w-full h-16"/>
            </div>) : (<div className="space-y-4">
              {recentTickets.slice(0, 5).map(function (ticket) { return (<div key={ticket.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center">
                    <StatusDot status={ticket.status}/>
                    <div>
                      <p className="font-medium">{ticket.title}</p>
                      <p className="text-sm text-neutral-500">
                        {ticket.customerEmail} • {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {ticket.priority === PRIORITY_LEVELS.HIGH && (<span className="text-xs font-medium text-white bg-status-high px-2 py-1 rounded">
                        Alta Prioridade
                      </span>)}
                  </div>
                </div>); })}
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
var StatCard = function (_a) {
    var title = _a.title, value = _a.value, isLoading = _a.isLoading, status = _a.status;
    return (<Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-2">
          {status && <StatusDot status={status}/>}
          <h3 className="font-medium">{title}</h3>
        </div>
        {isLoading ? (<Skeleton className="h-10 w-16"/>) : (<p className="text-3xl font-bold">{value}</p>)}
      </CardContent>
    </Card>);
};
