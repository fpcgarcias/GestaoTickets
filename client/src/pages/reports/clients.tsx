import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Filter, ChevronDown, ArrowLeft, Users, Star, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ModernPieChart } from '@/components/charts/modern-pie-chart';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Utilitário para converter data local (Brasília) para UTC ISO string
function toBrasiliaISOString(date: Date, endOfDay = false) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  if (endOfDay) {
    local.setHours(23, 59, 59, 999);
  } else {
    local.setHours(0, 0, 0, 0);
  }
  return local.toISOString();
}

interface ClientSummary {
  total_customers: number;
  customers_responded: number;
  satisfaction_avg: number | null;
  response_rate: number;
}

interface ClientMetric {
  customer_id: number | null;
  name: string;
  email: string;
  total_tickets: number;
  resolved_tickets: number;
  satisfaction_avg: number | null;
  last_interaction: string | null;
  surveys_count: number;
}

interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

interface RecentComment {
  rating: number;
  comments: string;
  responded_at: string;
  customer_email: string;
}

interface ClientResponse {
  summary: ClientSummary;
  clients: ClientMetric[];
  rating_distribution: RatingDistribution;
  recent_comments: RecentComment[];
}

interface Department {
  id: number;
  name: string;
}

interface ClientFiltersState {
  departmentId: string;
  incidentTypeId: string;
  rating: string;
}

const RATING_COLORS = {
  1: '#ef4444', // vermelho
  2: '#f97316', // laranja
  3: '#eab308', // amarelo
  4: '#22c55e', // verde claro
  5: '#10b981'  // verde
};

