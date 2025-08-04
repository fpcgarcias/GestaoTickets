import express, { Response } from "express";
import type { Express, Request, NextFunction as NextFnExpress } from "express";
import { createServer, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema, slaDefinitions, departments as departmentsSchema, userRoleEnum, customers } from "@shared/schema";
import { eq, desc, asc, isNull, sql, and, ne, or, inArray, ilike, not, type SQLWrapper, gte, lte } from "drizzle-orm";
import * as schema from "@shared/schema";
import { users } from "@shared/schema";
import { db } from "./db";
import { notificationService } from "./services/notification-service";
import * as crypto from 'crypto';
import multer from 'multer';
import s3Service from './services/s3-service';
import { emailConfigService, type EmailConfig, type SMTPConfigInput } from './services/email-config-service';
import { emailNotificationService } from './services/email-notification-service';
import dashboardRouter from './routes/dashboard';
import logsRouter from './routes/logs';
import ticketParticipantsRouter from './routes/ticket-participants';
import reportsRouter from './routes/reports';

// 🔥 FASE 5.2: Importar middlewares de autorização centralizados
import { 
  authRequired, 
  adminRequired, 
  companyAdminRequired, 
  managerRequired, 
  supervisorRequired, 
  triageRequired, 
  viewerRequired, 
  authorize, 
  companyAccessRequired, 
  ticketAccessRequired, 
  participantManagementRequired, 
  canAddParticipants, 
  canRemoveParticipants,
  departmentAccessRequired,
  canManageUserRole 
} from './middleware/authorization';

// === IMPORTS DE SEGURANÇA ===
import { 
  authLimiter, 
  apiLimiter, 
  uploadLimiter, 
  validateSchema, 
  loginSchema, 
  ticketSchema, 
  sanitizeHtml, 
  securityLogger, 
  validateFileUpload
} from './middleware/security';

// === IMPORTS DE MONITORAMENTO ===
import {
  getSecurityReport,
  getSystemStats,
  healthCheck,
  clearSecurityLogs,
  logSecurityEvent
} from './api/security-monitoring';

// === IMPORTS DE PERFORMANCE ===
import { performanceMiddleware, performanceStatsHandler } from './middleware/performance';

// === IMPORTS DE LOGGING ===
import { logger, logPerformance, logSecurity } from './services/logger';

// Importações para o sistema de IA
import { AiService } from './services/ai-service';
import { 
  getAiConfigurations, 
  createAiConfiguration, 
  updateAiConfiguration, 
  deleteAiConfiguration, 
  testAiConfiguration,
  getAiProviders,
  getAiProvidersAdmin,
  updateAiProvidersAdmin,
  getAiCompanies,
  updateAiCompanyPermission
} from './api/ai-configurations';

// Importar funções de permissões de empresa
import {
  getCompanyPermissions,
  updateCompanyPermissions,
  getAllCompaniesPermissions,
  getAiUsageSettings,
  updateAiUsageSettings
} from './api/company-permissions';

// Rota para configurações de uso de IA
const settingsRouter = express.Router();
settingsRouter.get('/ai-usage', authRequired, companyAdminRequired, getAiUsageSettings);
settingsRouter.put('/ai-usage', authRequired, companyAdminRequired, updateAiUsageSettings);


// Importar funções do novo serviço de SLA
import { resolveSLA, getCacheStats, preloadCache, cleanCache } from './api/sla-resolver';

// Importar funções do serviço de configurações SLA
import { 
  getSLAConfigurations,
  getSLAConfigurationById,
  createSLAConfiguration,
  updateSLAConfiguration,
  deleteSLAConfiguration,
  bulkCreateSLAConfigurations,
  bulkUpdateSLAConfigurations,
  bulkDeleteSLAConfigurations,
  bulkToggleActiveSLAConfigurations,
  copySLAConfigurations,
  validateSLAConfiguration,
  importSLAConfigurationsCSV
} from './api/sla-configurations';

// Importar API do Dashboard SLA
import { slaApi } from './api/sla-dashboard';

// Schemas Zod para validação de Departamentos (definidos aqui temporariamente)
const insertDepartmentSchemaInternal = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional().nullable(),
  company_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});
const updateDepartmentSchemaInternal = insertDepartmentSchemaInternal.partial();

// Função auxiliar para salvar e carregar configurações
async function saveSystemSetting(key: string, value: string, companyId?: number): Promise<void> {
  // Para contornar a constraint única, usar uma chave composta quando há company_id
  const compositeKey = companyId ? `${key}_company_${companyId}` : key;
  
  const whereCondition = eq(schema.systemSettings.key, compositeKey);

  const [existing] = await db
    .select()
    .from(schema.systemSettings)
    .where(whereCondition);
    
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
        key: compositeKey,
        value: value,
        company_id: companyId || null,
        created_at: new Date(),
        updated_at: new Date()
      });
  }
}

async function getSystemSetting(key: string, defaultValue: string = '', companyId?: number): Promise<string> {
  // Para contornar a constraint única, usar uma chave composta quando há company_id
  const compositeKey = companyId ? `${key}_company_${companyId}` : key;
  
  const whereCondition = eq(schema.systemSettings.key, compositeKey);

  const [setting] = await db
    .select()
    .from(schema.systemSettings)
    .where(whereCondition);
    
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

// 🔥 FASE 5.2: Middlewares de autorização movidos para arquivo centralizado
// Ver: server/middleware/authorization.ts

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

// 🔥 FASE 5.2: Funções de autorização movidas para arquivo centralizado
// Ver: server/middleware/authorization.ts

// 🔥 FASE 5.3: Função auxiliar para verificar se usuário customer também é official
async function isUserAlsoOfficial(userId: number): Promise<boolean> {
  try {
    const [official] = await db
      .select()
      .from(schema.officials)
      .where(and(
        eq(schema.officials.user_id, userId),
        eq(schema.officials.is_active, true)
      ))
      .limit(1);
    
    return !!official;
  } catch (error) {
    console.error('Erro ao verificar se usuário é também official:', error);
    return false;
  }
}

// Função auxiliar para verificar se um usuário pode responder a um ticket
async function canUserReplyToTicket(
  userId: number, 
  userRole: string, 
  ticketId: number, 
  userCompanyId?: number
): Promise<{ canReply: boolean; reason?: string }> {
  try {
    // Buscar o ticket
    const ticket = await storage.getTicket(ticketId, userRole, userCompanyId);
    if (!ticket) {
      return { canReply: false, reason: "Ticket não encontrado" };
    }

    // Verificar se o ticket está resolvido
    if (ticket.status === 'resolved') {
      return { canReply: false, reason: "Não é possível responder a tickets resolvidos" };
    }

    // 🔥 FASE 4.1: Verificar se o usuário é participante do ticket
    const isParticipant = await storage.isUserTicketParticipant(ticketId, userId);
    
    // Se é participante, sempre pode responder
    if (isParticipant) {
      return { canReply: true };
    }

    // Verificar permissões baseadas na role
    if (userRole === 'admin' || userRole === 'support' || userRole === 'manager' || userRole === 'supervisor' || userRole === 'company_admin') {
      return { canReply: true };
    }

    // Para clientes, verificar se é o criador do ticket
    if (userRole === 'customer') {
      if (ticket.customer_id) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id));
        
        if (customer?.user_id === userId) {
          return { canReply: true };
        }
      }
      return { canReply: false, reason: "Apenas o criador do ticket pode responder" };
    }

    return { canReply: false, reason: "Permissão insuficiente para responder a este ticket" };
  } catch (error) {
    console.error('Erro ao verificar permissões de resposta:', error);
    return { canReply: false, reason: "Erro interno ao verificar permissões" };
  }
}

