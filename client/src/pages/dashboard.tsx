import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TimeMetricCard } from '@/components/ui/time-metric-card';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Clock, CheckCircle2, Users, Calendar, MoreHorizontal, Building, ClipboardList, Tags, ChevronDown } from 'lucide-react';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useBusinessHoursRefetchInterval } from '../hooks/use-business-hours';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useI18n } from '@/i18n';
import { ModernPieChart } from '@/components/charts/modern-pie-chart';
import { ModernBarChart } from '@/components/charts/modern-bar-chart';
import { ComparisonArrow } from '@/components/ui/comparison-arrow';
import { PendingSatisfactionSurveys } from '@/components/satisfaction/pending-survey-modal';
import { PendingWaitingCustomerTickets } from '@/components/tickets/pending-waiting-customer-modal';

// Definir tipos para os dados das consultas
interface RecentTicket {
  id: number;
  title: string;
  status: 'new' | 'ongoing' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  customer?: {
    name: string;
  };
}

interface IncidentTypeOption {
  id: number;
  name: string;
  department_id: number | null;
}

interface CategoryOption {
  id: number;
  name: string;
  incident_type_id: number | null;
}

// Utilitário para converter data local (Brasília) para UTC ISO string (yyyy-mm-ddTHH:MM:SSZ)
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

// Função utilitária para normalizar prioridade (primeira letra maiúscula, resto minúsculo)
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

