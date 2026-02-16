/**
 * Componente Dashboard SLA
 * Exibe visão geral das configurações por departamento, estatísticas de cumprimento e alertas
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Clock, 
  Target, 
  AlertTriangle, 
  CheckCircle2,
  Settings,
  Users,
  BarChart3,
  PieChart
} from 'lucide-react';
import { ModernPieChart } from '@/components/charts/modern-pie-chart';
import { ModernSlaBarChart } from '@/components/charts/modern-sla-bar-chart';
import { useAuth } from '@/hooks/use-auth';
import { useBusinessHoursRefetchInterval } from '../hooks/use-business-hours';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';

// Interfaces para os dados
interface SLADashboardStats {
  totalConfigurations: number;
  configurationsByDepartment: {
    departmentId: number;
    departmentName: string;
    configurationsCount: number;
    missingConfigurations: number;
    coverage: number;
  }[];
  slaCompliance: {
    departmentId: number;
    departmentName: string;
    totalTickets: number;
    onTimeResponse: number;
    onTimeResolution: number;
    responseCompliance: number;
    resolutionCompliance: number;
    averageResponseTime: number;
    averageResolutionTime: number;
  }[];
  missingConfigurationAlerts: {
    departmentId: number;
    departmentName: string;
    incidentTypeId: number;
    incidentTypeName: string;
    priorityName?: string;
    ticketsAffected: number;
  }[];
}

interface Department {
  id: number;
  name: string;
  company_id: number;
  is_active: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface SLADashboardProps {
  className?: string;
}

export function SLADashboard({ className }: SLADashboardProps) {
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(60000);
  const [showMissingConfigsModal, setShowMissingConfigsModal] = useState(false);

  // Buscar departamentos disponíveis
  const { data: departmentsResponse } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const res = await fetch('/api/departments?active_only=true');
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: !!user,
  });

  // Garantir que departments seja sempre um array, lidando com diferentes estruturas de resposta
  const departments: Department[] = Array.isArray(departmentsResponse) 
    ? departmentsResponse 
    : departmentsResponse?.departments || departmentsResponse?.data || [];

  // Filtrar apenas departamentos ativos para o dropdown (redundante, mas seguro)
  const activeDepartments = departments.filter(dept => dept.is_active);

  // Buscar estatísticas do dashboard SLA
  const { data: slaStats, isLoading: isStatsLoading } = useQuery<SLADashboardStats>({
    queryKey: ['/api/sla-dashboard/stats', selectedDepartments],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDepartments.length > 0) {
        params.append('departments', selectedDepartments.join(','));
      }
      
      const url = `/api/sla-dashboard/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar estatísticas SLA');
      return res.json();
    },
    enabled: !!user,
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
  });

  const handleDepartmentFilter = (value: string) => {
    if (value === 'all') {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments([value]);
    }
  };

  if (isStatsLoading) {
    return (
      <div className={className}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{formatMessage('sla_dashboard.title')}</h2>
              <p className="text-muted-foreground">
                {formatMessage('sla_dashboard.subtitle')}
              </p>
            </div>
            <Skeleton className="h-10 w-48" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!slaStats) return null;

  // Preparar dados para gráficos
  const coverageData = slaStats.configurationsByDepartment.map((dept, _index) => {
    const realMissing = slaStats.missingConfigurationAlerts.filter(a => a.departmentId === dept.departmentId).length;
    const total = dept.configurationsCount + realMissing;
    const coverage = total > 0 ? (dept.configurationsCount / total) * 100 : 0;
    return {
      name: dept.departmentName,
      coverage,
      configuracoes: dept.configurationsCount,
      faltantes: realMissing
    };
  });

  // Preparar dados para o ModernPieChart (formato: name, value, color)
  const coveragePieData = slaStats.configurationsByDepartment.map((dept, idx) => {
    const realMissing = slaStats.missingConfigurationAlerts.filter(a => a.departmentId === dept.departmentId).length;
    const _total = dept.configurationsCount + realMissing;
    return {
      name: dept.departmentName,
      value: dept.configurationsCount,
      color: COLORS[idx % COLORS.length]
    };
  });

  const complianceData = slaStats.slaCompliance.map(dept => ({
    name: dept.departmentName,
    resposta: dept.responseCompliance,
    resolucao: dept.resolutionCompliance,
    tickets: dept.totalTickets
  }));

  const averageResponseCompliance = slaStats.slaCompliance.length > 0 
    ? slaStats.slaCompliance.reduce((acc, dept) => acc + dept.responseCompliance, 0) / slaStats.slaCompliance.length 
    : 0;

  const averageResolutionCompliance = slaStats.slaCompliance.length > 0 
    ? slaStats.slaCompliance.reduce((acc, dept) => acc + dept.resolutionCompliance, 0) / slaStats.slaCompliance.length 
    : 0;

  const _totalTickets = slaStats.slaCompliance.reduce((acc, dept) => acc + dept.totalTickets, 0);
  const totalMissingConfigs = slaStats.missingConfigurationAlerts.length;

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{formatMessage('sla_dashboard.title')}</h2>
            <p className="text-muted-foreground">
              {formatMessage('sla_dashboard.subtitle')}
            </p>
          </div>
          <Select value={selectedDepartments[0] || 'all'} onValueChange={handleDepartmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={formatMessage('sla_dashboard.filter_department')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage('sla_dashboard.all_departments')}</SelectItem>
              {activeDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cards de métricas principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatMessage('sla_dashboard.total_configurations')}
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{slaStats.totalConfigurations}</div>
              <p className="text-xs text-muted-foreground">
                {formatMessage('sla_dashboard.active_sla_configurations')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatMessage('sla_dashboard.response_compliance')}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageResponseCompliance.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage('sla_dashboard.average_response_compliance')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatMessage('sla_dashboard.resolution_compliance')}
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageResolutionCompliance.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage('sla_dashboard.average_resolution_compliance')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatMessage('sla_dashboard.missing_configurations')}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-orange-600">
                  {totalMissingConfigs}
                </div>
                {totalMissingConfigs > 0 && (
                  <Dialog open={showMissingConfigsModal} onOpenChange={setShowMissingConfigsModal}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="ml-2">{formatMessage('sla_dashboard.view_details')}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{formatMessage('sla_dashboard.missing_configs_modal.title')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {slaStats.missingConfigurationAlerts.map((alert, idx) => (
                          <div key={idx} className="border rounded p-2 flex flex-col">
                            <span className="font-medium">{alert.departmentName} - {alert.incidentTypeName}</span>
                            <span className="text-xs text-muted-foreground">{formatMessage('sla_dashboard.alerts.priority', { priority: alert.priorityName || 'Padrão' })}</span>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage('sla_dashboard.configuration_alerts')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de conteúdo */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{formatMessage('sla_dashboard.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="compliance">{formatMessage('sla_dashboard.tabs.compliance')}</TabsTrigger>
            <TabsTrigger value="alerts">{formatMessage('sla_dashboard.tabs.alerts')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Gráfico de Cobertura por Departamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    {formatMessage('sla_dashboard.overview.coverage_title')}
                  </CardTitle>
                  <CardDescription>
                    {formatMessage('sla_dashboard.overview.coverage_description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ModernPieChart 
                    data={coveragePieData} 
                    isLoading={isStatsLoading}
                  />
                </CardContent>
              </Card>

              {/* Lista de Departamentos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {formatMessage('sla_dashboard.overview.configurations_by_department')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {slaStats.configurationsByDepartment.map((dept) => (
                      <div key={dept.departmentId} className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{dept.departmentName}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatMessage('sla_dashboard.overview.configurations_count', { count: dept.configurationsCount })}</span>
                            {dept.missingConfigurations > 0 && (
                              <Badge variant="outline" className="text-orange-600">
                                {formatMessage('sla_dashboard.overview.missing_count', { count: slaStats.missingConfigurationAlerts.filter(a => a.departmentId === dept.departmentId).length })}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm font-medium">
                            {coverageData.find(d => d.name === dept.departmentName)?.coverage.toFixed(1)}%
                          </div>
                          <Progress value={coverageData.find(d => d.name === dept.departmentName)?.coverage || 0} className="w-20 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <div className="grid gap-6">
              {/* Gráfico de Cumprimento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {formatMessage('sla_dashboard.compliance.title')}
                  </CardTitle>
                  <CardDescription>
                    {formatMessage('sla_dashboard.compliance.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ModernSlaBarChart 
                    data={complianceData} 
                    isLoading={isStatsLoading}
                  />
                </CardContent>
              </Card>

              {/* Detalhes por departamento */}
              <Card>
                <CardHeader>
                  <CardTitle>{formatMessage('sla_dashboard.compliance.performance_details')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {slaStats.slaCompliance.map((dept) => (
                      <div key={dept.departmentId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{dept.departmentName}</h4>
                          <Badge variant="outline">
                            {formatMessage('sla_dashboard.compliance.tickets_count', { count: dept.totalTickets })}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">{formatMessage('sla_dashboard.compliance.on_time_response')}</p>
                            <p className="font-medium">
                              {dept.onTimeResponse}/{dept.totalTickets} 
                              ({dept.responseCompliance.toFixed(1)}%)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{formatMessage('sla_dashboard.compliance.on_time_resolution')}</p>
                            <p className="font-medium">
                              {dept.onTimeResolution}/{dept.totalTickets} 
                              ({dept.resolutionCompliance.toFixed(1)}%)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{formatMessage('sla_dashboard.compliance.avg_response_time')}</p>
                            <p className="font-medium">
                              {formatMessage('sla_dashboard.compliance.hours', { hours: dept.averageResponseTime.toFixed(1) })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{formatMessage('sla_dashboard.compliance.avg_resolution_time')}</p>
                            <p className="font-medium">
                              {formatMessage('sla_dashboard.compliance.hours', { hours: dept.averageResolutionTime.toFixed(1) })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  {formatMessage('sla_dashboard.alerts.title')}
                </CardTitle>
                <CardDescription>
                  {formatMessage('sla_dashboard.alerts.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {slaStats.missingConfigurationAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium mb-2">
                      {formatMessage('sla_dashboard.alerts.all_configured')}
                    </h3>
                    <p className="text-muted-foreground">
                      {formatMessage('sla_dashboard.alerts.no_missing_configs')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slaStats.missingConfigurationAlerts.map((alert, index) => (
                      <Alert key={index} className="border-orange-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                          {alert.departmentName} - {alert.incidentTypeName}
                        </AlertTitle>
                        <AlertDescription className="flex items-center justify-between">
                          <span>
                            {alert.priorityName && `${formatMessage('sla_dashboard.alerts.priority', { priority: alert.priorityName })} - `}
                            {formatMessage('sla_dashboard.alerts.tickets_affected', { count: alert.ticketsAffected })}
                          </span>
                          <Button size="sm" variant="outline">
                            {formatMessage('sla_dashboard.alerts.configure_sla')}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default SLADashboard; 