import { pgTable, text, serial, integer, timestamp, boolean, pgEnum, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const ticketStatusEnum = pgEnum('ticket_status', [
  'new', 
  'ongoing', 
  'suspended',
  'waiting_customer', 
  'escalated',
  'in_analysis',
  'pending_deployment',
  'reopened',
  'resolved'
]);
// Enum para modo de SLA por departamento
export const slaModeEnum = pgEnum('sla_mode', [
  'type',
  'category'
]);
// ticketPriorityEnum removido - agora usando TEXT para prioridades dinâmicas
// export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
export const userRoleEnum = pgEnum('user_role', [
  'admin',            // Acesso total ao sistema, multiempresa
  'customer',         // Cliente da empresa
  'support',          // Atendente
  'manager',          // Gestor da equipe
  'supervisor',       // Nível entre manager e support
  'viewer',           // Apenas visualização de chamados
  'company_admin',    // Admin local da empresa
  'triage',           // Classificação e encaminhamento
  'quality',          // Avaliação de qualidade
  'integration_bot',  // Bots e integrações
  'inventory_manager' // Gestor de estoque
]);

// Enum para provedores de IA
export const aiProviderEnum = pgEnum('ai_provider', [
  'openai',
  'google',
  'anthropic'
]);

// Tabela de empresas para suporte multi-tenant (ajustado para snake_case conforme banco de dados)
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  domain: text("domain"),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  cnpj: text("cnpj"),
  phone: text("phone"),
  city: text("city"),
  ai_permission: boolean("ai_permission").notNull().default(true), // Permite que a empresa use IA
  uses_flexible_sla: boolean("uses_flexible_sla").notNull().default(false), // Flag para sistema de SLA flexível
  logo_base64: text("logo_base64"), // Logotipo da empresa em base64
});

// Users table for authentication (ajustado para snake_case conforme banco)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default('customer'),
  avatar_url: text("avatar_url"),
  active: boolean("active").notNull().default(true),
  ad_user: boolean("ad_user").default(false),
  must_change_password: boolean("must_change_password").notNull().default(false),
  company_id: integer("company_id").references(() => companies.id),
  cpf: text("cpf"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Customers table for those who create tickets (ajustado para snake_case)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  company: text("company"),
  user_id: integer("user_id").references(() => users.id),
  avatar_url: text("avatar_url"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Departamentos por empresa - substituindo o enum departmentEnum
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  sla_mode: slaModeEnum("sla_mode").notNull().default('type'),
  satisfaction_survey_enabled: boolean("satisfaction_survey_enabled").default(false).notNull(),
  use_service_providers: boolean("use_service_providers").default(false).notNull(),
  use_inventory_control: boolean("use_inventory_control").default(false).notNull(),
  auto_close_waiting_customer: boolean("auto_close_waiting_customer").default(false).notNull(),
});

// Support staff table (ajustado para usar department_id ao invés de enum)
export const officials = pgTable("officials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department_id: integer("department_id").references(() => departments.id),
  user_id: integer("user_id").references(() => users.id),
  is_active: boolean("is_active").default(true).notNull(),
  avatar_url: text("avatar_url"),
  company_id: integer("company_id").references(() => companies.id),
  supervisor_id: integer("supervisor_id"),
  manager_id: integer("manager_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela para armazenar os departamentos de cada atendente (relação muitos-para-muitos)
// Ajustado para schema real do banco (não tem company_id)
export const officialDepartments = pgTable("official_departments", {
  id: serial("id").primaryKey(),
  official_id: integer("official_id").references(() => officials.id).notNull(),
  department_id: integer("department_id").references(() => departments.id).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// SLA definitions (ajustado para snake_case)
export const slaDefinitions = pgTable("sla_definitions", {
  id: serial("id").primaryKey(),
  priority: text("priority").notNull(), // TEXT para prioridades dinâmicas
  response_time_hours: integer("response_time_hours").notNull(),
  resolution_time_hours: integer("resolution_time_hours").notNull(),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tickets table (ajustado para snake_case)
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticket_id: text("ticket_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default('new'),
  priority: text("priority").notNull().default('MÉDIA'), // TEXT para prioridades dinâmicas
  type: text("type").notNull(),
  incident_type_id: integer("incident_type_id"),
  department_id: integer("department_id"),
  category_id: integer("category_id"),
  customer_id: integer("customer_id").references(() => customers.id),
  customer_email: text("customer_email").notNull(),
  assigned_to_id: integer("assigned_to_id").references(() => officials.id),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  first_response_at: timestamp("first_response_at"),
  resolved_at: timestamp("resolved_at"),
  sla_breached: boolean("sla_breached").default(false),
  waiting_customer_alert_sent_at: timestamp("waiting_customer_alert_sent_at"),
});

// Ticket replies (ajustado para snake_case, removido company_id que não existe no banco)
export const ticketReplies = pgTable("ticket_replies", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id).notNull(),
  user_id: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_internal: boolean("is_internal").default(false),
});

// Ticket status history expandido para suportar mudanças de status e prioridade
export const ticketStatusHistory = pgTable("ticket_status_history", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id).notNull(),
  
  // Campos para mudanças de status (opcionais - usados quando change_type = 'status')
  old_status: ticketStatusEnum("old_status"),
  new_status: ticketStatusEnum("new_status"),
  
  // Campos para mudanças de prioridade (opcionais - usados quando change_type = 'priority')
  old_priority: text("old_priority"), // TEXT para prioridades dinâmicas
  new_priority: text("new_priority"), // TEXT para prioridades dinâmicas
  
  // Tipo de mudança: 'status' ou 'priority'
  change_type: text("change_type").notNull().default('status'),
  
  changed_by_id: integer("changed_by_id").references(() => users.id),
  // Campos para mudança de atribuição (opcionais - usados quando change_type = 'assignment')
  old_assigned_to_id: integer("old_assigned_to_id").references(() => officials.id),
  new_assigned_to_id: integer("new_assigned_to_id").references(() => officials.id),

  // Campos para mudança de departamento/tipo/categoria (change_type = 'department')
  old_department_id: integer("old_department_id").references(() => departments.id),
  new_department_id: integer("new_department_id").references(() => departments.id),
  old_incident_type_id: integer("old_incident_type_id").references(() => incidentTypes.id),
  new_incident_type_id: integer("new_incident_type_id").references(() => incidentTypes.id),
  old_category_id: integer("old_category_id").references(() => categories.id),
  new_category_id: integer("new_category_id").references(() => categories.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// System settings table (ajustado para snake_case)
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Nova tabela para tipos de incidentes (ajustado para snake_case e adicionado value)
export const incidentTypes = pgTable("incident_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  description: text("description"),
  department_id: integer("department_id"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true).notNull(),
});

// Nova tabela para categorias (terceiro nível da hierarquia)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  incident_type_id: integer("incident_type_id").references(() => incidentTypes.id, { onDelete: 'cascade' }),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tipos de chamado por departamento
export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: text("value").notNull(),  // mantido mas sem unique para compatibilidade
  description: text("description"),
  department_id: integer("department_id").references(() => departments.id),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true).notNull(),
});

