import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Enums
export var ticketStatusEnum = pgEnum('ticket_status', ['new', 'ongoing', 'resolved']);
export var ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
export var userRoleEnum = pgEnum('user_role', ['admin', 'support', 'customer']);
export var departmentEnum = pgEnum('department', ['technical', 'billing', 'general', 'sales', 'other']);
// Users table for authentication
export var users = pgTable("users", {
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
export var customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    company: text("company"),
    userId: integer("user_id").references(function () { return users.id; }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
// Support staff table
export var officials = pgTable("officials", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    // Removendo o campo department direto e vamos usar a tabela de junção
    userId: integer("user_id").references(function () { return users.id; }),
    isActive: boolean("is_active").default(true).notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
// Tabela para armazenar os departamentos de cada atendente (relação muitos-para-muitos)
export var officialDepartments = pgTable("official_departments", {
    id: serial("id").primaryKey(),
    officialId: integer("official_id").references(function () { return officials.id; }).notNull(),
    department: departmentEnum("department").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
// SLA definitions
export var slaDefinitions = pgTable("sla_definitions", {
    id: serial("id").primaryKey(),
    priority: ticketPriorityEnum("priority").notNull(),
    responseTimeHours: integer("response_time_hours").notNull(),
    resolutionTimeHours: integer("resolution_time_hours").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
// Tickets table
export var tickets = pgTable("tickets", {
    id: serial("id").primaryKey(),
    ticketId: text("ticket_id").notNull().unique(), // Human-readable ID like 2023-CS123
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default('new'),
    priority: ticketPriorityEnum("priority").notNull().default('medium'),
    type: text("type").notNull(), // technical, account, billing, feature, deposit
    incidentTypeId: integer("incident_type_id"), // Referência para o tipo de incidente (nova coluna)
    departmentId: integer("department_id"), // Departamento relacionado ao ticket
    customerId: integer("customer_id").references(function () { return customers.id; }),
    customerEmail: text("customer_email").notNull(),
    assignedToId: integer("assigned_to_id").references(function () { return officials.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    slaBreached: boolean("sla_breached").default(false),
});
// Ticket replies
export var ticketReplies = pgTable("ticket_replies", {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").references(function () { return tickets.id; }).notNull(),
    userId: integer("user_id").references(function () { return users.id; }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    isInternal: boolean("is_internal").default(false),
});
// Ticket status history
export var ticketStatusHistory = pgTable("ticket_status_history", {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").references(function () { return tickets.id; }).notNull(),
    oldStatus: ticketStatusEnum("old_status"),
    newStatus: ticketStatusEnum("new_status").notNull(),
    changedById: integer("changed_by_id").references(function () { return users.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
// System settings table
export var systemSettings = pgTable("system_settings", {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
// Nova tabela para tipos de incidentes
export var incidentTypes = pgTable("incident_types", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    value: text("value").notNull().unique(), // Valor usado no código (technical, billing, etc)
    departmentId: integer("department_id"), // Relacionamento com departamento
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
// Schema for inserting users
export var insertUserSchema = createInsertSchema(users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Schema for inserting customers
export var insertCustomerSchema = createInsertSchema(customers).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Schema for inserting officials
export var insertOfficialSchema = createInsertSchema(officials).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Schema para inserir mapeamento de departamentos
export var insertOfficialDepartmentSchema = createInsertSchema(officialDepartments).omit({
    id: true,
    createdAt: true,
});
// Schema for inserting tickets
export var insertTicketSchema = z.object({
    title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
    description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
    customerEmail: z.string().email("Endereço de email inválido"),
    type: z.string().min(1, "O tipo de chamado é obrigatório"),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    departmentId: z.number().optional(),
    incidentTypeId: z.number().optional(), // Novo campo para relacionamento com a tabela de tipos de incidentes
});
// Schema for inserting ticket replies
export var insertTicketReplySchema = z.object({
    ticketId: z.number(),
    message: z.string().min(1, "A mensagem é obrigatória"),
    status: z.enum(['new', 'ongoing', 'resolved']),
    type: z.string().optional(),
    isInternal: z.boolean().default(false),
    assignedToId: z.number().optional(), // Campo opcional para atribuir o chamado a um atendente
});
