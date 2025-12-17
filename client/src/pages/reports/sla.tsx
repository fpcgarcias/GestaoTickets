import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, CalendarIcon, Filter, ChevronDown, ArrowLeft, Target, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { PerformanceBarChart } from '@/components/charts/performance-bar-chart';
import { PriorityBadge } from '@/components/tickets/status-badge';

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

// Função utilitária para normalizar prioridade
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

interface SLASummary {
  total_tickets: number;
  breached_tickets: number;
  within_sla: number;
  compliance_rate: number;
}

interface PriorityMetric {
  priority: string;
  total_tickets: number;
  breached_tickets: number;
  compliance_rate: number;
}

interface DepartmentMetric {
  department_id: number;
  department_name: string;
  total_tickets: number;
  breached_tickets: number;
  compliance_rate: number;
}

interface BreachedTicket {
  id: number;
  ticket_id: string;
  title: string;
  priority: string;
  department_name: string;
  created_at: string;
  resolved_at: string | null;
}

interface SLAResponse {
  summary: SLASummary;
  by_priority: PriorityMetric[];
  by_department: DepartmentMetric[];
  breached_tickets: BreachedTicket[];
}

interface Department {
  id: number;
  name: string;
}

interface IncidentTypeOption {
  id: number;
  name: string;
}

interface SLAFiltersState {
  departmentId: string;
  incidentTypeId: string;
  priority: string;
}

export default function SLAReports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  
  const [data, setData] = useState<SLAResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState<SLAFiltersState>({
    departmentId: searchParams.get('departmentId') || 'all',
    incidentTypeId: searchParams.get('incidentTypeId') || 'all',
    priority: searchParams.get('priority') || 'all'
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeOption[]>([]);
  const [isIncidentTypesLoading, setIsIncidentTypesLoading] = useState(false);
  const [canViewDepartments, setCanViewDepartments] = useState(false);

  // Buscar dados apenas na montagem inicial
  useEffect(() => {
    fetchReportsWithCurrentFilters();
  }, []);

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
      if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incident_type_id', filters.incidentTypeId);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);

      const url = `/api/reports/sla?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios de SLA');
      }
      const responseData = await response.json();
      
      setData(responseData);
    } catch (error) {
      console.error('Erro ao buscar relatórios de SLA:', error);
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
      priority: searchParams.get('priority') || 'all'
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
      if (!departmentId || departmentId === 'all') {
        if (isMounted) {
          setIncidentTypes([]);
          setIsIncidentTypesLoading(false);
        }
        return;
      }

      setIsIncidentTypesLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('active_only', 'true');
        params.append('limit', '1000');
        params.append('department_id', departmentId);

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

        const departmentIdNumber = Number(departmentId);
        const validTypes: IncidentTypeOption[] = rawTypes
          .filter((type: any) => {
            if (!type || !type.id || !type.name) return false;
            if (type.department_id === null || type.department_id === undefined) return false;
            return Number(type.department_id) === departmentIdNumber;
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
        console.error('Erro ao buscar tipos de incidente:', error);
        if (isMounted) {
          setIncidentTypes([]);
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

  const handleApplyFilters = () => {
    fetchReportsWithCurrentFilters();
  };

  const handleExport = (format: 'csv' | 'excel') => {
    // TODO: Implementar exportação
    console.log('Exportar em', format);
  };

  // Preparar dados para o gráfico
  const chartData = (data?.by_priority || [])
    .map(prio => ({
      name: prio.priority,
      ticketsResolvidos: prio.total_tickets - prio.breached_tickets,
      satisfacao: prio.compliance_rate
    }));

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
              <Target className="h-6 w-6" />
              Relatórios de SLA
            </h1>
            <p className="text-muted-foreground">Monitoramento de cumprimento de SLA</p>
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
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
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
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {canViewDepartments && (
              <>
                <div className="space-y-2">
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Incidente</label>
                  <Select
                    value={filters.incidentTypeId}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, incidentTypeId: value }))}
                    disabled={filters.departmentId === 'all' || isIncidentTypesLoading}
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
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CRÍTICA">Crítica</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MÉDIA">Média</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleApplyFilters} className="w-full">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Cumprimento de SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.summary?.compliance_rate?.toFixed(1) || '0.0'}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.summary?.within_sla || 0} de {data?.summary?.total_tickets || 0} tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Violações de SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{data?.summary?.breached_tickets || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(data?.summary?.total_tickets || 0) > 0
                    ? (((data?.summary?.breached_tickets || 0) / (data?.summary?.total_tickets || 1)) * 100).toFixed(1)
                    : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  Dentro do SLA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{data?.summary?.within_sla || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tickets cumprindo SLA
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.summary?.total_tickets || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  No período selecionado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico por Prioridade */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Cumprimento SLA por Prioridade</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceBarChart data={chartData} isLoading={loading} />
              </CardContent>
            </Card>
          )}

          {/* Tabela por Departamento */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Métricas por Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Departamento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Violações</TableHead>
                      <TableHead className="text-right">Dentro do SLA</TableHead>
                      <TableHead className="text-right">Taxa de Cumprimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data?.by_department || data.by_department.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhum departamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data.by_department || []).map((dept) => (
                        <TableRow key={dept.department_id}>
                          <TableCell className="font-medium">{dept.department_name}</TableCell>
                          <TableCell className="text-right">{dept.total_tickets}</TableCell>
                          <TableCell className="text-right text-red-500">{dept.breached_tickets}</TableCell>
                          <TableCell className="text-right text-green-500">{dept.total_tickets - dept.breached_tickets}</TableCell>
                          <TableCell className="text-right">
                            <span className={dept.compliance_rate >= 95 ? 'text-green-600' : dept.compliance_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}>
                              {dept.compliance_rate.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tickets que Violaram SLA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Tickets que Violaram SLA
                {(data?.breached_tickets?.length || 0) >= 100 && (
                  <span className="text-sm text-muted-foreground font-normal">
                    (mostrando primeiros 100)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Resolvido em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!data?.breached_tickets || data.breached_tickets.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum ticket violou o SLA no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data.breached_tickets || []).map((ticket) => (
                        <TableRow 
                          key={ticket.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setLocation(`/tickets/${ticket.id}`)}
                        >
                          <TableCell className="font-medium">{ticket.ticket_id}</TableCell>
                          <TableCell>{ticket.title}</TableCell>
                          <TableCell>
                            <PriorityBadge priority={ticket.priority} />
                          </TableCell>
                          <TableCell>{ticket.department_name}</TableCell>
                          <TableCell>
                            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {ticket.resolved_at
                              ? format(new Date(ticket.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : 'Não resolvido'}
                          </TableCell>
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