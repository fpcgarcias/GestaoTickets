import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Construction, BarChart3, Building2, Users, PieChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DepartmentReports() {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    setLocation('/reports');
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
              <BarChart3 className="h-6 w-6" />
              Relatórios por Departamento
              <Badge variant="secondary">
                <Construction className="mr-1 h-3 w-3" />
                Em desenvolvimento
              </Badge>
            </h1>
            <p className="text-muted-foreground">Análise por departamento e equipe</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Card de Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-orange-500" />
              Funcionalidade em Desenvolvimento
            </CardTitle>
            <CardDescription>
              Esta funcionalidade está sendo desenvolvida e estará disponível em breve
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O relatório por departamento permitirá visualizar:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Volume de chamados por departamento
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  Performance das equipes por departamento
                </li>
                <li className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-purple-500" />
                  Distribuição de carga de trabalho
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder para futuras funcionalidades */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="text-sm">Volume por Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted rounded flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="text-sm">Performance das Equipes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted rounded flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="text-sm">Distribuição de Carga</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted rounded flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 