// User notification settings table
export const userNotificationSettings = pgTable('user_notification_settings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Notificações de tickets
  new_ticket_assigned: boolean('new_ticket_assigned').default(true),
  ticket_status_changed: boolean('ticket_status_changed').default(true),
  new_reply_received: boolean('new_reply_received').default(true),
  ticket_escalated: boolean('ticket_escalated').default(true),
  ticket_due_soon: boolean('ticket_due_soon').default(true),
  
  // Notificações administrativas
  new_customer_registered: boolean('new_customer_registered').default(true),
  new_user_created: boolean('new_user_created').default(true),
  system_maintenance: boolean('system_maintenance').default(true),
  
  // Preferências de entrega
  email_notifications: boolean('email_notifications').default(true),
  
  // Configurações de horário
  notification_hours_start: integer('notification_hours_start').default(9), // 9:00
  notification_hours_end: integer('notification_hours_end').default(18),   // 18:00
  weekend_notifications: boolean('weekend_notifications').default(false),
  
  // Configurações de frequência
  digest_frequency: text('digest_frequency', { enum: ['never', 'daily', 'weekly'] }).default('never'),
  
  created_at: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
});

// Tabela para anexos de tickets
export const ticketAttachments = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  
  // Informações do arquivo
  filename: text("filename").notNull(),
  original_filename: text("original_filename").notNull(),
  file_size: integer("file_size").notNull(),
  mime_type: text("mime_type").notNull(),
  
  // Chaves do S3/Wasabi
  s3_key: text("s3_key").notNull(),
  s3_bucket: text("s3_bucket").notNull(),
  
  // Metadados
  uploaded_at: timestamp("uploaded_at").defaultNow().notNull(),
  is_deleted: boolean("is_deleted").default(false).notNull(),
  deleted_at: timestamp("deleted_at"),
  deleted_by_id: integer("deleted_by_id").references(() => users.id),
});

// Tabela para participantes de tickets (usuários que acompanham chamados)
export const ticketParticipants = pgTable("ticket_participants", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  added_by_id: integer("added_by_id").references(() => users.id),
  added_at: timestamp("added_at").defaultNow().notNull(),
});

// Tabela de prestadores de serviços
export const serviceProviders = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  is_external: boolean("is_external").default(false).notNull(),
  company_id: integer("company_id").references(() => companies.id),
  // Campos para prestadores externos (todos opcionais)
  company_name: text("company_name"),
  cnpj: text("cnpj"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de relacionamento N:N entre departamentos e prestadores de serviços
export const departmentServiceProviders = pgTable("department_service_providers", {
  department_id: integer("department_id").references(() => departments.id, { onDelete: 'cascade' }).notNull(),
  service_provider_id: integer("service_provider_id").references(() => serviceProviders.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.department_id, table.service_provider_id] }),
}));

// Tabela de prestadores vinculados a tickets
export const ticketServiceProviders = pgTable("ticket_service_providers", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  service_provider_id: integer("service_provider_id").references(() => serviceProviders.id, { onDelete: 'cascade' }).notNull(),
  added_by_id: integer("added_by_id").references(() => users.id),
  added_at: timestamp("added_at").defaultNow().notNull(),
});

// Enum para tipos de templates de email
export const emailTemplateTypeEnum = pgEnum('email_template_type', [
  'new_ticket',           // Novo ticket criado
  'ticket_assigned',      // Ticket atribuído
  'ticket_reply',         // Nova resposta
  'status_changed',       // Status alterado
  'ticket_resolved',      // Ticket resolvido
  'ticket_escalated',     // Ticket escalado
  'ticket_due_soon',      // Vencimento próximo
  'customer_registered',  // Novo cliente registrado
  'user_created',         // Novo usuário criado
  'system_maintenance',   // Manutenção do sistema
  'ticket_participant_added',    // Participante adicionado ao ticket
  'ticket_participant_removed',  // Participante removido do ticket
  'satisfaction_survey',         // Pesquisa de satisfação
  'satisfaction_survey_reminder', // Lembrete da pesquisa de satisfação
  'waiting_customer_closure_alert', // Alerta 48h - ticket será encerrado em 24h por falta de interação
]);

// Tabela para templates de email
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: emailTemplateTypeEnum("type").notNull(),
  description: text("description"),
  
  // Templates
  subject_template: text("subject_template").notNull(),
  html_template: text("html_template").notNull(),
  text_template: text("text_template"),
  
  // Configurações
  is_active: boolean("is_active").default(true).notNull(),
  is_default: boolean("is_default").default(false).notNull(),
  
  // Variáveis disponíveis (JSON)
  available_variables: text("available_variables"), // JSON string
  
  // Multi-tenant
  company_id: integer("company_id").references(() => companies.id),
  
  // Metadados
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by_id: integer("created_by_id").references(() => users.id),
  updated_by_id: integer("updated_by_id").references(() => users.id),
});

