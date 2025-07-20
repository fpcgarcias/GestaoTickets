import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Bell, Clock, Mail, Globe, Smartphone } from 'lucide-react';

interface NotificationSettingsData {
  id: number;
  user_id: number;
  // Notificações de tickets
  new_ticket_assigned: boolean;
  ticket_status_changed: boolean;
  new_reply_received: boolean;
  ticket_escalated: boolean;
  ticket_due_soon: boolean;
  ticket_participant_added: boolean;
  ticket_participant_removed: boolean;
  // Notificações administrativas
  new_customer_registered: boolean;
  new_user_created: boolean;
  system_maintenance: boolean;
  // Preferências de entrega
  email_notifications: boolean;
  // Configurações de horário
  notification_hours_start: number;
  notification_hours_end: number;
  weekend_notifications: boolean;
  // Configurações de frequência
  digest_frequency: 'never' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

const NotificationSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<NotificationSettingsData>>({});
  const { user } = useAuth();

  // Query para buscar configurações atuais
  const { data: notificationSettings, isLoading, error } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async (): Promise<NotificationSettingsData> => {
      const response = await fetch('/api/notification-settings');
      if (!response.ok) {
        throw new Error('Erro ao carregar configurações de notificação');
      }
      return response.json();
    },
  });

  // Mutation para salvar configurações
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: Partial<NotificationSettingsData>) => {
      const response = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar configurações');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações de notificação salvas com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar estado local quando os dados chegarem
  useEffect(() => {
    if (notificationSettings) {
      setSettings(notificationSettings);
    }
  }, [notificationSettings]);

  const handleSwitchChange = (field: keyof NotificationSettingsData, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field: keyof NotificationSettingsData, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNumberChange = (field: keyof NotificationSettingsData, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setSettings(prev => ({
        ...prev,
        [field]: numValue
      }));
    }
  };

  const handleSave = () => {
    saveSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        Erro ao carregar configurações de notificação
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações contextuais baseadas na role */}
      {user?.role === 'customer' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Configurações de Notificação - Cliente</h4>
          <p className="text-sm text-blue-700">
            Configure como você deseja ser notificado sobre atualizações dos seus chamados abertos. 
            Você receberá notificações apenas sobre os chamados que você criou.
          </p>
        </div>
      )}
      
      {(user?.role === 'support' || user?.role === 'manager' || user?.role === 'supervisor') && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">
            Configurações de Notificação - {user?.role === 'support' ? 'Atendente' : 'Gestão'}
          </h4>
          <p className="text-sm text-green-700">
            Configure como você deseja ser notificado sobre atividades dos tickets{' '}
            {user?.role === 'support' ? 'atribuídos a você e do seu departamento' : 'da sua área de responsabilidade'}.
            As notificações administrativas podem ser configuradas conforme sua necessidade.
          </p>
        </div>
      )}

      {/* Tipos de Notificação - Tickets */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {user?.role === 'customer' ? 'Notificações dos Seus Chamados' : 'Notificações de Tickets'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">
                {user?.role === 'customer' ? 'Chamado Atribuído' : 'Ticket Atribuído'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer' 
                  ? 'Quando seu chamado for atribuído a um atendente'
                  : 'Quando um ticket for atribuído a você'
                }
              </p>
            </div>
            <Switch
              checked={settings.new_ticket_assigned ?? true}
              onCheckedChange={(checked) => handleSwitchChange('new_ticket_assigned', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Status Alterado</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando o status dos seus chamados mudar'
                  : 'Quando o status de um ticket mudar'
                }
              </p>
            </div>
            <Switch
              checked={settings.ticket_status_changed ?? true}
              onCheckedChange={(checked) => handleSwitchChange('ticket_status_changed', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Nova Resposta</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando um atendente responder seus chamados'
                  : 'Quando uma nova resposta for adicionada'
                }
              </p>
            </div>
            <Switch
              checked={settings.new_reply_received ?? true}
              onCheckedChange={(checked) => handleSwitchChange('new_reply_received', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">
                {user?.role === 'customer' ? 'Chamado Escalado' : 'Ticket Escalado'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando seus chamados forem escalados'
                  : 'Quando um ticket for escalado'
                }
              </p>
            </div>
            <Switch
              checked={settings.ticket_escalated ?? true}
              onCheckedChange={(checked) => handleSwitchChange('ticket_escalated', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Vencimento Próximo</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando seus chamados estiverem próximos do vencimento'
                  : 'Quando um ticket estiver próximo do vencimento'
                }
              </p>
            </div>
            <Switch
              checked={settings.ticket_due_soon ?? true}
              onCheckedChange={(checked) => handleSwitchChange('ticket_due_soon', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Participante Adicionado</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando você for adicionado como participante de um chamado'
                  : 'Quando você for adicionado como participante de um ticket'
                }
              </p>
            </div>
            <Switch
              checked={settings.ticket_participant_added ?? true}
              onCheckedChange={(checked) => handleSwitchChange('ticket_participant_added', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Participante Removido</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? 'Quando você for removido como participante de um chamado'
                  : 'Quando você for removido como participante de um ticket'
                }
              </p>
            </div>
            <Switch
              checked={settings.ticket_participant_removed ?? true}
              onCheckedChange={(checked) => handleSwitchChange('ticket_participant_removed', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Notificações Administrativas - apenas para não-clientes */}
      {user?.role !== 'customer' && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Notificações Administrativas</h3>
              <Badge variant="secondary" className="text-xs">
                {user?.role === 'support' ? 'Atendente' : 'Gerencial'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">Novo Cliente</Label>
                  <p className="text-sm text-muted-foreground">Quando um novo cliente se registrar</p>
                </div>
                <Switch
                  checked={settings.new_customer_registered ?? true}
                  onCheckedChange={(checked) => handleSwitchChange('new_customer_registered', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">Novo Usuário</Label>
                  <p className="text-sm text-muted-foreground">Quando um novo usuário for criado</p>
                </div>
                <Switch
                  checked={settings.new_user_created ?? true}
                  onCheckedChange={(checked) => handleSwitchChange('new_user_created', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">Manutenção do Sistema</Label>
                  <p className="text-sm text-muted-foreground">Avisos de manutenção e atualizações</p>
                </div>
                <Switch
                  checked={settings.system_maintenance ?? true}
                  onCheckedChange={(checked) => handleSwitchChange('system_maintenance', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Canais de Entrega */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Canais de Entrega</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <div>
                <Label className="font-medium">E-mail</Label>
                <p className="text-sm text-muted-foreground">Notificações por e-mail</p>
              </div>
            </div>
            <Switch
              checked={settings.email_notifications ?? true}
              onCheckedChange={(checked) => handleSwitchChange('email_notifications', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-400" />
              <div>
                <Label className="font-medium text-gray-500">Navegador (WebPush)</Label>
                <p className="text-sm text-gray-400">Em desenvolvimento - em breve</p>
              </div>
            </div>
            <Switch
              checked={false}
              disabled={true}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Configurações de Horário */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Horários de Notificação</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="start-hour">Horário de Início</Label>
            <Select
              value={settings.notification_hours_start?.toString() || '9'}
              onValueChange={(value) => handleSelectChange('notification_hours_start', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {i.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="end-hour">Horário de Fim</Label>
            <Select
              value={settings.notification_hours_end?.toString() || '18'}
              onValueChange={(value) => handleSelectChange('notification_hours_end', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {i.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">Fins de Semana</Label>
              <p className="text-sm text-muted-foreground">Receber notificações aos fins de semana</p>
            </div>
            <Switch
              checked={settings.weekend_notifications ?? false}
              onCheckedChange={(checked) => handleSwitchChange('weekend_notifications', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Resumo por E-mail */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Resumo por E-mail</h3>
        </div>
        <div>
          <Label htmlFor="digest-frequency">Frequência do Resumo</Label>
          <Select
            value={settings.digest_frequency || 'never'}
            onValueChange={(value) => handleSelectChange('digest_frequency', value)}
          >
            <SelectTrigger className="w-full md:w-1/3">
              <SelectValue placeholder="Selecione a frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Nunca</SelectItem>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Receba um resumo das atividades por e-mail
          </p>
        </div>
      </div>

      {/* Botão Salvar */}
      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={handleSave}
          disabled={saveSettingsMutation.isPending}
          size="lg"
        >
          {saveSettingsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings; 