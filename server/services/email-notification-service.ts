import { db } from '../db';
import { emailTemplates, userNotificationSettings, users, tickets, customers, officials, officialDepartments, companies, ticketParticipants, ticketStatusHistory, departments, satisfactionSurveys, ticketReplies } from '@shared/schema';
import { eq, and, isNull, inArray, not, ne, notInArray, or, gte, gt, desc } from 'drizzle-orm';
import { storage } from '../storage';
import { emailConfigService } from './email-config-service';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { PriorityService } from "./priority-service";
import { slaService } from './sla-service';
import { 
  calculateEffectiveBusinessTime,
  convertStatusHistoryToPeriods,
  getBusinessHoursConfig,
  addBusinessTime
} from '@shared/utils/sla-calculator';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';
import { 
  translateStatus, 
  translatePriority, 
  translateRole, 
  detectLanguageFromDomain,
  type SupportedLanguage 
} from '../utils/status-translations';
import { resolveDevEmail } from '../utils/email-dev';
import { log as dbLog } from './db-logger';

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
  survey?: {
    link: string;
    token: string;
    expires_at: Date;
    days_until_expiration?: number;
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

      // Controle de e-mail em desenvolvimento (não enviar ou redirecionar para e-mail de teste)
      const devEmail = resolveDevEmail(recipientEmail);
      if (!devEmail.send) {
        console.log(`[📧 EMAIL DEV] Envio desabilitado em desenvolvimento. Destinatário original: ${devEmail.originalTo}`);
        dbLog.info(`Email não enviado (modo dev): ${templateType}`, {
          tipo: 'email',
          template: templateType,
          destinatario: devEmail.originalTo,
          motivo: 'Envio desabilitado em desenvolvimento',
          company_id: companyId,
        });
        return { success: true };
      }
      const effectiveRecipient = devEmail.to;
      if (effectiveRecipient !== devEmail.originalTo) {
        console.log(`[📧 EMAIL DEV] Redirecionado para: ${effectiveRecipient} (original: ${devEmail.originalTo})`);
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
        dbLog.warn(`Email não enviado (config incompleta): ${templateType}`, {
          tipo: 'email',
          template: templateType,
          destinatario: recipientEmail,
          motivo: 'Configuração de email inexistente ou incompleta',
          company_id: validatedCompanyId,
          provider: emailConfig?.provider || 'nenhum',
        });
        return { success: false, error: 'Configuração de email inexistente ou incompleta para a empresa. Nenhum email enviado.' };
      }

      // 4. Buscar template
      const template = await this.getEmailTemplate(templateType, validatedCompanyId);
      if (!template) {
        dbLog.warn(`Email não enviado (template ausente): ${templateType}`, {
          tipo: 'email',
          template: templateType,
          destinatario: recipientEmail,
          motivo: `Template '${templateType}' não encontrado`,
          company_id: validatedCompanyId,
        });
        return { success: false, error: `Template '${templateType}' não encontrado. Configure em Configurações > Email > Templates.` };
      }

      // 5. Renderizar template com contexto enriquecido
      const renderedSubject = await this.renderTemplate(template.subject_template, enrichedContext, validatedCompanyId);
      const renderedHtml = await this.renderTemplate(template.html_template, enrichedContext, validatedCompanyId);
      const renderedText = template.text_template ? await this.renderTemplate(template.text_template, enrichedContext, validatedCompanyId) : undefined;
      const finalHtml = this.ensureUtf8Html(renderedHtml);

            // 6. Configurar transporter
      try {
        const transporter = await this.createTransporter(emailConfig);

        // 7. Enviar email
        const mailOptions = {
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          to: effectiveRecipient,
          subject: renderedSubject,
          html: finalHtml,
          text: renderedText,
          headers: {
            'MIME-Version': '1.0',
            'Content-Language': 'pt-BR',
            'X-Priority': '3',
            'X-Mailer': 'TicketWise Email Service',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
          },
          encoding: 'utf8'
        };

        const _result = await transporter.sendMail(mailOptions);

        dbLog.info(`Email enviado: ${templateType} → ${effectiveRecipient}`, {
          tipo: 'email',
          template: templateType,
          destinatario: effectiveRecipient,
          assunto: renderedSubject,
          company_id: validatedCompanyId,
          provider: emailConfig.provider,
          ticket_id: context.ticket?.id,
          ticket_code: context.ticket?.ticket_id,
        });

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
        dbLog.error(`Falha ao enviar email: ${templateType} → ${effectiveRecipient}`, {
          tipo: 'email',
          template: templateType,
          destinatario: effectiveRecipient,
          company_id: validatedCompanyId,
          provider: emailConfig.provider,
          erro: (transporterError as any)?.message,
          erro_code: (transporterError as any)?.code,
          ticket_id: context.ticket?.id,
        });
        return { success: false, error: `Erro no envio: ${String(transporterError)}. Verifique as configurações de email.` };
      }

    } catch (error) {
      console.error(`[📧 EMAIL PROD] ❌ ERRO GERAL ao enviar email para ${effectiveRecipient}:`, error);
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
  private async renderTemplate(template: string, context: EmailNotificationContext, companyId?: number): Promise<string> {
    if (!template || typeof template !== 'string') {
      return '';
    }

    let rendered = template;

    // Detectar idioma baseado no domínio da empresa
    let language: SupportedLanguage = 'pt-BR';
    if (companyId) {
      try {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId))
          .limit(1);
        
        if (company?.domain) {
          language = detectLanguageFromDomain(company.domain);
        }
      } catch (error) {
        console.error('Erro ao detectar idioma da empresa:', error);
        // Mantém o idioma padrão pt-BR
      }
    }

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
      rendered = rendered.replace(/\{\{ticket\.status_text\}\}/g, translateStatus(ticket.status || '', language));
      rendered = rendered.replace(/\{\{ticket\.priority_text\}\}/g, translatePriority(ticket.priority || '', language));
      
      // Link do ticket (usando system.base_url)
      if (context.system?.base_url) {
        rendered = rendered.replace(/\{\{ticket\.link\}\}/g, `${context.system.base_url}/tickets/${ticket.id}`);
      }
      Object.entries(ticket).forEach(([key, value]) => {
        const placeholder = "{{ticket." + key + "}}";
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const replacement = value === undefined || value === null ? "" : String(value);
        rendered = rendered.replace(new RegExp(escaped, "g"), replacement);
      });
    }

    // 2. DADOS DO SOLICITANTE - TODAS as variáveis da lista
    if (context.customer) {
      const customer = context.customer;
      
      // {{customer.name}} - Nome do solicitante
      rendered = rendered.replace(/\{\{customer\.name\}\}/g, String(customer.name || ''));
      
      // {{customer.email}} - Email do solicitante
      rendered = rendered.replace(/\{\{customer\.email\}\}/g, String(customer.email || ''));
      
      // {{customer.phone}} - Telefone do solicitante
      rendered = rendered.replace(/\{\{customer\.phone\}\}/g, String(customer.phone || ''));
      
      // {{customer.company}} - Empresa do solicitante
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
      rendered = rendered.replace(/\{\{user\.role_text\}\}/g, translateRole(user.role || '', language));
    }

    // 4. DADOS DO ATENDENTE/OFICIAL (mantido para compatibilidade)
    if (context.official) {
      const official = context.official;
      
      Object.entries(official).forEach(([key, value]) => {
        const placeholder = `{{official.${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
      });

      // Variáveis formatadas do oficial
      rendered = rendered.replace(/\{\{official\.role_text\}\}/g, translateRole(official.role || '', language));
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
        rendered = rendered.replace(/\{\{reply\.user\.role_text\}\}/g, translateRole(replyUser.role || '', language));
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
        rendered = rendered.replace(/\{\{status_change\.changed_by\.role_text\}\}/g, translateRole(changedByUser.role || '', language));
      }

      // Variáveis formatadas de status (mantidas para compatibilidade)
      rendered = rendered.replace(/\{\{status_change\.old_status_text\}\}/g, translateStatus(statusChange.old_status || '', language));
      rendered = rendered.replace(/\{\{status_change\.new_status_text\}\}/g, translateStatus(statusChange.new_status || '', language));
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

    // 8. VARIÁVEIS DE PESQUISA DE SATISFAÇÃO
    if (context.survey) {
      const survey = context.survey;
      
      // {{survey.link}} - Link da pesquisa de satisfação
      rendered = rendered.replace(/\{\{survey\.link\}\}/g, String(survey.link || ''));
      
      // {{survey.token}} - Token da pesquisa
      rendered = rendered.replace(/\{\{survey\.token\}\}/g, String(survey.token || ''));
      
      // {{survey.expires_at}} - Data de expiração
      if (survey.expires_at) {
        const expiresFormatted = survey.expires_at instanceof Date 
          ? survey.expires_at.toLocaleDateString('pt-BR')
          : String(survey.expires_at);
        rendered = rendered.replace(/\{\{survey\.expires_at\}\}/g, expiresFormatted);
      }

      // Outras propriedades da pesquisa
      Object.entries(survey).forEach(([key, value]) => {
        if (!['link', 'token', 'expires_at'].includes(key)) { // Já tratados acima
          const placeholder = `{{survey.${key}}}`;
          rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
        }
      });
    }

    // 9. VARIÁVEIS GLOBAIS DE COMPATIBILIDADE (para templates antigos)
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

  // Garante que o HTML tenha meta charset UTF-8 e estrutura completa para Gmail
  private ensureUtf8Html(html: string | undefined): string | undefined {
    if (!html || typeof html !== 'string') return html;

    // Verificar se já tem estrutura HTML completa
    const hasHtmlTag = /<html[^>]*>/i.test(html);
    const hasHeadTag = /<head[^>]*>/i.test(html);
    const hasBodyTag = /<body[^>]*>/i.test(html);
    const hasCharsetMeta = /<meta[^>]*charset\s*=\s*"?utf-8"?/i.test(html);
    const hasContentTypeMeta = /<meta[^>]*http-equiv\s*=\s*"?content-type"?/i.test(html);

    // Se já tem estrutura completa e charset, retornar como está
    if (hasHtmlTag && hasHeadTag && hasBodyTag && (hasCharsetMeta || hasContentTypeMeta)) {
      return html;
    }

    // Criar estrutura HTML completa para garantir compatibilidade com Gmail
    const metaTags = `
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no">
    <meta name="format-detection" content="date=no">
    <meta name="format-detection" content="address=no">
    <meta name="format-detection" content="email=no">`;

    // Se já tem tags HTML, apenas adicionar metas necessárias
    if (hasHtmlTag && hasHeadTag) {
      if (!hasCharsetMeta && !hasContentTypeMeta) {
        return html.replace(/<head[^>]*>/i, (match) => `${match}\n${metaTags}`);
      }
      return html;
    }

    // Se tem apenas conteúdo HTML sem estrutura, envolver em estrutura completa
    const completeHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>${metaTags}
    <title>Email Notification</title>
    <style type="text/css">
        /* Reset básico para email */
        body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        /* Garantir que o Gmail não altere as cores */
        .gmail-fix {
            color: inherit !important;
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <div class="gmail-fix">
        ${html}
    </div>
</body>
</html>`;

    return completeHtml;
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
        // Configurações específicas para melhorar compatibilidade com Gmail
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        // Headers padrão para melhor entrega
        defaults: {
          headers: {
            'X-Mailer': 'TicketWise Email Service',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
          }
        }
      } as any);
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
        // Configurações específicas para melhorar compatibilidade com Gmail
        tls: {
          rejectUnauthorized: false
        },
        // Headers padrão para melhor entrega
        defaults: {
          headers: {
            'X-Mailer': 'TicketWise Email Service',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
          }
        }
      } as any);
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
        // Configurações específicas para melhorar compatibilidade com Gmail
        tls: {
          rejectUnauthorized: false
        },
        // Headers padrão para melhor entrega
        defaults: {
          headers: {
            'X-Mailer': 'TicketWise Email Service',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
          }
        }
      } as any);
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
        // Configurações específicas para melhorar compatibilidade com Gmail
        tls: {
          rejectUnauthorized: false
        },
        // Headers padrão para melhor entrega
        defaults: {
          headers: {
            'X-Mailer': 'TicketWise Email Service',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal'
          }
        }
      } as any);
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

      // 🔥 NOVA LÓGICA: Se não tem configurações, enviar por padrão
      if (!settings) {
        return true;
      }

      // 🔥 NOVA LÓGICA: Só não envia se email_notifications estiver EXPLICITAMENTE false
      // Se for null/undefined, considera como true (padrão)
      if (settings.email_notifications === false) {
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

      // 🔥 NOVA LÓGICA: Verificar configuração específica do tipo
      const settingKey = typeMap[notificationType];
      if (settingKey && settingKey in settings) {
        // Só não envia se estiver EXPLICITAMENTE false
        return settings[settingKey] !== false;
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
        const found = result.priorities.find(p => p.name?.toLowerCase() === ticket.priority?.toLowerCase());
        if (found) {
          priorityText = found.name;
        } else {
          // Fallback para tradução padrão
          const map: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
          priorityText = map[ticket.priority] || ticket.priority;
        }
      }
    } catch (_e) {
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

      // Buscar dados do solicitante
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
          name: 'Solicitante', 
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

      let _emailsSent = 0;
      let _emailsFailed = 0;

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
          _emailsSent++;
        } else {
          _emailsFailed++;
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
        dbLog.warn(`Email não enviado: ticket não encontrado`, {
          tipo: 'email',
          evento: 'ticket_assigned',
          ticket_id: ticketId,
          atendente_id: assignedToId,
          motivo: 'Ticket não encontrado no banco',
        });
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
        dbLog.warn(`Email não enviado: atendente não encontrado`, {
          tipo: 'email',
          evento: 'ticket_assigned',
          ticket_id: ticketId,
          ticket_code: ticket.ticket_id,
          atendente_id: assignedToId,
          motivo: 'Atendente não encontrado ou inativo',
          company_id: ticket.company_id,
        });
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Atendente encontrado (official):`);
      console.log(`[📧 EMAIL PROD] - ID: ${official.id}`);
      console.log(`[📧 EMAIL PROD] - Nome: ${official.name}`);
      console.log(`[📧 EMAIL PROD] - Email: ${official.email}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${official.company_id}`);

      // Buscar dados do solicitante DIRETO DA TABELA CUSTOMERS
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
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
        dbLog.info(`Email não enviado (preferência do usuário): ticket_assigned`, {
          tipo: 'email',
          template: 'ticket_assigned',
          destinatario: official.email,
          atendente: official.name,
          motivo: 'Usuário desabilitou notificações de atribuição',
          ticket_id: ticketId,
          ticket_code: ticket.ticket_id,
          company_id: ticket.company_id,
        });
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO DE ATRIBUIÇÃO`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Atendente: ${official.name} (${official.email})`);
      console.log(`[📧 EMAIL PROD] Sucesso: ${shouldNotify ? 'Sim' : 'Não (configurações)'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);

    } catch (error) {
      console.error('Erro ao enviar notificação de ticket atribuído:', error);
      dbLog.error(`Erro ao processar email: atribuição de ticket`, {
        tipo: 'email',
        evento: 'ticket_assigned',
        ticket_id: ticketId,
        atendente_id: assignedToId,
        erro: (error as any)?.message || String(error),
      });
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
      // Se for atendente, buscar em officials; se for solicitante, buscar em customers
      let replyUser = null;
      if (ticket.assigned_to_id && replyUserId === ticket.assigned_to_id) {
        // Atendente responsável respondeu
        [replyUser] = await db
          .select()
          .from(officials)
          .where(and(eq(officials.id, replyUserId), eq(officials.is_active, true)))
          .limit(1);
      } else {
        // Solicitante respondeu (ou outro)
        [replyUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, replyUserId), eq(users.active, true)))
          .limit(1);
      }
      if (!replyUser) return;
      // Buscar dados do solicitante DIRETO DA TABELA CUSTOMERS
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
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

      // NOVA LÓGICA: Se o ticket tem responsável, notificar só ele e o solicitante
      if (ticket.assigned_to_id) {
        // Se quem respondeu foi o solicitante, notificar só o responsável
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
          // Se quem respondeu foi o responsável, notificar só o solicitante
          if (customer) {
            const shouldNotify = typeof customer.id === 'number' ? await this.shouldSendEmailToUser(customer.id, 'ticket_reply') : false;
            if (shouldNotify) {
              // 🔥 CORREÇÃO: Criar contexto personalizado para o solicitante
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

      // 🔥 LÓGICA ATUALIZADA FASE 4.1: Se quem respondeu foi o solicitante, notificar ATENDENTES + PARTICIPANTES
      if ('role' in replyUser && replyUser.role === 'customer') {
        console.log(`[📧 EMAIL PROD] 📧 Solicitante respondeu - notificando atendentes e participantes do departamento ${ticket.department_id}`);
        
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
            `Há uma nova resposta de solicitante no ticket #${ticket.ticket_id}: "${ticket.title}".`
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

  /**
   * Envia o alerta de 48h (ticket será encerrado em 24h por falta de interação).
   * Disparo obrigatório: não verifica preferências de notificação do solicitante.
   */
  async sendWaitingCustomerClosureAlert(ticketId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [ticketRow] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (!ticketRow || !ticketRow.company_id) {
        return { success: false, error: 'Ticket não encontrado ou sem empresa' };
      }
      let customer = null;
      if (ticketRow.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticketRow.customer_id))
          .limit(1);
      }
      const context: EmailNotificationContext = {
        ticket: await this.mapTicketFields(ticketRow),
        customer: customer || { name: 'Solicitante', email: ticketRow.customer_email },
        system: {}
      };
      return await this.sendEmailNotification(
        'waiting_customer_closure_alert',
        ticketRow.customer_email,
        context,
        ticketRow.company_id,
        'customer'
      );
    } catch (error) {
      console.error('[📧 EMAIL PROD] Erro ao enviar alerta de encerramento por falta de interação:', error);
      return { success: false, error: String(error) };
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
      console.log(`[📧 DEBUG] 🔍 INICIANDO MÉTODO notifyStatusChanged para ticket ${ticketId}`);

      // Buscar dados do ticket
      console.log(`[📧 EMAIL PROD] 🔍 Buscando ticket ID: ${ticketId}`);
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      
      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ TICKET ${ticketId} NÃO ENCONTRADO! ISSO É IMPOSSÍVEL!`);
        return;
      }
      
      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado: ${ticket.ticket_id}`);

      // REMOVIDO: Pesquisa de satisfação duplicada - já é enviada no final da função (linha 1739)

      // Buscar dados do solicitante DIRETO DA TABELA CUSTOMERS
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

      // Buscar domínio da empresa para detectar idioma
      let companyDomain: string | null = null;
      if (ticket.company_id) {
        const [company] = await db
          .select({ domain: companies.domain })
          .from(companies)
          .where(eq(companies.id, ticket.company_id))
          .limit(1);
        companyDomain = company?.domain || null;
      }

      // Detectar idioma baseado no domínio da empresa
      const language = detectLanguageFromDomain(companyDomain);
      console.log(`[📧 EMAIL PROD] 🌐 Idioma detectado: ${language} (domínio: ${companyDomain || 'N/A'})`);

      // Usar módulo centralizado de tradução
      const oldStatusText = translateStatus(oldStatus, language);
      const newStatusText = translateStatus(newStatus, language);

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id !== null && ticket.company_id !== undefined ? ticket.company_id : undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
        user: changedByUser,
        status_change: {
          old_status: oldStatusText,
          new_status: newStatusText,
          created_at: new Date(),
          changed_by: changedByUser
        },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // NOVA LÓGICA: Se o ticket tem responsável, notificar só ele (exceto se ele mesmo alterou) e o solicitante
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
        // Notificar solicitante normalmente
        if (customer) {
          const shouldNotify = await this.shouldSendEmailToUser(customer.id, (newStatus === 'resolved' || newStatus === 'closed') ? 'ticket_resolved' : 'status_changed');
          if (shouldNotify) {
            // 🔥 CORREÇÃO: Criar contexto personalizado para o solicitante
            const customerContext: EmailNotificationContext = {
              ...context,
              user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                role: 'customer'
              }
            };
            
            // Determinar o template correto baseado no status
            let templateType = 'status_changed';
            if (newStatus === 'resolved') {
              templateType = 'ticket_resolved';
            } else if (newStatus === 'closed') {
              templateType = 'ticket_closed';
            }
            
            await this.sendEmailNotification(
              templateType,
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
            `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatusText}" para "${newStatusText}".`
          );
        }
        return;
      }

      // 🔥 DEBUG: SEMPRE MOSTRAR DADOS DO TICKET
      console.log(`[📧 EMAIL PROD] 🔍 TICKET DADOS:`, {
        id: ticket.id,
        ticket_id: ticket.ticket_id,
        customer_email: ticket.customer_email,
        department_id: ticket.department_id,
        title: ticket.title?.substring(0, 50)
      });

      // 🔥 NOTIFICAR O SOLICITANTE (sempre que houver email)
      console.log(`[📧 EMAIL PROD] 🔍 Verificando se ticket tem email do solicitante: ${ticket.customer_email || 'SEM EMAIL'}`);
      if (ticket.customer_email) {
        console.log(`[📧 EMAIL PROD] 📧 Notificando solicitante sobre mudança de status: ${ticket.customer_email}`);
        
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        // 🔥 NOVA LÓGICA: Por padrão solicitante recebe, só não envia se explicitamente desativado
        const shouldNotify = customerUser
          ? await this.shouldSendEmailToUser(customerUser.id, (newStatus === 'resolved' || newStatus === 'closed') ? 'ticket_resolved' : 'status_changed')
          : true; // Se não é usuário registrado, sempre envia

        if (shouldNotify) {
          // 🔥 CORREÇÃO: Criar contexto personalizado para o solicitante
          const customerContext: EmailNotificationContext = {
            ...context,
            user: customerUser || {
              id: 0,
              name: customer?.name || 'Solicitante',
              email: ticket.customer_email,
              role: 'customer'
            }
          };
          
          // Determinar o template correto baseado no status
          let templateType = 'status_changed';
          if (newStatus === 'resolved') {
            templateType = 'ticket_resolved';
          } else if (newStatus === 'closed') {
            templateType = 'ticket_closed';
          }
          
          const result = await this.sendEmailNotification(
            templateType,
            ticket.customer_email,
            customerContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            customerUser?.role || 'customer' // Passar a role do solicitante para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de mudança de status enviado com sucesso para solicitante`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de mudança de status para solicitante: ${result.error}`);
          }

          // 🎯 PESQUISA DE SATISFAÇÃO SERÁ ENVIADA INDEPENDENTE DAS NOTIFICAÇÕES (ver abaixo)
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Solicitante não configurado para receber notificações de mudança de status`);
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
          `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatusText}" para "${newStatusText}".`
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
      console.log(`[📧 DEBUG] 🔍 CHEGOU NO FINAL DO TRY - ANTES DO CATCH`);

    } catch (error) {
      console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO em notifyStatusChanged para ticket ${ticketId}:`, error);
      console.error(`[📧 EMAIL PROD] ❌ Stack trace:`, (error as any)?.stack);
      console.error(`[📧 SATISFACTION] ❌ Erro na notificação, mas pesquisa de satisfação será executada mesmo assim...`);
    }

    // 🎯 PESQUISA DE SATISFAÇÃO EXECUTADA FORA DO TRY/CATCH PARA GARANTIR QUE SEMPRE FUNCIONE
    try {
      console.log(`[📧 SATISFACTION] 🔍 Verificando se deve enviar pesquisa: newStatus=${newStatus}, ticketId=${ticketId}`);
      if (newStatus === 'resolved' || newStatus === 'closed') {
        console.log(`[📧 SATISFACTION] 🎯 Ticket finalizado (${newStatus}), iniciando envio de pesquisa de satisfação (FORA DO TRY/CATCH)`);
        
        // Enviar pesquisa de satisfação de forma assíncrona (não bloquear o fluxo principal)
        this.sendSatisfactionSurvey(ticketId).catch((surveyError) => {
          console.error(`[📧 SATISFACTION] ❌ Erro ao enviar pesquisa de satisfação:`, surveyError);
          console.error(`[📧 SATISFACTION] ❌ Stack trace:`, (surveyError as any)?.stack);
        });
      } else {
        console.log(`[📧 SATISFACTION] ⏭️ Status não é 'resolved' ou 'closed', pulando pesquisa de satisfação`);
      }
    } catch (satisfactionError) {
      console.error(`[📧 SATISFACTION] ❌ Erro crítico na pesquisa de satisfação:`, satisfactionError);
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
      // Buscar dados do solicitante DIRETO DA TABELA CUSTOMERS
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
        user: escalatedByUser,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // 🔥 NOTIFICAR O SOLICITANTE (sempre que houver email)
      if (ticket.customer_email) {
        console.log(`[📧 EMAIL PROD] 📧 Notificando solicitante sobre escalação: ${ticket.customer_email}`);
        
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        const shouldNotify = customerUser
          ? await this.shouldSendEmailToUser(customerUser.id, 'ticket_escalated')
          : true;

        if (shouldNotify) {
          // Personalizar contexto para o solicitante destinatário
          const customerContext: EmailNotificationContext = {
            ...context,
            user: customerUser || {
              id: 0,
              name: customer?.name || 'Solicitante',
              email: ticket.customer_email,
              role: 'customer'
            }
          };

          const result = await this.sendEmailNotification(
            'ticket_escalated',
            ticket.customer_email,
            customerContext,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            customerUser?.role || 'customer' // Passar a role do solicitante para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de escalação enviado com sucesso para solicitante`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de escalação para solicitante: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Solicitante não configurado para receber notificações de escalação`);
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
      // Buscar dados do solicitante DIRETO DA TABELA CUSTOMERS
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
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
      // Buscar dados do solicitante
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
          'customer_registered',
          notifyUser.email,
          personalizedContext,
          customer.company_id || undefined,
          notifyUser.role
        );
      }
    } catch (error) {
      console.error('Erro ao notificar novo solicitante registrado:', error);
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

      // Buscar tickets ativos (excluir resolvidos e encerrados - SLA já finalizado) que ainda não violaram SLA
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
            notInArray(tickets.status, ['resolved', 'closed']),
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
        // Tickets encerrados ou resolvidos não devem receber alertas nem escalação de SLA
        if (isSlaFinished(currentStatus)) {
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
          // 🔥 CORREÇÃO: Enviar notificação persistente + email
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyTicketDueSoon(ticket.id, Math.round(hoursRemaining));
          // Também enviar email (já estava fazendo)
          await this.notifyTicketDueSoon(ticket.id, Math.round(hoursRemaining));
        }

        // Marcar como vencido e escalar se passou do prazo
        if (elapsedHours >= targetSlaHours) {
          await db
            .update(tickets)
            .set({ sla_breached: true })
            .where(eq(tickets.id, ticket.id));

          // 🔥 CORREÇÃO: Enviar notificação persistente + email
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyTicketEscalated(
            ticket.id,
            undefined,
            `Ticket escalado automaticamente por violação de SLA de ${typeLabel} (${targetSlaHours}h). Tempo efetivo decorrido: ${elapsedHours.toFixed(1)}h`
          );
          // Também enviar email (já estava fazendo)
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

      // Buscar dados do solicitante
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
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

      // Buscar dados do solicitante
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
        customer: customer || { name: 'Solicitante', email: ticket.customer_email },
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

          const companyId = participant.company_id ?? context.ticket?.company_id;
          if (companyId === undefined) continue;
          const result = await this.sendEmailNotification(
            notificationType,
            participant.email,
            participantContext,
            companyId,
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

  // Enviar pesquisa de satisfação quando ticket é resolvido ou encerrado
  async sendSatisfactionSurvey(ticketId: number): Promise<void> {
    try {
      console.log(`[📧 SATISFACTION] 🔍 Iniciando envio de pesquisa de satisfação para ticket ${ticketId}`);
      console.log(`[📧 SATISFACTION] 📊 NODE_ENV: ${process.env.NODE_ENV}`);
      
      // Buscar dados do ticket com JOIN na tabela customers (seguindo padrão dos outros métodos)
      const [ticketData] = await db
        .select({
          // Dados do ticket
          ticket_id: tickets.id,
          ticket_number: tickets.ticket_id,
          title: tickets.title,
          company_id: tickets.company_id,
          department_id: tickets.department_id,
          assigned_to_id: tickets.assigned_to_id,
          resolved_at: tickets.resolved_at,
          // Dados do solicitante via JOIN
          customer_id: customers.id,
          customer_name: customers.name,
          customer_email: customers.email
        })
        .from(tickets)
        .innerJoin(customers, eq(tickets.customer_id, customers.id))
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticketData) {
        console.log(`[📧 SATISFACTION] ❌ Ticket ${ticketId} não encontrado ou sem solicitante associado`);
        return;
      }

      console.log(`[📧 SATISFACTION] ✅ Dados encontrados:`);
      console.log(`[📧 SATISFACTION] - Ticket: ${ticketData.ticket_number}`);
      console.log(`[📧 SATISFACTION] - Solicitante: ${ticketData.customer_name} (${ticketData.customer_email})`);
      console.log(`[📧 SATISFACTION] - Departamento: ${ticketData.department_id}`);

      // Verificar se o departamento tem pesquisa de satisfação ativada (department_id é obrigatório)
      const [department] = await db
        .select({
          satisfaction_survey_enabled: departments.satisfaction_survey_enabled
        })
        .from(departments)
        .where(eq(departments.id, ticketData.department_id!))
        .limit(1);

      if (!department?.satisfaction_survey_enabled) {
        console.log(`[📧 SATISFACTION] 🔕 Departamento ${ticketData.department_id} não tem pesquisa de satisfação ativada`);
        return;
      }

      console.log(`[📧 SATISFACTION] ✅ Departamento tem pesquisa de satisfação ativada - prosseguindo com envio`);

      // Buscar dados do atendente responsável (seguindo padrão dos outros métodos)
      let assignedOfficial = null;
      if (ticketData.assigned_to_id) {
        [assignedOfficial] = await db
          .select()
          .from(officials)
          .where(eq(officials.id, ticketData.assigned_to_id))
          .limit(1);
      }

      // Gerar token único para a pesquisa
      const surveyToken = this.generateSurveyToken();
      
      // Criar registro da pesquisa de satisfação
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

      const [_surveyRecord] = await db
        .insert(satisfactionSurveys)
        .values({
          ticket_id: ticketData.ticket_id,
          company_id: ticketData.company_id!,
          customer_email: ticketData.customer_email,
          survey_token: surveyToken,
          expires_at: expiresAt,
          status: 'sent'
        })
        .returning();

      console.log(`[📧 SATISFACTION] ✅ Registro de pesquisa criado com token: ${surveyToken}`);

      // Obter URL base usando o método já existente (seguindo padrão dos outros métodos)
      const baseUrl = await this.getBaseUrlForCompany(ticketData.company_id || undefined);
      const surveyLink = `${baseUrl}/satisfaction/${surveyToken}`;

      console.log(`[📧 SATISFACTION] ✅ URL base obtida: ${baseUrl}`);

      // Buscar dados da empresa para o nome
      const [company] = await db
        .select({
          id: companies.id,
          name: companies.name,
          domain: companies.domain
        })
        .from(companies)
        .where(eq(companies.id, ticketData.company_id!))
        .limit(1);

      // Definir cores baseadas no domínio (igual ao index.html)
      let themeColors = {
        primary: '#3B82F6',
        primaryDark: '#1E40AF', 
        secondary: '#F3F4F6',
        accent: '#10B981',
        background: '#F9FAFB',
        text: '#111827'
      };

      // Detectar tema pelo domínio (seguindo lógica do index.html)
      if (baseUrl.includes('vixbrasil.com')) {
        // Tema VIX (amarelo/dourado) - convertendo HSL para hex equivalente
        themeColors = {
          primary: '#D4A017',      // hsl(45, 93%, 47%)
          primaryDark: '#B8860B',  // hsl(45, 93%, 37%)
          secondary: '#F5F5DC',    // hsl(45, 20%, 95%)
          accent: '#F0E68C',       // hsl(45, 50%, 90%)
          background: '#FFFEF7',   // hsl(45, 10%, 98%)
          text: '#2F2F1F'          // hsl(45, 20%, 15%)
        };
      } else if (baseUrl.includes('oficinamuda.com')) {
        // Tema Oficina Muda (azul escuro) - convertendo HSL para hex equivalente
        themeColors = {
          primary: '#005A8B',      // hsl(200, 100%, 35%)
          primaryDark: '#003F5C',  // hsl(200, 100%, 25%)
          secondary: '#E6F3FF',    // hsl(200, 20%, 95%)
          accent: '#CCE7FF',       // hsl(200, 50%, 90%)
          background: '#F7FBFF',   // hsl(200, 10%, 98%)
          text: '#1A2B33'          // hsl(200, 20%, 15%)
        };
      }

      console.log(`[📧 SATISFACTION] 🎨 Tema aplicado baseado no domínio: ${baseUrl.includes('vixbrasil.com') ? 'VIX' : baseUrl.includes('oficinamuda.com') ? 'Oficina Muda' : 'TicketWise'}`);

      // 🧪 DESENVOLVIMENTO: Log do link da pesquisa para testes
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔗 PESQUISA DE SATISFAÇÃO GERADA (DESENVOLVIMENTO)`);
        console.log(`📧 Solicitante: ${ticketData.customer_email}`);
        console.log(`🎫 Ticket #${ticketData.ticket_number}: "${ticketData.title}"`);
        console.log(`🌐 Link da pesquisa: http://localhost:5173/satisfaction/${surveyToken}`);
        console.log(`⏰ Expira em: 7 dias (${expiresAt.toLocaleDateString('pt-BR')})`);
        console.log(`🔑 Token: ${surveyToken}`);
        console.log(`-------------------------------------------\n`);
      }

      // Preparar contexto do email
      const context: EmailNotificationContext = {
        ticket: {
          id: ticketData.ticket_id,
          ticket_id: ticketData.ticket_number,
          title: ticketData.title,
          assigned_official_name: assignedOfficial?.name || 'Não atribuído',
          resolved_at: ticketData.resolved_at || new Date(),
          resolved_at_formatted: ticketData.resolved_at?.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) || new Date().toLocaleDateString('pt-BR')
        },
        customer: {
          name: ticketData.customer_name || 'Solicitante',
          email: ticketData.customer_email
        },
        survey: {
          link: surveyLink,
          token: surveyToken,
          expires_at: expiresAt
        },
        system: {
          company_name: company?.name || 'Sistema de Tickets',
          colors: themeColors
        }
      };

      // Enviar email de pesquisa de satisfação
      const result = await this.sendEmailNotification(
        'satisfaction_survey',
        ticketData.customer_email,
        context,
        ticketData.company_id!,
        'customer'
      );

      if (result.success) {
        console.log(`[📧 SATISFACTION] ✅ Pesquisa de satisfação enviada com sucesso para ${ticketData.customer_email}`);
      } else {
        console.log(`[📧 SATISFACTION] ❌ Falha ao enviar pesquisa de satisfação: ${result.error}`);
        
        // Marcar pesquisa como falha no envio (manter como 'sent' pois não existe status 'failed')
        // Não alteramos o status pois 'failed' não está no enum permitido
        console.log(`[📧 SATISFACTION] ⚠️ Status mantido como 'sent' mesmo com falha no envio`);
      }

    } catch (error) {
      console.error(`[📧 SATISFACTION] ❌ Erro ao enviar pesquisa de satisfação:`, error);
    }
  }

  // Gerar token único para pesquisa de satisfação

  async checkSatisfactionSurveyReminders(companyFilter?: string): Promise<void> {
    try {
      const now = new Date();
      const filterValue = companyFilter && companyFilter.trim().length > 0 ? companyFilter.trim() : '*';

      const parseFilter = (filter: string): ((companyId: number) => boolean) => {
        if (!filter || filter === '*') {
          return () => true;
        }

        if (filter.startsWith('<>')) {
          const excludedId = parseInt(filter.substring(2), 10);
          return (companyId: number) => companyId !== excludedId;
        }

        if (filter.includes(',')) {
          const allowedIds = filter
            .split(',')
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => !Number.isNaN(id));
          return (companyId: number) => allowedIds.includes(companyId);
        }

        const specificId = parseInt(filter, 10);
        if (Number.isNaN(specificId)) {
          return () => true;
        }
        return (companyId: number) => companyId === specificId;
      };

      const companyFilterFn = parseFilter(filterValue);

      const rawSurveys = await db
        .select({
          survey_id: satisfactionSurveys.id,
          ticket_id: tickets.id,
          ticket_number: tickets.ticket_id,
          ticket_title: tickets.title,
          ticket_resolved_at: tickets.resolved_at,
          company_id: tickets.company_id,
          customer_name: customers.name,
          customer_email: customers.email,
          assigned_official_name: officials.name,
          survey_token: satisfactionSurveys.survey_token,
          expires_at: satisfactionSurveys.expires_at,
          sent_at: satisfactionSurveys.sent_at,
          reminder_5d_sent: satisfactionSurveys.reminder_5d_sent,
          reminder_3d_sent: satisfactionSurveys.reminder_3d_sent,
          reminder_1d_sent: satisfactionSurveys.reminder_1d_sent,
          company_name: companies.name
        })
        .from(satisfactionSurveys)
        .innerJoin(tickets, eq(tickets.id, satisfactionSurveys.ticket_id))
        .innerJoin(customers, eq(tickets.customer_id, customers.id))
        .innerJoin(companies, eq(companies.id, tickets.company_id))
        .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
        .where(
          and(
            eq(satisfactionSurveys.status, 'sent'),
            gt(satisfactionSurveys.expires_at, now)
          )
        );

      const surveys = rawSurveys.filter((survey) => {
        if (!survey.company_id) {
          return false;
        }
        return companyFilterFn(survey.company_id);
      });

      if (surveys.length === 0) {
        return;
      }

      const reminders = [
        { days: 5, field: 'reminder_5d_sent' as const },
        { days: 3, field: 'reminder_3d_sent' as const },
        { days: 1, field: 'reminder_1d_sent' as const }
      ];

      let sentCount = 0;

      for (const survey of surveys) {
        const expiresAt = survey.expires_at instanceof Date ? survey.expires_at : new Date(survey.expires_at);
        const diffMs = expiresAt.getTime() - now.getTime();
        if (diffMs <= 0) {
          continue;
        }

        const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

        for (const reminder of reminders) {
          const alreadySent = (survey as any)[reminder.field];
          if (alreadySent) {
            continue;
          }

          if (daysLeft === reminder.days) {
            const sent = await this.sendSatisfactionSurveyReminder(survey, reminder.days, expiresAt);
            if (sent) {
              sentCount += 1;
            }
            break;
          }
        }
      }

      if (sentCount > 0) {
        console.log('[SATISFACTION] Reminders sent: ' + sentCount);
      }
    } catch (error) {
      console.error('[SATISFACTION] Error while processing survey reminders:', error);
    }
  }

  private async sendSatisfactionSurveyReminder(
    survey: any,
    daysLeft: number,
    expiresAt: Date
  ): Promise<boolean> {
    try {
      if (!survey?.customer_email) {
        console.log('[SATISFACTION] Reminder skipped: survey without customer email');
        return false;
      }

      const baseUrl = await this.getBaseUrlForCompany(survey.company_id || undefined);
      const surveyLink = baseUrl + '/satisfaction/' + survey.survey_token;

      const resolvedAtRaw = survey.ticket_resolved_at;
      const resolvedAt = resolvedAtRaw
        ? (resolvedAtRaw instanceof Date ? resolvedAtRaw : new Date(resolvedAtRaw))
        : null;

      const resolvedFormatted = resolvedAt
        ? resolvedAt.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : undefined;

      const context: EmailNotificationContext = {
        ticket: {
          id: survey.ticket_id,
          ticket_id: survey.ticket_number,
          title: survey.ticket_title,
          assigned_official_name: survey.assigned_official_name || 'Nao atribuido',
          resolved_at: resolvedAt,
          resolved_at_formatted: resolvedFormatted
        },
        customer: {
          name: survey.customer_name || 'Solicitante',
          email: survey.customer_email
        },
        survey: {
          link: surveyLink,
          token: survey.survey_token,
          expires_at: expiresAt,
          days_until_expiration: daysLeft
        },
        system: {
          company_name: survey.company_name || 'Sistema de Tickets'
        }
      };

      const result = await this.sendEmailNotification(
        'satisfaction_survey_reminder',
        survey.customer_email,
        context,
        survey.company_id,
        'customer'
      );

      if (result.success) {
        const updateData: Record<string, boolean> = {};
        if (daysLeft === 5) {
          updateData.reminder_5d_sent = true;
        } else if (daysLeft === 3) {
          updateData.reminder_3d_sent = true;
        } else if (daysLeft === 1) {
          updateData.reminder_1d_sent = true;
        }

        if (Object.keys(updateData).length > 0) {
          await db
            .update(satisfactionSurveys)
            .set(updateData)
            .where(eq(satisfactionSurveys.id, survey.survey_id));
        }

        console.log('[SATISFACTION] Reminder for ' + daysLeft + ' day(s) sent to ' + survey.customer_email);
        return true;
      }

      console.log('[SATISFACTION] Reminder for ' + daysLeft + ' day(s) failed for ' + survey.customer_email + ': ' + result.error);
      return false;
    } catch (error) {
      console.error('[SATISFACTION] Error while sending survey reminder:', error);
      return false;
    }
  }

  /**
   * Automação: tickets em aguardando solicitante sem resposta do solicitante (elegível).
   * 48h desde entered_at → enviar alerta; 24h após alerta → encerrar.
   * Elegível = nenhuma resposta do solicitante desde que entrou em waiting_customer.
   */
  async checkWaitingCustomerAutoClose(companyFilter?: string): Promise<void> {
    try {
      const now = new Date();
      const filterValue = companyFilter && companyFilter.trim().length > 0 ? companyFilter.trim() : '*';

      // Importar parseCompanyFilter do helper compartilhado
      const { parseCompanyFilter } = await import('../utils/company-filter');
      const companyFilterFn = parseCompanyFilter(filterValue);

      const candidates = await db
        .select({
          id: tickets.id,
          ticket_id: tickets.ticket_id,
          company_id: tickets.company_id,
          customer_id: tickets.customer_id,
          customer_email: tickets.customer_email,
          waiting_customer_alert_sent_at: tickets.waiting_customer_alert_sent_at,
        })
        .from(tickets)
        .innerJoin(departments, eq(tickets.department_id, departments.id))
        .where(
          and(
            eq(tickets.status, 'waiting_customer'),
            eq(departments.auto_close_waiting_customer, true),
            not(isNull(tickets.department_id))
          )
        );

      const MS_48H = 48 * 60 * 60 * 1000;
      const MS_24H = 24 * 60 * 60 * 1000;

      for (const row of candidates) {
        if (row.company_id == null || !companyFilterFn(row.company_id)) continue;

        const [enteredRow] = await db
          .select({ created_at: ticketStatusHistory.created_at })
          .from(ticketStatusHistory)
          .where(
            and(
              eq(ticketStatusHistory.ticket_id, row.id),
              eq(ticketStatusHistory.change_type, 'status'),
              eq(ticketStatusHistory.new_status, 'waiting_customer')
            )
          )
          .orderBy(desc(ticketStatusHistory.created_at))
          .limit(1);

        const entered_at = enteredRow?.created_at ? new Date(enteredRow.created_at) : null;
        if (!entered_at) continue;

        let customer_user_id: number | null = null;
        if (row.customer_id) {
          const [c] = await db.select({ user_id: customers.user_id }).from(customers).where(eq(customers.id, row.customer_id)).limit(1);
          customer_user_id = c?.user_id ?? null;
        }

        const lastReply = customer_user_id
          ? await db
              .select({ created_at: ticketReplies.created_at })
              .from(ticketReplies)
              .where(and(eq(ticketReplies.ticket_id, row.id), eq(ticketReplies.user_id, customer_user_id)))
              .orderBy(desc(ticketReplies.created_at))
              .limit(1)
          : [];
        const last_customer_reply_at = lastReply[0]?.created_at ? new Date(lastReply[0].created_at) : null;

        const eligible = last_customer_reply_at == null || last_customer_reply_at.getTime() < entered_at.getTime();
        if (!eligible) continue;

        const alert_sent_at = row.waiting_customer_alert_sent_at ? new Date(row.waiting_customer_alert_sent_at) : null;
        
        // Calcular effectiveAlertSentAt: se alert_sent_at < entered_at, tratar como null
        // (pertence a um ciclo anterior de waiting_customer)
        const effectiveAlertSentAt = (alert_sent_at && alert_sent_at.getTime() >= entered_at.getTime())
          ? alert_sent_at
          : null;

        if (now.getTime() - entered_at.getTime() >= MS_48H && !effectiveAlertSentAt) {
          const result = await this.sendWaitingCustomerClosureAlert(row.id);
          if (result.success) {
            await db.update(tickets).set({ waiting_customer_alert_sent_at: now }).where(eq(tickets.id, row.id));
            console.log('[AUTO_CLOSE] Alerta 48h enviado para ticket ' + row.ticket_id);
          }
          continue;
        }

        if (
          effectiveAlertSentAt &&
          now.getTime() - effectiveAlertSentAt.getTime() >= MS_24H &&
          (last_customer_reply_at == null || last_customer_reply_at.getTime() <= effectiveAlertSentAt.getTime())
        ) {
          try {
            await storage.createTicketReply({
              ticket_id: row.id,
              message: 'Ticket encerrado por falta de interação',
              status: 'closed',
              user_id: undefined,
            });
            await this.notifyStatusChanged(row.id, 'waiting_customer', 'closed', undefined);
            console.log('[AUTO_CLOSE] Ticket ' + row.ticket_id + ' encerrado por falta de interação');
          } catch (closeErr) {
            console.error('[AUTO_CLOSE] Erro ao encerrar ticket ' + row.ticket_id + ':', closeErr);
          }
        }
      }
    } catch (error) {
      console.error('[AUTO_CLOSE] Erro em checkWaitingCustomerAutoClose:', error);
    }
  }

  private generateSurveyToken(): string {
    return `survey_${crypto.randomBytes(16).toString('hex')}`;
  }

}

export const emailNotificationService = new EmailNotificationService();

