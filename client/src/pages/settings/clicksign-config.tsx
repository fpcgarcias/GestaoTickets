import { useState, useEffect } from 'react';
import { useClicksignConfig, useUpdateClicksignConfig, useTestClicksignConnection } from '../../hooks/use-clicksign-config';
import { useIntl } from 'react-intl';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Loader2, CheckCircle2, XCircle, TestTube } from 'lucide-react';
import { toast } from '../../hooks/use-toast';

export default function ClicksignConfigPage() {
  const intl = useIntl();
  const { data, isLoading } = useClicksignConfig();
  const updateConfig = useUpdateClicksignConfig();
  const testConnection = useTestClicksignConnection();

  const [accessToken, setAccessToken] = useState('');
  const [apiUrl, setApiUrl] = useState('https://sandbox.clicksign.com');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar formulário quando dados carregarem (apenas uma vez)
  useEffect(() => {
    if (data?.data && !isLoading && !isInitialized) {
      // Para accessToken: se vier '***configured***', mostrar asteriscos
      if (data.data.accessToken === '***configured***') {
        setAccessToken('••••••••••••••••••••••••••••••••••••');
      } else if (data.data.accessToken) {
        setAccessToken(data.data.accessToken);
      }
      
      // API URL sempre inicializar
      setApiUrl(data.data.apiUrl || 'https://sandbox.clicksign.com');
      
      // Para webhookSecret: se vier '***configured***', mostrar asteriscos
      if (data.data.webhookSecret === '***configured***') {
        setWebhookSecret('••••••••••••••••••••••••••••••••');
      } else if (data.data.webhookSecret) {
        setWebhookSecret(data.data.webhookSecret);
      }
      
      // Enabled sempre inicializar
      setEnabled(data.data.enabled || false);
      
      setIsInitialized(true);
    }
  }, [data?.data, isLoading, isInitialized]);

  const handleSave = async () => {
    // Se o campo está vazio E já existe um valor configurado, não enviar (manter o atual)
    const hasExistingToken = data?.data?.accessToken === '***configured***';
    const hasExistingSecret = data?.data?.webhookSecret === '***configured***';
    
    // Verificar se o campo contém os asteriscos (ou seja, não foi modificado)
    const isTokenPlaceholder = accessToken === '••••••••••••••••••••••••••••••••••••';
    const isSecretPlaceholder = webhookSecret === '••••••••••••••••••••••••••••••••';
    
    // Validar se precisa de token quando habilitado
    if (enabled && !accessToken && !hasExistingToken) {
      toast({
        title: intl.formatMessage({ id: 'clicksign.config.validation.access_token_required' }),
        variant: 'destructive',
      });
      return;
    }

    try {
      // Preparar dados: se campo está vazio e já existe valor, não enviar (undefined)
      const configToSave: any = {
        apiUrl: apiUrl.trim(),
        enabled,
      };
      
      // Só enviar accessToken se foi digitado algo DIFERENTE do placeholder
      if (accessToken.trim() && !isTokenPlaceholder) {
        configToSave.accessToken = accessToken.trim();
      } else if (!hasExistingToken && !isTokenPlaceholder) {
        // Se não tem valor existente e não é placeholder, enviar vazio para limpar
        configToSave.accessToken = '';
      }
      // Se é placeholder ou está vazio mas tem valor existente, não enviar (manter o atual)
      
      // Só enviar webhookSecret se foi digitado algo DIFERENTE do placeholder
      if (webhookSecret.trim() && !isSecretPlaceholder) {
        configToSave.webhookSecret = webhookSecret.trim();
      } else if (!hasExistingSecret && !isSecretPlaceholder) {
        // Se não tem valor existente e não é placeholder, enviar vazio para limpar
        configToSave.webhookSecret = '';
      }
      // Se é placeholder ou está vazio mas tem valor existente, não enviar (manter o atual)

      await updateConfig.mutateAsync(configToSave);

      toast({
        title: intl.formatMessage({ id: 'clicksign.config.toast.saved' }),
      });
      
      // Limpar os campos de senha após salvar
      setAccessToken('');
      setWebhookSecret('');
    } catch (_error) {
      toast({
        title: intl.formatMessage({ id: 'clicksign.config.toast.error' }),
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    if (!enabled || !accessToken) {
      toast({
        title: intl.formatMessage({ id: 'clicksign.config.test_result.validation' }),
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await testConnection.mutateAsync();
      if (result.success) {
        toast({
          title: intl.formatMessage({ id: 'clicksign.config.test_result.success' }),
        });
      } else {
        toast({
          title: result.message || intl.formatMessage({ id: 'clicksign.config.test_result.error' }),
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: (error instanceof Error ? error.message : null) || intl.formatMessage({ id: 'clicksign.config.test_result.error' }),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{intl.formatMessage({ id: 'clicksign.config.title' })}</CardTitle>
          <CardDescription>
            {intl.formatMessage({ id: 'clicksign.config.description' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Habilitado/Desabilitado */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">
                {intl.formatMessage({ id: 'clicksign.config.enabled' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'clicksign.config.enabled_description' })}
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Access Token */}
          <div className="space-y-2">
            <Label htmlFor="accessToken">
              {intl.formatMessage({ id: 'clicksign.config.access_token' })}
              {enabled && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="accessToken"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={intl.formatMessage({ id: 'clicksign.config.access_token_placeholder' })}
              disabled={!enabled}
            />
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'clicksign.config.access_token_description' })}
            </p>
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="apiUrl">
              {intl.formatMessage({ id: 'clicksign.config.api_url' })}
            </Label>
            <Input
              id="apiUrl"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://sandbox.clicksign.com"
              disabled={!enabled}
            />
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'clicksign.config.api_url_description' })}
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">
              {intl.formatMessage({ id: 'clicksign.config.webhook_secret' })}
            </Label>
            <Input
              id="webhookSecret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={intl.formatMessage({ id: 'clicksign.config.webhook_secret_placeholder' })}
              disabled={!enabled}
            />
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'clicksign.config.webhook_secret_description' })}
            </p>
            <Alert className="mt-2">
              <AlertTitle className="text-xs font-semibold mb-1">Informações do Webhook</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <div><strong>URL do Webhook:</strong> <code className="bg-muted px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'}/api/webhooks/clicksign</code></div>
                <div><strong>Para desenvolvimento:</strong> Use <code className="bg-muted px-1 py-0.5 rounded">ngrok http 5173</code> e configure a URL gerada na ClickSign</div>
                <div><strong>Eventos a ativar:</strong> <code className="bg-muted px-1 py-0.5 rounded">envelope.finished</code> e <code className="bg-muted px-1 py-0.5 rounded">envelope.signed</code></div>
              </AlertDescription>
            </Alert>
          </div>

          {/* Botões */}
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {intl.formatMessage({ id: 'clicksign.config.saving' })}
                </>
              ) : (
                intl.formatMessage({ id: 'clicksign.config.save' })
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testConnection.isPending || !enabled || !accessToken}
            >
              {testConnection.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {intl.formatMessage({ id: 'clicksign.config.testing' })}
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  {intl.formatMessage({ id: 'clicksign.config.test' })}
                </>
              )}
            </Button>
          </div>

          {/* Resultado do teste */}
          {testConnection.data && (
            <Alert variant={testConnection.data.success ? 'default' : 'destructive'}>
              {testConnection.data.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {testConnection.data.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

