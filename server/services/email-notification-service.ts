import { db } from '../db';
import { emailTemplates, userNotificationSettings, users, tickets, customers, officials, officialDepartments, slaDefinitions, companies, ticketParticipants, systemSettings, ticketStatusHistory, departments, satisfactionSurveys } from '@shared/schema';
import { eq, and, isNull, inArray, not, ne, or, gte } from 'drizzle-orm';
import { emailConfigService } from './email-config-service';
import nodemailer from 'nodemailer';
import { PriorityService } from "./priority-service";
import { slaService } from './sla-service';
import { 
  calculateEffectiveBusinessTime,
  convertStatusHistoryToPeriods,
  getBusinessHoursConfig,
  addBusinessTime
} from '@shared/utils/sla-calculator';
import { isSlaPaused, type TicketStatus } from '@shared/ticket-utils';

export interface EmailNotificationContext {
  ticket?: any;
  customer?: any;
  user?: any;
  official?: any;
  reply?: any;
  status_change?: {
    old_status: string;
    new_status: string;
    created_at?: Date;
    changed_by?: any;
  };
  system?: {
    maintenance_start?: Date;
    maintenance_end?: Date;
    message?: string;
    base_url?: string;
    company_name?: string;
    support_email?: string;
    custom_message?: string;
    colors?: {
      primary: string;
      primaryDark: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    from_name?: string;
    from_email?: string;
  };
  digest?: {
    type: string;
    date: Date;
    tickets: any[];
    activity_count: number;
    resolved_count?: number;
    new_count?: number;
  };
}

export class EmailNotificationService {
  
  // 🔥 NOVA FUNÇÃO: Validar se company_id é obrigatório baseado na role
  private validateCompanyIdRequired(userRole: string, companyId?: number): number | undefined {
    // Apenas admin pode ter company_id undefined/null
    if (userRole === 'admin') {
      return companyId || undefined;
    }
    
    // Para todas as outras roles, company_id é OBRIGATÓRIO
    if (!companyId) {
      console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: company_id é obrigatório para role '${userRole}', mas foi passado como undefined/null`);
      throw new Error(`company_id é obrigatório para role '${userRole}'`);
    }
    
    return companyId;
  }
  
  // Enviar email de notificação
  async sendEmailNotification(
    templateType: string,
    recipientEmail: string,
    context: EmailNotificationContext,
    companyId?: number,
    userRole?: string // 🔥 NOVO PARÂMETRO para validação
  ): Promise<{ success: boolean; error?: string }> {
    try {
      
      // 🔥 VALIDAÇÃO CRÍTICA: Verificar se company_id é obrigatório
      let validatedCompanyId: number | undefined = undefined;
      if (userRole) {
        validatedCompanyId = this.validateCompanyIdRequired(userRole, companyId);
      } else {
        // Se não temos role, assumir que company_id é obrigatório (defensivo)
        if (!companyId) {
          console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: company_id é obrigatório, mas foi passado como undefined/null`);
          return { success: false, error: 'company_id é obrigatório para envio de e-mail' };
        }
        validatedCompanyId = companyId;
      }
      
      // 1. Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(validatedCompanyId);
      
      // 2. Obter cores e configurações da empresa
      const companyColors = await this.getCompanyColors(validatedCompanyId);
      const emailConfigData = await this.getEmailConfigForCompany(validatedCompanyId);
      
      // 3. Adicionar URL base e outras informações do sistema ao contexto
      const enrichedContext: EmailNotificationContext = {
        ...context,
        ticket: await this.mapTicketFields(context.ticket),
        system: {
          ...context.system,
          base_url: baseUrl,
          company_name: context.system?.company_name || 'Ticket Wise',
          support_email: context.system?.support_email || 'suporte@ticketwise.com.br',
          // Adicionar cores e configurações da empresa
          colors: companyColors,
          from_name: emailConfigData.fromName,
          from_email: emailConfigData.fromEmail
        }
      };

      // 4. Verificar se email está configurado - CRÍTICO: APENAS PARA A EMPRESA ESPECÍFICA
      const emailConfig = await emailConfigService.getEmailConfigForFrontend(validatedCompanyId);

      // BLOQUEIO ABSOLUTO: Se qualquer campo essencial estiver vazio, NÃO ENVIA!
      if (!emailConfig || !emailConfig.from_email || !emailConfig.provider ||
          (emailConfig.provider === 'smtp' && (!emailConfig.host || !emailConfig.username || !emailConfig.password || emailConfig.port === 0)) ||
          ((emailConfig.provider === 'brevo' || emailConfig.provider === 'sendgrid' || emailConfig.provider === 'mailgun') && !emailConfig.api_key)) {
        return { success: false, error: 'Configuração de email inexistente ou incompleta para a empresa. Nenhum email enviado.' };
      }

      // 4. Buscar template
      const template = await this.getEmailTemplate(templateType, validatedCompanyId);
      if (!template) {
        return { success: false, error: `Template '${templateType}' não encontrado. Configure em Configurações > Email > Templates.` };
      }

      // 5. Renderizar template com contexto enriquecido
      const renderedSubject = this.renderTemplate(template.subject_template, enrichedContext);
      const renderedHtml = this.renderTemplate(template.html_template, enrichedContext);
      const renderedText = template.text_template ? this.renderTemplate(template.text_template, enrichedContext) : undefined;
      const finalHtml = this.ensureUtf8Html(renderedHtml);

            // 6. Configurar transporter
      try {
        const transporter = await this.createTransporter(emailConfig);

        // 7. Enviar email
        const mailOptions = {
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          to: recipientEmail,
          subject: renderedSubject,
          html: finalHtml,
          text: renderedText,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Content-Language': 'pt-BR',
          },
          textEncoding: 'quoted-printable',
        };

        const result = await transporter.sendMail(mailOptions);