// Tabela para configurações de IA
export const aiConfigurations = pgTable("ai_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome da configuração (ex: "Análise de Prioridade")
  provider: aiProviderEnum("provider").notNull(),
  model: text("model").notNull(), // gpt-4, gemini-pro, claude-3-sonnet, etc
  api_endpoint: text("api_endpoint"), // Para Azure ou endpoints customizados
  
  // Configurações do prompt
  system_prompt: text("system_prompt").notNull(),
  user_prompt_template: text("user_prompt_template").notNull(), // Template com {titulo} e {descricao}
  
  // Configurações técnicas
  temperature: text("temperature").default("0.1"), // Stored as text for precision
  max_tokens: integer("max_tokens").default(100),
  timeout_seconds: integer("timeout_seconds").default(30),
  max_retries: integer("max_retries").default(3),
  
  // Configurações de fallback
  fallback_priority: text("fallback_priority").default("MÉDIA"), // TEXT para prioridades dinâmicas
  
  // Multi-tenant
  company_id: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  
  // Departamento específico (NULL = configuração global)
  department_id: integer("department_id").references(() => departments.id, { onDelete: "cascade" }),
  
  // Tipo de análise (priority, reopen, etc)
  analysis_type: text("analysis_type").notNull(),
  
  // Status
  is_active: boolean("is_active").default(true).notNull(),
  is_default: boolean("is_default").default(false).notNull(),
  
  // Metadados
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by_id: integer("created_by_id").references(() => users.id),
  updated_by_id: integer("updated_by_id").references(() => users.id),
});

// Tabela para histórico de análises de IA
export const aiAnalysisHistory = pgTable("ai_analysis_history", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id).notNull(),
  ai_configuration_id: integer("ai_configuration_id").references(() => aiConfigurations.id).notNull(),
  
  // Input da análise
  input_title: text("input_title").notNull(),
  input_description: text("input_description").notNull(),
  
  // Output da IA
  suggested_priority: text("suggested_priority").notNull(), // Aceita prioridades dinâmicas em português
  ai_response_raw: text("ai_response_raw"), // Resposta completa da IA
  ai_justification: text("ai_justification"), // Justificativa extraída
  
  // Metadados da requisição
  provider: aiProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  request_tokens: integer("request_tokens"),
  response_tokens: integer("response_tokens"),
  processing_time_ms: integer("processing_time_ms"),
  
  // Status da análise
  status: text("status", { enum: ['success', 'error', 'timeout', 'fallback'] }).notNull(),
  error_message: text("error_message"),
  retry_count: integer("retry_count").default(0),
  
  // Multi-tenant
  company_id: integer("company_id").references(() => companies.id),
  
  // Tipo de análise (priority, reopen, etc)
  analysis_type: text("analysis_type").notNull(),
  
  // Timestamp
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Tabela para prioridades customizáveis por departamento
export const departmentPriorities = pgTable("department_priorities", {
  id: serial("id").primaryKey(),
  company_id: integer("company_id").references(() => companies.id).notNull(),
  department_id: integer("department_id").references(() => departments.id).notNull(),
  name: text("name").notNull(),
  weight: integer("weight").notNull(), // 1 = menor prioridade, maior número = maior prioridade
  color: text("color").default("#6B7280"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela para configurações de SLA granulares
export const slaConfigurations = pgTable("sla_configurations", {
  id: serial("id").primaryKey(),
  company_id: integer("company_id").references(() => companies.id).notNull(),
  department_id: integer("department_id").references(() => departments.id).notNull(),
  incident_type_id: integer("incident_type_id").references(() => incidentTypes.id).notNull(),
  category_id: integer("category_id").references(() => categories.id),
  priority_id: integer("priority_id").references(() => departmentPriorities.id), // NULL = usa prioridade padrão
  response_time_hours: integer("response_time_hours").notNull(),
  resolution_time_hours: integer("resolution_time_hours").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela para pesquisas de satisfação
export const satisfactionSurveys = pgTable("satisfaction_surveys", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  customer_email: text("customer_email").notNull(),
  survey_token: text("survey_token").notNull().unique(),
  sent_at: timestamp("sent_at").defaultNow().notNull(),
  responded_at: timestamp("responded_at"),
  rating: integer("rating"), // 1-5 estrelas, validação será feita no backend
  comments: text("comments"),
  status: text("status", { enum: ['sent', 'responded', 'expired'] }).notNull().default('sent'),
  expires_at: timestamp("expires_at").notNull(),
  reminder_5d_sent: boolean("reminder_5d_sent").default(false).notNull(),
  reminder_3d_sent: boolean("reminder_3d_sent").default(false).notNull(),
  reminder_1d_sent: boolean("reminder_1d_sent").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de notificações persistentes
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default('medium'),
  
  // Metadados opcionais para contexto
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }),
  ticket_code: text("ticket_code"),
  
  // Metadados adicionais em JSON
  metadata: jsonb("metadata"),
  
  // Controle de leitura
  read_at: timestamp("read_at"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de push subscriptions para Web Push
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // Dados da subscription do navegador
  endpoint: text("endpoint").notNull().unique(),
  p256dh_key: text("p256dh_key").notNull(),
  auth_key: text("auth_key").notNull(),
  
  // Metadados
  user_agent: text("user_agent"),
  
  // Timestamps
  created_at: timestamp("created_at").defaultNow().notNull(),
  last_used_at: timestamp("last_used_at"),
});

// Schema for inserting companies
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting customers
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting officials
export const insertOfficialSchema = createInsertSchema(officials).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema para inserir mapeamento de departamentos
export const insertOfficialDepartmentSchema = createInsertSchema(officialDepartments).omit({
  id: true,
  created_at: true,
});

// Schema for inserting tickets
export const insertTicketSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
  customer_email: z.string().email("Endereço de email inválido"),
  type: z.string().min(1, "O tipo de chamado é obrigatório"),
  priority: z.string().optional(),
  department_id: z.coerce.number().optional(),
  incident_type_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  customer_id: z.number().optional(),
  company_id: z.number().optional(),
  participants: z.array(z.number()).optional(), // IDs dos participantes
});

// Schema for inserting ticket replies
export const insertTicketReplySchema = z.object({
  ticket_id: z.number(),
  message: z.string().min(1, "A mensagem é obrigatória"),
  status: z.enum(['new', 'ongoing', 'suspended', 'waiting_customer', 'escalated', 'in_analysis', 'pending_deployment', 'reopened', 'resolved']),
  type: z.string().optional(),
  is_internal: z.boolean().default(false),
  assigned_to_id: z.number().optional(),
  user_id: z.number().optional(),
});

// Schema for inserting ticket status history
export const insertTicketStatusHistorySchema = createInsertSchema(ticketStatusHistory).omit({
  id: true,
  ticket_id: true,
  created_at: true,
});

// Schema for inserting system settings
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  company_id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting incident types
export const insertIncidentTypeSchema = createInsertSchema(incidentTypes).omit({
  id: true,
  department_id: true,
  company_id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting departments
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting ticket types
export const insertTicketTypeSchema = createInsertSchema(ticketTypes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting ticket attachments
export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({
  id: true,
  uploaded_at: true,
  is_deleted: true,
  deleted_at: true,
  deleted_by_id: true,
});

// Schema for inserting email templates
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by_id: true,
  updated_by_id: true,
});

// Schema for updating email templates
export const updateEmailTemplateSchema = insertEmailTemplateSchema.partial();

// Schema for inserting AI configurations
export const insertAiConfigurationSchema = createInsertSchema(aiConfigurations).omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by_id: true,
  updated_by_id: true,
});

