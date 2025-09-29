import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, CalendarIcon, Filter, ChevronDown, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { PerformanceBarChart } from '@/components/charts/performance-bar-chart';

// Função utilitária para normalizar prioridade (primeira letra maiúscula, resto minúsculo)
// IGUAL ao dashboard.tsx para consistência total
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

// Função para formatar tempo igual ao dashboard (TimeMetricCard)
function formatTime(hours: number): string {
  if (hours === 0) return '0h';
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}min`;
  }
  
  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    return `${wholeHours}h ${minutes}min`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

// Utilitário para converter data local (Brasília) para UTC ISO string (yyyy-mm-ddTHH:MM:SSZ)
// IGUAL ao dashboard.tsx para consistência total
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

interface PerformanceSummary {
  total_tickets: number;
  resolved_tickets: number;
  avg_first_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  satisfaction_avg: number | null;
}

interface OfficialMetric {
  official_id: number;
  name: string;
  email: string;
  tickets_assigned: number;
  tickets_resolved: number;
  avg_first_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  satisfaction_avg: number | null;
  is_active?: boolean;
}

interface DepartmentMetric {
  department_id: number;
  department_name: string;
  tickets: number;
  resolved_tickets: number;
  avg_first_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  satisfaction_avg: number | null;
}

interface PerformanceResponse {
  summary: PerformanceSummary;
  officials: OfficialMetric[];
  departments: DepartmentMetric[];
}

interface Department {
  id: number;
  name: string;
}

export default function PerformanceReports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState({
    departmentId: searchParams.get('departmentId') || 'all',
    showInactiveOfficials: searchParams.get('showInactiveOfficials') === 'true' || false
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canViewDepartments, setCanViewDepartments] = useState(false);
  
  // Estado para ordenação do gráfico
  const [sortBy, setSortBy] = useState<string>('tickets_desc');
  
  // Opções de ordenação
  const sortOptions = [
    { value: 'tickets_desc', label: 'Tickets Resolvidos (↓)' },
    { value: 'tickets_asc', label: 'Tickets Resolvidos (↑)' },
    { value: 'satisfaction_desc', label: 'Satisfação (↓)' },
    { value: 'satisfaction_asc', label: 'Satisfação (↑)' },
    { value: 'name', label: 'Nome (A-Z)' }
  ];

  // Buscar dados apenas na montagem inicial
  useEffect(() => {
    fetchReportsWithCurrentFilters();
  }, []); // Executar apenas uma vez na montagem

  // Função para buscar relatórios com filtros atuais
  const fetchReportsWithCurrentFilters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Usar a mesma lógica de datas do dashboard para consistência
      if (dateRange?.from) {
        const startDate = toBrasiliaISOString(dateRange.from, false);
        params.append('start_date', startDate);
      }
      if (dateRange?.to) {
        const endDate = toBrasiliaISOString(dateRange.to, true);
        params.append('end_date', endDate);
      }
      if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
      params.append('showInactiveOfficials', filters.showInactiveOfficials ? 'true' : 'false');

      const url = `/api/reports/performance?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios de performance');
      }
      const responseData = await response.json();
      
      setData(responseData);
    } catch (error) {
      console.error('Erro ao buscar relatórios de performance:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar filtros com URL apenas na montagem inicial
  useEffect(() => {
    const newFilters = {
      departmentId: searchParams.get('departmentId') || 'all',
      showInactiveOfficials: searchParams.get('showInactiveOfficials') === 'true' || false
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
  }, []); // Executar apenas uma vez na montagem inicial

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

    // Verificar se usuário pode ver departamentos
    setCanViewDepartments(['admin', 'company_admin', 'manager', 'supervisor'].includes(user?.role || ''));

    fetchDepartments();
  }, [user?.role]);

  const handleFilterChange = (key: string, value: string | boolean) => {
    // Atualizar os filtros locais primeiro
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Atualizar URL apenas quando o usuário clicar em "Aplicar Filtros"
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const params = new URLSearchParams();
      
      // Usar a mesma lógica de datas do dashboard para consistência
      if (dateRange?.from) params.append('start_date', toBrasiliaISOString(dateRange.from, false));
      if (dateRange?.to) params.append('end_date', toBrasiliaISOString(dateRange.to, true));
      if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
      params.append('showInactiveOfficials', filters.showInactiveOfficials ? 'true' : 'false');
      params.append('format', format);

      console.log('Exportando com parâmetros:', params.toString());

      const response = await fetch(`/api/reports/performance/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao exportar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-performance.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert(`Erro ao exportar relatório: ${error.message}`);
    }
  };

  // Filtrar atendentes inativos se necessário
  const filteredOfficials = data?.officials?.filter(official => 
    filters.showInactiveOfficials || official.is_active !== false
  ) || [];

  // Processar dados para o gráfico com ordenação
  const chartData = React.useMemo(() => {
    if (!data?.officials || data.officials.length === 0) return [];
    
    // Aplicar o mesmo filtro de atendentes inativos que a tabela usa
    const officialsForChart = data.officials.filter(official => 
      filters.showInactiveOfficials || official.is_active !== false
    );
    
    let sortedOfficials = [...officialsForChart];
    
    // Aplicar ordenação
    switch (sortBy) {
      case 'tickets_desc':
        sortedOfficials.sort((a, b) => b.tickets_resolved - a.tickets_resolved);
        break;
      case 'tickets_asc':
        sortedOfficials.sort((a, b) => a.tickets_resolved - b.tickets_resolved);
        break;
      case 'satisfaction_desc':
        sortedOfficials.sort((a, b) => (b.satisfaction_avg || 0) - (a.satisfaction_avg || 0));
        break;
      case 'satisfaction_asc':
        sortedOfficials.sort((a, b) => (a.satisfaction_avg || 0) - (b.satisfaction_avg || 0));
        break;
      case 'name':
        sortedOfficials.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        break;
      default:
        sortedOfficials.sort((a, b) => b.tickets_resolved - a.tickets_resolved);
    }
    
    return sortedOfficials.map(official => ({
      name: official.name,
      ticketsResolvidos: official.tickets_resolved,
      satisfacao: official.satisfaction_avg || 0
    }));
  }, [data?.officials, filters.showInactiveOfficials, sortBy]);

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Relatório de Performance</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full lg:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Exportar
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              Exportar Excel
            </DropdownMenuItem>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange?.to ? (
                        <>{format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}</>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {canViewDepartments && (
              <div>
                <label className="text-sm font-medium mb-2 block">Departamento</label>
                <Select value={filters.departmentId} onValueChange={(value) => handleFilterChange('departmentId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departments.map((department) => (
                      department.id && department.name && department.name.trim() !== '' && (
                        <SelectItem key={department.id} value={String(department.id)}>
                          {department.name}
                        </SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          <div className="mt-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="showInactiveOfficials"
                checked={filters.showInactiveOfficials}
                onCheckedChange={(checked) => handleFilterChange('showInactiveOfficials', checked === true)}
              />
              <label
                htmlFor="showInactiveOfficials"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Incluir atendentes inativos
              </label>
            </div>
            
            <Button onClick={() => {
              // Atualizar URL com os filtros atuais
              const newParams = new URLSearchParams();
              
              // Usar a mesma lógica de datas do dashboard para consistência
              if (dateRange?.from) newParams.set('start_date', toBrasiliaISOString(dateRange.from, false));
              if (dateRange?.to) newParams.set('end_date', toBrasiliaISOString(dateRange.to, true));
              if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
              newParams.set('showInactiveOfficials', filters.showInactiveOfficials ? 'true' : 'false');
              
              setSearchParams(newParams);
              
              // Buscar os dados
              fetchReportsWithCurrentFilters();
            }} disabled={loading}>
              {loading ? 'Carregando...' : 'Aplicar Filtros'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.summary?.total_tickets || 0}</div>
            <p className="text-sm text-muted-foreground">Total de Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.summary?.resolved_tickets || 0}</div>
            <p className="text-sm text-muted-foreground">Resolvidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {data?.summary?.avg_first_response_time_hours 
                ? formatTime(data.summary.avg_first_response_time_hours)
                : '-'
              }
            </div>
            <p className="text-sm text-muted-foreground">Tempo Médio 1ª Resposta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {data?.summary?.avg_resolution_time_hours 
                ? formatTime(data.summary.avg_resolution_time_hours)
                : '-'
              }
            </div>
            <p className="text-sm text-muted-foreground">Tempo Médio Resolução</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {data?.summary?.satisfaction_avg 
                ? Math.round(data.summary.satisfaction_avg * 10) / 10 
                : '-'
              }
            </div>
            <p className="text-sm text-muted-foreground">Satisfação Média</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Performance dos Atendentes */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Performance dos Atendentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Comparativo entre tickets resolvidos e satisfação</p>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <PerformanceBarChart 
                data={chartData} 
                isLoading={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Performance por Atendente */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Performance por Atendente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full lg:min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Atendente</TableHead>
                    <TableHead className="min-w-32">Tickets Atribuídos</TableHead>
                    <TableHead className="min-w-32">Tickets Resolvidos</TableHead>
                    <TableHead className="min-w-36">1ª Resposta</TableHead>
                    <TableHead className="min-w-36">Resolução</TableHead>
                    <TableHead className="min-w-32">Satisfação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOfficials.map((official) => (
                    <TableRow key={official.official_id}>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{official.name}</span>
                          <span className="text-xs text-muted-foreground">{official.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{official.tickets_assigned}</TableCell>
                      <TableCell className="text-sm">{official.tickets_resolved}</TableCell>
                      <TableCell className="text-sm">
                        {official.avg_first_response_time_hours 
                          ? formatTime(official.avg_first_response_time_hours)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {official.avg_resolution_time_hours 
                          ? formatTime(official.avg_resolution_time_hours)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {official.satisfaction_avg 
                          ? Math.round(official.satisfaction_avg * 10) / 10 
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredOfficials.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum atendente encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Performance por Departamento */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Departamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full lg:min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Departamento</TableHead>
                    <TableHead className="min-w-32">Total Tickets</TableHead>
                    <TableHead className="min-w-32">Tickets Resolvidos</TableHead>
                    <TableHead className="min-w-36">1ª Resposta</TableHead>
                    <TableHead className="min-w-36">Resolução</TableHead>
                    <TableHead className="min-w-32">Satisfação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.departments || []).map((department) => (
                    <TableRow key={department.department_id}>
                      <TableCell className="text-sm font-medium">{department.department_name}</TableCell>
                      <TableCell className="text-sm">{department.tickets}</TableCell>
                      <TableCell className="text-sm">{department.resolved_tickets}</TableCell>
                      <TableCell className="text-sm">
                        {department.avg_first_response_time_hours 
                          ? formatTime(department.avg_first_response_time_hours)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {department.avg_resolution_time_hours 
                          ? formatTime(department.avg_resolution_time_hours)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {department.satisfaction_avg 
                          ? Math.round(department.satisfaction_avg * 10) / 10 
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(data?.departments || []).length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum departamento encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}