export default function Dashboard() {
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  const isChangingFromIncidentType = useRef(false);
  const isCustomer = user?.role === 'customer';
  const [waitingCustomerDone, setWaitingCustomerDone] = useState(false);
  const shouldShowWaitingCustomer = isCustomer;
  const shouldShowSatisfactionPrompt = isCustomer && waitingCustomerDone;

  // Novo filtro de datas igual ao index.tsx
  const [timeFilter, setTimeFilter] = useState('this-month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Filtro de departamento
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [selectedIncidentTypeId, setSelectedIncidentTypeId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Função para calcular datas igual ao index.tsx
  function getPeriodDates() {
    const now = new Date();
    let from: Date;
    let to: Date;
    switch (timeFilter) {
      case 'this-week':
        from = startOfWeek(now, { weekStartsOn: 1 }); // segunda-feira
        to = endOfWeek(now, { weekStartsOn: 1 }); // domingo
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
        from = dateRange.from ? dateRange.from : startOfMonth(now);
        to = dateRange.to ? dateRange.to : endOfMonth(now);
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }
    return { startDate: from, endDate: to };
  }
  const isDateRangeReady = !(timeFilter === 'custom' && (!dateRange.from || !dateRange.to));
  const { startDate, endDate } = getPeriodDates();

  const [selectedOfficialId, setSelectedOfficialId] = useState<string>('all');

  // Verificar se deve exibir o filtro de atendentes
  // APENAS admin, company_admin, manager, supervisor e support devem ver o dropdown
  // customer, viewer, etc. NÃO devem ver
  const shouldShowOfficialFilter = user?.role && ['admin', 'company_admin', 'manager', 'supervisor', 'support'].includes(user.role);

  // Verificar se deve exibir o filtro de departamentos
  // APENAS admin, company_admin, manager e supervisor devem ver o dropdown
  // Outras roles (support, customer, viewer, etc.) NÃO devem ver
  const shouldShowDepartmentFilter = user?.role && ['admin', 'company_admin', 'manager', 'supervisor'].includes(user.role);
  const shouldShowIncidentTypeFilter = shouldShowDepartmentFilter;

  // Buscar departamentos apenas se necessário
  // O endpoint /api/departments já filtra automaticamente baseado na role:
  // - Admin/Company_admin: retorna todos os departamentos
  // - Manager/Supervisor: retorna apenas departamentos vinculados ao usuário
  const { data: departmentsResponse } = useQuery({
    queryKey: ['/api/departments', { active_only: true }, user?.role, user?.id],
    queryFn: async () => {
      const res = await fetch('/api/departments?active_only=true');
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: shouldShowDepartmentFilter,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const departments = departmentsResponse?.departments || departmentsResponse || [];

  // Buscar tipos de chamado conforme departamento selecionado
  const { data: incidentTypesResponse, isLoading: isIncidentTypesLoading } = useQuery({
    queryKey: ['/api/incident-types', selectedDepartmentId, user?.role, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      params.append('limit', '1000');
      if (selectedDepartmentId !== 'all') {
        params.append('department_id', selectedDepartmentId);
      }
      const res = await fetch(`/api/incident-types?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar tipos de chamado');
      return res.json();
    },
    enabled: shouldShowIncidentTypeFilter,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const rawIncidentTypes = incidentTypesResponse?.incidentTypes || incidentTypesResponse?.data || incidentTypesResponse || [];
  const incidentTypes: IncidentTypeOption[] = Array.isArray(rawIncidentTypes) ? rawIncidentTypes : [];

  useEffect(() => {
    if (selectedIncidentTypeId === 'all') return;
    // Não resetar se a mudança veio de handleIncidentTypeChange
    if (isChangingFromIncidentType.current) return;
    const exists = incidentTypes.some((type) => type.id?.toString() === selectedIncidentTypeId);
    if (!exists) {
      setSelectedIncidentTypeId('all');
    }
  }, [incidentTypes, selectedIncidentTypeId]);

  // Buscar categorias - TODAS por padrão, filtrando por departamento/tipo se selecionados
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['/api/categories', selectedDepartmentId, selectedIncidentTypeId, user?.role, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      params.append('limit', '1000');
      
      // Filtrar por departamento se selecionado
      if (selectedDepartmentId && selectedDepartmentId !== 'all') {
        params.append('department_id', selectedDepartmentId);
      }
      
      // Filtrar por tipo de chamado se selecionado
      if (selectedIncidentTypeId && selectedIncidentTypeId !== 'all') {
        params.append('incident_type_id', selectedIncidentTypeId);
      }
      
      const url = `/api/categories?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        await res.text();
        throw new Error(`Erro ao carregar categorias: ${res.status}`);
      }
      const data = await res.json();
      return data;
    },
    enabled: shouldShowIncidentTypeFilter, // Sempre habilitado se o usuário tem permissão
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const rawCategories = categoriesResponse?.categories || categoriesResponse?.data || categoriesResponse || [];
  const categories: CategoryOption[] = Array.isArray(rawCategories) ? rawCategories : [];

  useEffect(() => {
    if (selectedCategoryId === 'all') return;
    const exists = categories.some((category) => category.id?.toString() === selectedCategoryId);
    if (!exists) {
      setSelectedCategoryId('all');
    }
  }, [categories, selectedCategoryId]);

  // Buscar atendentes apenas se necessário
  const { data: officialsResponse } = useQuery({
    queryKey: ['/api/officials', user?.id, user?.role, selectedDepartmentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Buscar todos para o dashboard
      if (selectedDepartmentId !== 'all') {
        params.append('department_id', selectedDepartmentId);
      }
      const res = await fetch(`/api/officials?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    enabled: shouldShowOfficialFilter,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const officials = officialsResponse?.officials || officialsResponse?.data || [];

  // Filtrar atendentes baseado na role do usuário
  const getFilteredOfficials = () => {
    if (!officials || !user) return [];
    
    // A API já está filtrando corretamente por role, então apenas retornamos os dados
    return officials.filter((official: Official) => official.is_active);
  };

  const filteredOfficials = getFilteredOfficials();

  useEffect(() => {
    if (selectedOfficialId === 'all') return;
    const exists = filteredOfficials.some((official: Official) => official.id.toString() === selectedOfficialId);
    if (!exists) {
      setSelectedOfficialId('all');
    }
  }, [filteredOfficials, selectedOfficialId]);

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartmentId(value);
    // Se a mudança veio de handleIncidentTypeChange, não resetar o tipo
    if (value !== selectedDepartmentId && !isChangingFromIncidentType.current) {
      setSelectedIncidentTypeId('all');
      setSelectedCategoryId('all');
      setSelectedOfficialId('all');
    }
    // Resetar a flag após um pequeno delay para garantir que todos os useEffects foram processados
    if (isChangingFromIncidentType.current) {
      setTimeout(() => {
        isChangingFromIncidentType.current = false;
      }, 100);
    }
  };

  const handleIncidentTypeChange = (value: string) => {
    if (value === 'all') {
      setSelectedIncidentTypeId(value);
      setSelectedCategoryId('all');
      return;
    }
    
    // Atualizar departamento automaticamente se o tipo pertence a um departamento específico
    const selectedType = incidentTypes.find((type) => type.id?.toString() === value);
    if (selectedType?.department_id) {
      const departmentIdString = selectedType.department_id.toString();
      if (selectedDepartmentId !== departmentIdString) {
        // Marcar que a mudança de departamento vem daqui ANTES de fazer qualquer mudança
        isChangingFromIncidentType.current = true;
        // Setar tudo junto
        setSelectedIncidentTypeId(value);
        setSelectedDepartmentId(departmentIdString);
        setSelectedCategoryId('all');
        setSelectedOfficialId('all');
        return;
      }
    }
    
    // Se não mudou o departamento, apenas setar o tipo e resetar categoria
    setSelectedIncidentTypeId(value);
    setSelectedCategoryId('all');
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
  };

  const handleOfficialChange = (value: string) => {
    setSelectedOfficialId(value);
    if (value === 'all') {
      return;
    }
    const selectedOfficial = filteredOfficials.find((official: Official) => official.id.toString() === value);
    if (!selectedOfficial) {
      return;
    }
    if (selectedDepartmentId === 'all' && selectedOfficial.department_id) {
      setSelectedDepartmentId(selectedOfficial.department_id.toString());
      setSelectedIncidentTypeId('all');
    }
  };

  // Construir query params para as APIs
  const getQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedOfficialId !== 'all') {
      params.append('official_id', selectedOfficialId);
    }
    if (selectedIncidentTypeId !== 'all') {
      params.append('incident_type_id', selectedIncidentTypeId);
    }
    if (selectedCategoryId !== 'all') {
      params.append('category_id', selectedCategoryId);
    }
    if (selectedDepartmentId !== 'all') {
      params.append('department_id', selectedDepartmentId);
    }
    return params;
  };

  // Construir parâmetros de query incluindo período
  const getQueryParamsWithPeriod = () => {
    const periodParams = getQueryParams();
    // Adicionar datas do período (ajustadas para UTC-3)
    periodParams.append('start_date', toBrasiliaISOString(startDate, false));
    periodParams.append('end_date', toBrasiliaISOString(endDate, true));
    return periodParams.toString();
  };

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(60000);

  // Query única para todas as métricas do dashboard
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard-metrics', startDate.toISOString(), endDate.toISOString(), selectedOfficialId, selectedDepartmentId, selectedIncidentTypeId, selectedCategoryId],
    queryFn: async () => {
      const params = getQueryParamsWithPeriod();
      const url = `/api/tickets/dashboard-metrics${params ? `?${params}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
      return response.json();
    },
    // No modo custom, só buscar quando ambas as datas estiverem selecionadas
    enabled: isDateRangeReady,
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
    refetchIntervalInBackground: false,
  });

  // Adaptar os dados para o formato esperado
  const ticketStats = dashboardData?.stats || { 
    total: 0, 
    byStatus: { new: 0, ongoing: 0, resolved: 0, closed: 0 }, 
    byPriority: { low: 0, medium: 0, high: 0, critical: 0 } 
  };
  const avgFirstResponseData = { averageTime: dashboardData?.averageFirstResponseTime || 0 };
  const avgResolutionData = { averageTime: dashboardData?.averageResolutionTime || 0 };
  const recentTickets = Array.isArray(dashboardData?.recentTickets) ? dashboardData.recentTickets : [];

  // Dados de comparação do período anterior
  const previousTicketStats = dashboardData?.previousStats || null;
  const previousAvgFirstResponseTime = dashboardData?.previousAverageFirstResponseTime || null;
  const previousAvgResolutionTime = dashboardData?.previousAverageResolutionTime || null;

  // Calcular chamados com outros status (qualquer status que não seja new, ongoing, resolved ou closed)
  const otherStatusCount = Object.entries(ticketStats.byStatus)
    .filter(([status]) => !['new', 'ongoing', 'resolved', 'closed'].includes(status))
    .reduce((sum, [_, count]) => sum + (count as number), 0);

  // Calcular valores anteriores para comparação (removido previousOtherStatusCount - não é mais usado)

  // Dados de status transformados com base no idioma
  const statusData = [
    { name: locale === 'en-US' ? 'New' : 'Novos', value: ticketStats.byStatus.new, color: '#F59E0B' },
    { name: locale === 'en-US' ? 'Ongoing' : 'Em Andamento', value: ticketStats.byStatus.ongoing, color: '#3B82F6' },
    { name: locale === 'en-US' ? 'Resolved' : 'Resolvidos', value: ticketStats.byStatus.resolved, color: '#10B981' },
    { name: locale === 'en-US' ? 'Closed' : 'Encerrados', value: ticketStats.byStatus.closed, color: '#6B7280' },
    { name: locale === 'en-US' ? 'Other Status' : 'Outros Status', value: otherStatusCount, color: '#8B5CF6' },
  ];

  // Os novos componentes modernos lidam com dados vazios internamente

  // Processar dados de prioridade - agrupar case-insensitive e exibir padronizado
  const prioridadeMap: Record<string, { name: string; Qtde: number }> = {};
  Object.entries(ticketStats.byPriority).forEach(([priority, count]) => {
    const key = normalizarPrioridade(priority);
    if (!prioridadeMap[key]) {
      prioridadeMap[key] = { name: key, Qtde: 0 };
    }
    prioridadeMap[key].Qtde += Number(count ?? 0);
  });
  const priorityData = Object.values(prioridadeMap)
    .filter(item => item.Qtde > 0)
    .sort((a, b) => b.Qtde - a.Qtde);

  return (
    <div>
      {shouldShowWaitingCustomer && (
        <PendingWaitingCustomerTickets
          enabled={shouldShowWaitingCustomer}
          onDone={() => setWaitingCustomerDone(true)}
        />
      )}
      {shouldShowSatisfactionPrompt && (
        <PendingSatisfactionSurveys enabled={shouldShowSatisfactionPrompt} />
      )}
      <div className="dashboard-header mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-semibold text-foreground">{formatMessage('dashboard.title')}</h1>
          {/* Filtros fixos: Datas, Departamento e Mais Filtros - alinhados à direita */}
          <div className="flex items-center gap-4 flex-nowrap">
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
              {/* Indicador discreto do período */}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(startDate, locale === 'en-US' ? 'MM/dd/yy' : 'dd/MM/yy', { locale: locale === 'en-US' ? enUS : ptBR })}{formatMessage('dashboard.date_range_separator')}{format(endDate, locale === 'en-US' ? 'MM/dd/yy' : 'dd/MM/yy', { locale: locale === 'en-US' ? enUS : ptBR })}
              </span>
            </div>
            {/* Filtro de Departamento */}
            {shouldShowDepartmentFilter && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Select value={selectedDepartmentId} onValueChange={handleDepartmentChange}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={formatMessage('dashboard.all_departments')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{formatMessage('dashboard.all_departments')}</SelectItem>
                    {departments.map((department: any) => (
                      <SelectItem key={department.id} value={department.id.toString()}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Botão Mais Filtros */}
            {(shouldShowIncidentTypeFilter || shouldShowOfficialFilter) && (
              <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-fit whitespace-nowrap">
                    {formatMessage('dashboard.more_filters')}
                    <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
        </div>
        
        {/* Filtros expandidos - alinhados à direita, abaixo da primeira linha */}
        {(shouldShowIncidentTypeFilter || shouldShowOfficialFilter) && (
          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CollapsibleContent>
              <div className="flex items-center gap-4 flex-wrap justify-end">
                {/* Filtro de Tipo de Chamado */}
                {shouldShowIncidentTypeFilter && (
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select value={selectedIncidentTypeId} onValueChange={handleIncidentTypeChange}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder={formatMessage('dashboard.all_incident_types')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{formatMessage('dashboard.all_incident_types')}</SelectItem>
                        {isIncidentTypesLoading ? (
                          <SelectItem value="loading" disabled>
                            {formatMessage('dashboard.loading_incident_types')}
                          </SelectItem>
                        ) : incidentTypes.length > 0 ? (
                          [...incidentTypes]
                            .sort((a, b) => a.name.localeCompare(b.name, locale === 'en-US' ? 'en-US' : 'pt-BR', { sensitivity: 'base' }))
                            .map((incidentType) => (
                              <SelectItem key={incidentType.id} value={incidentType.id.toString()}>
                                {incidentType.name}
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="none" disabled>
                            {formatMessage('dashboard.no_incident_types')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Filtro de Categoria */}
                {shouldShowIncidentTypeFilter && (
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder={formatMessage('dashboard.all_categories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{formatMessage('dashboard.all_categories')}</SelectItem>
                        {isCategoriesLoading ? (
                          <SelectItem value="loading" disabled>
                            {formatMessage('dashboard.loading_categories')}
                          </SelectItem>
                        ) : categories.length > 0 ? (
                          [...categories]
                            .sort((a, b) => a.name.localeCompare(b.name, locale === 'en-US' ? 'en-US' : 'pt-BR', { sensitivity: 'base' }))
                            .map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="none" disabled>
                            {formatMessage('dashboard.no_categories_available')}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Filtro de Atendente */}
                {shouldShowOfficialFilter && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select value={selectedOfficialId} onValueChange={handleOfficialChange}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder={formatMessage('dashboard.all_officials')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{formatMessage('dashboard.all_officials')}</SelectItem>
                        {[...filteredOfficials]
                          .sort((a, b) => a.name.localeCompare(b.name, locale === 'en-US' ? 'en-US' : 'pt-BR', { sensitivity: 'base' }))
                          .map((official: Official) => (
                            <SelectItem key={official.id} value={official.id.toString()}>
                              {official.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      

      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 mb-6">
        <StatCard 
          title={formatMessage('dashboard.total_tickets')} 
          value={ticketStats.total}
          previousValue={previousTicketStats?.total}
          isLoading={isDashboardLoading}
        />
        <StatCard 
          title={formatMessage('dashboard.new_tickets')} 
          value={ticketStats.byStatus.new}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.NEW as 'new'}
        />
        <StatCard 
          title={formatMessage('dashboard.ongoing_tickets')} 
          value={ticketStats.byStatus.ongoing}
          previousValue={previousTicketStats?.byStatus.ongoing}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.ONGOING as 'ongoing'}
        />
        <StatCard 
          title={formatMessage('dashboard.resolved_tickets')} 
          value={ticketStats.byStatus.resolved}
          previousValue={previousTicketStats?.byStatus.resolved}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.RESOLVED as 'resolved'}
        />
        <StatCard 
          title={formatMessage('dashboard.closed_tickets')} 
          value={ticketStats.byStatus.closed}
          previousValue={previousTicketStats?.byStatus.closed}
          isLoading={isDashboardLoading}
          status={TICKET_STATUS.CLOSED as 'closed'}
        />
        <StatCard 
          title={formatMessage('dashboard.other_status')} 
          value={otherStatusCount}
          isLoading={isDashboardLoading}
          icon="other"
        />
      </div>
      
      {/* Nova seção para métricas de tempo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <TimeMetricCard
          title={formatMessage('dashboard.avg_first_response')}
          description={formatMessage('dashboard.avg_first_response_desc')}
          value={avgFirstResponseData?.averageTime || 0}
          previousValue={previousAvgFirstResponseTime}
          isLoading={isDashboardLoading}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
        />
        <TimeMetricCard
          title={formatMessage('dashboard.avg_resolution')}
          description={formatMessage('dashboard.avg_resolution_desc')}
          value={avgResolutionData?.averageTime || 0}
          previousValue={previousAvgResolutionTime}
          isLoading={isDashboardLoading}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{formatMessage('dashboard.tickets_by_status')}</CardTitle>
            <CardDescription>{formatMessage('dashboard.tickets_by_status_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ModernPieChart 
              data={statusData} 
              isLoading={isDashboardLoading}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{formatMessage('dashboard.tickets_by_priority')}</CardTitle>
            <CardDescription>{formatMessage('dashboard.tickets_by_priority_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ModernBarChart 
              data={priorityData} 
              isLoading={isDashboardLoading}
            />
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('dashboard.recent_tickets')}</CardTitle>
          <CardDescription>{formatMessage('dashboard.recent_tickets_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isDashboardLoading ? (
            <div className="space-y-4">
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.slice(0, 5).map((ticket: RecentTicket) => (
                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-2">
                  <div className="flex items-start sm:items-center">
                    <StatusDot status={ticket.status} className="mr-2 mt-1 sm:mt-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.customer?.name} • {new Date(ticket.created_at).toLocaleDateString(locale === 'en-US' ? 'en-US' : 'pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm flex-shrink-0">
                    {ticket.priority === PRIORITY_LEVELS.HIGH && (
                      <span className="text-xs font-medium text-white bg-status-high px-2 py-1 rounded">
                        {formatMessage('dashboard.high_priority')}
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
  previousValue?: number; // Valor anterior para comparação
  isLoading: boolean;
  status?: 'new' | 'ongoing' | 'resolved' | 'closed'; // Tipo mais específico para status
  icon?: string; // Adicionar suporte para ícone customizado
}

const StatCard: React.FC<StatCardProps> = ({ title, value, previousValue, isLoading, status, icon }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-2">
          {status && <StatusDot status={status} className="mr-2" />}
          {icon === 'other' && <MoreHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />}
          <h3 className="font-medium">{title}</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-16" />
        ) : (
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold">{value}</p>
            {previousValue !== undefined && (
              <ComparisonArrow 
                currentValue={value} 
                previousValue={previousValue}
                format="number"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
