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
import { Plus, Loader2, Mail, Settings as SettingsIcon, Brain } from "lucide-react";
import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth'; // Importar o hook global
import NotificationSettings from "@/components/notification-settings";
import EmailSettings from "@/components/email-settings";
import AdvancedNotificationSettings from "@/components/advanced-notification-settings";
import AiSettings from "@/components/ai-settings";

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

  if (process.env.NODE_ENV !== 'production') {
    console.log("[Settings] User from global useAuth:", user);
    console.log("[Settings] Company from global useAuth:", userCompany);
    console.log("[Settings] isLoadingAuth from global useAuth:", isLoadingAuth);
  }

  // Redirecionar customers que tentarem acessar esta página
  useEffect(() => {
    if (!isLoadingAuth && user?.role === 'customer') {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar as configurações.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [isLoadingAuth, user?.role, navigate, toast]);

  const [companies, setCompanies] = useState<ApiCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (user?.role === 'manager' || user?.role === 'company_admin') && userCompany?.id ? userCompany.id : undefined
  );
  if (process.env.NODE_ENV !== 'production') {
    console.log("[Settings] Initial selectedCompanyId:", selectedCompanyId);
  }

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
      if (process.env.NODE_ENV !== 'production') {
        console.log("[Settings] Admin role and companiesData received. companiesData:", companiesData);
      }
      setCompanies(companiesData);
      if (!selectedCompanyId) { 
        if (userCompany?.id && companiesData.some(c => c.id === userCompany.id)) {
          setSelectedCompanyId(userCompany.id);
          if (process.env.NODE_ENV !== 'production') {
            console.log("[Settings] setSelectedCompanyId (admin, from userCompany.id):", userCompany.id);
          }
        } else if (companiesData.length > 0) {
          setSelectedCompanyId(companiesData[0].id);
          if (process.env.NODE_ENV !== 'production') {
            console.log("[Settings] setSelectedCompanyId (admin, from companiesData[0].id):", companiesData[0].id);
          }
        }
      }
    } else if (user?.role === 'manager' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
      if (process.env.NODE_ENV !== 'production') {
        console.log("[Settings] setSelectedCompanyId (manager, from userCompany.id):", userCompany.id);
      }
    } else if (user?.role === 'company_admin' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
      if (process.env.NODE_ENV !== 'production') {
        console.log("[Settings] setSelectedCompanyId (company_admin, from userCompany.id):", userCompany.id);
      }
    } else if (user?.role === 'support' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
      if (process.env.NODE_ENV !== 'production') {
        console.log("[Settings] setSelectedCompanyId (support, from userCompany.id):", userCompany.id);
      }
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
                        (!isLoadingAuth && user?.role === 'manager' && !!userCompany?.id) ||
                        (!isLoadingAuth && user?.role === 'supervisor' && !!userCompany?.id) ||
                        (!isLoadingAuth && user?.role === 'company_admin' && !!userCompany?.id) ||
                        (!isLoadingAuth && user?.role === 'support' && !!userCompany?.id);
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      "[Settings] slaQueryEnabled:", slaQueryEnabled, 
      "isLoadingAuth:", isLoadingAuth,
      "user.role:", user?.role, 
      "selectedCompanyId:", selectedCompanyId, 
      "userCompany.id:", userCompany?.id
    );
  }
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
      } else if (user?.role === 'supervisor' && userCompany?.id) {
        endpoint = '/api/settings/sla';
      } else if (user?.role === 'company_admin' && userCompany?.id) {
        endpoint = '/api/settings/sla';
      } else if (user?.role === 'support' && userCompany?.id) {
        endpoint = '/api/settings/sla';
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log("[Settings SLA Query] No valid conditions to fetch, returning empty. User Role:", user?.role, "SelectedCompanyId:", selectedCompanyId, "UserCompanyId:", userCompany?.id);
        }
        return Promise.resolve({ company_id: selectedCompanyId || userCompany?.id || 0, settings: {} }); 
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log("[Settings SLA Query] Fetching SLA with endpoint:", endpoint);
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
    enabled: !isLoadingAuth && (user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor'),
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

  const slaPriorities = [
    { key: 'low', label: 'Baixa' },
    { key: 'medium', label: 'Média' },
    { key: 'high', label: 'Alta' },
    { key: 'critical', label: 'Crítica' },
  ];

  // Impedir renderização para customers
  if (!isLoadingAuth && user?.role === 'customer') {
    return null;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">
        {user?.role === 'customer' 
          ? 'Minhas Configurações' 
          : user?.role === 'support'
          ? 'Configurações de Atendimento'
          : 'Configurações do Sistema'
        }
      </h1>
      
      <Tabs defaultValue={user?.role === 'customer' || user?.role === 'support' ? "notifications" : "general"} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          {/* Aba Geral - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="general" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Geral
            </TabsTrigger>
          )}
          
          {/* Aba Email - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="email" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Mail className="mr-2 h-4 w-4" />
              Configurações de Email
            </TabsTrigger>
          )}
          
          {/* Aba Notificações Avançadas - apenas para admin */}
          {user?.role === 'admin' && (
            <TabsTrigger value="advanced-notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Sistema de Notificações
            </TabsTrigger>
          )}
          
          {/* Aba IA - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="ai" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Brain className="mr-2 h-4 w-4" />
              IA
            </TabsTrigger>
          )}
          
          {/* Aba Notificações - para todas as roles */}
          <TabsTrigger value="notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Notificações
          </TabsTrigger>
        </TabsList>
        
        {/* Conteúdo da aba Geral - para admin, company_admin, manager e supervisor */}
        {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
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
        )}
        
        {/* Conteúdo da aba Email - para admin, company_admin, manager e supervisor */}
        {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
          <TabsContent value="email">
            <EmailSettings />
          </TabsContent>
        )}
        
        {/* Conteúdo da aba Notificações Avançadas - apenas para admin */}
        {user?.role === 'admin' && (
          <TabsContent value="advanced-notifications">
            <AdvancedNotificationSettings />
          </TabsContent>
        )}
        
        {/* Conteúdo da aba IA - para admin, company_admin, manager e supervisor */}
        {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
          <TabsContent value="ai">
            <AiSettings />
          </TabsContent>
        )}
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificação</CardTitle>
              <CardDescription>Personalize como e quando você deseja receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

