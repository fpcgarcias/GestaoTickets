import { db } from '../db';
import { systemSettings, emailTemplates, type EmailTemplate, type InsertEmailTemplate } from '@shared/schema';
import { eq, and, or, isNull, not, like } from 'drizzle-orm';

// Interface para configurações SMTP
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

// Interface para configurações de API (Brevo, SendGrid, etc.)
export interface APIConfig {
  provider: 'brevo' | 'sendgrid' | 'mailgun';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

// Interface para receber dados do frontend
export interface SMTPConfigInput {
  provider: 'smtp' | 'brevo' | 'sendgrid' | 'mailgun';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  api_key?: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
}

// Interface unificada para configurações de email
export interface EmailConfig {
  provider: 'smtp' | 'brevo' | 'sendgrid' | 'mailgun';
  enabled: boolean;
  smtp?: SMTPConfig;
  api?: APIConfig;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

class EmailConfigService {
  // Buscar configurações de email (formato do frontend)
  async getEmailConfigForFrontend(companyId?: number): Promise<SMTPConfigInput> {
    const settings = await this.getSystemSettings(companyId);
    
    console.log('[DEBUG Email Config] Carregando configurações para company:', companyId);
    console.log('[DEBUG Email Config] Configurações encontradas:', settings);
    
    const config = {
      provider: (settings.email_provider && settings.email_provider.trim() !== '' ? settings.email_provider : 'smtp') as SMTPConfigInput['provider'],
      host: settings.smtp_host || '',
      port: parseInt(settings.smtp_port || '587') || 587,
      username: settings.smtp_user || '',
      password: settings.smtp_password || '',
      api_key: settings.api_key || '',
      from_email: settings.from_email || '',
      from_name: settings.from_name || 'Sistema de Tickets',
      use_tls: settings.smtp_secure === 'true'
    };
    
    console.log('[DEBUG Email Config] Configuração retornada:', config);
    return config;
  }

  // Buscar configurações de email
  async getEmailConfig(companyId?: number): Promise<EmailConfig> {
    const settings = await this.getSystemSettings(companyId);
    
    return {
      provider: (settings.email_provider || 'smtp') as EmailConfig['provider'],
      enabled: settings.email_enabled === 'true',
      smtp: settings.email_provider === 'smtp' ? {
        host: settings.smtp_host || '',
        port: parseInt(settings.smtp_port || '587'),
        secure: settings.smtp_secure === 'true',
        user: settings.smtp_user || '',
        password: settings.smtp_password || '',
      } : undefined,
      api: settings.email_provider !== 'smtp' ? {
        provider: settings.email_provider as APIConfig['provider'],
        apiKey: settings.api_key || '',
        fromEmail: settings.from_email || '',
        fromName: settings.from_name || '',
      } : undefined,
      fromEmail: settings.from_email || '',
      fromName: settings.from_name || 'Sistema de Tickets',
      replyTo: settings.reply_to_email,
    };
  }

  // Salvar configurações de email (formato do frontend)
  async saveEmailConfigFromFrontend(config: SMTPConfigInput, companyId?: number): Promise<void> {
    // Validar campos obrigatórios básicos
    if (!config.provider || config.provider.trim() === '') {
      throw new Error('Provider é obrigatório');
    }
    
    if (!config.from_email || config.from_email.trim() === '') {
      throw new Error('Email do remetente é obrigatório');
    }

    // Validações específicas por provedor
    if (config.provider === 'smtp') {
      // Para SMTP, validar campos específicos
      if (!config.host || config.host.trim() === '') {
        throw new Error('Servidor SMTP é obrigatório para provedor SMTP');
      }
      if (!config.username || config.username.trim() === '') {
        throw new Error('Usuário SMTP é obrigatório para provedor SMTP');
      }
      if (!config.password || config.password.trim() === '') {
        throw new Error('Senha SMTP é obrigatória para provedor SMTP');
      }
    } else {
      // Para provedores de API (Brevo, SendGrid, Mailgun)
      if (!config.api_key || config.api_key.trim() === '') {
        throw new Error(`Chave da API é obrigatória para ${config.provider}`);
      }
    }

    const settingsToSave: Record<string, string> = {
      email_provider: config.provider.trim(),
      email_enabled: 'true',
      from_email: config.from_email.trim(),
      from_name: (config.from_name || 'Sistema de Tickets').trim(),
    };

    if (config.provider === 'smtp') {
      settingsToSave.smtp_host = (config.host || '').trim();
      settingsToSave.smtp_port = (config.port || 587).toString();
      settingsToSave.smtp_secure = (config.use_tls === true).toString();
      settingsToSave.smtp_user = (config.username || '').trim();
      settingsToSave.smtp_password = (config.password || '').trim();
    } else {
      // Para provedores de API, salvar apenas a chave
      if (config.api_key && config.api_key.trim() !== '') {
        settingsToSave.api_key = config.api_key.trim();
      }
    }

    // Salvar todas as configurações - garantindo que nenhum valor seja vazio
    console.log('[DEBUG Email Config] Configurações que serão salvas:', settingsToSave);
    console.log('[DEBUG Email Config] Company ID:', companyId);
    
    for (const [key, value] of Object.entries(settingsToSave)) {
      if (value !== null && value !== undefined && value !== '') {
        console.log(`[DEBUG Email Config] Salvando: ${key} = ${value} (company: ${companyId})`);
        await this.saveSystemSetting(key, value, companyId);
      }
    }
    
    console.log('[DEBUG Email Config] Todas as configurações salvas com sucesso!');
  }