// Schema for updating AI configurations
export const updateAiConfigurationSchema = insertAiConfigurationSchema.partial();

// Schema for inserting AI analysis history
export const insertAiAnalysisHistorySchema = createInsertSchema(aiAnalysisHistory).omit({
  id: true,
  created_at: true,
});

// Schema for inserting department priorities
export const insertDepartmentPrioritySchema = createInsertSchema(departmentPriorities).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting SLA configurations
export const insertSlaConfigurationSchema = createInsertSchema(slaConfigurations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Schema for inserting ticket participants
export const insertTicketParticipantSchema = createInsertSchema(ticketParticipants).omit({
  id: true,
  added_at: true,
});

// Schema for inserting satisfaction surveys
export const insertSatisfactionSurveySchema = createInsertSchema(satisfactionSurveys).omit({
  id: true,
  created_at: true,
});

// Schema for inserting notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  created_at: true,
});

// Schema for inserting push subscriptions
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  created_at: true,
  last_used_at: true,
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Official = typeof officials.$inferSelect & {
  departments?: string[] | OfficialDepartment[];
  supervisor?: Partial<Official>;
  manager?: Partial<Official>;
  subordinates?: Partial<Official>[];
  teamMembers?: Partial<Official>[];
  assignedTicketsCount?: number;
};
export type InsertOfficial = z.infer<typeof insertOfficialSchema> & {
  departments?: string[];
};

export type OfficialDepartment = typeof officialDepartments.$inferSelect;
export type InsertOfficialDepartment = z.infer<typeof insertOfficialDepartmentSchema>;

export type Ticket = typeof tickets.$inferSelect & {
  customer: Partial<Customer>;
  official?: Partial<Official>;
  replies?: TicketReply[];
  incidentType?: IncidentType;
  attachments?: TicketAttachment[];
  participants?: TicketParticipant[];
  userContext?: 'customer' | 'official' | 'both'; // Contexto do usuário para este ticket
};
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type TicketReply = typeof ticketReplies.$inferSelect & {
  user?: Partial<User>;
};
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;

export type TicketStatusHistory = typeof ticketStatusHistory.$inferSelect & {
  user?: Partial<User>;
};

export type SLADefinition = typeof slaDefinitions.$inferSelect;

export type SystemSetting = typeof systemSettings.$inferSelect;

export type IncidentType = typeof incidentTypes.$inferSelect & {
  company?: Partial<Company>;
};

export type Category = typeof categories.$inferSelect & {
  company?: Partial<Company>;
  incident_type?: Partial<IncidentType>;
};

export type Department = typeof departments.$inferSelect & {
  company?: Partial<Company>;
};
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = typeof serviceProviders.$inferInsert;

export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;

export type TicketAttachment = typeof ticketAttachments.$inferSelect & {
  user?: Partial<User>;
};
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect & {
  created_by?: Partial<User>;
  updated_by?: Partial<User>;
  company?: Partial<Company>;
};
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;

export type AiConfiguration = typeof aiConfigurations.$inferSelect & {
  created_by?: Partial<User>;
  updated_by?: Partial<User>;
};
export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;
export type UpdateAiConfiguration = z.infer<typeof updateAiConfigurationSchema>;

export type AiAnalysisHistory = typeof aiAnalysisHistory.$inferSelect & {
  ticket?: Partial<Ticket>;
  ai_configuration?: Partial<AiConfiguration>;
  company?: Partial<Company>;
};
export type InsertAiAnalysisHistory = z.infer<typeof insertAiAnalysisHistorySchema>;

export type DepartmentPriority = typeof departmentPriorities.$inferSelect & {
  company?: Partial<Company>;
  department?: Partial<Department>;
};
export type InsertDepartmentPriority = z.infer<typeof insertDepartmentPrioritySchema>;

export type SlaConfiguration = typeof slaConfigurations.$inferSelect & {
  company?: Partial<Company>;
  department?: Partial<Department>;
  incident_type?: Partial<IncidentType>;
  priority?: Partial<DepartmentPriority>;
};
export type InsertSlaConfiguration = z.infer<typeof insertSlaConfigurationSchema>;

export type TicketParticipant = typeof ticketParticipants.$inferSelect & {
  user?: Partial<User>;
  added_by?: Partial<User>;
};
export type InsertTicketParticipant = z.infer<typeof insertTicketParticipantSchema>;

export type SatisfactionSurvey = typeof satisfactionSurveys.$inferSelect & {
  ticket?: Partial<Ticket>;
  company?: Partial<Company>;
};
export type InsertSatisfactionSurvey = z.infer<typeof insertSatisfactionSurveySchema>;

export type Notification = typeof notifications.$inferSelect & {
  user?: Partial<User>;
  ticket?: Partial<Ticket>;
};
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type PushSubscription = typeof pushSubscriptions.$inferSelect & {
  user?: Partial<User>;
};
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Relation declarations

