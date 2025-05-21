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
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { Link } from 'wouter';
import { useLocation } from 'wouter';

// Definir tipos para os dados das consultas
interface SLASetting {
  id?: number; // ID pode ser opcional dependendo da resposta da API
  priority: string;
  responseTimeHours?: number; // Formato camelCase (usado no frontend)
  response_time_hours?: number; // Formato snake_case (usado no backend)
  resolutionTimeHours?: number; // Formato camelCase (usado no frontend) 
  resolution_time_hours?: number; // Formato snake_case (usado no backend)
}

interface GeneralSettings {
  companyName: string;
  supportEmail: string;
  allowCustomerRegistration: boolean;
}

export default function Settings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const url = new URL(window.location.href);
  const hash = url.hash.substring(1); // remove o # do início
  
  // Redirecionar para as novas páginas se tentar acessar as abas antigas por URL
  useEffect(() => {
    if (hash === 'departments') {
      navigate('/departments');
    } else if (hash === 'ticket-types') {
      navigate('/ticket-types');
    }
  }, [hash, navigate]);

  // Carregar configurações de SLA
  const { data: slaSettingsData, isLoading: isLoadingSla } = useQuery<SLASetting[]>({
    queryKey: ["/api/settings/sla"],
  });

  // Carregar configurações gerais
  const { data: generalSettingsData, isLoading: isLoadingGeneral } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings/general"],
  });

  // Estados para formulário de SLA
  const [lowPriority, setLowPriority] = useState<string>("");
  const [mediumPriority, setMediumPriority] = useState<string>("");
  const [highPriority, setHighPriority] = useState<string>("");
  const [criticalPriority, setCriticalPriority] = useState<string>("");
  const [slaNotifications, setSlaNotifications] = useState(true);

  // Estados para formulário geral
  const [companyName, setCompanyName] = useState<string>("");
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [allowCustomerRegistration, setAllowCustomerRegistration] = useState(true);

  // Garantir que os dados sejam tratados corretamente
  const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
  const generalSettings = generalSettingsData || { companyName: '', supportEmail: '', allowCustomerRegistration: true };

  // Atualizar estados quando os dados são carregados
  React.useEffect(() => {
    if (slaSettings.length > 0) { // Usar slaSettings que é array
      const low = slaSettings.find((s: SLASetting) => s.priority === 'low');
      const medium = slaSettings.find((s: SLASetting) => s.priority === 'medium');
      const high = slaSettings.find((s: SLASetting) => s.priority === 'high');
      const critical = slaSettings.find((s: SLASetting) => s.priority === 'critical');

      // Verificar se existe o campo camelCase ou snake_case e utilizar o que estiver disponível
      if (low) setLowPriority((low.resolutionTimeHours || low.resolution_time_hours || 0).toString());
      if (medium) setMediumPriority((medium.resolutionTimeHours || medium.resolution_time_hours || 0).toString());
      if (high) setHighPriority((high.resolutionTimeHours || high.resolution_time_hours || 0).toString());
      if (critical) setCriticalPriority((critical.resolutionTimeHours || critical.resolution_time_hours || 0).toString());
    }
  }, [slaSettings]); // Depender de slaSettings

  React.useEffect(() => {
    // Usar generalSettings que tem valor padrão
    setCompanyName(generalSettings.companyName || "");
    setSupportEmail(generalSettings.supportEmail || "");
    setAllowCustomerRegistration(generalSettings.allowCustomerRegistration || true);
  }, [generalSettings]); // Depender de generalSettings

  // Mutação para salvar configurações de SLA
  const saveSlaSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/settings/sla", data);
    },
    onSuccess: () => {
      toast({
        title: "Configurações de SLA salvas",
        description: "As configurações de SLA foram atualizadas com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sla"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutação para salvar configurações gerais
  const saveGeneralSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/settings/general", data);
    },
    onSuccess: () => {
      toast({
        title: "Configurações gerais salvas",
        description: "As configurações gerais foram atualizadas com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/general"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler para salvar configurações de SLA
  const handleSaveSlaSettings = async () => {
    const prioritySettings = [
      { 
        priority: 'low', 
        response_time_hours: 72, 
        resolution_time_hours: parseInt(lowPriority) || 120 
      },
      { 
        priority: 'medium', 
        response_time_hours: 48, 
        resolution_time_hours: parseInt(mediumPriority) || 72 
      },
      { 
        priority: 'high', 
        response_time_hours: 24, 
        resolution_time_hours: parseInt(highPriority) || 48 
      },
      { 
        priority: 'critical', 
        response_time_hours: 4, 
        resolution_time_hours: parseInt(criticalPriority) || 24 
      },
    ];

    // Salvar cada configuração de SLA em sequência e esperar cada uma ser concluída
    try {
      for (const setting of prioritySettings) {
        await saveSlaSettingsMutation.mutateAsync(setting);
      }
      
      toast({
        title: "Configurações de SLA salvas",
        description: "Todas as configurações de SLA foram atualizadas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar configurações",
        description: "Ocorreu um erro ao salvar as configurações de SLA",
        variant: "destructive",
      });
    }
  };

  // Handler para salvar configurações gerais
  const handleSaveGeneralSettings = () => {
    saveGeneralSettingsMutation.mutate({
      companyName,
      supportEmail,
      allowCustomerRegistration,
    });
  };

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
                  />
                </div>
                <div>
                  <Label htmlFor="support-email">Email de Suporte</Label>
                  <Input 
                    id="support-email" 
                    value={supportEmail} 
                    onChange={(e) => setSupportEmail(e.target.value)}
                    type="email" 
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
                  disabled={saveGeneralSettingsMutation.isPending}
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
              <CardDescription>Configure requisitos de tempo de resposta por prioridade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="low-priority">SLA Prioridade Baixa (horas)</Label>
                    <Input 
                      id="low-priority" 
                      type="number" 
                      value={lowPriority}
                      onChange={(e) => setLowPriority(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="medium-priority">SLA Prioridade Média (horas)</Label>
                    <Input 
                      id="medium-priority" 
                      type="number" 
                      value={mediumPriority}
                      onChange={(e) => setMediumPriority(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="high-priority">SLA Prioridade Alta (horas)</Label>
                    <Input 
                      id="high-priority" 
                      type="number" 
                      value={highPriority}
                      onChange={(e) => setHighPriority(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="critical-priority">SLA Prioridade Crítica (horas)</Label>
                    <Input 
                      id="critical-priority" 
                      type="number" 
                      value={criticalPriority}
                      onChange={(e) => setCriticalPriority(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Notificações de Violação de SLA</h3>
                  <p className="text-sm text-neutral-500">Enviar alertas quando os prazos de SLA estiverem prestes a ser violados</p>
                </div>
                <Switch 
                  checked={slaNotifications} 
                  onCheckedChange={setSlaNotifications}
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveSlaSettings}
                  disabled={saveSlaSettingsMutation.isPending}
                >
                  {saveSlaSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Configurações de SLA'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificação</CardTitle>
              <CardDescription>Configure quando e como as notificações são enviadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Novos Chamados</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando novos chamados são criados</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Respostas</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando os chamados recebem respostas</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Mudança de Status</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando o status do chamado muda</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações de Atribuição</h3>
                    <p className="text-sm text-neutral-500">Enviar notificações quando chamados são atribuídos</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => {
                  toast({
                    title: "Configurações de notificação salvas",
                    description: "As configurações de notificação foram atualizadas com sucesso",
                  });
                }}>
                  Salvar Configurações de Notificação
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
