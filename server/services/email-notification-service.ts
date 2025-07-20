import { db } from '../db';
import { emailTemplates, userNotificationSettings, users, tickets, customers, officials, officialDepartments, slaDefinitions, companies } from '@shared/schema';
import { eq, and, isNull, inArray, not, ne } from 'drizzle-orm';
import { emailConfigService } from './email-config-service';
import nodemailer from 'nodemailer';
import { PriorityService } from "./priority-service";

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
      // LOGS CRÍTICOS PARA PRODUÇÃO
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] Iniciando envio de email`);
      console.log(`[📧 EMAIL PROD] Template: ${templateType}`);
      console.log(`[📧 EMAIL PROD] Destinatário: ${recipientEmail}`);
      console.log(`[📧 EMAIL PROD] Empresa ID: ${companyId}`);
      console.log(`[📧 EMAIL PROD] User Role: ${userRole || 'N/A'}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);
      
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
      console.log(`[📧 EMAIL PROD] URL base obtida: ${baseUrl}`);
      
      // 2. Adicionar URL base e outras informações do sistema ao contexto
      const enrichedContext: EmailNotificationContext = {
        ...context,
        ticket: await this.mapTicketFields(context.ticket),
        system: {
          ...context.system,
          base_url: baseUrl,
          company_name: context.system?.company_name || 'Ticket Wise',
          support_email: context.system?.support_email || 'suporte@ticketwise.com.br'
        }
      };

      // 3. Verificar se email está configurado - CRÍTICO: APENAS PARA A EMPRESA ESPECÍFICA
      console.log(`[📧 EMAIL PROD] Verificando configuração de email APENAS para empresa ${validatedCompanyId}`);
      const emailConfig = await emailConfigService.getEmailConfigForFrontend(validatedCompanyId);

      // BLOQUEIO ABSOLUTO: Se qualquer campo essencial estiver vazio, NÃO ENVIA!
      if (!emailConfig || !emailConfig.from_email || !emailConfig.provider ||
          (emailConfig.provider === 'smtp' && (!emailConfig.host || !emailConfig.username || !emailConfig.password || emailConfig.port === 0)) ||
          ((emailConfig.provider === 'brevo' || emailConfig.provider === 'sendgrid' || emailConfig.provider === 'mailgun') && !emailConfig.api_key)) {
        console.log(`[📧 EMAIL PROD] ❌ ABORTADO: Configuração de email INEXISTENTE ou INCOMPLETA para empresa ${validatedCompanyId}. NENHUM EMAIL SERÁ ENVIADO.`);
        return { success: false, error: 'Configuração de email inexistente ou incompleta para a empresa. Nenhum email enviado.' };
      }

      // 4. Buscar template
      console.log(`[📧 EMAIL PROD] Buscando template '${templateType}' para empresa ${validatedCompanyId}`);
      const template = await this.getEmailTemplate(templateType, validatedCompanyId);
      if (!template) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Template '${templateType}' não encontrado para empresa ${validatedCompanyId}`);
        return { success: false, error: `Template '${templateType}' não encontrado. Configure em Configurações > Email > Templates.` };
      }

      console.log(`[📧 EMAIL PROD] ✅ Template encontrado: ${template.name}`);

      // 5. Renderizar template com contexto enriquecido
      const renderedSubject = this.renderTemplate(template.subject_template, enrichedContext);
      const renderedHtml = this.renderTemplate(template.html_template, enrichedContext);
      const renderedText = template.text_template ? this.renderTemplate(template.text_template, enrichedContext) : undefined;

      console.log(`[📧 EMAIL PROD] Template renderizado - Subject: "${renderedSubject}"`);

      // 6. Configurar transporter
      try {
        console.log(`[📧 EMAIL PROD] Criando transporter para ${emailConfig.provider}...`);
        const transporter = await this.createTransporter(emailConfig);
        console.log(`[📧 EMAIL PROD] ✅ Transporter criado com sucesso para ${emailConfig.provider}`);

        // 7. Enviar email
        const mailOptions = {
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          to: recipientEmail,
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
        };

        console.log(`[📧 EMAIL PROD] 📧 Enviando email...`);
        console.log(`[📧 EMAIL PROD] From: ${mailOptions.from}`);
        console.log(`[📧 EMAIL PROD] To: ${mailOptions.to}`);
        console.log(`[📧 EMAIL PROD] Subject: ${mailOptions.subject}`);
        
        const result = await transporter.sendMail(mailOptions);
        
        console.log(`[📧 EMAIL PROD] ✅ EMAIL ENVIADO COM SUCESSO!`);
        console.log(`[📧 EMAIL PROD] Message ID: ${result.messageId}`);
        console.log(`[📧 EMAIL PROD] ===========================================`);
        
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
      console.log(`[📧 EMAIL PROD] 🔍 Buscando template padrão global para '${templateType}'`);
      
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
        console.log(`[📧 EMAIL PROD] ✅ Template padrão global encontrado: ${defaultTemplate.name}`);
        console.log(`[📧 EMAIL PROD] - ID: ${defaultTemplate.id}`);
        console.log(`[📧 EMAIL PROD] - Tipo: ${defaultTemplate.type}`);
        console.log(`[📧 EMAIL PROD] - É global: ${defaultTemplate.company_id === null}`);
        return defaultTemplate;
      } else {
        console.log(`[📧 EMAIL PROD] ❌ Template padrão global para '${templateType}' não encontrado`);
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

      // Outras propriedades do sistema
      Object.entries(system).forEach(([key, value]) => {
        if (!['base_url', 'company_name', 'support_email'].includes(key)) { // Já tratados acima
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
      console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: Configurações inválidas ou incompletas`);
      throw new Error('Configurações de email inválidas ou incompletas');
    }
    
    if (config.provider === 'smtp') {
      if (!config.host || !config.username || !config.password) {
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: Configurações SMTP incompletas`);
        throw new Error('Configurações SMTP incompletas (host, username ou password ausentes)');
      }
      
      console.log(`[📧 EMAIL PROD] 🔧 Criando transporter SMTP com host: ${config.host}`);
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
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: API Key do Brevo ausente`);
        throw new Error('API Key do Brevo é obrigatória');
      }
      
      console.log(`[📧 EMAIL PROD] 🔧 Criando transporter Brevo`);
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
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: API Key do SendGrid ausente`);
        throw new Error('API Key do SendGrid é obrigatória');
      }
      
      console.log(`[📧 EMAIL PROD] 🔧 Criando transporter SendGrid`);
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
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: API Key do Mailgun ausente`);
        throw new Error('API Key do Mailgun é obrigatória');
      }
      
      // Mailgun requer configuração específica do domínio
      const domain = config.from_email.split('@')[1];
      console.log(`[📧 EMAIL PROD] 🔧 Criando transporter Mailgun para domínio: ${domain}`);
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

    console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: Provedor ${config.provider} não suportado`);
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
        'status_changed': 'ticket_status_changed',
        'ticket_resolved': 'ticket_status_changed',
        'ticket_escalated': 'ticket_escalated',
        'ticket_due_soon': 'ticket_due_soon',
        'customer_registered': 'new_customer_registered',
        'user_created': 'new_user_created',
        'system_maintenance': 'system_maintenance',
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
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);
      console.log(`[📧 EMAIL PROD] - Departamento ID: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] - Email cliente: ${ticket.customer_email}`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

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
      console.log(`[📧 EMAIL PROD] 🔍 Buscando atendentes do departamento ${ticket.department_id}...`);
      
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
        console.log(`[📧 EMAIL PROD] 📧 Processando usuário: ${user.name} (${user.email})`);
        
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'new_ticket');
        if (shouldNotify) {
          console.log(`[📧 EMAIL PROD] ✅ Usuário ${user.name} configurado para receber notificações`);
          
          const result = await this.sendEmailNotification(
            'new_ticket',
            user.email,
            context,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            user.role // Passar a role do usuário para validação
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[📧 EMAIL PROD] ✅ Email enviado com sucesso para ${user.name}`);
          } else {
            emailsFailed++;
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] 🔕 Usuário ${user.name} não configurado para receber notificações`);
        }
      }

      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 📊 RESUMO DA NOTIFICAÇÃO`);
      console.log(`[📧 EMAIL PROD] Ticket: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] Departamento: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] Emails enviados: ${emailsSent}`);
      console.log(`[📧 EMAIL PROD] Emails falharam: ${emailsFailed}`);
      console.log(`[📧 EMAIL PROD] ===========================================`);
      
    } catch (error) {
      console.error('Erro ao enviar notificação de novo ticket:', error);
    }
  }

  async notifyTicketAssigned(ticketId: number, assignedToId: number): Promise<void> {
    try {
      console.log(`[📧 EMAIL PROD] ===========================================`);
      console.log(`[📧 EMAIL PROD] 🎯 INICIANDO NOTIFICAÇÃO DE TICKET ATRIBUÍDO`);
      console.log(`[📧 EMAIL PROD] Ticket ID: ${ticketId}`);
      console.log(`[📧 EMAIL PROD] Atribuído para ID: ${assignedToId}`);
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

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);

      // Buscar dados do atendente atribuído
      const [official] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, assignedToId), eq(users.active, true)))
        .limit(1);

      if (!official) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Atendente ${assignedToId} não encontrado ou inativo`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Atendente encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${official.id}`);
      console.log(`[📧 EMAIL PROD] - Nome: ${official.name}`);
      console.log(`[📧 EMAIL PROD] - Email: ${official.email}`);
      console.log(`[📧 EMAIL PROD] - Role: ${official.role}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${official.company_id}`);

      // 🔥 VALIDAÇÃO CRÍTICA: Atendente deve ser da MESMA EMPRESA do ticket!
      if (ticket.company_id && official.company_id && ticket.company_id !== official.company_id) {
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: VIOLAÇÃO DE SEGURANÇA!`);
        console.error(`[📧 EMAIL PROD] ❌ Ticket da empresa ${ticket.company_id} foi atribuído para atendente da empresa ${official.company_id}!`);
        console.error(`[📧 EMAIL PROD] ❌ Ticket: ${ticket.ticket_id} (${ticket.title})`);
        console.error(`[📧 EMAIL PROD] ❌ Atendente: ${official.name} (${official.email})`);
        console.error(`[📧 EMAIL PROD] ❌ NENHUM EMAIL SERÁ ENVIADO POR SEGURANÇA!`);
        return;
      }

      // 🔥 VALIDAÇÃO ADICIONAL: Se ticket tem empresa, atendente deve ter empresa (exceto admin)
      if (ticket.company_id && !official.company_id && official.role !== 'admin') {
        console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: Atendente sem empresa para ticket com empresa!`);
        console.error(`[📧 EMAIL PROD] ❌ Ticket empresa: ${ticket.company_id}, Atendente empresa: ${official.company_id}`);
        console.error(`[📧 EMAIL PROD] ❌ NENHUM EMAIL SERÁ ENVIADO POR SEGURANÇA!`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Validação de empresa: OK - Atendente e ticket são da mesma empresa`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: official,
        official,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o atendente atribuído
      console.log(`[📧 EMAIL PROD] 🔍 Verificando configurações de notificação do atendente...`);
      const shouldNotify = await this.shouldSendEmailToUser(official.id, 'ticket_assigned');
      
      if (shouldNotify) {
        console.log(`[📧 EMAIL PROD] ✅ Atendente ${official.name} configurado para receber notificações`);
        
        const result = await this.sendEmailNotification(
          'ticket_assigned',
          official.email,
          context,
          ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
          official.role // Passar a role do atendente para validação
        );
        
        if (result.success) {
          console.log(`[📧 EMAIL PROD] ✅ Email de atribuição enviado com sucesso para ${official.name}`);
        } else {
          console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de atribuição para ${official.name}: ${result.error}`);
        }
      } else {
        console.log(`[📧 EMAIL PROD] 🔕 Atendente ${official.name} não configurado para receber notificações`);
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

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);
      console.log(`[📧 EMAIL PROD] - Departamento ID: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] - Email cliente: ${ticket.customer_email}`);

      // Buscar dados do usuário que respondeu
      const [replyUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, replyUserId), eq(users.active, true)))
        .limit(1);

      if (!replyUser) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Usuário ${replyUserId} não encontrado ou inativo`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Usuário que respondeu encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${replyUser.id}`);
      console.log(`[📧 EMAIL PROD] - Nome: ${replyUser.name}`);
      console.log(`[📧 EMAIL PROD] - Email: ${replyUser.email}`);
      console.log(`[📧 EMAIL PROD] - Role: ${replyUser.role}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${replyUser.company_id}`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
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

      // 🔥 LÓGICA CORRIGIDA: Se quem respondeu foi o suporte/admin, notificar APENAS o cliente
      if (replyUser.role !== 'customer' && ticket.customer_email) {
        console.log(`[📧 EMAIL PROD] 📧 Atendente respondeu - notificando cliente: ${ticket.customer_email}`);
        
        // Verificar se o cliente tem conta e configurações
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        if (customerUser) {
          console.log(`[📧 EMAIL PROD] ✅ Cliente tem conta no sistema`);
          const shouldNotify = await this.shouldSendEmailToUser(customerUser.id, 'ticket_reply');
          if (shouldNotify) {
            const result = await this.sendEmailNotification(
              'ticket_reply',
              ticket.customer_email,
              context,
              ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
              customerUser.role // Passar a role do cliente para validação
            );
            
            if (result.success) {
              console.log(`[📧 EMAIL PROD] ✅ Email de resposta enviado com sucesso para cliente`);
            } else {
              console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para cliente: ${result.error}`);
            }
          } else {
            console.log(`[📧 EMAIL PROD] 🔕 Cliente não configurado para receber notificações`);
          }
        } else {
          console.log(`[📧 EMAIL PROD] ℹ️  Cliente sem conta no sistema - enviando email direto`);
          // Cliente sem conta, enviar email direto (sempre)
          const result = await this.sendEmailNotification(
            'ticket_reply',
            ticket.customer_email,
            context,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            'customer' // Role do cliente para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de resposta enviado com sucesso para cliente (sem conta)`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email para cliente (sem conta): ${result.error}`);
          }
        }
      }

      // 🔥 LÓGICA CORRIGIDA: Se quem respondeu foi o cliente, notificar APENAS atendentes do departamento
      if (replyUser.role === 'customer') {
        console.log(`[📧 EMAIL PROD] 📧 Cliente respondeu - notificando atendentes do departamento ${ticket.department_id}`);
        
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
            
            const result = await this.sendEmailNotification(
              'ticket_reply',
              user.email,
              context,
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

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);
      console.log(`[📧 EMAIL PROD] - Departamento ID: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] - Email cliente: ${ticket.customer_email}`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
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
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
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
          const result = await this.sendEmailNotification(
            newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed',
            ticket.customer_email,
            context,
            ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
            customerUser?.role || 'customer' // Passar a role do cliente para validação
          );
          
          if (result.success) {
            console.log(`[📧 EMAIL PROD] ✅ Email de mudança de status enviado com sucesso para cliente`);
          } else {
            console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de mudança de status para cliente: ${result.error}`);
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
          
          const result = await this.sendEmailNotification(
            'status_changed',
            user.email,
            context,
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

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);
      console.log(`[📧 EMAIL PROD] - Departamento ID: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] - Email cliente: ${ticket.customer_email}`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
      }

      let escalatedByUser = null;
      if (escalatedByUserId) {
        [escalatedByUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, escalatedByUserId), eq(users.active, true)))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Usuário que escalou encontrado: ${escalatedByUser?.name || 'N/A'}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
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
          const result = await this.sendEmailNotification(
            'ticket_escalated',
            ticket.customer_email,
            context,
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
          
          const result = await this.sendEmailNotification(
            'ticket_escalated',
            user.email,
            context,
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

      if (!ticket) {
        console.log(`[📧 EMAIL PROD] ❌ ERRO: Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[📧 EMAIL PROD] ✅ Ticket encontrado:`);
      console.log(`[📧 EMAIL PROD] - ID: ${ticket.id}`);
      console.log(`[📧 EMAIL PROD] - Número: ${ticket.ticket_id}`);
      console.log(`[📧 EMAIL PROD] - Título: ${ticket.title}`);
      console.log(`[📧 EMAIL PROD] - Empresa ID: ${ticket.company_id}`);
      console.log(`[📧 EMAIL PROD] - Departamento ID: ${ticket.department_id}`);
      console.log(`[📧 EMAIL PROD] - Atribuído para ID: ${ticket.assigned_to_id || 'N/A'}`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[📧 EMAIL PROD] ✅ Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem customer_id - usando email: ${ticket.customer_email}`);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);
      console.log(`[📧 EMAIL PROD] ✅ URL base obtida: ${baseUrl}`);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // 🔥 NOTIFICAR O ATENDENTE ATRIBUÍDO (se houver)
      if (ticket.assigned_to_id) {
        console.log(`[📧 EMAIL PROD] 📧 Notificando atendente atribuído ID: ${ticket.assigned_to_id}`);
        
        const [assignedOfficial] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, ticket.assigned_to_id), eq(users.active, true)))
          .limit(1);

        if (assignedOfficial) {
          console.log(`[📧 EMAIL PROD] ✅ Atendente atribuído encontrado: ${assignedOfficial.name} (${assignedOfficial.email})`);
          
          // 🔥 VALIDAÇÃO CRÍTICA: Atendente deve ser da MESMA EMPRESA do ticket!
          if (ticket.company_id && assignedOfficial.company_id && ticket.company_id !== assignedOfficial.company_id) {
            console.error(`[📧 EMAIL PROD] ❌ ERRO CRÍTICO: VIOLAÇÃO DE SEGURANÇA!`);
            console.error(`[📧 EMAIL PROD] ❌ Ticket da empresa ${ticket.company_id} atribuído para atendente da empresa ${assignedOfficial.company_id}!`);
            console.error(`[📧 EMAIL PROD] ❌ NENHUM EMAIL SERÁ ENVIADO POR SEGURANÇA!`);
          } else {
            const shouldNotify = await this.shouldSendEmailToUser(assignedOfficial.id, 'ticket_due_soon');
            if (shouldNotify) {
              const result = await this.sendEmailNotification(
                'ticket_due_soon',
                assignedOfficial.email,
                context,
                ticket.company_id!, // 🔥 OBRIGATÓRIO: ticket sempre tem company_id
                assignedOfficial.role // Passar a role do atendente para validação
              );
              
              if (result.success) {
                console.log(`[📧 EMAIL PROD] ✅ Email de vencimento enviado com sucesso para atendente atribuído`);
              } else {
                console.log(`[📧 EMAIL PROD] ❌ Falha ao enviar email de vencimento para atendente atribuído: ${result.error}`);
              }
            } else {
              console.log(`[📧 EMAIL PROD] 🔕 Atendente atribuído não configurado para receber notificações`);
            }
          }
        } else {
          console.log(`[📧 EMAIL PROD] ⚠️  Atendente atribuído ${ticket.assigned_to_id} não encontrado ou inativo`);
        }
      } else {
        console.log(`[📧 EMAIL PROD] ℹ️  Ticket sem atendente atribuído`);
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
          
          const result = await this.sendEmailNotification(
            'ticket_due_soon',
            user.email,
            context,
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

      const context: EmailNotificationContext = {
        customer,
        system: {
          base_url: 'https://app.ticketwise.com.br',
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // 🔥 CORREÇÃO CRÍTICA: SÓ notificar usuários da MESMA EMPRESA do cliente!
      console.log(`[📧 EMAIL PROD] 🔍 Buscando usuários para notificar sobre cliente ${customer.name} da empresa ${customer.company_id}`);
      
      // Notificar administradores e managers da MESMA EMPRESA
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
      
      console.log(`[📧 EMAIL PROD] 👥 Encontrados ${allNotifyUsers.length} usuários da empresa ${customer.company_id} para notificar:`);
      allNotifyUsers.forEach(user => {
        console.log(`[📧 EMAIL PROD] - ${user.name} (${user.email}) - Role: ${user.role} - Empresa: ${user.company_id}`);
      });

      for (const user of allNotifyUsers) {
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'customer_registered');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'customer_registered',
            user.email,
            context,
            customer.company_id!, // 🔥 OBRIGATÓRIO: customer sempre tem company_id
            user.role // Passar a role do usuário para validação
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de novo cliente registrado:', error);
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
          await this.sendEmailNotification(
            'user_created',
            user.email,
            context,
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
          await this.sendEmailNotification(
            'system_maintenance',
            user.email,
            context,
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
  async checkTicketsDueSoon(): Promise<void> {
    try {
      // Buscar tickets em andamento que ainda não venceram
      const ongoingTickets = await db
        .select({
          id: tickets.id,
          priority: tickets.priority,
          created_at: tickets.created_at,
          company_id: tickets.company_id,
          sla_breached: tickets.sla_breached
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, 'ongoing'),
            eq(tickets.sla_breached, false)
          )
        );

      const now = new Date();

      for (const ticket of ongoingTickets) {
        // Buscar SLA específico para a prioridade e empresa do ticket
        let slaHours = 24; // Valor padrão
        
        try {
          const [slaDefinition] = await db
            .select()
            .from(slaDefinitions)
            .where(
              and(
                eq(slaDefinitions.priority, ticket.priority),
                ticket.company_id 
                  ? eq(slaDefinitions.company_id, ticket.company_id)
                  : isNull(slaDefinitions.company_id)
              )
            )
            .limit(1);

          if (slaDefinition && slaDefinition.response_time_hours) {
            slaHours = slaDefinition.response_time_hours;
          }
        } catch (slaError) {
          console.warn(`[Email] Erro ao buscar SLA para ticket ${ticket.id}:`, slaError);
        }

        // Calcular horas decorridas e restantes
        const createdAt = new Date(ticket.created_at);
        const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        const hoursRemaining = slaHours - hoursElapsed;

        // Definir threshold de notificação baseado na prioridade/SLA
        let notificationThreshold: number;
        
        if (ticket.priority === 'critical') {
          // Para críticos: notificar quando restar 25% do tempo (mínimo 1h)
          notificationThreshold = Math.max(1, slaHours * 0.25);
        } else if (ticket.priority === 'high') {
          // Para altos: notificar quando restar 20% do tempo (mínimo 2h)
          notificationThreshold = Math.max(2, slaHours * 0.20);
        } else if (ticket.priority === 'medium') {
          // Para médios: notificar quando restar 15% do tempo (mínimo 3h)
          notificationThreshold = Math.max(3, slaHours * 0.15);
        } else {
          // Para baixos: notificar quando restar 10% do tempo (mínimo 4h)
          notificationThreshold = Math.max(4, slaHours * 0.10);
        }

        console.log(`[Email] Ticket ${ticket.id} - Prioridade: ${ticket.priority}, SLA: ${slaHours}h, Restante: ${hoursRemaining.toFixed(1)}h, Threshold: ${notificationThreshold.toFixed(1)}h`);

        // Notificar se estiver próximo do vencimento
        if (hoursRemaining > 0 && hoursRemaining <= notificationThreshold) {
          console.log(`[Email] Notificando vencimento próximo para ticket ${ticket.id}`);
          await this.notifyTicketDueSoon(ticket.id, Math.round(hoursRemaining));
        }

        // Marcar como vencido e escalar se passou do prazo
        if (hoursRemaining <= 0) {
          console.log(`[Email] Ticket ${ticket.id} violou SLA, escalando automaticamente`);
          
          await db
            .update(tickets)
            .set({ sla_breached: true })
            .where(eq(tickets.id, ticket.id));

          // Escalar automaticamente
          await this.notifyTicketEscalated(
            ticket.id,
            undefined,
            `Ticket escalado automaticamente por violação de SLA (${slaHours}h). Tempo decorrido: ${hoursElapsed.toFixed(1)}h`
          );
        }
      }

      console.log(`[Email] Verificação concluída. Analisados ${ongoingTickets.length} tickets em andamento.`);

    } catch (error) {
      console.error('Erro ao verificar tickets próximos do vencimento:', error);
    }
  }
}

export const emailNotificationService = new EmailNotificationService(); 