  // Salvar configurações de email (formato legado)
  async saveEmailConfig(config: EmailConfig, companyId?: number): Promise<void> {
    const settingsToSave: Record<string, string> = {
      email_provider: config.provider,
      email_enabled: (config.enabled || true).toString(),
      from_email: config.fromEmail || '',
      from_name: config.fromName || '',
    };

    if (config.replyTo) {
      settingsToSave.reply_to_email = config.replyTo;
    }

    if (config.provider === 'smtp' && config.smtp) {
      settingsToSave.smtp_host = config.smtp.host || '';
      settingsToSave.smtp_port = (config.smtp.port || 587).toString();
      settingsToSave.smtp_secure = (config.smtp.secure === true).toString();
      settingsToSave.smtp_user = config.smtp.user || '';
      settingsToSave.smtp_password = config.smtp.password || '';
    }

    if (config.provider !== 'smtp' && config.api) {
      settingsToSave.api_key = config.api.apiKey || '';
    }

    // Salvar todas as configurações
    console.log('[DEBUG Email Config] Salvando configurações legadas:', settingsToSave);
    for (const [key, value] of Object.entries(settingsToSave)) {
      await this.saveSystemSetting(key, value, companyId);
    }
  }

  // Buscar templates de email
  async getEmailTemplates(companyId?: number, type?: string): Promise<EmailTemplate[]> {
    let whereCondition;
    
    if (companyId && type) {
      whereCondition = and(
        or(eq(emailTemplates.company_id, companyId), isNull(emailTemplates.company_id)),
        eq(emailTemplates.type, type as any),
        eq(emailTemplates.is_active, true)
      );
    } else if (companyId) {
      whereCondition = and(
        or(eq(emailTemplates.company_id, companyId), isNull(emailTemplates.company_id)),
        eq(emailTemplates.is_active, true)
      );
    } else if (type) {
      whereCondition = and(
        isNull(emailTemplates.company_id),
        eq(emailTemplates.type, type as any),
        eq(emailTemplates.is_active, true)
      );
    } else {
      whereCondition = and(
        isNull(emailTemplates.company_id),
        eq(emailTemplates.is_active, true)
      );
    }

    return await db
      .select()
      .from(emailTemplates)
      .where(whereCondition)
      .orderBy(emailTemplates.is_default, emailTemplates.name);
  }

  // Buscar template padrão por tipo
  async getDefaultTemplate(type: string, companyId?: number): Promise<EmailTemplate | null> {
    // Primeiro tentar template específico da empresa
    if (companyId) {
      const [companyTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.company_id, companyId),
            eq(emailTemplates.type, type as any),
            eq(emailTemplates.is_default, true),
            eq(emailTemplates.is_active, true)
          )
        )
        .limit(1);

      if (companyTemplate) return companyTemplate;
    }

    // Se não encontrar, usar template global padrão
    const [globalTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          isNull(emailTemplates.company_id),
          eq(emailTemplates.type, type as any),
          eq(emailTemplates.is_default, true),
          eq(emailTemplates.is_active, true)
        )
      )
      .limit(1);

