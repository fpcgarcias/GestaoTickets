import { Request, Response } from 'express';
import clicksignConfigService from '../services/clicksign-config-service';
import { ClicksignProvider } from '../services/digital-signature-service';
import https from 'https';

function resolveCompanyId(req: Request): number {
  const userRole = req.session?.userRole;
  const sessionCompanyId = req.session?.companyId;
  if (userRole === 'admin' && req.query.company_id) {
    return parseInt(req.query.company_id as string, 10);
  }
  if (sessionCompanyId) {
    return sessionCompanyId;
  }
  throw new Error('Empresa não definida na sessão.');
}

/**
 * GET /api/clicksign-config
 * Buscar configurações da ClickSign da empresa
 */
export async function getClicksignConfig(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const config = await clicksignConfigService.getConfig(companyId);

    // Retornar configurações
    // Para segurança, não retornamos os valores reais, apenas indicamos se estão configurados
    // O frontend deve manter os valores digitados localmente
    res.json({
      success: true,
      data: {
        accessToken: config.accessToken && config.accessToken.length > 0 ? '***configured***' : null,
        apiUrl: config.apiUrl,
        webhookSecret: config.webhookSecret && config.webhookSecret.length > 0 ? '***configured***' : null,
        enabled: config.enabled,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar configurações ClickSign:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

/**
 * PUT /api/clicksign-config
 * Salvar configurações da ClickSign da empresa
 */
export async function updateClicksignConfig(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const { accessToken, apiUrl, webhookSecret, enabled } = req.body;

    // Validar campos obrigatórios se enabled for true
    if (enabled && (!accessToken || (typeof accessToken === 'string' && accessToken.trim() === ''))) {
      return res.status(400).json({
        success: false,
        message: 'Access Token é obrigatório quando ClickSign está habilitado',
      });
    }

    // Sempre salvar os valores fornecidos (mesmo strings vazias para permitir limpar)
    // Se vier undefined, converter para string vazia
    const configToSave = {
      accessToken: accessToken !== undefined ? String(accessToken) : '',
      apiUrl: apiUrl !== undefined ? String(apiUrl) : 'https://sandbox.clicksign.com',
      webhookSecret: webhookSecret !== undefined ? String(webhookSecret) : '',
      enabled: enabled !== undefined ? Boolean(enabled) : false,
    };

    await clicksignConfigService.saveConfig(companyId, configToSave);

    res.json({ success: true, message: 'Configurações salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar configurações ClickSign:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

/**
 * POST /api/clicksign-config/test
 * Testar conexão com ClickSign
 */
export async function testClicksignConnection(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const config = await clicksignConfigService.getConfig(companyId);

    if (!config.enabled || !config.accessToken) {
      return res.status(400).json({
        success: false,
        message: 'ClickSign não está configurado ou habilitado',
      });
    }

    // Tentar fazer uma requisição simples para validar o token
    try {
      const apiUrl = config.apiUrl;
      const accessToken = config.accessToken!;
      
      // Fazer requisição GET para /api/v3/envelopes para validar o token (API v3)
      const url = new URL('/api/v3/envelopes', apiUrl);
      url.searchParams.append('access_token', accessToken);
      
      const testResult = await new Promise((resolve, reject) => {
        const options: https.RequestOptions = {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        };

        const req = https.request(url, options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            // Se não for sucesso, tratar erro
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              // Tentar parsear JSON primeiro
              try {
                const parsed = JSON.parse(body);
                const errorMsg = parsed?.message || parsed?.error || `HTTP ${res.statusCode}`;
                reject(new Error(`ClickSign API retornou erro: ${errorMsg}`));
              } catch (e) {
                // Se não for JSON, verificar se é HTML
                if (body.toLowerCase().includes('<!doctype') || body.toLowerCase().includes('<html')) {
                  reject(new Error(`ClickSign API retornou erro HTTP ${res.statusCode}. Verifique se o Access Token está correto e se a URL da API está correta (sandbox ou produção).`));
                } else {
                  reject(new Error(`ClickSign API retornou erro HTTP ${res.statusCode}: ${body.substring(0, 100)}`));
                }
              }
              return;
            }
            
            // Resposta de sucesso
            try {
              const parsed = JSON.parse(body);
              resolve(parsed);
            } catch (e) {
              reject(new Error(`Resposta da API não é um JSON válido`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Erro de conexão: ${error.message}`));
        });
        
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Timeout ao conectar com ClickSign (10s)'));
        });
        
        req.end();
      });
      
      res.json({
        success: true,
        message: 'Conexão com ClickSign estabelecida com sucesso',
        data: testResult,
      });
    } catch (error: any) {
      console.error('Erro ao testar conexão ClickSign:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Falha ao conectar com ClickSign',
      });
    }
  } catch (error) {
    console.error('Erro ao testar conexão ClickSign:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