// Relações para a tabela de tickets
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  ticketServiceProviders: many(ticketServiceProviders),
  customer: one(customers, {
    fields: [tickets.customer_id],
    references: [customers.id],
  }),
  official: one(officials, {
    fields: [tickets.assigned_to_id],
    references: [officials.id],
  }),
  replies: many(ticketReplies),
  statusHistory: many(ticketStatusHistory),
  attachments: many(ticketAttachments),
  participants: many(ticketParticipants),
}));

// Relações para a tabela de respostas de tickets
export const ticketRepliesRelations = relations(ticketReplies, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketReplies.ticket_id],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketReplies.user_id],
    references: [users.id],
  }),
}));

// Relações para a tabela de histórico de status
export const ticketStatusHistoryRelations = relations(ticketStatusHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketStatusHistory.ticket_id],
    references: [tickets.id],
  }),
  changed_by: one(users, {
    fields: [ticketStatusHistory.changed_by_id],
    references: [users.id],
  }),
}));

// Relações para a tabela de departamentos
export const departmentsRelations = relations(departments, ({ many, one }) => ({
  company: one(companies, {
    fields: [departments.company_id],
    references: [companies.id],
  }),
  ticketTypes: many(ticketTypes),
  officials: many(officialDepartments, { relationName: "department_officials" }),
  departmentServiceProviders: many(departmentServiceProviders),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  department: one(departments, {
    fields: [ticketTypes.department_id],
    references: [departments.id],
  }),
  company: one(companies, {
    fields: [ticketTypes.company_id],
    references: [companies.id],
  }),
}));

// Relações para a tabela de tipos de incidentes
export const incidentTypesRelations = relations(incidentTypes, ({ one }) => ({
  department: one(departments, {
    fields: [incidentTypes.department_id],
    references: [departments.id],
  }),
  company: one(companies, {
    fields: [incidentTypes.company_id],
    references: [companies.id],
  }),
}));

// Relações para a tabela de anexos de tickets
export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketAttachments.ticket_id],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketAttachments.user_id],
    references: [users.id],
  }),
  deleted_by: one(users, {
    fields: [ticketAttachments.deleted_by_id],
    references: [users.id],
  }),
}));

// Relações para a tabela de templates de email
export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  company: one(companies, {
    fields: [emailTemplates.company_id],
    references: [companies.id],
  }),
  created_by: one(users, {
    fields: [emailTemplates.created_by_id],
    references: [users.id],
  }),
  updated_by: one(users, {
    fields: [emailTemplates.updated_by_id],
    references: [users.id],
  }),
}));

// Relações para a tabela de configurações de IA
export const aiConfigurationsRelations = relations(aiConfigurations, ({ one, many }) => ({
  created_by: one(users, {
    fields: [aiConfigurations.created_by_id],
    references: [users.id],
  }),
  updated_by: one(users, {
    fields: [aiConfigurations.updated_by_id],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [aiConfigurations.company_id],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [aiConfigurations.department_id],
    references: [departments.id],
  }),
  analysisHistory: many(aiAnalysisHistory),
}));

// Relações para a tabela de histórico de análises de IA
export const aiAnalysisHistoryRelations = relations(aiAnalysisHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [aiAnalysisHistory.ticket_id],
    references: [tickets.id],
  }),
  ai_configuration: one(aiConfigurations, {
    fields: [aiAnalysisHistory.ai_configuration_id],
    references: [aiConfigurations.id],
  }),
  company: one(companies, {
    fields: [aiAnalysisHistory.company_id],
    references: [companies.id],
  }),
}));

// Relações para a tabela de prioridades por departamento
export const departmentPrioritiesRelations = relations(departmentPriorities, ({ one, many }) => ({
  company: one(companies, {
    fields: [departmentPriorities.company_id],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [departmentPriorities.department_id],
    references: [departments.id],
  }),
  slaConfigurations: many(slaConfigurations),
}));

// Relações para a tabela de configurações de SLA
export const slaConfigurationsRelations = relations(slaConfigurations, ({ one }) => ({
  company: one(companies, {
    fields: [slaConfigurations.company_id],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [slaConfigurations.department_id],
    references: [departments.id],
  }),
  incident_type: one(incidentTypes, {
    fields: [slaConfigurations.incident_type_id],
    references: [incidentTypes.id],
  }),
  priority: one(departmentPriorities, {
    fields: [slaConfigurations.priority_id],
    references: [departmentPriorities.id],
  }),
}));

// Relações para a tabela de participantes de tickets
export const ticketParticipantsRelations = relations(ticketParticipants, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketParticipants.ticket_id],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketParticipants.user_id],
    references: [users.id],
  }),
  added_by: one(users, {
    fields: [ticketParticipants.added_by_id],
    references: [users.id],
  }),
}));

// Relações para a tabela de pesquisas de satisfação
export const satisfactionSurveysRelations = relations(satisfactionSurveys, ({ one }) => ({
  ticket: one(tickets, {
    fields: [satisfactionSurveys.ticket_id],
    references: [tickets.id],
  }),
  company: one(companies, {
    fields: [satisfactionSurveys.company_id],
    references: [companies.id],
  }),
}));

// Relações para prestadores de serviços
export const serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  company: one(companies, {
    fields: [serviceProviders.company_id],
    references: [companies.id],
  }),
  departmentServiceProviders: many(departmentServiceProviders),
  ticketServiceProviders: many(ticketServiceProviders),
}));

// Relações para departamento-prestadores
export const departmentServiceProvidersRelations = relations(departmentServiceProviders, ({ one }) => ({
  department: one(departments, {
    fields: [departmentServiceProviders.department_id],
    references: [departments.id],
  }),
  serviceProvider: one(serviceProviders, {
    fields: [departmentServiceProviders.service_provider_id],
    references: [serviceProviders.id],
  }),
}));

// Relações para ticket-prestadores
export const ticketServiceProvidersRelations = relations(ticketServiceProviders, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketServiceProviders.ticket_id],
    references: [tickets.id],
  }),
  serviceProvider: one(serviceProviders, {
    fields: [ticketServiceProviders.service_provider_id],
    references: [serviceProviders.id],
  }),
  addedBy: one(users, {
    fields: [ticketServiceProviders.added_by_id],
    references: [users.id],
  }),
}));

