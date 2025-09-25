import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
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
  'admin',          // Acesso total ao sistema, multiempresa
  'customer',       // Cliente da empresa
  'support',        // Atendente
  'manager',        // Gestor da equipe
  'supervisor',     // Nível entre manager e support
  'viewer',         // Apenas visualização de chamados
  'company_admin',  // Admin local da empresa
  'triage',         // Classificação e encaminhamento
  'quality',        // Avaliação de qualidade
  'integration_bot' // Bots e integrações
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
  ai_permission: boolean("ai_permission").notNull().default(true), // Permite que a empresa use IA
  uses_flexible_sla: boolean("uses_flexible_sla").notNull().default(false), // Flag para sistema de SLA flexível
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
  'satisfaction_survey',         // Pesquisa de satisfacao
  'satisfaction_survey_reminder', // Lembrete da pesquisa de satisfacao
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

// Relation declarations

// Relações para a tabela de tickets
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
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