export async function registerRoutes(app: Express): Promise<HttpServer> {
  const router = express.Router();
  
  // === APLICAR MIDDLEWARES DE SEGURANÇA SELETIVAMENTE ===
  // Aplicar apenas em produção e de forma mais suave
  if (process.env.NODE_ENV === 'production') {
    router.use(securityLogger); // Log de atividades suspeitas
    router.use(sanitizeHtml);   // Sanitização de HTML
    router.use(apiLimiter);     // Rate limiting geral para API
  } else {
    console.log('🔧 Middlewares de segurança DESABILITADOS em desenvolvimento');
  }
  
  // === APLICAR MIDDLEWARE DE PERFORMANCE ===
  router.use(performanceMiddleware); // Monitoramento de performance em todas as rotas
  
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
      
      // Criptografar a senha fornecida pelo usuário
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
        // Mapear TODOS os roles válidos para a sessão
        const validRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'triage', 'customer', 'viewer', 'quality', 'integration_bot'];
        if (validRoles.includes(user.role)) {
          req.session.userRole = user.role;
        } else {
          console.warn(`Papel de usuário '${user.role}' não é válido. Roles válidos: ${validRoles.join(', ')}`);
          // Definir como customer por segurança
          req.session.userRole = 'customer';
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
          
          // Manager pode ver tickets de:
          // 1. Seus próprios tickets
          // 2. Tickets de todos os atendentes que têm ele como manager
          // 3. Tickets não atribuídos dos departamentos dos atendentes sob sua gestão
          
          const [managerOfficial] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId)).limit(1);
          if (managerOfficial) {
            // Buscar todos os atendentes que têm este manager
            const subordinates = await db.select().from(schema.officials).where(eq(schema.officials.manager_id, managerOfficial.id));
            const subordinateIds = subordinates.map(s => s.id);
            
            // Buscar departamentos dos subordinados para tickets não atribuídos
            const allDepartments = new Set<number>();
            for (const subordinate of subordinates) {
              const departments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, subordinate.id));
              departments.forEach(dept => allDepartments.add(dept.department_id));
            }
            
            // Buscar seus próprios departamentos também
            const managerDepartments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, managerOfficial.id));
            managerDepartments.forEach(dept => allDepartments.add(dept.department_id));
            
            const departmentIds = Array.from(allDepartments);
            
            const ticketConditions = [
              eq(schema.tickets.assigned_to_id, managerOfficial.id), // Seus próprios tickets
            ];
            
            if (subordinateIds.length > 0) {
              ticketConditions.push(inArray(schema.tickets.assigned_to_id, subordinateIds)); // Tickets dos subordinados
            }
            
            if (departmentIds.length > 0) {
              ticketConditions.push(
                and(
                  isNull(schema.tickets.assigned_to_id), // Tickets não atribuídos
                  inArray(schema.tickets.department_id, departmentIds) // Dos departamentos relevantes
                )
              );
            }
            
            conditions.push(or(...ticketConditions));
          } else {
            return res.json([]); // Usuário manager não é um atendente
          }
        } else {
            return res.json([]); // manager sem companyId não deve ver tickets
        }
      } else if (role === 'supervisor') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
          
          // Supervisor pode ver tickets de:
          // 1. Seus próprios tickets
          // 2. Tickets dos atendentes que têm ele como supervisor
          // 3. Tickets não atribuídos dos departamentos dos atendentes sob sua supervisão
          
          const [supervisorOfficial] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId)).limit(1);
          if (supervisorOfficial) {
            // Buscar todos os atendentes que têm este supervisor
            const subordinates = await db.select().from(schema.officials).where(eq(schema.officials.supervisor_id, supervisorOfficial.id));
            const subordinateIds = subordinates.map(s => s.id);
            
            // Buscar departamentos dos subordinados para tickets não atribuídos
            const allDepartments = new Set<number>();
            for (const subordinate of subordinates) {
              const departments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, subordinate.id));
              departments.forEach(dept => allDepartments.add(dept.department_id));
            }
            
            // Buscar seus próprios departamentos também
            const supervisorDepartments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, supervisorOfficial.id));
            supervisorDepartments.forEach(dept => allDepartments.add(dept.department_id));
            
            const departmentIds = Array.from(allDepartments);
            
            const ticketConditions = [
              eq(schema.tickets.assigned_to_id, supervisorOfficial.id), // Seus próprios tickets
            ];
            
            if (subordinateIds.length > 0) {
              ticketConditions.push(inArray(schema.tickets.assigned_to_id, subordinateIds)); // Tickets dos subordinados
            }
            
            if (departmentIds.length > 0) {
              ticketConditions.push(
                and(
                  isNull(schema.tickets.assigned_to_id), // Tickets não atribuídos
                  inArray(schema.tickets.department_id, departmentIds) // Dos departamentos relevantes
                )
              );
            }
            
            conditions.push(or(...ticketConditions));
          } else {
            return res.json([]); // Usuário supervisor não é um atendente
          }
        } else {
            return res.json([]); // supervisor sem companyId não deve ver tickets
        }
      } else if (role === 'support') {
        if (companyId) {
          conditions.push(eq(schema.tickets.company_id, companyId));
          
          // Support pode ver tickets de:
          // 1. Seus próprios tickets (atribuídos a ele)
          // 2. Tickets não atribuídos dos seus departamentos
          
          const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId)).limit(1);
          if (official) {
            const departments = await db.select().from(schema.officialDepartments).where(eq(schema.officialDepartments.official_id, official.id));
            if (departments.length > 0) {
              const departmentIds = departments.map(d => d.department_id);
              
              if (departmentIds.length > 0) {
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
                // Se não conseguiu mapear os departamentos, mostrar apenas tickets atribuídos
                conditions.push(eq(schema.tickets.assigned_to_id, official.id));
              }
            } else {
              // Se não tem departamentos, mostrar apenas tickets atribuídos diretamente
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
  // Busca tickets com base no papel do usuário com paginação e filtros
  router.get("/tickets/user-role", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole as string;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20; // 20 por página para tickets
      
      // Parâmetros de filtro
      const search = (req.query.search as string) || '';
      const statusFilter = req.query.status as string;
      const priorityFilter = req.query.priority as string;
      const departmentFilter = req.query.department_id as string;
      const assignedToFilter = req.query.assigned_to_id as string;
      const hideResolved = req.query.hide_resolved === 'true';
      const timeFilter = req.query.time_filter as string;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      
      // Preparar filtros para o método paginado
      const filters: any = {};
      
      if (search) {
        filters.search = search;
      }
      
      if (statusFilter && statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      
      if (priorityFilter && priorityFilter !== 'all') {
        filters.priority = priorityFilter;
      }
      
      if (departmentFilter && departmentFilter !== 'all') {
        filters.department_id = parseInt(departmentFilter);
      }
      
      if (assignedToFilter && assignedToFilter !== 'all') {
        if (assignedToFilter === 'unassigned') {
          filters.unassigned = true;
        } else {
          filters.assigned_to_id = parseInt(assignedToFilter);
        }
      }
      
      if (hideResolved) {
        filters.hide_resolved = true;
      }
      
      // Processar filtros de data - USAR MESMA LÓGICA DO DASHBOARD
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      
      if (startDate || endDate) {
        if (startDate) {
          filters.start_date = startDate;
        }
        if (endDate) {
          filters.end_date = endDate;
        }
      } else if (dateFrom || dateTo) {
        if (dateFrom) {
          filters.date_from = dateFrom;
        }
        if (dateTo) {
          filters.date_to = dateTo;
        }
      } else if (timeFilter) {
        filters.time_filter = timeFilter;
      }
      
      // Usar o método paginado que aplica filtros no SQL
      const result = await storage.getTicketsByUserRolePaginated(userId, userRole, filters, page, limit);
      
      res.json(result);
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
      
      // Obter filtros se fornecidos
      const officialId = req.query.official_id ? parseInt(req.query.official_id as string) : undefined;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
      
      // Obter estatísticas de tickets filtradas pelo papel do usuário, atendente e período
      const stats = await storage.getTicketStatsByUserRole(userId, userRole, officialId, startDate, endDate);
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
      const officialId = req.query.official_id ? parseInt(req.query.official_id as string) : undefined;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
      
      // Obter tickets recentes filtrados pelo papel do usuário, atendente e período
      const tickets = await storage.getRecentTicketsByUserRole(userId, userRole, limit, officialId, startDate, endDate);
      res.json(tickets);
    } catch (error) {
      console.error('Erro ao buscar tickets recentes:', error);
      res.status(500).json({ message: "Falha ao buscar tickets recentes" });
    }
  });

  router.get("/tickets/average-first-response-time", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole as string;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const officialId = req.query.official_id ? parseInt(req.query.official_id as string) : undefined;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
      
      // Obter tempo médio de primeira resposta filtrado pelo papel do usuário, atendente e período
      const averageTime = await storage.getAverageFirstResponseTimeByUserRole(userId, userRole, officialId, startDate, endDate);
      res.json({ averageTime });
    } catch (error) {
      console.error('Erro ao buscar tempo médio de primeira resposta:', error);
      res.status(500).json({ message: "Falha ao buscar tempo médio de primeira resposta" });
    }
  });

  router.get("/tickets/average-resolution-time", authRequired, async (req: Request, res: Response) => {
    try {
      // Obter o ID do usuário da sessão
      const userId = req.session.userId;
      const userRole = req.session.userRole as string;
      
      if (!userId || !userRole) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const officialId = req.query.official_id ? parseInt(req.query.official_id as string) : undefined;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
      
      // Obter tempo médio de resolução filtrado pelo papel do usuário, atendente e período
      const averageTime = await storage.getAverageResolutionTimeByUserRole(userId, userRole, officialId, startDate, endDate);
      res.json({ averageTime });
    } catch (error) {
      console.error('Erro ao buscar tempo médio de resolução:', error);
      res.status(500).json({ message: "Falha ao buscar tempo médio de resolução" });
    }
  });

  // Individual ticket by ID
  router.get("/tickets/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // Passar informações da sessão para controle de empresa
      const userRole = req.session?.userRole as string;
      const userCompanyId = req.session?.companyId;

      const ticket = await storage.getTicket(id, userRole, userCompanyId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Falha ao buscar ticket" });
    }
  });

  // Buscar replies de um ticket específico
  router.get("/tickets/:id/replies", authRequired, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // ✅ VERIFICAR ACESSO COM CONTROLE DE EMPRESA
      const userRole = req.session?.userRole as string;
      const userCompanyId = req.session?.companyId;
      
      const ticket = await storage.getTicket(ticketId, userRole, userCompanyId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Buscar replies do ticket
      const replies = await db
        .select({
          id: schema.ticketReplies.id,
          ticket_id: schema.ticketReplies.ticket_id,
          user_id: schema.ticketReplies.user_id,
          message: schema.ticketReplies.message,
          created_at: schema.ticketReplies.created_at,
          is_internal: schema.ticketReplies.is_internal,
          user: {
            id: schema.users.id,
            name: schema.users.name,
            role: schema.users.role,
            avatar_url: schema.users.avatar_url,
          }
        })
        .from(schema.ticketReplies)
        .leftJoin(schema.users, eq(schema.ticketReplies.user_id, schema.users.id))
        .where(eq(schema.ticketReplies.ticket_id, ticketId))
        .orderBy(desc(schema.ticketReplies.created_at)); // Mais recentes primeiro

      res.json(replies);
    } catch (error) {
      console.error('Erro ao buscar replies do ticket:', error);
      res.status(500).json({ message: "Erro ao buscar respostas do ticket" });
    }
  });

  // Buscar histórico de status de um ticket específico
  router.get("/tickets/:id/status-history", authRequired, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // ✅ VERIFICAR ACESSO COM CONTROLE DE EMPRESA
      const userRole = req.session?.userRole as string;
      const userCompanyId = req.session?.companyId;
      
      const ticket = await storage.getTicket(ticketId, userRole, userCompanyId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Buscar histórico de status do ticket (incluindo mudanças de prioridade)
      const statusHistory = await db
        .select({
          id: schema.ticketStatusHistory.id,
          ticket_id: schema.ticketStatusHistory.ticket_id,
          old_status: schema.ticketStatusHistory.old_status,
          new_status: schema.ticketStatusHistory.new_status,
          change_type: schema.ticketStatusHistory.change_type,
          old_priority: schema.ticketStatusHistory.old_priority,
          new_priority: schema.ticketStatusHistory.new_priority,
          changed_by_id: schema.ticketStatusHistory.changed_by_id,
          created_at: schema.ticketStatusHistory.created_at,
          user: {
            id: schema.users.id,
            name: schema.users.name,
            role: schema.users.role,
            avatar_url: schema.users.avatar_url,
          }
        })
        .from(schema.ticketStatusHistory)
        .leftJoin(schema.users, eq(schema.ticketStatusHistory.changed_by_id, schema.users.id))
        .where(eq(schema.ticketStatusHistory.ticket_id, ticketId))
        .orderBy(desc(schema.ticketStatusHistory.created_at)); // Mais recentes primeiro

      res.json(statusHistory);
    } catch (error) {
      console.error('Erro ao buscar histórico de status do ticket:', error);
      res.status(500).json({ message: "Erro ao buscar histórico de status do ticket" });
    }
  });

  // Rota para buscar histórico de análise de IA de um ticket
  router.get("/tickets/:id/ai-analysis-history", authRequired, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      const userRole = req.session?.userRole;
      const userCompanyId = req.session?.companyId;

      if (isNaN(ticketId)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // Buscar ticket para verificar permissões
      const ticket = await storage.getTicket(ticketId, userRole, userCompanyId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Buscar histórico de análise de IA
      const aiHistory = await db
        .select({
          id: schema.aiAnalysisHistory.id,
          suggested_priority: schema.aiAnalysisHistory.suggested_priority,
          ai_justification: schema.aiAnalysisHistory.ai_justification,
          provider: schema.aiAnalysisHistory.provider,
          model: schema.aiAnalysisHistory.model,
          processing_time_ms: schema.aiAnalysisHistory.processing_time_ms,
          status: schema.aiAnalysisHistory.status,
          created_at: schema.aiAnalysisHistory.created_at,
          config_name: schema.aiConfigurations.name,
          analysis_type: schema.aiAnalysisHistory.analysis_type,
        })
        .from(schema.aiAnalysisHistory)
        .leftJoin(schema.aiConfigurations, eq(schema.aiAnalysisHistory.ai_configuration_id, schema.aiConfigurations.id))
        .where(eq(schema.aiAnalysisHistory.ticket_id, ticketId))
        .orderBy(desc(schema.aiAnalysisHistory.created_at));

      res.json(aiHistory);
    } catch (error) {
      console.error('Erro ao buscar histórico de análise de IA:', error);
      res.status(500).json({ message: "Falha ao buscar histórico de análise de IA", error: String(error) });
    }
  });

  // Rota para auditoria de análises de IA (com filtros)
  router.get("/ai-analysis-audit", authRequired, async (req: Request, res: Response) => {
    try {
      const userRole = req.session?.userRole;
      const userCompanyId = req.session?.companyId;

      // Apenas admin e company_admin podem acessar auditoria
      if (userRole !== 'admin' && userRole !== 'company_admin') {
        return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar a auditoria." });
      }

      const {
        page = '1',
        limit = '50',
        analysis_type,
        status,
        provider,
        start_date,
        end_date,
        ticket_id,
        company_id
      } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 50;
      const offset = (pageNum - 1) * limitNum;

      // Construir condições de filtro
      const conditions = [];

      // Filtro por empresa (admin pode ver todas, company_admin apenas sua empresa)
      if (userRole === 'admin' && company_id) {
        conditions.push(eq(schema.aiAnalysisHistory.company_id, parseInt(company_id as string)));
      } else if (userRole === 'company_admin') {
        conditions.push(eq(schema.aiAnalysisHistory.company_id, userCompanyId!));
      }

      // Filtros opcionais
      if (analysis_type) {
        conditions.push(eq(schema.aiAnalysisHistory.analysis_type, analysis_type as string));
      }
      if (status && ['success', 'error', 'timeout', 'fallback'].includes(status as string)) {
        conditions.push(eq(schema.aiAnalysisHistory.status, status as 'success' | 'error' | 'timeout' | 'fallback'));
      }
      if (provider && ['openai', 'google', 'anthropic'].includes(provider as string)) {
        conditions.push(eq(schema.aiAnalysisHistory.provider, provider as 'openai' | 'google' | 'anthropic'));
      }
      if (ticket_id) {
        conditions.push(eq(schema.aiAnalysisHistory.ticket_id, parseInt(ticket_id as string)));
      }
      if (start_date) {
        conditions.push(gte(schema.aiAnalysisHistory.created_at, new Date(start_date as string)));
      }
      if (end_date) {
        conditions.push(lte(schema.aiAnalysisHistory.created_at, new Date(end_date as string)));
      }

      // Buscar total de registros
      const totalQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.aiAnalysisHistory)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = totalQuery[0]?.count || 0;

      // Buscar dados paginados
      const aiHistory = await db
        .select({
          id: schema.aiAnalysisHistory.id,
          ticket_id: schema.aiAnalysisHistory.ticket_id,
          suggested_priority: schema.aiAnalysisHistory.suggested_priority,
          ai_justification: schema.aiAnalysisHistory.ai_justification,
          provider: schema.aiAnalysisHistory.provider,
          model: schema.aiAnalysisHistory.model,
          processing_time_ms: schema.aiAnalysisHistory.processing_time_ms,
          status: schema.aiAnalysisHistory.status,
          created_at: schema.aiAnalysisHistory.created_at,
          analysis_type: schema.aiAnalysisHistory.analysis_type,
          config_name: schema.aiConfigurations.name,
          ticket_title: schema.tickets.title,
          company_name: schema.companies.name,
        })
        .from(schema.aiAnalysisHistory)
        .leftJoin(schema.aiConfigurations, eq(schema.aiAnalysisHistory.ai_configuration_id, schema.aiConfigurations.id))
        .leftJoin(schema.tickets, eq(schema.aiAnalysisHistory.ticket_id, schema.tickets.id))
        .leftJoin(schema.companies, eq(schema.aiAnalysisHistory.company_id, schema.companies.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.aiAnalysisHistory.created_at))
        .limit(limitNum)
        .offset(offset);

      res.json({
        data: aiHistory,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1,
        }
      });
    } catch (error) {
      console.error('Erro ao buscar auditoria de análises de IA:', error);
      res.status(500).json({ message: "Falha ao buscar auditoria de análises de IA", error: String(error) });
    }
  });
  
  // Rota para atualizar parcialmente um ticket (ex: atribuir atendente)
  router.patch("/tickets/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // ✅ VERIFICAR ACESSO COM CONTROLE DE EMPRESA
      const userRole = req.session?.userRole as string;
      const userCompanyId = req.session?.companyId;
      
      const existingTicket = await storage.getTicket(id, userRole, userCompanyId);
      if (!existingTicket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // 🚫 BLOQUEAR CUSTOMER DE ALTERAR ATENDENTE (EXCETO SE FOR TAMBÉM OFFICIAL)
      const { assigned_to_id } = req.body;
      
      if (userRole === 'customer' && assigned_to_id !== undefined) {
        // 🔥 FASE 5.3: Verificar se o customer também é official (atendente)
        const isAlsoOfficial = await isUserAlsoOfficial(req.session?.userId!);
        
        if (!isAlsoOfficial) {
          return res.status(403).json({ 
            message: "Operação não permitida", 
            details: "Clientes não podem alterar o atendente do ticket." 
          });
        }
        
        console.log(`[PERMISSÃO] ✅ Usuário ${req.session?.userId} é customer MAS também é official - operação permitida`);
      }

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
          // 🔥 VALIDAÇÃO CRÍTICA: Verificar se o atendente é da MESMA EMPRESA do ticket!
          if (assigned_to_id !== null && typeof assigned_to_id === 'number') {
            // 🔥 CORREÇÃO: Buscar dados do official que será atribuído
            const [assignedOfficial] = await db
              .select()
              .from(schema.officials)
              .where(and(eq(schema.officials.id, assigned_to_id), eq(schema.officials.is_active, true)))
              .limit(1);

            if (!assignedOfficial) {
              return res.status(400).json({ 
                message: "Atendente atribuído não encontrado ou inativo",
                details: `Official ID ${assigned_to_id} não existe ou está inativo.`
              });
            }

            // 🔥 VALIDAÇÃO DE EMPRESA: Ticket e atendente devem ser da mesma empresa!
            if (existingTicket.company_id && assignedOfficial.company_id && existingTicket.company_id !== assignedOfficial.company_id) {
              console.error(`[🚨 SEGURANÇA] ❌ VIOLAÇÃO: Tentativa de atribuir ticket da empresa ${existingTicket.company_id} para atendente da empresa ${assignedOfficial.company_id}!`);
              console.error(`[🚨 SEGURANÇA] ❌ Ticket: ${existingTicket.ticket_id} (${existingTicket.title})`);
              console.error(`[🚨 SEGURANÇA] ❌ Atendente: ${assignedOfficial.name} (${assignedOfficial.email})`);
              
              return res.status(403).json({ 
                message: "Operação não permitida",
                details: `Não é possível atribuir um ticket da empresa ${existingTicket.company_id} para um atendente da empresa ${assignedOfficial.company_id}.`
              });
            }

            // 🔥 VALIDAÇÃO ADICIONAL: Se ticket tem empresa, atendente deve ter empresa
            if (existingTicket.company_id && !assignedOfficial.company_id) {
              console.error(`[🚨 SEGURANÇA] ❌ VIOLAÇÃO: Atendente sem empresa para ticket com empresa!`);
              console.error(`[🚨 SEGURANÇA] ❌ Ticket empresa: ${existingTicket.company_id}, Atendente empresa: ${assignedOfficial.company_id}`);
              
              return res.status(403).json({ 
                message: "Operação não permitida",
                details: `Não é possível atribuir um ticket da empresa ${existingTicket.company_id} para um atendente sem empresa.`
              });
            }

            console.log(`[✅ SEGURANÇA] Validação de empresa: OK - Ticket e atendente são da mesma empresa`);
          }
          
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
      
      // 📧 ENVIAR EMAIL PARA MUDANÇA DE ATRIBUIÇÃO
      if (updateData.assigned_to_id && existingTicket.assigned_to_id !== updateData.assigned_to_id) {
        // 🔥 OTIMIZAÇÃO CRÍTICA: Envio de e-mail fire-and-forget (não bloqueia a resposta)
        const emailStartTime = Date.now();
        console.log(`📧 [EMAIL BACKGROUND] ========================================`);
        console.log(`📧 [EMAIL BACKGROUND] 👤 INICIANDO - Ticket Atribuído (PATCH)`);
        console.log(`📧 [EMAIL BACKGROUND] Ticket ID: ${ticket.id}`);
        console.log(`📧 [EMAIL BACKGROUND] Atribuído para: ${updateData.assigned_to_id}`);
        console.log(`📧 [EMAIL BACKGROUND] Timestamp: ${new Date().toLocaleString('pt-BR')}`);
        console.log(`📧 [EMAIL BACKGROUND] ========================================`);
        
        // Fire-and-forget: não aguarda o envio dos e-mails
        emailNotificationService.notifyTicketAssigned(ticket.id, updateData.assigned_to_id).then(() => {
          const emailDuration = Date.now() - emailStartTime;
          console.log(`📧 [EMAIL BACKGROUND] ========================================`);
          console.log(`📧 [EMAIL BACKGROUND] ✅ CONCLUÍDO - Ticket Atribuído (PATCH) em ${emailDuration}ms`);
          console.log(`📧 [EMAIL BACKGROUND] Ticket ID: ${ticket.id} - Todos os e-mails processados`);
          console.log(`📧 [EMAIL BACKGROUND] ========================================`);
        }).catch((emailError) => {
          const emailDuration = Date.now() - emailStartTime;
          console.error(`📧 [EMAIL BACKGROUND] ========================================`);
          console.error(`📧 [EMAIL BACKGROUND] ❌ ERRO - Ticket Atribuído (PATCH) após ${emailDuration}ms`);
          console.error(`📧 [EMAIL BACKGROUND] Ticket ID: ${ticket.id} - Erro:`, emailError.message);
          console.error(`📧 [EMAIL BACKGROUND] Stack:`, emailError.stack);
          console.error(`📧 [EMAIL BACKGROUND] ========================================`);
        });
      }

      res.json(ticket);
    } catch (error) {
      console.error('Erro ao atualizar ticket (patch):', error);
      res.status(500).json({ message: "Falha ao atualizar ticket", error: String(error) });
    }
  });

  // Rota para atualizar completamente um ticket (incluindo status)
  router.put("/tickets/:id", authRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      // ✅ VERIFICAR ACESSO COM CONTROLE DE EMPRESA
      const userRole = req.session?.userRole as string;
      const userCompanyId = req.session?.companyId;
      
      const existingTicket = await storage.getTicket(id, userRole, userCompanyId);
      if (!existingTicket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      const { 
        title, 
        description, 
        status, 
        priority, 
        assigned_to_id, 
        department_id,
        customer_email,
        customer_id,
        type
      } = req.body;

      const updateData: any = {};

      // Validar e adicionar campos que podem ser atualizados
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) updateData.priority = priority;
      if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id;
      if (department_id !== undefined) updateData.department_id = department_id;
      if (customer_email !== undefined) updateData.customer_email = customer_email;
      if (customer_id !== undefined) updateData.customer_id = customer_id;
      if (type !== undefined) updateData.type = type;

      // 🔥 VALIDAÇÃO ESPECIAL PARA MUDANÇA DE STATUS
      let statusChanged = false;
      let oldStatus = existingTicket.status;
      
      if (status !== undefined && status !== existingTicket.status) {
        // Validar se o usuário tem permissão para mudar o status
        if (userRole === 'customer' && status !== 'waiting_customer') {
          return res.status(403).json({ 
            message: "Operação não permitida", 
            details: "Clientes só podem alterar o status para 'Aguardando Cliente'." 
          });
        }

        updateData.status = status;
        statusChanged = true;

        // Adicionar campos específicos baseados no novo status
        if (status === 'resolved' && existingTicket.status !== 'resolved') {
          updateData.resolved_at = new Date();
        }
        if (status === 'ongoing' && !existingTicket.first_response_at) {
          updateData.first_response_at = new Date();
        }
        if (status === 'reopened') {
          updateData.reopened_at = new Date();
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "Nenhum dado válido para atualizar" });
      }

      // Atualizar o ticket
      const ticket = await storage.updateTicket(id, updateData);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // 🔥 ENVIAR NOTIFICAÇÕES DE EMAIL PARA MUDANÇA DE STATUS
      if (statusChanged) {
        try {
          // Enviar notificação de email para mudança de status
          emailNotificationService.notifyStatusChanged(
            ticket.id,
            String(oldStatus || ''),
            String(status || ''),
            req.session?.userId
          ).catch((emailError) => {
            console.error(`[📧 EMAIL] ❌ Erro ao enviar notificação de mudança de status:`, emailError);
          });

          // 🔥 ESCALAÇÃO AUTOMÁTICA QUANDO STATUS MUDA PARA "escalated"
          if (status === 'escalated') {
            try {
              emailNotificationService.notifyTicketEscalated(
                ticket.id,
                req.session?.userId,
                `Ticket escalado manualmente por ${req.session?.adUsername || 'usuário'}`
              ).catch((escalationError) => {
                console.error(`[📧 EMAIL] ❌ Erro ao enviar notificação de escalação:`, escalationError);
              });
            } catch (escalationError) {
              console.error('Erro ao enviar notificação de escalação:', escalationError);
            }
          }
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de mudança de status:', notificationError);
        }
      }

      // 🔥 ENVIAR NOTIFICAÇÃO DE EMAIL PARA MUDANÇA DE ATRIBUIÇÃO
      if (assigned_to_id !== undefined && existingTicket.assigned_to_id !== assigned_to_id) {
        try {
          emailNotificationService.notifyTicketAssigned(ticket.id, assigned_to_id).catch((emailError) => {
            console.error(`[📧 EMAIL] ❌ Erro ao enviar notificação de atribuição:`, emailError);
          });
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de atribuição:', notificationError);
        }
      }

      res.json(ticket);
    } catch (error) {
      console.error('Erro ao atualizar ticket (put):', error);
      res.status(500).json({ message: "Falha ao atualizar ticket", error: String(error) });
    }
  });
  
  // Ticket creation and responses
  router.post("/tickets", authRequired, validateRequest(insertTicketSchema), async (req: Request, res: Response) => {
    try {
      // Validar os dados recebidos
      const ticketData = insertTicketSchema.parse(req.body);
      
      // ✅ BUSCAR O CUSTOMER_ID E COMPANY_ID BASEADO NO EMAIL FORNECIDO
      let customerId: number | null = null;
      let companyId: number | null = null;
      
      if (ticketData.customer_email) {
        const existingCustomer = await storage.getCustomerByEmail(ticketData.customer_email);
        if (existingCustomer) {
          customerId = existingCustomer.id;
          companyId = existingCustomer.company_id; // ✅ USAR O COMPANY_ID DO CLIENTE
        }
              }
        
        // 🤖 ANÁLISE DE PRIORIDADE COM IA ANTES DE SALVAR O TICKET
        let finalPriority = ticketData.priority || null;
        
        // ✅ CRIAR O TICKET PRIMEIRO (com prioridade padrão)
        const ticket = await storage.createTicket({
          ...ticketData,
          priority: finalPriority, // Prioridade inicial (será atualizada pela IA se necessário)
          customer_id: customerId || undefined,
          company_id: companyId || undefined // ✅ USAR O COMPANY_ID DO CLIENTE
        });

        // 🔍 OBTER A PRIORIDADE REAL QUE FOI SALVA NO TICKET
        let originalPriority = ticket.priority || null;

        // ✅ ADICIONAR PARTICIPANTES SE FORNECIDOS
        if (ticketData.participants && Array.isArray(ticketData.participants) && ticketData.participants.length > 0) {
          try {
            const userId = req.session?.userId;
            if (!userId) {
              throw new Error('Usuário não identificado para adicionar participantes');
            }
            
            // Adicionar cada participante individualmente
            for (const participantId of ticketData.participants) {
              try {
                await storage.addTicketParticipant(ticket.id, participantId, userId);
              } catch (error) {
                console.error(`[Participantes] Erro ao adicionar participante ${participantId}:`, error);
                // Continuar com os próximos participantes mesmo se um falhar
              }
            }
            console.log(`[Participantes] ${ticketData.participants.length} participante(s) adicionado(s) ao ticket ${ticket.id}`);
          } catch (participantError) {
            console.error('[Participantes] Erro ao adicionar participantes:', participantError);
            // Erro na adição de participantes não impede a criação do ticket
          }
        }

        // 🤖 ANÁLISE DE PRIORIDADE COM IA APÓS CRIAR O TICKET (salva histórico automaticamente)
        let aiAnalyzed = false;
        let finalPriorityId: number | null = null;
      
      if (companyId && ticketData.title && ticketData.description && ticket.department_id) {
        try {
          const aiService = new AiService();
          const aiResult = await aiService.analyzeTicketPriority(
            {
              title: ticketData.title, 
              description: ticketData.description, 
              companyId: companyId,
              ticketId: ticket.id
            },
            db
          );
          
          if (aiResult && !aiResult.usedFallback) {
            finalPriority = aiResult.priority;
            aiAnalyzed = true;
            
            console.log(`[AI] IA retornou prioridade: ${finalPriority}`);
            
            // 🔍 BUSCAR ID CORRETO DA PRIORIDADE NO BANCO
            const [priorityData] = await db
              .select({ id: schema.departmentPriorities.id, name: schema.departmentPriorities.name })
              .from(schema.departmentPriorities)
              .where(
                and(
                  eq(schema.departmentPriorities.company_id, companyId),
                  eq(schema.departmentPriorities.department_id, ticket.department_id),
                  eq(schema.departmentPriorities.name, finalPriority),
                  eq(schema.departmentPriorities.is_active, true)
                )
              )
              .limit(1);

            if (priorityData) {
              finalPriorityId = priorityData.id;
              finalPriority = priorityData.name; // Usar o nome exato do banco
              console.log(`[AI] Prioridade vinculada: ${finalPriority} (ID: ${finalPriorityId})`);
            } else {
              // Tentar busca case-insensitive
              const allPriorities = await db
                .select({ id: schema.departmentPriorities.id, name: schema.departmentPriorities.name })
                .from(schema.departmentPriorities)
                .where(
                  and(
                    eq(schema.departmentPriorities.company_id, companyId),
                    eq(schema.departmentPriorities.department_id, ticket.department_id),
                    eq(schema.departmentPriorities.is_active, true)
                  )
                );

              const foundPriority = allPriorities.find(p => 
                p.name.toLowerCase() === finalPriority.toLowerCase()
              );

              if (foundPriority) {
                finalPriorityId = foundPriority.id;
                finalPriority = foundPriority.name;
                console.log(`[AI] Prioridade vinculada (case-insensitive): ${finalPriority} (ID: ${finalPriorityId})`);
              } else {
                console.warn(`[AI] ATENÇÃO: Prioridade "${finalPriority}" não encontrada no banco! Ticket ficará sem prioridade específica.`);
                finalPriority = 'Prioridade não encontrada';
                finalPriorityId = null;
              }
            }
            
            // 🔄 ATUALIZAR PRIORIDADE DO TICKET SE A IA SUGERIU DIFERENTE
            // Comparar prioridades case-insensitive
            const normalizeForComparison = (priority: string | null) => {
              return priority ? priority.toLowerCase() : '';
            };
            
            const normalizedOriginal = normalizeForComparison(originalPriority);
            const normalizedFinal = normalizeForComparison(finalPriority);
            

            
            if (normalizedFinal !== normalizedOriginal && finalPriorityId && finalPriority) {
              console.log(`[AI] Atualizando ticket: ${originalPriority} → ${finalPriority} (ID: ${finalPriorityId})`);
              
              await db
                .update(schema.tickets)
                .set({ 
                  priority: finalPriority as any, // SALVAR EXATAMENTE como a IA retornou
                  priority_id: finalPriorityId // VINCULAR ID CORRETO
                })
                .where(eq(schema.tickets.id, ticket.id));
                
              // 🤖 REGISTRAR MUDANÇA NO HISTÓRICO DE STATUS
              // Buscar ou criar usuário bot para IA
              let botUser = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.role, 'integration_bot'))
                .limit(1);

              let botUserId: number;
              
              if (botUser.length === 0) {
                // Criar usuário bot se não existir
                const [createdBot] = await db
                  .insert(schema.users)
                  .values({
                    username: 'ai_robot',
                    email: 'ai@system.internal',
                    name: 'Robo IA',
                    role: 'integration_bot',
                    password: 'AiBot123!@#', // Senha que atende aos critérios de segurança
                    active: true,
                    company_id: null, // Bot global
                    created_at: new Date(),
                    updated_at: new Date()
                  })
                  .returning();
                
                botUserId = createdBot.id;
              } else {
                botUserId = botUser[0].id;
              }

              // Registrar mudança de prioridade no histórico
              await db
                .insert(schema.ticketStatusHistory)
                .values({
                  ticket_id: ticket.id,
                  change_type: 'priority',
                  old_priority: normalizedOriginal as any,
                  new_priority: normalizedFinal as any,
                  changed_by_id: botUserId,
                  created_at: new Date()
                });
                
              // Atualizar prioridade final para resposta
              finalPriority = normalizedFinal;
            } else if (normalizedFinal === normalizedOriginal && finalPriority) {
              console.log(`[AI] Prioridade não alterada: ${originalPriority} (mesma prioridade sugerida pela IA)`);
            } else if (!finalPriorityId) {
              console.warn(`[AI] Ticket ${ticket.id} não terá prioridade vinculada pois '${finalPriority}' não existe no banco`);
            }
          }
        } catch (aiError) {
          console.error('[AI] Erro na análise de prioridade:', aiError);
          // Falha na IA não impede a criação do ticket
        }
      }

      logger.info('Ticket criado com sucesso', {
        ticketId: ticket.id,
        customerId,
        companyId,
        email: ticketData.customer_email,
        priority: finalPriority,
        aiAnalyzed,
        operation: 'create_ticket'
      });

      // Responder com o ticket criado
      res.status(201).json(ticket);
      
      // Enviar notificação via WebSocket
      notificationService.sendNotificationToAll({
        type: 'new_ticket',
        title: 'Novo Ticket Criado',
        message: `Novo ticket ${ticket.ticket_id}: ${ticketData.title}`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        priority: finalPriority,
        timestamp: new Date()
      });
      
      // 📧 ENVIAR EMAIL DE CONFIRMAÇÃO PARA O CLIENTE
      try {
        if (customerId && ticketData.customer_email) {
          // Buscar dados completos do cliente
          const customer = await storage.getCustomer(customerId);
          
          if (customer) {
            // 🔥 OTIMIZAÇÃO CRÍTICA: Envio de e-mail fire-and-forget (não bloqueia a resposta)
            emailNotificationService.sendEmailNotification(
              'new_ticket', 
              customer.email, 
              {
                ticket: {
                  id: ticket.id,
                  ticket_id: ticket.ticket_id,
                  title: ticket.title,
                  description: ticket.description,
                  priority: finalPriority,
                  status: ticket.status,
                  created_at: ticket.created_at
                },
                customer: {
                  name: customer.name,
                  email: customer.email,
                  company: customer.company
                },
                system: {
                  base_url: process.env.BASE_URL || 'http://localhost:5000',
                  company_name: 'Sistema de Tickets',
                  support_email: 'suporte@sistema.com'
                }
              },
              companyId || undefined
            ).catch((emailError) => {
              console.error('[Email] Erro ao enviar confirmação para o cliente:', emailError);
            });
            

          }
        }
      } catch (emailError) {
        console.error('[Email] Erro ao enviar confirmação para o cliente:', emailError);
      }
      
      // 📧 ENVIAR EMAIL PARA ADMINS E SUPPORT (fire-and-forget)
      const emailStartTime = Date.now();
      console.log(`📧 [EMAIL BACKGROUND] ========================================`);
      console.log(`📧 [EMAIL BACKGROUND] 🎫 INICIANDO - Novo Ticket`);
      console.log(`📧 [EMAIL BACKGROUND] Ticket: #${ticket.ticket_id} (ID: ${ticket.id})`);
      console.log(`📧 [EMAIL BACKGROUND] Company ID: ${ticket.company_id}`);
      console.log(`📧 [EMAIL BACKGROUND] Customer Email: ${ticket.customer_email}`);
      console.log(`📧 [EMAIL BACKGROUND] Timestamp: ${new Date().toLocaleString('pt-BR')}`);
      console.log(`📧 [EMAIL BACKGROUND] ========================================`);
      
      // Fire-and-forget: não aguarda o envio dos e-mails
      emailNotificationService.notifyNewTicket(ticket.id).then(() => {
        const emailDuration = Date.now() - emailStartTime;
        console.log(`📧 [EMAIL BACKGROUND] ========================================`);
        console.log(`📧 [EMAIL BACKGROUND] ✅ CONCLUÍDO - Novo Ticket em ${emailDuration}ms`);
        console.log(`📧 [EMAIL BACKGROUND] Ticket: #${ticket.ticket_id} - Todos os e-mails processados`);
        console.log(`📧 [EMAIL BACKGROUND] ========================================`);
      }).catch((emailError) => {
        const emailDuration = Date.now() - emailStartTime;
        console.error(`📧 [EMAIL BACKGROUND] ========================================`);
        console.error(`📧 [EMAIL BACKGROUND] ❌ ERRO - Novo Ticket após ${emailDuration}ms`);
        console.error(`📧 [EMAIL BACKGROUND] Ticket: #${ticket.ticket_id} - Erro:`, emailError.message);
        console.error(`📧 [EMAIL BACKGROUND] Stack:`, emailError.stack);
        console.error(`📧 [EMAIL BACKGROUND] ========================================`);
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
  
    // Rota para criar respostas de tickets com análise de IA
  router.post("/ticket-replies", authRequired, validateRequest(insertTicketReplySchema), async (req: Request, res: Response) => {
    try {
      // Importar a função correta que contém a análise de IA
      const { POST: ticketRepliesHandler } = await import('./api/ticket-replies');
      return await ticketRepliesHandler(req, res);
    } catch (error) {
      console.error('Erro ao processar resposta de ticket:', error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });
  
  // Customer endpoints with pagination
  router.get("/customers", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 50 por página por padrão
      const search = (req.query.search as string) || '';
      const includeInactive = req.query.includeInactive === 'true';
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      // Buscar todos os clientes
      const allCustomers = await storage.getCustomers();
      
      // Aplicar filtros de empresa
      let customers = allCustomers;
      
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todas
        if (filterCompanyId) {
          customers = allCustomers.filter(customer => customer.company_id === filterCompanyId);
        }
        // Se filterCompanyId for null, mostra todos
      } else {
        // Usuários não-admin sempre veem apenas sua empresa
        customers = allCustomers.filter(customer => customer.company_id === sessionCompanyId);
      }
      
      // Enriquecer clientes com nome da empresa e status do usuário, sem sobrescrever o campo company original
      const enrichedCustomers = customers.map(customer => ({
        ...customer,
        company_display: customer.company_name || customer.company || '-', // campo auxiliar para exibição
        active: typeof customer.user_active === 'boolean' ? customer.user_active : true
      }));
      
      // Filtrar os clientes inativos se necessário
      let filteredCustomers = includeInactive 
        ? enrichedCustomers 
        : enrichedCustomers.filter(customer => customer.active);
      
      // Aplicar filtro de busca se fornecido
      if (search) {
        const searchLower = search.toLowerCase();
        filteredCustomers = filteredCustomers.filter(customer => 
          customer.name.toLowerCase().includes(searchLower) ||
          customer.email.toLowerCase().includes(searchLower) ||
          (customer.company_display && customer.company_display.toLowerCase().includes(searchLower))
        );
      }
      
      // Ordenação já é feita no banco de dados via DatabaseStorage.getCustomers()
      
      // Calcular paginação
      const total = filteredCustomers.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedCustomers = filteredCustomers.slice(offset, offset + limit);
      
      res.json({
        data: paginatedCustomers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: "Falha ao buscar clientes" });
    }
  });

  // Endpoint específico para buscar clientes no formulário de tickets
  router.get("/customers/search", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      const search = (req.query.q as string) || '';
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;

      // Buscar todos os clientes
      const allCustomers = await storage.getCustomers();
      
      // Filtrar por empresa se necessário
      let customers = allCustomers;
      
      if (userRole === 'admin') {
        // Admin pode especificar empresa ou ver TODOS se não especificar
        const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
        if (filterCompanyId) {
          customers = allCustomers.filter(customer => customer.company_id === filterCompanyId);
        }
        // Admin sem filtro de empresa = ver todos
      } else {
        // Usuários não-admin veem apenas sua empresa
        if (sessionCompanyId) {
          customers = allCustomers.filter(customer => customer.company_id === sessionCompanyId);
        } else {
          customers = [];
        }
      }

      // Filtrar apenas clientes ativos
      customers = customers.filter(customer => customer.active);

      // Aplicar busca se fornecida
      if (search) {
        const searchLower = search.toLowerCase();
        customers = customers.filter(customer =>
          customer.name.toLowerCase().includes(searchLower) ||
          customer.email.toLowerCase().includes(searchLower) ||
          (customer.company && customer.company.toLowerCase().includes(searchLower))
        );
        // Limitar apenas quando há busca específica
        customers = customers.slice(0, 50);
      }

      // Se não há busca, retornar todos os clientes (filtro será feito no frontend)
      const limitedCustomers = customers;

      // Enriquecer dados dos clientes
      const enrichedCustomers = await Promise.all(
        limitedCustomers.map(async (customer) => {
          let userData = null;
          if (customer.user_id) {
            try {
              userData = await storage.getUser(customer.user_id);
            } catch (userError) {
              // Silenciar warning para produção
            }
          }

          return {
            ...customer,
            active: userData ? userData.active : true,
            user: userData ? {
              id: userData.id,
              username: userData.username,
              role: userData.role,
              active: userData.active
            } : null
          };
        })
      );

      res.json(enrichedCustomers);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: "Falha ao buscar clientes" });
    }
  });
  
  router.post("/customers", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      const { email, name, company_id, linkExistingUser } = req.body;
      
      // Garantir que linkExistingUser seja boolean
      const shouldLinkUser = Boolean(linkExistingUser);
      console.log('Cliente - linkExistingUser recebido:', linkExistingUser, 'convertido para:', shouldLinkUser);
      
      // Verificar se já existe cliente com este email
      const existingCustomer = await storage.getCustomerByEmail(email);
      if (existingCustomer) {
        return res.status(400).json({ message: "Email já cadastrado para outro cliente" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser && !shouldLinkUser) {
        // Se o usuário existe mas não foi solicitado para vincular, retornar erro com opção
        console.log(`Cliente - Usuário com email '${email}' já existe. Sugerindo vinculação.`);
        
        const responseData = { 
          message: "Usuário já existe",
          suggestion: "link_existing",
          existingUser: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            username: existingUser.username
          }
        };
        
        console.log('Cliente - Resposta 409 sendo enviada:', JSON.stringify(responseData, null, 2));
        return res.status(409).json(responseData);
      }
      
      if (existingUser && shouldLinkUser) {
        console.log(`Cliente - Vinculando usuário existente (ID: ${existingUser.id}, role: ${existingUser.role}) como cliente`);
        
        // Atualizar o role do usuário para 'customer' ao vincular como cliente
        const updatedUser = await storage.updateUser(existingUser.id, { 
          role: 'customer'
        });
        if (updatedUser) {
          existingUser.role = 'customer';
          console.log(`Cliente - Role do usuário atualizado para 'customer'`);
        }
      } else if (!existingUser && shouldLinkUser) {
        // Se solicitou vincular mas o usuário não existe, retornar erro
        return res.status(404).json({ message: "Usuário não encontrado para vinculação" });
      }
      
      // Determinar company_id efetivo
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      let effectiveCompanyId: number | null = null;
      
      if (userRole === 'admin') {
        // Admin pode especificar qualquer company_id
        effectiveCompanyId = company_id || null;
      } else {
        // Usuários não-admin usam sua própria empresa
        effectiveCompanyId = sessionCompanyId || null;
        if (company_id && company_id !== sessionCompanyId) {
          console.warn(`Usuário ${userRole} tentou especificar company_id ${company_id}, mas será usado o da sessão: ${sessionCompanyId}`);
        }
      }
      
      let user;
      let tempPassword = '';
      
      if (!existingUser) {
        // Usar o e-mail completo como nome de usuário
        const username = email;
        
        // Gerar senha temporária segura
        const { generateSecurePassword, hashPassword } = await import('./utils/password');
        tempPassword = generateSecurePassword();
        
        // Criptografar senha
        const hashedPassword = await hashPassword(tempPassword);
        
        // Criar usuário primeiro com company_id
        user = await storage.createUser({
          username,
          email,
          password: hashedPassword,
          name,
          role: 'customer' as typeof schema.userRoleEnum.enumValues[number],
          company_id: effectiveCompanyId,
        });
      } else {
        // Usar usuário existente
        user = existingUser;
        console.log(`Cliente - Usando usuário existente ID: ${user.id}`);
        
        // Atualizar company_id se necessário e se for admin
        if (userRole === 'admin' && effectiveCompanyId !== user.company_id) {
          console.log(`Cliente - Atualizando company_id do usuário de ${user.company_id} para ${effectiveCompanyId}`);
          const updatedUser = await storage.updateUser(user.id, { company_id: effectiveCompanyId });
          if (updatedUser) {
            user = updatedUser;
          }
        }
      }
      
      // Criar cliente associado ao usuário com company_id
      const customer = await storage.createCustomer({
        ...req.body,
        user_id: user.id,
        company_id: effectiveCompanyId,
      });
      
      // Notificar sobre novo cliente registrado
      try {
        await emailNotificationService.notifyNewCustomerRegistered(customer.id);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo cliente:', notificationError);
        // Não falhar a criação do cliente por causa da notificação
      }
      
      // Retornar o cliente com informações de acesso (apenas para novos usuários)
      if (!existingUser) {
        res.status(201).json({
          ...customer,
          accessInfo: {
            username: user.username,
            temporaryPassword: tempPassword,
            message: "Uma senha temporária foi gerada. Por favor, informe ao cliente para alterá-la no primeiro acesso."
          }
        });
      } else {
        // Para usuários vinculados, não retornar senha
        res.status(201).json({
          ...customer,
          message: "Cliente vinculado com sucesso ao usuário existente."
        });
      }
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ message: "Falha ao criar cliente", error: String(error) });
    }
  });
  
  router.patch("/customers/:id", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
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
  
  router.delete("/customers/:id", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
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

  // Bulk import endpoint for customers - processar na memória
  const csvUpload = multer({ 
    storage: multer.memoryStorage(), // Processar na memória
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não suportado. Use CSV ou Excel.'));
      }
    }
  });

  router.post("/customers/bulk-import", authRequired, adminRequired, csvUpload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      const companyId = parseInt(req.body.company_id);
      if (!companyId || isNaN(companyId)) {
        return res.status(400).json({ message: "ID da empresa é obrigatório" });
      }

      // Processar arquivo da memória
      const fileContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV content
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ message: "Arquivo deve conter pelo menos uma linha de dados além do cabeçalho" });
      }

      const headers = lines[0].split(';').map(h => h.trim());
      const dataLines = lines.slice(1);
      
      // Validate required headers
      const requiredHeaders = ['email', 'name'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Cabeçalhos obrigatórios não encontrados: ${missingHeaders.join(', ')}` 
        });
      }

      const results = {
        success: 0,
        errors: [] as Array<{ row: number; email: string; error: string }>,
        skipped: 0, // Usuários que já existem
        total: dataLines.length
      };

      const { generateSecurePassword, hashPassword } = await import('./utils/password');

      // Process each line
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const values = line.split(';').map(v => v.trim());
        
        try {
          // Create data object from headers and values
          const userData: any = {};
          headers.forEach((header, index) => {
            userData[header] = values[index] || '';
          });

          // Validate required fields
          if (!userData.email || !userData.name) {
            results.errors.push({
              row: i + 2, // +2 porque começamos na linha 2 (header = linha 1)
              email: userData.email || 'N/A',
              error: 'Email e nome são obrigatórios'
            });
            continue;
          }

          // Check if email already exists - SE EXISTIR, IGNORA (não é erro)
          const existingCustomer = await storage.getCustomerByEmail(userData.email);
          if (existingCustomer) {
            results.skipped++;
            continue; // Simplesmente ignora, não conta como erro
          }

          const existingUser = await storage.getUserByEmail(userData.email);
          if (existingUser) {
            results.skipped++;
            continue; // Simplesmente ignora, não conta como erro
          }

          // Use email as username if not provided
          const username = userData.username || userData.email;
          
          // Use provided password or generate one
          const password = userData.password || generateSecurePassword();
          const hashedPassword = await hashPassword(password);

          // Create user
          const user = await storage.createUser({
            username,
            email: userData.email,
            password: hashedPassword,
            name: userData.name,
            role: 'customer' as typeof schema.userRoleEnum.enumValues[number],
            company_id: companyId,
            active: userData.active !== 'false', // Default to true unless explicitly false
            ad_user: userData.ad_user === 'true', // Default to false unless explicitly true
          });

          // Create customer
          await storage.createCustomer({
            name: userData.name,
            email: userData.email,
            phone: userData.phone || '',
            company: '', // Will be filled by company relationship
            user_id: user.id,
            company_id: companyId,
          });

          results.success++;
        } catch (error) {
          results.errors.push({
            row: i + 2,
            email: values[headers.indexOf('email')] || 'N/A',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Erro na importação em lote:', error);
      res.status(500).json({ message: "Erro interno do servidor", error: String(error) });
    }
  });

  // Official endpoints with pagination
  router.get("/officials", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 50 por página para atendentes
      const search = (req.query.search as string) || '';
      const includeInactive = req.query.includeInactive === 'true';
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const filterDepartmentId = req.query.department_id ? parseInt(req.query.department_id as string) : null;
      
      const userRole = req.session?.userRole as string;
      const userId = req.session?.userId;
      const sessionCompanyId = req.session?.companyId;
      
      const allOfficials = await storage.getOfficials();
      
      let officials = allOfficials;
      
      // APLICAR FILTROS DE EMPRESA
      if (userRole === 'admin') {
        // ADMIN: pode filtrar por empresa específica ou ver todos
        if (filterCompanyId) {
          officials = allOfficials.filter(official => official.company_id === filterCompanyId);
        }
        // Se filterCompanyId for null, mostra todos
        officials = includeInactive ? officials : officials.filter(official => official.is_active);
        
      } else if (userRole === 'company_admin' || userRole === 'manager') {
        // COMPANY_ADMIN e MANAGER: VÊM TODOS OS ATENDENTES DA SUA EMPRESA (ignora filterCompanyId)
        officials = allOfficials.filter(official => {
          const sameCompany = official.company_id === sessionCompanyId;
          const isActive = includeInactive || official.is_active;
          return sameCompany && isActive;
        });
      } else if (userRole === 'supervisor') {
        // SUPERVISOR: se enxerga + subordinados (quando tiver)
        if (!sessionCompanyId || !userId) {
          officials = [];
        } else {
          const currentOfficial = allOfficials.find(o => o.user_id === userId);
          
          if (!currentOfficial) {
            officials = [];
          } else {
            // Incluir o próprio supervisor
            let allowedOfficialIds = [currentOfficial.id];
            
            // Incluir subordinados diretos
            const subordinates = allOfficials.filter(o => o.supervisor_id === currentOfficial.id);
            allowedOfficialIds.push(...subordinates.map(s => s.id));
            
            // Filtrar pelos IDs permitidos
            officials = allOfficials.filter(official => {
              const sameCompany = official.company_id === sessionCompanyId;
              const isActive = includeInactive || official.is_active;
              const isAllowed = allowedOfficialIds.includes(official.id);
              
              return sameCompany && isActive && isAllowed;
            });
          }
        }
      } else if (userRole === 'support') {
        // SUPPORT: SÓ SE ENXERGA
        if (!sessionCompanyId || !userId) {
          officials = [];
        } else {
          const currentOfficial = allOfficials.find(o => o.user_id === userId);
          
          if (currentOfficial) {
            const isActive = includeInactive || currentOfficial.is_active;
            officials = isActive ? [currentOfficial] : [];
          } else {
            officials = [];
          }
        }
      } else {
        // TODAS AS OUTRAS ROLES: NÃO VEEM O DROPDOWN (ignora filterCompanyId)
        officials = [];
      }
      
      // APLICAR FILTRO DE DEPARTAMENTO SE FORNECIDO
      if (filterDepartmentId) {
        // Buscar todos os atendentes que pertencem ao departamento especificado
        const officialIds = await db.select({ official_id: schema.officialDepartments.official_id })
          .from(schema.officialDepartments)
          .where(eq(schema.officialDepartments.department_id, filterDepartmentId));
        
        const allowedOfficialIds = officialIds.map(o => o.official_id);
        
        // Filtrar apenas os atendentes que pertencem ao departamento
        officials = officials.filter(official => allowedOfficialIds.includes(official.id));
      }
      
      // Aplicar filtro de busca se fornecido
      if (search) {
        const searchLower = search.toLowerCase();
        officials = officials.filter(official => 
          official.name.toLowerCase().includes(searchLower) ||
          official.email.toLowerCase().includes(searchLower)
        );
      }
      
      // Calcular paginação
      const total = officials.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedOfficials = officials.slice(offset, offset + limit);
      
      res.json({
        data: paginatedOfficials,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Erro ao buscar atendentes:', error);
      res.status(500).json({ message: "Falha ao buscar atendentes", error: String(error) });
    }
  });
  
  router.post("/officials", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      // console.log(`Iniciando criação de atendente com dados:`, JSON.stringify(req.body, null, 2)); // REMOVIDO - dados sensíveis
      const { departments, company_id, ...officialData } = req.body;
      
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
      
      // Determinar company_id efetivo
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      let effectiveCompanyId: number | null = null;
      
      if (userRole === 'admin') {
        // Admin pode especificar qualquer company_id
        effectiveCompanyId = company_id || null;
      } else {
        // Usuários não-admin usam sua própria empresa
        effectiveCompanyId = sessionCompanyId || null;
        if (company_id && company_id !== sessionCompanyId) {
          console.warn(`Usuário ${userRole} tentou especificar company_id ${company_id}, mas será usado o da sessão: ${sessionCompanyId}`);
        }
      }
      
      // Criar atendente primeiro
      const dataWithDepartment = {
        ...officialData,
        department: departmentValue, // Adicionar campo department para compatibilidade
        company_id: effectiveCompanyId, // Aplicar company_id para todos os usuários não-admin
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
          
          // Buscar o ID do departamento pelo nome
          const [dept] = await db.select({ id: schema.departments.id })
            .from(schema.departments)
            .where(eq(schema.departments.name, department));
            
          if (dept) {
            await storage.addOfficialDepartment({
              official_id: official.id,
              department_id: dept.id
            });
          } else {
            console.warn(`Departamento não encontrado: ${department}`);
          }
        }
        
        // Buscar os departamentos reais do banco para retornar nomes corretos
        const officialDepts = await storage.getOfficialDepartments(official.id);
        const departmentIds = officialDepts.map(od => od.department_id);
        let departmentNames: string[] = [];
        if (departmentIds.length > 0) {
          const depts = await db
            .select({ id: schema.departments.id, name: schema.departments.name })
            .from(schema.departments)
            .where(inArray(schema.departments.id, departmentIds));
          const deptMap = new Map(depts.map(d => [d.id, d.name]));
          departmentNames = departmentIds.map(id => deptMap.get(id) || `Dept-${id}`);
        }
        
        // Anexar nomes de departamentos ao resultado
        official.departments = departmentNames;
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
  
  router.patch("/officials/:id", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de atendente inválido" });
      }

      const { departments, password, department, user, company_id, ...officialData } = req.body;
      
      // Verificar se temos pelo menos um departamento
      if (!departments || !Array.isArray(departments) || departments.length === 0) {
        if (!department) { // Se nem department foi fornecido
          return res.status(400).json({ message: "Pelo menos um departamento deve ser selecionado" });
        }
      }
      
      // Verificar permissões para alterar company_id
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      let effectiveCompanyId: number | null = null;
      
      if (userRole === 'admin') {
        // Admin pode especificar qualquer company_id
        effectiveCompanyId = company_id !== undefined ? company_id : null;
      } else {
        // Usuários não-admin não podem alterar company_id, usar o da sessão
        effectiveCompanyId = sessionCompanyId || null;
        if (company_id !== undefined && company_id !== sessionCompanyId) {
          console.warn(`Usuário ${userRole} tentou alterar company_id para ${company_id}, mas será ignorado. Usando company_id da sessão: ${sessionCompanyId}`);
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
        department: departmentValue, // Adicionar department para compatibilidade com a tabela física
        company_id: effectiveCompanyId, // Incluir company_id
      };
      
      // Buscar o atendente para obter o userId associado
      const official = await storage.getOfficial(id);
      if (!official) {
        return res.status(404).json({ message: "Atendente não encontrado" });
      }
      
      // Se recebemos dados do usuário e o atendente tem um usuário associado, atualizá-lo
      if (user && official.user_id) {
        
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
        
        // Incluir company_id no usuário também
        userUpdateData.company_id = effectiveCompanyId;
        
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
          await storage.updateUser(official.user_id, userUpdateData);
        }
      }
      // Se apenas a senha foi fornecida diretamente, atualizar apenas ela
      else if (password && official.user_id) {
        // Criptografar a nova senha
        const { hashPassword } = await import('./utils/password');
        const hashedPassword = await hashPassword(password);
        
        // Atualizar a senha do usuário associado, incluindo company_id
        await storage.updateUser(official.user_id, { 
          password: hashedPassword,
          company_id: effectiveCompanyId
        });
      }
      // Se não há senha mas há company_id para atualizar no usuário
      else if (official.user_id && effectiveCompanyId !== undefined) {
        await storage.updateUser(official.user_id, { 
          company_id: effectiveCompanyId
        });
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
          // Buscar o nome do departamento pelo ID para remover
          const [deptInfo] = await db.select({ name: schema.departments.name })
            .from(schema.departments)
            .where(eq(schema.departments.id, dept.department_id));
            
          if (deptInfo) {
            await storage.removeOfficialDepartment(id, deptInfo.name);
          }
        }
        
        // Adicionar novos departamentos
        for (const department of departments) {
          // Buscar o ID do departamento pelo nome
          const [dept] = await db.select({ id: schema.departments.id })
            .from(schema.departments)
            .where(eq(schema.departments.name, department));
            
          if (dept) {
            await storage.addOfficialDepartment({
              official_id: id,
              department_id: dept.id
            });
          } else {
            console.warn(`Departamento não encontrado: ${department}`);
          }
        }
        
        // Buscar os departamentos reais do banco para retornar nomes corretos
        const officialDepts = await storage.getOfficialDepartments(id);
        const departmentIds = officialDepts.map(od => od.department_id);
        let departmentNames: string[] = [];
        if (departmentIds.length > 0) {
          const depts = await db
            .select({ id: schema.departments.id, name: schema.departments.name })
            .from(schema.departments)
            .where(inArray(schema.departments.id, departmentIds));
          const deptMap = new Map(depts.map(d => [d.id, d.name]));
          departmentNames = departmentIds.map(id => deptMap.get(id) || `Dept-${id}`);
        }
        
        // Anexar nomes de departamentos ao resultado
        updatedOfficial.departments = departmentNames;
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
  router.patch("/officials/:id/toggle-active", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
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
  
  router.delete("/officials/:id", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
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
  router.post("/auth/login", authLimiter, validateSchema(loginSchema), async (req: Request, res: Response) => {
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
      
      // Verificar se o usuário deve trocar a senha no próximo login
      if (user.must_change_password) {
        return res.status(200).json({ 
          must_change_password: true,
          user_id: user.id,
          message: "Você deve alterar sua senha antes de continuar"
        });
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
      // Mapear TODOS os roles válidos para a sessão
      const validRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'triage', 'customer', 'viewer', 'quality', 'integration_bot'];
      if (validRoles.includes(user.role)) {
        req.session.userRole = user.role;
      } else {
        console.warn(`Papel de usuário '${user.role}' não é válido. Roles válidos: ${validRoles.join(', ')}`);
        // Definir como customer por segurança
        req.session.userRole = 'customer';
      }

      if (company) {
        req.session.companyId = company.id;
      }
      
      // Adicionar a informação da empresa ao objeto do usuário para retornar ao cliente
      if (company) {
        // 🎯 BUSCAR O NOME DA EMPRESA DAS CONFIGURAÇÕES DO SISTEMA - SEM FALLBACK!
        const configuredCompanyName = await getSystemSetting('companyName', 'Ticket Wise', company.id);
        console.log('✅ [LOGIN] Nome da empresa das configurações:', configuredCompanyName);
        
        return res.json({
          ...user,
          company: {
            id: company.id,
            name: configuredCompanyName, // 🎯 SEMPRE DAS CONFIGURAÇÕES
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

  // Endpoint para forçar troca de senha no primeiro login
  router.post("/auth/change-forced-password", async (req: Request, res: Response) => {
    try {
      const { user_id, old_password, new_password } = req.body;
      
      if (!user_id || !old_password || !new_password) {
        return res.status(400).json({ 
          message: "ID do usuário, senha atual e nova senha são obrigatórios" 
        });
      }
      
      // Buscar o usuário
      const user = await storage.getUser(user_id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário realmente deve trocar a senha
      if (!user.must_change_password) {
        return res.status(400).json({ 
          message: "Este usuário não precisa trocar a senha" 
        });
      }
      
      // Verificar a senha atual
      const { verifyPassword, hashPassword } = await import('./utils/password');
      const passwordValid = await verifyPassword(old_password, user.password);
      
      if (!passwordValid) {
        return res.status(401).json({ message: "Senha atual incorreta" });
      }
      
      // Verificar se a nova senha não é a padrão
      const DEFAULT_PASSWORD = "123Mudar@!";
      if (new_password === DEFAULT_PASSWORD) {
        return res.status(400).json({ 
          message: "Você não pode usar a senha padrão. Escolha uma senha diferente." 
        });
      }
      
      // Validar critérios da nova senha (pode usar a mesma validação do registro)
      if (new_password.length < 8) {
        return res.status(400).json({ 
          message: "A nova senha deve ter pelo menos 8 caracteres" 
        });
      }
      
      // Criptografar a nova senha
      const hashedNewPassword = await hashPassword(new_password);
      
      // Atualizar a senha e remover a flag de must_change_password
      await db
        .update(schema.users)
        .set({ 
          password: hashedNewPassword,
          must_change_password: false,
          updated_at: new Date()
        })
        .where(eq(schema.users.id, user_id));
      
      // Retornar sucesso
      res.json({ 
        success: true, 
        message: "Senha alterada com sucesso" 
      });
      
    } catch (error) {
      console.error('Erro ao alterar senha forçada:', error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Endpoint para marcar usuários como "deve trocar senha" (para importação em lote)
  router.post("/auth/mark-users-must-change-password", adminRequired, async (req: Request, res: Response) => {
    try {
      const { user_ids } = req.body;
      
      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ 
          message: "Lista de IDs de usuários é obrigatória" 
        });
      }
      
      // Atualizar todos os usuários especificados
      const result = await db
        .update(schema.users)
        .set({ 
          must_change_password: true,
          updated_at: new Date()
        })
        .where(sql`${schema.users.id} IN (${sql.join(user_ids.map((id: number) => sql`${id}`), sql`, `)})`)
        .returning({ id: schema.users.id, username: schema.users.username });
      
      res.json({ 
        success: true, 
        message: `${result.length} usuários marcados para trocar senha`,
        updated_users: result
      });
      
    } catch (error) {
      console.error('Erro ao marcar usuários para trocar senha:', error);
      res.status(500).json({ message: "Erro interno do servidor" });
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
  router.post("/users", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { username, email, password, name, role, avatarUrl, company_id } = req.body;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      console.log(`Tentando criar usuário: ${name}, email: ${email}, username: ${username}, role: ${role}`);
      
      // VALIDAÇÃO CRÍTICA DE SEGURANÇA: Apenas usuários admin podem criar outros admin
      if (role === 'admin' && userRole !== 'admin') {
        console.log(`TENTATIVA DE ESCALAÇÃO DE PRIVILÉGIOS: Usuário com role '${userRole}' tentou criar usuário admin`);
        return res.status(403).json({ 
          message: "Acesso negado: Apenas administradores globais podem criar outros administradores" 
        });
      }
      
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
      
      // Determinar company_id baseado no role do usuário logado
      let finalCompanyId: number | undefined;
      if (userRole === 'admin') {
        // Admin pode especificar qualquer empresa ou deixar sem empresa
        finalCompanyId = company_id || undefined;
      } else {
        // Outros roles só podem criar usuários para sua própria empresa
        finalCompanyId = sessionCompanyId;
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
        company_id: finalCompanyId,
        active: true 
      });
      
      // Notificar sobre novo usuário criado
      try {
        await emailNotificationService.notifyNewUserCreated(user.id, req.session?.userId);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo usuário:', notificationError);
        // Não falhar a criação do usuário por causa da notificação
      }
      
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ message: "Falha ao criar usuário", error: String(error) });
    }
  });
  
  // Endpoint para criar usuário de suporte e atendente em uma única transação atômica
  router.post("/support-users", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    // Importar e chamar o endpoint de criação integrada
    const { hashPassword } = await import('./utils/password');
    const { createSupportUserEndpoint } = await import('./endpoints/create-support-user');
    await createSupportUserEndpoint(req, res, storage, hashPassword);
  });
  
  // Endpoint para atualizar informações do usuário
  router.patch("/users/:id", authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      const { name, email, username, password, role } = req.body;
      const userRole = req.session?.userRole as string;
      
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // VALIDAÇÃO DE HIERARQUIA: Verificar se o usuário pode alterar o role
      if (role && !canManageUserRole(userRole, role)) {
        console.log(`TENTATIVA DE ESCALAÇÃO DE PRIVILÉGIOS: Usuário com role '${userRole}' tentou alterar usuário ${id} para '${role}'`);
        return res.status(403).json({ 
          message: `Acesso negado: Seu nível de permissão (${userRole}) não permite definir o role '${role}'` 
        });
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
      if (role) updateData.role = role;
      if (hashedPassword) updateData.password = hashedPassword;
      updateData.updated_at = new Date();
      
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
  router.patch("/users/:id/toggle-active", authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support']), async (req: Request, res: Response) => {
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

  // Endpoint para listar todos os usuários com paginação (todos os atendentes)
  router.get("/users", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support']), async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 50 por página por padrão
      const search = (req.query.search as string) || '';
      const includeInactive = req.query.includeInactive === 'true';
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session?.companyId;
      
      // Buscar usuários
      const allUsers = includeInactive ? 
        await storage.getAllUsers() : 
        await storage.getActiveUsers();
      
      // Aplicar filtros de empresa
      let filteredUsers = allUsers;
      
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todos
        if (filterCompanyId) {
          filteredUsers = allUsers.filter(user => user.company_id === filterCompanyId);
        }
        // Se filterCompanyId for null, mostra todos
      } else {
        // Usuários não-admin sempre veem apenas sua empresa
        filteredUsers = allUsers.filter(user => user.company_id === sessionCompanyId);
      }
      
      // Aplicar filtro de busca se fornecido
      if (search) {
        const searchLower = search.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.username.toLowerCase().includes(searchLower) ||
          user.role.toLowerCase().includes(searchLower)
        );
      }
      
      // Ordenação já é feita no banco de dados via DatabaseStorage.getActiveUsers()/getAllUsers()
      
      // Não retornar as senhas
      const usersWithoutPasswords = filteredUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      // Calcular paginação
      const total = usersWithoutPasswords.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedUsers = usersWithoutPasswords.slice(offset, offset + limit);
      
      res.json({
        data: paginatedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
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
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário está ativo
      if (!user.active) {
        return res.status(403).json({ message: "Usuário inativo" });
      }
      
      // Se o usuário tem uma empresa associada, buscar os dados da empresa
      if (req.session.companyId) {
        const companyData = await storage.getCompany(req.session.companyId);
        
        if (companyData) {
          // 🎯 BUSCAR O NOME DA EMPRESA DAS CONFIGURAÇÕES DO SISTEMA - SEM FALLBACK!
          const configuredCompanyName = await getSystemSetting('companyName', 'Ticket Wise', req.session.companyId);
          
          const userWithCompany = {
            ...user,
            company_id: req.session.companyId, // Adicionar company_id explicitamente
            company: { // Apenas campos existentes no schema.companies + nome configurado
              id: companyData.id,
              name: configuredCompanyName, // 🎯 SEMPRE DAS CONFIGURAÇÕES
              email: companyData.email,
              domain: companyData.domain || '',
              active: companyData.active,
              cnpj: companyData.cnpj || '',
              phone: companyData.phone || ''
            }
          };
          
          return res.json(userWithCompany);
        } else {
          return res.json(user);
        }
      } else {
        return res.json(user);
      }
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
  
  // Rotas para configurações do sistema
  // Configurações gerais
  router.get("/settings/general", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      
      // Buscar configurações do sistema para a empresa específica
      const companyName = await getSystemSetting('companyName', 'Ticket Lead', companyId);
      const supportEmail = await getSystemSetting('supportEmail', 'suporte@ticketlead.exemplo', companyId);
      const allowCustomerRegistration = await getSystemSetting('allowCustomerRegistration', 'true', companyId);
      
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
  
  router.post("/settings/general", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { companyName, supportEmail, allowCustomerRegistration } = req.body;
      const companyId = req.session.companyId;
      
      // Salvar configurações para a empresa específica
      await saveSystemSetting('companyName', companyName, companyId);
      await saveSystemSetting('supportEmail', supportEmail, companyId);
      await saveSystemSetting('allowCustomerRegistration', allowCustomerRegistration.toString(), companyId);
      
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
  router.get("/settings/departments", authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
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
  
  router.post("/settings/departments", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
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
  
  // Rota para usuários obterem tipos de incidentes com paginação
  router.get("/incident-types", authRequired, async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 50 por página por padrão
      const search = (req.query.search as string) || '';
      const active_only = req.query.active_only === "true";
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const department_id = req.query.department_id ? parseInt(req.query.department_id as string) : null;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;

      // Verificar se o usuário tem uma empresa associada (exceto admin)
      if (!sessionCompanyId && userRole !== 'admin') {
        return res.status(400).json({ message: "Usuário sem empresa associada" });
      }

      const conditions: SQLWrapper[] = [];

      // Lógica de filtro por empresa
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todas
        if (filterCompanyId) {
          conditions.push(eq(schema.incidentTypes.company_id, filterCompanyId));
        }
        // Se filterCompanyId for null, mostra todos
      } else {
        // Usuários não-admin veem sua empresa + globais (company_id IS NULL)
        if (sessionCompanyId) {
          conditions.push(
            or(
              isNull(schema.incidentTypes.company_id),
              eq(schema.incidentTypes.company_id, sessionCompanyId)
            )
          );
        }
      }

      if (active_only) {
        conditions.push(eq(schema.incidentTypes.is_active, true));
      }

      if (department_id) {
        conditions.push(eq(schema.incidentTypes.department_id, department_id));
      }

      // Filtro por busca (nome ou descrição)
      if (search) {
        const searchCondition = or(
          ilike(schema.incidentTypes.name, `%${search}%`),
          ilike(schema.incidentTypes.description, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Contar total de registros com filtros aplicados
      let countQuery = db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.incidentTypes);

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }

      const [{ count: totalCount }] = await countQuery;

      // Calcular offset para paginação
      const offset = (page - 1) * limit;

      // Se for admin, incluir informações da empresa
      if (userRole === 'admin') {
        const incidentTypes = await db.query.incidentTypes.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [asc(schema.incidentTypes.name)], // Ordenação alfabética
          limit: limit,
          offset: offset,
          with: {
            company: {
              columns: {
                id: true,
                name: true,
              }
            }
          }
        });
        
        const totalPages = Math.ceil(totalCount / limit);
        
        return res.json({
          incidentTypes: incidentTypes,
          pagination: {
            current: page,
            pages: totalPages,
            total: totalCount,
            limit: limit
          }
        });
      } else {
        // Para outros usuários, buscar sem informações da empresa
        let queryBuilder = db
          .select()
          .from(schema.incidentTypes);

        if (conditions.length > 0) {
          queryBuilder = queryBuilder.where(and(...conditions)) as typeof queryBuilder;
        }

        const incidentTypes = await queryBuilder
          .orderBy(asc(schema.incidentTypes.name)) // Ordenação alfabética
          .limit(limit)
          .offset(offset);
        
        const totalPages = Math.ceil(totalCount / limit);
        
        return res.json({
          incidentTypes: incidentTypes,
          pagination: {
            current: page,
            pages: totalPages,
            total: totalCount,
            limit: limit
          }
        });
      }
    } catch (error) {
      console.error('Erro ao obter tipos de incidentes para usuário:', error);
      res.status(500).json({ message: "Falha ao buscar tipos de incidentes", error: String(error) });
    }
  });
  
  // Rota para criar um novo Tipo de Chamado (Incident Type)
  router.post(
    "/incident-types",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const { name, value, description, department_id, company_id: company_id_from_body, is_active } = req.body;
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        let effectiveCompanyId: number | null = null; // Default para NULL (global) se admin não especificar

        if (userRole === 'admin') {
          if (company_id_from_body !== undefined) { // Admin pode explicitamente setar company_id ou null
            effectiveCompanyId = company_id_from_body;
          }
          // Se company_id_from_body for undefined, effectiveCompanyId permanece null (global)
        } else if (userRole === 'company_admin') {
          // Company_admin só pode criar tipos de chamado para sua própria empresa
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company_admin não possui uma empresa associada na sessão." });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn("Company_admin tentou especificar um company_id diferente do seu na criação do tipo de chamado. Ação ignorada, usando o company_id da sessão.");
          }
        } else if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager não possui uma empresa associada na sessão." });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn("Manager tentou especificar um company_id diferente do seu na criação do tipo de chamado. Ação ignorada, usando o company_id da sessão.");
          }
        } else if (userRole === 'supervisor') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Supervisor não possui uma empresa associada na sessão." });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn("Supervisor tentou especificar um company_id diferente do seu na criação do tipo de chamado. Ação ignorada, usando o company_id da sessão.");
          }
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }

        if (!name || !value) {
          return res.status(400).json({ message: "Nome e Valor do tipo de chamado são obrigatórios." });
        }
        if (department_id === undefined) {
            return res.status(400).json({ message: "Department ID é obrigatório." });
        }
        
        // Opcional: Verificar se o department_id fornecido pertence à effectiveCompanyId (se não for global)
        if (effectiveCompanyId !== null && department_id) {
            const [department] = await db.select().from(departmentsSchema).where(and(eq(departmentsSchema.id, department_id), eq(departmentsSchema.company_id, effectiveCompanyId)));
            if(!department){
                return res.status(400).json({ message: `Departamento ID ${department_id} não encontrado ou não pertence à empresa ID ${effectiveCompanyId}.` });
            }
        }


        // Verificar duplicidade (nome + company_id) ou (nome + global)
        const existingConditions: SQLWrapper[] = [eq(schema.incidentTypes.name, name)];
        if (effectiveCompanyId === null) {
          existingConditions.push(isNull(schema.incidentTypes.company_id));
        } else {
          existingConditions.push(eq(schema.incidentTypes.company_id, effectiveCompanyId));
        }
        const [existingIncidentType] = await db.select().from(schema.incidentTypes).where(and(...existingConditions));

        if (existingIncidentType) {
          return res.status(409).json({ message: `Já existe um tipo de chamado com o nome "${name}" ${effectiveCompanyId === null ? 'globalmente' : 'nesta empresa'}.` });
        }

        const newIncidentType = await db
          .insert(schema.incidentTypes)
          .values({
            name,
            value,
            description: description || null,
            department_id,
            company_id: effectiveCompanyId,
            is_active: is_active !== undefined ? is_active : true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();
        res.status(201).json(newIncidentType[0]);
      } catch (error: any) {
        console.error("Error creating incident type:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        // Tratar erro de chave duplicada de PK
        if (error && error.code === '23505' && error.constraint === 'incident_types_pkey') {
          console.warn("Tentativa de inserir incident_type com ID duplicado. Rejeitar solicitação.");
          return res.status(409).json({ message: "Tipo de incidente já existe com este ID. Tente novamente." });
        }
        // Tratar erro de FK para department_id, se aplicável (embora já tenhamos checado)
        if (error && error.code === '23503' && error.constraint && error.constraint.includes('incident_types_department_id_fkey')) {
            return res.status(400).json({ message: "Department ID inválido ou não existente."});
        }
        res.status(500).json({ message: "Failed to create incident type" });
      }
    }
  );

  // Rota para usuários não-admin obterem departamentos com paginação
  router.get("/departments", authRequired, async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // 50 por página por padrão
      const search = (req.query.search as string) || '';
      const active_only = req.query.active_only === "true";
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const userRole = req.session?.userRole as string;
      const userId = req.session?.userId;
      const sessionCompanyId = req.session.companyId;

      const conditions: SQLWrapper[] = [];

      // Lógica de filtro por empresa E por departamentos específicos do usuário
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todas
        if (filterCompanyId) {
          conditions.push(eq(departmentsSchema.company_id, filterCompanyId));
        }
        // Se filterCompanyId for null, mostra todos
      } else if (userRole === 'company_admin' || userRole === 'manager') {
        // Company Admin e Manager veem todos os departamentos da sua empresa
        if (sessionCompanyId) {
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
        } else {
          return res.status(403).json({ message: "Acesso negado: ID da empresa não encontrado na sessão." });
        }
      } else if (userRole === 'supervisor' || userRole === 'support') {
        // 🆕 NOVA LÓGICA: Support/Supervisor veem APENAS seus departamentos
        if (!sessionCompanyId || !userId) {
          return res.status(403).json({ message: "Acesso negado: ID da empresa ou usuário não encontrado na sessão." });
        }

        // Buscar o official do usuário
        const [official] = await db
          .select()
          .from(schema.officials)
          .where(eq(schema.officials.user_id, userId))
          .limit(1);

        if (!official) {
          return res.status(403).json({ message: "Usuário não é um atendente." });
        }

        // Buscar departamentos do usuário
        const userDepartments = await db
          .select({ department_id: schema.officialDepartments.department_id })
          .from(schema.officialDepartments)
          .where(eq(schema.officialDepartments.official_id, official.id));

        if (userDepartments.length === 0) {
          // Se o usuário não tem departamentos, retornar lista vazia
          return res.json({
            departments: [],
            pagination: {
              current: page,
              pages: 0,
              total: 0,
              limit: limit
            }
          });
        }

        let allowedDepartmentIds = userDepartments.map(d => d.department_id).filter(id => id !== null);

        // Se for supervisor, também incluir departamentos dos subordinados
        if (userRole === 'supervisor') {
          const subordinates = await db
            .select({ id: schema.officials.id })
            .from(schema.officials)
            .where(eq(schema.officials.supervisor_id, official.id));

          for (const subordinate of subordinates) {
            const subordinateDepartments = await db
              .select({ department_id: schema.officialDepartments.department_id })
              .from(schema.officialDepartments)
              .where(eq(schema.officialDepartments.official_id, subordinate.id));
            
            // Adicionar departamentos dos subordinados que ainda não estão na lista
            subordinateDepartments.forEach(dept => {
              if (dept.department_id && !allowedDepartmentIds.includes(dept.department_id)) {
                allowedDepartmentIds.push(dept.department_id);
              }
            });
          }
        }

        if (allowedDepartmentIds.length === 0) {
          // Se não tem IDs de departamentos, retornar lista vazia
          return res.json({
            departments: [],
            pagination: {
              current: page,
              pages: 0,
              total: 0,
              limit: limit
            }
          });
        }

        // Filtrar apenas pelos departamentos do usuário + empresa
        conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
        if (allowedDepartmentIds.length > 0) {
          conditions.push(inArray(departmentsSchema.id, allowedDepartmentIds));
        }
      } else {
        // Usuários não-admin sempre veem apenas sua empresa (fallback)
        if (sessionCompanyId) {
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
        } else {
          return res.status(403).json({ message: "Acesso negado: ID da empresa não encontrado na sessão." });
        }
      }

      if (active_only) {
        conditions.push(eq(departmentsSchema.is_active, true));
      }

      // Filtro por busca (nome ou descrição)
      if (search) {
        const searchCondition = or(
          ilike(departmentsSchema.name, `%${search}%`),
          ilike(departmentsSchema.description, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Contar total de registros com filtros aplicados
      let countQuery = db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(departmentsSchema);

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }

      const [{ count: totalCount }] = await countQuery;

      // Calcular offset para paginação
      const offset = (page - 1) * limit;

      // Se for admin, incluir informações da empresa
      if (userRole === 'admin') {
        const departments = await db.query.departments.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [asc(departmentsSchema.name)], // Ordenação alfabética
          limit: limit,
          offset: offset,
          with: {
            company: {
              columns: {
                id: true,
                name: true,
              }
            }
          }
        });
        
        const totalPages = Math.ceil(totalCount / limit);
        
        res.json({
          departments,
          pagination: {
            current: page,
            pages: totalPages,
            total: totalCount,
            limit: limit
          }
        });
      } else {
        // Para outros usuários, buscar sem informações da empresa
        let queryBuilder = db
          .select()
          .from(departmentsSchema);

        if (conditions.length > 0) {
          queryBuilder = queryBuilder.where(and(...conditions)) as typeof queryBuilder;
        }

        const departments = await queryBuilder
          .orderBy(asc(departmentsSchema.name)) // Ordenação alfabética
          .limit(limit)
          .offset(offset);
        
        const totalPages = Math.ceil(totalCount / limit);
        
        res.json({
          departments,
          pagination: {
            current: page,
            pages: totalPages,
            total: totalCount,
            limit: limit
          }
        });
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  // Rota para buscar um único departamento pelo ID
  router.get(
    "/departments/:id",
    authRequired,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const company_id = req.session.companyId;
        if (!company_id) {
          return res.status(400).json({ message: "Company ID is required" });
        }

        const department = await db
          .select()
          .from(departmentsSchema)
          .where(
            and(
              eq(departmentsSchema.id, parseInt(id, 10)),
              eq(departmentsSchema.company_id, company_id)
            )
          )
          .limit(1);

        if (department.length === 0) {
          return res.status(404).json({ message: "Department not found" });
        }
        res.json(department[0]);
      } catch (error) {
        console.error("Error fetching department:", error);
        res.status(500).json({ message: "Failed to fetch department" });
      }
    }
  );

  // Rota para criar um novo departamento
  router.post(
    "/departments",
    authRequired,
    authorize(['admin', 'company_admin', 'manager']), 
    async (req: Request, res: Response) => {
      try {
        const { name, description, is_active, company_id: company_id_from_body } = req.body;
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        let effectiveCompanyId: number;

        if (userRole === 'admin') {
          if (company_id_from_body === undefined || company_id_from_body === null) {
            return res.status(400).json({ message: "Para administradores, o campo company_id é obrigatório no corpo da requisição ao criar um departamento." });
          }
          // TODO: Validar se a company_id_from_body existe na tabela companies
          effectiveCompanyId = company_id_from_body;
        } else if (userRole === 'company_admin') {
          // Company_admin só pode criar departamentos para sua própria empresa
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company_admin não possui uma empresa associada na sessão." });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn("Company_admin tentou especificar um company_id diferente do seu na criação do departamento. Ação ignorada, usando o company_id da sessão.");
          }
        } else if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager não possui uma empresa associada na sessão." });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn("Manager tentou especificar um company_id diferente do seu na criação do departamento. Ação ignorada, usando o company_id da sessão.");
          }
        } else {
          // Este caso não deve ser alcançado devido ao middleware authorize
          return res.status(403).json({ message: "Acesso negado." });
        }

        if (!name) {
          return res.status(400).json({ message: "Nome do departamento é obrigatório." });
        }

        // Verificar se já existe um departamento com o mesmo nome na mesma empresa
        const [existingDepartment] = await db
          .select()
          .from(departmentsSchema)
          .where(and(
            eq(departmentsSchema.name, name),
            eq(departmentsSchema.company_id, effectiveCompanyId)
          ));
        
        if (existingDepartment) {
          return res.status(409).json({ message: `Já existe um departamento com o nome "${name}" nesta empresa.` });
        }

        const newDepartment = await db
          .insert(departmentsSchema)
          .values({
            name,
            description,
            company_id: effectiveCompanyId,
            is_active: is_active !== undefined ? is_active : true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();
        res.status(201).json(newDepartment[0]);
      } catch (error) {
        console.error("Error creating department:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: error.errors,
          });
        }
        res.status(500).json({ message: "Failed to create department" });
      }
    }
  );

  // Rota para atualizar um departamento existente
  router.put(
    "/departments/:id",
    authRequired,
    authorize(['admin', 'company_admin', 'manager']), // Papéis que podem acessar a rota
    async (req: Request, res: Response) => {
      try {
        const departmentIdParam = parseInt(req.params.id, 10);
        if (isNaN(departmentIdParam)) {
          return res.status(400).json({ message: "ID de departamento inválido." });
        }

        const { name, description, is_active, company_id: new_company_id } = req.body; // Captura company_id do corpo
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        const updatePayload: any = { updated_at: new Date() };

        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        if (is_active !== undefined) updatePayload.is_active = is_active;

        const conditions: SQLWrapper[] = [eq(departmentsSchema.id, departmentIdParam)];

        if (userRole === 'admin') {
          // Admin pode tentar mudar o company_id do departamento
          if (new_company_id !== undefined) {
            updatePayload.company_id = new_company_id;
          }
          // Nenhuma condição de company_id no WHERE para admin, ele pode editar qualquer depto pelo ID.
        } else if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager deve ter um ID de empresa na sessão." });
          }
          // Manager só pode editar departamentos da sua própria empresa.
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
          // Manager não pode mudar o company_id do departamento.
          if (new_company_id !== undefined) {
            console.warn("Manager tentou alterar company_id do departamento. Esta ação foi ignorada.");
          }
        } else if (userRole === 'company_admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company_admin deve ter um ID de empresa na sessão." });
          }
          // Company_admin só pode editar departamentos da sua própria empresa.
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
          // Company_admin não pode mudar o company_id do departamento.
          if (new_company_id !== undefined) {
            console.warn("Company_admin tentou alterar company_id do departamento. Esta ação foi ignorada.");
          }
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }

        const updatedDepartment = await db
          .update(departmentsSchema)
          .set(updatePayload)
          .where(and(...conditions))
          .returning();

        if (updatedDepartment.length === 0) {
          return res
            .status(404)
            .json({ message: "Departamento não encontrado ou não autorizado para esta operação." });
        }
        res.json(updatedDepartment[0]);
      } catch (error) {
        console.error("Error updating department:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: error.errors,
          });
        }
        res.status(500).json({ message: "Failed to update department" });
      }
    }
  );

  // Rota para excluir um departamento
  router.delete(
    "/departments/:id",
    authRequired,
    authorize(['admin', 'manager', 'company_admin']), // Incluir company_admin
    async (req: Request, res: Response) => {
      try {
        const departmentIdParam = parseInt(req.params.id, 10);
        if (isNaN(departmentIdParam)) {
          return res.status(400).json({ message: "ID de departamento inválido." });
        }

        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        // Primeiro, verificar se o departamento existe e a qual empresa pertence
        const [departmentToDelete] = await db
          .select({ id: departmentsSchema.id, company_id: departmentsSchema.company_id, name: departmentsSchema.name })
          .from(departmentsSchema)
          .where(eq(departmentsSchema.id, departmentIdParam));

        if (!departmentToDelete) {
          return res.status(404).json({ message: "Departamento não encontrado." });
        }

        const conditions: SQLWrapper[] = [eq(departmentsSchema.id, departmentIdParam)];

        if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager deve ter um ID de empresa na sessão para excluir departamentos." });
          }
          // Manager só pode excluir departamentos da sua empresa
          if (departmentToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Manager não tem permissão para excluir este departamento." });
          }
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
        } else if (userRole === 'company_admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company_admin deve ter um ID de empresa na sessão para excluir departamentos." });
          }
          // Company_admin só pode excluir departamentos da sua empresa
          if (departmentToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Company_admin não tem permissão para excluir este departamento." });
          }
          conditions.push(eq(departmentsSchema.company_id, sessionCompanyId));
        } else if (userRole === 'admin') {
          // Admin pode excluir departamento de qualquer empresa, a condição é apenas o ID do departamento.
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }

        // Verificar vínculos antes de deletar
        const [ticketLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                       .from(schema.tickets)
                                       .where(eq(schema.tickets.department_id, departmentIdParam));
        if(ticketLink && ticketLink.count > 0) {
            return res.status(400).json({ 
              message: `Departamento não pode ser excluído pois está vinculado a ${ticketLink.count} chamado(s).` 
            });
        }

        // Verificar vínculos com tipos de incidente
        const [incidentTypeLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                           .from(schema.incidentTypes)
                                           .where(eq(schema.incidentTypes.department_id, departmentIdParam));
        if(incidentTypeLink && incidentTypeLink.count > 0) {
            return res.status(400).json({ 
              message: `Departamento não pode ser excluído pois está vinculado a ${incidentTypeLink.count} tipo(s) de chamado.` 
            });
        }

        // Verificar vínculos com oficial_departments
        const [officialDepartmentLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                                 .from(schema.officialDepartments)
                                                 .where(eq(schema.officialDepartments.department_id, departmentIdParam));
        if(officialDepartmentLink && officialDepartmentLink.count > 0) {
            return res.status(400).json({ 
              message: `Departamento não pode ser excluído pois está vinculado a ${officialDepartmentLink.count} oficial(is).` 
            });
        }

        // Verificar vínculos com categorias
        const [categoryLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                      .from(schema.categories)
                                      .where(eq(schema.categories.department_id, departmentIdParam));
        if(categoryLink && categoryLink.count > 0) {
            return res.status(400).json({ 
              message: `Departamento não pode ser excluído pois está vinculado a ${categoryLink.count} categoria(s).` 
            });
        }

        const deleteResult = await db
          .delete(departmentsSchema)
          .where(and(...conditions))
          .returning(); // Para saber se algo foi realmente deletado

        if (deleteResult.length === 0) {
          return res
            .status(404)
            .json({ message: "Departamento não encontrado ou não autorizado para exclusão." });
        }

        res.status(200).json({ message: "Departamento excluído com sucesso." });
      } catch (error: any) {
        console.error("Error deleting department:", error);
        
        // Verificar se o erro é por violação de FK
        if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
          // Identificar qual tabela causou a violação de FK
          const constraint = error.constraint || '';
          let specificMessage = "Departamento não pode ser excluído pois possui vínculos existentes.";
          
          if (constraint.includes('tickets')) {
            specificMessage = "Departamento não pode ser excluído pois possui chamados vinculados.";
          } else if (constraint.includes('incident_types')) {
            specificMessage = "Departamento não pode ser excluído pois possui tipos de chamado vinculados.";
          } else if (constraint.includes('official_departments')) {
            specificMessage = "Departamento não pode ser excluído pois possui oficiais vinculados.";
          } else if (constraint.includes('categories')) {
            specificMessage = "Departamento não pode ser excluído pois possui categorias vinculadas.";
          }
          
          return res.status(400).json({ message: specificMessage });
        }
        
        // Outros tipos de erro
        if (error && typeof error === 'object' && 'message' in error) {
          return res.status(500).json({ 
            message: "Erro ao excluir departamento",
            details: error.message 
          });
        }
        
        res.status(500).json({ 
          message: "Erro interno ao excluir departamento. Tente novamente mais tarde." 
        });
      }
    }
  );

  // --- ROTAS DE EMPRESAS ---
  router.get("/companies", authRequired, adminRequired, async (req: Request, res: Response) => {
    console.log('[/API/COMPANIES] Session no início da rota:', JSON.stringify(req.session)); // Mantendo o log original dos middlewares
    try {
        // Verificar conexão com o banco
        const testConnection = await db.select().from(schema.companies).limit(1);
        
        // Buscar todas as empresas
        const companies = await db.select().from(schema.companies).orderBy(desc(schema.companies.id));
        
        res.json(companies);
    } catch (error) {
        console.error("[ERROR] Erro completo ao buscar empresas:", error);
        res.status(500).json({ 
            message: "Erro interno ao buscar empresas",
            error: error instanceof Error ? error.message : String(error)
        });
    }
  });

  // Criar nova empresa
  router.post("/companies", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { name, email, domain, cnpj, phone, active = true } = req.body;

      // Validações básicas
      if (!name || !email) {
        return res.status(400).json({ message: "Nome e email são obrigatórios" });
      }

      // Verificar se já existe empresa com este CNPJ
      if (cnpj) {
        const [existingCompany] = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.cnpj, cnpj));

        if (existingCompany) {
          return res.status(409).json({ message: "Já existe uma empresa com este CNPJ" });
        }
      }

      // Criar nova empresa
      const [newCompany] = await db
        .insert(schema.companies)
        .values({
          name,
          email,
          domain: domain || null,
          cnpj: cnpj || null,
          phone: phone || null,
          active: active === false ? false : true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      res.status(201).json(newCompany);
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      res.status(500).json({ message: "Erro interno ao criar empresa" });
    }
  });

  // Atualizar empresa existente
  router.put("/companies/:id", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "ID da empresa inválido" });
      }

      const { name, email, domain, cnpj, phone, active } = req.body;

      // Verificar se a empresa existe
      const [existingCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId));

      if (!existingCompany) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      // Verificar se já existe outra empresa com este CNPJ
      if (cnpj && cnpj !== existingCompany.cnpj) {
        const [duplicateCnpj] = await db
          .select()
          .from(schema.companies)
          .where(and(
            eq(schema.companies.cnpj, cnpj),
            ne(schema.companies.id, companyId)
          ));

        if (duplicateCnpj) {
          return res.status(409).json({ message: "Já existe outra empresa com este CNPJ" });
        }
      }

      // Montar objeto de atualização
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (domain !== undefined) updateData.domain = domain;
      if (cnpj !== undefined) updateData.cnpj = cnpj;
      if (phone !== undefined) updateData.phone = phone;
      if (active !== undefined) updateData.active = active;
      updateData.updated_at = new Date();

      // Atualizar empresa
      const [updatedCompany] = await db
        .update(schema.companies)
        .set(updateData)
        .where(eq(schema.companies.id, companyId))
        .returning();

      res.json(updatedCompany);
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      res.status(500).json({ message: "Erro interno ao atualizar empresa" });
    }
  });

  // Alternar status da empresa (ativar/desativar)
  router.put("/companies/:id/toggle-status", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "ID da empresa inválido" });
      }

      // Obter empresa atual
      const [existingCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId));

      if (!existingCompany) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      // Inverter status
      const newStatus = !existingCompany.active;

      // Atualizar status
      const [updatedCompany] = await db
        .update(schema.companies)
        .set({
          active: newStatus,
          updated_at: new Date()
        })
        .where(eq(schema.companies.id, companyId))
        .returning();

      res.json(updatedCompany);
    } catch (error) {
      console.error("Erro ao alterar status da empresa:", error);
      res.status(500).json({ message: "Erro interno ao alterar status da empresa" });
    }
  });

  // Rota para atualizar um Tipo de Chamado (Incident Type) existente
  router.put(
    "/incident-types/:id",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const incidentTypeId = parseInt(req.params.id, 10);
        if (isNaN(incidentTypeId)) {
          return res.status(400).json({ message: "ID de tipo de chamado inválido." });
        }

        const { name, value, description, department_id, company_id: new_company_id_from_body, is_active } = req.body;
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId; // This is number | undefined

        const updatePayload: any = { updated_at: new Date() };
        if (name !== undefined) updatePayload.name = name;
        if (value !== undefined) updatePayload.value = value;
        if (description !== undefined) updatePayload.description = description;
        if (department_id !== undefined) updatePayload.department_id = department_id;
        if (is_active !== undefined) updatePayload.is_active = is_active;

        const conditions: SQLWrapper[] = [eq(schema.incidentTypes.id, incidentTypeId)];
        
        // Fetch the current incident type to know its original company_id
        const [currentIncidentType] = await db
          .select({ id: schema.incidentTypes.id, company_id: schema.incidentTypes.company_id })
          .from(schema.incidentTypes)
          .where(eq(schema.incidentTypes.id, incidentTypeId));

        if (!currentIncidentType) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado." });
        }

        let effectiveCompanyIdForUpdateLogic: number | null; // This will be number or null for logic checks

        if (userRole === 'admin') {
          if (new_company_id_from_body !== undefined) { // Admin explicitly wants to change company_id
            updatePayload.company_id = new_company_id_from_body; // Can be number or null
            effectiveCompanyIdForUpdateLogic = new_company_id_from_body;
          } else {
            // Admin is not changing company_id, so use the original one for logic checks
            effectiveCompanyIdForUpdateLogic = currentIncidentType.company_id;
          }
          // Admin can edit any incident type, so `conditions` only has the ID check.
        } else if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager deve ter um ID de empresa na sessão." });
          }
          // Manager can edit types belonging to their company OR global types.
          if (currentIncidentType.company_id !== null && currentIncidentType.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Manager não pode editar este tipo de chamado específico da empresa." });
          }
          // Add condition to ensure manager only updates their own company's types or global ones
          const managerCondition = or(
              isNull(schema.incidentTypes.company_id), 
              eq(schema.incidentTypes.company_id, sessionCompanyId)
          );
          if (managerCondition) { // Check if or() returned a valid SQLWrapper
            conditions.push(managerCondition);
          } else {
            // This case should ideally not happen if `or` is always given valid conditions
            console.error("Error generating manager condition for incident type update");
            return res.status(500).json({ message: "Erro interno ao processar permissões." });
          }
          
          // Manager cannot change company_id. If sent in body, it's ignored.
          if (new_company_id_from_body !== undefined && new_company_id_from_body !== currentIncidentType.company_id) {
            console.warn("Manager tentou alterar company_id do tipo de chamado. Esta ação foi ignorada. O company_id original será mantido.");
          }
          effectiveCompanyIdForUpdateLogic = currentIncidentType.company_id; // Use original for department/name checks
          // updatePayload.company_id is NOT set for manager, so it remains unchanged.
        } else if (userRole === 'company_admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company Admin não está associado a nenhuma empresa." });
          }
          effectiveCompanyIdForUpdateLogic = sessionCompanyId; // Company Admin sempre usa o seu companyId da sessão
        } else if (userRole === 'supervisor') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Supervisor deve ter um ID de empresa na sessão." });
          }
          // Supervisor pode editar tipos pertencentes à sua empresa OU tipos globais.
          if (currentIncidentType.company_id !== null && currentIncidentType.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Supervisor não pode editar este tipo de chamado específico da empresa." });
          }
          // Adicionar condição para garantir que supervisor só atualize tipos da sua empresa ou globais
          const supervisorCondition = or(
              isNull(schema.incidentTypes.company_id), 
              eq(schema.incidentTypes.company_id, sessionCompanyId)
          );
          if (supervisorCondition) {
            conditions.push(supervisorCondition);
          } else {
            console.error("Error generating supervisor condition for incident type update");
            return res.status(500).json({ message: "Erro interno ao processar permissões." });
          }
          
          // Supervisor não pode alterar company_id. Se enviado no body, é ignorado.
          if (new_company_id_from_body !== undefined && new_company_id_from_body !== currentIncidentType.company_id) {
            console.warn("Supervisor tentou alterar company_id do tipo de chamado. Esta ação foi ignorada. O company_id original será mantido.");
          }
          effectiveCompanyIdForUpdateLogic = currentIncidentType.company_id; // Usar original para verificações de departamento/nome
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }
        
        // Validação do department_id
        if (department_id !== undefined) {
          if (effectiveCompanyIdForUpdateLogic !== null) { // Tipo de chamado é/será específico de uma empresa
            const [department] = await db.select()
                                         .from(departmentsSchema)
                                         .where(and(eq(departmentsSchema.id, department_id), eq(departmentsSchema.company_id, effectiveCompanyIdForUpdateLogic)));
            if(!department){
                return res.status(400).json({ message: `Departamento ID ${department_id} não encontrado ou não pertence à empresa ID ${effectiveCompanyIdForUpdateLogic}.` });
            }
          } else { // Tipo de chamado é/será global
            const [department] = await db.select().from(departmentsSchema).where(eq(departmentsSchema.id, department_id));
            if(!department){ // Se global, o depto precisa existir, mas não precisa ser global (pode pertencer a uma empresa)
                return res.status(400).json({ message: `Departamento ID ${department_id} não encontrado.`});
            }
          }
        }

        // Verificar duplicidade de nome se o nome estiver sendo alterado
        if (name !== undefined) {
            const duplicateCheckConditions: SQLWrapper[] = [
                eq(schema.incidentTypes.name, name),
                ne(schema.incidentTypes.id, incidentTypeId)
            ];
            if (effectiveCompanyIdForUpdateLogic === null) {
                duplicateCheckConditions.push(isNull(schema.incidentTypes.company_id));
            } else {
                duplicateCheckConditions.push(eq(schema.incidentTypes.company_id, effectiveCompanyIdForUpdateLogic));
            }
            const [existingIncidentTypeWithName] = await db.select().from(schema.incidentTypes).where(and(...duplicateCheckConditions));
            if (existingIncidentTypeWithName) {
                return res.status(409).json({ message: `Já existe um tipo de chamado com o nome "${name}" ${effectiveCompanyIdForUpdateLogic === null ? 'globalmente' : 'nesta empresa'}.` });
            }
        }

        const updatedIncidentType = await db
          .update(schema.incidentTypes)
          .set(updatePayload)
          .where(and(...conditions))
          .returning();

        if (updatedIncidentType.length === 0) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado ou não autorizado para esta operação." });
        }
        res.json(updatedIncidentType[0]);
      } catch (error: any) {
        console.error("Error updating incident type:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation failed", errors: error.errors });
        }
        if (error && error.code === '23503' && error.constraint && error.constraint.includes('incident_types_department_id_fkey')) {
            return res.status(400).json({ message: "Department ID inválido ou não existente ao atualizar."});
        }
        res.status(500).json({ message: "Failed to update incident type" });
      }
    }
  );

  // Rota para excluir um Tipo de Chamado (Incident Type)
  router.delete(
    "/incident-types/:id",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const incidentTypeId = parseInt(req.params.id, 10);
        if (isNaN(incidentTypeId)) {
          return res.status(400).json({ message: "ID de tipo de chamado inválido." });
        }

        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        // Primeiro, verificar a qual empresa (se houver) o tipo de chamado pertence
        const [incidentTypeToDelete] = await db
          .select({ id: schema.incidentTypes.id, company_id: schema.incidentTypes.company_id })
          .from(schema.incidentTypes)
          .where(eq(schema.incidentTypes.id, incidentTypeId));

        if (!incidentTypeToDelete) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado." });
        }

        const conditions: SQLWrapper[] = [eq(schema.incidentTypes.id, incidentTypeId)];

        if (userRole === 'manager') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Manager deve ter um ID de empresa na sessão para excluir." });
          }
          // Manager só pode excluir tipos da sua empresa ou tipos globais.
          // Se o tipo não é global E não pertence à empresa do manager, negar.
          if (incidentTypeToDelete.company_id !== null && incidentTypeToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Manager não tem permissão para excluir este tipo de chamado específico da empresa." });
          }
          // Adiciona a condição para garantir que o manager só delete da sua empresa ou globais
           const managerDeleteCondition = or(
              isNull(schema.incidentTypes.company_id),
              eq(schema.incidentTypes.company_id, sessionCompanyId)
            );
            if (managerDeleteCondition) {
                conditions.push(managerDeleteCondition);
            } else {
                console.error("Error generating manager condition for incident type delete");
                return res.status(500).json({ message: "Erro interno ao processar permissões." });
            }
        } else if (userRole === 'admin') {
          // Admin pode excluir qualquer tipo, condição já tem o ID.
        } else if (userRole === 'company_admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Company Admin deve ter um ID de empresa na sessão para excluir." });
          }
          // Company Admin pode excluir tipos da sua empresa OU tipos globais
          if (incidentTypeToDelete.company_id !== null && incidentTypeToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Company Admin não tem permissão para excluir este tipo de chamado específico da empresa." });
          }
          // Adiciona a condição para garantir que o company_admin só delete da sua empresa ou globais
          const companyAdminDeleteCondition = or(
            isNull(schema.incidentTypes.company_id),
            eq(schema.incidentTypes.company_id, sessionCompanyId)
          );
          if (companyAdminDeleteCondition) {
            conditions.push(companyAdminDeleteCondition);
          } else {
            console.error("Error generating company_admin condition for incident type delete");
            return res.status(500).json({ message: "Erro interno ao processar permissões." });
          }
        } else if (userRole === 'supervisor') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: "Supervisor deve ter um ID de empresa na sessão para excluir." });
          }
          // Supervisor só pode excluir tipos da sua empresa ou tipos globais.
          if (incidentTypeToDelete.company_id !== null && incidentTypeToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Supervisor não tem permissão para excluir este tipo de chamado específico da empresa." });
          }
          // Adiciona a condição para garantir que o supervisor só delete da sua empresa ou globais
           const supervisorDeleteCondition = or(
              isNull(schema.incidentTypes.company_id),
              eq(schema.incidentTypes.company_id, sessionCompanyId)
            );
            if (supervisorDeleteCondition) {
                conditions.push(supervisorDeleteCondition);
            } else {
                console.error("Error generating supervisor condition for incident type delete");
                return res.status(500).json({ message: "Erro interno ao processar permissões." });
            }
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }

        // Verificar vínculos antes de deletar (Ex: tickets)
        const [ticketLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
                                       .from(schema.tickets)
                                       .where(eq(schema.tickets.incident_type_id, incidentTypeId));
        if(ticketLink && ticketLink.count > 0) {
            return res.status(400).json({ message: "Tipo de chamado não pode ser excluído pois está vinculado a chamados existentes." });
        }
        // Adicionar mais verificações de FK aqui conforme necessário

        const deleteResult = await db
          .delete(schema.incidentTypes)
          .where(and(...conditions))
          .returning(); 

        if (deleteResult.length === 0) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado ou não autorizado para exclusão (após verificação de permissão)." });
        }
        res.status(200).json({ message: "Tipo de chamado excluído com sucesso." });
      } catch (error: any) {
        console.error("Error deleting incident type:", error);
        if (error && typeof error === 'object' && 'code' in error && error.code === '23503') { 
          return res.status(400).json({ message: "Tipo de chamado não pode ser excluído devido a vínculos existentes (erro de banco de dados)." });
        }
        res.status(500).json({ message: "Failed to delete incident type" });
      }
    }
  );

  // === ROTAS DE TICKET TYPES ===
  
  // GET /api/ticket-types - Listar tipos de chamado
  router.get("/ticket-types", authRequired, async (req: Request, res: Response) => {
    try {
      // Parâmetros de paginação
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const active_only = req.query.active_only === "true";
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const department_id = req.query.department_id ? parseInt(req.query.department_id as string) : null;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;
      const sessionUserId = req.session.userId;

      // Verificar se o usuário tem uma empresa associada (exceto admin)
      if (!sessionCompanyId && userRole !== 'admin') {
        return res.status(400).json({ message: "Usuário sem empresa associada" });
      }

      const conditions: SQLWrapper[] = [];

      // Lógica de filtro por empresa
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todas
        if (filterCompanyId) {
          conditions.push(eq(schema.ticketTypes.company_id, filterCompanyId));
        }
      } else if (userRole === 'company_admin') {
        // Company_admin vê todos os tipos da sua empresa
        if (sessionCompanyId) {
          conditions.push(eq(schema.ticketTypes.company_id, sessionCompanyId));
        }
             } else if (['manager', 'supervisor', 'support'].includes(userRole)) {
         // Manager/Supervisor/Support veem apenas tipos dos seus departamentos
         if (sessionCompanyId && sessionUserId) {
           // Buscar o official do usuário
           const [userOfficial] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, sessionUserId));
           
           if (userOfficial) {
             // Buscar departamentos do oficial
             const userDepartments = await db.select({ department_id: schema.officialDepartments.department_id })
               .from(schema.officialDepartments)
               .where(eq(schema.officialDepartments.official_id, userOfficial.id));
             
             if (userDepartments.length > 0) {
               const departmentIds = userDepartments.map(dept => dept.department_id);
               
               conditions.push(
                 and(
                   eq(schema.ticketTypes.company_id, sessionCompanyId),
                   inArray(schema.ticketTypes.department_id, departmentIds)
                 )
               );
             } else {
               // Se o usuário não tem departamentos, não deve ver nada
               conditions.push(sql`1 = 0`);
             }
           } else {
             // Se não há official, não deve ver nada
             conditions.push(sql`1 = 0`);
           }
         }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (active_only) {
        conditions.push(eq(schema.ticketTypes.is_active, true));
      }

      if (department_id) {
        conditions.push(eq(schema.ticketTypes.department_id, department_id));
      }

      // Filtro por busca (nome ou descrição)
      if (search) {
        const searchCondition = or(
          ilike(schema.ticketTypes.name, `%${search}%`),
          ilike(schema.ticketTypes.description, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Contar total de registros com filtros aplicados
      let countQuery = db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.ticketTypes);

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }

      const [{ count: totalCount }] = await countQuery;

      // Calcular offset para paginação
      const offset = (page - 1) * limit;

      // Buscar tipos de chamado com informações do departamento
      const ticketTypes = await db.query.ticketTypes.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [asc(schema.ticketTypes.name)],
        limit: limit,
        offset: offset,
        with: {
          department: {
            columns: {
              id: true,
              name: true,
            }
          },
          company: userRole === 'admin' ? {
            columns: {
              id: true,
              name: true,
            }
          } : undefined
        }
      });
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return res.json({
        ticketTypes: ticketTypes,
        pagination: {
          current: page,
          pages: totalPages,
          total: totalCount,
          limit: limit
        }
      });
    } catch (error) {
      console.error('Erro ao obter tipos de chamado:', error);
      res.status(500).json({ message: "Falha ao buscar tipos de chamado", error: String(error) });
    }
  });

  // POST /api/ticket-types - Criar um novo tipo de chamado
  router.post(
    "/ticket-types",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const { name, value, description, department_id, company_id: company_id_from_body, is_active } = req.body;
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        let effectiveCompanyId: number | null = null;

        if (userRole === 'admin') {
          if (company_id_from_body !== undefined) {
            effectiveCompanyId = company_id_from_body;
          }
        } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: `${userRole} não possui uma empresa associada na sessão.` });
          }
          effectiveCompanyId = sessionCompanyId;
          if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
            console.warn(`${userRole} tentou especificar um company_id diferente do seu na criação do tipo de chamado.`);
          }
        } else {
          return res.status(403).json({ message: "Acesso negado." });
        }

        if (!name || !value) {
          return res.status(400).json({ message: "Nome e Valor do tipo de chamado são obrigatórios." });
        }
        if (department_id === undefined) {
          return res.status(400).json({ message: "Department ID é obrigatório." });
        }
        
        // Verificar se o department_id pertence à empresa
        if (effectiveCompanyId !== null && department_id) {
          const [department] = await db.select().from(schema.departments).where(and(eq(schema.departments.id, department_id), eq(schema.departments.company_id, effectiveCompanyId)));
          if (!department) {
            return res.status(400).json({ message: `Departamento ID ${department_id} não encontrado ou não pertence à empresa ID ${effectiveCompanyId}.` });
          }
        }

        // Verificar duplicidade
        const existingConditions: SQLWrapper[] = [eq(schema.ticketTypes.name, name)];
        if (effectiveCompanyId !== null) {
          existingConditions.push(eq(schema.ticketTypes.company_id, effectiveCompanyId));
        } else {
          existingConditions.push(isNull(schema.ticketTypes.company_id));
        }

        const [existing] = await db.select().from(schema.ticketTypes).where(and(...existingConditions));
        if (existing) {
          return res.status(400).json({ message: "Já existe um tipo de chamado com este nome para esta empresa." });
        }

        // Verificar duplicidade do valor
        const existingValueConditions: SQLWrapper[] = [eq(schema.ticketTypes.value, value)];
        if (effectiveCompanyId !== null) {
          existingValueConditions.push(eq(schema.ticketTypes.company_id, effectiveCompanyId));
        } else {
          existingValueConditions.push(isNull(schema.ticketTypes.company_id));
        }

        const [existingValue] = await db.select().from(schema.ticketTypes).where(and(...existingValueConditions));
        if (existingValue) {
          return res.status(400).json({ message: "Já existe um tipo de chamado com este valor para esta empresa." });
        }

        // Criar tipo de chamado
        const [newTicketType] = await db
          .insert(schema.ticketTypes)
          .values({
            name,
            value,
            description: description || null,
            department_id,
            company_id: effectiveCompanyId,
            is_active: is_active !== undefined ? is_active : true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();

        res.status(201).json(newTicketType);
      } catch (error: any) {
        console.error("Error creating ticket type:", error);
        res.status(500).json({ message: "Failed to create ticket type" });
      }
    }
  );

  // PUT /api/ticket-types/:id - Atualizar um tipo de chamado
  router.put(
    "/ticket-types/:id",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const ticketTypeId = parseInt(req.params.id);
        if (isNaN(ticketTypeId)) {
          return res.status(400).json({ message: "ID do tipo de chamado inválido." });
        }

        const { name, value, description, department_id, is_active } = req.body;
        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        // Verificar se o tipo de chamado existe
        const [ticketTypeToUpdate] = await db
          .select()
          .from(schema.ticketTypes)
          .where(eq(schema.ticketTypes.id, ticketTypeId));

        if (!ticketTypeToUpdate) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado." });
        }

        // Verificar permissões
        if (userRole !== 'admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: `${userRole} deve ter um ID de empresa na sessão.` });
          }
          if (ticketTypeToUpdate.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Não é possível editar tipo de chamado de outra empresa." });
          }
        }

        // Validar departamento se fornecido
        if (department_id && department_id !== ticketTypeToUpdate.department_id) {
          const effectiveCompanyId = userRole === 'admin' ? ticketTypeToUpdate.company_id : sessionCompanyId;
          
          if (effectiveCompanyId !== null) {
            const [department] = await db.select().from(schema.departments).where(and(eq(schema.departments.id, department_id), eq(schema.departments.company_id, effectiveCompanyId)));
            if (!department) {
              return res.status(400).json({ message: `Departamento ID ${department_id} não encontrado ou não pertence à empresa.` });
            }
          }
        }

        // Verificar duplicidade de nome se alterado
        if (name && name !== ticketTypeToUpdate.name) {
          const existingConditions: SQLWrapper[] = [
            eq(schema.ticketTypes.name, name),
            ne(schema.ticketTypes.id, ticketTypeId)
          ];
          
          if (ticketTypeToUpdate.company_id !== null) {
            existingConditions.push(eq(schema.ticketTypes.company_id, ticketTypeToUpdate.company_id));
          } else {
            existingConditions.push(isNull(schema.ticketTypes.company_id));
          }

          const [existing] = await db.select().from(schema.ticketTypes).where(and(...existingConditions));
          if (existing) {
            return res.status(400).json({ message: "Já existe um tipo de chamado com este nome para esta empresa." });
          }
        }

        // Verificar duplicidade de valor se alterado
        if (value && value !== ticketTypeToUpdate.value) {
          const existingValueConditions: SQLWrapper[] = [
            eq(schema.ticketTypes.value, value),
            ne(schema.ticketTypes.id, ticketTypeId)
          ];
          
          if (ticketTypeToUpdate.company_id !== null) {
            existingValueConditions.push(eq(schema.ticketTypes.company_id, ticketTypeToUpdate.company_id));
          } else {
            existingValueConditions.push(isNull(schema.ticketTypes.company_id));
          }

          const [existingValue] = await db.select().from(schema.ticketTypes).where(and(...existingValueConditions));
          if (existingValue) {
            return res.status(400).json({ message: "Já existe um tipo de chamado com este valor para esta empresa." });
          }
        }

        // Atualizar tipo de chamado
        const updateData: any = { updated_at: new Date() };
        if (name !== undefined) updateData.name = name;
        if (value !== undefined) updateData.value = value;
        if (description !== undefined) updateData.description = description;
        if (department_id !== undefined) updateData.department_id = department_id;
        if (is_active !== undefined) updateData.is_active = is_active;

        const [updatedTicketType] = await db
          .update(schema.ticketTypes)
          .set(updateData)
          .where(eq(schema.ticketTypes.id, ticketTypeId))
          .returning();

        res.json(updatedTicketType);
      } catch (error: any) {
        console.error("Error updating ticket type:", error);
        res.status(500).json({ message: "Failed to update ticket type" });
      }
    }
  );

  // DELETE /api/ticket-types/:id - Desativar um tipo de chamado
  router.delete(
    "/ticket-types/:id",
    authRequired,
    authorize(['admin', 'manager', 'company_admin', 'supervisor']),
    async (req: Request, res: Response) => {
      try {
        const ticketTypeId = parseInt(req.params.id);
        if (isNaN(ticketTypeId)) {
          return res.status(400).json({ message: "ID do tipo de chamado inválido." });
        }

        const userRole = req.session.userRole as string;
        const sessionCompanyId = req.session.companyId;

        // Verificar se o tipo de chamado existe
        const [ticketTypeToDelete] = await db
          .select()
          .from(schema.ticketTypes)
          .where(eq(schema.ticketTypes.id, ticketTypeId));

        if (!ticketTypeToDelete) {
          return res.status(404).json({ message: "Tipo de chamado não encontrado." });
        }

        // Verificar permissões
        if (userRole !== 'admin') {
          if (!sessionCompanyId) {
            return res.status(403).json({ message: `${userRole} deve ter um ID de empresa na sessão.` });
          }
          if (ticketTypeToDelete.company_id !== sessionCompanyId) {
            return res.status(403).json({ message: "Não é possível excluir tipo de chamado de outra empresa." });
          }
        }

        // Verificar vínculos antes de deletar (tickets)
        const [ticketLink] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(schema.tickets)
          .where(eq(schema.tickets.type, ticketTypeToDelete.value));
          
        if (ticketLink && ticketLink.count > 0) {
          return res.status(400).json({ message: "Tipo de chamado não pode ser excluído pois está vinculado a chamados existentes." });
        }

        // Desativar em vez de excluir
        const [updatedTicketType] = await db
          .update(schema.ticketTypes)
          .set({
            is_active: false,
            updated_at: new Date(),
          })
          .where(eq(schema.ticketTypes.id, ticketTypeId))
          .returning();

        res.status(200).json({ message: "Tipo de chamado desativado com sucesso.", ticketType: updatedTicketType });
      } catch (error: any) {
        console.error("Error deleting ticket type:", error);
        if (error && typeof error === 'object' && 'code' in error && error.code === '23503') { 
          return res.status(400).json({ message: "Tipo de chamado não pode ser excluído devido a vínculos existentes." });
        }
        res.status(500).json({ message: "Failed to delete ticket type" });
      }
    }
  );

  // === ROTAS DE CATEGORIAS ===
  
  // GET /api/categories - Listar categorias
  router.get("/categories", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support', 'viewer', 'customer']), async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const active_only = req.query.active_only === "true";
      const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
      const incident_type_id = req.query.incident_type_id ? parseInt(req.query.incident_type_id as string) : null;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;
      const sessionUserId = req.session.userId;

      // Verificar se o usuário tem uma empresa associada (exceto admin)
      if (!sessionCompanyId && userRole !== 'admin') {
        return res.status(400).json({ message: "Usuário sem empresa associada" });
      }

      const conditions: SQLWrapper[] = [];

      // Lógica de filtro por empresa
      if (userRole === 'admin') {
        // Admin pode filtrar por empresa específica ou ver todas
        if (filterCompanyId) {
          conditions.push(eq(schema.categories.company_id, filterCompanyId));
        }
      } else if (userRole === 'company_admin') {
        // Company_admin vê todas as categorias da sua empresa
        if (sessionCompanyId) {
          conditions.push(eq(schema.categories.company_id, sessionCompanyId));
        }
      } else if (['manager', 'supervisor', 'support', 'viewer'].includes(userRole)) {
        // Manager/Supervisor/Support/Viewer veem apenas categorias dos seus departamentos
        if (sessionCompanyId && sessionUserId) {
          // Buscar o official do usuário
          const [userOfficial] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, sessionUserId));
          
          if (userOfficial) {
            // Buscar departamentos do oficial
            const userDepartments = await db.select({ department_id: schema.officialDepartments.department_id })
              .from(schema.officialDepartments)
              .where(eq(schema.officialDepartments.official_id, userOfficial.id));
            
            if (userDepartments.length > 0) {
              const departmentIds = userDepartments.map(dept => dept.department_id);
              
              // Buscar tipos de incidente dos departamentos do usuário
              const incidentTypes = await db.select({ id: schema.incidentTypes.id })
                .from(schema.incidentTypes)
                .where(
                  and(
                    eq(schema.incidentTypes.company_id, sessionCompanyId),
                    inArray(schema.incidentTypes.department_id, departmentIds)
                  )
                );
              
              if (incidentTypes.length > 0) {
                const incidentTypeIds = incidentTypes.map(it => it.id);
                conditions.push(
                  and(
                    eq(schema.categories.company_id, sessionCompanyId),
                    inArray(schema.categories.incident_type_id, incidentTypeIds)
                  )
                );
              } else {
                // Se não há tipos de incidente, não deve ver nada
                conditions.push(sql`1 = 0`);
              }
            } else {
              // Se o usuário não tem departamentos, não deve ver nada
              conditions.push(sql`1 = 0`);
            }
          } else {
            // Se não há official, não deve ver nada
            conditions.push(sql`1 = 0`);
          }
        }
      } else if (userRole === 'customer') {
        // Customer vê apenas categorias ativas da sua empresa
        if (sessionCompanyId) {
          conditions.push(
            and(
              eq(schema.categories.company_id, sessionCompanyId),
              eq(schema.categories.is_active, true)
            )
          );
        } else {
          // Se customer não tem empresa, não vê nada
          conditions.push(sql`1 = 0`);
        }
      } else {
        return res.status(403).json({ message: "Acesso negado" });
      }

      if (active_only) {
        conditions.push(eq(schema.categories.is_active, true));
      }

      if (incident_type_id) {
        conditions.push(eq(schema.categories.incident_type_id, incident_type_id));
      }

      // Filtro por busca (nome ou descrição)
      if (search) {
        const searchCondition = or(
          ilike(schema.categories.name, `%${search}%`),
          ilike(schema.categories.description, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Query principal com JOIN para trazer dados do tipo de incidente
      const offset = (page - 1) * limit;
      const categoriesQuery = db
        .select({
          id: schema.categories.id,
          name: schema.categories.name,
          description: schema.categories.description,
          incident_type_id: schema.categories.incident_type_id,
          company_id: schema.categories.company_id,
          is_active: schema.categories.is_active,
          created_at: schema.categories.created_at,
          updated_at: schema.categories.updated_at,
          incident_type_name: schema.incidentTypes.name,
          department_id: schema.incidentTypes.department_id,
          department_name: schema.departments.name,
        })
        .from(schema.categories)
        .leftJoin(schema.incidentTypes, eq(schema.categories.incident_type_id, schema.incidentTypes.id))
        .leftJoin(schema.departments, eq(schema.incidentTypes.department_id, schema.departments.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.categories.created_at))
        .limit(limit)
        .offset(offset);

      // Query para contar total
      const countQuery = db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.categories)
        .leftJoin(schema.incidentTypes, eq(schema.categories.incident_type_id, schema.incidentTypes.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const [categories, countResult] = await Promise.all([
        categoriesQuery,
        countQuery
      ]);

      const total = countResult[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      res.json({
        categories,
        pagination: {
          current: page,
          pages: totalPages,
          total,
          limit,
        },
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Falha ao buscar categorias" });
    }
  });

  // POST /api/categories - Criar nova categoria
  router.post("/categories", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { name, description, incident_type_id, company_id } = req.body;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;

      // Validações básicas
      if (!name || !incident_type_id) {
        return res.status(400).json({ message: "Nome e tipo de incidente são obrigatórios" });
      }

      // Determinar company_id efetivo
      let effectiveCompanyId: number | null = null;
      
      if (userRole === 'admin') {
        effectiveCompanyId = company_id || null;
      } else {
        effectiveCompanyId = sessionCompanyId || null;
        if (company_id && company_id !== sessionCompanyId) {
          console.warn(`Usuário ${userRole} tentou especificar company_id ${company_id}, mas será usado o da sessão: ${sessionCompanyId}`);
        }
      }

      // Verificar se o tipo de incidente existe e se o usuário tem acesso
      const [incidentType] = await db
        .select()
        .from(schema.incidentTypes)
        .where(eq(schema.incidentTypes.id, incident_type_id));

      if (!incidentType) {
        return res.status(404).json({ message: "Tipo de incidente não encontrado" });
      }

      // Verificar se o usuário tem acesso ao tipo de incidente
      if (userRole !== 'admin') {
        if (incidentType.company_id !== effectiveCompanyId) {
          return res.status(403).json({ message: "Acesso negado ao tipo de incidente" });
        }
      }

      // Verificar se já existe uma categoria com o mesmo nome para o tipo de incidente
      const [existingCategory] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.name, name),
            eq(schema.categories.incident_type_id, incident_type_id),
            eq(schema.categories.company_id, effectiveCompanyId)
          )
        );

      if (existingCategory) {
        return res.status(409).json({ message: "Já existe uma categoria com este nome para este tipo de incidente" });
      }

      const [category] = await db
        .insert(schema.categories)
        .values({
          name,
          description: description || null,
          incident_type_id,
          company_id: effectiveCompanyId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Falha ao criar categoria" });
    }
  });

  // PUT /api/categories/:id - Atualizar categoria
  router.put("/categories/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "ID de categoria inválido" });
      }

      const { name, description, incident_type_id, is_active } = req.body;
      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;

      // Buscar categoria existente
      const [existingCategory] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, categoryId));

      if (!existingCategory) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }

      // Verificar permissões
      if (userRole !== 'admin') {
        if (existingCategory.company_id !== sessionCompanyId) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }

      // Se está alterando o tipo de incidente, verificar se existe e se tem acesso
      if (incident_type_id && incident_type_id !== existingCategory.incident_type_id) {
        const [incidentType] = await db
          .select()
          .from(schema.incidentTypes)
          .where(eq(schema.incidentTypes.id, incident_type_id));

        if (!incidentType) {
          return res.status(404).json({ message: "Tipo de incidente não encontrado" });
        }

        if (userRole !== 'admin' && incidentType.company_id !== sessionCompanyId) {
          return res.status(403).json({ message: "Acesso negado ao tipo de incidente" });
        }
      }

      // Se está alterando o nome, verificar se não há conflito
      if (name && name !== existingCategory.name) {
        const [conflictCategory] = await db
          .select()
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.name, name),
              eq(schema.categories.incident_type_id, incident_type_id || existingCategory.incident_type_id),
              eq(schema.categories.company_id, existingCategory.company_id),
              not(eq(schema.categories.id, categoryId))
            )
          );

        if (conflictCategory) {
          return res.status(409).json({ message: "Já existe uma categoria com este nome para este tipo de incidente" });
        }
      }

      const [updatedCategory] = await db
        .update(schema.categories)
        .set({
          name: name || existingCategory.name,
          description: description !== undefined ? description : existingCategory.description,
          incident_type_id: incident_type_id || existingCategory.incident_type_id,
          is_active: is_active !== undefined ? is_active : existingCategory.is_active,
          updated_at: new Date(),
        })
        .where(eq(schema.categories.id, categoryId))
        .returning();

      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Falha ao atualizar categoria" });
    }
  });

  // DELETE /api/categories/:id - Excluir categoria
  router.delete("/categories/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "ID de categoria inválido" });
      }

      const userRole = req.session?.userRole as string;
      const sessionCompanyId = req.session.companyId;

      // Buscar categoria existente
      const [existingCategory] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, categoryId));

      if (!existingCategory) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }

      // Verificar permissões
      if (userRole !== 'admin') {
        if (existingCategory.company_id !== sessionCompanyId) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }

      // Verificar se há tickets vinculados à categoria
      const [ticketLink] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.tickets)
        .where(eq(schema.tickets.category_id, categoryId));

      if (ticketLink && ticketLink.count > 0) {
        return res.status(400).json({ message: "Categoria não pode ser excluída pois está vinculada a chamados existentes" });
      }

      await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, categoryId));

      res.json({ message: "Categoria excluída com sucesso" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Falha ao excluir categoria" });
    }
  });

  // --- ROTAS DE SLA DEFINITIONS ---
  router.get("/settings/sla", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support', 'customer']), async (req: Request, res: Response) => {
    let effectiveCompanyId: number | undefined = undefined; // Inicializada e tipo ajustado
    try {
      const userRole = req.session.userRole as string;
      const sessionCompanyId = req.session.companyId; // Pode ser undefined
      let queryCompanyId = req.query.company_id ? parseInt(req.query.company_id as string, 10) : undefined;

      if (userRole === 'admin') {
        effectiveCompanyId = queryCompanyId; // Admin usa o company_id da query, se fornecido
        if (effectiveCompanyId === undefined) {
          // Se admin não fornecer company_id, pode-se decidir retornar da primeira empresa com SLA
          // ou da empresa do próprio admin (se ele tiver uma), ou vazio para o frontend solicitar seleção.
          // Por agora, retornaremos vazio se não especificado, para forçar seleção no frontend.
          return res.json([]);
        }
      } else if (userRole === 'manager') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Manager não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId; // Manager sempre usa o seu companyId da sessão
      } else if (userRole === 'company_admin') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Company Admin não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId; // Company Admin sempre usa o seu companyId da sessão
      } else if (userRole === 'supervisor') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Supervisor não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId; // Supervisor sempre usa o seu companyId da sessão
      } else if (userRole === 'support') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Support não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId; // Support sempre usa o seu companyId da sessão
      } else if (userRole === 'customer') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Customer não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId; // Customer sempre usa o seu companyId da sessão
      } else {
        return res.status(403).json({ message: "Usuário sem permissão para acessar definições de SLA." });
      }

      if (effectiveCompanyId === undefined || isNaN(effectiveCompanyId)) {
        // Se mesmo após a lógica acima, não temos um company ID válido (ex: admin não forneceu)
        return res.status(400).json({ message: "ID da empresa não especificado ou inválido." });
      }

      const slaRules = await db
        .select()
        .from(schema.slaDefinitions)
        .where(eq(schema.slaDefinitions.company_id, effectiveCompanyId))
        .orderBy(schema.slaDefinitions.priority); // Ordenar pode ser útil, mas prioridades são fixas
      
      // Estruturar a resposta para ser facilmente consumida pelo frontend
      // (ex: um objeto com prioridades como chaves)
      const slaSettings: Record<string, { response_time_hours?: number, resolution_time_hours?: number }> = {};
      
      // Usar prioridades dinâmicas ao invés de enum fixo
      const allPriorities = [...new Set(slaRules.map(r => r.priority))];
      // Fallback para prioridades padrão se não houver regras
      const priorities = allPriorities.length > 0 ? allPriorities : ['BAIXA', 'MÉDIA', 'ALTA', 'CRÍTICA'];

      priorities.forEach(prio => {
        const rule = slaRules.find(r => r.priority === prio);
        if (rule) {
          slaSettings[prio] = {
            response_time_hours: rule.response_time_hours,
            resolution_time_hours: rule.resolution_time_hours
          };
        } else {
          // Se não houver regra definida para uma prioridade, pode-se enviar null/undefined ou valores padrão
          slaSettings[prio] = { response_time_hours: undefined, resolution_time_hours: undefined }; 
        }
      });

      res.json({ company_id: effectiveCompanyId, settings: slaSettings });

    } catch (error) {
      console.error("Error fetching SLA definitions:", error);
      res.status(500).json({ message: "Falha ao buscar definições de SLA." });
    }
  });

  type DrizzleReturningQuery = any; // Placeholder para tipo de query Drizzle com .returning()
  router.post("/settings/sla", authRequired, authorize(['admin', 'manager', 'company_admin', 'supervisor', 'support']), async (req: Request, res: Response) => {
    let effectiveCompanyId: number | undefined = undefined; // Inicializada e tipo ajustado
    try {
      const userRole = req.session.userRole as string;
      const sessionCompanyId = req.session.companyId;
      const { company_id: company_id_from_body, settings } = req.body;

      if (userRole === 'admin') {
        if (company_id_from_body === undefined || company_id_from_body === null) {
          return res.status(400).json({ message: "Admin deve fornecer company_id no corpo da requisição." });
        }
        effectiveCompanyId = parseInt(company_id_from_body, 10);
        if (isNaN(effectiveCompanyId)) {
            return res.status(400).json({ message: "company_id inválido fornecido no corpo da requisição." });
        }
        const [companyExists] = await db.select({id: schema.companies.id}).from(schema.companies).where(eq(schema.companies.id, effectiveCompanyId));
        if (!companyExists) {
            return res.status(404).json({ message: `Empresa com ID ${effectiveCompanyId} não encontrada.` });
        }
      } else if (userRole === 'manager') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Manager não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId;
        if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
          console.warn("Manager tentou salvar SLA para company_id diferente da sua sessão. Usando company_id da sessão.");
        }
      } else if (userRole === 'company_admin') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Company Admin não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId;
        if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
          console.warn("Company Admin tentou salvar SLA para company_id diferente da sua sessão. Usando company_id da sessão.");
        }
      } else if (userRole === 'supervisor') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Supervisor não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId;
        if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
          console.warn("Supervisor tentou salvar SLA para company_id diferente da sua sessão. Usando company_id da sessão.");
        }
      } else if (userRole === 'support') {
        if (!sessionCompanyId) {
          return res.status(403).json({ message: "Support não está associado a nenhuma empresa." });
        }
        effectiveCompanyId = sessionCompanyId;
        if (company_id_from_body !== undefined && company_id_from_body !== sessionCompanyId) {
          console.warn("Support tentou salvar SLA para company_id diferente da sua sessão. Usando company_id da sessão.");
        }
      } else {
        return res.status(403).json({ message: "Usuário sem permissão para salvar definições de SLA." });
      }

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ message: "Formato inválido. 'settings' deve ser um objeto com as prioridades." });
      }

      // Usar prioridades dinâmicas ao invés de enum fixo
      const priorities = Object.keys(settings);
      const results: Array<any> = []; // Tipagem mais explícita para results

      await db.transaction(async (tx) => {
        for (const priority of priorities) {
          const ruleData = settings[priority];
          
          const existingRule = await tx.query.slaDefinitions.findFirst({
            where: and(
              eq(schema.slaDefinitions.company_id, effectiveCompanyId as number), // Cast para number aqui, pois já validamos
              eq(schema.slaDefinitions.priority, priority)
            )
          });

          if (ruleData && ruleData.response_time_hours !== undefined && ruleData.resolution_time_hours !== undefined &&
              ruleData.response_time_hours !== '' && ruleData.resolution_time_hours !== '') {
            
            const response_time_hours = parseInt(ruleData.response_time_hours, 10);
            const resolution_time_hours = parseInt(ruleData.resolution_time_hours, 10);

            if (isNaN(response_time_hours) || response_time_hours < 0) {
              // Lançar erro para abortar a transação
              throw new Error(`Tempo de resposta inválido para prioridade ${priority}. Deve ser um número não negativo.`);
            }
            if (isNaN(resolution_time_hours) || resolution_time_hours < 0) {
              // Lançar erro para abortar a transação
              throw new Error(`Tempo de resolução inválido para prioridade ${priority}. Deve ser um número não negativo.`);
            }

            let opResult;
            if (existingRule) {
              opResult = await tx.update(schema.slaDefinitions)
                .set({
                  response_time_hours: response_time_hours,
                  resolution_time_hours: resolution_time_hours,
                  updated_at: new Date(),
                })
                .where(eq(schema.slaDefinitions.id, existingRule.id))
                .returning();
              results.push(opResult[0] || { priority, status: 'updated_error' });
            } else {
              opResult = await tx.insert(schema.slaDefinitions)
                .values({
                  company_id: effectiveCompanyId as number, // Cast para number
                  priority: priority, // Agora TEXT aceita qualquer string
                  response_time_hours: response_time_hours,
                  resolution_time_hours: resolution_time_hours,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                .returning();
              results.push(opResult[0] || { priority, status: 'inserted_error' });
            }
          } else if (existingRule) {
            await tx.delete(schema.slaDefinitions)
              .where(eq(schema.slaDefinitions.id, existingRule.id));
            results.push({ priority, status: 'deleted' });
          } else {
            results.push({ priority, status: 'not_set' });
          }
        }
      }); // Fim da db.transaction
      
      res.status(200).json({ company_id: effectiveCompanyId, outcome: results });

    } catch (error) {
      console.error("Error saving SLA definitions:", error);
      // @ts-ignore: Verificar se o erro é uma instância de Error para acessar message
      if (error instanceof Error && (error.message.includes('Tempo de resposta inválido') || error.message.includes('Tempo de resolução inválido'))) {
        return res.status(400).json({ message: error.message });
      }
      // @ts-ignore: Acessar error.code e error.constraint se existirem
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503') { 
        // @ts-ignore
        if ('constraint' in error && error.constraint && typeof error.constraint === 'string' && error.constraint.includes('sla_definitions_company_id_fkey')) {
            return res.status(400).json({ message: `ID da empresa ${effectiveCompanyId !== undefined ? effectiveCompanyId : 'desconhecido'} inválido ou não existente.` });
        }
      }
      res.status(500).json({ message: "Falha ao salvar definições de SLA." });
    }
  });

  // --- ROTAS DE CONFIGURAÇÕES DE NOTIFICAÇÃO ---
  // Obter configurações de notificação do usuário atual
  router.get("/notification-settings", authRequired, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Buscar configurações existentes do usuário
      const [settings] = await db
        .select()
        .from(schema.userNotificationSettings)
        .where(eq(schema.userNotificationSettings.user_id, userId))
        .limit(1);

      if (!settings) {
        // Se não existe, criar configurações padrão
        const [newSettings] = await db
          .insert(schema.userNotificationSettings)
          .values({
            user_id: userId,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning();
        
        return res.json(newSettings);
      }

      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações de notificação:", error);
      res.status(500).json({ message: "Erro interno ao buscar configurações de notificação" });
    }
  });

  // Atualizar configurações de notificação do usuário atual
  router.put("/notification-settings", authRequired, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const {
        new_ticket_assigned,
        ticket_status_changed,
        new_reply_received,
        ticket_escalated,
        ticket_due_soon,
        new_customer_registered,
        new_user_created,
        system_maintenance,
        email_notifications,
        notification_hours_start,
        notification_hours_end,
        weekend_notifications,
        digest_frequency
      } = req.body;

      // Validações básicas
      if (notification_hours_start !== undefined) {
        const start = parseInt(notification_hours_start);
        if (isNaN(start) || start < 0 || start > 23) {
          return res.status(400).json({ message: "Horário de início inválido (0-23)" });
        }
      }

      if (notification_hours_end !== undefined) {
        const end = parseInt(notification_hours_end);
        if (isNaN(end) || end < 0 || end > 23) {
          return res.status(400).json({ message: "Horário de fim inválido (0-23)" });
        }
      }

      if (digest_frequency !== undefined && !['never', 'daily', 'weekly'].includes(digest_frequency)) {
        return res.status(400).json({ message: "Frequência de resumo inválida" });
      }

      // Preparar dados para atualização
      const updateData: Record<string, any> = {
        updated_at: new Date()
      };

      // Adicionar apenas os campos que foram enviados
      if (new_ticket_assigned !== undefined) updateData.new_ticket_assigned = new_ticket_assigned;
      if (ticket_status_changed !== undefined) updateData.ticket_status_changed = ticket_status_changed;
      if (new_reply_received !== undefined) updateData.new_reply_received = new_reply_received;
      if (ticket_escalated !== undefined) updateData.ticket_escalated = ticket_escalated;
      if (ticket_due_soon !== undefined) updateData.ticket_due_soon = ticket_due_soon;
      if (new_customer_registered !== undefined) updateData.new_customer_registered = new_customer_registered;
      if (new_user_created !== undefined) updateData.new_user_created = new_user_created;
      if (system_maintenance !== undefined) updateData.system_maintenance = system_maintenance;
      if (email_notifications !== undefined) updateData.email_notifications = email_notifications;
      if (notification_hours_start !== undefined) updateData.notification_hours_start = parseInt(notification_hours_start);
      if (notification_hours_end !== undefined) updateData.notification_hours_end = parseInt(notification_hours_end);
      if (weekend_notifications !== undefined) updateData.weekend_notifications = weekend_notifications;
      if (digest_frequency !== undefined) updateData.digest_frequency = digest_frequency;

      // Verificar se o usuário já tem configurações
      const [existingSettings] = await db
        .select()
        .from(schema.userNotificationSettings)
        .where(eq(schema.userNotificationSettings.user_id, userId))
        .limit(1);

      let updatedSettings;
      if (existingSettings) {
        // Atualizar configurações existentes
        [updatedSettings] = await db
          .update(schema.userNotificationSettings)
          .set(updateData)
          .where(eq(schema.userNotificationSettings.user_id, userId))
          .returning();
      } else {
        // Criar novas configurações
        [updatedSettings] = await db
          .insert(schema.userNotificationSettings)
          .values({
            user_id: userId,
            ...updateData,
            created_at: new Date()
          })
          .returning();
      }

      res.json(updatedSettings);
    } catch (error) {
      console.error("Erro ao atualizar configurações de notificação:", error);
      res.status(500).json({ message: "Erro interno ao atualizar configurações de notificação" });
    }
  });

  // --- FIM DAS ROTAS DE CONFIGURAÇÕES DE NOTIFICAÇÃO ---

  // --- ROTAS DE ANEXOS DE TICKETS ---

  // Configuração do multer para upload em memória
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB padrão
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,rtf,xls,xlsx,csv,ppt,pptx,sql,db,sqlite,jpg,jpeg,png,gif,bmp,tiff,svg,webp,zip,rar,7z,tar,gz,json,xml,yaml,yml,log,ini,cfg,conf,exe,msi,deb,rpm,mp4,avi,mov,wmv,flv,webm,mp3,wav,flac,aac').split(',');
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      
      if (extension && allowedTypes.includes(extension)) {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`));
      }
    }
  });

  // Upload de anexo para um ticket
  router.post("/tickets/:ticketId/attachments", authRequired, uploadLimiter, upload.single('file'), validateFileUpload, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const userId = req.session.userId!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      // Verificar se o ticket existe
      const [ticket] = await db
        .select()
        .from(schema.tickets)
        .where(eq(schema.tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Fazer upload do arquivo
      const fileData = {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      };

      const uploadResult = await s3Service.uploadFile(fileData, ticketId, userId);

      // Salvar metadados no banco
      const [attachment] = await db
        .insert(schema.ticketAttachments)
        .values({
          ticket_id: ticketId,
          user_id: userId,
          filename: uploadResult.filename,
          original_filename: uploadResult.originalFilename,
          file_size: uploadResult.fileSize,
          mime_type: uploadResult.mimeType,
          s3_key: uploadResult.s3Key,
          s3_bucket: uploadResult.bucket,
          uploaded_at: new Date()
        })
        .returning();

      res.status(201).json(attachment);
    } catch (error) {
      console.error('Erro ao fazer upload de anexo:', error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Erro interno ao fazer upload do arquivo" });
    }
  });

  // Gerar URL de download para um anexo
  router.get("/attachments/:attachmentId/download", authRequired, async (req: Request, res: Response) => {
    try {
      const attachmentId = parseInt(req.params.attachmentId);

      // Buscar anexo
      const [attachment] = await db
        .select()
        .from(schema.ticketAttachments)
        .where(
          and(
            eq(schema.ticketAttachments.id, attachmentId),
            eq(schema.ticketAttachments.is_deleted, false)
          )
        )
        .limit(1);

      if (!attachment) {
        return res.status(404).json({ message: "Anexo não encontrado" });
      }

      // Gerar URL de download assinada
      const downloadUrl = await s3Service.getDownloadUrl(attachment.s3_key);

      res.json({
        download_url: downloadUrl,
        filename: attachment.original_filename,
        expires_in: parseInt(process.env.FILE_URL_EXPIRATION || '3600')
      });
    } catch (error) {
      console.error('Erro ao gerar URL de download:', error);
      res.status(500).json({ message: "Erro interno ao gerar URL de download" });
    }
  });

  // Listar anexos de um ticket
  router.get("/tickets/:ticketId/attachments", authRequired, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.ticketId);

      // Verificar se o ticket existe
      const [ticket] = await db
        .select()
        .from(schema.tickets)
        .where(eq(schema.tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Buscar anexos não deletados
      const attachments = await db
        .select({
          id: schema.ticketAttachments.id,
          ticket_id: schema.ticketAttachments.ticket_id,
          user_id: schema.ticketAttachments.user_id,
          filename: schema.ticketAttachments.filename,
          original_filename: schema.ticketAttachments.original_filename,
          file_size: schema.ticketAttachments.file_size,
          mime_type: schema.ticketAttachments.mime_type,
          uploaded_at: schema.ticketAttachments.uploaded_at,
          user_name: schema.users.name,
          user_email: schema.users.email
        })
        .from(schema.ticketAttachments)
        .leftJoin(schema.users, eq(schema.ticketAttachments.user_id, schema.users.id))
        .where(
          and(
            eq(schema.ticketAttachments.ticket_id, ticketId),
            eq(schema.ticketAttachments.is_deleted, false)
          )
        )
        .orderBy(desc(schema.ticketAttachments.uploaded_at));

      // Formatar resposta
      const formattedAttachments = attachments.map(attachment => ({
        id: attachment.id,
        ticket_id: attachment.ticket_id,
        user_id: attachment.user_id,
        filename: attachment.filename,
        original_filename: attachment.original_filename,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        uploaded_at: attachment.uploaded_at,
        user: {
          id: attachment.user_id,
          name: attachment.user_name,
          email: attachment.user_email
        }
      }));

      res.json(formattedAttachments);
    } catch (error) {
      console.error('Erro ao buscar anexos:', error);
      res.status(500).json({ message: "Erro interno ao buscar anexos" });
    }
  });

  // Endpoint para testar conexão com S3/Wasabi (apenas admins)
  router.get("/test-s3-connection", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const result = await s3Service.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Erro ao testar conexão S3:', error);
      res.status(500).json({ 
        success: false, 
        error: "Erro interno ao testar conexão" 
      });
    }
  });

  // Endpoints para testar sistema de prioridades flexíveis (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    router.get("/priority-test", async (req: Request, res: Response) => {
      try {
        const { testPriorities } = await import('./api/priority-test');
        await testPriorities(req, res);
      } catch (error) {
        console.error('Erro ao executar teste de prioridades:', error);
        res.status(500).json({ 
          success: false, 
          error: "Erro interno ao executar teste" 
        });
      }
    });

    router.get("/priority-test/department/:companyId/:departmentId", async (req: Request, res: Response) => {
      try {
        const { testDepartmentPriorities } = await import('./api/priority-test');
        await testDepartmentPriorities(req, res);
      } catch (error) {
        console.error('Erro ao testar prioridades do departamento:', error);
        res.status(500).json({ 
          success: false, 
          error: "Erro interno ao testar prioridades" 
        });
      }
    });
  }

  // --- ROTAS DE PRIORIDADES FLEXÍVEIS ---
  
  // Listar prioridades de um departamento
  router.get("/departments/:departmentId/priorities", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support', 'customer']), async (req: Request, res: Response) => {
    try {
      const { getDepartmentPriorities } = await import('./api/priorities');
      await getDepartmentPriorities(req, res);
    } catch (error) {
      console.error('Erro ao buscar prioridades do departamento:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao buscar prioridades" 
      });
    }
  });

  // Criar nova prioridade para um departamento
  router.post("/departments/:departmentId/priorities", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { createDepartmentPriority } = await import('./api/department-priorities');
      await createDepartmentPriority(req, res);
    } catch (error) {
      console.error('Erro ao criar prioridade:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao criar prioridade" 
      });
    }
  });

  // Editar prioridade
  router.put("/departments/:departmentId/priorities/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { updatePriority } = await import('./api/department-priorities');
      await updatePriority(req, res);
    } catch (error) {
      console.error('Erro ao editar prioridade:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao editar prioridade" 
      });
    }
  });

  // Excluir prioridade
  router.delete("/departments/:departmentId/priorities/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { deletePriority } = await import('./api/department-priorities');
      await deletePriority(req, res);
    } catch (error) {
      console.error('Erro ao excluir prioridade:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao excluir prioridade" 
      });
    }
  });

  // Reordenar prioridades
  router.post("/departments/:departmentId/priorities/reorder", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { reorderPriorities } = await import('./api/department-priorities');
      await reorderPriorities(req, res);
    } catch (error) {
      console.error('Erro ao reordenar prioridades:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao reordenar prioridades" 
      });
    }
  });

  // Criar prioridades padrão para um departamento
  router.post("/departments/:departmentId/priorities/create-defaults", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { createDefaultPriorities } = await import('./api/priorities');
      await createDefaultPriorities(req, res);
    } catch (error) {
      console.error('Erro ao criar prioridades padrão:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao criar prioridades padrão" 
      });
    }
  });

  // Buscar todas as prioridades de uma empresa (para SLA Matrix)
  router.get("/department-priorities", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const { getAllCompanyPriorities } = await import('./api/department-priorities');
      await getAllCompanyPriorities(req, res);
    } catch (error) {
      console.error('Erro ao buscar prioridades da empresa:', error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao buscar prioridades da empresa" 
      });
    }
  });



  // Buscar configurações de email
  router.get("/email-config", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      let companyId = req.session.companyId;
      
      // Se for admin e especificou company_id na query, usar ele
      if (req.session.userRole === 'admin' && req.query.company_id) {
        companyId = parseInt(req.query.company_id as string);
      }
      
      const config = await emailConfigService.getEmailConfigForFrontend(companyId);
      res.json(config);
    } catch (error) {
      console.error('Erro ao buscar configurações de email:', error);
      res.status(500).json({ message: "Erro interno ao buscar configurações de email" });
    }
  });

  // Salvar configurações de email
  router.post("/email-config", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      let companyId = req.session.companyId;
      const config: any = { ...req.body };
      
      // Se for admin e especificou company_id no body, usar ele
      if (req.session.userRole === 'admin' && config.company_id) {
        companyId = config.company_id;
        // Remover company_id do config antes de salvar
        delete config.company_id;
      }
      
      // Debug: Logar o que está chegando
      console.log('[DEBUG] Dados recebidos no backend:', JSON.stringify(config, null, 2));
      console.log('[DEBUG] Company ID usado:', companyId);
      console.log('[DEBUG] Provider:', config.provider);
      console.log('[DEBUG] From email:', config.from_email);
      console.log('[DEBUG] API Key:', config.api_key ? '***mascarado***' : 'vazio');
      
      await emailConfigService.saveEmailConfigFromFrontend(config, companyId);
      
      console.log('[DEBUG] Configurações salvas com sucesso!');
      
      res.json({ 
        success: true, 
        message: "Configurações de email salvas com sucesso" 
      });
    } catch (error) {
      console.error('Erro ao salvar configurações de email:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro interno ao salvar configurações de email" });
    }
  });

  // Buscar templates de email
  router.get("/email-templates", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      let companyId = req.session.companyId;
      const type = req.query.type as string;
      
      // Se for admin e especificou company_id na query, usar ele
      if (req.session.userRole === 'admin' && req.query.company_id) {
        companyId = parseInt(req.query.company_id as string);
      }
      
      const templates = await emailConfigService.getEmailTemplates(companyId, type);
      
      // Se for uma requisição para verificar templates faltantes
      if (req.query.check_missing === 'true') {
        const allTemplateTypes = [
          'new_ticket',
          'ticket_assigned', 
          'ticket_reply',
          'status_changed',
          'ticket_resolved',
          'ticket_escalated',
          'ticket_due_soon',
          'customer_registered',
          'user_created',
          'system_maintenance',
          'ticket_participant_added',
          'ticket_participant_removed'
        ];
        
        const existingTypes = templates.map(t => t.type);
        const missingTypes = allTemplateTypes.filter(type => !existingTypes.includes(type));
        
        res.json({
          templates,
          missing: missingTypes,
          total_expected: allTemplateTypes.length,
          total_existing: templates.length,
          total_missing: missingTypes.length
        });
      } else {
        res.json(templates);
      }
    } catch (error) {
      console.error('Erro ao buscar templates de email:', error);
      res.status(500).json({ message: "Erro interno ao buscar templates de email" });
    }
  });

  // Criar template de email
  router.post("/email-templates", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      let companyId = req.session.companyId;
      const userId = req.session.userId;
      const templateData: any = { ...req.body };
      
      // Se for admin e especificou company_id no body, usar ele
      if (req.session.userRole === 'admin' && templateData.company_id) {
        companyId = templateData.company_id;
        // Remover company_id do templateData antes de salvar
        delete templateData.company_id;
      }
      
      const template = await emailConfigService.saveEmailTemplate({
        ...templateData,
        company_id: companyId,
        created_by_id: userId,
        updated_by_id: userId
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error('Erro ao criar template de email:', error);
      res.status(500).json({ message: "Erro interno ao criar template de email" });
    }
  });

  // Atualizar template de email
  router.put("/email-templates/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const userId = req.session.userId;
      const templateData: any = { ...req.body };
      
      // Se for admin e especificou company_id no body, remover antes de salvar
      if (req.session.userRole === 'admin' && templateData.company_id) {
        delete templateData.company_id;
      }
      
      const template = await emailConfigService.updateEmailTemplate(templateId, {
        ...templateData,
        updated_by_id: userId
      });
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Erro ao atualizar template de email:', error);
      res.status(500).json({ message: "Erro interno ao atualizar template de email" });
    }
  });

  // Deletar template de email
  router.delete("/email-templates/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      
      const success = await emailConfigService.deleteEmailTemplate(templateId);
      
      if (!success) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      res.json({ success: true, message: "Template deletado com sucesso" });
    } catch (error) {
      console.error('Erro ao deletar template de email:', error);
      res.status(500).json({ message: "Erro interno ao deletar template de email" });
    }
  });

  // Criar templates padrão de e-mail (modernos)
  router.post("/email-templates/seed-defaults", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      const userId = req.session.userId;
      
      // Para admin, pode receber company_id via body
      let targetCompanyId = companyId;
      if (req.session.userRole === 'admin' && req.body.company_id) {
        targetCompanyId = req.body.company_id;
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ message: 'Empresa não encontrada.' });
      }

      // Criar templates modernos (apenas se não existirem)
      const defaultTemplates = [
        {
          name: 'Novo Ticket',
          type: 'new_ticket',
          description: 'Notificação enviada quando um novo ticket é criado',
          subject_template: 'Novo ticket criado: {{ticket.ticket_id}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Ticket Criado</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER (logo ou nome da empresa) -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO / TÍTULO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Novo Ticket Criado</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Um novo ticket foi criado no sistema e requer sua atenção.
              </p>
            </td>
          </tr>

          <!-- DETALHES DO TICKET -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Cliente:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}} ({{customer.email}})</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Status:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.status_text}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">
                Esta é uma mensagem automática — por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>

        </table><!-- /container -->
      </td>
    </tr>
  </table><!-- /wrapper -->