        return { success: true };
      } catch (transporterError) {
        console.error(`[📧 EMAIL PROD] ❌ ERRO ao criar transporter ou enviar email:`, transporterError);
        console.error(`[📧 EMAIL PROD] Erro detalhado:`, {
          message: (transporterError as any)?.message,
          code: (transporterError as any)?.code,
          command: (transporterError as any)?.command,
          response: (transporterError as any)?.response,
          responseCode: (transporterError as any)?.responseCode
        });
        return { success: false, error: `Erro no envio: ${String(transporterError)}. Verifique as configurações de email.` };
      }

    } catch (error) {
      console.error(`[📧 EMAIL PROD] ❌ ERRO GERAL ao enviar email para ${recipientEmail}:`, error);
      console.error(`[📧 EMAIL PROD] Stack trace:`, (error as any)?.stack);
      return { success: false, error: String(error) };
    }
  }

  // Buscar template de email
  private async getEmailTemplate(templateType: string, companyId?: number) {
    try {
      console.log(`[📧 EMAIL PROD] 🔍 Buscando template '${templateType}' para empresa ${companyId}`);
      
      // Primeiro tentar buscar template específico da empresa
      if (companyId) {
        const [companyTemplate] = await db
          .select()
          .from(emailTemplates)
          .where(
            and(
              eq(emailTemplates.type, templateType as any),
              eq(emailTemplates.company_id, companyId),
              eq(emailTemplates.is_active, true)
            )
          )
          .limit(1);

        if (companyTemplate) {
          console.log(`[📧 EMAIL PROD] ✅ Template específico da empresa encontrado: ${companyTemplate.name}`);
          console.log(`[📧 EMAIL PROD] - ID: ${companyTemplate.id}`);
          console.log(`[📧 EMAIL PROD] - Tipo: ${companyTemplate.type}`);
          console.log(`[📧 EMAIL PROD] - Empresa ID: ${companyTemplate.company_id}`);
          return companyTemplate;
        } else {
          console.log(`[📧 EMAIL PROD] ⚠️  Template específico da empresa ${companyId} não encontrado`);
        }
      }

      // Se não encontrou específico da empresa, buscar template padrão (global)
      const [defaultTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.type, templateType as any),
            isNull(emailTemplates.company_id),
            eq(emailTemplates.is_active, true),
            eq(emailTemplates.is_default, true)
          )
        )
        .limit(1);

      if (defaultTemplate) {
        return defaultTemplate;
      }

      return null;
    } catch (error) {
      console.error(`[📧 EMAIL PROD] ❌ Erro ao buscar template de email:`, error);
      return null;
    }
  }

  // Renderizar template com variáveis
  private renderTemplate(template: string, context: EmailNotificationContext): string {
    if (!template || typeof template !== 'string') {
      return '';
    }

    let rendered = template;

    // Função auxiliar para formatar datas
    const formatDate = (date: any) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Função auxiliar para traduzir status
    const translateStatus = (status: string) => {
      const statusMap: Record<string, string> = {
        'new': 'Novo',
        'ongoing': 'Em Andamento',
        'resolved': 'Resolvido'
      };
      return statusMap[status] || status;
    };

    // Função auxiliar para traduzir prioridade
    const translatePriority = (priority: string) => {
      const priorityMap: Record<string, string> = {
        'low': 'Baixa',
        'medium': 'Média',
        'high': 'Alta',
        'critical': 'Crítica'
      };
      return priorityMap[priority] || priority;
    };

    // Função auxiliar para traduzir role
    const translateRole = (role: string) => {
      const roleMap: Record<string, string> = {
        'admin': 'Administrador',
        'support': 'Suporte',
        'customer': 'Cliente',
        'integration_bot': 'Bot de Integração',
        'quality': 'Qualidade',
        'triage': 'Triagem',
        'company_admin': 'Administrador da Empresa',
        'viewer': 'Visualizador',
        'supervisor': 'Supervisor',
        'manager': 'Gerente'
      };
      return roleMap[role] || role;
    };

    // 1. DADOS DO TICKET - TODAS as variáveis da lista
    if (context.ticket) {
      const ticket = context.ticket;
      
      // {{ticket.id}} - ID interno do ticket
      rendered = rendered.replace(/\{\{ticket\.id\}\}/g, String(ticket.id || ''));
      
      // {{ticket.ticket_id}} - Número do ticket (ex: TKT-2024-001)
      rendered = rendered.replace(/\{\{ticket\.ticket_id\}\}/g, String(ticket.ticket_id || ''));
      
      // {{ticket.title}} - Título do ticket
      rendered = rendered.replace(/\{\{ticket\.title\}\}/g, String(ticket.title || ''));
      
      // {{ticket.description}} - Descrição completa do ticket
      rendered = rendered.replace(/\{\{ticket\.description\}\}/g, String(ticket.description || ''));
      
      // {{ticket.status}} - Status atual (new, ongoing, resolved)
      rendered = rendered.replace(/\{\{ticket\.status\}\}/g, String(ticket.status || ''));
      
      // {{ticket.priority}} - Prioridade (low, medium, high, critical)
      rendered = rendered.replace(/\{\{ticket\.priority\}\}/g, String(ticket.priority || ''));
      
      // {{ticket.type}} - Tipo do ticket
      rendered = rendered.replace(/\{\{ticket\.type\}\}/g, String(ticket.type || ''));
      
      // {{ticket.created_at}} - Data e hora de criação
      rendered = rendered.replace(/\{\{ticket\.created_at\}\}/g, ticket.created_at ? String(ticket.created_at) : '');
      
      // {{ticket.updated_at}} - Data e hora da última atualização
      rendered = rendered.replace(/\{\{ticket\.updated_at\}\}/g, ticket.updated_at ? String(ticket.updated_at) : '');
      
      // {{ticket.resolved_at}} - Data e hora de resolução
      rendered = rendered.replace(/\{\{ticket\.resolved_at\}\}/g, ticket.resolved_at ? String(ticket.resolved_at) : '');

      // Variáveis formatadas extras (mantidas para compatibilidade)
      rendered = rendered.replace(/\{\{ticket\.created_at_formatted\}\}/g, formatDate(ticket.created_at));
      rendered = rendered.replace(/\{\{ticket\.updated_at_formatted\}\}/g, formatDate(ticket.updated_at));
      rendered = rendered.replace(/\{\{ticket\.first_response_at_formatted\}\}/g, formatDate(ticket.first_response_at));
      rendered = rendered.replace(/\{\{ticket\.resolved_at_formatted\}\}/g, formatDate(ticket.resolved_at));
      rendered = rendered.replace(/\{\{ticket\.status_text\}\}/g, translateStatus(ticket.status || ''));
      rendered = rendered.replace(/\{\{ticket\.priority_text\}\}/g, translatePriority(ticket.priority || ''));
      
      // Link do ticket (usando system.base_url)
      if (context.system?.base_url) {
        rendered = rendered.replace(/\{\{ticket\.link\}\}/g, `${context.system.base_url}/tickets/${ticket.id}`);
      }
    }

    // 2. DADOS DO CLIENTE - TODAS as variáveis da lista
    if (context.customer) {
      const customer = context.customer;
      
      // {{customer.name}} - Nome do cliente
      rendered = rendered.replace(/\{\{customer\.name\}\}/g, String(customer.name || ''));
      
      // {{customer.email}} - Email do cliente
      rendered = rendered.replace(/\{\{customer\.email\}\}/g, String(customer.email || ''));
      
      // {{customer.phone}} - Telefone do cliente
      rendered = rendered.replace(/\{\{customer\.phone\}\}/g, String(customer.phone || ''));
      
      // {{customer.company}} - Empresa do cliente
      rendered = rendered.replace(/\{\{customer\.company\}\}/g, String(customer.company || ''));
    }

    // 3. DADOS DO USUÁRIO/ATENDENTE - TODAS as variáveis da lista
    if (context.user) {
      const user = context.user;
      
      // {{user.name}} - Nome do usuário
      rendered = rendered.replace(/\{\{user\.name\}\}/g, String(user.name || ''));
      
      // {{user.email}} - Email do usuário
      rendered = rendered.replace(/\{\{user\.email\}\}/g, String(user.email || ''));
      
      // {{user.role}} - Função do usuário
      rendered = rendered.replace(/\{\{user\.role\}\}/g, String(user.role || ''));

      // Variáveis formatadas extras (mantidas para compatibilidade)
      rendered = rendered.replace(/\{\{user\.role_text\}\}/g, translateRole(user.role || ''));
    }

    // 4. DADOS DO ATENDENTE/OFICIAL (mantido para compatibilidade)
    if (context.official) {
      const official = context.official;
      
      Object.entries(official).forEach(([key, value]) => {
        const placeholder = `{{official.${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
      });

      // Variáveis formatadas do oficial
      rendered = rendered.replace(/\{\{official\.role_text\}\}/g, translateRole(official.role || ''));
    }

    // 5. DADOS DA RESPOSTA - TODAS as variáveis da lista incluindo aninhadas
    if (context.reply) {
      const reply = context.reply;
      
      // {{reply.message}} - Conteúdo da resposta
      rendered = rendered.replace(/\{\{reply\.message\}\}/g, String(reply.message || ''));
      
      // {{reply.created_at}} - Data e hora da resposta
      rendered = rendered.replace(/\{\{reply\.created_at\}\}/g, reply.created_at ? String(reply.created_at) : '');

      // Variáveis formatadas da resposta
      rendered = rendered.replace(/\{\{reply\.created_at_formatted\}\}/g, formatDate(reply.created_at));
      
      // VARIÁVEIS ANINHADAS DA RESPOSTA - {{reply.user.name}} e {{reply.user.email}}
      if (reply.user || context.user) {
        const replyUser = reply.user || context.user;
        
        // {{reply.user.name}} - Nome de quem respondeu
        rendered = rendered.replace(/\{\{reply\.user\.name\}\}/g, String(replyUser.name || ''));
        
        // {{reply.user.email}} - Email de quem respondeu
        rendered = rendered.replace(/\{\{reply\.user\.email\}\}/g, String(replyUser.email || ''));
        
        // Outras propriedades do usuário da resposta
        Object.entries(replyUser).forEach(([key, value]) => {
          if (key !== 'name' && key !== 'email') { // Já tratados acima
            const placeholder = `{{reply.user.${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
          }
        });
        
        // Variáveis formatadas do usuário da resposta
        rendered = rendered.replace(/\{\{reply\.user\.role_text\}\}/g, translateRole(replyUser.role || ''));
      }

      // Compatibilidade: reply.author_name
      if (reply.author_name) {
        rendered = rendered.replace(/\{\{reply\.author_name\}\}/g, String(reply.author_name));
      } else if (reply.user?.name) {
        rendered = rendered.replace(/\{\{reply\.author_name\}\}/g, String(reply.user.name));
      } else if (context.user?.name) {
        rendered = rendered.replace(/\{\{reply\.author_name\}\}/g, String(context.user.name));
      }
    }

    // 6. MUDANÇA DE STATUS - TODAS as variáveis da lista incluindo aninhadas
    if (context.status_change) {
      const statusChange = context.status_change;
      
      // {{status_change.old_status}} - Status anterior
      rendered = rendered.replace(/\{\{status_change\.old_status\}\}/g, String(statusChange.old_status || ''));
      
      // {{status_change.new_status}} - Novo status
      rendered = rendered.replace(/\{\{status_change\.new_status\}\}/g, String(statusChange.new_status || ''));
      
      // {{status_change.created_at}} - Data da alteração
      rendered = rendered.replace(/\{\{status_change\.created_at\}\}/g, statusChange.created_at ? String(statusChange.created_at) : '');

      // VARIÁVEIS ANINHADAS DE MUDANÇA DE STATUS - {{status_change.changed_by.name}}
      if (statusChange.changed_by || context.user) {
        const changedByUser = statusChange.changed_by || context.user;
        
        // {{status_change.changed_by.name}} - Nome de quem alterou
        rendered = rendered.replace(/\{\{status_change\.changed_by\.name\}\}/g, String(changedByUser.name || ''));
        
        // Outras propriedades do usuário que mudou o status
        Object.entries(changedByUser).forEach(([key, value]) => {
          if (key !== 'name') { // Já tratado acima
            const placeholder = `{{status_change.changed_by.${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
          }
        });
        
        // Variáveis formatadas do usuário que mudou o status
        rendered = rendered.replace(/\{\{status_change\.changed_by\.role_text\}\}/g, translateRole(changedByUser.role || ''));
      }

      // Variáveis formatadas de status (mantidas para compatibilidade)
      rendered = rendered.replace(/\{\{status_change\.old_status_text\}\}/g, translateStatus(statusChange.old_status || ''));
      rendered = rendered.replace(/\{\{status_change\.new_status_text\}\}/g, translateStatus(statusChange.new_status || ''));
      rendered = rendered.replace(/\{\{status_change\.created_at_formatted\}\}/g, formatDate(statusChange.created_at));
    }

    // 7. DADOS DO SISTEMA - TODAS as variáveis da lista
    if (context.system) {
      const system = context.system;
      
      // {{system.base_url}} - URL base do sistema
      rendered = rendered.replace(/\{\{system\.base_url\}\}/g, String(system.base_url || ''));
      
      // {{system.company_name}} - Nome da empresa
      rendered = rendered.replace(/\{\{system\.company_name\}\}/g, String(system.company_name || ''));
      
      // {{system.support_email}} - Email de suporte
      rendered = rendered.replace(/\{\{system\.support_email\}\}/g, String(system.support_email || ''));

      // {{system.from_name}} - Nome do remetente
      rendered = rendered.replace(/\{\{system\.from_name\}\}/g, String(system.from_name || 'Sistema de Tickets'));
      
      // {{system.from_email}} - Email do remetente
      rendered = rendered.replace(/\{\{system\.from_email\}\}/g, String(system.from_email || 'noreply@ticketwise.com.br'));

      // Cores da empresa
      if (system.colors) {
        rendered = rendered.replace(/\{\{system\.colors\.primary\}\}/g, system.colors.primary);
        rendered = rendered.replace(/\{\{system\.colors\.primaryDark\}\}/g, system.colors.primaryDark);
        rendered = rendered.replace(/\{\{system\.colors\.secondary\}\}/g, system.colors.secondary);
        rendered = rendered.replace(/\{\{system\.colors\.accent\}\}/g, system.colors.accent);
        rendered = rendered.replace(/\{\{system\.colors\.background\}\}/g, system.colors.background);
        rendered = rendered.replace(/\{\{system\.colors\.text\}\}/g, system.colors.text);
      }

      // Outras propriedades do sistema
      Object.entries(system).forEach(([key, value]) => {
        if (!['base_url', 'company_name', 'support_email', 'from_name', 'from_email', 'colors'].includes(key)) { // Já tratados acima
          const placeholder = `{{system.${key}}}`;
          rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
        }
      });
    }

    // 8. VARIÁVEIS GLOBAIS DE COMPATIBILIDADE (para templates antigos)
    if (context.system?.company_name) {
      rendered = rendered.replace(/\{\{company_name\}\}/g, context.system.company_name);
    }
    if (context.system?.support_email) {
      rendered = rendered.replace(/\{\{support_email\}\}/g, context.system.support_email);
    }
    if (context.system?.base_url) {
      rendered = rendered.replace(/\{\{base_url\}\}/g, context.system.base_url);
    }

    return rendered;
  }

  // Garante que o HTML tenha meta charset UTF-8 para evitar erros como "Balne�rio"
  private ensureUtf8Html(html: string | undefined): string | undefined {
    if (!html || typeof html !== 'string') return html;

    const hasCharsetMeta = /<meta[^>]*charset\s*=\s*"?utf-8"?/i.test(html);
    if (hasCharsetMeta) return html;

    // Inserir dentro de <head> se existir; caso contrário, no topo do HTML
    const meta = '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${meta}`);
    }

    // Se não houver <head>, tentar após <!doctype> ou início do documento
    if (/<!doctype html>/i.test(html)) {
      return html.replace(/<!doctype html>/i, (m) => `${m}\n<html><head>${meta}</head>`);
    }

    // Fallback: prefixar o meta no topo
    return `${meta}\n${html}`;
  }

  // Criar transporter baseado na configuração
  private async createTransporter(config: any) {
    console.log(`[📧 EMAIL PROD] 🔧 Criando transporter para provedor: ${config.provider}`);
    console.log(`[📧 EMAIL PROD] 🔧 Configurações do transporter:`, {
      provider: config.provider,
      host: config.host,
      port: config.port,
      from_email: config.from_email,
      from_name: config.from_name,
      use_tls: config.use_tls,
      hasApiKey: !!config.api_key,
      hasUsername: !!config.username,
      hasPassword: !!config.password
    });
    
    // VALIDAÇÃO CRÍTICA: Verificar se as configurações são válidas
    if (!config || !config.provider || !config.from_email) {
      throw new Error('Configurações de email inválidas ou incompletas');
    }
    
    if (config.provider === 'smtp') {
      if (!config.host || !config.username || !config.password) {
        throw new Error('Configurações SMTP incompletas (host, username ou password ausentes)');
      }
      
      return nodemailer.createTransport({
        host: config.host,
        port: config.port || 587,
        secure: config.use_tls === true && config.port === 465,
        auth: {
          user: config.username,
          pass: config.password
        },
      });
    }

    // Para APIs externas (Brevo, SendGrid, etc.)
    if (config.provider === 'brevo') {
      if (!config.api_key) {
        throw new Error('API Key do Brevo é obrigatória');
      }
      
      return nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: config.from_email,
          pass: config.api_key
        },
      });
    }

    if (config.provider === 'sendgrid') {
      if (!config.api_key) {
        throw new Error('API Key do SendGrid é obrigatória');
      }
      
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: config.api_key
        },
      });
    }

    if (config.provider === 'mailgun') {
      if (!config.api_key) {
        throw new Error('API Key do Mailgun é obrigatória');
      }
      
      // Mailgun requer configuração específica do domínio
      const domain = config.from_email.split('@')[1];
      return nodemailer.createTransport({
        host: `smtp.mailgun.org`,
        port: 587,
        secure: false,
        auth: {
          user: `postmaster@${domain}`,
          pass: config.api_key
        },
      });
    }

    throw new Error(`Provedor ${config.provider} não suportado`);
  }

  // Verificar se usuário deve receber email
  async shouldSendEmailToUser(userId: number, notificationType: string): Promise<boolean> {
    try {
      // Primeiro verificar se o usuário está ativo
      const [user] = await db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Se usuário não existe ou está inativo, não enviar
      if (!user || !user.active) {
        return false;
      }

      // Buscar configurações do usuário
      const [settings] = await db
        .select()
        .from(userNotificationSettings)
        .where(eq(userNotificationSettings.user_id, userId))
        .limit(1);

      // Se não tem configurações, usar padrões (permitir)
      if (!settings) {
        return true;
      }

      // Verificar se email está habilitado
      if (!settings.email_notifications) {
        return false;
      }

      // Verificar horário
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();
      const isWeekend = currentDay === 0 || currentDay === 6;

      if (isWeekend && !settings.weekend_notifications) {
        return false;
      }

      const startHour = settings.notification_hours_start || 9;
      const endHour = settings.notification_hours_end || 18;
      
      if (currentHour < startHour || currentHour >= endHour) {
        return false;
      }

      // Verificar tipo específico
      const typeMap: Record<string, keyof typeof settings> = {
        'new_ticket': 'new_ticket_assigned',
        'ticket_assigned': 'new_ticket_assigned',
        'ticket_reply': 'new_reply_received',
        'new_reply': 'new_reply_received',
        'status_changed': 'ticket_status_changed',
        'status_update': 'ticket_status_changed',
        'ticket_resolved': 'ticket_status_changed',
        'ticket_escalated': 'ticket_escalated',
        'ticket_due_soon': 'ticket_due_soon',
        'customer_registered': 'new_customer_registered',
        'user_created': 'new_user_created',
        'system_maintenance': 'system_maintenance',
        // 🔥 FASE 4.3: Novos tipos de notificação para participantes
        'ticket_participant_added': 'new_reply_received',
        'ticket_participant_removed': 'ticket_status_changed',
        'daily_digest': 'new_ticket_assigned',
        'weekly_digest': 'new_ticket_assigned',
      };

      const settingKey = typeMap[notificationType];
      if (settingKey && settingKey in settings) {
        return Boolean(settings[settingKey]) ?? true;
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar configurações de email do usuário:', error);
      return true; // Em caso de erro, permitir
    }
  }

  // Método auxiliar para obter a URL base correta
  private async getBaseUrlForCompany(companyId?: number): Promise<string> {
    try {
      if (!companyId) {
        return 'https://app.ticketwise.com.br'; // URL padrão
      }
      
      // Buscar o domínio da empresa
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      
      if (!company || !company.domain) {
        return 'https://app.ticketwise.com.br'; // URL padrão
      }
      
      // Mapear domínios conhecidos para URLs completas
      const domainMap: Record<string, string> = {
        'vixbrasil.com': 'https://suporte.vixbrasil.com',
        'vixbrasil.com.br': 'https://suporte.vixbrasil.com',
        'ticketwise.com.br': 'https://app.ticketwise.com.br',
        'oficinamuda.com.br': 'https://suporte.oficinamuda.com.br',
        'oficinamuda.com': 'https://suporte.oficinamuda.com.br'
      };
      
      // Verificar se o domínio está no mapa
      for (const [domain, url] of Object.entries(domainMap)) {
        if (company.domain.includes(domain)) {
          return url;
        }
      }
      
      // Se não encontrou, assumir que é um subdomínio suporte
      return `https://suporte.${company.domain}`;
    } catch (error) {
      console.error('Erro ao obter URL base para empresa:', error);
      return 'https://app.ticketwise.com.br'; // URL padrão em caso de erro
    }
  }

  // Método auxiliar para mapear campos do ticket para variáveis mais amigáveis
  private async mapTicketFields(ticket: any): Promise<any> {
    if (!ticket) return ticket;
    // Se já existe priority_text, não faz nada
    if (ticket.priority_text) return ticket;
    // Buscar label customizado da prioridade
    let priorityText = ticket.priority;
    try {
      if (ticket.company_id && ticket.department_id && ticket.priority) {
        const priorityService = new PriorityService();
        // Busca todas as prioridades do departamento
        const result = await priorityService.getDepartmentPriorities(ticket.company_id, ticket.department_id);
        // Busca pelo nome (case-insensitive)
        let found = result.priorities.find(p => p.name?.toLowerCase() === ticket.priority?.toLowerCase());
        if (found) {
          priorityText = found.name;
        } else {
          // Fallback para tradução padrão
          const map: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
          priorityText = map[ticket.priority] || ticket.priority;
        }
      }
    } catch (e) {
      // Fallback para tradução padrão
      const map: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
      priorityText = map[ticket.priority] || ticket.priority;
    }
    return { ...ticket, priority_text: priorityText };
  }

  // Métodos específicos para cada tipo de notificação
  async notifyNewTicket(ticketId: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 🎫 INICIANDO NOTIFICAÇÃO DE NOVO TICKET`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);
      
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        return;
      }

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { 
          name: 'Cliente', 
          email: ticket.customer_email 
        },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // 🔥 NOVA LÓGICA: Buscar APENAS os atendentes do departamento específico do ticket
      let departmentUsers = [];
      
      if (ticket.department_id) {
        // Buscar usuários que são atendentes deste departamento específico
        departmentUsers = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            company_id: users.company_id
          })
          .from(users)
          .innerJoin(officials, eq(users.id, officials.user_id))
          .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
          .where(and(
            eq(officialDepartments.department_id, ticket.department_id),
            eq(users.active, true),
            eq(officials.is_active, true),
            // 🛡️ FILTRO DEFENSIVO: Garantir que department_id não seja NULL
            not(isNull(officialDepartments.department_id)),
            ticket.company_id ? eq(users.company_id, ticket.company_id) : undefined
          ));
      } else {
        return;
      }
      
      if (departmentUsers.length === 0) {
        return;
      }

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const user of departmentUsers) {
        // Enviar para todos os oficiais ativos DO DEPARTAMENTO respeitando preferências/horários
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'new_ticket');
        if (!shouldNotify) continue;

        const personalizedContext: EmailNotificationContext = {
          ...context,
          user: user
        };
        const result = await this.sendEmailNotification(
          'new_ticket',
          user.email,
          personalizedContext,
          ticket.company_id!,
          undefined
        );
        if (result.success) {
          emailsSent++;
        } else {
          emailsFailed++;
        }
      }

      // 🔥 NOVO: Notificar participantes (se houver)
      await this.notifyOtherParticipants(ticketId, 0, 'new_ticket', context);
      
    } catch (error) {
      console.error('Erro ao enviar notificação de novo ticket:', error);
    }
  }

  async notifyTicketAssigned(ticketId: number, assignedToId: number): Promise<void> {
    try {

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);

      // Buscar dados do atendente atribuído DIRETO DA TABELA OFFICIALS
      const [official] = await db
        .select()
        .from(officials)
        .where(and(eq(officials.id, assignedToId), eq(officials.is_active, true)))
        .limit(1);

      if (!official) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Atendente (official) ${assignedToId} não encontrado ou inativo`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Atendente encontrado (official):`);
      console.log(`[📧 EMAIL PROD] - ID: ${official.id}`);
      console.log(`[📧 EMAIL PROD] - Nome: ${official.name}`);
      console.log(`[📧 EMAIL PROD] - Email: ${official.email}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${official.company_id}`);

      // Buscar dados do cliente DIRETO DA TABELA CUSTOMERS
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: official, // agora é o official
        official,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o atendente atribuído
      // Aqui, se quiser, pode usar official.id ou official.user_id para preferências, mas o e-mail é sempre official.email
      const shouldNotify = await this.shouldSendEmailToUser(official.user_id || 0, 'ticket_assigned');
      if (shouldNotify) {
        // Contexto já contém user=official; manter para o destinatário
        await this.sendEmailNotification(
          'ticket_assigned',
          official.email,
          context,
          ticket.company_id!,
        );
      } else {
        console.log(`[📧 EMAIL PROD] 🔕 Atendente (official) ${official.name} não configurado para receber notificações`);
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE ATRIBUIÇÃO`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Atendente: ${official.name} (${official.email})`);
      console.log(`[📧 EMAIL PROD] Sucesso: ${shouldNotify ? 'Sim' : 'Não (configurações)'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de ticket atribuído:', error);
    }
  }

  async notifyTicketReply(ticketId: number, replyUserId: number, replyMessage: string): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 💬 INICIANDO NOTIFICAÇÃO DE RESPOSTA DE TICKET`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Usuário que respondeu ID: ${replyUserId}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (!ticket) return;
      // Buscar dados do usuário que respondeu
      // Se for atendente, buscar em officials; se for cliente, buscar em customers
      let replyUser = null;
      if (ticket.assigned_to_id && replyUserId === ticket.assigned_to_id) {
        // Atendente responsável respondeu
        [replyUser] = await db
          .select()
          .from(officials)
          .where(and(eq(officials.id, replyUserId), eq(officials.is_active, true)))
          .limit(1);
      } else {
        // Cliente respondeu (ou outro)
        [replyUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, replyUserId), eq(users.active, true)))
          .limit(1);
      }
      if (!replyUser) return;
      // Buscar dados do cliente DIRETO DA TABELA CUSTOMERS
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id !== null && ticket.company_id !== undefined ? ticket.company_id : undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: replyUser,
        reply: {
          message: replyMessage,
          author_name: replyUser.name,
          created_at: new Date(),
          user: replyUser
        },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // NOVA LÓGICA: Se o ticket tem responsável, notificar só ele e o cliente
      if (ticket.assigned_to_id) {
        // Se quem respondeu foi o cliente, notificar só o responsável
        if ('role' in replyUser && replyUser.role === 'customer') {
          // Buscar official pelo assigned_to_id
          const [assignedOfficial] = await db
            .select()
            .from(officials)
            .where(and(eq(officials.id, ticket.assigned_to_id), eq(officials.is_active, true)))
            .limit(1);
          if (assignedOfficial) {
            const shouldNotify = assignedOfficial.user_id ? await this.shouldSendEmailToUser(assignedOfficial.user_id, 'ticket_reply') : false;
            if (shouldNotify) {
              // 🔥 CORREÇÃO: Criar contexto personalizado para o responsável
              const assignedOfficialContext: EmailNotificationContext = {
                ...context,
                user: {
                  id: assignedOfficial.user_id || 0,
                  name: assignedOfficial.name,
                  email: assignedOfficial.email,
                  role: 'support'
                }
              };
              
              await this.sendEmailNotification(
                'ticket_reply',
                assignedOfficial.email,
                assignedOfficialContext,
                ticket.company_id!,
                'support'
              );
            }
          }
        } else {
          // Se quem respondeu foi o responsável, notificar só o cliente
          if (customer) {
            const shouldNotify = typeof customer.id === 'number' ? await this.shouldSendEmailToUser(customer.id, 'ticket_reply') : false;
            if (shouldNotify) {
              // 🔥 CORREÇÃO: Criar contexto personalizado para o cliente
              const customerContext: EmailNotificationContext = {
                ...context,
                user: {
                  id: customer.id,
                  name: customer.name,
                  email: customer.email,
                  role: 'customer'
                }
              };
              
              await this.sendEmailNotification(
                'ticket_reply',
                customer.email,
                customerContext,
                ticket.company_id!,
                'customer'
              );
            }
          }
        }
        // Notificar participantes normalmente (aqui pode ser users)
        const participants = await this.getTicketParticipants(ticketId, replyUserId);
        if (participants.length > 0) {
          await this.notifyParticipantsWithSettings(
            participants,
            'ticket_reply',
            context,
            `Há uma nova resposta no ticket #${ticket.ticket_id}: "${ticket.title}".`
          );
        }
        return;
      }

      // 🔥 LÓGICA ATUALIZADA FASE 4.1: Se quem respondeu foi o cliente, notificar ATENDENTES + PARTICIPANTES
      if ('role' in replyUser && replyUser.role === 'customer') {
        console.log(`[📧 EMAIL PROD] 📧 Cliente respondeu - notificando atendentes e participantes do departamento ${ticket.department_id}`);
        
        // 🔥 BUSCAR APENAS atendentes do departamento específico do ticket
        let departmentUsers = [];
        
        if (ticket.department_id) {
          // Buscar usuários que são atendentes deste departamento específico
          departmentUsers = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
              company_id: users.company_id
            })
            .from(users)
            .innerJoin(officials, eq(users.id, officials.user_id))
            .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
            .where(and(
              eq(officialDepartments.department_id, ticket.department_id),
              eq(users.active, true),
              eq(officials.is_active, true),
              inArray(users.role, ['admin', 'support', 'manager', 'supervisor']),
              // 🛡️ FILTRO DEFENSIVO: Garantir que department_id não seja NULL
              not(isNull(officialDepartments.department_id)),
              ticket.company_id ? eq(users.company_id, ticket.company_id) : undefined
            ));
        } else {
          console.log(`[📧 EMAIL PROD] ⚠️  Ticket sem department_id - pulando notificações (sistema defensivo)`);
          return;
        }
        
        console.log(`[📧 EMAIL PROD] 👥 Encontrados ${departmentUsers.length} atendentes do departamento para notificar:`);
        
        if (departmentUsers.length === 0) {
          console.log(`[📧 EMAIL PROD] ⚠️  ALERTA: Nenhum atendente ativo encontrado para o departamento ${ticket.department_id} - pulando notificações`);
          return;
        }

        // Listar usuários que serão notificados
        departmentUsers.forEach(user => {
          console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role}`);
        });

        let emailsSent = 0;
        let emailsFailed = 0;

        for (const user of departmentUsers) {
          console.log(`[📧 EMAIL PROD] -------------------------------------------`);
          console.log(`[📧 EMAIL PROD] 📧 Processando atendente: ${user.name} (${user.email})`);
          
          const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_reply');
          if (shouldNotify) {
            console.log(`[📧 EMAIL PROD] ✅ Atendente ${user.name} configurado para receber notificações`);
            
            // 🔥 CORREÇÃO: Criar contexto personalizado para o atendente
            const userContext: EmailNotificationContext = {
              ...context,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
              }
            };
            
            const result = await this.sendEmailNotification(
              'ticket_reply',
              user.email,
              userContext,
              ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
              user.role // Passar a role do atendente para validação
            );
            
            if (result.success) {
              emailsSent++;
              console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${user.name}`);
            } else {
              emailsFailed++;
              console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
            }
          } else {
            console.log(`[📧 EMAIL PROD] 🔕 Atendente ${user.name} não configurado para receber notificações`);
          }
        }

        // 🔥 FASE 4.3: Notificar participantes com configurações individuais
        const participants = await this.getTicketParticipants(ticketId, replyUserId);
        if (participants.length > 0) {
          await this.notifyParticipantsWithSettings(
            participants,
            'ticket_reply',
            context,
            `Há uma nova resposta de cliente no ticket #${ticket.ticket_id}: "${ticket.title}".`
          );
        }

        console.log(`[📧 EMAIL PROD] ===========================================`);
        console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE RESPOSTA`);
        console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
        console.log(`[📧 EMAIL PROD] Departamento: ${ticket.department_id}`);
        console.log(`[📧 EMAIL PROD] Emails enviados: ${emailsSent}`);
        console.log(`[📧 EMAIL PROD] Emails falharam: ${emailsFailed}`);
        console.log(`[📧 EMAIL PROD] ===========================================`);
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de resposta:', error);
    }
  }

  async notifyStatusChanged(ticketId: number, oldStatus: string, newStatus: string, changedByUserId?: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 🔄 INICIANDO NOTIFICAÇÃO DE MUDANÇA DE STATUS`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Status anterior: ${oldStatus}`);
      console.log(`[📧 EMAIL PROD] Novo status: ${newStatus}`);
      console.log(`[📧 EMAIL PROD] Alterado por ID: ${changedByUserId || 'N/A'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (!ticket) return;
      // Buscar dados do cliente DIRETO DA TABELA CUSTOMERS
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      let changedByUser = null;
      if (changedByUserId) {
        [changedByUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, changedByUserId), eq(users.active, true)))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Usuário que alterou encontrado: ${changedByUser?.name || 'N/A'}`);
      }

      // Mapeamento de status igual ao frontend
      const statusTranslations: Record<string, string> = {
        'new': 'Novo',
        'ongoing': 'Em Andamento',
        'suspended': 'Suspenso',
        'waiting_customer': 'Aguardando Cliente',
        'escalated': 'Escalado',
        'in_analysis': 'Em Análise',
        'pending_deployment': 'Aguardando Deploy',
        'reopened': 'Reaberto',
        'resolved': 'Resolvido',
        'undefined': 'Não Definido',
        'null': 'Não Definido',
        '': 'Não Definido'
      };

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id !== null && ticket.company_id !== undefined ? ticket.company_id : undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: changedByUser,
        status_change: {
          old_status: statusTranslations[oldStatus] || oldStatus,
          new_status: statusTranslations[newStatus] || newStatus,
          created_at: new Date(),
          changed_by: changedByUser
        },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // NOVA LÓGICA: Se o ticket tem responsável, notificar só ele (exceto se ele mesmo alterou) e o cliente
      if (ticket.assigned_to_id) {
        // Notificar responsável, exceto se ele mesmo alterou
        if (!changedByUserId || ticket.assigned_to_id !== changedByUserId) {
          // Buscar official pelo assigned_to_id
          const [assignedOfficial] = await db
            .select()
            .from(officials)
            .where(and(eq(officials.id, ticket.assigned_to_id), eq(officials.is_active, true)))
            .limit(1);
          if (assignedOfficial) {
            const shouldNotify = assignedOfficial.user_id ? await this.shouldSendEmailToUser(assignedOfficial.user_id, 'status_changed') : false;
            if (shouldNotify) {
              // 🔥 CORREÇÃO: Criar contexto personalizado para o responsável
              const assignedOfficialContext: EmailNotificationContext = {
                ...context,
                user: {
                  id: assignedOfficial.user_id || 0,
                  name: assignedOfficial.name,
                  email: assignedOfficial.email,
                  role: 'support' // Assumir role padrão para officials
                }
              };
              
              await this.sendEmailNotification(
                'status_changed',
                assignedOfficial.email,
                assignedOfficialContext,
                ticket.company_id!,
                'support'
              );
            }
          }
        }
        // Notificar cliente normalmente
        if (customer) {
          const shouldNotify = await this.shouldSendEmailToUser(customer.id, newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed');
          if (shouldNotify) {
            // 🔥 CORREÇÃO: Criar contexto personalizado para o cliente
            const customerContext: EmailNotificationContext = {
              ...context,
              user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                role: 'customer'
              }
            };
            
            await this.sendEmailNotification(
              newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed',
              customer.email,
              customerContext,
              ticket.company_id!,
              'customer'
            );
          }
        }
        // Notificar participantes normalmente (aqui pode ser users)
        const participants = await this.getTicketParticipants(ticketId, changedByUserId);
        if (participants.length > 0) {
          await this.notifyParticipantsWithSettings(
            participants,
            'status_changed',
            context,
            `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatus}" para "${newStatus}".`
          );
        }
        return;
      }

      // 🔥 NOTIFICAR O CLIENTE (sempre que houver email)
      if (ticket.customer_email) {
        console.log(`[📧 EMAIL PROD] 📧 Notificando cliente sobre mudança de status: ${ticket.customer_email}`);
        
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        const shouldNotify = customerUser
          ? await this.shouldSendEmailToUser(customerUser.id, newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed')
          : true;

        if (shouldNotify) {
          // 🔥 CORREÇÃO: Criar contexto personalizado para o cliente
          const customerContext: EmailNotificationContext = {
            ...context,
            user: customerUser || {
              id: 0,
              name: customer?.name || 'Cliente',
              email: ticket.customer_email,
              role: 'customer'
            }
          };
          
          const result = await this.sendEmailNotification(
            newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed',
            ticket.customer_email,
            customerContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            customerUser?.role || 'customer' // Passar a role do cliente para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de mudança de status enviado com sucesso para cliente`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de mudança de status para cliente: ${result.error}`);
          }

          // 🎯 ENVIAR PESQUISA DE SATISFAÇÃO SE TICKET FOI RESOLVIDO
          if (newStatus === 'resolved') {
            console.log(`[📧 SATISFACTION] 🎯 Ticket resolvido, iniciando envio de pesquisa de satisfação`);
            
            // Enviar pesquisa de satisfação de forma assíncrona (não bloquear o fluxo principal)
            this.sendSatisfactionSurvey(ticketId).catch((surveyError) => {
              console.error(`[📧 SATISFACTION] ❌ Erro ao enviar pesquisa de satisfação:`, surveyError);
              console.error(`[📧 SATISFACTION] ❌ Stack trace:`, surveyError.stack);
            });
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Cliente não configurado para receber notificações de mudança de status`);
        }
      }

      // 🔥 NOTIFICAR ATENDENTES DO DEPARTAMENTO (exceto quem alterou)
      console.log(`[📧 EMAIL PROD] 📧 Notificando atendentes do departamento ${ticket.department_id} sobre mudança de status`);
      
      // 🔥 BUSCAR APENAS atendentes do departamento específico do ticket
      let departmentUsers = [];
      
      if (ticket.department_id) {
        // Buscar usuários que são atendentes deste departamento específico
        departmentUsers = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            company_id: users.company_id
          })
          .from(users)
          .innerJoin(officials, eq(users.id, officials.user_id))
          .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
          .where(and(
            eq(officialDepartments.department_id, ticket.department_id),
            eq(users.active, true),
            eq(officials.is_active, true),
            inArray(users.role, ['admin', 'support', 'manager', 'supervisor']),
            // 🛡️ FILTRO DEFENSIVO: Garantir que department_id não seja NULL
            not(isNull(officialDepartments.department_id)),
            ticket.company_id ? eq(users.company_id, ticket.company_id) : undefined,
            // 🔥 EXCLUIR quem alterou o status (não notificar a si mesmo)
            changedByUserId ? ne(users.id, changedByUserId) : undefined
          ));
      } else {
        console.log(`[📧 EMAIL PROD] ⚠️  Ticket sem department_id - pulando notificações (sistema defensivo)`);
        return;
      }
      
      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${departmentUsers.length} atendentes do departamento para notificar:`);
      
      if (departmentUsers.length === 0) {
        console.log(`[📧 EMAIL PROD] ⚠️  ALERTA: Nenhum atendente ativo encontrado para o departamento ${ticket.department_id} - pulando notificações`);
        return;
      }

      // Listar usuários que serão notificados
      departmentUsers.forEach(user => {
        console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role}`);
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const user of departmentUsers) {
        console.log(`[📧 EMAIL PROD] -------------------------------------------`);
        console.log(`[📧 EMAIL PROD] 📧 Processando atendente: ${user.name} (${user.email})`);
        
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'status_changed');
        if (shouldNotify) {
          console.log(`[📧 EMAIL PROD] ✅ Atendente ${user.name} configurado para receber notificações`);
          
          // 🔥 CORREÇÃO CRÍTICA: Criar contexto personalizado para cada usuário
          const personalizedContext: EmailNotificationContext = {
            ...context,
            user: user // Adicionar dados do usuário específico
          };
          
          const result = await this.sendEmailNotification(
            'status_changed',
            user.email,
            personalizedContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            user.role // Passar a role do atendente para validação
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${user.name}`);
          } else {
            emailsFailed++;
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Atendente ${user.name} não configurado para receber notificações`);
        }
      }

      // 🔥 FASE 4.3: Notificar participantes com configurações individuais
      const participants = await this.getTicketParticipants(ticketId, changedByUserId);
      if (participants.length > 0) {
        const participantResult = await this.notifyParticipantsWithSettings(
          participants,
          'status_changed',
          context,
          `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatus}" para "${newStatus}".`
        );
        console.log(`[📧 EMAIL PROD] 📊 PARTICIPANTES: ${participantResult.sent} enviados, ${participantResult.failed} falharam, ${participantResult.skipped} ignorados`);
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE MUDANÇA DE STATUS`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Status: ${oldStatus} → ${newStatus}`);
      console.log(`[📧 EMAIL PROD] Departamento: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] Emails enviados: ${emailsSent}`);
      console.log(`[📧 EMAIL PROD] Emails falharam: ${emailsFailed}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de mudança de status:', error);
    }
  }

  async notifyTicketEscalated(ticketId: number, escalatedByUserId?: number, reason?: string): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 🚨 INICIANDO NOTIFICAÇÃO DE TICKET ESCALADO`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Escalado por ID: ${escalatedByUserId || 'N/A'}`);
      console.log(`[📧 EMAIL PROD] Motivo: ${reason || 'N/A'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (!ticket) return;
      // Buscar dados do cliente DIRETO DA TABELA CUSTOMERS
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      let escalatedByUser = null;
      if (escalatedByUserId) {
        [escalatedByUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, Number(escalatedByUserId)), eq(users.active, true)))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Usuário que escalou encontrado: ${escalatedByUser?.name || 'N/A'}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id !== null && ticket.company_id !== undefined ? ticket.company_id : undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: escalatedByUser,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // 🔥 NOTIFICAR O CLIENTE (sempre que houver email)
      if (ticket.customer_email) {
        console.log(`[📧 EMAIL PROD] 📧 Notificando cliente sobre escalação: ${ticket.customer_email}`);
        
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        const shouldNotify = customerUser
          ? await this.shouldSendEmailToUser(customerUser.id, 'ticket_escalated')
          : true;

        if (shouldNotify) {
          // Personalizar contexto para o cliente destinatário
          const customerContext: EmailNotificationContext = {
            ...context,
            user: customerUser || {
              id: 0,
              name: customer?.name || 'Cliente',
              email: ticket.customer_email,
              role: 'customer'
            }
          };

          const result = await this.sendEmailNotification(
            'ticket_escalated',
            ticket.customer_email,
            customerContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            customerUser?.role || 'customer' // Passar a role do cliente para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de escalação enviado com sucesso para cliente`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de escalação para cliente: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Cliente não configurado para receber notificações de escalação`);
        }
      }

      // 🔥 NOTIFICAR ATENDENTES DO DEPARTAMENTO (exceto quem escalou)
      console.log(`[📧 EMAIL PROD] 📧 Notificando atendentes do departamento ${ticket.department_id} sobre escalação`);
      
      // 🔥 BUSCAR APENAS atendentes do departamento específico do ticket
      let departmentUsers = [];
      
      if (ticket.department_id) {
        // Buscar usuários que são atendentes deste departamento específico
        departmentUsers = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            company_id: users.company_id
          })
          .from(users)
          .innerJoin(officials, eq(users.id, officials.user_id))
          .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
          .where(and(
            eq(officialDepartments.department_id, ticket.department_id),
            eq(users.active, true),
            eq(officials.is_active, true),
            inArray(users.role, ['admin', 'support', 'manager', 'supervisor']),
            // 🛡️ FILTRO DEFENSIVO: Garantir que department_id não seja NULL
            not(isNull(officialDepartments.department_id)),
            ticket.company_id ? eq(users.company_id, ticket.company_id) : undefined,
            // 🔥 EXCLUIR quem escalou o ticket (não notificar a si mesmo)
            escalatedByUserId ? ne(users.id, escalatedByUserId) : undefined
          ));
      } else {
        console.log(`[📧 EMAIL PROD] ⚠️  Ticket sem department_id - pulando notificações (sistema defensivo)`);
        return;
      }
      
      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${departmentUsers.length} atendentes do departamento para notificar:`);
      
      if (departmentUsers.length === 0) {
        console.log(`[📧 EMAIL PROD] ⚠️  ALERTA: Nenhum atendente ativo encontrado para o departamento ${ticket.department_id} - pulando notificações`);
        return;
      }

      // Listar usuários que serão notificados
      departmentUsers.forEach(user => {
        console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role}`);
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const user of departmentUsers) {
        console.log(`[📧 EMAIL PROD] -------------------------------------------`);
        console.log(`[📧 EMAIL PROD] 📧 Processando atendente: ${user.name} (${user.email})`);
        
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_escalated');
        if (shouldNotify) {
          console.log(`[📧 EMAIL PROD] ✅ Atendente ${user.name} configurado para receber notificações`);
          
          // Personalizar contexto para o atendente destinatário
          const personalizedContext: EmailNotificationContext = {
            ...context,
            user: user
          };

          const result = await this.sendEmailNotification(
            'ticket_escalated',
            user.email,
            personalizedContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            user.role // Passar a role do atendente para validação
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${user.name}`);
          } else {
            emailsFailed++;
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Atendente ${user.name} não configurado para receber notificações`);
        }
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE ESCALAÇÃO`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Departamento: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] Emails enviados: ${emailsSent}`);
      console.log(`[📧 EMAIL PROD] Emails falharam: ${emailsFailed}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de escalação:', error);
    }
  }

  async notifyTicketDueSoon(ticketId: number, hoursUntilDue: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] ⏰ INICIANDO NOTIFICAÇÃO DE TICKET VENCENDO`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Horas até vencimento: ${hoursUntilDue}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (!ticket) return;
      // Buscar dados do cliente DIRETO DA TABELA CUSTOMERS
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id !== null && ticket.company_id !== undefined ? ticket.company_id : undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      // Criar mensagem baseada nas horas até o vencimento
      let message = '';
      if (hoursUntilDue <= 1) {
        message = `Este ticket vence em menos de 1 hora. Ação imediata é necessária.`;
      } else if (hoursUntilDue <= 4) {
        message = `Este ticket vence em ${hoursUntilDue} horas. Atenção urgente necessária.`;
      } else if (hoursUntilDue <= 24) {
        message = `Este ticket vence em ${hoursUntilDue} horas. Verifique o status e tome as ações necessárias.`;
      } else {
        const days = Math.ceil(hoursUntilDue / 24);
        message = `Este ticket vence em aproximadamente ${days} dias. Verifique o progresso.`;
      }

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br',
          message: message
        }
      };

      // 🔥 NOTIFICAR O ATENDENTE ATRIBUÍDO (se houver)
      if (ticket.assigned_to_id) {
        // Buscar official pelo assigned_to_id
        const [assignedOfficial] = await db
          .select()
          .from(officials)
          .where(and(eq(officials.id, ticket.assigned_to_id), eq(officials.is_active, true)))
          .limit(1);
        if (assignedOfficial) {
          const shouldNotify = assignedOfficial.user_id ? await this.shouldSendEmailToUser(assignedOfficial.user_id, 'ticket_due_soon') : false;
          if (shouldNotify) {
            // Buscar dados do usuário para incluir no contexto (somente se houver user_id)
            let userData: any | undefined = undefined;
            if (assignedOfficial.user_id) {
              const result = await db
                .select()
                .from(users)
                .where(and(eq(users.id, Number(assignedOfficial.user_id)), eq(users.active, true)))
                .limit(1);
              userData = result[0];
            }

            const userContext = {
              ...context,
              user: userData || { name: assignedOfficial.name, email: assignedOfficial.email }
            };

            await this.sendEmailNotification(
              'ticket_due_soon',
              assignedOfficial.email,
              userContext,
              ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
              userData?.role // Passar a role do usuário para validação
            );
          }
        }
      }

      // 🔥 NOTIFICAR ATENDENTES DO DEPARTAMENTO (exceto o atribuído)
      console.log(`[📧 EMAIL PROD] 📧 Notificando atendentes do departamento ${ticket.department_id} sobre vencimento`);
      
      // 🔥 BUSCAR APENAS atendentes do departamento específico do ticket
      let departmentUsers = [];
      
      if (ticket.department_id) {
        // Buscar usuários que são atendentes deste departamento específico
        departmentUsers = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            company_id: users.company_id
          })
          .from(users)
          .innerJoin(officials, eq(users.id, officials.user_id))
          .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
          .where(and(
            eq(officialDepartments.department_id, ticket.department_id),
            eq(users.active, true),
            eq(officials.is_active, true),
            inArray(users.role, ['admin', 'support', 'manager', 'supervisor']),
            // 🛡️ FILTRO DEFENSIVO: Garantir que department_id não seja NULL
            not(isNull(officialDepartments.department_id)),
            ticket.company_id ? eq(users.company_id, ticket.company_id) : undefined,
            // 🔥 EXCLUIR o atendente atribuído (já foi notificado acima)
            ticket.assigned_to_id ? ne(users.id, ticket.assigned_to_id) : undefined
          ));
      } else {
        console.log(`[📧 EMAIL PROD] ⚠️  Ticket sem department_id - pulando notificações (sistema defensivo)`);
        return;
      }
      
      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${departmentUsers.length} atendentes do departamento para notificar:`);
      
      if (departmentUsers.length === 0) {
        console.log(`[📧 EMAIL PROD] ⚠️  ALERTA: Nenhum atendente ativo encontrado para o departamento ${ticket.department_id} - pulando notificações`);
        return;
      }

      // Listar usuários que serão notificados
      departmentUsers.forEach(user => {
        console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role}`);
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const user of departmentUsers) {
        console.log(`[📧 EMAIL PROD] -------------------------------------------`);
        console.log(`[📧 EMAIL PROD] 📧 Processando atendente: ${user.name} (${user.email})`);
        
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_due_soon');
        if (shouldNotify) {
          console.log(`[📧 EMAIL PROD] ✅ Atendente ${user.name} configurado para receber notificações`);
          
          // Criar contexto específico para este usuário (destinatário)
          const userContext: EmailNotificationContext = {
            ...context,
            user: user
          };
          
          const result = await this.sendEmailNotification(
            'ticket_due_soon',
            user.email,
            userContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            user.role // Passar a role do atendente para validação
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${user.name}`);
          } else {
            emailsFailed++;
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Atendente ${user.name} não configurado para receber notificações`);
        }
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE VENCIMENTO`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Departamento: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] Atendente atribuído: ${ticket.assigned_to_id || 'N/A'}`);
      console.log(`[📧 EMAIL PROD] Emails enviados: ${emailsSent}`);
      console.log(`[📧 EMAIL PROD] Emails falharam: ${emailsFailed}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de ticket vencendo:', error);
    }
  }

  async notifyNewCustomerRegistered(customerId: number): Promise<void> {
    try {
      // Buscar dados do cliente
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer) return;

      // Buscar destinatários (admins, managers, company_admins da empresa)
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'), 
          eq(users.active, true),
          customer.company_id ? eq(users.company_id, customer.company_id) : undefined
        ));

      const managerUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'manager'), 
          eq(users.active, true),
          customer.company_id ? eq(users.company_id, customer.company_id) : undefined
        ));

      const companyAdminUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'company_admin'), 
          eq(users.active, true),
          customer.company_id ? eq(users.company_id, customer.company_id) : undefined
        ));

      const allNotifyUsers = [...adminUsers, ...managerUsers, ...companyAdminUsers];

      for (const notifyUser of allNotifyUsers) {
        const context: EmailNotificationContext = {
          customer,
          user: notifyUser, // Adiciona o destinatário como 'user' para o template
          system: {
            base_url: 'https://app.ticketwise.com.br',
            company_name: 'Sistema de Tickets',
            support_email: 'suporte@ticketwise.com.br'
          }
        };
        const personalizedContext: EmailNotificationContext = {
          ...context,
          user: notifyUser
        };
        await this.sendEmailNotification(
          'new_customer_registered',
          notifyUser.email,
          personalizedContext,
          customer.company_id || undefined,
          notifyUser.role
        );
      }
    } catch (error) {
      console.error('Erro ao notificar novo cliente registrado:', error);
    }
  }

  async notifyNewUserCreated(userId: number, createdByUserId?: number): Promise<void> {
    try {
      // Buscar dados do usuário criado
      const [newUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!newUser) return;

      let createdByUser = null;
      if (createdByUserId) {
        [createdByUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, createdByUserId), eq(users.active, true)))
          .limit(1);
      }

      const context: EmailNotificationContext = {
        user: newUser,
        system: {
          message: `Novo usuário ${newUser.name} (${newUser.role}) foi criado`,
          base_url: 'https://app.ticketwise.com.br',
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      if (createdByUser) {
        context.system!.message += ` por ${createdByUser.name}`;
      }

      // 🔥 CORREÇÃO CRÍTICA: SÓ notificar usuários da MESMA EMPRESA do usuário criado!
      console.log(`[📧 EMAIL PROD] 🔍 Buscando usuários para notificar sobre usuário ${newUser.name} da empresa ${newUser.company_id}`);
      
      // Notificar administradores da MESMA EMPRESA
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'), 
          eq(users.active, true),
          newUser.company_id ? eq(users.company_id, newUser.company_id) : undefined
        ));

      const companyAdminUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.role, 'company_admin'), 
          eq(users.active, true),
          newUser.company_id ? eq(users.company_id, newUser.company_id) : undefined
        ));

      const allNotifyUsers = [...adminUsers, ...companyAdminUsers];
      
      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${allNotifyUsers.length} usuários da empresa ${newUser.company_id} para notificar:`);
      allNotifyUsers.forEach(user => {
        console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role} - Empresa: ${user.company_id}`);
      });

      for (const user of allNotifyUsers) {
        // Não notificar o próprio usuário que foi criado
        if (user.id === newUser.id) continue;

        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'user_created');
        if (shouldNotify) {
          const personalizedContext: EmailNotificationContext = {
            ...context,
            user: user
          };
          await this.sendEmailNotification(
            'user_created',
            user.email,
            personalizedContext,
            newUser.company_id!, // 🔥 OBRIGATÓRIO: newUser sempre tem company_id
            user.role // Passar a role do usuário para validação
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de novo usuário criado:', error);
    }
  }

  async notifySystemMaintenance(
    maintenanceStart: Date,
    maintenanceEnd: Date,
    message: string,
    companyId?: number
  ): Promise<void> {
    try {
      const context: EmailNotificationContext = {
        system: {
          maintenance_start: maintenanceStart,
          maintenance_end: maintenanceEnd,
          message,
          base_url: 'https://app.ticketwise.com.br',
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Buscar todos os usuários ativos (ou da empresa específica se fornecida)
      let whereCondition = eq(users.active, true);
      
      if (companyId) {
        whereCondition = and(whereCondition, eq(users.company_id, companyId))!;
      }

      const allUsers = await db
        .select()
        .from(users)
        .where(whereCondition);

      for (const user of allUsers) {
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'system_maintenance');
        if (shouldNotify) {
          const personalizedContext: EmailNotificationContext = {
            ...context,
            user: user
          };
          await this.sendEmailNotification(
            'system_maintenance',
            user.email,
            personalizedContext,
            companyId!, // 🔥 OBRIGATÓRIO: companyId sempre deve ser fornecido
            user.role // Passar a role do usuário para validação
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de manutenção do sistema:', error);
    }
  }

  // Método para verificar tickets próximos do vencimento (para rodar periodicamente)
  async checkTicketsDueSoon(companyFilter?: string): Promise<void> {
    try {
      // Função para interpretar o filtro de empresas
      const parseCompanyFilter = (filter: string): (companyId: number) => boolean => {
        if (!filter || filter === '*') {
          return () => true; // Todas as empresas
        }
        
        if (filter.startsWith('<>')) {
          const excludedId = parseInt(filter.substring(2));
          return (companyId: number) => companyId !== excludedId;
        }
        
        if (filter.includes(',')) {
          const allowedIds = filter.split(',').map(id => parseInt(id.trim()));
          return (companyId: number) => allowedIds.includes(companyId);
        }
        
        const specificId = parseInt(filter);
        return (companyId: number) => companyId === specificId;
      };

      // Buscar tickets ativos (qualquer status não resolvido) que ainda não violaram SLA
      const activeTickets = await db
        .select({
          id: tickets.id,
          priority: tickets.priority,
          created_at: tickets.created_at,
          company_id: tickets.company_id,
          department_id: tickets.department_id,
          incident_type_id: tickets.incident_type_id,
          category_id: tickets.category_id,
          status: tickets.status,
          first_response_at: tickets.first_response_at,
          resolved_at: tickets.resolved_at,
          sla_breached: tickets.sla_breached
        })
        .from(tickets)
        .where(
          and(
            ne(tickets.status, 'resolved' as any),
            eq(tickets.sla_breached, false)
          )
        );

      // Aplicar filtro de empresa se fornecido
      const companyFilterFn = parseCompanyFilter(companyFilter || '*');
      const filteredTickets = activeTickets.filter((ticket: any) => 
        ticket.company_id ? companyFilterFn(ticket.company_id) : false
      );

      // Log das empresas que estão sendo processadas
      const processedCompanies = (filteredTickets as any[])
        .map((t: any) => t.company_id)
        .filter((id: any, index: number, arr: any[]) => id !== null && arr.indexOf(id) === index)
        .sort();
      console.log(`[Email] Filtro aplicado: ${companyFilter || '*'}`);
      console.log(`[Email] Processando ${filteredTickets.length} tickets de ${processedCompanies.length} empresas: [${processedCompanies.join(', ')}]`);

      const now = new Date();

      for (const ticket of filteredTickets) {
        // Se faltar dados essenciais, pular
        if (!ticket.company_id || !ticket.department_id || !ticket.incident_type_id) {
          continue;
        }

        // Se o status atual pausa o SLA, não notificar nem escalar
        const currentStatus = ticket.status as TicketStatus;
        if (isSlaPaused(currentStatus)) {
          continue;
        }

        // Resolver configuração de SLA completa (response e resolution)
        const resolvedSLA = await slaService.getTicketSLA(
          ticket.company_id,
          ticket.department_id,
          ticket.incident_type_id,
          ticket.priority,
          ticket.category_id || undefined
        );

        if (!resolvedSLA) {
          // Sem SLA configurado para o ticket
          continue;
        }

        // Buscar histórico de status para calcular tempo efetivo (pausando waiting_customer etc.)
        const statusHistory = await db
          .select()
          .from(ticketStatusHistory)
          .where(eq(ticketStatusHistory.ticket_id, ticket.id));

        const businessHours = getBusinessHoursConfig();
        const statusPeriods = convertStatusHistoryToPeriods(new Date(ticket.created_at), currentStatus, statusHistory);

        const createdAt = new Date(ticket.created_at);

        // Decidir qual SLA aplicar: primeira resposta para 'new' sem first_response_at; caso contrário, resolução
        let targetSlaHours = 0;
        let elapsedMs = 0;
        let slaType: 'response' | 'resolution' = 'resolution';

        if (currentStatus === 'new' && !ticket.first_response_at) {
          // Ainda aguardando primeira resposta
          slaType = 'response';
          targetSlaHours = resolvedSLA.responseTimeHours;
          elapsedMs = calculateEffectiveBusinessTime(createdAt, now, statusPeriods, businessHours);
        } else {
          // Contar SLA de resolução até agora (se não resolvido)
          slaType = 'resolution';
          targetSlaHours = resolvedSLA.resolutionTimeHours;
          elapsedMs = calculateEffectiveBusinessTime(createdAt, now, statusPeriods, businessHours);
        }

        // Converter para horas
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const hoursRemaining = Math.max(0, targetSlaHours - elapsedHours);

        // Definir threshold de notificação baseado na prioridade/tempo
        let notificationThreshold: number;
        const priorityKey = (ticket.priority || '').toString().toLowerCase();
        if (priorityKey === 'critical' || priorityKey === 'crítica') {
          notificationThreshold = Math.max(1, targetSlaHours * 0.25);
        } else if (priorityKey === 'high' || priorityKey === 'alta') {
          notificationThreshold = Math.max(2, targetSlaHours * 0.20);
        } else if (priorityKey === 'medium' || priorityKey === 'média' || priorityKey === 'media') {
          notificationThreshold = Math.max(3, targetSlaHours * 0.15);
        } else {
          notificationThreshold = Math.max(4, targetSlaHours * 0.10);
        }

        const dueDate = addBusinessTime(createdAt, targetSlaHours, businessHours);
        const typeLabel = slaType === 'response' ? 'Primeira Resposta' : 'Resolução';
        console.log(`[Email] Ticket ${ticket.id} - ${typeLabel} | Prioridade: ${ticket.priority}, SLA: ${targetSlaHours}h, Restante: ${hoursRemaining.toFixed(1)}h, Vencimento: ${dueDate.toISOString()}, Threshold: ${notificationThreshold.toFixed(1)}h`);

        // Notificar se estiver próximo do vencimento (apenas quando SLA ativo)
        if (hoursRemaining > 0 && hoursRemaining <= notificationThreshold) {
          await this.notifyTicketDueSoon(ticket.id, Math.round(hoursRemaining));
        }

        // Marcar como vencido e escalar se passou do prazo
        if (elapsedHours >= targetSlaHours) {
          await db
            .update(tickets)
            .set({ sla_breached: true })
            .where(eq(tickets.id, ticket.id));

          await this.notifyTicketEscalated(
            ticket.id,
            undefined,
            `Ticket escalado automaticamente por violação de SLA de ${typeLabel} (${targetSlaHours}h). Tempo efetivo decorrido: ${elapsedHours.toFixed(1)}h`
          );
        }
      }

      console.log(`[Email] Verificação concluída. Analisados ${filteredTickets.length} tickets ativos (de ${activeTickets.length} total).`);

    } catch (error) {
      console.error('Erro ao verificar tickets próximos do vencimento:', error);
    }
  }

  // === NOVOS MÉTODOS PARA PARTICIPANTES DE TICKETS ===

  /**
   * Notifica quando um participante é adicionado a um ticket
   */
  async notifyTicketParticipantAdded(ticketId: number, participantUserId: number, addedByUserId: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 👥 INICIANDO NOTIFICAÇÃO DE PARTICIPANTE ADICIONADO`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Participante ID: ${participantUserId}`);
      console.log(`[📧 EMAIL PROD] Adicionado por ID: ${addedByUserId}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      // Buscar dados do participante adicionado
      const [participant] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, participantUserId), eq(users.active, true)))
        .limit(1);

      if (!participant) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Participante ${participantUserId} não encontrado ou inativo`);
        return;
      }

      // Buscar dados de quem adicionou
      const [addedBy] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, addedByUserId), eq(users.active, true)))
        .limit(1);

      if (!addedBy) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Usuário ${addedByUserId} não encontrado ou inativo`);
        return;
      }

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: participant,
        official: addedBy,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o participante adicionado
      console.log(`[📧 EMAIL PROD] 📧 Notificando participante adicionado: ${participant.email}`);
      
      const shouldNotify = await this.shouldSendEmailToUser(participant.id, 'ticket_participant_added');
      if (shouldNotify) {
        const result = await this.sendEmailNotification(
          'ticket_participant_added',
          participant.email,
          context,
          ticket.company_id!,
          participant.role
        );
        
        if (result.success) {
          console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para participante ${participant.name}`);
        } else {
          console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para participante: ${result.error}`);
        }
      } else {
        console.log(`[📧 EMAIL PROD] 🔕 Participante não configurado para receber notificações`);
      }

      // 🔥 FASE 4.3: Notificar outros participantes do ticket com configurações individuais
      const otherParticipants = await this.getTicketParticipants(ticketId, participantUserId);
      if (otherParticipants.length > 0) {
        await this.notifyParticipantsWithSettings(
          otherParticipants,
          'ticket_participant_added',
          context,
          `${participant.name} foi adicionado como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${addedBy.name}.`
        );
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] ✅ NOTIFICAÇÃO DE PARTICIPANTE ADICIONADO CONCLUÍDA`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de participante adicionado:', error);
    }
  }

  /**
   * Notifica quando um participante é removido de um ticket
   */
  async notifyTicketParticipantRemoved(ticketId: number, participantUserId: number, removedByUserId: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 👥 INICIANDO NOTIFICAÇÃO DE PARTICIPANTE REMOVIDO`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Participante ID: ${participantUserId}`);
      console.log(`[📧 EMAIL PROD] Removido por ID: ${removedByUserId}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      // Buscar dados do participante removido
      const [participant] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, participantUserId), eq(users.active, true)))
        .limit(1);

      if (!participant) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Participante ${participantUserId} não encontrado ou inativo`);
        return;
      }

      // Buscar dados de quem removeu
      const [removedBy] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, removedByUserId), eq(users.active, true)))
        .limit(1);

      if (!removedBy) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Usuário ${removedByUserId} não encontrado ou inativo`);
        return;
      }

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: participant,
        official: removedBy,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o participante removido
      console.log(`[📧 EMAIL PROD] 📧 Notificando participante removido: ${participant.email}`);
      
      const shouldNotify = await this.shouldSendEmailToUser(participant.id, 'ticket_participant_removed');
      if (shouldNotify) {
        const result = await this.sendEmailNotification(
          'ticket_participant_removed',
          participant.email,
          context,
          ticket.company_id!,
          participant.role
        );
        
        if (result.success) {
          console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para participante removido ${participant.name}`);
        } else {
          console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para participante removido: ${result.error}`);
        }
      } else {
        console.log(`[📧 EMAIL PROD] 🔕 Participante removido não configurado para receber notificações`);
      }

      // 🔥 FASE 4.3: Notificar outros participantes do ticket com configurações individuais
      const otherParticipants = await this.getTicketParticipants(ticketId, participantUserId);
      if (otherParticipants.length > 0) {
        await this.notifyParticipantsWithSettings(
          otherParticipants,
          'ticket_participant_removed',
          context,
          `${participant.name} foi removido como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${removedBy.name}.`
        );
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] ✅ NOTIFICAÇÃO DE PARTICIPANTE REMOVIDO CONCLUÍDA`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de participante removido:', error);
    }
  }

  /**
   * Método auxiliar para notificar outros participantes de um ticket
   */
  private async notifyOtherParticipants(
    ticketId: number, 
    excludeUserId: number, 
    notificationType: string, 
    context: EmailNotificationContext
  ): Promise<void> {
    try {
      // Buscar todos os participantes do ticket (exceto o excluído)
      const participants = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          company_id: users.company_id
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, excludeUserId)
        ));

      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${participants.length} outros participantes para notificar`);

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const participant of participants) {
        console.log(`[📧 EMAIL PROD] -------------------------------------------`);
        console.log(`[📧 EMAIL PROD] 📧 Processando participante: ${participant.name} (${participant.email})`);
        
        const shouldNotify = await this.shouldSendEmailToUser(participant.id, notificationType);
        if (shouldNotify) {
          console.log(`[📧 EMAIL PROD] ✅ Participante ${participant.name} configurado para receber notificações`);
          // Personalizar contexto para o participante destinatário
          const participantContext: EmailNotificationContext = {
            ...context,
            user: participant
          };

          const result = await this.sendEmailNotification(
            notificationType,
            participant.email,
            participantContext,
            participant.company_id ?? context.ticket?.company_id!,
            participant.role
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${participant.name}`);
          } else {
            emailsFailed++;
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${participant.name}: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Participante ${participant.name} não configurado para receber notificações`);
        }
      }

      console.log(`[📧 EMAIL PROD] 📊 RESUMO: ${emailsSent} emails enviados, ${emailsFailed} falharam`);

    } catch (error) {
      console.error('Erro ao notificar outros participantes:', error);
    }
  }

  // 🔥 FASE 4.3: Método auxiliar para buscar participantes de um ticket
  private async getTicketParticipants(ticketId: number, excludeUserId?: number): Promise<any[]> {
    try {
      const participants = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          company_id: users.company_id
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          excludeUserId ? ne(users.id, excludeUserId) : undefined
        ));

      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${participants.length} participantes para notificar`);
      return participants;
    } catch (error) {
      console.error('[📧 EMAIL PROD] ❌ Erro ao buscar participantes:', error);
      return [];
    }
  }

  // 🔥 FASE 4.3: Método auxiliar para notificar participantes com configurações individuais
  private async notifyParticipantsWithSettings(
    participants: any[],
    notificationType: string,
    context: EmailNotificationContext,
    customMessage?: string
  ): Promise<{ sent: number; failed: number; skipped: number }> {
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const participant of participants) {
      try {
        console.log(`[📧 EMAIL PROD] -------------------------------------------`);
        console.log(`[📧 EMAIL PROD] 📧 Processando participante: ${participant.name} (${participant.email})`);

        // Verificar configurações individuais do participante
        const shouldNotify = await this.shouldSendEmailToUser(participant.id, notificationType);
        if (!shouldNotify) {
          console.log(`[📧 EMAIL PROD] 🔕 Participante ${participant.name} não configurado para receber notificações do tipo '${notificationType}'`);
          skipped++;
          continue;
        }

        // Criar contexto personalizado para o participante
        const participantContext: EmailNotificationContext = {
          ...context,
          user: participant,
          system: {
            ...context.system,
            custom_message: customMessage
          }
        };

        const result = await this.sendEmailNotification(
          notificationType,
          participant.email,
          participantContext,
          participant.company_id,
          participant.role
        );

        if (result.success) {
          sent++;
          console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${participant.name}`);
        } else {
          failed++;
          console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${participant.name}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        console.error(`[📧 EMAIL PROD] ❌ Erro ao processar participante ${participant.name}:`, error);
      }
    }

    console.log(`[📧 EMAIL PROD] 📊 RESUMO: ${sent} enviados, ${failed} falharam, ${skipped} ignorados`);
    return { sent, failed, skipped };
  }

  // 🔥 FASE 4.3: Método para gerar digest diário de tickets para participantes
  async generateDailyDigestForParticipants(companyId?: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📅 INICIANDO GERAÇÃO DE DIGEST DIÁRIO`);
      console.log(`[📧 EMAIL PROD] Empresa ID: ${companyId || 'Todas'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Buscar tickets com atividade nas últimas 24h
      const activeTickets = await db
        .select({
          id: tickets.id,
          ticket_id: tickets.ticket_id,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          company_id: tickets.company_id,
          created_at: tickets.created_at,
          updated_at: tickets.updated_at
        })
        .from(tickets)
        .where(and(
          companyId ? eq(tickets.company_id, companyId) : undefined,
          // Tickets criados ou atualizados nas últimas 24h
          or(
            gte(tickets.created_at, yesterday),
            gte(tickets.updated_at, yesterday)
          )
        ));

      console.log(`[📧 EMAIL PROD] 📊 Encontrados ${activeTickets.length} tickets ativos nas últimas 24h`);

      // Agrupar participantes por usuário
      const participantDigests = new Map<number, {
        user: any;
        tickets: any[];
        activityCount: number;
      }>();

      for (const ticket of activeTickets) {
        const participants = await this.getTicketParticipants(ticket.id);
        
        for (const participant of participants) {
          if (!participantDigests.has(participant.id)) {
            participantDigests.set(participant.id, {
              user: participant,
              tickets: [],
              activityCount: 0
            });
          }
          
          const digest = participantDigests.get(participant.id)!;
          digest.tickets.push(ticket);
          digest.activityCount++;
        }
      }

      console.log(`[📧 EMAIL PROD] 👥 Gerando digest para ${participantDigests.size} participantes`);

      // Enviar digest para cada participante
      const digestEntries = Array.from(participantDigests.entries());
      for (const [userId, digest] of digestEntries) {
        try {
          // Verificar se o usuário quer receber digest diário
          const shouldNotify = await this.shouldSendEmailToUser(userId, 'daily_digest');
          if (!shouldNotify) {
            console.log(`[📧 EMAIL PROD] 🔕 Usuário ${digest.user.name} não configurado para receber digest diário`);
            continue;
          }

          const context: EmailNotificationContext = {
            system: {
              base_url: await this.getBaseUrlForCompany(digest.user.company_id),
              company_name: 'Ticket Wise',
              support_email: 'suporte@ticketwise.com.br'
            },
            digest: {
              type: 'daily',
              date: today,
              tickets: digest.tickets,
              activity_count: digest.activityCount
            }
          };

          const result = await this.sendEmailNotification(
            'daily_digest',
            digest.user.email,
            { ...context, user: digest.user },
            digest.user.company_id,
            digest.user.role
          );

          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Digest diário enviado para ${digest.user.name}`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar digest diário para ${digest.user.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[📧 EMAIL PROD] ❌ Erro ao enviar digest diário para usuário ${userId}:`, error);
        }
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] ✅ DIGEST DIÁRIO CONCLUÍDO`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('[📧 EMAIL PROD] ❌ Erro ao gerar digest diário:', error);
    }
  }

  // 🔥 FASE 4.3: Método para gerar digest semanal de tickets para participantes
  async generateWeeklyDigestForParticipants(companyId?: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📅 INICIANDO GERAÇÃO DE DIGEST SEMANAL`);
      console.log(`[📧 EMAIL PROD] Empresa ID: ${companyId || 'Todas'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Buscar tickets com atividade na última semana
      const activeTickets = await db
        .select({
          id: tickets.id,
          ticket_id: tickets.ticket_id,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          company_id: tickets.company_id,
          created_at: tickets.created_at,
          updated_at: tickets.updated_at
        })
        .from(tickets)
        .where(and(
          companyId ? eq(tickets.company_id, companyId) : undefined,
          // Tickets criados ou atualizados na última semana
          or(
            gte(tickets.created_at, lastWeek),
            gte(tickets.updated_at, lastWeek)
          )
        ));

      console.log(`[📧 EMAIL PROD] 📊 Encontrados ${activeTickets.length} tickets ativos na última semana`);

      // Agrupar participantes por usuário
      const participantDigests = new Map<number, {
        user: any;
        tickets: any[];
        activityCount: number;
        resolvedCount: number;
        newCount: number;
      }>();

      for (const ticket of activeTickets) {
        const participants = await this.getTicketParticipants(ticket.id);
        
        for (const participant of participants) {
          if (!participantDigests.has(participant.id)) {
            participantDigests.set(participant.id, {
              user: participant,
              tickets: [],
              activityCount: 0,
              resolvedCount: 0,
              newCount: 0
            });
          }
          
          const digest = participantDigests.get(participant.id)!;
          digest.tickets.push(ticket);
          digest.activityCount++;
          
          if (ticket.status === 'resolved') {
            digest.resolvedCount++;
          } else if (ticket.status === 'new') {
            digest.newCount++;
          }
        }
      }

      console.log(`[📧 EMAIL PROD] 👥 Gerando digest semanal para ${participantDigests.size} participantes`);

      // Enviar digest para cada participante
      const weeklyDigestEntries = Array.from(participantDigests.entries());
      for (const [userId, digest] of weeklyDigestEntries) {
        try {
          // Verificar se o usuário quer receber digest semanal
          const shouldNotify = await this.shouldSendEmailToUser(userId, 'weekly_digest');
          if (!shouldNotify) {
            console.log(`[📧 EMAIL PROD] 🔕 Usuário ${digest.user.name} não configurado para receber digest semanal`);
            continue;
          }

          const context: EmailNotificationContext = {
            system: {
              base_url: await this.getBaseUrlForCompany(digest.user.company_id),
              company_name: 'Ticket Wise',
              support_email: 'suporte@ticketwise.com.br'
            },
            digest: {
              type: 'weekly',
              date: today,
              tickets: digest.tickets,
              activity_count: digest.activityCount,
              resolved_count: digest.resolvedCount,
              new_count: digest.newCount
            }
          };

          const result = await this.sendEmailNotification(
            'weekly_digest',
            digest.user.email,
            { ...context, user: digest.user },
            digest.user.company_id,
            digest.user.role
          );

          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Digest semanal enviado para ${digest.user.name}`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar digest semanal para ${digest.user.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[📧 EMAIL PROD] ❌ Erro ao enviar digest semanal para usuário ${userId}:`, error);
        }
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] ✅ DIGEST SEMANAL CONCLUÍDO`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('[📧 EMAIL PROD] ❌ Erro ao gerar digest semanal:', error);
    }
  }

  // Método auxiliar para obter cores da empresa baseado nas configurações reais
  private async getCompanyColors(companyId?: number): Promise<{
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  }> {
    try {
      if (!companyId) {
        // Cores padrão do Ticket Wise
        return {
          primary: '#1c73e8',
          primaryDark: '#1557b0',
          secondary: '#f0f0f5',
          accent: '#e8f4fd',
          background: '#f4f4f7',
          text: '#333333'
        };
      }

      // Buscar informações da empresa para determinar o tema
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company || company.length === 0) {
        // Cores padrão do Ticket Wise
        return {
          primary: '#1c73e8',
          primaryDark: '#1557b0',
          secondary: '#f0f0f5',
          accent: '#e8f4fd',
          background: '#f4f4f7',
          text: '#333333'
        };
      }

      const companyData = company[0];
      
      // Mapeamento de empresas para temas baseado no nome/domínio
      const getThemeByCompany = (companyName: string): string => {
        const name = companyName.toLowerCase();
        
        if (name.includes('vix') || name.includes('vixbrasil')) {
          return 'vix';
        } else if (name.includes('oficina') || name.includes('muda') || name.includes('oficinamuda')) {
          return 'oficinaMuda';
        } else {
          return 'default';
        }
      };

      const themeName = getThemeByCompany(companyData.name);
      
      // Definir cores baseadas no tema (mesmas do theme-context.tsx)
      const themes = {
        default: {
          primary: '#1c73e8',      // 262 83% 58%
          primaryDark: '#1557b0',
          secondary: '#f0f0f5',    // 220 14.3% 95.9%
          accent: '#e8f4fd',       // 262 83% 96%
          background: '#f4f4f7',   // 0 0% 98%
          text: '#333333'          // 224 71.4% 4.1%
        },
        vix: {
          primary: '#e6b800',      // 45 93% 47%
          primaryDark: '#b38f00',
          secondary: '#f5f2e6',    // 45 20% 95%
          accent: '#f0e6cc',       // 45 50% 90%
          background: '#faf9f2',   // 45 10% 98%
          text: '#262626'          // 45 20% 15%
        },
        oficinaMuda: {
          primary: '#4a2f1a',      // 15 58% 29%
          primaryDark: '#3a2515',
          secondary: '#5a6b4a',    // 86 15% 40%
          accent: '#e6b800',       // 45 84% 60%
          background: '#f7f6f2',   // 45 15% 97%
          text: '#262626'          // 15 45% 15%
        }
      };

      return themes[themeName as keyof typeof themes] || themes.default;
      
    } catch (error) {
      console.error('Erro ao obter cores da empresa:', error);
      // Cores padrão em caso de erro
      return {
        primary: '#1c73e8',
        primaryDark: '#1557b0',
        secondary: '#f0f0f5',
        accent: '#e8f4fd',
        background: '#f4f4f7',
        text: '#333333'
      };
    }
  }

  // Método auxiliar para obter configurações de email da empresa
  private async getEmailConfigForCompany(companyId?: number): Promise<{
    fromName: string;
    fromEmail: string;
  }> {
    try {
      if (!companyId) {
        return {
          fromName: 'Sistema de Tickets',
          fromEmail: 'noreply@ticketwise.com.br'
        };
      }
      
      const emailConfig = await emailConfigService.getEmailConfigForFrontend(companyId);
      
      return {
        fromName: emailConfig.from_name || 'Sistema de Tickets',
        fromEmail: emailConfig.from_email || 'noreply@ticketwise.com.br'
      };
    } catch (error) {
      console.error('Erro ao obter configurações de email da empresa:', error);
      return {
        fromName: 'Sistema de Tickets',
        fromEmail: 'noreply@ticketwise.com.br'
      };
    }
  }

  // Enviar pesquisa de satisfação quando ticket é resolvido
  async sendSatisfactionSurvey(ticketId: number): Promise<void> {
    try {
      console.log(`[📧 SATISFACTION] 🔍 Iniciando envio de pesquisa de satisfação para ticket ${ticketId}`);
      console.log(`[📧 SATISFACTION] 📊 NODE_ENV: ${process.env.NODE_ENV}`);
      
      // Buscar detalhes completos do ticket
      const [ticket] = await db
        .select({
          id: tickets.id,
          ticket_id: tickets.ticket_id,
          title: tickets.title,
          customer_email: tickets.customer_email,
          company_id: tickets.company_id,
          department_id: tickets.department_id,
          assigned_to_id: tickets.assigned_to_id,
          resolved_at: tickets.resolved_at,
        })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        console.log(`[📧 SATISFACTION] ❌ Ticket ${ticketId} não encontrado`);
        return;
      }

      if (!ticket.customer_email) {
        console.log(`[📧 SATISFACTION] ❌ Ticket ${ticketId} não tem email do cliente`);
        return;
      }

      // Verificar se o departamento tem pesquisa de satisfação ativada
      if (ticket.department_id) {
        const [department] = await db
          .select({
            satisfaction_survey_enabled: departments.satisfaction_survey_enabled
          })
          .from(departments)
          .where(eq(departments.id, ticket.department_id))
          .limit(1);

        if (!department?.satisfaction_survey_enabled) {
          console.log(`[📧 SATISFACTION] 🔕 Departamento ${ticket.department_id} não tem pesquisa de satisfação ativada`);
          return;
        }
      }

      // Buscar dados do cliente
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.email, ticket.customer_email))
        .limit(1);

      // Buscar dados do atendente responsável
      let assignedOfficial = null;
      if (ticket.assigned_to_id) {
        const [official] = await db
          .select()
          .from(officials)
          .where(eq(officials.id, ticket.assigned_to_id))
          .limit(1);
        assignedOfficial = official;
      }

      // Gerar token único para a pesquisa
      const surveyToken = this.generateSurveyToken();
      
      // Criar registro da pesquisa de satisfação
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

      const [surveyRecord] = await db
        .insert(satisfactionSurveys)
        .values({
          ticket_id: ticket.id,
          company_id: ticket.company_id!,
          customer_email: ticket.customer_email,
          survey_token: surveyToken,
          expires_at: expiresAt,
          status: 'sent'
        })
        .returning();

      console.log(`[📧 SATISFACTION] ✅ Registro de pesquisa criado com token: ${surveyToken}`);

      // Buscar dados da empresa para o domínio personalizado
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, ticket.company_id!))
        .limit(1);

      // Construir link da pesquisa com domínio personalizado
      const baseUrl = company?.domain || 'app.ticketwise.com.br';
      const surveyLink = `https://${baseUrl}/satisfaction/${surveyToken}`;

      // 🧪 DESENVOLVIMENTO: Log do link da pesquisa para testes
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔗 PESQUISA DE SATISFAÇÃO GERADA (DESENVOLVIMENTO)`);
        console.log(`📧 Cliente: ${ticket.customer_email}`);
        console.log(`🎫 Ticket #${ticket.ticket_id}: "${ticket.title}"`);
        console.log(`🌐 Link da pesquisa: http://localhost:5173/satisfaction/${surveyToken}`);
        console.log(`⏰ Expira em: 7 dias (${expiresAt.toLocaleDateString('pt-BR')})`);
        console.log(`🔑 Token: ${surveyToken}`);
        console.log(`-------------------------------------------\n`);
      }

      // Preparar contexto do email
      const context: EmailNotificationContext = {
        ticket: {
          ...ticket,
          assigned_official_name: assignedOfficial?.name || 'Não atribuído',
          resolved_at_formatted: ticket.resolved_at?.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) || new Date().toLocaleDateString('pt-BR')
        },
        customer: {
          name: customer?.name || 'Cliente',
          email: ticket.customer_email
        },
        survey: {
          link: surveyLink,
          token: surveyToken,
          expires_at: expiresAt
        },
        system: {
          company_name: company?.name || 'Sistema de Tickets',
          colors: {
            primary: company?.primary_color || '#3B82F6',
            primaryDark: company?.primary_dark_color || '#1E40AF',
            secondary: company?.secondary_color || '#F3F4F6',
            accent: company?.accent_color || '#10B981',
            background: company?.background_color || '#F9FAFB',
            text: company?.text_color || '#111827'
          }
        }
      };

      // Enviar email de pesquisa de satisfação
      const result = await this.sendEmailNotification(
        'satisfaction_survey',
        ticket.customer_email,
        context,
        ticket.company_id!,
        'customer'
      );

      if (result.success) {
        console.log(`[📧 SATISFACTION] ✅ Pesquisa de satisfação enviada com sucesso para ${ticket.customer_email}`);
      } else {
        console.log(`[📧 SATISFACTION] ❌ Falha ao enviar pesquisa de satisfação: ${result.error}`);
        
        // Marcar pesquisa como falha no envio
        await db
          .update(satisfactionSurveys)
          .set({ status: 'failed' })
          .where(eq(satisfactionSurveys.id, surveyRecord.id));
      }

    } catch (error) {
      console.error(`[📧 SATISFACTION] ❌ Erro ao enviar pesquisa de satisfação:`, error);
    }
  }

  // Gerar token único para pesquisa de satisfação
  private generateSurveyToken(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `survey_${timestamp}_${randomPart}`;
  }

}

export const emailNotificationService = new EmailNotificationService(); 