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

// Middleware para verificar se o usuário está autenticado
function authRequired(req: Request, res: Response, next: Function) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

// Middleware para verificar se o usuário é admin
function adminRequired(req: Request, res: Response, next: Function) {
  if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();
  
  // Rotas públicas (sem autenticação) - Login, Logout, Registro
  // Estas rotas não precisam de middleware de autenticação

  // Rota para registro de novos usuários
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { username, email, password, name, role } = req.body;
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      // Criar usuário - por padrão, novos usuários terão o papel de 'customer' a menos que especificado diferente
      const userRole = role || 'customer';
      
      // Criptografar senha antes de salvar
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: userRole,
        avatarUrl: null
      });
      
      // Autenticar o usuário recém-registrado
      if (req.session) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
      }
      
      // Não retornar a senha
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      res.status(500).json({ message: "Falha ao registrar usuário", error: String(error) });
    }
  });

  // Tickets endpoints - Todas as rotas abaixo dessa linha precisam de autenticação
  router.get("/tickets", authRequired, async (req: Request, res: Response) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar tickets" });
    }
  });
  
  // Stats and dashboard endpoints
  // Busca tickets com base no papel do usuário
  router.get("/tickets/user-role", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const tickets = await storage.getTicketsByUserRole(userId, userRole);
      res.json(tickets);
    } catch (error) {
      console.error('Erro ao buscar tickets por papel do usuário:', error);
      res.status(500).json({ message: "Falha ao buscar tickets para o usuário" });
    }
  });
  
  router.get("/tickets/stats", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Obter estatísticas de tickets filtradas pelo papel do usuário
      const stats = await storage.getTicketStatsByUserRole(userId, userRole);
      res.json(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas de tickets:', error);
      res.status(500).json({ message: "Falha ao buscar estatísticas de tickets" });
    }
  });

  router.get("/tickets/recent", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Obter tickets recentes filtrados pelo papel do usuário
      const tickets = await storage.getRecentTicketsByUserRole(userId, userRole, limit);
      res.json(tickets);
    } catch (error) {
      console.error('Erro ao buscar tickets recentes:', error);
      res.status(500).json({ message: "Falha ao buscar tickets recentes" });
    }
  });

  // Individual ticket by ID
  router.get("/tickets/:id", authRequired, async (req: Request, res: Response) => {
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
  router.post("/tickets", authRequired, validateRequest(insertTicketSchema), async (req: Request, res: Response) => {
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
  
  router.post("/ticket-replies", authRequired, validateRequest(insertTicketReplySchema), async (req: Request, res: Response) => {
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
  router.get("/customers", authRequired, async (req: Request, res: Response) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar clientes" });
    }
  });
  
  router.post("/customers", authRequired, async (req: Request, res: Response) => {
    try {
      const { email, name } = req.body;
      
      // Verificar se já existe cliente ou usuário com este email
      const existingCustomer = await storage.getCustomerByEmail(email);
      if (existingCustomer) {
        return res.status(400).json({ message: "Email já cadastrado para outro cliente" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já cadastrado para outro usuário" });
      }
      
      // Criar nome de usuário a partir do email (parte antes do @)
      const username = email.split('@')[0];
      
      // Gerar senha temporária (6 caracteres alfanuméricos)
      const tempPassword = Math.random().toString(36).substring(2, 8);
      
      // Criptografar senha
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = await hashPassword(tempPassword);
      
      // Criar usuário primeiro
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: 'customer'
      });
      
      // Criar cliente associado ao usuário
      const customer = await storage.createCustomer({
        ...req.body,
        userId: user.id
      });
      
      // Retornar o cliente com informações de acesso
      res.status(201).json({
        ...customer,
        accessInfo: {
          username,
          temporaryPassword: tempPassword,
          message: "Uma senha temporária foi gerada. Por favor, informe ao cliente para alterá-la no primeiro acesso."
        }
      });
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ message: "Falha ao criar cliente", error: String(error) });
    }
  });
  
  router.patch("/customers/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }

      const { password, ...customerData } = req.body;

      // Se uma senha foi fornecida, criptografá-la antes de salvar
      if (password) {
        // Verificar se o cliente tem um usuário associado
        const customer = await storage.getCustomer(id);
        if (!customer) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        
        if (customer.userId) {
          // Criptografar a nova senha
          const { hashPassword } = await import('./utils/password');
          const hashedPassword = await hashPassword(password);
          
          // Atualizar a senha do usuário associado
          await storage.updateUser(customer.userId, { password: hashedPassword });
        }
      }

      const customer = await storage.updateCustomer(id, customerData);
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json(customer);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ message: "Falha ao atualizar cliente", error: String(error) });
    }
  });
  
  router.delete("/customers/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }

      // Buscar cliente para verificar se há um usuário associado
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Armazenar o userId para inativação posterior
      const userId = customer.userId;

      // Duas opções:
      // 1. Se quisermos manter o cliente na base para referência histórica, podemos inativar
      //    apenas o usuário associado, impedindo o login
      // 2. Se quisermos remover completamente o cliente, fazemos como está comentado abaixo
      
      // Opção 1: Inativar apenas o usuário (manter cliente para referência histórica)
      if (userId) {
        const inactivatedUser = await storage.inactivateUser(userId);
        if (!inactivatedUser) {
          return res.status(404).json({ message: "Usuário do cliente não encontrado" });
        }
        res.json({ 
          success: true, 
          message: "Cliente inativado com sucesso",
          inactive: true
        });
      } else {
        // Se não há usuário associado, remover o cliente
        const success = await storage.deleteCustomer(id);
        if (!success) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        res.json({ success: true, message: "Cliente removido com sucesso" });
      }

      /* 
      // Opção 2: Excluir o cliente da base (remover completamente)
      // Excluir o cliente primeiro
      const success = await storage.deleteCustomer(id);
      if (!success) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      // Após excluir o cliente com sucesso, excluir o usuário associado, se houver
      if (userId) {
        await storage.deleteUser(userId);
      }

      res.json({ success: true });
      */
    } catch (error) {
      console.error('Erro ao excluir/inativar cliente:', error);
      res.status(500).json({ message: "Falha ao excluir/inativar cliente", error: String(error) });
    }
  });

  // Official endpoints
  router.get("/officials", authRequired, async (req: Request, res: Response) => {
    try {
      const officials = await storage.getOfficials();
      
      // Buscar os departamentos para cada atendente
      // Aqui estamos evitando a duplicação de departamentos, verificando se o atendente já tem os departamentos
      const officialsWithDepartments = await Promise.all(officials.map(async (official) => {
        // Se o atendente já tem departamentos, reutilizamos
        if (official.departments && Array.isArray(official.departments) && official.departments.length > 0) {
          return official;
        }
        
        // Caso contrário, buscamos os departamentos
        const officialDepartments = await storage.getOfficialDepartments(official.id);
        const departments = officialDepartments.map(od => od.department);
        return {
          ...official,
          departments
        };
      }));
      
      res.json(officialsWithDepartments);
    } catch (error) {
      console.error('Erro ao buscar atendentes:', error);
      res.status(500).json({ message: "Falha ao buscar atendentes", error: String(error) });
    }
  });
  
  router.post("/officials", authRequired, async (req: Request, res: Response) => {
    try {
      const { departments, ...officialData } = req.body;
      
      // Criar atendente primeiro
      const official = await storage.createOfficial(officialData);
      
      // Se foram enviados departamentos, adicionar os departamentos do atendente
      if (departments && Array.isArray(departments) && departments.length > 0) {
        // Adicionar departamentos
        for (const department of departments) {
          await storage.addOfficialDepartment({
            officialId: official.id,
            department
          });
        }
        
        // Anexar departamentos ao resultado
        official.departments = departments;
      }
      
      res.status(201).json(official);
    } catch (error) {
      console.error('Erro ao criar atendente:', error);
      res.status(500).json({ message: "Falha ao criar atendente", error: String(error) });
    }
  });
  
  router.patch("/officials/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      const { departments, password, ...officialData } = req.body;
      
      // Se uma senha foi fornecida, criptografá-la antes de salvar
      if (password) {
        // Verificar se o atendente tem um usuário associado
        const official = await storage.getOfficial(id);
        if (!official) {
          return res.status(404).json({ message: "Atendente não encontrado" });
        }
        
        if (official.userId) {
          // Criptografar a nova senha
          const { hashPassword } = await import('./utils/password');
          const hashedPassword = await hashPassword(password);
          
          // Atualizar a senha do usuário associado
          await storage.updateUser(official.userId, { password: hashedPassword });
        }
      }
      
      // Atualizar dados básicos do atendente
      const official = await storage.updateOfficial(id, officialData);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }
      
      // Se foram enviados departamentos, atualizar os departamentos do atendente
      if (departments && Array.isArray(departments)) {
        // Remover departamentos existentes
        const existingDepartments = await storage.getOfficialDepartments(id);
        for (const dept of existingDepartments) {
          await storage.removeOfficialDepartment(id, dept.department);
        }
        
        // Adicionar novos departamentos
        for (const department of departments) {
          await storage.addOfficialDepartment({
            officialId: id,
            department
          });
        }
        
        // Anexar departamentos atualizados ao resultado
        official.departments = departments;
      }

      res.json(official);
    } catch (error) {
      console.error('Erro ao atualizar atendente:', error);
      res.status(500).json({ message: "Falha ao atualizar atendente", error: String(error) });
    }
  });
  
  // Rota para alternar status (ativar/inativar) de um atendente
  router.patch("/officials/:id/toggle-active", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      // Buscar atendente para verificar o status atual e o userId
      const official = await storage.getOfficial(id);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }
      
      const userId = official.userId;
      const currentActiveStatus = official.isActive;
      
      let updatedOfficial;
      if (currentActiveStatus) {
        // Se está ativo, inativar
        updatedOfficial = await storage.inactivateOfficial(id);
        
        // Também inativar o usuário associado, se existir
        if (userId) {
          await storage.inactivateUser(userId);
        }
        
        res.json({ 
          success: true, 
          message: "Atendente inativado com sucesso",
          isActive: false
        });
      } else {
        // Se está inativo, ativar
        updatedOfficial = await storage.activateOfficial(id);
        
        // Também ativar o usuário associado, se existir
        if (userId) {
          await storage.activateUser(userId);
        }
        
        res.json({ 
          success: true, 
          message: "Atendente ativado com sucesso",
          isActive: true 
        });
      }
    } catch (error) {
      console.error('Erro ao alternar status do atendente:', error);
      res.status(500).json({ message: "Falha ao alternar status do atendente", error: String(error) });
    }
  });
  
  router.delete("/officials/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      // Buscar atendente para verificar se há um usuário associado
      const official = await storage.getOfficial(id);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }
      
      // Armazenar o userId para inativação posterior
      const userId = official.userId;

      // Duas opções:
      // 1. Se quisermos manter o atendente na base para referência histórica, podemos inativar
      //    apenas o usuário associado, impedindo o login
      // 2. Se quisermos remover completamente o atendente, fazemos como está comentado abaixo
      
      // Opção 1: Inativar apenas o usuário (manter atendente para referência histórica)
      if (userId) {
        const inactivatedUser = await storage.inactivateUser(userId);
        if (!inactivatedUser) {
          return res.status(404).json({ message: "Usuário do atendente não encontrado" });
        }
        
        // Também inativar o atendente na tabela de atendentes para consistência
        await storage.updateOfficial(id, { isActive: false });
        
        res.json({ 
          success: true, 
          message: "Atendente inativado com sucesso",
          inactive: true
        });
      } else {
        // Se não há usuário associado, remover o atendente
        const success = await storage.deleteOfficial(id);
        if (!success) {
          return res.status(404).json({ message: "Atendente não encontrado" });
        }
        res.json({ success: true, message: "Atendente removido com sucesso" });
      }

      /* 
      // Opção 2: Excluir o atendente da base (remover completamente)
      // Excluir o atendente primeiro
      const success = await storage.deleteOfficial(id);
      if (!success) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }

      // Após excluir o atendente com sucesso, excluir o usuário associado, se houver
      if (userId) {
        await storage.deleteUser(userId);
      }

      res.json({ success: true });
      */
    } catch (error) {
      console.error('Erro ao excluir/inativar atendente:', error);
      res.status(500).json({ message: "Falha ao excluir/inativar atendente", error: String(error) });
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
      
      // Verificar se o usuário está ativo
      if (user.active === false) {
        return res.status(401).json({ message: "Conta inativa. Contate o administrador do sistema." });
      }
      
      // Verificar senha usando bcrypt
      const { comparePasswords } = await import('./utils/password');
      const passwordMatch = await comparePasswords(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      // Não enviamos a senha para o cliente
      const { password: _, ...userWithoutPassword } = user;
      
      // Criar ou atualizar a sessão do usuário
      if (req.session) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
      }
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Erro de login:', error);
      res.status(500).json({ message: "Erro ao processar login" });
    }
  });

  router.post("/auth/logout", (req: Request, res: Response) => {
    // Destruir a sessão para fazer logout
    if (req.session) {
      req.session.destroy(() => {
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });
  
  // Endpoint para criar usuários
  router.post("/users", adminRequired, async (req: Request, res: Response) => {
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
      
      // Criptografar senha antes de salvar
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = await hashPassword(password);
      
      // Criar usuário
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role,
        avatarUrl,
        active: true // Garantir que novos usuários são criados como ativos por padrão
      });
      
      // Não retornar a senha
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ message: "Falha ao criar usuário", error: String(error) });
    }
  });
  
  // Endpoint para atualizar informações do usuário
  router.patch("/users/:id", adminRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      const { name, email, username, password } = req.body;
      
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Se estamos alterando o nome de usuário, verificar se já existe
      if (username && username !== existingUser.username) {
        const userWithUsername = await storage.getUserByUsername(username);
        if (userWithUsername && userWithUsername.id !== id) {
          return res.status(400).json({ message: "Nome de usuário já está em uso" });
        }
      }
      
      // Se estamos alterando o email, verificar se já existe
      if (email && email !== existingUser.email) {
        const userWithEmail = await storage.getUserByEmail(email);
        if (userWithEmail && userWithEmail.id !== id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }
      
      // Se uma senha foi fornecida, criptografá-la
      let hashedPassword;
      if (password) {
        const { hashPassword } = await import('./utils/password');
        hashedPassword = await hashPassword(password);
      }
      
      // Preparar dados de atualização
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (username) updateData.username = username;
      if (hashedPassword) updateData.password = hashedPassword;
      updateData.updatedAt = new Date();
      
      // Atualizar usuário
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(500).json({ message: "Falha ao atualizar usuário" });
      }
      
      // Não retornar a senha
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ message: "Falha ao atualizar usuário", error: String(error) });
    }
  });

  // Endpoint para gerenciar status de ativação de usuários
  router.patch("/users/:id/toggle-active", adminRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      // Buscar usuário atual para verificar seu status atual
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Impedir inativação da própria conta do administrador logado
      if (user.id === req.session?.userId && user.active !== false) {
        return res.status(403).json({ 
          message: "Não é possível inativar sua própria conta de administrador",
          type: "self-deactivation"
        });
      }
      
      // Alternar o status active do usuário
      let updatedUser;
      if (user.active === false) {
        updatedUser = await storage.activateUser(id);
      } else {
        updatedUser = await storage.inactivateUser(id);
      }
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Falha ao atualizar status do usuário" });
      }
      
      // Não retornar a senha
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json({
        user: userWithoutPassword,
        message: updatedUser.active ? "Usuário ativado com sucesso" : "Usuário inativado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao alternar status do usuário:', error);
      res.status(500).json({ message: "Falha ao alternar status do usuário", error: String(error) });
    }
  });

  // Endpoint para listar todos os usuários (apenas para administradores)
  router.get("/users", adminRequired, async (req: Request, res: Response) => {
    try {
      // Verificar se queremos incluir usuários inativos
      const includeInactive = req.query.includeInactive === 'true';
      
      // Buscar usuários
      const users = includeInactive ? 
        await storage.getAllUsers() : 
        await storage.getActiveUsers();
      
      // Não retornar as senhas
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ message: "Falha ao listar usuários", error: String(error) });
    }
  });
  
  // Endpoint para obter o usuário atual (quando autenticado)
  router.get("/auth/me", authRequired, async (req: Request, res: Response) => {
    try {
      // Verificamos a sessão/autenticação
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      // Buscar o usuário pelo ID da sessão
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        // Se o usuário não existir mais, limpamos a sessão
        if (req.session) {
          req.session.destroy(() => {});
        }
        return res.status(401).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário está ativo
      if (user.active === false) {
        // Se o usuário estiver inativo, invalidamos a sessão
        if (req.session) {
          req.session.destroy(() => {});
        }
        return res.status(401).json({ message: "Conta inativa. Contate o administrador do sistema." });
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
  router.get("/settings/general", adminRequired, async (req: Request, res: Response) => {
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
  
  router.post("/settings/general", adminRequired, async (req: Request, res: Response) => {
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
  router.get("/settings/departments", adminRequired, async (req: Request, res: Response) => {
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
  
  router.post("/settings/departments", adminRequired, async (req: Request, res: Response) => {
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
  router.get("/settings/incident-types", adminRequired, async (req: Request, res: Response) => {
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
  
  router.post("/settings/incident-types", adminRequired, async (req: Request, res: Response) => {
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
  router.get("/settings/sla", adminRequired, async (_req: Request, res: Response) => {
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
  
  router.post("/settings/sla", adminRequired, async (req: Request, res: Response) => {
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
