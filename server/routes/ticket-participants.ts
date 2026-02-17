import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { users, customers, officials } from '@shared/schema';
import { storage } from '../storage';
import { notificationService } from '../services/notification-service';
import { emailNotificationService } from '../services/email-notification-service';
import { z } from 'zod';

// 🔥 FASE 5.2: Importar middlewares de autorização
import { 
  authRequired, 
  participantManagementRequired, 
  canAddParticipants, 
  canRemoveParticipants,
  ticketAccessRequired 
} from '../middleware/authorization';

const router = Router();

// Schema de validação para adicionar participantes em lote
const addParticipantsSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, "Pelo menos um usuário deve ser especificado"),
});

// Schema de validação para remover participantes em lote
const removeParticipantsSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, "Pelo menos um usuário deve ser especificado"),
});

// Schema de validação para substituir lista completa de participantes
const replaceParticipantsSchema = z.object({
  userIds: z.array(z.number().int().positive()),
});

// 🔥 FASE 5.1: Função para validar se usuários são da mesma empresa
async function validateSameCompanyUsers(ticketCompanyId: number | null, userIds: number[]): Promise<{ valid: boolean; invalidUsers: number[]; reason?: string }> {
  if (!ticketCompanyId) {
    return { valid: true, invalidUsers: [] }; // Tickets sem empresa podem ter participantes de qualquer empresa
  }

  const invalidUsers: number[] = [];
  
  for (const userId of userIds) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      invalidUsers.push(userId);
      continue;
    }
    
    // Verificar se o usuário é da mesma empresa do ticket
    if (user.company_id !== ticketCompanyId) {
      invalidUsers.push(userId);
    }
  }
  
  if (invalidUsers.length > 0) {
    return { 
      valid: false, 
      invalidUsers,
      reason: "Apenas usuários da mesma empresa podem ser adicionados como participantes"
    };
  }
  
  return { valid: true, invalidUsers: [] };
}

// 🔥 FASE 5.1: Função para validar se usuários existem e são válidos (atendentes/solicitantes)
async function validateUserExistsAndValid(userIds: number[]): Promise<{ valid: boolean; invalidUsers: number[]; reason?: string }> {
  const invalidUsers: number[] = [];
  
  for (const userId of userIds) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.active, true)))
      .limit(1);
    
    if (!user) {
      invalidUsers.push(userId);
      continue;
    }
    
    // Verificar se o usuário é um atendente (official) ou solicitante (customer)
    const [official] = await db
      .select()
      .from(officials)
      .where(eq(officials.user_id, userId))
      .limit(1);
    
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.user_id, userId))
      .limit(1);
    
    if (!official && !customer) {
      invalidUsers.push(userId);
    }
  }
  
  if (invalidUsers.length > 0) {
    return { 
      valid: false, 
      invalidUsers,
      reason: "Apenas atendentes e solicitantes existentes podem ser adicionados como participantes"
    };
  }
  
  return { valid: true, invalidUsers: [] };
}

// 🔥 FASE 5.1: Função para verificar se o usuário pode remover um participante específico
async function canUserRemoveParticipant(
  currentUserId: number,
  userRole: string,
  ticketId: number,
  participantUserId: number,
  ticketCreatorId?: number
): Promise<{ canRemove: boolean; reason?: string }> {
  // Admin e roles de gestão sempre podem remover
  const adminRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
  if (adminRoles.includes(userRole)) {
    return { canRemove: true };
  }
  
  // Participantes podem se remover da lista
  if (currentUserId === participantUserId) {
    return { canRemove: true };
  }
  
  // Criador do ticket pode remover participantes
  if (userRole === 'customer' && currentUserId === ticketCreatorId) {
    return { canRemove: true };
  }
  
  // Verificar se o usuário atual é participante do ticket
  const isCurrentUserParticipant = await storage.isUserTicketParticipant(ticketId, currentUserId);
  if (isCurrentUserParticipant) {
    return { canRemove: true };
  }
  
  return { 
    canRemove: false, 
    reason: "Apenas administradores, criadores do ticket e participantes podem remover participantes" 
  };
}

