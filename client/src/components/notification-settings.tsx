import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import { Loader2, Bell, Clock, Mail, Globe } from 'lucide-react';

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
  const { formatMessage, locale } = useI18n();

  // Função para formatar horário baseado no locale
  const formatHour = (hour: number) => {
    if (locale === 'en-US') {
      // Formato 12 horas com AM/PM
      if (hour === 0) return '12:00 AM';
      if (hour === 12) return '12:00 PM';
      if (hour < 12) return `${hour}:00 AM`;
      return `${hour - 12}:00 PM`;
    } else {
      // Formato 24 horas
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  };

  // Query para buscar configurações atuais
  const { data: notificationSettings, isLoading, error } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async (): Promise<NotificationSettingsData> => {
      const response = await fetch('/api/notification-settings');
      if (!response.ok) {
        throw new Error(formatMessage('settings.error_loading_settings'));
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
        throw new Error(formatMessage('settings.error_saving_notification_settings'));
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('settings.success'),
        description: formatMessage('settings.notification_settings_saved'),
      });
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('common.error'),
        description: formatMessage('settings.error_saving_notification_settings') + ": " + error.message,
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

  const _handleNumberChange = (field: keyof NotificationSettingsData, value: string) => {
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
        <span className="ml-2">{formatMessage('settings.loading_settings')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-6">
        {formatMessage('settings.error_loading_settings')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações contextuais baseadas na role */}
      {user?.role === 'customer' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">{formatMessage('settings.customer_notification_settings')}</h4>
          <p className="text-sm text-blue-700">
            {formatMessage('settings.customer_notification_description')}
          </p>
        </div>
      )}
      
      {(user?.role === 'support' || user?.role === 'manager' || user?.role === 'supervisor') && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">
            {user?.role === 'support' ? formatMessage('settings.support_notification_settings') : formatMessage('settings.management_notification_settings')}
          </h4>
          <p className="text-sm text-green-700">
            {user?.role === 'support' ? formatMessage('settings.support_notification_description') : formatMessage('settings.management_notification_description')}
          </p>
        </div>
      )}

      {/* Tipos de Notificação - Tickets */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {user?.role === 'customer' ? formatMessage('settings.your_ticket_notifications') : formatMessage('settings.ticket_notifications')}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">
                {user?.role === 'customer' ? formatMessage('settings.ticket_assigned_customer') : formatMessage('settings.ticket_assigned')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer' 
                  ? formatMessage('settings.ticket_assigned_customer_description')
                  : formatMessage('settings.ticket_assigned_support_description')
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
              <Label className="font-medium">{formatMessage('settings.status_changed')}</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.status_changed_customer_description')
                  : formatMessage('settings.status_changed_support_description')
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
              <Label className="font-medium">{formatMessage('settings.new_reply')}</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.new_reply_customer_description')
                  : formatMessage('settings.new_reply_support_description')
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
                {user?.role === 'customer' ? formatMessage('settings.ticket_escalated_customer') : formatMessage('settings.ticket_escalated')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.ticket_escalated_customer_description')
                  : formatMessage('settings.ticket_escalated_support_description')
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
              <Label className="font-medium">{formatMessage('settings.due_soon')}</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.due_soon_customer_description')
                  : formatMessage('settings.due_soon_support_description')
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
              <Label className="font-medium">{formatMessage('settings.participant_added')}</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.participant_added_customer_description')
                  : formatMessage('settings.participant_added_support_description')
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
              <Label className="font-medium">{formatMessage('settings.participant_removed')}</Label>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'customer'
                  ? formatMessage('settings.participant_removed_customer_description')
                  : formatMessage('settings.participant_removed_support_description')
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
              <h3 className="text-lg font-semibold">{formatMessage('settings.administrative_notifications')}</h3>
              <Badge variant="secondary" className="text-xs">
                {user?.role === 'support' ? formatMessage('settings.support_badge') : formatMessage('settings.management_badge')}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">{formatMessage('settings.new_customer')}</Label>
                  <p className="text-sm text-muted-foreground">{formatMessage('settings.new_customer_description')}</p>
                </div>
                <Switch
                  checked={settings.new_customer_registered ?? true}
                  onCheckedChange={(checked) => handleSwitchChange('new_customer_registered', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">{formatMessage('settings.new_user')}</Label>
                  <p className="text-sm text-muted-foreground">{formatMessage('settings.new_user_description')}</p>
                </div>
                <Switch
                  checked={settings.new_user_created ?? true}
                  onCheckedChange={(checked) => handleSwitchChange('new_user_created', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">{formatMessage('settings.system_maintenance')}</Label>
                  <p className="text-sm text-muted-foreground">{formatMessage('settings.system_maintenance_description')}</p>
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
          <h3 className="text-lg font-semibold">{formatMessage('settings.delivery_channels')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <div>
                <Label className="font-medium">{formatMessage('settings.email')}</Label>
                <p className="text-sm text-muted-foreground">{formatMessage('settings.email_description')}</p>
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
                <Label className="font-medium text-gray-500">{formatMessage('settings.browser_webpush')}</Label>
                <p className="text-sm text-gray-400">{formatMessage('settings.browser_webpush_description')}</p>
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
          <h3 className="text-lg font-semibold">{formatMessage('settings.notification_hours')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="start-hour">{formatMessage('settings.start_hour')}</Label>
            <Select
              value={settings.notification_hours_start?.toString() || '9'}
              onValueChange={(value) => handleSelectChange('notification_hours_start', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={formatMessage('settings.select_option')} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {formatHour(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="end-hour">{formatMessage('settings.end_hour')}</Label>
            <Select
              value={settings.notification_hours_end?.toString() || '18'}
              onValueChange={(value) => handleSelectChange('notification_hours_end', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={formatMessage('settings.select_option')} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {formatHour(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="font-medium">{formatMessage('settings.weekends')}</Label>
              <p className="text-sm text-muted-foreground">{formatMessage('settings.weekends_description')}</p>
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
          <h3 className="text-lg font-semibold">{formatMessage('settings.email_digest')}</h3>
        </div>
        <div>
          <Label htmlFor="digest-frequency">{formatMessage('settings.digest_frequency')}</Label>
          <Select
            value={settings.digest_frequency || 'never'}
            onValueChange={(value) => handleSelectChange('digest_frequency', value)}
          >
            <SelectTrigger className="w-full md:w-1/3">
              <SelectValue placeholder={formatMessage('settings.select_frequency')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">{formatMessage('settings.never')}</SelectItem>
              <SelectItem value="daily">{formatMessage('settings.daily')}</SelectItem>
              <SelectItem value="weekly">{formatMessage('settings.weekly')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage('settings.digest_frequency_description')}
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
              {formatMessage('settings.saving_notifications')}
            </>
          ) : (
            formatMessage('settings.save_notification_settings')
          )}
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings; 