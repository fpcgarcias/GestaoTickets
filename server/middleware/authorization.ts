import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { users, tickets, ticketParticipants, customers, officials, departments, officialDepartments } from '@shared/schema';
import { storage } from '../storage';

// 🔥 FASE 5.2: Middleware para verificar se o usuário está autenticado
export function authRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  // Popular req.user com dados da sessão para compatibilidade
  (req as any).user = {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.userRole,
    companyId: req.session.companyId
  };
  
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário é admin
export function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ message: "Acesso negado: Requer perfil de Administrador" });
  }
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário é company_admin ou admin geral
export function companyAdminRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  const userRole = req.session.userRole;
  
  if (!userRole || !['admin', 'company_admin'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
  }
  
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário é manager
export function managerRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário é supervisor ou superior
export function supervisorRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário é triage ou superior
export function triageRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (!userRole || !['admin', 'company_admin', 'manager', 'supervisor', 'support', 'triage'].includes(userRole)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário pode visualizar tickets (todas as roles exceto integration_bot)
export function viewerRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const userRole = req.session.userRole as string;
  if (userRole === 'integration_bot') {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário tem um dos papéis especificados
export function authorize(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const userRole = req.session.userRole as string;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    next();
  };
}

// 🔥 FASE 5.2: Middleware para verificar acesso por empresa
export function companyAccessRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const userRole = req.session.userRole as string;
  const userCompanyId = req.session.companyId;

  // Admin tem acesso global
  if (userRole === 'admin') {
    return next();
  }

  // Para outros roles, verificar se têm empresa associada
  if (!userCompanyId) {
    return res.status(403).json({ 
      message: "Acesso negado: Usuário não possui empresa associada" 
    });
  }

  // Verificar se o usuário está tentando acessar recursos de outra empresa
  const targetCompanyId = req.params.companyId || req.body.company_id || req.query.companyId;
  
  if (targetCompanyId && parseInt(targetCompanyId as string) !== userCompanyId) {
    return res.status(403).json({ 
      message: "Acesso negado: Não é possível acessar recursos de outra empresa" 
    });
  }

  next();
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário tem acesso a um ticket específico
export function ticketAccessRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const ticketId = parseInt(req.params.ticketId || req.params.id);
  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ message: "ID do ticket inválido" });
  }

  const userRole = req.session.userRole as string;
  const userCompanyId = req.session.companyId;
  const userId = req.session.userId;

  // Verificar acesso ao ticket
  storage.getTicket(ticketId, userRole, userCompanyId)
    .then(ticket => {
      if (!ticket) {
        return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
      }

      // Admin tem acesso global
      if (userRole === 'admin') {
        return next();
      }

      // Verificar se o usuário é participante do ticket
      return storage.isUserTicketParticipant(ticketId, userId)
        .then(isParticipant => {
          if (isParticipant) {
            return next(); // Participante tem acesso
          }

          // Verificar permissões baseadas na role
          if (['company_admin', 'manager', 'supervisor', 'support', 'triage'].includes(userRole)) {
            return next(); // Roles de atendimento têm acesso
          }

          // Para clientes, verificar se é o criador do ticket
          if (userRole === 'customer') {
            if (ticket.customer_id) {
              return db
                .select()
                .from(customers)
                .where(eq(customers.id, ticket.customer_id))
                .limit(1)
                .then(([customer]) => {
                  if (customer?.user_id === userId) {
                    return next(); // Criador tem acesso
                  }
                  return res.status(403).json({ message: "Acesso negado: Apenas o criador do ticket pode acessar" });
                });
            }
            return res.status(403).json({ message: "Acesso negado: Apenas o criador do ticket pode acessar" });
          }

          return res.status(403).json({ message: "Acesso negado: Permissão insuficiente para acessar este ticket" });
        });
    })
    .catch(error => {
      console.error('Erro ao verificar acesso ao ticket:', error);
      return res.status(500).json({ message: "Erro interno ao verificar permissões" });
    });
}