// ========================================
// SISTEMA DE CONTROLE DE ESTOQUE
// ========================================

// Tabela: product_categories
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color").default('#6B7280'),
  // Regras centralizadas na categoria
  is_consumable: boolean("is_consumable").notNull().default(false),
  requires_serial: boolean("requires_serial").notNull().default(false),
  requires_asset_tag: boolean("requires_asset_tag").notNull().default(false),
  min_stock_alert: integer("min_stock_alert"),
  custom_fields: text("custom_fields").notNull().default('{}'),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  department_id: integer("department_id").references(() => departments.id, { onDelete: 'cascade' }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: product_types
export const productTypes = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  category_id: integer("category_id").notNull().references(() => productCategories.id, { onDelete: 'restrict' }),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  depreciation_years: integer("depreciation_years"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_suppliers
export const inventorySuppliers = pgTable("inventory_suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  contact_name: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  payment_terms: text("payment_terms"),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  is_active: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_locations
export const inventoryLocations = pgTable("inventory_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parent_location_id: integer("parent_location_id").references((): any => inventoryLocations.id, { onDelete: 'set null' }),
  type: text("type").notNull(),
  qr_code: text("qr_code"),
  department_id: integer("department_id").references(() => departments.id, { onDelete: 'set null' }),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_products
export const inventoryProducts = pgTable("inventory_products", {
  id: serial("id").primaryKey(),
  product_type_id: integer("product_type_id").references(() => productTypes.id, { onDelete: 'restrict' }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  brand: text("brand"),
  model: text("model"),
  serial_number: text("serial_number"),
  service_tag: text("service_tag"),
  asset_number: text("asset_number"),
  purchase_date: timestamp("purchase_date", { withTimezone: false, mode: 'string' }),
  warranty_expiry: timestamp("warranty_expiry", { withTimezone: false, mode: 'string' }),
  supplier_id: integer("supplier_id").references(() => inventorySuppliers.id, { onDelete: 'set null' }),
  purchase_value: text("purchase_value"),
  depreciation_value: text("depreciation_value"),
  status: text("status").notNull().default('available'),
  location_id: integer("location_id").references(() => inventoryLocations.id, { onDelete: 'set null' }),
  department_id: integer("department_id").references(() => departments.id, { onDelete: 'set null' }),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  invoice_number: text("invoice_number"),
  invoice_date: timestamp("invoice_date", { withTimezone: false, mode: 'string' }),
  invoice_file_id: integer("invoice_file_id"),
  notes: text("notes"),
  specifications: text("specifications").notNull().default('{}'),
  photos: text("photos").notNull().default('[]'),
  is_deleted: boolean("is_deleted").notNull().default(false),
  deleted_at: timestamp("deleted_at", { withTimezone: false }),
  deleted_by_id: integer("deleted_by_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  created_by_id: integer("created_by_id").references(() => users.id),
  updated_by_id: integer("updated_by_id").references(() => users.id),
});

// Tabela: inventory_movements
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'restrict' }),
  movement_type: text("movement_type").notNull(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'set null' }),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  responsible_id: integer("responsible_id").references(() => users.id, { onDelete: 'set null' }),
  quantity: integer("quantity").notNull().default(1),
  from_location_id: integer("from_location_id").references(() => inventoryLocations.id, { onDelete: 'set null' }),
  to_location_id: integer("to_location_id").references(() => inventoryLocations.id, { onDelete: 'set null' }),
  reason: text("reason"),
  notes: text("notes"),
  movement_date: timestamp("movement_date", { withTimezone: false }).notNull().defaultNow(),
  approval_status: text("approval_status").notNull().default('pending'),
  approved_by_id: integer("approved_by_id").references(() => users.id),
  approval_date: timestamp("approval_date", { withTimezone: false }),
  approval_notes: text("approval_notes"),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  created_by_id: integer("created_by_id").references(() => users.id),
  is_stock_transfer: boolean("is_stock_transfer").notNull().default(false),
  movement_group_id: text("movement_group_id"),
  is_batch_movement: boolean("is_batch_movement").notNull().default(false),
});

// Tabela: user_inventory_assignments
export const userInventoryAssignments = pgTable("user_inventory_assignments", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'restrict' }).notNull(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'restrict' }).notNull(),
  assigned_date: timestamp("assigned_date", { withTimezone: false }).notNull().defaultNow(),
  expected_return_date: timestamp("expected_return_date", { withTimezone: false, mode: 'string' }),
  actual_return_date: timestamp("actual_return_date", { withTimezone: false }),
  condition_on_return: text("condition_on_return"),
  responsibility_term_id: integer("responsibility_term_id"),
  signature_status: text("signature_status").notNull().default('pending'),
  notes: text("notes"),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  assigned_by_id: integer("assigned_by_id").references(() => users.id),
  returned_by_id: integer("returned_by_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  assignment_group_id: text("assignment_group_id"),
});