export default function ClientReports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  
  const [data, setData] = useState<ClientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<string>('this-week');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filters, setFilters] = useState<ClientFiltersState>({
    departmentId: searchParams.get('departmentId') || 'all',
    incidentTypeId: searchParams.get('incidentTypeId') || 'all',
    rating: searchParams.get('rating') || 'all'
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [canViewDepartments, setCanViewDepartments] = useState(false);

  // Buscar dados quando filtros mudarem
  useEffect(() => {
    fetchReportsWithCurrentFilters();
    
    // Atualizar URL com os filtros atuais
    const newParams = new URLSearchParams();
    if (dateRange?.from) newParams.set('start_date', toBrasiliaISOString(dateRange.from, false));
    if (dateRange?.to) newParams.set('end_date', toBrasiliaISOString(dateRange.to, true));
    if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
    if (filters.incidentTypeId && filters.incidentTypeId !== 'all') newParams.set('incidentTypeId', filters.incidentTypeId);
    if (filters.rating && filters.rating !== 'all') newParams.set('rating', filters.rating);
    setSearchParams(newParams);
  }, [dateRange, filters.departmentId, filters.incidentTypeId, filters.rating, timeFilter]);

  // Função para buscar relatórios com filtros atuais
  const fetchReportsWithCurrentFilters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        const startDate = toBrasiliaISOString(dateRange.from, false);
        params.append('start_date', startDate);
      }
      if (dateRange?.to) {
        const endDate = toBrasiliaISOString(dateRange.to, true);
        params.append('end_date', endDate);
      }
      if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
      if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incidentTypeId', filters.incidentTypeId);
      if (filters.rating && filters.rating !== 'all') params.append('rating', filters.rating);

      const url = `/api/reports/clients?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios de clientes');
      }
      const responseData = await response.json();
      
      setData(responseData);
    } catch (error) {
      console.error('Erro ao buscar relatórios de clientes:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar filtros com URL apenas na montagem inicial
  useEffect(() => {
    const newFilters = {
      departmentId: searchParams.get('departmentId') || 'all',
      incidentTypeId: searchParams.get('incidentTypeId') || 'all',
      rating: searchParams.get('rating') || 'all'
    };
    setFilters(newFilters);
    
    const fromDate = searchParams.get('start_date') || searchParams.get('startDate');
    const toDate = searchParams.get('end_date') || searchParams.get('endDate');
    if (fromDate || toDate) {
      setDateRange({
        from: fromDate ? new Date(fromDate) : undefined,
        to: toDate ? new Date(toDate) : undefined
      });
    }
  }, []);

  // Buscar departamentos dinamicamente
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch('/api/departments?active_only=true');
        if (response.ok) {
          const data = await response.json();
          const validDepartments = (data.departments || []).filter((d: any) => 
            d.id && d.name && d.name.trim() !== ''
          );
          setDepartments(validDepartments);
        }
      } catch (error) {
        console.error('Erro ao buscar departamentos:', error);
      }
    };

    setCanViewDepartments(['admin', 'company_admin', 'manager', 'supervisor'].includes(user?.role || ''));
    fetchDepartments();
  }, [user?.role]);

  // Buscar tipos de chamados conforme departamento selecionado
  useEffect(() => {
    const fetchIncidentTypes = async () => {
      try {
        const params = new URLSearchParams();
        params.append('active_only', 'true');
        params.append('limit', '1000');
        
        if (filters.departmentId && filters.departmentId !== 'all') {
          params.append('department_id', filters.departmentId);
        }

        const response = await fetch(`/api/incident-types?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const rawTypes = Array.isArray(data?.incidentTypes)
            ? data.incidentTypes
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data)
                ? data
                : [];
          
          const validTypes = rawTypes
            .filter((type: any) => type && type.id && type.name)
            .map((type: any) => ({
              id: type.id,
              name: type.name
            }));
          
          setIncidentTypes(validTypes);
          
          // Resetar filtro de tipo se não existir mais na lista
          if (filters.incidentTypeId !== 'all' && !validTypes.some((t: any) => t.id.toString() === filters.incidentTypeId)) {
            setFilters(prev => ({ ...prev, incidentTypeId: 'all' }));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar tipos de chamado:', error);
        setIncidentTypes([]);
      }
    };

    fetchIncidentTypes();
  }, [filters.departmentId]);

  const handleBack = () => {
    setLocation('/reports');
  };

  const handleExport = (format: 'csv' | 'excel') => {
    // TODO: Implementar exportação
    console.log('Exportar em', format);
  };

  // Preparar dados para o gráfico de pizza no formato do ModernPieChart
  const pieData = data?.rating_distribution
    ? Object.entries(data.rating_distribution)
        .filter(([_, count]) => count > 0) // Filtrar apenas avaliações com contagem > 0
        .map(([rating, count]) => ({
          name: `${rating} estrela${parseInt(rating) > 1 ? 's' : ''}`,
          value: count as number,
          color: RATING_COLORS[parseInt(rating) as keyof typeof RATING_COLORS] || '#6b7280'
        }))
        .reverse() // Inverter para mostrar de 5 estrelas para 1 estrela
    : [];

  const renderStars = (rating: number | null) => {
    if (rating === null) return 'N/A';
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Relatórios de Clientes
            </h1>
            <p className="text-muted-foreground">Análise de satisfação e feedback</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('csv')}>Exportar CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>Exportar Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Período</label>
              <DateRangeFilter
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                dateRange={dateRange}
                setDateRange={setDateRange}
                calendarOpen={calendarOpen}
                setCalendarOpen={setCalendarOpen}
              />
            </div>

            {canViewDepartments && (
              <div className="space-y-2 flex-1 min-w-[180px]">
                <label className="text-sm font-medium">Departamento</label>
                <Select
                  value={filters.departmentId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, departmentId: value, incidentTypeId: 'all' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os departamentos</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 flex-1 min-w-[180px]">
              <label className="text-sm font-medium">Tipo de Chamado</label>
              <Select
                value={filters.incidentTypeId}
                onValueChange={(value) => setFilters(prev => ({ ...prev, incidentTypeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {incidentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Nível de Satisfação</label>
              <Select
                value={filters.rating}
                onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="5">5 estrelas</SelectItem>
                  <SelectItem value="4">4 estrelas</SelectItem>
                  <SelectItem value="3">3 estrelas</SelectItem>
                  <SelectItem value="2">2 estrelas</SelectItem>
                  <SelectItem value="1">1 estrela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Erro ao carregar dados do relatório
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.total_customers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clientes únicos no período
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.response_rate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.customers_responded} de {data.summary.total_customers} responderam
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Satisfação Média</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.summary.satisfaction_avg !== null
                    ? data.summary.satisfaction_avg.toFixed(1)
                    : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.satisfaction_avg !== null
                    ? renderStars(Math.round(data.summary.satisfaction_avg))
                    : 'Sem avaliações'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avaliações Negativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.rating_distribution[1] + data.rating_distribution[2]}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  (1-2 estrelas)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Pizza */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Distribuição de Avaliações</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-80">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : !pieData || pieData.length === 0 ? (
                <div className="w-full h-80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-muted-foreground font-medium">Nenhum dado disponível</p>
                    <p className="text-sm text-muted-foreground mt-1 opacity-80">Os dados aparecerão aqui quando houver chamados</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
                  {/* Gráfico centralizado */}
                  <div className="flex-1 w-full lg:flex-1 lg:max-w-lg flex justify-center">
                    <div className="w-full">
                      <ModernPieChart 
                        data={pieData} 
                        isLoading={false}
                        hideLegend={true}
                      />
                    </div>
                  </div>
                  
                  {/* Legenda à direita */}
                  <div className="w-full lg:w-80 flex-shrink-0 lg:mt-0">
                    <div className="space-y-3">
                      {pieData.map((item) => {
                        const total = pieData.reduce((sum, i) => sum + i.value, 0);
                        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                        return (
                          <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/60 hover:bg-muted transition-colors duration-200">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full shadow-sm" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-sm font-medium text-muted-foreground">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-foreground">{item.value}</div>
                              <div className="text-xs text-muted-foreground">{percentage}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Clientes */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Clientes com Métricas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Tickets</TableHead>
                      <TableHead className="text-right">Resolvidos</TableHead>
                      <TableHead className="text-right">Satisfação</TableHead>
                      <TableHead className="text-right">Avaliações</TableHead>
                      <TableHead>Última Interação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum cliente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.clients.map((client, idx) => (
                        <TableRow key={client.email || idx}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.email}</TableCell>
                          <TableCell className="text-right">{client.total_tickets}</TableCell>
                          <TableCell className="text-right">{client.resolved_tickets}</TableCell>
                          <TableCell className="text-right">
                            {client.satisfaction_avg !== null
                              ? `${client.satisfaction_avg.toFixed(1)} ${renderStars(Math.round(client.satisfaction_avg))}`
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">{client.surveys_count}</TableCell>
                          <TableCell>
                            {client.last_interaction
                              ? format(new Date(client.last_interaction), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Comentários Recentes */}
          {data.recent_comments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentários Recentes
                </CardTitle>
                <CardDescription>
                  São exibidos apenas avaliações com comentários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recent_comments.map((comment, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{comment.customer_email}</span>
                          <span className="text-sm text-muted-foreground">
                            {renderStars(comment.rating)}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(comment.responded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.comments}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}