// GET /api/ticket-participants/:ticketId - Listar participantes de um ticket
router.get('/:ticketId', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const _userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // Buscar participantes
    const participants = await storage.getTicketParticipants(ticketId);

    return res.json({
      success: true,
      data: participants
    });

  } catch (error) {
    console.error('Erro ao buscar participantes:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/ticket-participants/:ticketId - Adicionar participantes em lote a um ticket
router.post('/:ticketId', authRequired, canAddParticipants, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    // Validar dados da requisição
    const validationResult = addParticipantsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Dados inválidos",
        errors: validationResult.error.issues
      });
    }

    const { userIds } = validationResult.data;

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // 🔥 FASE 5.1: Validar se usuários são da mesma empresa
    const companyValidation = await validateSameCompanyUsers(ticket.company_id, userIds);
    if (!companyValidation.valid) {
      return res.status(403).json({ 
        message: companyValidation.reason,
        invalidUserIds: companyValidation.invalidUsers
      });
    }

    // 🔥 FASE 5.1: Validar se usuários existem e são válidos (atendentes/solicitantes)
    const userValidation = await validateUserExistsAndValid(userIds);
    if (!userValidation.valid) {
      return res.status(400).json({ 
        message: userValidation.reason,
        invalidUserIds: userValidation.invalidUsers
      });
    }

    // Verificar se todos os usuários existem
    const _usersToAdd = await Promise.all(
      userIds.map(async (userId) => {
        const user = await storage.getUser(userId);
        if (!user) {
          throw new Error(`Usuário com ID ${userId} não encontrado`);
        }
        return user;
      })
    );

    // Verificar se algum usuário é o criador do ticket
    const creatorUserId = ticket.customer?.user_id;
    const invalidUsers = userIds.filter(id => id === creatorUserId);
    if (invalidUsers.length > 0) {
      return res.status(400).json({ 
        message: "O criador do ticket já é participante por padrão",
        invalidUserIds: invalidUsers
      });
    }

    // Adicionar participantes em lote
    const addedParticipants = [];
    const errors = [];

    for (const participantUserId of userIds) {
      try {
        const participant = await storage.addTicketParticipant(ticketId, participantUserId, userId!);
        addedParticipants.push(participant);

        // 🔥 FASE 4.2: Enviar notificação WebSocket de participante adicionado
        try {
          await notificationService.notifyParticipantAdded(ticketId, participantUserId, userId!);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação WebSocket de participante adicionado:', notificationError);
          // Não falhar a operação por erro de notificação
        }

        // 🔥 NOVO: Enviar notificação de participante adicionado
        try {
          await emailNotificationService.notifyTicketParticipantAdded(ticketId, participantUserId, userId!);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de participante adicionado:', notificationError);
          // Não falhar a operação por erro de notificação
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('já é participante')) {
          errors.push({
            userId: participantUserId,
            error: 'Usuário já é participante deste ticket'
          });
        } else {
          errors.push({
            userId: participantUserId,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `Adicionados ${addedParticipants.length} participantes com sucesso`,
      data: {
        added: addedParticipants,
        errors: errors
      }
    });

  } catch (error) {
    console.error('Erro ao adicionar participantes:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// DELETE /api/ticket-participants/:ticketId - Remover participantes em lote de um ticket
router.delete('/:ticketId', authRequired, canRemoveParticipants, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const userRole = req.session?.userRole;
    const currentUserId = req.session?.userId;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    // Validar dados da requisição
    const validationResult = removeParticipantsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Dados inválidos",
        errors: validationResult.error.issues
      });
    }

    const { userIds } = validationResult.data;

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // Verificar se algum usuário é o criador do ticket
    const creatorUserId = ticket.customer?.user_id;
    const invalidUsers = userIds.filter(id => id === creatorUserId);
    if (invalidUsers.length > 0) {
      return res.status(400).json({ 
        message: "Não é possível remover o criador do ticket",
        invalidUserIds: invalidUsers
      });
    }

    // 🔥 FASE 5.1: Verificar permissões de remoção para cada participante
    const removalErrors = [];
    const validUserIds = [];

    for (const participantUserId of userIds) {
      const permissionCheck = await canUserRemoveParticipant(
        currentUserId!,
        userRole!,
        ticketId,
        participantUserId,
        creatorUserId || undefined
      );

      if (!permissionCheck.canRemove) {
        removalErrors.push({
          userId: participantUserId,
          error: permissionCheck.reason || 'Permissão negada para remover este participante'
        });
      } else {
        validUserIds.push(participantUserId);
      }
    }

    // Se há erros de permissão, retornar apenas os erros
    if (removalErrors.length > 0 && validUserIds.length === 0) {
      return res.status(403).json({
        message: "Permissões insuficientes para remover participantes",
        data: {
          errors: removalErrors
        }
      });
    }

    // Remover participantes em lote (apenas os que têm permissão)
    let removedCount = 0;
    const errors = [...removalErrors];

    for (const participantUserId of validUserIds) {
      try {
        // Verificar se o usuário é realmente participante
        const isParticipant = await storage.isUserTicketParticipant(ticketId, participantUserId);
        if (!isParticipant) {
          errors.push({
            userId: participantUserId,
            error: 'Usuário não é participante deste ticket'
          });
          continue;
        }

        await storage.removeTicketParticipant(ticketId, participantUserId);
        removedCount++;

        // 🔥 FASE 4.2: Enviar notificação WebSocket de participante removido
        try {
          await notificationService.notifyParticipantRemoved(ticketId, participantUserId, currentUserId!);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação WebSocket de participante removido:', notificationError);
          // Não falhar a operação por erro de notificação
        }

        // 🔥 NOVO: Enviar notificação de participante removido
        try {
          await emailNotificationService.notifyTicketParticipantRemoved(ticketId, participantUserId, currentUserId!);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de participante removido:', notificationError);
          // Não falhar a operação por erro de notificação
        }
      } catch (error) {
        errors.push({
          userId: participantUserId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return res.json({
      success: true,
      message: `Removidos ${removedCount} participantes com sucesso`,
      data: {
        removedCount,
        errors: errors
      }
    });

  } catch (error) {
    console.error('Erro ao remover participantes:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// PUT /api/ticket-participants/:ticketId - Substituir lista completa de participantes
router.put('/:ticketId', authRequired, participantManagementRequired, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    // Validar dados da requisição
    const validationResult = replaceParticipantsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Dados inválidos",
        errors: validationResult.error.issues
      });
    }

    const { userIds } = validationResult.data;

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // 🔥 FASE 5.1: Validar se usuários são da mesma empresa
    const companyValidation = await validateSameCompanyUsers(ticket.company_id, userIds);
    if (!companyValidation.valid) {
      return res.status(403).json({ 
        message: companyValidation.reason,
        invalidUserIds: companyValidation.invalidUsers
      });
    }

    // 🔥 FASE 5.1: Validar se usuários existem e são válidos (atendentes/solicitantes)
    const userValidation = await validateUserExistsAndValid(userIds);
    if (!userValidation.valid) {
      return res.status(400).json({ 
        message: userValidation.reason,
        invalidUserIds: userValidation.invalidUsers
      });
    }

    // Verificar se todos os usuários existem
    const _usersToAdd = await Promise.all(
      userIds.map(async (userId) => {
        const user = await storage.getUser(userId);
        if (!user) {
          throw new Error(`Usuário com ID ${userId} não encontrado`);
        }
        return user;
      })
    );

    // Verificar se algum usuário é o criador do ticket
    const creatorUserId = ticket.customer?.user_id;
    const invalidUsers = userIds.filter(id => id === creatorUserId);
    if (invalidUsers.length > 0) {
      return res.status(400).json({ 
        message: "O criador do ticket já é participante por padrão",
        invalidUserIds: invalidUsers
      });
    }

    // Buscar participantes atuais
    const currentParticipants = await storage.getTicketParticipants(ticketId);
    const currentUserIds = currentParticipants.map(p => p.user_id);

    // 🔥 FASE 5.1: Verificar permissões de remoção para participantes que serão removidos
    const participantsToRemove = currentUserIds.filter(id => !userIds.includes(id));
    const removalErrors = [];
    const validRemovals = [];

    for (const participantUserId of participantsToRemove) {
      const permissionCheck = await canUserRemoveParticipant(
        userId!,
        userRole!,
        ticketId,
        participantUserId,
        creatorUserId || undefined
      );

      if (!permissionCheck.canRemove) {
        removalErrors.push({
          userId: participantUserId,
          error: permissionCheck.reason || 'Permissão negada para remover este participante'
        });
      } else {
        validRemovals.push(participantUserId);
      }
    }

    // Remover participantes que não estão na nova lista (apenas os que têm permissão)
    for (const participantUserId of validRemovals) {
      await storage.removeTicketParticipant(ticketId, participantUserId);
    }

    // Adicionar novos participantes
    const addedParticipants = [];
    const errors = [...removalErrors];

    for (const participantUserId of userIds) {
      // Pular se já é participante
      if (currentUserIds.includes(participantUserId)) {
        continue;
      }

      try {
        const participant = await storage.addTicketParticipant(ticketId, participantUserId, userId!);
        addedParticipants.push(participant);
      } catch (error) {
        if (error instanceof Error && error.message.includes('já é participante')) {
          // Ignorar, já é participante
        } else {
          errors.push({
            userId: participantUserId,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
    }

    return res.json({
      success: true,
      message: "Lista de participantes atualizada com sucesso",
      data: {
        removed: validRemovals.length,
        added: addedParticipants.length,
        errors: errors
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar participantes:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/ticket-participants/:ticketId/check/:userId - Verificar se usuário é participante
router.get('/:ticketId/check/:userId', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const participantUserId = parseInt(req.params.userId);
    const userRole = req.session?.userRole;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    if (!participantUserId || isNaN(participantUserId)) {
      return res.status(400).json({ message: "ID do usuário inválido" });
    }

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // Verificar se o usuário é participante
    const isParticipant = await storage.isUserTicketParticipant(ticketId, participantUserId);

    return res.json({
      success: true,
      data: {
        isParticipant,
        ticketId,
        userId: participantUserId
      }
    });

  } catch (error) {
    console.error('Erro ao verificar participante:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/ticket-participants/:ticketId/history - Buscar histórico de participantes
router.get('/:ticketId/history', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const userRole = req.session?.userRole;

    if (!ticketId || isNaN(ticketId)) {
      return res.status(400).json({ message: "ID do ticket inválido" });
    }

    // Verificar se o usuário tem acesso ao ticket
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado ou acesso negado" });
    }

    // Buscar histórico de participantes
    const history = await storage.getTicketParticipantsHistory(ticketId);

    return res.json(history);

  } catch (error) {
    console.error('Erro ao buscar histórico de participantes:', error);
    return res.status(500).json({ 
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router; 