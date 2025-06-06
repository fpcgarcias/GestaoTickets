import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, Settings, Building2, Shield, Key, AlertCircle, Check } from "lucide-react";

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { SaveButton, CancelButton } from '@/components/ui/standardized-button';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Handlers padronizados
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Buscar todas as empresas com suas permissões - usando fetch direto
  const { data: companies = [], isLoading: loadingCompanies, error } = useQuery<CompanyPermissions[]>({
    queryKey: ["companies-permissions"],
    queryFn: async () => {
      console.log("🔍 Buscando empresas...");
      const response = await fetch("/api/companies-permissions");
      
      if (!response.ok) {
        console.error("❌ Erro na resposta:", response.status, response.statusText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Dados recebidos:", data);
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
      
      console.log(`🔍 Buscando detalhes da empresa ${selectedCompanyId}...`);
      const response = await fetch(`/api/company-permissions/${selectedCompanyId}`);
      
      if (!response.ok) {
        console.error("❌ Erro na resposta:", response.status, response.statusText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Detalhes recebidos:", data);
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  // Mutation para atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ companyId, ai_enabled }: { companyId: number; ai_enabled: boolean }) => {
      console.log(`🔄 Atualizando permissões da empresa ${companyId}:`, { ai_enabled });
      
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
        title: "Permissões atualizadas",
        description: "As permissões foram atualizadas com sucesso!",
      });
      // Invalidar queries para recarregar dados
      queryClient.invalidateQueries({ queryKey: ["companies-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["company-permissions", selectedCompanyId] });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao atualizar permissões:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Falha ao atualizar permissões",
        variant: "destructive",
      });
    },
  });

  const handlePermissionToggle = async (companyId: number, permission: string, value: boolean) => {
    if (permission === 'ai_enabled') {
      await updatePermissionsMutation.mutateAsync({ companyId, ai_enabled: value });
    }
  };

  // Filtrar empresas pela busca
  const filteredCompanies = companies?.filter(company => 
    company.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Debug: mostrar erro se houver
  if (error) {
    console.error("❌ Erro capturado:", error);
    return (
      <StandardPage
        icon={Shield}
        title="Permissões do Sistema"
        description="Gerencie as permissões e funcionalidades das empresas"
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Buscar empresas..."
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {error instanceof Error ? error.message : 'Ocorreu um erro inesperado'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  // Estado vazio quando não há empresas
  if (filteredCompanies && filteredCompanies.length === 0 && !loadingCompanies && !searchQuery) {
          return (
        <StandardPage
          icon={Shield}
          title="Permissões do Sistema"
          description="Gerencie as permissões e funcionalidades das empresas"
          onSearchChange={handleSearchChange}
          searchValue={searchQuery}
          searchPlaceholder="Buscar empresas..."
        >
          <EmptyState
          icon={Building2}
          title="Nenhuma empresa encontrada"
          description="Não há empresas cadastradas no sistema para gerenciar permissões."
        />
      </StandardPage>
    );
  }

      return (
      <StandardPage
        icon={Shield}
        title="Permissões do Sistema"
        description="Gerencie as permissões e funcionalidades disponíveis para cada empresa"
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Buscar empresas..."
        isLoading={loadingCompanies}
      >
      {filteredCompanies && filteredCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa encontrada"
          description={`Não foram encontradas empresas com o termo "${searchQuery}".`}
          actionLabel="Limpar busca"
          onAction={() => setSearchQuery('')}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista de Empresas */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Empresas ({filteredCompanies?.length || 0})
                </CardTitle>
                <CardDescription>
                  Selecione uma empresa para gerenciar suas permissões
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredCompanies && filteredCompanies.length > 0 ? (
                  <div className="space-y-3">
                    {filteredCompanies.map((company) => (
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
                              <StatusBadge isActive={company.active} />
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
                    <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
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
                    <Key className="h-5 w-5" />
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
                            <Check className="h-5 w-5 text-green-600 mt-0.5" />
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

                      {/* Área de ações */}
                      <div className="flex items-center justify-end pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                          {updatePermissionsMutation.isPending ? (
                            "Salvando mudanças..."
                          ) : (
                            "As alterações são salvas automaticamente"
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Erro ao carregar detalhes</h3>
                      <p className="text-muted-foreground">
                        Não foi possível carregar os detalhes da empresa selecionada.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Selecione uma empresa</h3>
                  <p className="text-muted-foreground">
                    Escolha uma empresa na lista ao lado para gerenciar suas permissões
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </StandardPage>
  );
} 