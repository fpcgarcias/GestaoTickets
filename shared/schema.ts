import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const ticketStatusEnum = pgEnum('ticket_status', ['new', 'ongoing', 'resolved']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
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
export const departmentEnum = pgEnum('department', ['technical', 'billing', 'general', 'sales', 'other']);

// Tabela de empresas para suporte multi-tenant (ajustado para snake_case conforme banco de dados)
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  domain: text("domain"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  cnpj: text("cnpj"),
  phone: text("phone"),
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

// Support staff table (ajustado para snake_case)
export const officials = pgTable("officials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: departmentEnum("department"),
  user_id: integer("user_id").references(() => users.id),
  is_active: boolean("is_active").default(true).notNull(),
  avatar_url: text("avatar_url"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela para armazenar os departamentos de cada atendente (relação muitos-para-muitos)
// Ajustado para schema real do banco (não tem company_id)
export const officialDepartments = pgTable("official_departments", {
  id: serial("id").primaryKey(),
  official_id: integer("official_id").references(() => officials.id).notNull(),
  department: text("department").notNull(), // Não é enum no banco
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// SLA definitions (ajustado para snake_case)
export const slaDefinitions = pgTable("sla_definitions", {
  id: serial("id").primaryKey(),
  priority: ticketPriorityEnum("priority").notNull(),
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
  priority: ticketPriorityEnum("priority").notNull().default('medium'),
  type: text("type").notNull(),
  incident_type_id: integer("incident_type_id"),
  department_id: integer("department_id"),
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

// Ticket status history (ajustado para snake_case, removido company_id)
export const ticketStatusHistory = pgTable("ticket_status_history", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").references(() => tickets.id).notNull(),
  old_status: ticketStatusEnum("old_status"),
  new_status: ticketStatusEnum("new_status").notNull(),
  changed_by_id: integer("changed_by_id").references(() => users.id),
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
  department_id: integer("department_id"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true).notNull(),
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

// Schema for inserting companies
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  department_id: z.number().optional(),
  incident_type_id: z.number().optional(),
  customer_id: z.number().optional(),
  company_id: z.number().optional(),
});

// Schema for inserting ticket replies
export const insertTicketReplySchema = z.object({
  ticket_id: z.number(),
  message: z.string().min(1, "A mensagem é obrigatória"),
  status: z.enum(['new', 'ongoing', 'resolved']),
  type: z.string().optional(),
  is_internal: z.boolean().default(false),
  assigned_to_id: z.number().optional(),
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

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Official = typeof officials.$inferSelect & {
  departments?: string[] | OfficialDepartment[];
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
};
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type TicketReply = typeof ticketReplies.$inferSelect & {
  user?: Partial<User>;
};
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;

export type TicketStatusHistory = typeof ticketStatusHistory.$inferSelect;

export type SLADefinition = typeof slaDefinitions.$inferSelect;

export type SystemSetting = typeof systemSettings.$inferSelect;

export type IncidentType = typeof incidentTypes.$inferSelect;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;

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