</body>
</html>`,
          text_template: `Novo ticket criado: {{ticket.ticket_id}}
Título: {{ticket.title}}
Cliente: {{customer.name}} ({{customer.email}})
Prioridade: {{ticket.priority_text}}
Status: {{ticket.status_text}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','customer.name','customer.email','ticket.priority_text','ticket.status_text','ticket.link','user.name','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text','system.from_name'])
        },
        {
          name: 'Ticket Atribuído',
          type: 'ticket_assigned',
          description: 'Notificação enviada quando um ticket é atribuído a um atendente',
          subject_template: 'Ticket {{ticket.ticket_id}} atribuído a você',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Atribuído</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Ticket Atribuído</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Um ticket foi atribuído a você e requer sua atenção imediata.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Cliente:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}} ({{customer.email}})</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Status:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.status_text}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DESCRIÇÃO -->
          <tr>
            <td style="padding:0 40px 24px 40px;color:{{system.colors.text}};">
              <div style="background:{{system.colors.accent}};padding:16px;border-radius:6px;border-left:4px solid {{system.colors.primary}};">
                <p style="font-size:15px;margin:0;line-height:1.6;">{{ticket.description}}</p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">
                Esta é uma mensagem automática — por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Ticket atribuído a você: {{ticket.ticket_id}}
