/**
 * Componente para gerenciar permissões de notificação push
 * Sistema de Notificações Persistentes
 */

import React from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useServiceWorker } from '@/hooks/use-service-worker';
import { useI18n } from '@/i18n';

export interface PushNotificationManagerProps {
  className?: string;
}

export function PushNotificationManager({ className }: PushNotificationManagerProps) {
  const { formatMessage } = useI18n();
  const {
    isSupported,
    isPushEnabled,
    permission,
    isLoading,
    error,
    enablePush,
    disablePush,
    requestPermission,
  } = useServiceWorker();

  const handleEnablePush = async () => {
    try {
      if (permission === 'default') {
        const newPermission = await requestPermission();
        if (newPermission !== 'granted') {
          return;
        }
      }
      
      await enablePush();
    } catch (error) {
      console.error('Erro ao habilitar push:', error);
    }
  };

  const handleDisablePush = async () => {
    try {
      await disablePush();
    } catch (error) {
      console.error('Erro ao desabilitar push:', error);
    }
  };

  // Se não suporta, não mostrar o componente
  if (!isSupported) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {formatMessage('settings.push_notifications')}
        </CardTitle>
        <CardDescription>
          {formatMessage('settings.push_notifications_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {formatMessage('settings.browser_notifications')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPushEnabled
                ? formatMessage('settings.push_enabled_description')
                : formatMessage('settings.push_disabled_description')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isPushEnabled && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            
            <Button
              variant={isPushEnabled ? "outline" : "default"}
              size="sm"
              onClick={isPushEnabled ? handleDisablePush : handleEnablePush}
              disabled={isLoading || permission === 'denied'}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPushEnabled ? (
                <>
                  <BellOff className="h-4 w-4 mr-2" />
                  {formatMessage('settings.disable_push')}
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  {formatMessage('settings.enable_push')}
                </>
              )}
            </Button>
          </div>
        </div>

        {permission === 'denied' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {formatMessage('settings.push_permission_denied')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}