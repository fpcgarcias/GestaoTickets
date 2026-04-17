import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, PriorityBadge } from '@/components/tickets/status-badge';
import { type TicketStatus, STATUS_CONFIG } from '@shared/ticket-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Download, Calendar, Filter, ChevronDown, ArrowLeft } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';

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
  sector?: {
    name: string;
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
  status: string[];
  priority: string;
  departmentId: string;
  incidentTypeId: string;
  showInactiveOfficials: boolean;
}

export default function TicketReports() {
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  const [tickets, setTickets] = useState<TicketReport[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  // Filtro de período igual ao dashboard e tela de tickets: presets + período customizado
  const [timeFilter, setTimeFilter] = useState('this-month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    status: searchParams.get('status') ? searchParams.get('status')!.split(',') : [],
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

  // Calcular datas do período (igual ao dashboard e tela de tickets)
  function getPeriodDates() {
    const now = new Date();
    let from: Date;
    let to: Date;
    switch (timeFilter) {
      case 'this-week':
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last-week': {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case 'this-month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'custom':
        from = dateRange.from ?? startOfMonth(now);
        to = dateRange.to ?? endOfMonth(now);
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }
    return { startDate: from, endDate: to };
  }

  const isDateRangeReady = !(timeFilter === 'custom' && (!dateRange.from || !dateRange.to));
  const { startDate, endDate } = getPeriodDates();

  // Dependências estáveis para evitar reexecuções desnecessárias (filters.status é array)
  const filtersStatusKey = (filters.status || []).join(',');
  const dateFromKey = dateRange.from?.getTime();
  const dateToKey = dateRange.to?.getTime();

  // Buscar dados quando período ou filtros mudam (igual ao dashboard/tickets)
  useEffect(() => {
    if (!isDateRangeReady) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { startDate: periodStart, endDate: periodEnd } = (() => {
          const now = new Date();
          let from: Date;
          let to: Date;
          switch (timeFilter) {
            case 'this-week':
              from = startOfWeek(now, { weekStartsOn: 1 });
              to = endOfWeek(now, { weekStartsOn: 1 });
              break;
            case 'last-week': {
              const lastWeek = new Date(now);
              lastWeek.setDate(now.getDate() - 7);
              from = startOfWeek(lastWeek, { weekStartsOn: 1 });
              to = endOfWeek(lastWeek, { weekStartsOn: 1 });
              break;
            }
            case 'this-month':
              from = startOfMonth(now);
              to = endOfMonth(now);
              break;
            case 'custom':
              from = dateRange.from ?? startOfMonth(now);
              to = dateRange.to ?? endOfMonth(now);
              break;
            default:
              from = startOfMonth(now);
              to = endOfMonth(now);
          }
          return { startDate: from, endDate: to };
        })();
        const params = new URLSearchParams();
        params.append('start_date', toBrasiliaISOString(periodStart, false));
        params.append('end_date', toBrasiliaISOString(periodEnd, true));
        if (filters.status?.length) params.append('status', filters.status.join(','));
        if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
        if (filters.departmentId && filters.departmentId !== 'all') params.append('departmentId', filters.departmentId);
        if (filters.incidentTypeId && filters.incidentTypeId !== 'all') params.append('incident_type_id', filters.incidentTypeId);
        if (filters.showInactiveOfficials) params.append('showInactiveOfficials', 'true');
        const response = await fetch(`/api/reports/tickets?${params}`);
        if (!response.ok) throw new Error('Erro ao buscar relatórios');
        const data = await response.json();
        if (!cancelled) {
          setTickets(data.tickets || []);
          setStats(data.stats || { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erro ao buscar relatórios:', error);
          setTickets([]);
          setStats({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [timeFilter, dateFromKey, dateToKey, filtersStatusKey, filters.priority, filters.departmentId, filters.incidentTypeId, filters.showInactiveOfficials]);

  // Função para buscar relatórios com filtros atuais (usada pelo botão e export)
  const fetchReportsWithCurrentFilters = async () => {
    setLoading(true);
    try {
      const { startDate: periodStart, endDate: periodEnd } = getPeriodDates();
      const params = new URLSearchParams();
      params.append('start_date', toBrasiliaISOString(periodStart, false));
      params.append('end_date', toBrasiliaISOString(periodEnd, true));
      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
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
      status: searchParams.get('status') ? searchParams.get('status')!.split(',') : [],
      priority: searchParams.get('priority') || 'all',
      departmentId: searchParams.get('departmentId') || 'all',
      incidentTypeId: searchParams.get('incidentTypeId') || 'all',
      showInactiveOfficials: searchParams.get('showInactiveOfficials') === 'true' || false
    };
    setFilters(newFilters);

    const fromDate = searchParams.get('start_date') || searchParams.get('startDate');
    const toDate = searchParams.get('end_date') || searchParams.get('endDate');
    if (fromDate && toDate) {
      setTimeFilter('custom');
      setDateRange({
        from: new Date(fromDate),
        to: new Date(toDate)
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

  const handleFilterChange = (key: string, value: string | boolean | string[]) => {
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

  const handleStatusToggle = (statusValue: string) => {
    setFilters(prev => {
      const currentStatus = prev.status || [];
      const newStatus = currentStatus.includes(statusValue)
        ? currentStatus.filter(s => s !== statusValue)
        : [...currentStatus, statusValue];
      return { ...prev, status: newStatus };
    });
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const { startDate: periodStart, endDate: periodEnd } = getPeriodDates();
      const params = new URLSearchParams();
      params.append('start_date', toBrasiliaISOString(periodStart, false));
      params.append('end_date', toBrasiliaISOString(periodEnd, true));
      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
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
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <DateRangeFilter
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  calendarOpen={calendarOpen}
                  setCalendarOpen={setCalendarOpen}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(startDate, locale === 'en-US' ? 'MM/dd/yy' : 'dd/MM/yy', { locale: locale === 'en-US' ? enUS : ptBR })}
                  {formatMessage('dashboard.date_range_separator')}
                  {format(endDate, locale === 'en-US' ? 'MM/dd/yy' : 'dd/MM/yy', { locale: locale === 'en-US' ? enUS : ptBR })}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {filters.status.length === 0
                        ? 'Todos os status'
                        : filters.status.length > 2
                        ? `${filters.status.length} status selecionados`
                        : filters.status.map(s => STATUS_CONFIG[s as TicketStatus]?.label || s).join(', ')}
                    </span>
                    <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar status..." />
                    <CommandEmpty>Nenhum status encontrado.</CommandEmpty>
                    <CommandGroup>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => {
                        const checked = filters.status.includes(value);
                        return (
                          <CommandItem
                            key={value}
                            onSelect={() => handleStatusToggle(value)}
                          >
                            <Checkbox checked={checked} className="mr-2" />
                            <span>{config.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
              const newParams = new URLSearchParams();
              newParams.set('start_date', toBrasiliaISOString(startDate, false));
              newParams.set('end_date', toBrasiliaISOString(endDate, true));
              if (filters.status && filters.status.length > 0) {
                newParams.set('status', filters.status.join(','));
              }
              if (filters.priority && filters.priority !== 'all') newParams.set('priority', filters.priority);
              if (filters.departmentId && filters.departmentId !== 'all') newParams.set('departmentId', filters.departmentId);
              if (filters.incidentTypeId && filters.incidentTypeId !== 'all') newParams.set('incidentTypeId', filters.incidentTypeId);
              if (filters.showInactiveOfficials) newParams.set('showInactiveOfficials', 'true');
              setSearchParams(newParams);
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
                    <TableHead className="min-w-32">Solicitante</TableHead>
                    <TableHead className="min-w-32">Setor</TableHead>
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
                      <TableCell className="text-sm">{ticket.sector?.name || 'N/A'}</TableCell>
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
