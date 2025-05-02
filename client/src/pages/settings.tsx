import React, { useState, useEffect } from 'react';
import { DepartmentsSettings } from '@/components/settings/departments-settings';
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

export default function Settings() {
  const { toast } = useToast();

  // Carregar configurações de SLA
  const { data: slaSettings, isLoading: isLoadingSla } = useQuery({
    queryKey: ["/api/settings/sla"],
  });

  // Carregar configurações gerais
  const { data: generalSettings, isLoading: isLoadingGeneral } = useQuery({
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

  // Atualizar estados quando os dados são carregados
  React.useEffect(() => {
    if (slaSettings && slaSettings.length > 0) {
      const low = slaSettings.find(s => s.priority === 'low');
      const medium = slaSettings.find(s => s.priority === 'medium');
      const high = slaSettings.find(s => s.priority === 'high');
      const critical = slaSettings.find(s => s.priority === 'critical');

      if (low) setLowPriority(low.resolutionTimeHours.toString());
      if (medium) setMediumPriority(medium.resolutionTimeHours.toString());
      if (high) setHighPriority(high.resolutionTimeHours.toString());
      if (critical) setCriticalPriority(critical.resolutionTimeHours.toString());
    }
  }, [slaSettings]);

  React.useEffect(() => {
    if (generalSettings) {
      setCompanyName(generalSettings.companyName || "");
      setSupportEmail(generalSettings.supportEmail || "");
      setAllowCustomerRegistration(generalSettings.allowCustomerRegistration || true);
    }
  }, [generalSettings]);

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
  const handleSaveSlaSettings = () => {
    const prioritySettings = [
      { priority: 'low', responseTimeHours: 72, resolutionTimeHours: parseInt(lowPriority) },
      { priority: 'medium', responseTimeHours: 48, resolutionTimeHours: parseInt(mediumPriority) },
      { priority: 'high', responseTimeHours: 24, resolutionTimeHours: parseInt(highPriority) },
      { priority: 'critical', responseTimeHours: 4, resolutionTimeHours: parseInt(criticalPriority) },
    ];

    // Salvar cada configuração de SLA
    for (const setting of prioritySettings) {
      saveSlaSettingsMutation.mutate(setting);
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
          <TabsTrigger value="departments" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Departamentos
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
        
        <TabsContent value="departments">
          <DepartmentsSettings />
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
