import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const ticketStatusEnum = pgEnum('ticket_status', ['new', 'ongoing', 'resolved']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'support', 'customer']);
export const departmentEnum = pgEnum('department', ['technical', 'billing', 'general', 'sales', 'other']);

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default('customer'),
  avatarUrl: text("avatar_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customers table for those who create tickets
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  company: text("company"),
  userId: integer("user_id").references(() => users.id),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Support staff table
export const officials = pgTable("officials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Removendo o campo department direto e vamos usar a tabela de junção
  userId: integer("user_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela para armazenar os departamentos de cada atendente (relação muitos-para-muitos)
export const officialDepartments = pgTable("official_departments", {
  id: serial("id").primaryKey(),
  officialId: integer("official_id").references(() => officials.id).notNull(),
  department: departmentEnum("department").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SLA definitions
export const slaDefinitions = pgTable("sla_definitions", {
  id: serial("id").primaryKey(),
  priority: ticketPriorityEnum("priority").notNull(),
  responseTimeHours: integer("response_time_hours").notNull(),
  resolutionTimeHours: integer("resolution_time_hours").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tickets table
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(), // Human-readable ID like 2023-CS123
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default('new'),
  priority: ticketPriorityEnum("priority").notNull().default('medium'),
  type: text("type").notNull(), // technical, account, billing, feature, deposit
  departmentId: integer("department_id"), // Departamento relacionado ao ticket
  customerId: integer("customer_id").references(() => customers.id),
  customerEmail: text("customer_email").notNull(),
  assignedToId: integer("assigned_to_id").references(() => officials.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  slaBreached: boolean("sla_breached").default(false),
});

// Ticket replies
export const ticketReplies = pgTable("ticket_replies", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isInternal: boolean("is_internal").default(false),
});

// Ticket status history
export const ticketStatusHistory = pgTable("ticket_status_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  oldStatus: ticketStatusEnum("old_status"),
  newStatus: ticketStatusEnum("new_status").notNull(),
  changedById: integer("changed_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System settings table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting customers
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting officials
export const insertOfficialSchema = createInsertSchema(officials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema para inserir mapeamento de departamentos
export const insertOfficialDepartmentSchema = createInsertSchema(officialDepartments).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting tickets
export const insertTicketSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
  customerEmail: z.string().email("Endereço de email inválido"),
  type: z.string().min(1, "O tipo de chamado é obrigatório"),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  departmentId: z.number().optional(),
});

// Schema for inserting ticket replies
export const insertTicketReplySchema = z.object({
  ticketId: z.number(),
  message: z.string().min(1, "A mensagem é obrigatória"),
  status: z.enum(['new', 'ongoing', 'resolved']),
  type: z.string().optional(),
  isInternal: z.boolean().default(false),
  assignedToId: z.number().optional(), // Campo opcional para atribuir o chamado a um atendente
});

// Types
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
};
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type TicketReply = typeof ticketReplies.$inferSelect & {
  user?: Partial<User>;
};
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;

export type TicketStatusHistory = typeof ticketStatusHistory.$inferSelect;

export type SLADefinition = typeof slaDefinitions.$inferSelect;

export type SystemSetting = typeof systemSettings.$inferSelect;