Título: {{ticket.title}}
Cliente: {{customer.name}} ({{customer.email}})
Prioridade: {{ticket.priority_text}}
Status: {{ticket.status_text}}
Descrição: {{ticket.description}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','customer.name','customer.email','ticket.priority_text','ticket.status_text','ticket.description','ticket.link','user.name','system.company_name','system.support_email','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Nova Resposta',
          type: 'ticket_reply',
          description: 'Notificação enviada quando há uma nova resposta no ticket',
          subject_template: 'Nova resposta no ticket {{ticket.ticket_id}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Resposta no Ticket</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Nova Resposta no Ticket</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Uma nova resposta foi adicionada ao ticket {{ticket.ticket_id}}.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}} - {{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Respondido por:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{reply.user.name}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Data:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{reply.created_at_formatted}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MENSAGEM -->
          <tr>
            <td style="padding:0 40px 24px 40px;color:{{system.colors.text}};">
              <div style="background:{{system.colors.accent}};padding:16px;border-radius:6px;border-left:4px solid {{system.colors.primary}};">
                <p style="font-size:15px;margin:0;line-height:1.6;">{{reply.message}}</p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">
                Esta é uma mensagem automática — por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Nova resposta no ticket {{ticket.ticket_id}}
Respondido por: {{reply.user.name}}
Data: {{reply.created_at_formatted}}
Mensagem: {{reply.message}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','reply.user.name','reply.created_at_formatted','reply.message','ticket.link','user.name','system.company_name','system.support_email','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Status Alterado',
          type: 'status_changed',
          description: 'Notificação enviada quando o status do ticket é alterado',
          subject_template: 'Ticket {{ticket.ticket_id}}: Status alterado para {{ticket.status_text}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Status do Ticket Alterado</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Status do Ticket Alterado</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                O status do ticket {{ticket.ticket_id}} foi alterado.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}} - {{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Status anterior:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{status_change.old_status_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Novo status:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{status_change.new_status_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Alterado por:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{status_change.changed_by.name}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Data:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{status_change.created_at_formatted}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">
                Esta é uma mensagem automática — por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Status do Ticket Alterado
Ticket: {{ticket.ticket_id}} - {{ticket.title}}
Status anterior: {{status_change.old_status_text}}
Novo status: {{status_change.new_status_text}}
Alterado por: {{status_change.changed_by.name}}
Data: {{status_change.created_at_formatted}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','status_change.old_status_text','status_change.new_status_text','status_change.changed_by.name','status_change.created_at_formatted','ticket.link','user.name','system.company_name','system.support_email','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Ticket Resolvido',
          type: 'ticket_resolved',
          description: 'Notificação enviada quando um ticket é resolvido',
          subject_template: 'Ticket {{ticket.ticket_id}} foi resolvido',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Resolvido</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Ticket Resolvido</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Seu ticket foi resolvido com sucesso! Agradecemos por utilizar nosso sistema de suporte.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Resolvido em:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.resolved_at_formatted}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Resolvido por:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{user.name}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">
                Esta é uma mensagem automática — por favor, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Ticket Resolvido
Ticket: {{ticket.ticket_id}}
Título: {{ticket.title}}
Resolvido em: {{ticket.resolved_at_formatted}}
Resolvido por: {{user.name}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','ticket.resolved_at_formatted','user.name','ticket.link','system.company_name','system.support_email','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Ticket Escalado',
          type: 'ticket_escalated',
          description: 'Notificação enviada quando um ticket é escalado',
          subject_template: 'Ticket {{ticket.ticket_id}} foi escalado',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Escalado</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Ticket Escalado</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                O ticket foi escalado para um nível superior de atendimento.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MOTIVO -->
          <tr>
            <td style="padding:0 40px 24px 40px;color:{{system.colors.text}};">
              <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:16px;margin:0;">
                <p style="font-size:15px;margin:0;color:#856404;line-height:1.6;">
                  <strong>Motivo da Escalação:</strong><br>
                  {{system.message}}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Ticket Escalado
Ticket: {{ticket.ticket_id}}
Título: {{ticket.title}}
Prioridade: {{ticket.priority_text}}
Motivo: {{system.message}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','ticket.priority_text','system.message','ticket.link'])
        },
        {
          name: 'Vencimento Próximo',
          type: 'ticket_due_soon',
          description: 'Notificação enviada quando um ticket está próximo do vencimento',
          subject_template: 'Ticket {{ticket.ticket_id}} próximo do vencimento',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Próximo do Vencimento</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Ticket Próximo do Vencimento</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Um ticket está próximo do vencimento e requer atenção imediata.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Ticket:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.ticket_id}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Cliente:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AVISO -->
          <tr>
            <td style="padding:0 40px 24px 40px;color:{{system.colors.text}};">
              <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:16px;margin:0;">
                <p style="font-size:15px;margin:0;color:#856404;line-height:1.6;">
                  <strong>Atenção:</strong><br>
                  {{system.message}}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;font-size:14px;">
                Ver Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Ticket Próximo do Vencimento
Atenção: {{system.message}}
Ticket: {{ticket.ticket_id}}
Título: {{ticket.title}}
Cliente: {{customer.name}}
Prioridade: {{ticket.priority_text}}
Ver Ticket: {{ticket.link}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['ticket.ticket_id','ticket.title','customer.name','ticket.priority_text','system.message','ticket.link'])
        },
        {
          name: 'Cliente Registrado',
          type: 'customer_registered',
          description: 'Notificação enviada quando um novo cliente é registrado',
          subject_template: 'Novo cliente registrado: {{customer.name}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Cliente Registrado</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Novo Cliente Registrado</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Um novo cliente foi registrado no sistema.
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Nome:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Email:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.email}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Empresa:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.company}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Telefone:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.phone}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Novo Cliente Registrado
Nome: {{customer.name}}
Email: {{customer.email}}
Empresa: {{customer.company}}
Telefone: {{customer.phone}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['customer.name','customer.email','customer.company','customer.phone'])
        },
        {
          name: 'Usuário Criado',
          type: 'user_created',
          description: 'Notificação enviada quando um novo usuário é criado',
          subject_template: 'Novo usuário criado: {{user.name}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Usuário Criado</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Novo Usuário Criado</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                {{system.message}}
              </p>
            </td>
          </tr>

          <!-- DETALHES -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Nome:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{user.name}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Email:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{user.email}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Função:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{user.role_text}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          text_template: `Novo Usuário Criado
{{system.message}}
Nome: {{user.name}}
Email: {{user.email}}
Função: {{user.role_text}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['user.name','user.email','user.role_text','system.message'])
        },
        {
          name: 'Manutenção do Sistema',
          type: 'system_maintenance',
          description: 'Notificação enviada para avisar sobre manutenção do sistema',
          subject_template: 'Manutenção Programada do Sistema',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manutenção Programada</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER (logo ou nome da empresa) -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO / TÍTULO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Manutenção Programada</h2>
              <p style="font-size:16px;margin:0;line-height:1.6;">
                {{system.message}}
              </p>
            </td>
          </tr>

          <!-- DETALHES DA MANUTENÇÃO -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Início:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{system.maintenance_start}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Término previsto:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{system.maintenance_end}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AVISO IMPORTANTE -->
          <tr>
            <td style="padding:0 40px 32px 40px;color:{{system.colors.text}};">
              <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:16px;margin:0;">
                <p style="font-size:15px;margin:0;color:#856404;">
                  <strong>⚠️ Atenção:</strong> Durante este período, o sistema poderá ficar indisponível.
                </p>
              </div>
            </td>
          </tr>

          <!-- MENSAGEM FINAL -->
          <tr>
            <td style="padding:0 40px 32px 40px;color:{{system.colors.text}};">
              <p style="font-size:16px;margin:0;line-height:1.6;">
                Agradecemos a compreensão e pedimos desculpas pelos transtornos.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>

        </table><!-- /container -->
      </td>
    </tr>
  </table><!-- /wrapper -->
</body>
</html>`,
          text_template: `Manutenção Programada
{{system.message}}

Início: {{system.maintenance_start}}
Término previsto: {{system.maintenance_end}}

⚠️ Atenção: Durante este período, o sistema poderá ficar indisponível.

Agradecemos a compreensão e pedimos desculpas pelos transtornos.

Atenciosamente,
{{system.from_name}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['system.message','system.maintenance_start','system.maintenance_end','system.company_name','system.from_name','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Participante Adicionado',
          type: 'ticket_participant_added',
          description: 'Notificação enviada quando um participante é adicionado ao ticket',
          subject_template: 'Você foi adicionado como participante do ticket {{ticket.ticket_id}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi adicionado como participante</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER (logo ou nome da empresa) -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO / TÍTULO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Você foi adicionado como participante!</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Você foi adicionado como participante do ticket <strong>{{ticket.ticket_id}}</strong> por {{official.name}}.
              </p>
            </td>
          </tr>

          <!-- DETALHES DO TICKET -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Status:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.status_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Criado em:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.created_at_formatted}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Cliente:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}} ({{customer.email}})</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA (link para o ticket) -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:15px;font-weight:bold;display:inline-block;">
                Acompanhar Ticket
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>

        </table><!-- /container -->
      </td>
    </tr>
  </table><!-- /wrapper -->
</body>
</html>`,
          text_template: `Você foi adicionado como participante!
Olá {{user.name}},

Você foi adicionado como participante do ticket {{ticket.ticket_id}} por {{official.name}}.

Detalhes do Ticket:
- Título: {{ticket.title}}
- Status: {{ticket.status_text}}
- Prioridade: {{ticket.priority_text}}
- Criado em: {{ticket.created_at_formatted}}
- Cliente: {{customer.name}} ({{customer.email}})

Para acompanhar este ticket, acesse: {{ticket.link}}

Atenciosamente,
{{system.from_name}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['user.name','ticket.ticket_id','official.name','ticket.title','ticket.status_text','ticket.priority_text','ticket.created_at_formatted','customer.name','customer.email','ticket.link','system.company_name','system.from_name','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        },
        {
          name: 'Participante Removido',
          type: 'ticket_participant_removed',
          description: 'Notificação enviada quando um participante é removido do ticket',
          subject_template: 'Você foi removido como participante do ticket {{ticket.ticket_id}}',
          html_template: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi removido do ticket</title>
</head>

<body style="margin:0;padding:0;background:{{system.colors.background}};">
  <!-- 100% wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{{system.colors.background}};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- CARD / CONTAINER -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER (logo ou nome da empresa) -->
          <tr>
            <td align="center" style="background:{{system.colors.primary}};padding:24px;">
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">{{system.company_name}}</h1>
            </td>
          </tr>

          <!-- HERO / TÍTULO -->
          <tr>
            <td style="padding:32px 40px 16px 40px;color:{{system.colors.text}};">
              <h2 style="font-size:20px;margin:0 0 12px 0;color:{{system.colors.text}};">Você foi removido como participante</h2>
              <p style="font-size:16px;margin:0;">Olá {{user.name}},</p>
              <p style="font-size:16px;margin:16px 0 0 0;line-height:1.6;">
                Você foi removido do ticket <strong>{{ticket.ticket_id}}</strong> por {{official.name}}.
              </p>
            </td>
          </tr>

          <!-- DETALHES DO TICKET -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="font-size:15px;border-collapse:collapse;margin:0 0 24px 0;background:{{system.colors.secondary}};border-radius:6px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;font-weight:600;width:120px;background:{{system.colors.accent}};color:{{system.colors.text}};">Título:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.title}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Status:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.status_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Prioridade:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{ticket.priority_text}}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-weight:600;background:{{system.colors.accent}};color:{{system.colors.text}};">Cliente:</td>
                  <td style="padding:12px 16px;color:{{system.colors.text}};">{{customer.name}} ({{customer.email}})</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA opcional (link para o ticket) -->
          <tr>
            <td align="center" style="padding:0 40px 32px 40px;">
              <a href="{{ticket.link}}"
                 style="background:{{system.colors.primary}};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:15px;font-weight:bold;display:inline-block;">
                Abrir Ticket
              </a>
            </td>
          </tr>

          <!-- AVISO -->
          <tr>
            <td style="padding:0 40px 32px 40px;color:{{system.colors.text}};">
              <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:16px;margin:0;">
                <p style="font-size:15px;margin:0;color:#856404;">
                  Você não receberá mais notificações sobre este ticket.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background:{{system.colors.secondary}};padding:24px;font-size:13px;color:#666666;">
              <p style="margin:0;">Atenciosamente,<br><strong>{{system.from_name}}</strong></p>
              <p style="margin:8px 0 0 0;font-style:italic;color:#888888;">Esta é uma mensagem automática — por favor, não responda a este e-mail.</p>
            </td>
          </tr>

        </table><!-- /container -->
      </td>
    </tr>
  </table><!-- /wrapper -->
</body>
</html>`,
          text_template: `Você foi removido como participante
Olá {{user.name}},

Você foi removido como participante do ticket {{ticket.ticket_id}} por {{official.name}}.

Detalhes do Ticket:
- Título: {{ticket.title}}
- Status: {{ticket.status_text}}
- Prioridade: {{ticket.priority_text}}

Cliente: {{customer.name}} ({{customer.email}})

Você não receberá mais notificações sobre este ticket.

Atenciosamente,
{{system.from_name}}`,
          is_active: true,
          is_default: true,
          available_variables: JSON.stringify(['user.name','ticket.ticket_id','official.name','ticket.title','ticket.status_text','ticket.priority_text','customer.name','customer.email','ticket.link','system.company_name','system.from_name','system.colors.primary','system.colors.secondary','system.colors.accent','system.colors.background','system.colors.text'])
        }
      ];

      // Verificar templates existentes antes de criar
      const existingTemplates = await emailConfigService.getEmailTemplates(targetCompanyId);
      const existingTypes = new Set(existingTemplates.map(t => t.type));
      
      let created = 0;
      let skipped = 0;
      
      // Salvar apenas templates que não existem
      for (const template of defaultTemplates) {
        if (existingTypes.has(template.type)) {
          console.log(`Template ${template.type} já existe para empresa ${targetCompanyId}, pulando...`);
          skipped++;
          continue;
        }
        
        try {
          await emailConfigService.saveEmailTemplate({
            ...template,
            company_id: targetCompanyId,
            created_by_id: userId,
            updated_by_id: userId
          });
          created++;
          console.log(`Template ${template.type} criado com sucesso para empresa ${targetCompanyId}`);
        } catch (error) {
          console.error(`Erro ao criar template ${template.type}:`, error);
          // Continuar com os próximos templates mesmo se um falhar
        }
      }

      if (created === 0 && skipped > 0) {
        res.json({ 
          success: true, 
          message: `Todos os templates padrão já existem para esta empresa (${skipped} templates encontrados)`,
          created,
          skipped
        });
      } else {
        res.json({ 
          success: true, 
          message: `Templates padrão processados com sucesso (${created} criados, ${skipped} já existiam)`,
          created,
          skipped
        });
      }
    } catch (error) {
      console.error('Erro ao criar templates padrão de e-mail:', error);
      res.status(500).json({ message: "Erro interno ao criar templates padrão de e-mail" });
    }
  });



  // Buscar configurações do sistema (incluindo cores da empresa)
  router.get("/system-config", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      
      // Para admin, pode receber company_id via query
      let targetCompanyId = companyId;
      if (req.session.userRole === 'admin' && req.query.company_id) {
        targetCompanyId = parseInt(req.query.company_id as string);
      }
      
      if (!targetCompanyId) {
        return res.status(400).json({ message: 'Empresa não encontrada.' });
      }

      // Buscar configurações de cores da empresa
      const colorSettings = await db
        .select()
        .from(schema.systemSettings)
        .where(
          and(
            eq(schema.systemSettings.company_id, targetCompanyId),
            inArray(schema.systemSettings.key, [
              'theme_primary',
              'theme_secondary', 
              'theme_accent',
              'theme_background',
              'theme_text'
            ])
          )
        );

      // Converter para objeto
      const colors: Record<string, string> = {};
      colorSettings.forEach(setting => {
        colors[setting.key] = setting.value;
      });

      // Buscar outras configurações da empresa
      const companyName = await getSystemSetting('companyName', 'Sistema de Tickets', targetCompanyId);
      const fromName = await getSystemSetting('from_name', 'Service Desk - Sistema de Chamados', targetCompanyId);
      const fromEmail = await getSystemSetting('from_email', 'noreply@empresa.com', targetCompanyId);

      res.json({
        success: true,
        data: {
          colors,
          company_name: companyName,
          from_name: fromName,
          from_email: fromEmail
        }
      });
    } catch (error) {
      console.error('Erro ao buscar configurações do sistema:', error);
      res.status(500).json({ message: "Erro interno ao buscar configurações do sistema" });
    }
  });

  // Testar conexão de email
  router.post("/email-config/test", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const config: SMTPConfigInput = req.body;
      
      const result = await emailConfigService.testEmailConnection(config);
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao testar conexão de email:', error);
      res.status(500).json({ 
        success: false, 
        error: "Erro interno ao testar conexão de email" 
      });
    }
  });

  // Rotas para controle do sistema de notificações
  router.post("/notifications/scheduler/start", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      schedulerService.start();
      res.json({ success: true, message: "Scheduler de notificações iniciado" });
    } catch (error) {
      console.error('Erro ao iniciar scheduler:', error);
      res.status(500).json({ message: "Erro ao iniciar scheduler", error: String(error) });
    }
  });

  router.post("/notifications/scheduler/stop", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      schedulerService.stop();
      res.json({ success: true, message: "Scheduler de notificações parado" });
    } catch (error) {
      console.error('Erro ao parar scheduler:', error);
      res.status(500).json({ message: "Erro ao parar scheduler", error: String(error) });
    }
  });

  router.get("/notifications/scheduler/status", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      const isRunning = schedulerService.isSchedulerRunning();
      res.json({ isRunning, message: isRunning ? "Scheduler está rodando" : "Scheduler está parado" });
    } catch (error) {
      console.error('Erro ao verificar status do scheduler:', error);
      res.status(500).json({ message: "Erro ao verificar status do scheduler", error: String(error) });
    }
  });

  router.post("/notifications/scheduler/check-now", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      await schedulerService.runManualCheck();
      res.json({ success: true, message: "Verificação manual de tickets executada" });
    } catch (error) {
      console.error('Erro ao executar verificação manual:', error);
      res.status(500).json({ message: "Erro ao executar verificação manual", error: String(error) });
    }
  });

  // Rota para executar digest diário manual
  router.post("/notifications/scheduler/daily-digest", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      await schedulerService.runManualDailyDigest();
      res.json({ success: true, message: "Digest diário executado manualmente" });
    } catch (error) {
      console.error('Erro ao executar digest diário manual:', error);
      res.status(500).json({ message: "Erro ao executar digest diário manual", error: String(error) });
    }
  });

  // Rota para executar digest semanal manual
  router.post("/notifications/scheduler/weekly-digest", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { schedulerService } = await import("./services/scheduler-service");
      await schedulerService.runManualWeeklyDigest();
      res.json({ success: true, message: "Digest semanal executado manualmente" });
    } catch (error) {
      console.error('Erro ao executar digest semanal manual:', error);
      res.status(500).json({ message: "Erro ao executar digest semanal manual", error: String(error) });
    }
  });

  // Rota para enviar notificação de manutenção do sistema
  router.post("/notifications/system-maintenance", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const { maintenance_start, maintenance_end, message, company_id } = req.body;

      if (!maintenance_start || !maintenance_end || !message) {
        return res.status(400).json({ 
          message: "Campos obrigatórios: maintenance_start, maintenance_end, message" 
        });
      }

      const startDate = new Date(maintenance_start);
      const endDate = new Date(maintenance_end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          message: "Datas de manutenção inválidas" 
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({ 
          message: "Data de início deve ser anterior à data de fim" 
        });
      }

      await emailNotificationService.notifySystemMaintenance(
        startDate,
        endDate,
        message,
        company_id || undefined
      );

      res.json({ 
        success: true, 
        message: "Notificação de manutenção enviada com sucesso",
        details: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          affected_company: company_id || "Todas as empresas"
        }
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de manutenção:', error);
      res.status(500).json({ message: "Erro ao enviar notificação de manutenção", error: String(error) });
    }
  });

  // Rota para testar notificação de escalação manual
  router.post("/notifications/escalate-ticket/:ticketId", authRequired, adminRequired, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { reason } = req.body;

      if (isNaN(ticketId)) {
        return res.status(400).json({ message: "ID de ticket inválido" });
      }

      await emailNotificationService.notifyTicketEscalated(
        ticketId,
        req.session?.userId,
        reason || "Ticket escalado manualmente por administrador"
      );

      res.json({ 
        success: true, 
        message: "Notificação de escalação enviada com sucesso" 
      });
    } catch (error) {
      console.error('Erro ao escalar ticket:', error);
      res.status(500).json({ message: "Erro ao escalar ticket", error: String(error) });
    }
  });

  // --- FIM DAS ROTAS DE ANEXOS ---

  // === ROTAS DE SEGURANÇA E MONITORAMENTO ===
  
  // Health check público
  router.get("/health", healthCheck);
  
  // Relatório de segurança (apenas admin)
  router.get("/security/report", authRequired, adminRequired, getSecurityReport);
  
  // Estatísticas do sistema (apenas admin)
  router.get("/security/stats", authRequired, adminRequired, getSystemStats);
  
  // Estatísticas de performance (apenas admin)
  router.get("/performance/stats", authRequired, adminRequired, performanceStatsHandler);
  
  // Limpar logs de segurança (apenas admin)
  router.post("/security/clear-logs", authRequired, adminRequired, clearSecurityLogs);
  
  // Endpoint para forçar um evento de segurança (desenvolvimento/teste)
  router.post("/security/test-event", authRequired, adminRequired, (req: Request, res: Response) => {
    const { event, severity = 'medium', details = {} } = req.body;
    
    if (!event) {
      return res.status(400).json({ message: "Campo 'event' é obrigatório" });
    }
    
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      event,
      severity,
      { ...details, testEvent: true, triggeredBy: req.session?.userId }
    );
    
    res.json({ 
      success: true, 
      message: `Evento de segurança '${event}' registrado com severidade '${severity}'` 
    });
  });

  // --- ROTAS DE IA ---
  
  // Listar configurações de IA
  router.get("/ai-configurations", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), getAiConfigurations);
  
  // Buscar provedores e modelos disponíveis
  router.get("/ai-configurations/providers", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), getAiProviders);
  
  // Endpoints de admin para gerenciar provedores e tokens
  router.get("/ai-configurations/admin/providers", authRequired, authorize(['admin']), getAiProvidersAdmin);
  router.put("/ai-configurations/admin/providers", authRequired, authorize(['admin']), updateAiProvidersAdmin);
  
  // Endpoints de admin para gerenciar permissões de IA das empresas
  router.get("/ai-configurations/admin/companies", authRequired, authorize(['admin']), getAiCompanies);
  router.put("/ai-configurations/admin/companies/:id/permission", authRequired, authorize(['admin']), updateAiCompanyPermission);
  
  // Criar nova configuração de IA
  router.post("/ai-configurations", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), createAiConfiguration);
  
  // Atualizar configuração de IA
  router.put("/ai-configurations/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), updateAiConfiguration);
  
  // Deletar configuração de IA
  router.delete("/ai-configurations/:id", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), deleteAiConfiguration);
  
  // Testar configuração de IA
  router.post("/ai-configurations/test", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), testAiConfiguration);

  // --- FIM DAS ROTAS DE IA ---

  // --- ROTAS DE PERMISSÕES DE EMPRESA ---
  
  // Listar todas as empresas com suas permissões (apenas admin)
  router.get("/companies-permissions", authRequired, authorize(['admin']), getAllCompaniesPermissions);
  
  // Buscar permissões de uma empresa específica (apenas admin)
  router.get("/company-permissions/:companyId", authRequired, authorize(['admin']), getCompanyPermissions);
  
  // Atualizar permissões de uma empresa (apenas admin)
  router.put("/company-permissions/:companyId", authRequired, authorize(['admin']), updateCompanyPermissions);
  
  // Buscar configurações de uso de IA para company_admin, manager e supervisor
  router.get("/settings/ai-usage", authRequired, authorize(['company_admin', 'manager', 'supervisor']), getAiUsageSettings);
  
  // Atualizar configurações de uso de IA para company_admin, manager e supervisor
  router.put("/settings/ai-usage", authRequired, authorize(['company_admin', 'manager', 'supervisor']), updateAiUsageSettings);

  // --- FIM DAS ROTAS DE PERMISSÕES ---

  // === ROTAS DE RESOLUÇÃO DE SLA ===
  
  // Resolver SLA para um ticket
  router.post("/sla/resolve", authRequired, resolveSLA);
