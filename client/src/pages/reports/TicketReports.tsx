import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, PriorityBadge } from '@/components/tickets/status-badge';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, CalendarIcon, Filter, ChevronDown, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';

// Função utilitária para normalizar prioridade (primeira letra maiúscula, resto minúsculo)
// IGUAL ao dashboard.tsx para consistência total
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
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

interface TicketReport {
  id: number;
  ticket_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  priority_weight?: number;
  priority_color?: string;
  priority_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  department: {
    id: number;
    name: string;
  };
  customer: {
    id: number;
    name: string;
    email: string;
  };
  assigned_to: {
    id: number;
    name: string;
    email: string;
  } | null;
}

interface ReportStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

interface Department {
  id: number;
  name: string;
}

interface PriorityOption {
  value: string;
  label: string;
}

interface IncidentTypeOption {
  id: number;
  name: string;
}

interface FiltersState {
  status: string;
  priority: string;
  departmentId: string;
  incidentTypeId: string;
  showInactiveOfficials: boolean;
}

export default function TicketReports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  const [tickets, setTickets] = useState<TicketReport[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState<FiltersState>({
    status: searchParams.get('status') || 'all',
    priority: searchParams.get('priority') || 'all',
    departmentId: searchParams.get('departmentId') || 'all',
    incidentTypeId: searchParams.get('incidentTypeId') || 'all',
    showInactiveOfficials: searchParams.get('showInactiveOfficials') === 'true' || false
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeOption[]>([]);
  const [isIncidentTypesLoading, setIsIncidentTypesLoading] = useState(false);
  const [canViewDepartments, setCanViewDepartments] = useState(false);


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
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
      if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incident_type_id', filters.incidentTypeId);
      if (filters.showInactiveOfficials) params.append('showInactiveOfficials', 'true');

      const url = `/api/reports/tickets?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios');
      }
      const data = await response.json();
      
      setTickets(data.tickets || []);
      setStats(data.stats || { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      setTickets([]);
      setStats({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar filtros com URL quando mudar - removido para evitar loop
  // useEffect(() => {
  //   const newParams = new URLSearchParams();
  //   
  //   if (dateRange?.from) newParams.set('startDate', format(dateRange.from, 'yyyy-MM-dd'));
  //   if (dateRange?.to) newParams.set('endDate', format(dateRange.to, 'yyyy-MM-dd'));
  //   if (filters.status && filters.status !== 'all') newParams.set('status', filters.status);
  //   if (filters.priority && filters.priority !== 'all') newParams.set('priority', filters.priority);
  //   if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
  //   
  //   setSearchParams(newParams);
  // }, [dateRange, filters, setSearchParams]);

  // Sincronizar filtros com URL apenas na montagem inicial
  useEffect(() => {
    const newFilters = {
      status: searchParams.get('status') || 'all',
      priority: searchParams.get('priority') || 'all',
      departmentId: searchParams.get('departmentId') || 'all',
      incidentTypeId: searchParams.get('incidentTypeId') || 'all',
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

  // Buscar prioridades quando o departamento mudar
  useEffect(() => {
    const fetchPriorities = async () => {
      try {
        const companyId = user?.company_id || user?.company?.id;
        if (!companyId) {
          setPriorities([]);
          return;
        }

        // Buscar prioridades baseadas no departamento selecionado
        const departmentId = filters.departmentId;
        if (!departmentId || departmentId === 'all') {
          setPriorities([]);
          return;
        }

        const response = await fetch(`/api/departments/${departmentId}/priorities`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data && Array.isArray(data.data.priorities)) {
            const validPriorities = data.data.priorities
              .filter((p: any) => p.name && p.name.trim() !== '')
              .map((p: any) => ({ value: p.name.trim(), label: p.name.trim() }));
            setPriorities(validPriorities);
          } else {
            setPriorities([]);
          }
        } else {
          setPriorities([]);
        }
      } catch (error) {
        console.error('Erro ao buscar prioridades:', error);
        setPriorities([]);
      }
    };

    fetchPriorities();
  }, [user?.company_id, user?.company?.id, filters.departmentId]);

  useEffect(() => {
    let isMounted = true;

    const fetchIncidentTypes = async () => {
      if (!canViewDepartments) {
        if (isMounted) {
          setIncidentTypes([]);
          setIsIncidentTypesLoading(false);
          setFilters(prev => {
            if (prev.incidentTypeId !== 'all') {
              return { ...prev, incidentTypeId: 'all' };
            }
            return prev;
          });
        }
        return;
      }

      const departmentId = filters.departmentId;
      if (!departmentId || departmentId === 'all') {
        if (isMounted) {
          setIncidentTypes([]);
          setIsIncidentTypesLoading(false);
          setFilters(prev => {
            if (prev.incidentTypeId !== 'all') {
              return { ...prev, incidentTypeId: 'all' };
            }
            return prev;
          });
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
        console.error('Erro ao buscar tipos de chamado:', error);
        if (isMounted) {
          setIncidentTypes([]);
          setFilters(prev => {
            if (prev.incidentTypeId !== 'all') {
              return { ...prev, incidentTypeId: 'all' };
            }
            return prev;
          });
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

  const handleFilterChange = (key: string, value: string | boolean) => {
    // Atualizar os filtros locais primeiro
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Se mudou o departamento, limpar a prioridade
      if (key === 'departmentId') {
        newFilters.priority = 'all';
        newFilters.incidentTypeId = 'all';
      }
      
      return newFilters;
    });
    
    // Atualizar URL apenas quando o usuário clicar em "Aplicar Filtros"
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const params = new URLSearchParams();
      
      // Usar a mesma lógica de datas do dashboard para consistência
      if (dateRange?.from) params.append('start_date', toBrasiliaISOString(dateRange.from, false));
      if (dateRange?.to) params.append('end_date', toBrasiliaISOString(dateRange.to, true));
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
      if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incident_type_id', filters.incidentTypeId);
      if (filters.showInactiveOfficials) params.append('showInactiveOfficials', 'true');
      params.append('format', format);

      console.log('Exportando com parâmetros:', params.toString());

      const response = await fetch(`/api/reports/tickets/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao exportar relatório' }));
        throw new Error(errorData.error || 'Erro ao exportar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-chamados.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert(error instanceof Error ? error.message : 'Erro ao exportar relatório. Tente novamente.');
    }
  };

  // Usando StatusBadge e PriorityBadge para consistência visual com o resto do sistema

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
          <h1 className="text-2xl font-bold">Relatório de Chamados</h1>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="ongoing">Em Andamento</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="waiting_customer">Aguardando Cliente</SelectItem>
                  <SelectItem value="escalated">Escalado</SelectItem>
                  <SelectItem value="in_analysis">Em Análise</SelectItem>
                  <SelectItem value="pending_deployment">Aguardando Deploy</SelectItem>
                  <SelectItem value="reopened">Reaberto</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Prioridade</label>
              <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {priorities.map((priority) => (
                    priority.value && priority.value.trim() !== '' && (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    )
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canViewDepartments && (
              <>
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

                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Chamado</label>
                  <Select value={filters.incidentTypeId} onValueChange={(value) => handleFilterChange('incidentTypeId', value)}>
                    <SelectTrigger disabled={filters.departmentId === 'all'}>
                      <SelectValue placeholder="Todos os tipos de chamado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {isIncidentTypesLoading && (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      )}
                      {!isIncidentTypesLoading && incidentTypes.length === 0 ? (
                        <SelectItem value="no-types" disabled>Nenhum tipo disponível</SelectItem>
                      ) : (
                        incidentTypes.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center space-x-2">
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
          </div>

          <div className="mt-4">
            <Button onClick={() => {
              // Atualizar URL com os filtros atuais
              const newParams = new URLSearchParams();
              
              // Usar a mesma lógica de datas do dashboard para consistência
              if (dateRange?.from) newParams.set('start_date', toBrasiliaISOString(dateRange.from, false));
              if (dateRange?.to) newParams.set('end_date', toBrasiliaISOString(dateRange.to, true));
              if (filters.status && filters.status !== 'all') newParams.set('status', filters.status);
              if (filters.priority && filters.priority !== 'all') newParams.set('priority', filters.priority);
              if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
              if (filters.incidentTypeId && filters.incidentTypeId !== 'all') newParams.set('incidentTypeId', filters.incidentTypeId);
              if (filters.showInactiveOfficials) newParams.set('showInactiveOfficials', 'true');
              
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
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total de Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-sm text-muted-foreground">Abertos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.in_progress}</div>
            <p className="text-sm text-muted-foreground">Em Progresso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-sm text-muted-foreground">Resolvidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.closed}</div>
            <p className="text-sm text-muted-foreground">Fechados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full lg:min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Ticket ID</TableHead>
                    <TableHead className="min-w-48">Título</TableHead>
                    <TableHead className="min-w-32">Cliente</TableHead>
                    <TableHead className="min-w-32">Departamento</TableHead>
                    <TableHead className="min-w-36">Atribuído a</TableHead>
                    <TableHead className="min-w-24">Status</TableHead>
                    <TableHead className="min-w-24">Prioridade</TableHead>
                    <TableHead className="min-w-36">Criado em</TableHead>
                    <TableHead className="min-w-36">Resolvido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="text-sm">#{ticket.ticket_id}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm" title={ticket.title}>{ticket.title}</TableCell>
                      <TableCell className="text-sm">{ticket.customer?.name || 'N/A'}</TableCell>
                      <TableCell className="text-sm">{ticket.department?.name || 'N/A'}</TableCell>
                      <TableCell className="text-sm">{ticket.assigned_to?.name || 'Não atribuído'}</TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.status as TicketStatus} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge 
                          priority={ticket.priority}
                          weight={ticket.priority_weight}
                          color={ticket.priority_color}
                          name={ticket.priority_name}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ticket.resolved_at 
                          ? format(new Date(ticket.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : 'Não resolvido'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {tickets.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum ticket encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
