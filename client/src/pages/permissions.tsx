import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, Settings, Building2, Shield } from "lucide-react";

interface CompanyPermissions {
  company_id: number;
  company_name: string;
  active: boolean;
  permissions: {
    ai_enabled: boolean;
  };
}

interface CompanyPermissionDetail {
  company_id: number;
  company_name: string;
  permissions: {
    ai_enabled: boolean;
  };
}

export default function PermissionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>();

  // Buscar todas as empresas com suas permissões - usando fetch direto
  const { data: companies = [], isLoading: loadingCompanies, error } = useQuery<CompanyPermissions[]>({
    queryKey: ["companies-permissions"],
    queryFn: async () => {
      const response = await fetch("/api/companies-permissions");
      
      if (!response.ok) {
        console.error("❌ Erro na resposta:", response.status, response.statusText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    },
    retry: 3,
    refetchOnWindowFocus: false,
  });

  // Buscar permissões de uma empresa específica
  const { data: companyDetail, isLoading: loadingDetail } = useQuery<CompanyPermissionDetail>({
    queryKey: ["company-permissions", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      
      const response = await fetch(`/api/company-permissions/${selectedCompanyId}`);
      
      if (!response.ok) {
        console.error("❌ Erro na resposta:", response.status, response.statusText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  // Mutation para atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ companyId, ai_enabled }: { companyId: number; ai_enabled: boolean }) => {
      const response = await fetch(`/api/company-permissions/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar permissões');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Permissões atualizadas com sucesso!",
      });
      // Invalidar queries para recarregar dados
      queryClient.invalidateQueries({ queryKey: ["companies-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["company-permissions", selectedCompanyId] });
    },
    onError: (error: unknown) => {
      console.error("❌ Erro ao atualizar permissões:", error);
      toast({
        title: "Erro",
        description: (error instanceof Error ? error.message : null) || "Falha ao atualizar permissões",
        variant: "destructive",
      });
    },
  });

  const handlePermissionToggle = async (companyId: number, permission: string, value: boolean) => {
    if (permission === 'ai_enabled') {
      await updatePermissionsMutation.mutateAsync({ companyId, ai_enabled: value });
    }
  };

  const getCompanyStatus = (company: CompanyPermissions) => {
    if (!company.active) return 'Inativa';
    return 'Ativa';
  };

  const getCompanyStatusVariant = (company: CompanyPermissions) => {
    if (!company.active) return 'destructive';
    return 'default';
  };

  // Debug: mostrar erro se houver
  if (error) {
    console.error("❌ Erro capturado:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Erro - Permissões do Sistema</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Erro ao Carregar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">
              Erro: {error instanceof Error ? error.message : String(error)}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Recarregar Página
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingCompanies) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Permissões do Sistema</h1>
      </div>
      
      <p className="text-muted-foreground">
        Gerencie as permissões e funcionalidades disponíveis para cada empresa.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de Empresas */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Empresas ({companies.length})
              </CardTitle>
              <CardDescription>
                Selecione uma empresa para gerenciar suas permissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              {companies.length > 0 ? (
                <div className="space-y-3">
                  {companies.map((company) => (
                    <div
                      key={company.company_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCompanyId === company.company_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedCompanyId(company.company_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{company.company_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getCompanyStatusVariant(company)} className="text-xs">
                              {getCompanyStatus(company)}
                            </Badge>
                            {company.permissions.ai_enabled && (
                              <Badge variant="outline" className="text-xs">
                                <Brain className="h-3 w-3 mr-1" />
                                IA
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-500">Nenhuma empresa encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detalhes e Permissões */}
        <div className="lg:col-span-2">
          {selectedCompanyId ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Permissões da Empresa
                </CardTitle>
                <CardDescription>
                  {companyDetail ? `Configurações para ${companyDetail.company_name}` : 'Carregando...'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : companyDetail ? (
                  <div className="space-y-6">
                    {/* Permissão de IA */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-primary" />
                          <Label htmlFor="ai-permission" className="text-base font-medium">
                            Inteligência Artificial
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Permite que a empresa utilize funcionalidades de IA para análise de tickets
                        </p>
                      </div>
                      <Switch
                        id="ai-permission"
                        checked={companyDetail.permissions.ai_enabled}
                        onCheckedChange={(checked) => 
                          handlePermissionToggle(companyDetail.company_id, 'ai_enabled', checked)
                        }
                        disabled={updatePermissionsMutation.isPending}
                      />
                    </div>

                    {/* Informações sobre o uso de IA */}
                    {companyDetail.permissions.ai_enabled && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Brain className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-green-900">IA Habilitada</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Esta empresa pode usar funcionalidades de inteligência artificial. 
                              O administrador da empresa poderá ativar/desativar o uso no painel deles.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <p className="text-gray-500">Erro ao carregar detalhes da empresa</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma empresa</h3>
                <p className="text-gray-500">
                  Escolha uma empresa na lista ao lado para gerenciar suas permissões
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 