router.get("/sla/resolve", authRequired, async (req, res) => {
  // Suporte para GET com query parameters (compatibilidade)
  const { companyId, departmentId, incidentTypeId, priority } = req.query;
  
  // Converter para body format e chamar a função original
  req.body = {
    companyId: parseInt(companyId as string),
    departmentId: parseInt(departmentId as string),
    incidentTypeId: parseInt(incidentTypeId as string),
    priority: priority as string
  };
  
  return resolveSLA(req, res);
});
  
  // Estatísticas do cache de SLA (apenas admins)
  router.get("/sla/cache/stats", authRequired, adminRequired, getCacheStats);
  
  // Pré-carregar cache de SLA
  router.post("/sla/cache/preload", authRequired, adminRequired, preloadCache);
  
  // Limpar cache expirado
  router.delete("/sla/cache", authRequired, adminRequired, cleanCache);

  // --- FIM DAS ROTAS DE SLA ---

  // === ROTAS DE CONFIGURAÇÕES SLA ===
  
  // CRUD básico de configurações SLA
  router.get("/sla-configurations", authRequired, getSLAConfigurations);
  router.get("/sla-configurations/:id", authRequired, getSLAConfigurationById);
  router.post("/sla-configurations", authRequired, createSLAConfiguration);
  router.put("/sla-configurations/:id", authRequired, updateSLAConfiguration);
  router.delete("/sla-configurations/:id", authRequired, deleteSLAConfiguration);
  
  // Bulk operations
  router.post("/sla-configurations/bulk", authRequired, bulkCreateSLAConfigurations);
  router.put("/sla-configurations/bulk", authRequired, bulkUpdateSLAConfigurations);
  router.delete("/sla-configurations/bulk", authRequired, bulkDeleteSLAConfigurations);
  router.patch("/sla-configurations/bulk/toggle", authRequired, bulkToggleActiveSLAConfigurations);
  
  // Operações especiais
  router.post("/sla-configurations/copy", authRequired, copySLAConfigurations);
  router.post("/sla-configurations/validate", authRequired, validateSLAConfiguration);
  router.post("/sla-configurations/import-csv", authRequired, importSLAConfigurationsCSV);

  // === ROTAS DO DASHBOARD SLA ===
  
  // Dashboard de estatísticas SLA
  router.get("/sla-dashboard/stats", authRequired, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Empresa não identificada" });
      }

      const departmentIds = req.query.departments ? 
        (req.query.departments as string).split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : 
        undefined;

      const stats = await slaApi.getDashboardStats(companyId, departmentIds);
      res.json(stats);
    } catch (error) {
      console.error('Erro ao obter estatísticas do dashboard SLA:', error);
      res.status(500).json({ 
        message: "Erro ao carregar estatísticas do dashboard SLA", 
        error: String(error) 
      });
    }
  });

  // Visão geral de configurações por departamento
  router.get("/sla-dashboard/department/:departmentId", authRequired, async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Empresa não identificada" });
      }

      const departmentId = parseInt(req.params.departmentId);
      if (isNaN(departmentId)) {
        return res.status(400).json({ message: "ID do departamento inválido" });
      }

      const overview = await slaApi.getDepartmentOverview(companyId, departmentId);
      res.json(overview);
    } catch (error) {
      console.error('Erro ao obter visão geral do departamento:', error);
      res.status(500).json({ 
        message: "Erro ao carregar visão geral do departamento", 
        error: String(error) 
      });
    }
  });

  // --- FIM DAS ROTAS DO DASHBOARD SLA ---

  // --- FIM DAS ROTAS DE CONFIGURAÇÕES SLA ---

  // === NOVAS ROTAS PARA COMPANY_ADMIN ===
  
  // Endpoint para listar usuários (todos para admin, apenas da empresa para outros)
  router.get("/company/users", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor', 'support', 'customer']), async (req: Request, res: Response) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const companyId = req.session.companyId;
      const userRole = req.session.userRole;
      
      // Buscar usuários
      const allUsers = includeInactive ? 
        await storage.getAllUsers() : 
        await storage.getActiveUsers();
      
      // Filtrar usuários baseado no papel do usuário
      let filteredUsers;
      if (userRole === 'admin') {
        // Admin vê TODOS os usuários do sistema
        filteredUsers = allUsers;
      } else {
        // Outros papéis veem apenas usuários da sua empresa
        if (!companyId) {
          return res.status(400).json({ message: "Empresa não identificada" });
        }
        filteredUsers = allUsers.filter(user => user.company_id === companyId);
      }
      
      // Não retornar as senhas
      const usersWithoutPasswords = filteredUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ message: "Falha ao listar usuários", error: String(error) });
    }
  });
  
  // Endpoint para company_admin listar clientes da sua empresa
  router.get("/company/customers", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Empresa não identificada" });
      }
      
      // Buscar todos os clientes
      const allCustomers = await storage.getCustomers();
      
      // Filtrar por empresa
      const companyCustomers = allCustomers.filter(customer => customer.company_id === companyId);
      
      res.json(companyCustomers);
    } catch (error) {
      console.error('Erro ao listar clientes da empresa:', error);
      res.status(500).json({ message: "Falha ao listar clientes da empresa", error: String(error) });
    }
  });
  
  // Endpoint para company_admin listar departamentos da sua empresa
  router.get("/company/departments", authRequired, authorize(['admin', 'company_admin', 'manager', 'supervisor']), async (req: Request, res: Response) => {
    try {
      const companyId = req.session.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Empresa não identificada" });
      }
      
      // Buscar departamentos da empresa
      const departments = await db
        .select()
        .from(schema.departments)
        .where(eq(schema.departments.company_id, companyId))
        .orderBy(schema.departments.name);
      
      res.json(departments);
    } catch (error) {
      console.error('Erro ao listar departamentos da empresa:', error);
      res.status(500).json({ message: "Falha ao listar departamentos da empresa", error: String(error) });
    }
  });

  // Registrar router do dashboard
  app.use("/api/tickets", dashboardRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/ticket-participants", ticketParticipantsRouter);
  
  // Registrar rotas de relatórios
  app.use("/api/reports", reportsRouter);
  
  app.use("/api", router);
  
  // Criar servidor HTTP
  const httpServer = createServer(app);
  
  // Interface para WebSocket com heartbeat
  interface WebSocketWithAlive extends WebSocket {
    isAlive?: boolean;
  }
  
  // Configurar o servidor WebSocket com configurações mais flexíveis
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Configurações mais permissivas
    verifyClient: (info: any) => {
      // Em desenvolvimento, aceitar tudo
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔓 [DEV] WebSocket aceito de origem: ${info.origin || 'sem origin'}`);
        return true;
      }
      
      // Em produção, verificar origin
      const origin = info.origin;
      const allowedOrigins = [
        'https://suporte.oficinamuda.com.br',
        'http://suporte.oficinamuda.com.br',
        'https://oficinamuda.com.br',
        'http://oficinamuda.com.br',
        'https://app.ticketwise.com.br',
        'http://app.ticketwise.com.br',
        'https://suporte.vixbrasil.com',
        'http://suporte.vixbrasil.com',
        'https://ticketwise.com.br',
        'http://ticketwise.com.br',
        'https://vixbrasil.com',
        'http://vixbrasil.com'
      ];
      
      // Permitir origins conhecidos ou sem origin (requests diretos)
      if (!origin || allowedOrigins.includes(origin)) {
        console.log(`✅ [PROD] WebSocket aceito de origem conhecida: ${origin || 'request direto'}`);
        return true;
      }
      
      // Permitir qualquer subdomínio dos domínios permitidos
      const allowedDomains = [
        '.oficinamuda.com.br',
        '.ticketwise.com.br', 
        '.vixbrasil.com'
      ];
      
      for (const domain of allowedDomains) {
        if (origin && origin.includes(domain)) {
          console.log(`✅ [PROD] WebSocket aceito de subdomínio: ${origin}`);
          return true;
        }
      }
      
      // Permitir qualquer IP (regex para IPs)
      const ipRegex = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      if (origin && ipRegex.test(origin)) {
        console.log(`✅ [PROD] WebSocket aceito de IP: ${origin}`);
        return true;
      }
      
      // Permitir localhost para testes
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        console.log(`✅ [PROD] WebSocket aceito de localhost: ${origin}`);
        return true;
      }
      
      console.log(`🚫 WebSocket bloqueado para origem: ${origin}`);
      return false;
    }
  });
  
  // Lidar com conexões WebSocket de forma mais robusta
  wss.on('connection', (ws: WebSocketWithAlive, req) => {
    console.log(`Nova conexão WebSocket recebida de: ${req.socket.remoteAddress}`);
    
    // Configurar heartbeat para manter conexão viva
    ws.isAlive = true;
    ws.on('pong', () => {
      if (ws.isAlive !== undefined) {
        ws.isAlive = true;
      }
    });
    
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
    
    // Lidar com erros
    ws.on('error', (error) => {
      console.error('Erro WebSocket:', error);
      notificationService.removeClient(ws);
    });
  });
  
  // Implementar heartbeat para manter conexões vivas
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocketWithAlive) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // A cada 30 segundos
  
  // Limpar interval quando servidor fechar
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  return httpServer;

}