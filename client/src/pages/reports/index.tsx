import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ReportsIndex() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canViewDepartmentReports = ['admin', 'company_admin'].includes(user?.role || '');

  const handleViewReport = (reportType: string) => {
    setLocation(`/reports/${reportType}`);
  };

  // Relatórios implementados
  const implementedReports = ['tickets', 'performance', 'sla', 'department', 'clients'];

  const isReportImplemented = (reportType: string) => {
    return implementedReports.includes(reportType);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span>Relatórios de Chamados</span>
              </CardTitle>
            </div>
            <CardDescription>
              Visualize estatísticas e tendências de chamados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Análise detalhada de volume, tempo de resposta e resolução de chamados
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={() => handleViewReport('tickets')}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span>Relatórios de Performance</span>
              </CardTitle>
              {!isReportImplemented('performance') && (
                <Badge variant="secondary" className="flex-shrink-0">
                  <Construction className="mr-1 h-3 w-3" />
                  Em desenvolvimento
                </Badge>
              )}
            </div>
            <CardDescription>
              Métricas de desempenho dos atendentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Análise de produtividade e eficiência dos atendentes
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  disabled={!isReportImplemented('performance')}
                  onClick={() => handleViewReport('performance')}
                  className={!isReportImplemented('performance') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span>Relatórios de SLA</span>
              </CardTitle>
              {!isReportImplemented('sla') && (
                <Badge variant="secondary" className="flex-shrink-0">
                  <Construction className="mr-1 h-3 w-3" />
                  Em desenvolvimento
                </Badge>
              )}
            </div>
            <CardDescription>
              Monitoramento de cumprimento de SLA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Acompanhamento de metas e indicadores de qualidade
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  disabled={!isReportImplemented('sla')}
                  onClick={() => handleViewReport('sla')}
                  className={!isReportImplemented('sla') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {canViewDepartmentReports && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span>Relatórios por Departamento</span>
                </CardTitle>
                {!isReportImplemented('department') && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    <Construction className="mr-1 h-3 w-3" />
                    Em desenvolvimento
                  </Badge>
                )}
              </div>
              <CardDescription>
                Análise por departamento e equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Visualize métricas específicas por departamento e equipe
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    disabled={!isReportImplemented('department')}
                    onClick={() => handleViewReport('department')}
                    className={!isReportImplemented('department') ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Visualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span>Relatórios de Clientes</span>
              </CardTitle>
              {!isReportImplemented('clients') && (
                <Badge variant="secondary" className="flex-shrink-0">
                  <Construction className="mr-1 h-3 w-3" />
                  Em desenvolvimento
                </Badge>
              )}
            </div>
            <CardDescription>
              Análise de satisfação e feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Relatórios de satisfação e análise de feedback dos clientes
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  disabled={!isReportImplemented('clients')}
                  onClick={() => handleViewReport('clients')}
                  className={!isReportImplemented('clients') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}