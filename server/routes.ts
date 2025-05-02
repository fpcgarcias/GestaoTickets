import express, { Response } from "express";
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema, slaDefinitions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "./db";
import { notificationService } from "./services/notification-service";
import * as crypto from 'crypto';

// Função auxiliar para salvar e carregar configurações
async function saveSystemSetting(key: string, value: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key));
    
  if (existing) {
    await db
      .update(schema.systemSettings)
      .set({ 
        value: value,
        updatedAt: new Date()
      })
      .where(eq(schema.systemSettings.id, existing.id));
  } else {
    await db
      .insert(schema.systemSettings)
      .values({
        key: key,
        value: value,
        createdAt: new Date(),
        updatedAt: new Date()
      });
  }
}

async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  const [setting] = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key));
    
  return setting ? setting.value : defaultValue;
}

function validateRequest(schema: z.ZodType<any, any>) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      next(error);
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();

  // Tickets endpoints 
  router.get("/tickets", async (req: Request, res: Response) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar tickets" });
    }
  });
  
  // Stats and dashboard endpoints
  // Busca tickets com base no papel do usuário
  router.get("/tickets/user-role", async (req: Request, res: Response) => {
    try {
      // Verificar autenticação
      // Em uma aplicação real, verificaríamos a autenticação da sessão
      // Como ainda não temos sessão completa, vamos simular com o usuário "admin"
      const user = await storage.getUserByUsername("admin");
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const userId = user.id;
      const userRole = user.role;
      
      const tickets = await storage.getTicketsByUserRole(userId, userRole);
      res.json(tickets);
    } catch (error) {
      console.error('Erro ao buscar tickets por papel do usuário:', error);
      res.status(500).json({ message: "Falha ao buscar tickets para o usuário" });
    }
  });
  
  router.get("/tickets/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getTicketStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar estatísticas de tickets" });
    }
  });

  router.get("/tickets/recent", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const tickets = await storage.getRecentTickets(limit);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar tickets recentes" });
    }
  });

  // Individual ticket by ID
  router.get("/tickets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar ticket" });
    }
  });
  
  // Ticket creation and responses
  router.post("/tickets", validateRequest(insertTicketSchema), async (req: Request, res: Response) => {
    try {
      const ticket = await storage.createTicket(req.body);
      
      // Enviar notificação após salvar o ticket
      await notificationService.notifyNewTicket(ticket.id);
      
      res.status(201).json(ticket);
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      res.status(500).json({ message: "Falha ao criar ticket", error: String(error) });
    }
  });
  
  router.post("/ticket-replies", validateRequest(insertTicketReplySchema), async (req: Request, res: Response) => {
    try {
      const ticketId = req.body.ticketId;
      const userId = req.body.userId;
      
      // Verificar se o ticket existe
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }
      
      const reply = await storage.createTicketReply(req.body);
      
      // Enviar notificação após salvar a resposta
      if (userId) {
        await notificationService.notifyNewReply(ticketId, userId);
      }
      
      // Se a resposta incluir atualização de status, notificar sobre isso também
      if (req.body.status && ticket.status !== req.body.status) {
        await notificationService.notifyTicketStatusUpdate(ticketId, ticket.status, req.body.status);
      }
      
      res.status(201).json(reply);
    } catch (error) {
      console.error('Erro ao criar resposta de ticket:', error);
      res.status(500).json({ message: "Falha ao criar resposta de ticket", error: String(error) });
    }
  });
  
  // Customer endpoints
  router.get("/customers", async (req: Request, res: Response) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar clientes" });
    }
  });
  
  router.post("/customers", async (req: Request, res: Response) => {
    try {
      const customer = await storage.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ message: "Falha ao criar cliente", error: String(error) });
    }
  });
  
  router.patch("/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }

      const customer = await storage.updateCustomer(id, req.body);
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json(customer);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ message: "Falha ao atualizar cliente", error: String(error) });
    }
  });
  
  router.delete("/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }

      const success = await storage.deleteCustomer(id);
      if (!success) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      res.status(500).json({ message: "Falha ao excluir cliente", error: String(error) });
    }
  });

  // Official endpoints
  router.get("/officials", async (req: Request, res: Response) => {
    try {
      const officials = await storage.getOfficials();
      res.json(officials);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar atendentes" });
    }
  });
  
  router.post("/officials", async (req: Request, res: Response) => {
    try {
      const official = await storage.createOfficial(req.body);
      res.status(201).json(official);
    } catch (error) {
      console.error('Erro ao criar atendente:', error);
      res.status(500).json({ message: "Falha ao criar atendente", error: String(error) });
    }
  });
  
  router.patch("/officials/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      const official = await storage.updateOfficial(id, req.body);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }

      res.json(official);
    } catch (error) {
      console.error('Erro ao atualizar atendente:', error);
      res.status(500).json({ message: "Falha ao atualizar atendente", error: String(error) });
    }
  });
  
  router.delete("/officials/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      const success = await storage.deleteOfficial(id);
      if (!success) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir atendente:', error);
      res.status(500).json({ message: "Falha ao excluir atendente", error: String(error) });
    }
  });

  // Autenticação
  router.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      // Validação simples de senha - em produção usar bcrypt ou similar
      if (user.password !== password) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      // Não enviamos a senha para o cliente
      const { password: _, ...userWithoutPassword } = user;
      
      // Em uma aplicação real, configuraríamos sessão ou JWT aqui
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Erro de login:', error);
      res.status(500).json({ message: "Erro ao processar login" });
    }
  });

  router.post("/auth/logout", (req: Request, res: Response) => {
    // Em uma aplicação real, encerraríamos a sessão aqui
    res.json({ success: true });
  });
  
  // Endpoint para criar usuários
  router.post("/users", async (req: Request, res: Response) => {
    try {
      const { username, email, password, name, role, avatarUrl } = req.body;
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      // Criar usuário
      const user = await storage.createUser({
        username,
        email,
        password,
        name,
        role,
        avatarUrl
      });
      
      // Não retornar a senha
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ message: "Falha ao criar usuário", error: String(error) });
    }
  });

  // Endpoint para obter o usuário atual (quando autenticado)
  router.get("/auth/me", async (req: Request, res: Response) => {
    try {
      // Em uma aplicação real com sessões, obteríamos o usuário a partir da sessão
      // Por enquanto, retornamos o admin para manter compatibilidade
      const user = await storage.getUserByUsername("admin");
      
      if (!user) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      // Não enviamos a senha para o cliente
      const { password: _, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      res.status(500).json({ message: "Erro ao obter dados do usuário" });
    }
  });
  
  // Rotas para configurações do sistema
  // Configurações gerais
  router.get("/settings/general", async (req: Request, res: Response) => {
    try {
      // Buscar configurações do sistema
      const companyName = await getSystemSetting('companyName', 'Ticket Lead');
      const supportEmail = await getSystemSetting('supportEmail', 'suporte@ticketlead.exemplo');
      const allowCustomerRegistration = await getSystemSetting('allowCustomerRegistration', 'true');
      
      // Montar objeto de resposta
      res.json({
        companyName,
        supportEmail,
        allowCustomerRegistration: allowCustomerRegistration === 'true'
      });
    } catch (error) {
      console.error('Erro ao obter configurações gerais:', error);
      res.status(500).json({ message: "Falha ao buscar configurações gerais", error: String(error) });
    }
  });
  
  router.post("/settings/general", async (req: Request, res: Response) => {
    try {
      const { companyName, supportEmail, allowCustomerRegistration } = req.body;
      
      // Salvar configurações
      await saveSystemSetting('companyName', companyName);
      await saveSystemSetting('supportEmail', supportEmail);
      await saveSystemSetting('allowCustomerRegistration', allowCustomerRegistration.toString());
      
      res.json({
        companyName,
        supportEmail,
        allowCustomerRegistration
      });
    } catch (error) {
      console.error('Erro ao salvar configurações gerais:', error);
      res.status(500).json({ message: "Falha ao salvar configurações gerais", error: String(error) });
    }
  });
  
  // Configurações de departamentos
  router.get("/settings/departments", async (req: Request, res: Response) => {
    try {
      // Buscar configurações de departamentos
      const departmentsJson = await getSystemSetting('departments', '[]');
      
      try {
        const departments = JSON.parse(departmentsJson);
        return res.json(departments);
      } catch (parseError) {
        console.error('Erro ao fazer parse dos departamentos:', parseError);
        const defaultDepartments = [
          { id: 1, name: "Suporte Técnico", description: "Para problemas técnicos e de produto" },
          { id: 2, name: "Faturamento", description: "Para consultas de pagamento e faturamento" },
          { id: 3, name: "Atendimento ao Cliente", description: "Para consultas gerais e assistência" }
        ];
        return res.json(defaultDepartments);
      }
    } catch (error) {
      console.error('Erro ao obter departamentos:', error);
      res.status(500).json({ message: "Falha ao buscar departamentos", error: String(error) });
    }
  });
  
  router.post("/settings/departments", async (req: Request, res: Response) => {
    try {
      const departments = req.body;
      
      if (!Array.isArray(departments)) {
        return res.status(400).json({ message: "Formato inválido. Envie um array de departamentos." });
      }
      
      // Converter para string JSON e salvar
      const departmentsJson = JSON.stringify(departments);
      await saveSystemSetting('departments', departmentsJson);
      
      res.json(departments);
    } catch (error) {
      console.error('Erro ao salvar departamentos:', error);
      res.status(500).json({ message: "Falha ao salvar departamentos", error: String(error) });
    }
  });
  
  // Configurações de tipos de incidentes
  router.get("/settings/incident-types", async (req: Request, res: Response) => {
    try {
      // Buscar configurações de tipos de incidentes
      const typesJson = await getSystemSetting('incidentTypes', '[]');
      
      try {
        const types = JSON.parse(typesJson);
        return res.json(types);
      } catch (parseError) {
        console.error('Erro ao fazer parse dos tipos de incidentes:', parseError);
        const defaultTypes = [
          { id: 1, name: "Problema Técnico", departmentId: 1 },
          { id: 2, name: "Dúvida de Faturamento", departmentId: 2 },
          { id: 3, name: "Pedido de Informação", departmentId: 3 },
          { id: 4, name: "Reclamação", departmentId: 3 }
        ];
        return res.json(defaultTypes);
      }
    } catch (error) {
      console.error('Erro ao obter tipos de incidentes:', error);
      res.status(500).json({ message: "Falha ao buscar tipos de incidentes", error: String(error) });
    }
  });
  
  router.post("/settings/incident-types", async (req: Request, res: Response) => {
    try {
      const incidentTypes = req.body;
      
      if (!Array.isArray(incidentTypes)) {
        return res.status(400).json({ message: "Formato inválido. Envie um array de tipos de incidentes." });
      }
      
      // Converter para string JSON e salvar
      const typesJson = JSON.stringify(incidentTypes);
      await saveSystemSetting('incidentTypes', typesJson);
      
      res.json(incidentTypes);
    } catch (error) {
      console.error('Erro ao salvar tipos de incidentes:', error);
      res.status(500).json({ message: "Falha ao salvar tipos de incidentes", error: String(error) });
    }
  });
  
  // Endpoints para configurações de SLA
  router.get("/settings/sla", async (_req: Request, res: Response) => {
    try {
      // Buscar configurações de SLA do banco de dados
      const slaSettings = await db.select().from(schema.slaDefinitions);
      
      // Se não existirem configurações, retornar valores padrão
      if (!slaSettings || slaSettings.length === 0) {
        const defaultSlaSettings = [
          { id: 1, priority: 'low', responseTimeHours: 72, resolutionTimeHours: 120 },
          { id: 2, priority: 'medium', responseTimeHours: 48, resolutionTimeHours: 72 },
          { id: 3, priority: 'high', responseTimeHours: 24, resolutionTimeHours: 48 },
          { id: 4, priority: 'critical', responseTimeHours: 4, resolutionTimeHours: 24 },
        ];
        return res.json(defaultSlaSettings);
      }
      
      res.json(slaSettings);
    } catch (error) {
      console.error('Erro ao obter configurações de SLA:', error);
      res.status(500).json({ message: "Falha ao buscar configurações de SLA", error: String(error) });
    }
  });
  
  router.post("/settings/sla", async (req: Request, res: Response) => {
    try {
      const slaData = req.body;
      const { priority, responseTimeHours, resolutionTimeHours } = slaData;
      
      if (!priority || !['low', 'medium', 'high', 'critical'].includes(priority)) {
        return res.status(400).json({ message: "Prioridade inválida" });
      }
      
      // Verificar se já existe uma configuração para esta prioridade
      const [existingSla] = await db
        .select()
        .from(schema.slaDefinitions)
        .where(eq(schema.slaDefinitions.priority, priority));
      
      if (existingSla) {
        // Atualizar configuração existente
        await db
          .update(schema.slaDefinitions)
          .set({ 
            responseTimeHours: responseTimeHours || existingSla.responseTimeHours,
            resolutionTimeHours: resolutionTimeHours || existingSla.resolutionTimeHours,
            updatedAt: new Date()
          })
          .where(eq(schema.slaDefinitions.id, existingSla.id));
          
        // Buscar a configuração atualizada
        const [updatedSla] = await db
          .select()
          .from(schema.slaDefinitions)
          .where(eq(schema.slaDefinitions.id, existingSla.id));
          
        res.json(updatedSla);
      } else {
        // Criar nova configuração de SLA
        const [newSla] = await db
          .insert(schema.slaDefinitions)
          .values({
            priority,
            responseTimeHours: responseTimeHours || 0,
            resolutionTimeHours: resolutionTimeHours || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        res.status(201).json(newSla);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de SLA:', error);
      res.status(500).json({ message: "Falha ao salvar configurações de SLA", error: String(error) });
    }
  });
  
  // Montar o router em /api
  app.use("/api", router);

  // Criar o servidor HTTP
  const httpServer = createServer(app);
  
  // Configurar o servidor WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Lidar com conexões WebSocket
  wss.on('connection', (ws) => {
    console.log('Nova conexão WebSocket recebida');
    
    // Autenticar o usuário e configurar a conexão
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Processar mensagem de autenticação
        if (data.type === 'auth') {
          const userId = data.userId;
          const userRole = data.userRole;
          
          if (userId && userRole) {
            // Adicionar o cliente ao serviço de notificações
            notificationService.addClient(ws, userId, userRole);
          }
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    });
    
    // Lidar com fechamento da conexão
    ws.on('close', () => {
      notificationService.removeClient(ws);
      console.log('Conexão WebSocket fechada');
    });
  });
  
  return httpServer;
}