// 🔥 FASE 5.2: Middleware para verificar permissões de participantes
export function participantManagementRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const userRole = req.session.userRole as string;
  const userId = req.session.userId;
  const ticketId = parseInt(req.params.ticketId);

  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ message: "ID do ticket inválido" });
  }

  // Papéis que sempre podem gerenciar participantes
  const allowedRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
  
  if (allowedRoles.includes(userRole)) {
    return next();
  }
  
  // Para clientes, verificar se é o criador do ticket ou participante (ou se é também official)
  if (userRole === 'customer') {
    // 🔥 FASE 5.3: Verificar se o customer também é official (atendente)
    db
      .select()
      .from(officials)
      .where(and(
        eq(officials.user_id, userId),
        eq(officials.is_active, true)
      ))
      .limit(1)
      .then(([official]) => {
        if (official) {
          // Customer que também é official pode gerenciar participantes
          console.log(`[PERMISSÃO] ✅ Usuário ${userId} é customer MAS também é official - gerenciamento de participantes permitido`);
          return next();
        }
        
        // Customer normal: verificar se é criador ou participante
        storage.getTicket(ticketId, userRole, req.session?.companyId)
          .then(ticket => {
            if (!ticket) {
              return res.status(404).json({ message: "Ticket não encontrado" });
            }
            
            const creatorUserId = ticket.customer?.user_id;
            if (userId === creatorUserId) {
              return next(); // Criador pode gerenciar participantes
            }
            
            // Verificar se é participante do ticket
            return storage.isUserTicketParticipant(ticketId, userId)
              .then(isParticipant => {
                if (isParticipant) {
                  return next(); // Participante pode gerenciar participantes
                }
                return res.status(403).json({ message: "Acesso negado: Apenas criadores e participantes podem gerenciar participantes" });
              });
          })
          .catch(error => {
            console.error('Erro ao verificar permissões de participantes:', error);
            return res.status(500).json({ message: "Erro interno do servidor" });
          });
      })
      .catch(error => {
        console.error('Erro ao verificar se usuário é também official:', error);
        return res.status(500).json({ message: "Erro interno do servidor" });
      });
  } else {
    return res.status(403).json({ message: "Acesso negado: Permissão insuficiente para gerenciar participantes" });
  }
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário pode adicionar participantes
export function canAddParticipants(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const userRole = req.session.userRole as string;
  const userId = req.session.userId;
  const ticketId = parseInt(req.params.ticketId);

  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ message: "ID do ticket inválido" });
  }

  // Papéis que sempre podem adicionar participantes
  const allowedRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
  
  if (allowedRoles.includes(userRole)) {
    return next();
  }
  
  // Para clientes, verificar se é o criador do ticket
  if (userRole === 'customer') {
    storage.getTicket(ticketId, userRole, req.session?.companyId)
      .then(ticket => {
        if (!ticket) {
          return res.status(404).json({ message: "Ticket não encontrado" });
        }
        
        const creatorUserId = ticket.customer?.user_id;
        if (userId === creatorUserId) {
          return next(); // Criador pode adicionar participantes
        }
        
        return res.status(403).json({ message: "Acesso negado: Apenas o criador do ticket pode adicionar participantes" });
      })
      .catch(error => {
        console.error('Erro ao verificar permissões de adição de participantes:', error);
        return res.status(500).json({ message: "Erro interno do servidor" });
      });
  } else {
    return res.status(403).json({ message: "Acesso negado: Permissão insuficiente para adicionar participantes" });
  }
}

// 🔥 FASE 5.2: Middleware para verificar se o usuário pode remover participantes
export function canRemoveParticipants(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const userRole = req.session.userRole as string;
  const userId = req.session.userId;
  const ticketId = parseInt(req.params.ticketId);

  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ message: "ID do ticket inválido" });
  }

  // Papéis que sempre podem remover participantes
  const allowedRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
  
  if (allowedRoles.includes(userRole)) {
    return next();
  }
  
  // Para clientes, verificar se é o criador do ticket
  if (userRole === 'customer') {
    storage.getTicket(ticketId, userRole, req.session?.companyId)
      .then(ticket => {
        if (!ticket) {
          return res.status(404).json({ message: "Ticket não encontrado" });
        }
        
        const creatorUserId = ticket.customer?.user_id;
        if (userId === creatorUserId) {
          return next(); // Criador pode remover participantes
        }
        
        return res.status(403).json({ message: "Acesso negado: Apenas o criador do ticket pode remover participantes" });
      })
      .catch(error => {
        console.error('Erro ao verificar permissões de remoção de participantes:', error);
        return res.status(500).json({ message: "Erro interno do servidor" });
      });
  } else {
    return res.status(403).json({ message: "Acesso negado: Permissão insuficiente para remover participantes" });
  }
}

// 🔥 FASE 5.2: Middleware para verificar acesso a departamento específico
export async function departmentAccessRequired(req: Request, res: Response, next: NextFunction) {
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
        .from(officials)
        .where(eq(officials.user_id, userId))
        .limit(1);
        
      if (!official) {
        return res.status(403).json({ message: "Acesso negado - Usuário não é um atendente" });
      }
      
      // Buscar o departamento pelo ID
      const [departmentRecord] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);
        
      if (!departmentRecord) {
        return res.status(404).json({ message: "Departamento não encontrado" });
      }
      
      const userOfficialDepartments = await db
        .select()
        .from(officialDepartments)
        .where(eq(officialDepartments.official_id, official.id));
        
      const hasDepartmentAccess = userOfficialDepartments.some(
        (dept: any) => dept.department_id === departmentId
      );
      
      // Se for supervisor, também verificar departamentos dos subordinados
      if (!hasDepartmentAccess && userRole === 'supervisor') {
        const subordinates = await db
          .select()
          .from(officials)
          .where(eq(officials.supervisor_id, official.id));

        for (const subordinate of subordinates) {
          const subordinateDepartments = await db
            .select()
            .from(officialDepartments)
            .where(eq(officialDepartments.official_id, subordinate.id));
          
          const subordinateHasAccess = subordinateDepartments.some(
            dept => dept.department_id === departmentId
          );
          
          if (subordinateHasAccess) {
            return next(); // Supervisor tem acesso através de subordinado
          }
        }
      }
      
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

// 🔥 FASE 5.2: Função auxiliar para verificar se um usuário pode gerenciar outro usuário
export function canManageUserRole(currentUserRole: string, targetUserRole: string): boolean {
  const roleHierarchy = {
    'admin': ['admin', 'company_admin', 'manager', 'supervisor', 'support', 'triage', 'customer', 'viewer', 'quality', 'integration_bot'],
    'company_admin': ['company_admin', 'manager', 'supervisor', 'support', 'triage', 'customer', 'viewer', 'quality'],
    'manager': ['supervisor', 'support', 'triage', 'customer', 'viewer'],
    'supervisor': ['support', 'triage', 'customer', 'viewer'],
    'support': ['customer', 'viewer'],
    'triage': ['customer', 'viewer']
  };

  return roleHierarchy[currentUserRole as keyof typeof roleHierarchy]?.includes(targetUserRole) || false;
} 