    return globalTemplate || null;
  }

  // Salvar template de email
  async saveEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [saved] = await db
      .insert(emailTemplates)
      .values({
        ...template,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    return saved;
  }

  // Atualizar template de email
  async updateEmailTemplate(id: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | null> {
    const [updated] = await db
      .update(emailTemplates)
      .set({
        ...template,
        updated_at: new Date(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    return updated || null;
  }

  // Deletar template de email
  async deleteEmailTemplate(id: number): Promise<boolean> {
    const result = await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.id, id));

    return (result.rowCount ?? 0) > 0;
  }

  // Renderizar template com variáveis
  renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    // Substituir variáveis simples
    Object.entries(variables).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Para objetos aninhados
        Object.entries(value).forEach(([subKey, subValue]) => {
          const placeholder = `{{${key}.${subKey}}}`;
          rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(subValue || ''));
        });
      } else {
        // Para valores simples
        const placeholder = `{{${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
      }
    });

    return rendered;
  }

  // Testar conexão com servidor de email
  async testEmailConnection(config: SMTPConfigInput): Promise<{ success: boolean; message: string }> {
    try {
      if (config.provider === 'smtp') {
        // Para SMTP, testar conexão com nodemailer
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port || 587,
          secure: config.use_tls === true && config.port === 465, // true para porta 465, false para outras
          auth: {
            user: config.username,
            pass: config.password
          },
          connectionTimeout: 10000, // 10 segundos
          socketTimeout: 10000,
        });

        // Verificar a conexão
        await transporter.verify();
        return { success: true, message: 'Conexão SMTP testada com sucesso' };
        
      } else if (config.provider === 'brevo') {
        // Testar API do Brevo fazendo uma requisição para obter informações da conta
        const response = await fetch('https://api.brevo.com/v3/account', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'api-key': config.api_key || ''
          },
          signal: AbortSignal.timeout(10000) // 10 segundos timeout
        });

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, message: 'Chave da API inválida ou não autorizada' };
          } else if (response.status === 403) {
            return { success: false, message: 'Acesso negado. Verifique as permissões da chave da API' };
          } else {
            return { success: false, message: `Erro na API do Brevo: ${response.status} - ${response.statusText}` };
          }
        }

        const accountInfo = await response.json();
        return { 
          success: true, 
          message: `Conexão com Brevo bem-sucedida! Conta: ${accountInfo.email || 'Não informado'}` 
        };
        
      } else if (config.provider === 'sendgrid') {
        // Testar API do SendGrid
        const response = await fetch('https://api.sendgrid.com/v3/user/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.api_key || ''}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, message: 'Chave da API do SendGrid inválida' };
          } else {
            return { success: false, message: `Erro na API do SendGrid: ${response.status} - ${response.statusText}` };
          }
        }

        return { success: true, message: 'Conexão com SendGrid testada com sucesso' };
        
      } else if (config.provider === 'mailgun') {
        // Testar API do Mailgun
        // Nota: Mailgun requer domínio, então testamos apenas a autenticação
        const response = await fetch('https://api.mailgun.net/v3/domains', {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${config.api_key || ''}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, message: 'Chave da API do Mailgun inválida' };
          } else {
            return { success: false, message: `Erro na API do Mailgun: ${response.status} - ${response.statusText}` };
          }
        }

        return { success: true, message: 'Conexão com Mailgun testada com sucesso' };
        
      } else {
        return { success: false, message: 'Provedor de email não suportado para teste' };
      }
      
    } catch (error) {
      console.error('Erro no teste de conexão de email:', error);
      
      // Tratar erros específicos
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          return { success: false, message: 'Timeout na conexão. Verifique as configurações de rede.' };
        } else if (error.message.includes('ECONNREFUSED')) {
          return { success: false, message: 'Conexão recusada. Verifique o host e porta.' };
        } else if (error.message.includes('Invalid login')) {
          return { success: false, message: 'Credenciais inválidas. Verifique usuário e senha.' };
        } else if (error.message.includes('Certificate')) {
          return { success: false, message: 'Erro de certificado SSL. Verifique as configurações de segurança.' };
        } else {
          return { success: false, message: `Erro na conexão: ${error.message}` };
        }
      }
      
      return { 
        success: false, 
        message: 'Erro desconhecido ao testar conexão' 
      };
    }
  }

  // Métodos auxiliares privados
  private async getSystemSettings(companyId?: number): Promise<Record<string, string>> {
    console.log(`[DEBUG Email Config] Buscando configurações para empresa: ${companyId}`);
    
    let settings;
    
    if (companyId) {
      // Para empresa específica: buscar configurações específicas da empresa E globais
      settings = await db
        .select()
        .from(systemSettings)
        .where(
          or(
            // Configurações específicas da empresa
            like(systemSettings.key, `%_company_${companyId}`),
            // Configurações globais (que não pertencem a nenhuma empresa)
            and(
              not(like(systemSettings.key, '%_company_%')),
              isNull(systemSettings.company_id)
            )
          )
        );
    } else {
      // Para sistema global: buscar apenas configurações globais
      settings = await db
        .select()
        .from(systemSettings)
        .where(
          and(
            not(like(systemSettings.key, '%_company_%')),
            isNull(systemSettings.company_id)
          )
        );
    }

    console.log(`[DEBUG Email Config] Configurações encontradas no banco:`, settings.map(s => ({ 
      key: s.key, 
      value: s.value?.substring(0, 50) + (s.value?.length > 50 ? '...' : ''), 
      company_id: s.company_id 
    })));

    const result = settings.reduce((acc, setting) => {
      let originalKey = setting.key;
      
      // Se é uma configuração específica da empresa, extrair a chave original
      if (companyId && setting.key.endsWith(`_company_${companyId}`)) {
        originalKey = setting.key.replace(`_company_${companyId}`, '');
        console.log(`[DEBUG Email Config] Configuração específica da empresa: ${setting.key} -> ${originalKey}`);
      }
      
      // Apenas processar se é uma configuração válida para esta empresa
      const isGlobal = !setting.key.includes('_company_');
      const isForThisCompany = companyId && setting.key.endsWith(`_company_${companyId}`);
      
      if (isGlobal || isForThisCompany) {
        // Priorizar configurações específicas da empresa sobre globais
        if (isForThisCompany || !acc[originalKey]) {
          acc[originalKey] = setting.value;
          console.log(`[DEBUG Email Config] Adicionando configuração: ${originalKey} = ${setting.value?.substring(0, 50)}${setting.value?.length > 50 ? '...' : ''}`);
        }
      }
      
      return acc;
    }, {} as Record<string, string>);
    
    console.log(`[DEBUG Email Config] Configurações processadas para empresa ${companyId}:`, Object.keys(result));
    
    // VALIDAÇÃO CRÍTICA: Garantir que não há configurações de outras empresas
    if (companyId) {
      const hasOtherCompanyConfigs = settings.some(s => 
        s.key.includes('_company_') && 
        !s.key.endsWith(`_company_${companyId}`)
      );
      
      if (hasOtherCompanyConfigs) {
        console.error(`[DEBUG Email Config] ⚠️ ERRO CRÍTICO: Encontradas configurações de outras empresas!`);
        console.error(`[DEBUG Email Config] Configurações perigosas:`, settings.filter(s => 
          s.key.includes('_company_') && 
          !s.key.endsWith(`_company_${companyId}`)
        ));
      }
    }
    
    return result;
  }

  private async saveSystemSetting(key: string, value: string, companyId?: number): Promise<void> {
    // Validar que a chave e o valor não sejam nulos ou vazios
    if (!key || key.trim() === '') {
      throw new Error('Chave da configuração não pode estar vazia');
    }
    
    if (value === null || value === undefined) {
      throw new Error(`Valor para a configuração '${key}' não pode ser nulo`);
    }

    // Garantir que value seja sempre uma string
    const safeValue = String(value);

    // Usar o mesmo padrão do routes.ts para chaves compostas
    const compositeKey = companyId ? `${key}_company_${companyId}` : key;
    
    console.log(`[DEBUG Email Config] Salvando configuração: ${key} -> ${compositeKey} = ${safeValue}`);
    
    const whereCondition = eq(systemSettings.key, compositeKey);

    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(whereCondition);

    if (existing) {
      console.log(`[DEBUG Email Config] Atualizando configuração existente: ${compositeKey}`);
      await db
        .update(systemSettings)
        .set({ 
          value: safeValue,
          updated_at: new Date()
        })
        .where(eq(systemSettings.id, existing.id));
    } else {
      console.log(`[DEBUG Email Config] Criando nova configuração: ${compositeKey}`);
      await db
        .insert(systemSettings)
        .values({
          key: compositeKey,
          value: safeValue,
          company_id: companyId || null,
          created_at: new Date(),
          updated_at: new Date()
        });
    }
    
    console.log(`[DEBUG Email Config] Configuração ${compositeKey} salva com sucesso!`);
  }
}

export const emailConfigService = new EmailConfigService();