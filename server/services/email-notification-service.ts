import { db } from '../db';
import { emailTemplates, userNotificationSettings, users, tickets, customers, officials, slaDefinitions, companies } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
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
  
  // Enviar email de notificação
  async sendEmailNotification(
    templateType: string,
    recipientEmail: string,
    context: EmailNotificationContext,
    companyId?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(companyId);
      
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

      // 3. Verificar se email está configurado
      console.log(`[Email] Verificando configuração de email para empresa ${companyId}`);
      const emailConfig = await emailConfigService.getEmailConfigForFrontend(companyId);
      
      console.log(`[Email] Configuração encontrada:`, {
        provider: emailConfig?.provider,
        from_email: emailConfig?.from_email,
        hasConfig: !!emailConfig
      });
      
      if (!emailConfig || !emailConfig.from_email) {
        console.log(`[Email] ⚠️  Configuração de email não encontrada para empresa ${companyId}`);
        return { success: false, error: 'Configuração de email não encontrada. Configure em Configurações > Email.' };
      }

      // Verificar se email está habilitado (assumir habilitado se não especificado)
      if (emailConfig.provider && emailConfig.from_email) {
        console.log(`[Email] ✅ Email configurado com provedor ${emailConfig.provider}`);
      }

      // 4. Buscar template
      console.log(`[Email] Buscando template '${templateType}' para empresa ${companyId}`);
      const template = await this.getEmailTemplate(templateType, companyId);
      if (!template) {
        console.log(`[Email] ⚠️  Template '${templateType}' não encontrado para empresa ${companyId}`);
        return { success: false, error: `Template '${templateType}' não encontrado. Configure em Configurações > Email > Templates.` };
      }

      console.log(`[Email] ✅ Template encontrado: ${template.name}`);

      // 5. Renderizar template com contexto enriquecido
      const renderedSubject = this.renderTemplate(template.subject_template, enrichedContext);
      const renderedHtml = this.renderTemplate(template.html_template, enrichedContext);
      const renderedText = template.text_template ? this.renderTemplate(template.text_template, enrichedContext) : undefined;

      console.log(`[Email] Template renderizado - Subject: "${renderedSubject}"`);

      // 6. Configurar transporter
      try {
        const transporter = await this.createTransporter(emailConfig);
        console.log(`[Email] ✅ Transporter criado com sucesso para ${emailConfig.provider}`);

        // 7. Enviar email
        const mailOptions = {
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          to: recipientEmail,
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
        };

        console.log(`[Email] 📧 Enviando email para ${recipientEmail} com template '${templateType}'`);
        await transporter.sendMail(mailOptions);
        
        console.log(`[Email] ✅ Email enviado com sucesso para ${recipientEmail}`);
        return { success: true };
      } catch (transporterError) {
        console.error(`[Email] ❌ Erro ao criar transporter ou enviar email:`, transporterError);
        return { success: false, error: `Erro no envio: ${String(transporterError)}. Verifique as configurações de email.` };
      }

    } catch (error) {
      console.error(`[Email] ❌ Erro geral ao enviar email para ${recipientEmail}:`, error);
      return { success: false, error: String(error) };
    }
  }

  // Buscar template de email
  private async getEmailTemplate(templateType: string, companyId?: number) {
    try {
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
          return companyTemplate;
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

      return defaultTemplate;
    } catch (error) {
      console.error('Erro ao buscar template de email:', error);
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
    if (config.provider === 'smtp') {
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
      console.log(`[Email] 🎫 Iniciando notificação de novo ticket - ID: ${ticketId}`);
      
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        console.log(`[Email] ❌ Ticket ${ticketId} não encontrado no banco`);
        return;
      }

      console.log(`[Email] ✅ Ticket encontrado: ${ticket.ticket_id} - "${ticket.title}"`);

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
        
        console.log(`[Email] Cliente encontrado: ${customer?.name || 'N/A'} (${customer?.email || ticket.customer_email})`);
      } else {
        console.log(`[Email] Ticket sem customer_id - usando email: ${ticket.customer_email}`);
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

      // Notificar administradores e suporte
      console.log(`[Email] 🔍 Buscando usuários admin e support para notificar...`);
      
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true)));

      const supportUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'support'), eq(users.active, true)));

      const allNotifyUsers = [...adminUsers, ...supportUsers];
      
      console.log(`[Email] 👥 Encontrados ${allNotifyUsers.length} usuários para notificar (${adminUsers.length} admins + ${supportUsers.length} support)`);

      if (allNotifyUsers.length === 0) {
        console.log(`[Email] ⚠️  Nenhum usuário admin/support ativo encontrado - pulando notificações`);
        return;
      }

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const user of allNotifyUsers) {
        console.log(`[Email] 📧 Verificando envio para ${user.name} (${user.email})...`);
        
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'new_ticket');
        if (shouldNotify) {
          console.log(`[Email] ✅ Usuário ${user.name} configurado para receber notificações de new_ticket`);
          
          const result = await this.sendEmailNotification(
            'new_ticket',
            user.email,
            context,
            ticket.company_id || undefined
          );
          
          if (result.success) {
            emailsSent++;
            console.log(`[Email] ✅ Email enviado com sucesso para ${user.name}`);
          } else {
            emailsFailed++;
            console.log(`[Email] ❌ Falha ao enviar email para ${user.name}: ${result.error}`);
          }
        } else {
          console.log(`[Email] 🔕 Usuário ${user.name} não configurado para receber notificações de new_ticket`);
        }
      }

      console.log(`[Email] 📊 Resumo da notificação do ticket ${ticket.ticket_id}: ${emailsSent} enviados, ${emailsFailed} falharam`);

    } catch (error) {
      console.error(`[Email] ❌ Erro geral ao notificar novo ticket ${ticketId}:`, error);
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

      if (!ticket) return;

      // Buscar dados do atendente atribuído
      const [official] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, assignedToId), eq(users.active, true)))
        .limit(1);

      if (!official) return;

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
        user: official,
        official,
        system: {
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o atendente atribuído
      const shouldNotify = await this.shouldSendEmailToUser(official.id, 'ticket_assigned');
      if (shouldNotify) {
        await this.sendEmailNotification(
          'ticket_assigned',
          official.email,
          context,
          ticket.company_id || undefined
        );
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de ticket atribuído:', error);
    }
  }

  async notifyTicketReply(ticketId: number, replyUserId: number, replyMessage: string): Promise<void> {
    try {
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) return;

      // Buscar dados do usuário que respondeu
      const [replyUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, replyUserId), eq(users.active, true)))
        .limit(1);

      if (!replyUser) return;

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

      // Se quem respondeu foi o suporte/admin, notificar o cliente
      if (replyUser.role !== 'customer' && ticket.customer_email) {
        // Verificar se o cliente tem conta e configurações
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        if (customerUser) {
          const shouldNotify = await this.shouldSendEmailToUser(customerUser.id, 'ticket_reply');
          if (shouldNotify) {
            await this.sendEmailNotification(
              'ticket_reply',
              ticket.customer_email,
              context,
              ticket.company_id || undefined
            );
          }
        } else {
          // Cliente sem conta, enviar email direto (sempre)
          await this.sendEmailNotification(
            'ticket_reply',
            ticket.customer_email,
            context,
            ticket.company_id || undefined
          );
        }
      }

      // Se quem respondeu foi o cliente, notificar suporte/admin
      if (replyUser.role === 'customer') {
        const adminUsers = await db
          .select()
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.active, true)));

        const supportUsers = await db
          .select()
          .from(users)
          .where(and(eq(users.role, 'support'), eq(users.active, true)));

        const allNotifyUsers = [...adminUsers, ...supportUsers];

        for (const user of allNotifyUsers) {
          const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_reply');
          if (shouldNotify) {
            await this.sendEmailNotification(
              'ticket_reply',
              user.email,
              context,
              ticket.company_id || undefined
            );
          }
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de resposta:', error);
    }
  }

  async notifyStatusChanged(ticketId: number, oldStatus: string, newStatus: string, changedByUserId?: number): Promise<void> {
    try {
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) return;

      // Buscar dados do cliente
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

      // Notificar o cliente
      if (ticket.customer_email) {
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        const shouldNotify = customerUser
          ? await this.shouldSendEmailToUser(customerUser.id, newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed')
          : true;

        if (shouldNotify) {
          await this.sendEmailNotification(
            newStatus === 'resolved' ? 'ticket_resolved' : 'status_changed',
            ticket.customer_email,
            context,
            ticket.company_id || undefined
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de mudança de status:', error);
    }
  }

  async notifyTicketEscalated(ticketId: number, escalatedByUserId?: number, reason?: string): Promise<void> {
    try {
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) return;

      // Buscar dados do cliente
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
          .where(and(eq(users.id, escalatedByUserId), eq(users.active, true)))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        user: escalatedByUser,
        system: {
          message: reason || 'Ticket escalado para nível superior',
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar administradores e managers
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true)));

      const managerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'manager'), eq(users.active, true)));

      const allNotifyUsers = [...adminUsers, ...managerUsers];

      for (const user of allNotifyUsers) {
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_escalated');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'ticket_escalated',
            user.email,
            context,
            ticket.company_id || undefined
          );
        }
      }

      // Também notificar o cliente sobre a escalação
      if (ticket.customer_email) {
        const [customerUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, ticket.customer_email))
          .limit(1);

        if (customerUser) {
          const shouldNotify = await this.shouldSendEmailToUser(customerUser.id, 'ticket_escalated');
          if (shouldNotify) {
            await this.sendEmailNotification(
              'ticket_escalated',
              ticket.customer_email,
              context,
              ticket.company_id || undefined
            );
          }
        } else {
          // Cliente sem conta, sempre notificar
          await this.sendEmailNotification(
            'ticket_escalated',
            ticket.customer_email,
            context,
            ticket.company_id || undefined
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de ticket escalado:', error);
    }
  }

  async notifyTicketDueSoon(ticketId: number, hoursUntilDue: number): Promise<void> {
    try {
      // Buscar dados do ticket
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) return;

      // Buscar dados do cliente
      let customer = null;
      if (ticket.customer_id) {
        [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);
      }

      // Buscar atendente responsável
      let assignedOfficial = null;
      if (ticket.assigned_to_id) {
        [assignedOfficial] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, ticket.assigned_to_id), eq(users.active, true)))
          .limit(1);
      }

      // Obter URL base para a empresa
      const baseUrl = await this.getBaseUrlForCompany(ticket.company_id || undefined);

      const context: EmailNotificationContext = {
        ticket,
        customer: customer || { name: 'Cliente', email: ticket.customer_email },
        official: assignedOfficial,
        system: {
          message: `Ticket vence em ${hoursUntilDue} horas`,
          base_url: baseUrl,
          company_name: 'Sistema de Tickets',
          support_email: 'suporte@ticketwise.com.br'
        }
      };

      // Notificar o atendente responsável
      if (assignedOfficial) {
        const shouldNotify = await this.shouldSendEmailToUser(assignedOfficial.id, 'ticket_due_soon');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'ticket_due_soon',
            assignedOfficial.email,
            context,
            ticket.company_id || undefined
          );
        }
      }

      // Notificar supervisores e managers
      const supervisorUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'supervisor'), eq(users.active, true)));

      const managerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'manager'), eq(users.active, true)));

      const allNotifyUsers = [...supervisorUsers, ...managerUsers];

      for (const user of allNotifyUsers) {
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'ticket_due_soon');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'ticket_due_soon',
            user.email,
            context,
            ticket.company_id || undefined
          );
        }
      }

    } catch (error) {
      console.error('Erro ao enviar notificação de vencimento próximo:', error);
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

      // Notificar administradores e managers
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true)));

      const managerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'manager'), eq(users.active, true)));

      const companyAdminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'company_admin'), eq(users.active, true)));

      const allNotifyUsers = [...adminUsers, ...managerUsers, ...companyAdminUsers];

      for (const user of allNotifyUsers) {
        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'customer_registered');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'customer_registered',
            user.email,
            context,
            customer.company_id || undefined
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

      // Notificar administradores
      const adminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true)));

      const companyAdminUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'company_admin'), eq(users.active, true)));

      const allNotifyUsers = [...adminUsers, ...companyAdminUsers];

      for (const user of allNotifyUsers) {
        // Não notificar o próprio usuário que foi criado
        if (user.id === newUser.id) continue;

        const shouldNotify = await this.shouldSendEmailToUser(user.id, 'user_created');
        if (shouldNotify) {
          await this.sendEmailNotification(
            'user_created',
            user.email,
            context,
            newUser.company_id || undefined
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
            companyId
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