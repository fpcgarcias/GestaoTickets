import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Filter, ChevronDown, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ModernBarChart } from '@/components/charts/modern-bar-chart';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Função utilitária para formatar tempo igual ao dashboard (TimeMetricCard)
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

interface DepartmentSummary {
  total_tickets: number;
  resolved_tickets: number;
  avg_first_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  satisfaction_avg: number | null;
}

interface DepartmentMetric {
  department_id: number;
  department_name: string;
  tickets: number;
  resolved_tickets: number;
  avg_first_response_time_hours: number | null;
  avg_resolution_time_hours: number | null;
  satisfaction_avg: number | null;
  officials_count: number;
}

interface DepartmentResponse {
  summary: DepartmentSummary;
  departments: DepartmentMetric[];
}

interface Department {
  id: number;
  name: string;
}

interface IncidentTypeOption {
  id: number;
  name: string;
}

interface DepartmentFiltersState {
  departmentId: string;
  incidentTypeId: string;
}

export default function DepartmentReports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  
  const [data, setData] = useState<DepartmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<string>('this-week');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filters, setFilters] = useState<DepartmentFiltersState>({
    departmentId: searchParams.get('departmentId') || 'all',
    incidentTypeId: searchParams.get('incidentTypeId') || 'all'
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeOption[]>([]);
  const [isIncidentTypesLoading, setIsIncidentTypesLoading] = useState(false);
  const [canViewDepartments, setCanViewDepartments] = useState(false);
  
  // Estado para ordenação do gráfico
  const [sortBy, setSortBy] = useState<string>('tickets_desc');
  
  // Opções de ordenação
  const sortOptions = [
    { value: 'tickets_desc', label: 'Tickets (↓)' },
    { value: 'tickets_asc', label: 'Tickets (↑)' },
    { value: 'satisfaction_desc', label: 'Satisfação (↓)' },
    { value: 'satisfaction_asc', label: 'Satisfação (↑)' },
    { value: 'name', label: 'Nome (A-Z)' }
  ];

  // Buscar dados quando filtros mudarem
  useEffect(() => {
    fetchReportsWithCurrentFilters();
    
    // Atualizar URL com os filtros atuais
    const newParams = new URLSearchParams();
    if (dateRange?.from) newParams.set('start_date', toBrasiliaISOString(dateRange.from, false));
    if (dateRange?.to) newParams.set('end_date', toBrasiliaISOString(dateRange.to, true));
    if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
    if (filters.incidentTypeId && filters.incidentTypeId !== 'all') newParams.set('incidentTypeId', filters.incidentTypeId);
    setSearchParams(newParams);
  }, [dateRange, filters.departmentId, filters.incidentTypeId, timeFilter]);

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
      if (filters.departmentId && filters.departmentId !== 'all') params.append('department_id', filters.departmentId);
      if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incident_type_id', filters.incidentTypeId);

      const url = `/api/reports/department?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios por departamento');
      }
      const responseData = await response.json();
      
      setData(responseData);
    } catch (error) {
      console.error('Erro ao buscar relatórios por departamento:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar filtros com URL apenas na montagem inicial
  useEffect(() => {
    const newFilters = {
      departmentId: searchParams.get('departmentId') || 'all',
      incidentTypeId: searchParams.get('incidentTypeId') || 'all'
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

  useEffect(() => {
    let isMounted = true;

    const fetchIncidentTypes = async () => {
      if (!canViewDepartments) {
        if (isMounted) {
          setIncidentTypes([]);
          setIsIncidentTypesLoading(false);
          setFilters(prev => prev.incidentTypeId === 'all' ? prev : { ...prev, incidentTypeId: 'all' });
        }
        return;
      }

      const departmentId = filters.departmentId;
      
      setIsIncidentTypesLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('active_only', 'true');
        params.append('limit', '1000');
        if (departmentId && departmentId !== 'all') {
          params.append('department_id', departmentId);
        }

        const response = await fetch(`/api/incident-types?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Erro ao carregar tipos de chamado');
        }

        const data = await response.json();
        const rawTypes = Array.isArray(data?.incidentTypes)
          ? data.incidentTypes
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : [];

        const validTypes: IncidentTypeOption[] = rawTypes
          .filter((type: any) => {
            if (!type || !type.id || !type.name) return false;
            // Se um departamento estiver selecionado, filtrar apenas os tipos desse departamento
            if (departmentId && departmentId !== 'all') {
              const departmentIdNumber = Number(departmentId);
              if (type.department_id === null || type.department_id === undefined) return false;
              return Number(type.department_id) === departmentIdNumber;
            }
            // Se nenhum departamento selecionado, mostrar todos os tipos
            return true;
          })
          .map((type: any) => ({
            id: type.id,
            name: type.name,
          }));

        if (isMounted) {
          setIncidentTypes(validTypes);
          setFilters(prev => {
            if (
              prev.incidentTypeId !== 'all' &&
              !validTypes.some(type => type.id?.toString() === prev.incidentTypeId)
            ) {
              return { ...prev, incidentTypeId: 'all' };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Erro ao buscar tipos de chamado:', error);
        if (isMounted) {
          setIncidentTypes([]);
          setFilters(prev => prev.incidentTypeId === 'all' ? prev : { ...prev, incidentTypeId: 'all' });
        }
      } finally {
        if (isMounted) {
          setIsIncidentTypesLoading(false);
        }
      }
    };

    fetchIncidentTypes();

    return () => {
      isMounted = false;
    };
  }, [filters.departmentId, canViewDepartments]);

  const handleBack = () => {
    setLocation('/reports');
  };

  // Preparar dados para o gráfico (formato ModernBarChart)
  // O gráfico sempre mostra tickets resolvidos, mas a ordenação pode variar
  const chartData = data?.departments
    .map(dept => ({
      name: dept.department_name,
      Qtde: dept.resolved_tickets
    }))
    .sort((a, b) => {
      if (sortBy === 'tickets_desc') return b.Qtde - a.Qtde;
      if (sortBy === 'tickets_asc') return a.Qtde - b.Qtde;
      if (sortBy === 'satisfaction_desc') {
        const aDept = data.departments.find(d => d.department_name === a.name);
        const bDept = data.departments.find(d => d.department_name === b.name);
        return (bDept?.satisfaction_avg || 0) - (aDept?.satisfaction_avg || 0);
      }
      if (sortBy === 'satisfaction_asc') {
        const aDept = data.departments.find(d => d.department_name === a.name);
        const bDept = data.departments.find(d => d.department_name === b.name);
        return (aDept?.satisfaction_avg || 0) - (bDept?.satisfaction_avg || 0);
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    }) || [];

  const handleExport = (format: 'csv' | 'excel') => {
    // TODO: Implementar exportação
    console.log('Exportar em', format);
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
              <Building2 className="h-6 w-6" />
              Relatórios por Departamento
            </h1>
            <p className="text-muted-foreground">Análise por departamento e equipe</p>
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
          <div className={`grid gap-4 ${canViewDepartments ? 'md:grid-cols-5' : 'md:grid-cols-2'}`}>
            <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <Select
                  value={filters.departmentId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, departmentId: value }))}
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

            {canViewDepartments && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Chamado</label>
                <Select
                  value={filters.incidentTypeId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, incidentTypeId: value }))}
                  disabled={isIncidentTypesLoading}
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
            )}
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
                <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.total_tickets}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.resolved_tickets} resolvidos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Resolução</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.summary.total_tickets > 0
                    ? Math.round((data.summary.resolved_tickets / data.summary.total_tickets) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.resolved_tickets} de {data.summary.total_tickets}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio de Resolução</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.summary.avg_resolution_time_hours !== null
                    ? formatTime(data.summary.avg_resolution_time_hours)
                    : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Primeira resposta: {data.summary.avg_first_response_time_hours !== null
                    ? formatTime(data.summary.avg_first_response_time_hours)
                    : 'N/A'}
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
                  Baseado em avaliações
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Volume de Tickets por Departamento</CardTitle>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ModernBarChart data={chartData} isLoading={loading} />
            </CardContent>
          </Card>

          {/* Tabela de Departamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas Detalhadas por Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Departamento</TableHead>
                      <TableHead className="text-right">Tickets</TableHead>
                      <TableHead className="text-right">Resolvidos</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                      <TableHead className="text-right">Tempo Resposta</TableHead>
                      <TableHead className="text-right">Tempo Resolução</TableHead>
                      <TableHead className="text-right">Satisfação</TableHead>
                      <TableHead className="text-right">Atendentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.departments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum departamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.departments.map((dept) => (
                        <TableRow key={dept.department_id}>
                          <TableCell className="font-medium">{dept.department_name}</TableCell>
                          <TableCell className="text-right">{dept.tickets}</TableCell>
                          <TableCell className="text-right">{dept.resolved_tickets}</TableCell>
                          <TableCell className="text-right">
                            {dept.tickets > 0
                              ? Math.round((dept.resolved_tickets / dept.tickets) * 100)
                              : 0}%
                          </TableCell>
                          <TableCell className="text-right">
                            {dept.avg_first_response_time_hours !== null
                              ? formatTime(dept.avg_first_response_time_hours)
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            {dept.avg_resolution_time_hours !== null
                              ? formatTime(dept.avg_resolution_time_hours)
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            {dept.satisfaction_avg !== null
                              ? dept.satisfaction_avg.toFixed(1)
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">{dept.officials_count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}