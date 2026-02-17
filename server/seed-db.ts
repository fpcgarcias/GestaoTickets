import { db } from "./db";
import {
  users, tickets, customers, officials, ticketReplies, ticketStatusHistory, slaDefinitions,
  officialDepartments
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
    avatar_url: null,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();

  const [supportUser] = await db.insert(users).values({
    username: "suporte",
    password: "suporte123",
    email: "suporte@ticketlead.com",
    name: "Equipe de Suporte",
    role: "support",
    avatar_url: null,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();

  const [customerUser] = await db.insert(users).values({
    username: "solicitante",
    password: "solicitante123",
    email: "solicitante@example.com",
    name: "Usuário solicitante",
    role: "customer",
    avatar_url: null,
  }).returning();
  
  // Adicionar solicitante
  console.log("Adicionando solicitantes...");
  const [customer] = await db.insert(customers).values({
    name: "Empresa ABC",
    email: "contato@empresaabc.com",
    phone: "(11) 9999-8888",
    company: "Empresa ABC Ltda",
    user_id: customerUser.id,
    avatar_url: null,
  }).returning();
  
  // Adicionar atendente
  console.log("Adicionando atendentes...");
  const [official] = await db.insert(officials).values({
    name: "João Silva",
    email: "joao.silva@ticketlead.com",
    user_id: supportUser.id,
    is_active: true,
    avatar_url: null,
  }).returning();

  // Adicionar o departamento ao atendente na tabela de junção
  await db.insert(officialDepartments).values({
    official_id: official.id,
    department_id: 1
  });
  
  // Adicionar definições de SLA
  console.log("Adicionando definições de SLA...");
  const [_slaLow] = await db.insert(slaDefinitions).values({
    priority: "low",
    response_time_hours: 24,
    resolution_time_hours: 72,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  const [_slaMedium] = await db.insert(slaDefinitions).values({
    priority: "medium",
    response_time_hours: 12,
    resolution_time_hours: 48,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  const [_slaHigh] = await db.insert(slaDefinitions).values({
    priority: "high",
    response_time_hours: 6,
    resolution_time_hours: 24,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  const [_slaCritical] = await db.insert(slaDefinitions).values({
    priority: "critical",
    response_time_hours: 2,
    resolution_time_hours: 12,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  // Adicionar tickets
  console.log("Adicionando tickets...");
  const [ticket1] = await db.insert(tickets).values({
    ticket_id: "TK-2023-001",
    title: "Problema de login no sistema",
    description: "Não consigo acessar o sistema com minha senha atual.",
    status: "ongoing",
    priority: "medium",
    type: "técnico",
    customer_id: customer.id,
    customer_email: customer.email,
    assigned_to_id: official.id,
    first_response_at: null,
    resolved_at: null,
    sla_breached: null,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  const [_ticket2] = await db.insert(tickets).values({
    ticket_id: "TK-2023-002",
    title: "Solicitar atualização de funcionalidade",
    description: "Precisamos adicionar um novo botão na tela inicial.",
    status: "new",
    priority: "high",
    type: "solicitação",
    customer_id: customer.id,
    customer_email: customer.email,
    assigned_to_id: null,
    first_response_at: null,
    resolved_at: null,
    sla_breached: null,
    created_at: new Date(),
    updated_at: new Date()
  }).returning();
  
  const [ticket3] = await db.insert(tickets).values({
    ticket_id: "TK-2023-003",
    title: "Dúvida sobre faturamento",
    description: "Precisamos de informações sobre o último ciclo de faturamento.",
    status: "resolved",
    priority: "low",
    type: "financeiro",
    customer_id: customer.id,
    customer_email: customer.email,
    assigned_to_id: official.id,
    first_response_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    resolved_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 dia atrás
    sla_breached: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dias atrás
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  }).returning();
  
  // Adicionar histórico de status
  console.log("Adicionando histórico de status dos tickets...");
  await db.insert(ticketStatusHistory).values({
    ticket_id: ticket1.id,
    old_status: "new",
    new_status: "ongoing",
    changed_by_id: adminUser.id,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  await db.insert(ticketStatusHistory).values({
    ticket_id: ticket3.id,
    old_status: "new",
    new_status: "ongoing",
    changed_by_id: adminUser.id,
    created_at: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000) // 2.5 dias atrás
  });
  
  await db.insert(ticketStatusHistory).values({
    ticket_id: ticket3.id,
    old_status: "ongoing",
    new_status: "resolved",
    changed_by_id: official.id,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  // Adicionar respostas de tickets
  console.log("Adicionando respostas aos tickets...");
  await db.insert(ticketReplies).values({
    ticket_id: ticket1.id,
    user_id: official.id,
    message: "Olá, por favor tente redefinir sua senha através do link 'Esqueci minha senha'. Se o problema persistir, nos avise.",
    is_internal: false,
    created_at: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000) // 12 horas atrás
  });
  
  await db.insert(ticketReplies).values({
    ticket_id: ticket3.id,
    user_id: official.id,
    message: "Enviamos por email as informações solicitadas sobre o faturamento. Por favor, confirme o recebimento.",
    is_internal: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 dias atrás
  });
  
  await db.insert(ticketReplies).values({
    ticket_id: ticket3.id,
    user_id: customerUser.id,
    message: "Confirmando recebimento. Muito obrigado pela ajuda!",
    is_internal: false,
    created_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000) // 1.5 dias atrás
  });
  
  await db.insert(ticketReplies).values({
    ticket_id: ticket3.id,
    user_id: official.id,
    message: "De nada! Vou fechar este ticket como resolvido. Se precisar de mais ajuda, basta abrir um novo chamado.",
    is_internal: false,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
  });
  
  console.log("Preenchimento do banco de dados concluído com sucesso!");
}

// Executar o seed
seedDatabase().catch(console.error);
