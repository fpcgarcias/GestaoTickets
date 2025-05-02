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

  // Tickets endpoints - general list
  router.get("/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  // Stats and dashboard endpoints - these must come BEFORE the :id route
  router.get("/tickets/stats", async (_req, res) => {
    try {
      const stats = await storage.getTicketStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket stats" });
    }
  });

  router.get("/tickets/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const tickets = await storage.getRecentTickets(limit);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  // Individual ticket by ID - must come AFTER specific routes
  router.get("/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }

      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  router.post("/tickets", validateRequest(insertTicketSchema), async (req, res) => {
    try {
      const ticket = await storage.createTicket(req.body);
      res.status(201).json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  router.post("/ticket-replies", validateRequest(insertTicketReplySchema), async (req, res) => {
    try {
      const ticketId = req.body.ticketId;
      
      // Check if ticket exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const reply = await storage.createTicketReply(req.body);
      res.status(201).json(reply);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket reply" });
    }
  });

  // Customer endpoints
  router.get("/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar clientes" });
    }
  });
  
  router.post("/customers", async (req, res) => {
    try {
      const customer = await storage.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ message: "Falha ao criar cliente", error: String(error) });
    }
  });
  
  router.patch("/customers/:id", async (req, res) => {
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
  
  router.delete("/customers/:id", async (req, res) => {
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
  router.get("/officials", async (req, res) => {
    try {
      const officials = await storage.getOfficials();
      res.json(officials);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar atendentes" });
    }
  });
  
  router.post("/officials", async (req, res) => {
    try {
      const official = await storage.createOfficial(req.body);
      res.status(201).json(official);
    } catch (error) {
      console.error('Erro ao criar atendente:', error);
      res.status(500).json({ message: "Falha ao criar atendente", error: String(error) });
    }
  });
  
  router.patch("/officials/:id", async (req, res) => {
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
  
  router.delete("/officials/:id", async (req, res) => {
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

  // Implementação real de autenticação
  router.post("/auth/login", async (req, res) => {
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

  router.post("/auth/logout", (req, res) => {
    // Em uma aplicação real, encerraríamos a sessão aqui
    res.json({ success: true });
  });
  
  // Endpoint para criar usuários
  router.post("/users", async (req, res) => {
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
        avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date()
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
  router.get("/auth/me", async (req, res) => {
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
  router.get("/settings/sla", async (req, res) => {
    try {
      // Buscar todas as definições de SLA
      const slaDefinitions = await db.select().from(schema.slaDefinitions);
      res.json(slaDefinitions);
    } catch (error) {
      console.error('Erro ao obter configurações de SLA:', error);
      res.status(500).json({ message: "Falha ao buscar configurações de SLA", error: String(error) });
    }
  });
  
  router.post("/settings/sla", async (req, res) => {
    try {
      const { priority, responseTimeHours, resolutionTimeHours } = req.body;
      
      // Verificar se já existe uma definição para esta prioridade
      const [existingSLA] = await db
        .select()
        .from(schema.slaDefinitions)
        .where(eq(schema.slaDefinitions.priority, priority));
      
      if (existingSLA) {
        // Atualizar definição existente
        const [updated] = await db
          .update(schema.slaDefinitions)
          .set({
            responseTimeHours,
            resolutionTimeHours,
            updatedAt: new Date()
          })
          .where(eq(schema.slaDefinitions.id, existingSLA.id))
          .returning();
        
        return res.json(updated);
      } else {
        // Criar nova definição
        const [created] = await db
          .insert(schema.slaDefinitions)
          .values({
            priority,
            responseTimeHours,
            resolutionTimeHours,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return res.status(201).json(created);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de SLA:', error);
      res.status(500).json({ message: "Falha ao salvar configurações de SLA", error: String(error) });
    }
  });
  
  // Configurações gerais do sistema
  router.get("/settings/general", async (req, res) => {
    try {
      // Em uma implementação real, buscaríamos do banco de dados
      // Por enquanto, retornamos valores padrão
      res.json({
        companyName: "Ticket Lead",
        supportEmail: "suporte@ticketlead.exemplo",
        allowCustomerRegistration: true
      });
    } catch (error) {
      console.error('Erro ao obter configurações gerais:', error);
      res.status(500).json({ message: "Falha ao buscar configurações gerais", error: String(error) });
    }
  });
  
  router.post("/settings/general", async (req, res) => {
    try {
      // Em uma implementação real, salvaríamos no banco de dados
      // Por enquanto, apenas retornamos o que foi enviado
      res.json(req.body);
    } catch (error) {
      console.error('Erro ao salvar configurações gerais:', error);
      res.status(500).json({ message: "Falha ao salvar configurações gerais", error: String(error) });
    }
  });

  // Mount the router at /api
  app.use("/api", router);

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
  
  // Atualizar as rotas para usar as notificações
  
  // Substituir a implementação do POST /tickets para incluir notificações
  router.post("/tickets", validateRequest(insertTicketSchema), async (req, res) => {
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
  
  // Substituir a implementação do POST /ticket-replies para incluir notificações
  router.post("/ticket-replies", validateRequest(insertTicketReplySchema), async (req, res) => {
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
  
  return httpServer;
}
