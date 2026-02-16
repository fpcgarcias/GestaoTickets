import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, Settings as SettingsIcon, Brain, FileSignature, X } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth'; // Importar o hook global
import { useI18n } from '@/i18n';
import NotificationSettings from "@/components/notification-settings";
import EmailSettings from "@/components/email-settings";
import AdvancedNotificationSettings from "@/components/advanced-notification-settings";
import AiSettings from "@/components/ai-settings";
import ClicksignConfigPage from "./settings/clicksign-config";
import { PushNotificationManager } from "@/components/notifications/push-notification-manager";

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
  logo_base64?: string | null;
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
  const { formatMessage } = useI18n();

  // Redirecionar customers que tentarem acessar esta página
  useEffect(() => {
    if (!isLoadingAuth && user?.role === 'customer') {
      toast({
        title: formatMessage('settings.access_denied'),
        description: formatMessage('settings.access_denied_description'),
        variant: "destructive",
      });
      navigate('/');
    }
  }, [isLoadingAuth, user?.role, navigate, toast]);

  const [, setCompanies] = useState<ApiCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (user?.role === 'manager' || user?.role === 'company_admin') && userCompany?.id ? userCompany.id : undefined
  );

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
    isError: isErrorCompanies, 
    error: errorCompanies 
  } = useQuery<ApiCompany[], Error>({
    queryKey: ["/api/companies"],
    queryFn: async (): Promise<ApiCompany[]> => { 
      const response = await apiRequest("GET", "/api/companies");
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: formatMessage('settings.error_fetching_companies') }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  useEffect(() => {
    if (user?.role === 'admin' && companiesData) {
      setCompanies(companiesData);
      if (!selectedCompanyId) { 
        if (userCompany?.id && companiesData.some(c => c.id === userCompany.id)) {
          setSelectedCompanyId(userCompany.id);
        } else if (companiesData.length > 0) {
          setSelectedCompanyId(companiesData[0].id);
        }
      }
    } else if (user?.role === 'manager' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
    } else if (user?.role === 'company_admin' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
    } else if (user?.role === 'support' && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
    }
  }, [companiesData, user?.role, userCompany, selectedCompanyId]);

  useEffect(() => {
    if (isErrorCompanies && errorCompanies) {
      toast({ title: formatMessage('settings.companies_error'), description: errorCompanies.message, variant: "destructive" });
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
  const { 
    refetch: refetchSlaSettings 
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
        return Promise.resolve({ company_id: selectedCompanyId || userCompany?.id || 0, settings: {} }); 
      }
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: formatMessage('settings.error_fetching_sla') }));
        throw new Error(errorData.message || formatMessage('settings.error_fetching_sla'));
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
        const errorBody = await response.json().catch(() => ({ message: formatMessage('settings.error_fetching_general') }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
    enabled: !isLoadingAuth && (user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor'),
  });

  useEffect(() => {
    if (isErrorGeneral && errorGeneral) {
      toast({ title: formatMessage('settings.general_config_error'), description: errorGeneral.message, variant: "destructive" });
    }
  }, [isErrorGeneral, errorGeneral, toast]);

  // Estados para formulário geral (mantidos como estavam)
  const [companyName, setCompanyName] = useState<string>("");
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [allowCustomerRegistration, setAllowCustomerRegistration] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  React.useEffect(() => {
    if (generalSettingsData) {
      setCompanyName(generalSettingsData.companyName || "");
      setSupportEmail(generalSettingsData.supportEmail || "");
      setAllowCustomerRegistration(generalSettingsData.allowCustomerRegistration === undefined ? true : generalSettingsData.allowCustomerRegistration);
      setLogoBase64(generalSettingsData.logo_base64 || null);
      setLogoPreview(generalSettingsData.logo_base64 || null);
    }
  }, [generalSettingsData]);

  // Mutação para salvar configurações de SLA
  const _saveSlaSettingsMutation = useMutation<
    SlaSettingsApiResponse, 
    Error, 
    { company_id?: number; settings: Record<string, SlaRule>; }
  >({
    mutationFn: async (payload) => {
      const response = await apiRequest("POST", "/api/settings/sla", payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: formatMessage('settings.error_saving_sla') }));
        throw new Error(errorData.message || formatMessage('settings.error_saving_sla'));
      }
      return response.json(); 
    },
    onSuccess: () => {
      toast({ title: formatMessage('settings.success'), description: formatMessage('settings.sla_settings_saved') });
      refetchSlaSettings();
    },
    onError: (error: Error) => {
      toast({ title: formatMessage('settings.error_saving_sla_title'), description: error.message, variant: "destructive" });
    },
  });

  // Mutação para salvar configurações gerais
  const saveGeneralSettingsMutation = useMutation<
    GeneralSettings, 
    Error,
    GeneralSettings
   >({
    mutationFn: async (data: GeneralSettings): Promise<GeneralSettings> => {
      const response = await apiRequest("POST", "/api/settings/general", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: formatMessage('settings.error_saving_general') }));
        throw new Error(errorData.message || formatMessage('settings.error_saving_general'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('settings.success'),
        description: formatMessage('settings.general_settings_saved'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/general"] });
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('settings.general_config_error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const _slaPriorities = [
    { key: 'low', label: formatMessage('settings.low') },
    { key: 'medium', label: formatMessage('settings.medium') },
    { key: 'high', label: formatMessage('settings.high') },
    { key: 'critical', label: formatMessage('settings.critical') },
  ];

  // Handler para salvar configurações gerais
  const handleSaveGeneralSettings = () => {
    saveGeneralSettingsMutation.mutate({
      companyName,
      supportEmail,
      allowCustomerRegistration,
      logo_base64: logoBase64,
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: formatMessage('settings.error'),
        description: "Por favor, selecione uma imagem (JPG, PNG, SVG ou WEBP).",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: formatMessage('settings.error'),
        description: "O logotipo deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoBase64(base64String);
      setLogoPreview(base64String);
    };
    reader.onerror = () => {
      toast({
        title: formatMessage('settings.error'),
        description: "Não foi possível ler o arquivo selecionado.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoBase64(null);
    setLogoPreview(null);
  };

  // Impedir renderização para customers
  if (!isLoadingAuth && user?.role === 'customer') {
    return null;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">
        {user?.role === 'customer' 
          ? formatMessage('settings.my_settings')
          : user?.role === 'support'
          ? formatMessage('settings.support_settings')
          : formatMessage('settings.system_settings')
        }
      </h1>
      
      <Tabs defaultValue={user?.role === 'customer' || user?.role === 'support' ? "notifications" : "general"} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          {/* Aba Geral - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="general" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              {formatMessage('settings.general')}
            </TabsTrigger>
          )}
          
          {/* Aba Email - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="email" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Mail className="mr-2 h-4 w-4" />
              {formatMessage('settings.email_settings')}
            </TabsTrigger>
          )}
          
          {/* Aba Notificações Avançadas - apenas para admin */}
          {user?.role === 'admin' && (
            <TabsTrigger value="advanced-notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <SettingsIcon className="mr-2 h-4 w-4" />
              {formatMessage('settings.notification_system')}
            </TabsTrigger>
          )}
          
          {/* Aba IA - para admin, company_admin, manager e supervisor */}
          {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
            <TabsTrigger value="ai" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Brain className="mr-2 h-4 w-4" />
              {formatMessage('settings.ai')}
            </TabsTrigger>
          )}
          
          {/* Aba ClickSign - para company_admin */}
          {user?.role === 'company_admin' && (
            <TabsTrigger value="clicksign" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              <FileSignature className="mr-2 h-4 w-4" />
              {formatMessage('clicksign.config.title')}
            </TabsTrigger>
          )}
          
          {/* Aba Notificações - para todas as roles */}
          <TabsTrigger value="notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            {formatMessage('settings.notifications')}
          </TabsTrigger>
        </TabsList>
        
        {/* Conteúdo da aba Geral - para admin, company_admin, manager e supervisor */}
        {(user?.role === 'admin' || user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') && (
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{formatMessage('settings.general_settings')}</CardTitle>
                <CardDescription>{formatMessage('settings.general_settings_description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="company-name">{formatMessage('settings.company_name')}</Label>
                    <Input 
                      id="company-name" 
                      value={companyName} 
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="support-email">{formatMessage('settings.support_email')}</Label>
                    <Input 
                      id="support-email" 
                      value={supportEmail} 
                      onChange={(e) => setSupportEmail(e.target.value)}
                      type="email" 
                      disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="logo">Logotipo da Empresa</Label>
                    {logoPreview && (
                      <div className="relative inline-block mt-2 mb-2">
                        <img 
                          src={logoPreview} 
                          alt="Preview do logotipo" 
                          className="max-w-[150px] max-h-[80px] object-contain border rounded p-2 bg-gray-50"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={handleRemoveLogo}
                          disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="logo"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/svg+xml,image/webp"
                      onChange={handleLogoChange}
                      className="cursor-pointer mt-2"
                      disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: JPG, PNG, SVG, WEBP (máx. 5MB)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <h3 className="font-medium">{formatMessage('settings.allow_customer_registration')}</h3>
                    <p className="text-sm text-neutral-500">{formatMessage('settings.allow_customer_registration_description')}</p>
                  </div>
                  <Switch 
                    checked={allowCustomerRegistration} 
                    onCheckedChange={setAllowCustomerRegistration}
                    disabled={isLoadingGeneral || saveGeneralSettingsMutation.isPending}
                  />
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium">{formatMessage('settings.department_ticket_management')}</h3>
                  <p className="text-sm text-neutral-500 mt-1 mb-3">
                    {formatMessage('settings.department_ticket_management_description')}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <Button variant="outline" asChild>
                      <Link href="/departments">{formatMessage('settings.manage_departments')}</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/ticket-types">{formatMessage('settings.manage_ticket_types')}</Link>
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
                        {formatMessage('settings.saving')}
                      </>
                    ) : (
                      formatMessage('settings.save_settings')
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
        
        {/* Conteúdo da aba ClickSign - apenas para company_admin */}
        {user?.role === 'company_admin' && (
          <TabsContent value="clicksign">
            <ClicksignConfigPage />
          </TabsContent>
        )}
        
        <TabsContent value="notifications">
          <div className="space-y-6">
            <PushNotificationManager />
            
            <Card>
              <CardHeader>
                <CardTitle>{formatMessage('settings.notification_settings')}</CardTitle>
                <CardDescription>{formatMessage('settings.notification_settings_description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <NotificationSettings />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

