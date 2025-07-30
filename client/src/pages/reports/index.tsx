import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3 } from 'lucide-react';

export default function ReportsIndex() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canViewDepartmentReports = ['admin', 'company_admin'].includes(user?.role || '');

  const handleViewReport = (reportType: string) => {
    setLocation(`/reports/${reportType}`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios de Chamados
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios de Performance
            </CardTitle>
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
                  onClick={() => handleViewReport('performance')}
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
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios de SLA
            </CardTitle>
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
                  onClick={() => handleViewReport('sla')}
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios por Departamento
              </CardTitle>
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
                    onClick={() => handleViewReport('department')}
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
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios de Clientes
            </CardTitle>
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
                  onClick={() => handleViewReport('clients')}
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