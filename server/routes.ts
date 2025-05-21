import express, { Response } from "express";
import type { Express, Request, NextFunction as NextFnExpress } from "express";
import { createServer, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema, slaDefinitions, departments as departmentsSchema } from "@shared/schema";
import { eq, desc, isNull, sql, and, ne, or, inArray, type SQLWrapper } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "./db";
import { notificationService } from "./services/notification-service";
import * as crypto from 'crypto';

// Schemas Zod para validação de Departamentos (definidos aqui temporariamente)
const insertDepartmentSchemaInternal = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional().nullable(),
  company_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});
const updateDepartmentSchemaInternal = insertDepartmentSchemaInternal.partial();

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
        updated_at: new Date()
      })
      .where(eq(schema.systemSettings.id, existing.id));
  } else {
    await db
      .insert(schema.systemSettings)
      .values({
        key: key,
        value: value,
        created_at: new Date(),
        updated_at: new Date()
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

function validateRequest(schemaToValidate: z.ZodType<any, any>) {
  return (req: Request, res: Response, next: NextFnExpress) => {
    try {
      req.body = schemaToValidate.parse(req.body);
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
function authRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

// Middleware para verificar se o usuário é admin
function adminRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ message: "Acesso negado: Requer perfil de Administrador" });
  }
  next();
}

// Middleware para verificar se o usuário é company_admin ou admin geral
function companyAdminRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string; // Cast para string para a comparação
  if (userRole !== 'admin' && userRole !== 'company_admin') {
    return res.status(403).json({ message: "Acesso negado: Requer perfil de Administrador da Empresa ou Administrador Geral" });
  }
  next();
}

// Middleware para verificar se o usuário é manager
function managerRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// Middleware para verificar se o usuário é supervisor ou superior
function supervisorRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// Middleware para verificar se o usuário é triage ou superior
function triageRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager', 'supervisor', 'support', 'triage'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// Middleware para verificar se o usuário pode visualizar tickets (todas as roles exceto integration_bot)
function viewerRequired(req: Request, res: Response, next: NextFnExpress) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (userRole === 'integration_bot') {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// Middleware para verificar se o usuário tem acesso a um departamento específico
async function departmentAccess(req: Request, res: Response, next: NextFnExpress) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const userRole = req.session.userRole as string;
    const userId = req.session.userId;

    if (!userRole) {
        return res.status(403).json({ message: "Acesso negado - Papel do usuário não definido" });
    }

    if (['admin', 'company_admin'].includes(userRole)) {
      return next();
    }

    if (['manager', 'supervisor', 'support', 'triage'].includes(userRole)) {
      const departmentId = parseInt(req.params.departmentId || req.body.department_id);
      
      if (!departmentId) {
        return res.status(400).json({ message: "ID do departamento não especificado" });
      }
      
      const [official] = await db
        .select()
        .from(schema.officials)
        .where(eq(schema.officials.user_id, userId))
        .limit(1);
        
      if (!official) {
        return res.status(403).json({ message: "Acesso negado - Usuário não é um atendente" });
      }
      
      const officialDepartments = await db
        .select()
        .from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
        
      const hasDepartmentAccess = officialDepartments.some(
        dept => dept.department === departmentId.toString()
      );
      
      if (!hasDepartmentAccess) {
        return res.status(403).json({ message: "Acesso negado - Sem permissão para este departamento" });
      }
      
      return next();
    }
    
    return res.status(403).json({ message: "Acesso negado" });
  } catch (error) {
    console.error("Erro ao verificar acesso ao departamento:", error);
    return res.status(500).json({ message: "Erro ao verificar permissões" });
  }
}

function fixEmailDomain(email: string, source: string): { email: string, wasFixed: boolean } {
  if (!email || !email.includes('@') || !process.env.AD_EMAIL_DOMAIN) {
    return { email, wasFixed: false };
  }
  
  const parts = email.split('@');
  const userPart = parts[0];
  const domainPart = parts[1];
  
  if (domainPart && 
      ((
        process.env.AD_DOMAIN && domainPart.toLowerCase() === process.env.AD_DOMAIN.toLowerCase()
      ) ||
      domainPart.toLowerCase().includes('local') ||
      domainPart.toLowerCase().includes('internal') ||
      domainPart.toLowerCase().includes('ad') ||
      domainPart.toLowerCase().includes('corp'))
    ) {
    const fixedEmail = `${userPart}@${process.env.AD_EMAIL_DOMAIN}`;
    return { email: fixedEmail, wasFixed: true };
  }
  
  return { email, wasFixed: false };
}

