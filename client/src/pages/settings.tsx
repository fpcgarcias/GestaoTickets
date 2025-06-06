import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Mail, Settings as SettingsIcon, Brain, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import NotificationSettings from "@/components/notification-settings";
import EmailSettings from "@/components/email-settings";
import AdvancedNotificationSettings from "@/components/advanced-notification-settings";
import AiSettings from "@/components/ai-settings";

// Novos imports padronizados
import { StandardPage, EmptyState } from '@/components/layout/admin-page-layout';
import { SaveButton, CancelButton } from '@/components/ui/standardized-button';

interface SlaRule {
  response_time_hours?: number;
  resolution_time_hours?: number;
}

interface SlaSettingsApiResponse {
  company_id: number;
  settings: Record<string, SlaRule>; 
}

interface GeneralSettings {
  companyName: string;
  supportEmail: string;
  allowCustomerRegistration: boolean;
}

interface ApiCompany {
  id: number;
  name: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, company: userCompany, isLoading: isLoadingAuth } = useAuth();

  const [companies, setCompanies] = useState<ApiCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (user?.role === 'manager' || user?.role === 'company_admin') && userCompany?.id ? userCompany.id : undefined
  );
  const [slaResponseTimes, setSlaResponseTimes] = useState<Record<string, string>>({});
  const [slaResolutionTimes, setSlaResolutionTimes] = useState<Record<string, string>>({});

  // Buscar lista de empresas se for admin
  const { 
    data: companiesData, 
    isLoading: isLoadingCompanies, 
    isError: isErrorCompanies, 
    error: errorCompanies 
  } = useQuery<ApiCompany[], Error>({
    queryKey: ["/api/companies"],
    queryFn: async (): Promise<ApiCompany[]> => { 
      const response = await apiRequest("GET", "/api/companies");
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Falha ao buscar empresas' }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Configurar empresas
  useEffect(() => {
    if (user?.role === 'admin' && companiesData) {
      setCompanies(companiesData);
      if (!selectedCompanyId && companiesData.length > 0) {
        setSelectedCompanyId(companiesData[0].id);
      }
    } else if ((user?.role === 'manager' || user?.role === 'company_admin') && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
    }
  }, [companiesData, user?.role, userCompany, selectedCompanyId]);

  // Carregar configurações de SLA
  const slaQueryEnabled = (!isLoadingAuth && user?.role === 'admin' && !!selectedCompanyId) || 
                        (!isLoadingAuth && (user?.role === 'manager' || user?.role === 'company_admin') && !!userCompany?.id);
  
  const { 
    data: slaSettingsData, 
    isLoading: isLoadingSla, 
    refetch: refetchSlaSettings, 
    isError: isErrorSla, 
    error: errorSla 
  } = useQuery<SlaSettingsApiResponse, Error>({
    queryKey: ["/api/settings/sla", selectedCompanyId],
    queryFn: async (): Promise<SlaSettingsApiResponse> => {
      let endpoint = '/api/settings/sla';
      if (user?.role === 'admin' && selectedCompanyId) {
        endpoint = `/api/settings/sla?company_id=${selectedCompanyId}`;
      }
      
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao buscar config. SLA' }));
        throw new Error(errorData.message || 'Falha ao buscar config. SLA');
      }
      return response.json();
    },
    enabled: slaQueryEnabled,
  });

  useEffect(() => {
    if (slaSettingsData?.settings) {
      const newResponseTimes: Record<string, string> = {};
      const newResolutionTimes: Record<string, string> = {};
      Object.keys(slaSettingsData.settings).forEach(priority => {
        newResponseTimes[priority] = slaSettingsData.settings[priority]?.response_time_hours?.toString() || "";
        newResolutionTimes[priority] = slaSettingsData.settings[priority]?.resolution_time_hours?.toString() || "";
      });
      setSlaResponseTimes(newResponseTimes);
      setSlaResolutionTimes(newResolutionTimes);
    }
  }, [slaSettingsData]);

  // Mutação para salvar configurações SLA
  const saveSlaSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      let endpoint = '/api/settings/sla';
      if (user?.role === 'admin' && selectedCompanyId) {
        endpoint = `/api/settings/sla?company_id=${selectedCompanyId}`;
      }
      
      const response = await apiRequest('PUT', endpoint, data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao salvar configurações SLA' }));
        throw new Error(errorData.message || 'Falha ao salvar configurações SLA');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "SLA atualizado", description: "Configurações de SLA foram salvas com sucesso." });
      refetchSlaSettings();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar SLA", description: error.message, variant: "destructive" });
    },
  });

  const handleSlaInputChange = (priority: string, type: 'response' | 'resolution', value: string) => {
    if (type === 'response') {
      setSlaResponseTimes(prev => ({ ...prev, [priority]: value }));
    } else {
      setSlaResolutionTimes(prev => ({ ...prev, [priority]: value }));
    }
  };

  const handleSaveSlaSettings = () => {
    const settings: Record<string, SlaRule> = {};
    
    const allPriorities = new Set([
      ...Object.keys(slaResponseTimes),
      ...Object.keys(slaResolutionTimes)
    ]);
    
    allPriorities.forEach(priority => {
      settings[priority] = {};
      
      if (slaResponseTimes[priority] && !isNaN(Number(slaResponseTimes[priority]))) {
        settings[priority].response_time_hours = Number(slaResponseTimes[priority]);
      }
      
      if (slaResolutionTimes[priority] && !isNaN(Number(slaResolutionTimes[priority]))) {
        settings[priority].resolution_time_hours = Number(slaResolutionTimes[priority]);
      }
    });

    saveSlaSettingsMutation.mutate({ settings });
  };

  // Estados de erro
  if (isErrorCompanies && errorCompanies) {
    return (
      <StandardPage
        icon={SettingsIcon}
        title="Configurações"
        description="Configure as preferências do sistema"
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar configurações</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {errorCompanies.message}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  if (isLoadingAuth || !user) {
    return (
      <StandardPage
        icon={SettingsIcon}
        title="Configurações"
        description="Configure as preferências do sistema"
        isLoading={true}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Carregando configurações...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      icon={SettingsIcon}
      title="Configurações"
      description="Configure as preferências e ajustes do sistema"
      isLoading={isLoadingSla && isLoadingCompanies}
    >
      <Tabs defaultValue="sla" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
          <TabsTrigger value="ai">Inteligência Artificial</TabsTrigger>
        </TabsList>

        {/* Tab SLA */}
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de SLA</CardTitle>
              <CardDescription>
                Configure os tempos de resposta e resolução para diferentes prioridades de chamados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Seletor de empresa para admin */}
              {user?.role === 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="company-select">Empresa</Label>
                  <Select
                    value={selectedCompanyId?.toString() || ""}
                    onValueChange={(value) => setSelectedCompanyId(Number(value))}
                  >
                    <SelectTrigger id="company-select">
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Configurações SLA por prioridade */}
              <div className="grid gap-6">
                {['low', 'medium', 'high', 'critical'].map((priority) => (
                  <div key={priority} className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium capitalize text-lg">
                      Prioridade {priority === 'low' ? 'Baixa' : priority === 'medium' ? 'Média' : priority === 'high' ? 'Alta' : 'Crítica'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`response-${priority}`}>
                          Tempo de Resposta (horas)
                        </Label>
                        <Input
                          id={`response-${priority}`}
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Ex: 2"
                          value={slaResponseTimes[priority] || ''}
                          onChange={(e) => handleSlaInputChange(priority, 'response', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`resolution-${priority}`}>
                          Tempo de Resolução (horas)
                        </Label>
                        <Input
                          id={`resolution-${priority}`}
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Ex: 24"
                          value={slaResolutionTimes[priority] || ''}
                          onChange={(e) => handleSlaInputChange(priority, 'resolution', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <SaveButton
                  onClick={handleSaveSlaSettings}
                  loading={saveSlaSettingsMutation.isPending}
                  text="Salvar Configurações SLA"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Notificações */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Configure as preferências de notificações do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Email */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Email</CardTitle>
              <CardDescription>
                Configure as preferências de envio de emails.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Avançado */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Avançadas</CardTitle>
              <CardDescription>
                Configurações avançadas de notificações e sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdvancedNotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab AI */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>Inteligência Artificial</CardTitle>
              <CardDescription>
                Configure as funcionalidades de IA do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StandardPage>
  );
}

