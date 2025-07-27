import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { ChartContainer } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';

// Função para formatar uptime de forma legível
const formatUptime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) {
    return `${days}d`;
  }
  
  return `${days}d ${remainingHours}h`;
};

interface PerformanceStats {
  stats: {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    verySlowRequests: number;
    errorRate: number;
    slowRequestsPercentage?: number;
    verySlowRequestsPercentage?: number;
  };
  slowestRequests: any[];
  errorDetails: any[];
  statusCodeDistribution: Record<string, number>;
  topEndpoints: any[];
  topEndpointsByAvgTime: any[];
  errorRateByEndpoint: any[];
  systemInfo: {
    nodeVersion: string;
    platform: string;
    uptime: number;
    memory: any;
    cpuUsage?: number; // Added for CPU usage
  };
}

export default function PerformanceDashboard() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [data, setData] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetch('/api/performance/stats')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return <div className="p-8 text-center text-2xl font-bold">Acesso restrito</div>;
  }

  if (loading || !data) {
    return <div className="p-8 flex flex-col gap-4">
      <Skeleton className="h-12 w-1/3 mx-auto" />
      <div className="flex gap-4 justify-center">
        <Skeleton className="h-32 w-1/4" />
        <Skeleton className="h-32 w-1/4" />
        <Skeleton className="h-32 w-1/4" />
        <Skeleton className="h-32 w-1/4" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>;
  }

  // KPIs
  const { stats, statusCodeDistribution, systemInfo, slowestRequests, errorDetails, topEndpoints, topEndpointsByAvgTime, errorRateByEndpoint } = data;
  const statusData = Object.entries(statusCodeDistribution).map(([code, count]) => ({ code, count }));
  const errorPieData = [
    { name: 'Erros', value: Math.round(stats.totalRequests * (stats.errorRate / 100)) },
    { name: 'Sucesso', value: Math.round(stats.totalRequests * (1 - stats.errorRate / 100)) }
  ];
  // CPU e Memória
  const cpuUsage = typeof systemInfo.cpuUsage === 'number' ? `${(systemInfo.cpuUsage * 100).toFixed(1)}%` : '0%';
  const memUsage = systemInfo.memory && systemInfo.memory.heapUsed ? `${(systemInfo.memory.heapUsed / 1024 / 1024).toFixed(2)} MB` : 'N/A';

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumbs e título */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl font-bold text-neutral-800">Dashboard de Performance</span>
        <span className="text-neutral-400" title="Métricas em tempo real do backend"><Info size={18} /></span>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-green-500/90 text-white">
          <CardHeader>
            <CardTitle>Total de Requisições</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.totalRequests}</CardContent>
        </Card>
        <Card className="bg-blue-500/90 text-white">
          <CardHeader>
            <CardTitle>Média de Resposta</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.averageResponseTime} ms</CardContent>
        </Card>
        <Card className="bg-yellow-500/90 text-white">
          <CardHeader>
            <CardTitle>Taxa de Erro</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.errorRate}%</CardContent>
        </Card>
        <Card className="bg-purple-500/90 text-white">
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatUptime(systemInfo.uptime)}</CardContent>
        </Card>
        <Card className="bg-neutral-700 text-white">
          <CardHeader>
            <CardTitle>CPU Média</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{cpuUsage}</CardContent>
        </Card>
        <Card className="bg-neutral-800 text-white">
          <CardHeader>
            <CardTitle>Memória Média</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{memUsage}</CardContent>
        </Card>
      </div>
      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ChartContainer config={{
                ...statusData.reduce((acc, cur) => {
                  acc[cur.code] = { color: cur.code.startsWith('2') ? '#22c55e' : cur.code.startsWith('4') ? '#facc15' : '#ef4444' };
                  return acc;
                }, {} as any)
              }}>
                {({ ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid }) => (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="code" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#38bdf8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartContainer>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Erros vs Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            {errorPieData.length > 0 ? (
              <ChartContainer config={{ Erros: { color: '#ef4444' }, Sucesso: { color: '#22c55e' } }}>
                {({ ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend }) => (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={errorPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {errorPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#22c55e'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartContainer>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
      </div>
      {/* Tabelas detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints por Volume</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {topEndpoints && topEndpoints.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Requisições</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEndpoints.map((ep, i) => (
                    <TableRow key={i}>
                      <TableCell>{ep.method}</TableCell>
                      <TableCell>{ep.path}</TableCell>
                      <TableCell>{ep.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints por Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {topEndpointsByAvgTime && topEndpointsByAvgTime.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Média (ms)</TableHead>
                    <TableHead>Reqs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEndpointsByAvgTime.map((ep, i) => (
                    <TableRow key={i}>
                      <TableCell>{ep.method}</TableCell>
                      <TableCell>{ep.path}</TableCell>
                      <TableCell>{ep.avgDuration}</TableCell>
                      <TableCell>{ep.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Requisições Mais Lentas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {slowestRequests && slowestRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração (ms)</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowestRequests.map((req, i) => (
                    <TableRow key={i}>
                      <TableCell>{req.method}</TableCell>
                      <TableCell>{req.path}</TableCell>
                      <TableCell>{req.statusCode}</TableCell>
                      <TableCell>{req.duration}</TableCell>
                      <TableCell>{new Date(req.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Endpoints com Mais Erros</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {errorDetails && errorDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorDetails.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell>{err.method}</TableCell>
                      <TableCell>{err.path}</TableCell>
                      <TableCell>{err.statusCode}</TableCell>
                      <TableCell>{err.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center text-neutral-400">Sem dados</div>}
          </CardContent>
        </Card>
      </div>
      {/* Info do sistema */}
      <div className="text-xs text-neutral-500 text-center mt-8">
        Node.js {systemInfo.nodeVersion} | Plataforma: {systemInfo.platform} | Uptime: {formatUptime(systemInfo.uptime)} | Memória: {(systemInfo.memory.heapUsed / 1024 / 1024).toFixed(2)} MB
      </div>
    </div>
  );
} 