export async function registerRoutes(app: Express): Promise<void> {
  const router = express.Router();
  
  // Nova rota para diagnóstico de extração de email do AD (admin)
  router.get("/auth/test-ad-email", async (req: Request, res: Response) => {
    try {
      const username = req.query.username as string;
      
      if (!username) {
        return res.status(400).json({ 
          message: "Nome de usuário é obrigatório", 
          usage: "?username=nome.usuario" 
        });
      }
      
      console.log(`[AD Email Test] Testando extração de email para usuário: ${username}`);
      
      const { authenticateAD } = await import('./utils/active-directory');
      
      if (!process.env.AD_URL || !process.env.AD_BASE_DN || !process.env.AD_USERNAME || !process.env.AD_PASSWORD) {
        return res.status(500).json({
          success: false,
          message: "Configuração do AD incompleta. Verifique as variáveis de ambiente."
        });
      }
      
      const AD = await import('activedirectory2').then(mod => mod.default);
      const adConfig = {
        url: process.env.AD_URL,
        baseDN: process.env.AD_BASE_DN,
        username: process.env.AD_USERNAME,
        password: process.env.AD_PASSWORD,
        attributes: {
          user: ['sAMAccountName', 'mail', 'displayName', 'userPrincipalName', 'proxyAddresses']
        }
      };
      const ad = new AD(adConfig);
      // Lógica simplificada da rota test-ad-email para manter o foco
      const formattedUsername = username.includes('@') ? username.split('@')[0] : username;
      ad.findUser(formattedUsername, (err: any, userEntry: any) => {
        if (err) {
          console.error("[AD Email Test] Erro ao buscar usuário no AD:", err);
          return res.status(500).json({ success: false, message: "Erro ao buscar usuário no AD", error: err });
        }
        if (!userEntry) {
          return res.status(404).json({ success: false, message: "Usuário não encontrado no AD" });
        }
        res.json({ success: true, user: userEntry }); 
      });

    } catch (error) {
      console.error("[AD Email Test] Erro inesperado:", error);
      res.status(500).json({ success: false, message: "Erro inesperado no teste de email do AD" });
    }
  });
  
  // Rotas públicas (sem autenticação) - Login, Logout, Registro
  // Estas rotas não precisam de middleware de autenticação

  // Rota para registro de novos usuários
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, role, cnpj } = req.body;
      
      // Usar o email como nome de usuário
      const username = email;
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      // Buscar empresa pelo CNPJ
      let companyId = null;
      if (cnpj) {
        const [company] = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.cnpj, cnpj))
          .limit(1);
        
        if (company) {
          // Verificar se a empresa está ativa
          if (!company.active) {
            return res.status(403).json({ message: "Empresa inativa. Contate o administrador." });
          }
          companyId = company.id;
        } else {
          return res.status(404).json({ message: "Empresa não encontrada com este CNPJ. Entre em contato com o administrador." });
        }
      }
      
      // Criar usuário - por padrão, novos usuários terão o papel de 'customer' a menos que especificado diferente
      const userRole = role || 'customer';
      
      // Criptografar senha antes de salvar
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = await hashPassword(password);
      
      // Criar o usuário com o companyId
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: userRole as typeof schema.userRoleEnum.enumValues[number],
        avatar_url: null,
        company_id: companyId
      });
      
      // Criar um registro de cliente vinculado ao usuário
      if (userRole === 'customer' && companyId) {
        await storage.createCustomer({
          name,
          email,
          user_id: user.id,
          company_id: companyId
        });
      }
      
      // Autenticar o usuário recém-registrado
      if (req.session) {
        req.session.userId = user.id;
        // Garantir que o user.role é um dos tipos permitidos para req.session.userRole
        if (user.role === 'admin' || user.role === 'support' || user.role === 'customer') {
            req.session.userRole = user.role;
        } else {
             console.warn(`Papel de usuário '${user.role}' não diretamente mapeado para req.session.userRole durante registro. Sessão pode não refletir o papel completo.`);
             // req.session.userRole permanecerá undefined ou o valor anterior
        }
        if (companyId) {
          req.session.companyId = companyId;
        }
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
      const conditions: (SQLWrapper | undefined)[] = [];

      const role = req.session.userRole as string; // Cast para string para uso em comparações
      const userId = req.session.userId;
      const companyId = req.session.companyId;

      if (!userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      if (role === 'admin') {
        // Admin vê todos os tickets
      } else if (role === 'company_admin') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
        } else {
           return res.json([]); // company_admin sem companyId não deve ver tickets
        }
      } else if (role === 'manager') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
        } else {
            return res.json([]); // manager sem companyId não deve ver tickets
        }
      } else if (role === 'supervisor') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
          const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId)).limit(1);
          if (official) {
            const departments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, official.id));
            if (departments.length > 0) {
              const departmentIds = departments.map(d => parseInt(d.department));
              conditions.push(inArray(schema.tickets.department_id, departmentIds));
            } else {
                 return res.json([]); // Supervisor sem departamentos associados não vê tickets
            }
          } else {
             return res.json([]); // Usuário supervisor não é um atendente
          }
        } else {
            return res.json([]); // supervisor sem companyId não deve ver tickets
        }
      } else if (role === 'support') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
          const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId)).limit(1);
          if (official) {
            const departments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, official.id));
            if (departments.length > 0) {
              const departmentIds = departments.map(d => parseInt(d.department));
              conditions.push(
                or(
                  eq(schema.tickets.assigned_to_id, official.id),
                  and(
                    isNull(schema.tickets.assigned_to_id),
                    inArray(schema.tickets.department_id, departmentIds)
                  )
                )
              );
            } else {
              conditions.push(eq(schema.tickets.assigned_to_id, official.id));
            }
          } else {
            return res.json([]); // Usuário support não é um atendente
          }
        } else {
            return res.json([]); // support sem companyId não deve ver tickets
        }
      } else if (role === 'triage') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
          conditions.push(isNull(schema.tickets.assigned_to_id));
        } else {
            return res.json([]); // triage sem companyId não deve ver tickets
        }
      } else if (role === 'customer') {
        const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId)).limit(1);
        if (customer) {
          conditions.push(eq(schema.tickets.customer_id, customer.id));
        } else {
          const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
          if (user && user.email) {
            conditions.push(eq(schema.tickets.customer_email, user.email));
          } else {
             return res.json([]); // Customer sem registro ou email
          }
        }
      } else if (role === 'viewer' || role === 'quality') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
        }
         // Se for admin (que também é viewer/quality implicitamente e já tratado) ou se não tiver companyId, pode ver todos os globais (se aplicável)
         // Se for viewer/quality SEM companyId e NÃO for admin, não deve ver tickets.
         // A verificação de 'admin' já é feita acima, então se chegou aqui e é viewer/quality, não é admin.
         else if (!companyId) { 
            return res.json([]);
         }
      } else {
        return res.status(403).json({ message: "Acesso negado - Papel sem permissão para visualizar tickets" });
      }

      let ticketsQuery = db
        .select({
          id: schema.tickets.id,
          ticket_id: schema.tickets.ticket_id,
          title: schema.tickets.title,
          status: schema.tickets.status,
          priority: schema.tickets.priority,
          customer_email: schema.tickets.customer_email,
          created_at: schema.tickets.created_at,
          updated_at: schema.tickets.updated_at,
          resolved_at: schema.tickets.resolved_at,
          sla_breached: schema.tickets.sla_breached,
          assigned_to_id: schema.tickets.assigned_to_id,
          customer_id: schema.tickets.customer_id,
          company_id: schema.tickets.company_id,
          department_id: schema.tickets.department_id
        })
        .from(schema.tickets);

      // Filtrar as condições válidas
      const finalConditions = conditions.filter(c => c !== undefined) as SQLWrapper[];
      if (finalConditions.length > 0) {
        ticketsQuery = ticketsQuery.where(and(...finalConditions)) as typeof ticketsQuery;
      }

      const tickets = await ticketsQuery.orderBy(desc(schema.tickets.created_at));
      return res.json(tickets);
    } catch (error) {
      console.error('Erro ao obter tickets:', error);
      res.status(500).json({ message: "Falha ao buscar tickets", error: String(error) });
    }
  });
  
  // Stats and dashboard endpoints
  // Busca tickets com base no papel do usuário
  router.get("/tickets/user-role", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole as string;
      
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
      const userRole = req.session.userRole as string;
      
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
      const userRole = req.session.userRole as string;
      
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
  
  // Rota para atualizar parcialmente um ticket (ex: atribuir atendente)
  router.patch("/tickets/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // Verificar se o ticket está resolvido
      const existingTicket = await storage.getTicket(id);
      if (!existingTicket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Pegar apenas os campos permitidos para patch (ex: assignedToId)
      const { assigned_to_id } = req.body;
      const updateData: { assigned_to_id?: number | null } = {};

      // Se o ticket estiver resolvido e estamos tentando mudar o atendente, rejeitar
      if (existingTicket.status === 'resolved' && assigned_to_id !== undefined && assigned_to_id !== existingTicket.assigned_to_id) {
        return res.status(403).json({ 
          message: "Operação não permitida", 
          details: "Não é possível alterar o atendente de um ticket resolvido." 
        });
      }

      // Validar assignedToId se fornecido
      if (assigned_to_id !== undefined) {
        if (assigned_to_id === null || typeof assigned_to_id === 'number') {
          updateData.assigned_to_id = assigned_to_id;
        } else {
          return res.status(400).json({ message: "assigned_to_id inválido" });
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "Nenhum dado válido para atualizar" });
      }

      const ticket = await storage.updateTicket(id, updateData);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }
      
      // Notificar sobre a atualização de atribuição
      notificationService.sendNotificationToAll({
        type: 'ticket_updated',
        ticketId: ticket.id,
        title: `Atribuição Atualizada: ${ticket.title}`,
        message: `O ticket ${ticket.ticket_id} foi atribuído/desatribuído.`,
        timestamp: new Date()
      });

      res.json(ticket);
    } catch (error) {
      console.error('Erro ao atualizar ticket (patch):', error);
      res.status(500).json({ message: "Falha ao atualizar ticket", error: String(error) });
    }
  });
  
  // Ticket creation and responses
  router.post("/tickets", authRequired, validateRequest(insertTicketSchema), async (req: Request, res: Response) => {
    try {
      // Validar os dados recebidos
      const ticketData = insertTicketSchema.parse(req.body);
      
      // Gerar um ID legível (YYYY-TIPO##)
      const currentYear = new Date().getFullYear();
      
      // Determinar o prefixo com base no tipo de ticket
      let typePrefix = "GE"; // Prefixo genérico (General)
      
      if (ticketData.type) {
        // Se tiver um tipo, usar as duas primeiras letras do tipo
        typePrefix = ticketData.type.substring(0, 2).toUpperCase();
      }
      
      // Buscar o último ID para incrementar
      const [lastTicket] = await db
        .select({ id: schema.tickets.id })
        .from(schema.tickets)
        .orderBy(desc(schema.tickets.id))
        .limit(1);
      
      const nextId = lastTicket ? lastTicket.id + 1 : 1;
      const ticketIdString = `${currentYear}-${typePrefix}${nextId.toString().padStart(3, '0')}`;
      
      // Criar o novo ticket
      const [newTicket] = await db
        .insert(schema.tickets)
        .values({
          ...ticketData,
          ticket_id: ticketIdString,
          status: 'new',
        })
        .returning();

      // Responder com o ticket criado
      res.status(201).json(newTicket);
      
      // Enviar notificação de novo ticket
      notificationService.sendNotificationToAll({
        type: 'new_ticket',
        title: 'Novo Ticket Criado',
        message: `Novo ticket ${ticketIdString}: ${ticketData.title}`,
        ticketId: newTicket.id,
        ticketCode: ticketIdString,
        priority: ticketData.priority,
        timestamp: new Date()
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      
      console.error(error);
      res.status(500).json({ message: "Erro ao criar ticket" });
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
      
      // Se for uma atualização de status ou atribuição, notificar
      if (req.body.status !== ticket.status || req.body.assigned_to_id !== ticket.assigned_to_id) {
        notificationService.sendNotificationToAll({
          type: 'ticket_updated',
          ticketId: ticket.id,
          title: `Ticket Atualizado: ${ticket.title}`,
          message: `O status ou atribuição do ticket ${ticket.ticket_id} foi atualizado.`,
          timestamp: new Date()
        });
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
      // Verificar se deve incluir clientes inativos
      const includeInactive = req.query.includeInactive === 'true';
      
      // Buscar todos os clientes
      const customers = await storage.getCustomers();
      
      // Carregar as informações de cada cliente
      const enrichedCustomers = await Promise.all(
        customers.map(async (customer) => {
          // Informações da empresa
          let company = null;
          if (customer.company_id) {
            company = await storage.getCompany(customer.company_id);
          }
          
          // Informações do usuário associado
          let active = true;
          if (customer.user_id) {
            const user = await storage.getUser(customer.user_id);
            active = user ? user.active : true;
          }
          
          return {
            ...customer,
            company: company?.name || customer.company || '-',
            active
          };
        })
      );
      
      // Filtrar os clientes inativos se necessário
      const filteredCustomers = includeInactive 
        ? enrichedCustomers 
        : enrichedCustomers.filter(customer => customer.active);
      
      res.json(filteredCustomers);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
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
      
      // Usar o e-mail completo como nome de usuário
      const username = email;
      
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
        role: 'customer' as typeof schema.userRoleEnum.enumValues[number],
      });
      
      // Criar cliente associado ao usuário
      const customer = await storage.createCustomer({
        ...req.body,
        user_id: user.id
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
        
        if (customer.user_id) {
          // Criptografar a nova senha
          const { hashPassword } = await import('./utils/password');
          const hashedPassword = await hashPassword(password);
          
          // Atualizar a senha do usuário associado
          await storage.updateUser(customer.user_id, { password: hashedPassword });
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
      
      // Armazenar o user_id para inativação/ativação posterior
      const userId = customer.user_id;

      if (userId) {
        // Buscar o usuário para verificar seu status atual
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "Usuário do cliente não encontrado" });
        }
        
        // Se o usuário estiver ativo, inativamos; se estiver inativo, ativamos
        if (user.active) {
          // Inativar o usuário
          const inactivatedUser = await storage.inactivateUser(userId);
          if (!inactivatedUser) {
            return res.status(404).json({ message: "Usuário do cliente não encontrado" });
          }
          res.json({ 
            success: true, 
            message: "Cliente inativado com sucesso",
            inactive: true,
            active: false
          });
        } else {
          // Ativar o usuário
          const activatedUser = await storage.activateUser(userId);
          if (!activatedUser) {
            return res.status(404).json({ message: "Usuário do cliente não encontrado" });
          }
          res.json({ 
            success: true, 
            message: "Cliente ativado com sucesso",
            inactive: false,
            active: true
          });
        }
      } else {
        // Se não há usuário associado, remover o cliente
        const success = await storage.deleteCustomer(id);
        if (!success) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        res.json({ success: true, message: "Cliente removido com sucesso" });
      }
    } catch (error) {
      console.error('Erro ao ativar/inativar cliente:', error);
      res.status(500).json({ message: "Falha ao ativar/inativar cliente", error: String(error) });
    }
  });

  // Official endpoints
  router.get("/officials", authRequired, async (req: Request, res: Response) => {
    try {
      console.log('======== REQUISIÇÃO PARA /api/officials ========');
      console.log('Sessão do usuário:', req.session);
      console.log('User ID na sessão:', req.session?.userId);
      console.log('User Role na sessão:', req.session?.userRole);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      
      console.log('Buscando lista de atendentes...');
      const officials = await storage.getOfficials();
      console.log(`Encontrados ${officials.length} atendentes no storage`);
      
      // Buscar os departamentos para cada atendente
      // Aqui estamos evitando a duplicação de departamentos, verificando se o atendente já tem os departamentos
      console.log('Adicionando informações de departamentos...');
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
      
      console.log(`Retornando ${officialsWithDepartments.length} atendentes com seus departamentos`);
      // LOG DETALHADO DA RESPOSTA
      console.log('[DEBUG /api/officials] Dados enviados:', JSON.stringify(officialsWithDepartments, null, 2)); 
      console.log('========= FIM DA REQUISIÇÃO /api/officials =========');
      res.json(officialsWithDepartments);
    } catch (error) {
      console.error('Erro ao buscar atendentes:', error);
      res.status(500).json({ message: "Falha ao buscar atendentes", error: String(error) });
    }
  });
  
  router.post("/officials", authRequired, async (req: Request, res: Response) => {
    try {
      console.log(`Iniciando criação de atendente com dados:`, JSON.stringify(req.body, null, 2));
      const { departments, ...officialData } = req.body;
      
      // Verificar se há departamentos selecionados
      if (!departments || !Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({ 
          message: "Pelo menos um departamento deve ser selecionado para o atendente" 
        });
      }
      
      // Verificar se o usuário existe
      if (officialData.userId) {
        const user = await storage.getUser(officialData.userId);
        if (!user) {
          console.log(`ERRO: Usuário com ID ${officialData.userId} não encontrado`);
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        console.log(`Usuário encontrado: ${user.name} (${user.email})`);
      }
      
      // Para compatibilidade com a tabela física, usar o primeiro departamento como principal
      let departmentValue = departments[0];
      if (typeof departmentValue === 'object' && departmentValue !== null && 'department' in departmentValue) {
        departmentValue = departmentValue.department;
      }
      
      // Criar atendente primeiro
      const dataWithDepartment = {
        ...officialData,
        department: departmentValue // Adicionar campo department para compatibilidade
      };
      
      console.log(`Criando atendente com dados:`, JSON.stringify(dataWithDepartment, null, 2));
      const official = await storage.createOfficial(dataWithDepartment);
      console.log(`Atendente criado com sucesso: ID=${official.id}`);
      
      // Se foram enviados departamentos, adicionar os departamentos do atendente
      if (departments && Array.isArray(departments) && departments.length > 0) {
        console.log(`Adicionando ${departments.length} departamentos ao atendente`);
        // Adicionar departamentos
        for (const department of departments) {
          console.log(`Adicionando departamento ${department} ao atendente ${official.id}`);
          await storage.addOfficialDepartment({
            official_id: official.id, // Corrigido para official_id
            department
          });
        }
        
        // Anexar departamentos ao resultado
        official.departments = departments;
      }
      
      console.log(`Retornando atendente criado: ID=${official.id}`);
      res.status(201).json(official);
    } catch (error) {
      console.error('Erro ao criar atendente:', error);
      
      // Se o erro ocorreu depois da criação do usuário, verificamos se temos um userId
      // para dar uma resposta mais útil
      if (req.body.userId) {
        console.log(`ERRO: Falha ao criar atendente para usuário ${req.body.userId}. `+
                   `Considere excluir o usuário para evitar inconsistências.`);
      }
      
      res.status(500).json({ 
        message: "Falha ao criar atendente", 
        error: String(error),
        userId: req.body.userId || null, // Retornar o ID do usuário para possível limpeza
        suggestion: "O usuário pode ter sido criado mas o atendente não. Considere excluir o usuário e tentar novamente."
      });
    }
  });
  
  router.patch("/officials/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      const { departments, password, department, user, ...officialData } = req.body;
      
      // Verificar se temos pelo menos um departamento
      if (!departments || !Array.isArray(departments) || departments.length === 0) {
        if (!department) { // Se nem department foi fornecido
          return res.status(400).json({ message: "Pelo menos um departamento deve ser selecionado" });
        }
      }
      
      // Preparar o objeto de atualização, incluindo department para compatibilidade
      let departmentValue = 'technical'; // Fallback para um departamento padrão
      
      // Se department foi fornecido diretamente, use-o
      if (department) {
        departmentValue = department;
      }
      // Caso contrário, use o primeiro departamento do array se disponível
      else if (Array.isArray(departments) && departments.length > 0) {
        if (typeof departments[0] === 'object' && departments[0] !== null && 'department' in departments[0]) {
          departmentValue = departments[0].department;
        } else {
          departmentValue = departments[0];
        }
      }
      
      const updateData = {
        ...officialData,
        department: departmentValue // Adicionar department para compatibilidade com a tabela física
      };
      
      // Buscar o atendente para obter o userId associado
      const official = await storage.getOfficial(id);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }
      
      // Se recebemos dados do usuário e o atendente tem um usuário associado, atualizá-lo
      if (user && official.user_id) { // Corrigido para user_id
        console.log(`Atualizando dados do usuário ${official.user_id} associado ao atendente ${id}:`, user); // Corrigido para user_id
        
        // Preparar os dados de atualização do usuário
        const userUpdateData: any = {};
        
        // Se o username for fornecido, atualizá-lo
        if (user.username) {
          userUpdateData.username = user.username;
        }
        
        // Se o email for fornecido, atualizá-lo
        if (user.email) {
          userUpdateData.email = user.email;
        }
        
        // Se o nome for fornecido, atualizá-lo
        if (user.name) {
          userUpdateData.name = user.name;
        }
        
        // Se a senha for fornecida no objeto user, usar ela
        if (user.password) {
          // Criptografar a nova senha
          const { hashPassword } = await import('./utils/password');
          userUpdateData.password = await hashPassword(user.password);
        }
        // Ou se foi fornecida diretamente no objeto principal
        else if (password) {
          // Criptografar a nova senha
          const { hashPassword } = await import('./utils/password');
          userUpdateData.password = await hashPassword(password);
        }
        
        // Se temos dados para atualizar, realizar a atualização
        if (Object.keys(userUpdateData).length > 0) {
          await storage.updateUser(official.user_id, userUpdateData); // Corrigido para user_id
        }
      }
      // Se apenas a senha foi fornecida diretamente, atualizar apenas ela
      else if (password && official.user_id) { // Corrigido para user_id
        // Criptografar a nova senha
        const { hashPassword } = await import('./utils/password');
        const hashedPassword = await hashPassword(password);
        
        // Atualizar a senha do usuário associado
        await storage.updateUser(official.user_id, { password: hashedPassword }); // Corrigido para user_id
      }
      
      // Atualizar dados básicos do atendente
      const updatedOfficial = await storage.updateOfficial(id, updateData);
      if (!updatedOfficial) {
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
            official_id: id, // Corrigido para official_id
            department
          });
        }
        
        // Anexar departamentos atualizados ao resultado
        updatedOfficial.departments = departments;
      }

      // Buscar o usuário atualizado para incluir na resposta
      if (updatedOfficial.user_id) { // Corrigido para user_id
        const userData = await storage.getUser(updatedOfficial.user_id); // Corrigido para user_id
        if (userData) {
          // Remover a senha do usuário antes de enviar
          // const { password: _, ...userWithoutPassword } = userData; // Linha original comentada
          // updatedOfficial.user = userWithoutPassword; // Linha problemática removida
        }
      }

      res.json(updatedOfficial);
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
      
      const userId = official.user_id; // Corrigido para user_id
      const currentActiveStatus = official.is_active; // Corrigido para is_active
      
      let updatedOfficial;
      if (currentActiveStatus) {
        // Se está ativo, inativar
        updatedOfficial = await storage.inactivateOfficial(id); // Removido ?
        
        // Também inativar o usuário associado, se existir
        if (userId) {
          await storage.inactivateUser(userId); // Removido ?
        }
        
        res.json({ 
          success: true, 
          message: "Atendente inativado com sucesso",
          isActive: false
        });
      } else {
        // Se está inativo, ativar
        updatedOfficial = await storage.activateOfficial(id); // Removido ?
        
        // Também ativar o usuário associado, se existir
        if (userId) {
          await storage.activateUser(userId); // Removido ?
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
      const userId = official.user_id; // Corrigido para user_id

      // Duas opções:
      // 1. Se quisermos manter o atendente na base para referência histórica, podemos inativar
      //    apenas o usuário associado, impedindo o login
      // 2. Se quisermos remover completamente o atendente, fazemos como está comentado abaixo
      
      // Opção 1: Inativar apenas o usuário (manter atendente para referência histórica)
      if (userId) {
        const inactivatedUser = await storage.inactivateUser(userId); // Removido ?
        if (!inactivatedUser) {
          return res.status(404).json({ message: "Usuário do atendente não encontrado" });
        }
        
        // Também inativar o atendente na tabela de atendentes para consistência
        await storage.updateOfficial(id, { is_active: false }); // Corrigido para is_active
        
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

      // Buscar o usuário pelo username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      // Verificar se o usuário está ativo
      if (user.active === false) {
        return res.status(401).json({ message: "Conta inativa. Contate o administrador." });
      }
      
      // Verificar a senha - voltar para o import dinâmico que funcionava antes
      const { verifyPassword } = await import('./utils/password');
      const passwordValid = await verifyPassword(password, user.password);
      
      if (!passwordValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      // Buscar a empresa do usuário, se não for admin
      let company = null;
      if (user.company_id) {
        const [companyData] = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.id, user.company_id))
          .limit(1);
          
        if (companyData) {
          // Verificar se a empresa está ativa
          if (!companyData.active) {
            return res.status(403).json({ message: "Empresa inativa. Contate o administrador." });
          }
          
          company = companyData;
        }
      }
      
      // Se for admin sem empresa definida, permitir acesso sem restrição de empresa
      if (user.role === 'admin' && !company) {
        // Salvar na sessão que este admin tem acesso global
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        // Retornar o usuário sem empresa
        return res.json(user);
      }
      
      // Para usuários não-admin, é obrigatório ter uma empresa
      if (!company && user.role !== 'admin') {
        return res.status(403).json({ 
          message: "Usuário não possui empresa associada. Contate o administrador." 
        });
      }
      
      // Salvar informações na sessão
      req.session.userId = user.id;
      // req.session.userRole = user.role as string; // Comentado para usar a lógica abaixo
      if (user.role === 'admin' || user.role === 'support' || user.role === 'customer') {
        req.session.userRole = user.role;
      } else {
        console.warn(`Papel de usuário '${user.role}' não diretamente mapeado para req.session.userRole durante login. Sessão pode não refletir o papel completo.`);
        // req.session.userRole permanecerá undefined ou o valor anterior
      }

      if (company) {
        req.session.companyId = company.id;
      }
      
      // Adicionar a informação da empresa ao objeto do usuário para retornar ao cliente
      if (company) {
        return res.json({
          ...user,
          company: {
            id: company.id,
            name: company.name,
            email: company.email,
            domain: company.domain || '',
            cnpj: company.cnpj || '',
            phone: company.phone || ''
          }
        });
      } else {
        return res.json(user);
      }
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: "Erro no login" });
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
  
  // Rota para testar a conexão com o Active Directory (apenas admin)
  router.get("/auth/test-ad", adminRequired, async (req: Request, res: Response) => {
    try {
      const { testADConnection } = await import('./utils/active-directory');
      const result = await testADConnection();
      res.json(result);
    } catch (error) {
      console.error('Erro ao testar conexão AD:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao testar conexão com AD',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para testar a conexão com o Active Directory (acesso público para depuração)
  router.get("/auth/test-ad-public", async (req: Request, res: Response) => {
    try {
      console.log('[AD Debug] Iniciando teste de conexão AD (rota pública)');
      const { testADConnection } = await import('./utils/active-directory');
      const result = await testADConnection();
      console.log('[AD Debug] Resultado do teste:', result);
      res.json(result);
    } catch (error) {
      console.error('[AD Debug] Erro ao testar conexão AD:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao testar conexão com AD',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para testar a autenticação de um usuário específico com o AD
  router.post("/auth/test-ad-user", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
      }
      
      console.log(`[AD Debug] Testando autenticação do usuário '${username}' com o AD`);
      const { authenticateAD } = await import('./utils/active-directory');
      
      // Tenta autenticar com AD
      const adUser = await authenticateAD(username, password);
      
      if (!adUser) {
        return res.status(401).json({ 
          success: false,
          message: "Credenciais inválidas no Active Directory" 
        });
      }
      
      // Autenticação bem-sucedida, retornar dados do usuário (sem informações sensíveis)
      res.json({
        success: true,
        message: "Autenticação bem-sucedida com o Active Directory",
        user: {
          username: adUser.username,
          name: adUser.name,
          email: adUser.email,
          attributes: Object.keys(adUser.adData || {})
        }
      });
    } catch (error) {
      console.error('[AD Debug] Erro ao testar autenticação de usuário:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao testar autenticação de usuário com AD',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint para criar usuários
  router.post("/users", adminRequired, async (req: Request, res: Response) => {
    try {
      const { username, email, password, name, role, avatarUrl } = req.body;
      
      console.log(`Tentando criar usuário: ${name}, email: ${email}, username: ${username}, role: ${role}`);
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`Erro: Nome de usuário '${username}' já existe`);
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        console.log(`Erro: Email '${email}' já está em uso`);
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      const { hashPassword } = await import('./utils/password');
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: role as typeof schema.userRoleEnum.enumValues[number],
        avatar_url: avatarUrl,
        active: true 
      });
      
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ message: "Falha ao criar usuário", error: String(error) });
    }
  });
  
  // Endpoint para criar usuário de suporte e atendente em uma única transação atômica
  router.post("/support-users", adminRequired, async (req: Request, res: Response) => {
    // Importar e chamar o endpoint de criação integrada
    const { hashPassword } = await import('./utils/password');
    const { createSupportUserEndpoint } = await import('./endpoints/create-support-user');
    await createSupportUserEndpoint(req, res, storage, hashPassword);
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
      
      // Se o usuário tem uma empresa associada, carregar os dados dela
      if (req.session.companyId) {
        const [companyData] = await db // Renomeado para companyData para evitar conflito de nome
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.id, req.session.companyId))
          .limit(1);
        
        if (companyData) {
          // Anexar a empresa ao usuário
          return res.json({
            ...user,
            company: { // Apenas campos existentes no schema.companies
              id: companyData.id,
              name: companyData.name,
              email: companyData.email,
              domain: companyData.domain || '',
              active: companyData.active,
              cnpj: companyData.cnpj || '',
              phone: companyData.phone || ''
            }
          });
        }
      }
      
      return res.json(user);
    } catch (error) {
      console.error('Erro ao obter perfil:', error);
      res.status(500).json({ message: "Erro ao obter perfil do usuário" });
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
      // Buscar tipos de incidentes da nova tabela
      const incidentTypes = await db
        .select()
        .from(schema.incidentTypes)
        .orderBy(schema.incidentTypes.id);
      
      return res.json(incidentTypes);
    } catch (error) {
      console.error('Erro ao obter tipos de incidentes:', error);
      res.status(500).json({ message: "Falha ao buscar tipos de incidentes", error: String(error) });
    }
  });
  
  // Rota para usuários não-admin obterem tipos de incidentes
  router.get("/incident-types", authRequired, async (req: Request, res: Response) => {
    try {
      // Verificar se o usuário tem uma empresa associada
      if (!req.session.companyId && (req.session.userRole as string) !== 'admin') {
        return res.status(400).json({ message: "Usuário sem empresa associada" });
      }
      
      let query = db
        .select()
        .from(schema.incidentTypes);
      
      // Se não for admin, filtrar pela empresa
      if ((req.session.userRole as string) !== 'admin' && req.session.companyId) {
        query = query.where(
          or( // Adicionado OR para incluir globais (company_id IS NULL)
             isNull(schema.incidentTypes.company_id),
             eq(schema.incidentTypes.company_id, req.session.companyId)
          )
        ) as typeof query;
      }
      
      const incidentTypes = await query.orderBy(schema.incidentTypes.id);
      
      return res.json(incidentTypes);
    } catch (error) {
      console.error('Erro ao obter tipos de incidentes para usuário:', error);
      res.status(500).json({ message: "Falha ao buscar tipos de incidentes", error: String(error) });
    }
  });
  
  // Rota para usuários não-admin obterem departamentos
  router.get("/departments", authRequired, async (req: Request, res: Response) => {
    try {
      // Buscar configurações de departamentos
      const departmentsJson = await getSystemSetting('departments', '[]');
      
      try {
        const allDepartments = JSON.parse(departmentsJson);
        
        // Se for admin, retornar todos os departamentos
        if ((req.session.userRole as string) === 'admin') {
          return res.json(allDepartments);
        }
        
        // Para outros usuários, filtrar departamentos pela empresa (se implementado)
        // Por enquanto, retornar todos os departamentos para qualquer usuário autenticado
        return res.json(allDepartments);
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
      console.error('Erro ao obter departamentos para usuário:', error);
      res.status(500).json({ message: "Falha ao buscar departamentos", error: String(error) });
    }
  });
  
  router.post("/settings/incident-types", adminRequired, async (req: Request, res: Response) => {
    try {
      const incidentTypesData = req.body; // Renomeado para evitar conflito com schema.incidentTypes
      
      if (!Array.isArray(incidentTypesData)) {
        return res.status(400).json({ message: "Formato inválido. Envie um array de tipos de incidentes." });
      }

      // Transação para atualizar tipos de incidentes
      await db.transaction(async (tx) => {
        // 1. Excluir todos os tipos existentes da tabela incidentTypes
        await tx.delete(schema.incidentTypes);
        
        // 2. Inserir os novos tipos
        if (incidentTypesData.length > 0) {
          const typesToInsert = incidentTypesData.map(type => ({
            id: type.id,
            name: type.name,
            // Gerar valor automaticamente, caso não exista, para manter a compatibilidade
            value: type.value || type.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            department_id: type.departmentId, // Usar department_id conforme schema
            company_id: type.company_id,    // Usar company_id conforme schema (se existir no frontend)
            created_at: new Date(),         // Usar created_at
            updated_at: new Date()          // Usar updated_at
          }));
          
          await tx.insert(schema.incidentTypes).values(typesToInsert);
        }
      });
      
      // A configuração legacy em system_settings para incidentTypes não é mais necessária aqui.
      // O frontend (incident-types-settings.tsx) deve interagir diretamente com a tabela incident_types.
      
      res.json(incidentTypesData);
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
            response_time_hours: responseTimeHours || existingSla.response_time_hours, 
            resolution_time_hours: resolutionTimeHours || existingSla.resolution_time_hours, 
            updated_at: new Date() // Corrigido para snake_case
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
            response_time_hours: responseTimeHours || 0, 
            resolution_time_hours: resolutionTimeHours || 0
            // createdAt e updatedAt são gerenciados pelo banco de dados via defaultNow()
          })
          .returning();
          
        res.status(201).json(newSla);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações de SLA:', error);
      res.status(500).json({ message: "Falha ao salvar configurações de SLA", error: String(error) });
    }
  });
  
  // --- ROTAS DE DEPARTAMENTOS ---
  router.post(
    "/api/departments",
    authRequired, 
    companyAdminRequired, 
    validateRequest(insertDepartmentSchemaInternal), // Usando o schema interno
    async (req: Request, res: Response) => {
      try {
        const { name, description, company_id, is_active } = req.body;
        
        let effectiveCompanyId = company_id;
        if ((req.session.userRole as string) !== 'admin') {
          if (!req.session.companyId) {
            return res.status(400).json({ message: "ID da empresa não encontrado na sessão para company_admin" });
          }
          effectiveCompanyId = req.session.companyId;
          if (company_id !== undefined && company_id !== null && company_id !== req.session.companyId) {
             return res.status(403).json({ message: "Company admin só pode criar departamentos para sua própria empresa." });
          }
        }
        
        const existingQueryConditions = [
          eq(departmentsSchema.name, name),
          effectiveCompanyId ? eq(departmentsSchema.company_id, effectiveCompanyId) : isNull(departmentsSchema.company_id)
        ];
        const [existingByName] = await db.select().from(departmentsSchema).where(and(...existingQueryConditions.filter(c => c !== undefined) as SQLWrapper[])); // Adicionado filter e cast
        
        if (existingByName) {
          return res.status(409).json({ message: `Já existe um departamento com este nome ${effectiveCompanyId ? 'nesta empresa' : 'globalmente'}.` });
        }

        const [newDepartment] = await db
          .insert(departmentsSchema)
          .values({
            name,
            description,
            company_id: (req.session.userRole as string) === 'admin' ? (effectiveCompanyId || null) : effectiveCompanyId, 
            is_active: is_active !== undefined ? is_active : true,
          })
          .returning();
        
        res.status(201).json(newDepartment);
      } catch (error) {
        console.error("Erro ao criar departamento:", error);
        res.status(500).json({ message: "Erro interno ao criar departamento" });
      }
    }
  );

  router.get("/api/departments", authRequired, async (req: Request, res: Response) => {
    try {
      const { active_only, company_id: queryCompanyId } = req.query;
      const conditions: (SQLWrapper | undefined)[] = []; // Tipado para SQLWrapper | undefined

      if (active_only === 'true') {
        conditions.push(eq(departmentsSchema.is_active, true));
      }

      const userRole = req.session.userRole as string;
      const userCompanyId = req.session.companyId;

      if (userRole === 'company_admin') {
        if (!userCompanyId) {
          return res.status(400).json({ message: "ID da empresa não encontrado na sessão para company_admin" });
        }
        conditions.push(eq(departmentsSchema.company_id, userCompanyId));
      } else if (userRole === 'admin' && queryCompanyId) {
        conditions.push(eq(departmentsSchema.company_id, Number(queryCompanyId)));
      } else if (userRole !== 'admin') {
         if (userCompanyId) {
            conditions.push(eq(departmentsSchema.company_id, userCompanyId));
         } else {
            return res.json([]); 
         }
      }
      
      const finalQueryConditions = conditions.filter(c => c !== undefined) as SQLWrapper[];
      const finalQuery = finalQueryConditions.length > 0 ? and(...finalQueryConditions) : undefined;
      let queryBuilder = db.select().from(departmentsSchema);
      if (finalQuery) {
        queryBuilder = queryBuilder.where(finalQuery) as typeof queryBuilder; // Cast para manter o tipo do builder
      }
      const departments = await queryBuilder.orderBy(desc(departmentsSchema.created_at));
      res.json(departments);
    } catch (error) {
      console.error("Erro ao buscar departamentos:", error);
      res.status(500).json({ message: "Erro interno ao buscar departamentos" });
    }
  });

  router.get("/api/departments/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const departmentId = parseInt(req.params.id);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "ID do departamento inválido" });
      }

      const [department] = await db
        .select()
        .from(departmentsSchema)
        .where(eq(departmentsSchema.id, departmentId));

      if (!department) {
        return res.status(404).json({ message: "Departamento não encontrado" });
      }
      
      const userRole = req.session.userRole as string;
      const userCompanyId = req.session.companyId;

      if (userRole === 'company_admin') {
        if (!userCompanyId) {
          return res.status(403).json({ message: "ID da empresa não encontrado na sessão para company_admin" });
        }
        if (department.company_id !== userCompanyId) {
          return res.status(403).json({ message: "Acesso negado a este departamento" });
        }
      } else if (userRole !== 'admin') {
        // Se não for admin e não for company_admin (já tratado), verificar se o departamento pertence à empresa do usuário (se houver)
        if (!userCompanyId || department.company_id !== userCompanyId) {
             return res.status(403).json({ message: "Acesso não permitido para este perfil ou departamento." });
        }
      }
      // Admin tem acesso a qualquer departamento

      res.json(department);
    } catch (error) {
      console.error("Erro ao buscar departamento:", error);
      res.status(500).json({ message: "Erro interno ao buscar departamento" });
    }
  });

  router.put(
    "/api/departments/:id",
    authRequired,
    companyAdminRequired,
    validateRequest(updateDepartmentSchemaInternal), // Usando o schema interno
    async (req: Request, res: Response) => {
      try {
        const departmentId = parseInt(req.params.id);
        if (isNaN(departmentId)) {
          return res.status(400).json({ message: "ID do departamento inválido" });
        }
        const { name, description, company_id, is_active } = req.body;

        const [departmentToUpdate] = await db
          .select()
          .from(departmentsSchema)
          .where(eq(departmentsSchema.id, departmentId));

        if (!departmentToUpdate) {
          return res.status(404).json({ message: "Departamento não encontrado" });
        }

        let effectiveCompanyId = departmentToUpdate.company_id;
        const userRole = req.session.userRole as string;
        const userCompanyId = req.session.companyId;

        if (userRole === 'admin') {
          // Admin pode mudar o company_id para qualquer valor ou null
          effectiveCompanyId = company_id !== undefined ? company_id : departmentToUpdate.company_id;
        } else { // company_admin
          if (!userCompanyId) {
            return res.status(403).json({ message: "ID da empresa não encontrado na sessão para company_admin" });
          }
          if (departmentToUpdate.company_id !== userCompanyId) {
             return res.status(403).json({ message: "Você não pode editar um departamento de outra empresa." });
          }
          effectiveCompanyId = userCompanyId; // Garante que company_admin não mude o company_id
          if (company_id !== undefined && company_id !== null && company_id !== userCompanyId) {
            return res.status(400).json({ message: "Company admin não pode alterar o ID da empresa do departamento."});
          }
        }
        
        if (name && name !== departmentToUpdate.name) {
          const existingNameQueryConditions = [
            eq(departmentsSchema.name, name),
            effectiveCompanyId ? eq(departmentsSchema.company_id, effectiveCompanyId) : isNull(departmentsSchema.company_id),
            ne(departmentsSchema.id, departmentId)
          ];
          const [existingByName] = await db.select().from(departmentsSchema).where(and(...existingNameQueryConditions.filter(c => c !== undefined) as SQLWrapper[])); // Adicionado filter e cast

          if (existingByName) {
            return res.status(409).json({ message: `Já existe outro departamento com este nome ${effectiveCompanyId ? 'nesta empresa' : 'globalmente'}.` });
          }
        }

        const updatePayload: Partial<typeof departmentsSchema.$inferInsert> = {};
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        
        // Apenas admin pode alterar company_id. Company_admin opera dentro da sua empresa.
        if (userRole === 'admin' && company_id !== undefined) {
            updatePayload.company_id = company_id === null ? null : Number(company_id);
        }
        // Não permitir que company_admin altere, pois effectiveCompanyId já está definido para sua empresa.
        // Se for admin e não fornecer company_id, manterá o existente (ou definido por effectiveCompanyId no início).

        if (is_active !== undefined) updatePayload.is_active = is_active;
        
        // Só adicionar updatedAt se houver outras alterações além dela mesma
        const hasOtherChanges = Object.keys(updatePayload).length > 0;
        if (hasOtherChanges) {
            updatePayload.updated_at = new Date();
        }

        if (!hasOtherChanges) {
            return res.json(departmentToUpdate); // Nada para atualizar
        }

        const [updatedDepartment] = await db
          .update(departmentsSchema)
          .set(updatePayload)
          .where(eq(departmentsSchema.id, departmentId))
          .returning();
        
        res.json(updatedDepartment);
      } catch (error) {
        console.error("Erro ao atualizar departamento:", error);
        res.status(500).json({ message: "Erro interno ao atualizar departamento" });
      }
    }
  );

  router.delete(
    "/api/departments/:id",
    authRequired,
    companyAdminRequired,
    async (req: Request, res: Response) => {
      try {
        const departmentId = parseInt(req.params.id);
        if (isNaN(departmentId)) {
          return res.status(400).json({ message: "ID do departamento inválido" });
        }

        const [departmentToDelete] = await db
          .select()
          .from(departmentsSchema)
          .where(eq(departmentsSchema.id, departmentId));

        if (!departmentToDelete) {
          return res.status(404).json({ message: "Departamento não encontrado" });
        }

        const userRole = req.session.userRole as string;
        const userCompanyId = req.session.companyId;

        if (userRole === 'company_admin') {
          if (!userCompanyId) {
             return res.status(403).json({ message: "ID da empresa não encontrado na sessão para company_admin" });
          }
          if (departmentToDelete.company_id !== userCompanyId) {
            return res.status(403).json({ message: "Acesso negado para excluir este departamento" });
          }
        }
        
        const [officialLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                       .from(schema.officialDepartments)
                                       .where(eq(schema.officialDepartments.department, departmentId.toString())); // Corrigido para department e toString()
        if(officialLink && officialLink.count > 0) {
            return res.status(400).json({ message: "Departamento não pode ser excluído pois está vinculado a atendentes." });
        }
        
        const [ticketLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                     .from(schema.tickets)
                                     .where(eq(schema.tickets.department_id, departmentId));
        if(ticketLink && ticketLink.count > 0) {
            return res.status(400).json({ message: "Departamento não pode ser excluído pois está vinculado a chamados." });
        }

        const [incidentTypeLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                     .from(schema.incidentTypes)
                                     .where(eq(schema.incidentTypes.department_id, departmentId));
        if(incidentTypeLink && incidentTypeLink.count > 0) {
            return res.status(400).json({ message: "Departamento não pode ser excluído pois está vinculado a tipos de incidentes." });
        }
        
        const [ticketTypeLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                     .from(schema.ticketTypes)
                                     .where(eq(schema.ticketTypes.department_id, departmentId));
        if(ticketTypeLink && ticketTypeLink.count > 0) {
            return res.status(400).json({ message: "Departamento não pode ser excluído pois está vinculado a tipos de chamados (ticket types)." });
        }


        await db.delete(departmentsSchema).where(eq(departmentsSchema.id, departmentId));
        res.status(204).send();
      } catch (error) {
        console.error("Erro ao excluir departamento:", error);
        res.status(500).json({ message: "Erro interno ao excluir departamento" });
      }
    }
  );

  // --- ROTAS DE EMPRESAS ---
  router.get("/api/companies", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const companiesList = await db.select().from(schema.companies).orderBy(desc(schema.companies.id));
      res.json(companiesList);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      res.status(500).json({ message: "Erro interno ao buscar empresas" });
    }
  });

  app.use("/api", router); 
  // ... (setupVite e listen)
}