// Tabela: ticket_inventory_items
export const ticketInventoryItems = pgTable("ticket_inventory_items", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'restrict' }).notNull(),
  movement_id: integer("movement_id").references(() => inventoryMovements.id, { onDelete: 'set null' }),
  action_type: text("action_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  condition: text("condition"),
  notes: text("notes"),
  created_by_id: integer("created_by_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_movement_items
export const inventoryMovementItems = pgTable("inventory_movement_items", {
  id: serial("id").primaryKey(),
  movement_id: integer("movement_id").references(() => inventoryMovements.id, { onDelete: 'cascade' }).notNull(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'restrict' }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: responsibility_term_assignments
export const responsibilityTermAssignments = pgTable("responsibility_term_assignments", {
  id: serial("id").primaryKey(),
  term_id: integer("term_id").references(() => inventoryResponsibilityTerms.id, { onDelete: 'cascade' }).notNull(),
  assignment_id: integer("assignment_id").references(() => userInventoryAssignments.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_responsibility_terms
export const inventoryResponsibilityTerms = pgTable("inventory_responsibility_terms", {
  id: serial("id").primaryKey(),
  assignment_id: integer("assignment_id").references(() => userInventoryAssignments.id, { onDelete: 'cascade' }),
  template_id: integer("template_id"),
  template_version: integer("template_version"),
  generated_pdf_url: text("generated_pdf_url"),
  pdf_s3_key: text("pdf_s3_key"),
  signed_pdf_s3_key: text("signed_pdf_s3_key"),
  sent_date: timestamp("sent_date", { withTimezone: false }),
  signed_date: timestamp("signed_date", { withTimezone: false }),
  signature_method: text("signature_method"),
  signature_data: text("signature_data"),
  status: text("status").notNull().default('pending'),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  is_batch_term: boolean("is_batch_term").notNull().default(false),
});

// Tabela: department_inventory_settings
export const departmentInventorySettings = pgTable("department_inventory_settings", {
  id: serial("id").primaryKey(),
  department_id: integer("department_id").references(() => departments.id, { onDelete: 'cascade' }).notNull().unique(),
  allowed_product_types: text("allowed_product_types").notNull().default('[]'),
  approval_rules: text("approval_rules").notNull().default('{}'),
  min_stock_alerts: boolean("min_stock_alerts").notNull().default(true),
  require_return_workflow: boolean("require_return_workflow").notNull().default(false),
  default_assignment_days: integer("default_assignment_days").default(30),
  auto_create_maintenance_tickets: boolean("auto_create_maintenance_tickets").notNull().default(false),
  maintenance_interval_days: integer("maintenance_interval_days"),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_product_history
export const inventoryProductHistory = pgTable("inventory_product_history", {
  id: serial("id").primaryKey(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'cascade' }).notNull(),
  changed_by_id: integer("changed_by_id").references(() => users.id),
  change_type: text("change_type").notNull(),
  old_values: text("old_values"),
  new_values: text("new_values"),
  change_description: text("change_description"),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_term_templates
export const inventoryTermTemplates = pgTable("inventory_term_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  is_active: boolean("is_active").notNull().default(true),
  is_default: boolean("is_default").notNull().default(false),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  created_by_id: integer("created_by_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_alerts
export const inventoryAlerts = pgTable("inventory_alerts", {
  id: serial("id").primaryKey(),
  alert_type: text("alert_type").notNull(),
  product_id: integer("product_id").references(() => inventoryProducts.id, { onDelete: 'cascade' }),
  assignment_id: integer("assignment_id").references(() => userInventoryAssignments.id, { onDelete: 'cascade' }),
  severity: text("severity").notNull().default('medium'),
  message: text("message").notNull(),
  is_resolved: boolean("is_resolved").notNull().default(false),
  resolved_at: timestamp("resolved_at", { withTimezone: false }),
  resolved_by_id: integer("resolved_by_id").references(() => users.id),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_webhooks
export const inventoryWebhooks = pgTable("inventory_webhooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").notNull().default('[]'),
  is_active: boolean("is_active").notNull().default(true),
  secret_key: text("secret_key"),
  company_id: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  created_by_id: integer("created_by_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: inventory_permissions
export const inventoryPermissions = pgTable("inventory_permissions", {
  id: serial("id").primaryKey(),
  permission_code: text("permission_code").notNull().unique(),
  permission_name: text("permission_name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  created_at: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

// Tabela: user_inventory_permissions
export const userInventoryPermissions = pgTable("user_inventory_permissions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  permission_id: integer("permission_id").references(() => inventoryPermissions.id, { onDelete: 'cascade' }).notNull(),
  granted_by_id: integer("granted_by_id").references(() => users.id),
  granted_at: timestamp("granted_at", { withTimezone: false }).notNull().defaultNow(),
});

// ========================================
// SCHEMAS ZOD PARA VALIDAÇÃO - SISTEMA DE ESTOQUE
// ========================================

// Schema para inserção de categoria de produto
export const insertProductCategorySchema = createInsertSchema(productCategories, {
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve ser um hexadecimal válido").optional(),
  department_id: z.number().positive().optional(),
  is_consumable: z.boolean().optional(),
  requires_serial: z.boolean().optional(),
  requires_asset_tag: z.boolean().optional(),
  min_stock_alert: z.number().nonnegative().optional(),
  custom_fields: z.string().optional(),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const selectProductCategorySchema = createInsertSchema(productCategories);

// Schema para inserção de tipo de produto
export const insertProductTypeSchema = createInsertSchema(productTypes, {
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
  category_id: z.number().positive("Categoria é obrigatória"),
  depreciation_years: z.number().positive().optional(),
});

export const selectProductTypeSchema = createInsertSchema(productTypes);

// Schema para inserção de fornecedor
export const insertInventorySupplierSchema = createInsertSchema(inventorySuppliers, {
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
});

export const selectInventorySupplierSchema = createInsertSchema(inventorySuppliers);

// Schema para inserção de localização
export const insertInventoryLocationSchema = createInsertSchema(inventoryLocations, {
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(['building', 'floor', 'room', 'storage']),
});

export const selectInventoryLocationSchema = createInsertSchema(inventoryLocations);

// Schema para inserção de produto
export const insertInventoryProductSchema = createInsertSchema(inventoryProducts, {
  name: z.string().min(1, "Nome é obrigatório"),
  product_type_id: z.number().positive("Tipo de produto é obrigatório"),
  status: z.enum(['available', 'in_use', 'maintenance', 'written_off', 'reserved']).optional(),
  specifications: z.string().optional(),
  photos: z.string().optional(),
});

export const selectInventoryProductSchema = createInsertSchema(inventoryProducts);

// Schema para inserção de movimentação
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements, {
  product_id: z.number().positive("Produto é obrigatório").optional(),
  movement_type: z.enum(['entry', 'withdrawal', 'return', 'write_off', 'transfer', 'maintenance', 'reservation']),
  quantity: z.number().positive().default(1),
  approval_status: z.enum(['pending', 'approved', 'rejected', 'not_required']).optional(),
  is_batch_movement: z.boolean().optional(),
});

export const selectInventoryMovementSchema = createInsertSchema(inventoryMovements);

// Schema para inserção de alocação de usuário
export const insertUserInventoryAssignmentSchema = createInsertSchema(userInventoryAssignments, {
  user_id: z.number().positive("Usuário é obrigatório"),
  product_id: z.number().positive("Produto é obrigatório"),
  signature_status: z.enum(['pending', 'sent', 'signed', 'expired']).optional(),
});

export const selectUserInventoryAssignmentSchema = createInsertSchema(userInventoryAssignments);

// Schema para inserção de item de ticket
export const insertTicketInventoryItemSchema = createInsertSchema(ticketInventoryItems, {
  ticket_id: z.number().positive("Ticket é obrigatório"),
  product_id: z.number().positive("Produto é obrigatório"),
  action_type: z.enum(['delivery', 'return', 'replacement', 'consumption', 'reservation']),
  quantity: z.number().positive().default(1),
});

export const selectTicketInventoryItemSchema = createInsertSchema(ticketInventoryItems);

// Schema para inserção de termo de responsabilidade
export const insertInventoryResponsibilityTermSchema = createInsertSchema(inventoryResponsibilityTerms, {
  assignment_id: z.number().positive("Alocação é obrigatória").optional(),
  status: z.enum(['pending', 'sent', 'signed', 'expired', 'cancelled']).optional(),
  signature_method: z.enum(['email', 'digital', 'physical']).optional(),
  is_batch_term: z.boolean().optional(),
});

export const selectInventoryResponsibilityTermSchema = createInsertSchema(inventoryResponsibilityTerms);

// Schema para inserção de configurações de departamento
export const insertDepartmentInventorySettingsSchema = createInsertSchema(departmentInventorySettings, {
  department_id: z.number().positive("Departamento é obrigatório"),
  allowed_product_types: z.string().optional(),
  approval_rules: z.string().optional(),
  default_assignment_days: z.number().positive().optional(),
  maintenance_interval_days: z.number().positive().optional(),
});

export const selectDepartmentInventorySettingsSchema = createInsertSchema(departmentInventorySettings);

// Schema para inserção de template de termo
export const insertInventoryTermTemplateSchema = createInsertSchema(inventoryTermTemplates, {
  name: z.string().min(1, "Nome é obrigatório"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  version: z.number().positive().default(1),
});

export const selectInventoryTermTemplateSchema = createInsertSchema(inventoryTermTemplates);

// Schema para inserção de alerta
export const insertInventoryAlertSchema = createInsertSchema(inventoryAlerts, {
  alert_type: z.enum(['low_stock', 'warranty_expiring', 'overdue_return', 'maintenance_due', 'obsolete_item']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  message: z.string().min(1, "Mensagem é obrigatória"),
});

export const selectInventoryAlertSchema = createInsertSchema(inventoryAlerts);

// Schema para inserção de webhook
export const insertInventoryWebhookSchema = createInsertSchema(inventoryWebhooks, {
  name: z.string().min(1, "Nome é obrigatório"),
  url: z.string().url("URL inválida"),
  events: z.string().optional(),
});

export const selectInventoryWebhookSchema = createInsertSchema(inventoryWebhooks);

// ========================================
// TYPES TYPESCRIPT - SISTEMA DE ESTOQUE
// ========================================

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

export type ProductType = typeof productTypes.$inferSelect;
export type InsertProductType = typeof productTypes.$inferInsert;

export type InventorySupplier = typeof inventorySuppliers.$inferSelect;
export type InsertInventorySupplier = typeof inventorySuppliers.$inferInsert;

export type InventoryLocation = typeof inventoryLocations.$inferSelect;
export type InsertInventoryLocation = typeof inventoryLocations.$inferInsert;

export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type InsertInventoryProduct = typeof inventoryProducts.$inferInsert;

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

export type UserInventoryAssignment = typeof userInventoryAssignments.$inferSelect;
export type InsertUserInventoryAssignment = typeof userInventoryAssignments.$inferInsert;

export type TicketInventoryItem = typeof ticketInventoryItems.$inferSelect;
export type InsertTicketInventoryItem = typeof ticketInventoryItems.$inferInsert;

export type InventoryMovementItem = typeof inventoryMovementItems.$inferSelect;
export type InsertInventoryMovementItem = typeof inventoryMovementItems.$inferInsert;

export type ResponsibilityTermAssignment = typeof responsibilityTermAssignments.$inferSelect;
export type InsertResponsibilityTermAssignment = typeof responsibilityTermAssignments.$inferInsert;

export type InventoryResponsibilityTerm = typeof inventoryResponsibilityTerms.$inferSelect;
export type InsertInventoryResponsibilityTerm = typeof inventoryResponsibilityTerms.$inferInsert;

export type DepartmentInventorySettings = typeof departmentInventorySettings.$inferSelect;
export type InsertDepartmentInventorySettings = typeof departmentInventorySettings.$inferInsert;

export type InventoryProductHistory = typeof inventoryProductHistory.$inferSelect;
export type InsertInventoryProductHistory = typeof inventoryProductHistory.$inferInsert;

export type InventoryTermTemplate = typeof inventoryTermTemplates.$inferSelect;
export type InsertInventoryTermTemplate = typeof inventoryTermTemplates.$inferInsert;

export type InventoryAlert = typeof inventoryAlerts.$inferSelect;
export type InsertInventoryAlert = typeof inventoryAlerts.$inferInsert;

export type InventoryWebhook = typeof inventoryWebhooks.$inferSelect;
export type InsertInventoryWebhook = typeof inventoryWebhooks.$inferInsert;

export type InventoryPermission = typeof inventoryPermissions.$inferSelect;
export type InsertInventoryPermission = typeof inventoryPermissions.$inferInsert;

export type UserInventoryPermission = typeof userInventoryPermissions.$inferSelect;
export type InsertUserInventoryPermission = typeof userInventoryPermissions.$inferInsert;

// Relações para notificações
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
  ticket: one(tickets, {
    fields: [notifications.ticket_id],
    references: [tickets.id],
  }),
}));

// Relações para push subscriptions
export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.user_id],
    references: [users.id],
  }),
}));
