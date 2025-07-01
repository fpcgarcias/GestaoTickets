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
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  Settings,
  Users,
  BarChart3,
  PieChart
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { useAuth } from '@/hooks/use-auth';

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
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Buscar departamentos disponíveis
  const { data: departmentsResponse } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: async () => {
      const res = await fetch('/api/departments');
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: !!user,
  });

  const departments: Department[] = departmentsResponse?.departments || [];

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
    refetchInterval: 60000, // Atualizar a cada minuto
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
              <h2 className="text-2xl font-bold">Dashboard SLA</h2>
              <p className="text-muted-foreground">
                Visão geral das configurações e cumprimento de SLA
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
  const coverageData = slaStats.configurationsByDepartment.map(dept => ({
    name: dept.departmentName,
    coverage: dept.coverage,
    configuracoes: dept.configurationsCount,
    faltantes: dept.missingConfigurations
  }));

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

  const totalTickets = slaStats.slaCompliance.reduce((acc, dept) => acc + dept.totalTickets, 0);
  const totalMissingConfigs = slaStats.missingConfigurationAlerts.length;

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard SLA</h2>
            <p className="text-muted-foreground">
              Visão geral das configurações e cumprimento de SLA
            </p>
          </div>
          <Select value={selectedDepartments[0] || 'all'} onValueChange={handleDepartmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por departamento" />
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

        {/* Cards de métricas principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Configurações
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{slaStats.totalConfigurations}</div>
              <p className="text-xs text-muted-foreground">
                Configurações ativas de SLA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cumprimento de Resposta
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageResponseCompliance.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Média de cumprimento de SLA de resposta
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cumprimento de Resolução
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageResolutionCompliance.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Média de cumprimento de SLA de resolução
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Configurações Faltantes
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {totalMissingConfigs}
              </div>
              <p className="text-xs text-muted-foreground">
                Alertas de configurações necessárias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de conteúdo */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="compliance">Cumprimento</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Gráfico de Cobertura por Departamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Cobertura de Configurações
                  </CardTitle>
                  <CardDescription>
                    Percentual de configurações por departamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={coverageData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, coverage }) => `${name}: ${coverage.toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="coverage"
                      >
                        {coverageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Lista de Departamentos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Configurações por Departamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {slaStats.configurationsByDepartment.map((dept) => (
                      <div key={dept.departmentId} className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{dept.departmentName}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{dept.configurationsCount} configurações</span>
                            {dept.missingConfigurations > 0 && (
                              <Badge variant="outline" className="text-orange-600">
                                {dept.missingConfigurations} faltantes
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm font-medium">
                            {dept.coverage.toFixed(1)}%
                          </div>
                          <Progress value={dept.coverage} className="w-20 h-2" />
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
                    Cumprimento de SLA por Departamento
                  </CardTitle>
                  <CardDescription>
                    Percentual de cumprimento de SLA de resposta e resolução
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={complianceData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${Number(value).toFixed(1)}%`, 
                          name === 'resposta' ? 'SLA Resposta' : 'SLA Resolução'
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="resposta" fill="#0088FE" name="Resposta" />
                      <Bar dataKey="resolucao" fill="#00C49F" name="Resolução" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detalhes por departamento */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes de Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {slaStats.slaCompliance.map((dept) => (
                      <div key={dept.departmentId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{dept.departmentName}</h4>
                          <Badge variant="outline">
                            {dept.totalTickets} tickets
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Resposta no Prazo</p>
                            <p className="font-medium">
                              {dept.onTimeResponse}/{dept.totalTickets} 
                              ({dept.responseCompliance.toFixed(1)}%)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Resolução no Prazo</p>
                            <p className="font-medium">
                              {dept.onTimeResolution}/{dept.totalTickets} 
                              ({dept.resolutionCompliance.toFixed(1)}%)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tempo Médio Resposta</p>
                            <p className="font-medium">
                              {dept.averageResponseTime.toFixed(1)}h
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tempo Médio Resolução</p>
                            <p className="font-medium">
                              {dept.averageResolutionTime.toFixed(1)}h
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
                  Configurações SLA Faltantes
                </CardTitle>
                <CardDescription>
                  Combinações de departamento/tipo de incidente que precisam de configuração SLA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {slaStats.missingConfigurationAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium mb-2">
                      Todas as configurações estão em ordem!
                    </h3>
                    <p className="text-muted-foreground">
                      Não há configurações SLA faltantes no momento.
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
                            {alert.priorityName && `Prioridade: ${alert.priorityName} - `}
                            {alert.ticketsAffected} ticket(s) afetado(s) nos últimos 7 dias
                          </span>
                          <Button size="sm" variant="outline">
                            Configurar SLA
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