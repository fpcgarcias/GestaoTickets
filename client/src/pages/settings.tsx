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
import { Plus, Loader2 } from "lucide-react";
import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth'; // Importar o hook global

// A interface User local pode ser removida se a do hook global for suficiente.
// A interface Company local pode ser removida.

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

// Interface para as empresas buscadas pela API (para o select do admin)
interface ApiCompany {
  id: number;
  name: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, company: userCompany, isLoading: isLoadingAuth } = useAuth(); // Usar o hook de autenticação global

  console.log("[Settings] User from global useAuth:", user);
  console.log("[Settings] Company from global useAuth:", userCompany);
  console.log("[Settings] isLoadingAuth from global useAuth:", isLoadingAuth);

  const [companies, setCompanies] = useState<ApiCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    user?.role === 'manager' && userCompany?.id ? userCompany.id : undefined
  );
  console.log("[Settings] Initial selectedCompanyId:", selectedCompanyId);
  const [slaResponseTimes, setSlaResponseTimes] = useState<Record<string, string>>({});
  const [slaResolutionTimes, setSlaResolutionTimes] = useState<Record<string, string>>({});

  // useEffect(() => {
  //   if (hash === 'departments') {
  //     navigate('/departments');
  //   } else if (hash === 'ticket-types') {
  //     navigate('/ticket-types');
  //   }
  // }, [hash, navigate]);

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

  useEffect(() => {
    if (user?.role === 'admin' && companiesData) {
      console.log("[Settings] Admin role and companiesData received. companiesData:", companiesData);
      setCompanies(companiesData);
      if (!selectedCompanyId) { 
        if (userCompany?.id && companiesData.some(c => c.id === userCompany.id)) {
          setSelectedCompanyId(userCompany.id);
          console.log("[Settings] setSelectedCompanyId (admin, from userCompany.id):", userCompany.id);
        } else if (companiesData.length > 0) {
          setSelectedCompanyId(companiesData[0].id);
          console.log("[Settings] setSelectedCompanyId (admin, from companiesData[0].id):", companiesData[0].id);
        }
      }
    } else if (user?.role === 'manager' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
      console.log("[Settings] setSelectedCompanyId (manager, from userCompany.id):", userCompany.id);
    }
  }, [companiesData, user?.role, userCompany, selectedCompanyId]);

  useEffect(() => {
    if (isErrorCompanies && errorCompanies) {
      toast({ title: "Erro Empresas", description: errorCompanies.message, variant: "destructive" });
    }
  }, [isErrorCompanies, errorCompanies, toast]);
  
  // Carregar configurações de SLA
  // A queryKey agora inclui selectedCompanyId para re-buscar quando ele mudar.
  // A função queryFn constrói a URL dinamicamente.
  // enabled garante que a query só rode se houver um companyId para buscar.
  const slaQueryEnabled = (!isLoadingAuth && user?.role === 'admin' && !!selectedCompanyId) || 
                        (!isLoadingAuth && user?.role === 'manager' && !!userCompany?.id);
  console.log(
    "[Settings] slaQueryEnabled:", slaQueryEnabled, 
    "isLoadingAuth:", isLoadingAuth,
    "user.role:", user?.role, 
    "selectedCompanyId:", selectedCompanyId, 
    "userCompany.id:", userCompany?.id
  );
  const { 
    data: slaSettingsData, 
    isLoading: isLoadingSla, 
    refetch: refetchSlaSettings, 
    isError: isErrorSla, 
    error: errorSla 
  } = useQuery<SlaSettingsApiResponse, Error>({
    queryKey: ["/api/settings/sla", selectedCompanyId],
    queryFn: async (): Promise<SlaSettingsApiResponse> => {
      let endpoint: string;
      if (user?.role === 'admin' && selectedCompanyId) {
        endpoint = `/api/settings/sla?company_id=${selectedCompanyId}`;
      } else if (user?.role === 'manager' && userCompany?.id) {
        endpoint = '/api/settings/sla';
      } else {
        console.log("[Settings SLA Query] No valid conditions to fetch, returning empty. User Role:", user?.role, "SelectedCompanyId:", selectedCompanyId, "UserCompanyId:", userCompany?.id);
        return Promise.resolve({ company_id: selectedCompanyId || userCompany?.id || 0, settings: {} }); 
      }
      console.log("[Settings SLA Query] Fetching SLA with endpoint:", endpoint);
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
    if (slaSettingsData) {
      console.log("[Settings] Received slaSettingsData:", slaSettingsData);
      if (slaSettingsData.settings) {
        const newResponseTimes: Record<string, string> = {};
        const newResolutionTimes: Record<string, string> = {};
        Object.keys(slaSettingsData.settings).forEach(priority => {
          newResponseTimes[priority] = slaSettingsData.settings[priority]?.response_time_hours?.toString() || "";
          newResolutionTimes[priority] = slaSettingsData.settings[priority]?.resolution_time_hours?.toString() || "";
        });
        setSlaResponseTimes(newResponseTimes);
        setSlaResolutionTimes(newResolutionTimes);
      } else { 
        setSlaResponseTimes({});
        setSlaResolutionTimes({});
      }
    }
  }, [slaSettingsData]);

  useEffect(() => {
    if (isErrorSla && errorSla) {
      toast({ title: "Erro SLA", description: errorSla.message, variant: "destructive" });
      setSlaResponseTimes({}); 
      setSlaResolutionTimes({});
    }
  }, [isErrorSla, errorSla, toast]);

  // Carregar configurações gerais
  const { 
    data: generalSettingsData, 
    isLoading: isLoadingGeneral,
    isError: isErrorGeneral,
    error: errorGeneral 
  } = useQuery<GeneralSettings, Error>({
    queryKey: ["/api/settings/general"],
    queryFn: async (): Promise<GeneralSettings> => {
      const response = await apiRequest("GET", "/api/settings/general");
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Falha ao buscar config. gerais' }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (isErrorGeneral && errorGeneral) {
      toast({ title: "Erro Config. Gerais", description: errorGeneral.message, variant: "destructive" });
    }
  }, [isErrorGeneral, errorGeneral, toast]);

  // Estados para formulário geral (mantidos como estavam)
  const [companyName, setCompanyName] = useState<string>("");
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [allowCustomerRegistration, setAllowCustomerRegistration] = useState(true);

  React.useEffect(() => {
    if (generalSettingsData) {
      setCompanyName(generalSettingsData.companyName || "");
      setSupportEmail(generalSettingsData.supportEmail || "");
      setAllowCustomerRegistration(generalSettingsData.allowCustomerRegistration === undefined ? true : generalSettingsData.allowCustomerRegistration);
    }
  }, [generalSettingsData]);

  // Mutação para salvar configurações de SLA
  const saveSlaSettingsMutation = useMutation<
    SlaSettingsApiResponse, 
    Error, 
    { company_id?: number; settings: Record<string, SlaRule>; }
  >({
    mutationFn: async (payload) => {
      const response = await apiRequest("POST", "/api/settings/sla", payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao salvar config. SLA' }));
        throw new Error(errorData.message || 'Falha ao salvar config. SLA');
      }
      return response.json(); 
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configurações de SLA salvas!" });
      refetchSlaSettings();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao Salvar SLA", description: error.message, variant: "destructive" });
    },
  });

  // Mutação para salvar configurações gerais (mantida como estava)
  const saveGeneralSettingsMutation = useMutation<
    GeneralSettings, 
    Error,
    GeneralSettings
   >({
    mutationFn: async (data: GeneralSettings): Promise<GeneralSettings> => {
      const response = await apiRequest("POST", "/api/settings/general", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao salvar config. gerais' }));
        throw new Error(errorData.message || 'Falha ao salvar config. gerais');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações gerais salvas!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/general"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro Config. Gerais",
        description: error.message,
        variant: "destructive",
      });
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
    if ((user?.role === 'admin' && !selectedCompanyId) || (user?.role === 'manager' && !userCompany?.id)) {
      toast({ title: "Seleção Necessária", description: user?.role === 'admin' ? "Selecione uma empresa." : "Manager sem empresa associada.", variant: "destructive" });
      return;
    }

    const settingsPayload: Record<string, SlaRule> = {};
    const priorities = ['low', 'medium', 'high', 'critical'];
    let validationError = false;

    for (const priority of priorities) {
      const responseTimeStr = slaResponseTimes[priority];
      const resolutionTimeStr = slaResolutionTimes[priority];
      const rule: SlaRule = {};
      let hasResponseData = false, hasResolutionData = false;

      if (responseTimeStr !== undefined && responseTimeStr.trim() !== '') {
        const parsedResponse = parseInt(responseTimeStr, 10);
        if (!isNaN(parsedResponse) && parsedResponse >= 0) {
          rule.response_time_hours = parsedResponse; hasResponseData = true;
        } else { validationError = true; toast({ title: "Valor Inválido", description: `Tempo de resposta para ${priority} é inválido.`, variant: "destructive"}); break; }
      }

      if (resolutionTimeStr !== undefined && resolutionTimeStr.trim() !== '') {
         const parsedResolution = parseInt(resolutionTimeStr, 10);
        if (!isNaN(parsedResolution) && parsedResolution >= 0) {
          rule.resolution_time_hours = parsedResolution; hasResolutionData = true;
        } else { validationError = true; toast({ title: "Valor Inválido", description: `Tempo de resolução para ${priority} é inválido.`, variant: "destructive"}); break; }
      }
      
      if (hasResponseData && hasResolutionData) settingsPayload[priority] = rule;
      else if (!hasResponseData && !hasResolutionData) settingsPayload[priority] = { response_time_hours: undefined, resolution_time_hours: undefined }; 
      else { validationError = true; toast({ title: "Campos Incompletos", description: `Para ${priority}, preencha ambos os tempos ou deixe ambos vazios.`, variant: "destructive"}); break; }
    }

    if (validationError) return;

    const finalPayload: { company_id?: number; settings: Record<string, SlaRule>; } = { settings: settingsPayload };
    if (user?.role === 'admin' && selectedCompanyId) {
      finalPayload.company_id = selectedCompanyId;
    } else if (user?.role === 'manager' && userCompany?.id) {
      // Para manager, o company_id é implicitamente o da sua sessão, 
      // o backend deve tratar isso. Se o backend precisar explicitamente:
      // finalPayload.company_id = userCompany.id;
    }
    
    saveSlaSettingsMutation.mutate(finalPayload);
  };

  // Handler para salvar configurações gerais (mantido como estava)
  const handleSaveGeneralSettings = () => {
    saveGeneralSettingsMutation.mutate({
      companyName,
      supportEmail,
      allowCustomerRegistration,
    });
  };
  
  const slaPriorities = [
    { key: 'low', label: 'Baixa' },
    { key: 'medium', label: 'Média' },
    { key: 'high', label: 'Alta' },
    { key: 'critical', label: 'Crítica' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Configurações do Sistema</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="general" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Geral
          </TabsTrigger>
          <TabsTrigger value="sla" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Configurações de SLA
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Notificações
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Configure as configurações básicas para seu sistema de chamados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company-name">Nome da Empresa</Label>
                  <Input 
                    id="company-name" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="support-email">Email de Suporte</Label>
                  <Input 
                    id="support-email" 
                    value={supportEmail} 
                    onChange={(e) => setSupportEmail(e.target.value)}
                    type="email" 
                    disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Permitir Registro de Clientes</h3>
                  <p className="text-sm text-neutral-500">Permitir que clientes se registrem e criem suas próprias contas</p>
                </div>
                <Switch 
                  checked={allowCustomerRegistration} 
                  onCheckedChange={setAllowCustomerRegistration}
                  disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                />
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium">Gerenciamento de Departamentos e Tipos de Chamado</h3>
                <p className="text-sm text-neutral-500 mt-1 mb-3">
                  As configurações de departamentos e tipos de chamado foram movidas para páginas dedicadas, 
                  acessíveis pelo menu lateral ou pelos links abaixo:
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  <Button variant="outline" asChild>
                    <Link href="/departments">Gerenciar Departamentos</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/ticket-types">Gerenciar Tipos de Chamado</Link>
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveGeneralSettings}
                  disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                >
                  {saveGeneralSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Configurações'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de SLA</CardTitle>
              <CardDescription>Configure requisitos de tempo de resposta e resolução por prioridade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingAuth && <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Carregando usuário...</span></div>}

              {!isLoadingAuth && user?.role === 'admin' && (
                <>
                  {((): null => { 
                    console.log("[Settings] Rendering company select check: isLoadingAuth:", isLoadingAuth, "user.role:", user?.role, "isLoadingCompanies:", isLoadingCompanies, "companies state:", companies, "companiesData:", companiesData);
                    return null; 
                  })()}
                  <div className="mb-6">
                    <Label htmlFor="company-select-sla" className="mb-1 block text-sm font-medium">Empresa</Label>
                    <Select value={selectedCompanyId?.toString() ?? ''} onValueChange={(v) => setSelectedCompanyId(v ? parseInt(v) : undefined)} disabled={isLoadingCompanies}>
                      <SelectTrigger id="company-select-sla" className="w-full md:w-1/2">
                        <SelectValue placeholder={isLoadingCompanies ? "Carregando..." : "Selecione uma empresa"} />
                      </SelectTrigger>
                      <SelectContent>
                        {!isLoadingCompanies && companies.length === 0 && <SelectItem value="" disabled>Nenhuma empresa</SelectItem>}
                        {companies.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {isLoadingSla && !isLoadingAuth && <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Carregando SLA...</span></div>}
              
              {!isLoadingAuth && !isLoadingSla && !slaQueryEnabled && user?.role === 'admin' && (
                 <div className="text-center text-neutral-500 p-6 rounded-md border border-dashed">
                   Selecione uma empresa para configurar os SLAs.
                 </div>
              )}
              {!isLoadingAuth && !isLoadingSla && !slaQueryEnabled && user?.role === 'manager' && !userCompany?.id && (
                 <div className="text-center text-red-600 p-6 rounded-md border border-red-200 bg-red-50">
                   Usuário manager sem empresa associada. Não é possível configurar SLAs.
                 </div>
              )}

              {!isLoadingAuth && !isLoadingSla && slaQueryEnabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {slaPriorities.map(p => (
                      <div key={p.key} className="p-4 border rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-2">Prioridade {p.label}</h3>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor={`sla-response-${p.key}`} className="text-xs">Tempo de 1ª Resposta (h)</Label>
                            <Input id={`sla-response-${p.key}`} type="number" value={slaResponseTimes[p.key] || ''} onChange={(e) => handleSlaInputChange(p.key, 'response', e.target.value)} placeholder="Ex: 4" min="0" className="mt-1" disabled={saveSlaSettingsMutation.isPending}/>
                          </div>
                          <div>
                            <Label htmlFor={`sla-resolution-${p.key}`} className="text-xs">Tempo de Resolução (h)</Label>
                            <Input id={`sla-resolution-${p.key}`} type="number" value={slaResolutionTimes[p.key] || ''} onChange={(e) => handleSlaInputChange(p.key, 'resolution', e.target.value)} placeholder="Ex: 24" min="0" className="mt-1" disabled={saveSlaSettingsMutation.isPending}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button onClick={handleSaveSlaSettings} disabled={saveSlaSettingsMutation.isPending || isLoadingSla} size="lg">
                      {saveSlaSettingsMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Salvando...</> : 'Salvar SLAs'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
         {/* ... Conteúdo da aba Notificações ... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}

