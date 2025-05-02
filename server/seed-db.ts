import { db } from "./db";
import {
  users, tickets, customers, officials, ticketReplies, ticketStatusHistory, slaDefinitions,
  userRoleEnum, ticketStatusEnum, ticketPriorityEnum, departmentEnum
} from "@shared/schema";

async function seedDatabase() {
  console.log("Iniciando preenchimento do banco de dados...");

  // Verificar se já existem registros para evitar duplicação
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("O banco de dados já possui registros. Pulando o processo de seed.");
    return;
  }
  
  // Adicionar usuários
  console.log("Adicionando usuários...");
  const [adminUser] = await db.insert(users).values({
    username: "admin",
    password: "admin123",
    email: "admin@ticketlead.com",
    name: "Administrador",
    role: "admin",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  const [supportUser] = await db.insert(users).values({
    username: "suporte",
    password: "suporte123",
    email: "suporte@ticketlead.com",
    name: "Equipe de Suporte",
    role: "support",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  const [customerUser] = await db.insert(users).values({
    username: "cliente",
    password: "cliente123",
    email: "cliente@example.com",
    name: "Usuário Cliente",
    role: "customer",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  // Adicionar cliente
  console.log("Adicionando clientes...");
  const [customer] = await db.insert(customers).values({
    name: "Empresa ABC",
    email: "contato@empresaabc.com",
    phone: "(11) 9999-8888",
    company: "Empresa ABC Ltda",
    userId: customerUser.id,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  // Adicionar atendente
  console.log("Adicionando atendentes...");
  const [official] = await db.insert(officials).values({
    name: "João Silva",
    email: "joao.silva@ticketlead.com",
    department: "technical",
    userId: supportUser.id,
    isActive: true,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  // Adicionar definições de SLA
  console.log("Adicionando definições de SLA...");
  const [slaLow] = await db.insert(slaDefinitions).values({
    priority: "low",
    responseTimeHours: 24,
    resolutionTimeHours: 72,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  const [slaMedium] = await db.insert(slaDefinitions).values({
    priority: "medium",
    responseTimeHours: 12,
    resolutionTimeHours: 48,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  const [slaHigh] = await db.insert(slaDefinitions).values({
    priority: "high",
    responseTimeHours: 6,
    resolutionTimeHours: 24,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  const [slaCritical] = await db.insert(slaDefinitions).values({
    priority: "critical",
    responseTimeHours: 2,
    resolutionTimeHours: 12,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  // Adicionar tickets
  console.log("Adicionando tickets...");
  const [ticket1] = await db.insert(tickets).values({
    ticketId: "TK-2023-001",
    title: "Problema de login no sistema",
    description: "Não consigo acessar o sistema com minha senha atual.",
    status: "ongoing",
    priority: "medium",
    type: "técnico",
    customerId: customer.id,
    customerEmail: customer.email,
    assignedToId: official.id,
    firstResponseAt: null,
    resolvedAt: null,
    slaBreached: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  const [ticket2] = await db.insert(tickets).values({
    ticketId: "TK-2023-002",
    title: "Solicitar atualização de funcionalidade",
    description: "Precisamos adicionar um novo botão na tela inicial.",
    status: "new",
    priority: "high",
    type: "solicitação",
    customerId: customer.id,
    customerEmail: customer.email,
    assignedToId: null,
    firstResponseAt: null,
    resolvedAt: null,
    slaBreached: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  const [ticket3] = await db.insert(tickets).values({
    ticketId: "TK-2023-003",
    title: "Dúvida sobre faturamento",
    description: "Precisamos de informações sobre o último ciclo de faturamento.",
    status: "resolved",
    priority: "low",
    type: "financeiro",
    customerId: customer.id,
    customerEmail: customer.email,
    assignedToId: official.id,
    firstResponseAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    slaBreached: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dias atrás
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  }).returning();
  
  // Adicionar histórico de status
  console.log("Adicionando histórico de status dos tickets...");
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket1.id,
    oldStatus: "new",
    newStatus: "ongoing",
    changedById: adminUser.id,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket3.id,
    oldStatus: "new",
    newStatus: "ongoing",
    changedById: adminUser.id,
    createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000) // 2.5 dias atrás
  });
  
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket3.id,
    oldStatus: "ongoing",
    newStatus: "resolved",
    changedById: official.id,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  // Adicionar respostas de tickets
  console.log("Adicionando respostas aos tickets...");
  await db.insert(ticketReplies).values({
    ticketId: ticket1.id,
    userId: official.id,
    message: "Olá, por favor tente redefinir sua senha através do link 'Esqueci minha senha'. Se o problema persistir, nos avise.",
    isInternal: false,
    createdAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000) // 12 horas atrás
  });
  
  await db.insert(ticketReplies).values({
    ticketId: ticket3.id,
    userId: official.id,
    message: "Enviamos por email as informações solicitadas sobre o faturamento. Por favor, confirme o recebimento.",
    isInternal: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 dias atrás
  });
  
  await db.insert(ticketReplies).values({
    ticketId: ticket3.id,
    userId: customerUser.id,
    message: "Confirmando recebimento. Muito obrigado pela ajuda!",
    isInternal: false,
    createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000) // 1.5 dias atrás
  });
  
  await db.insert(ticketReplies).values({
    ticketId: ticket3.id,
    userId: official.id,
    message: "De nada! Vou fechar este ticket como resolvido. Se precisar de mais ajuda, basta abrir um novo chamado.",
    isInternal: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  console.log("Preenchimento do banco de dados concluído com sucesso!");
}

// Executar o seed
seedDatabase().catch(console.error);
