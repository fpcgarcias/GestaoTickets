import { db } from "../db";
import { eq, and, ne } from "drizzle-orm";
import { tickets, ticketReplies, ticketStatusHistory, customers, ticketParticipants } from "@shared/schema";
import { insertTicketReplySchema } from "@shared/schema";
import { Request, Response } from "express";
import { storage } from "../storage";

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
    if (userRole === 'admin' || userRole === 'support' || userRole === 'manager' || userRole === 'supervisor') {
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

// POST /api/ticket-replies
export async function POST(req: Request, res: Response) {
  try {
    // Verificar se há sessão ativa
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    // Validar os dados recebidos
    const validatedData = insertTicketReplySchema.parse(req.body);
    const ticketId = validatedData.ticket_id;
    
    // Verificar se o ticket existe
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    // 🔥 FASE 4.1: Verificar permissões de resposta para participantes
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole;
    const userCompanyId = req.session.companyId;
    
    const permissionCheck = await canUserReplyToTicket(sessionUserId, userRole, ticketId, userCompanyId);
    if (!permissionCheck.canReply) {
      return res.status(403).json({ 
        error: "Acesso negado", 
        details: permissionCheck.reason 
      });
    }

    // Estruturar os dados da resposta
    const replyData = {
      ticket_id: ticketId,
      user_id: sessionUserId,
      message: validatedData.message,
      is_internal: validatedData.is_internal || false,
    };

    // Criar a resposta
    const [createdReply] = await db
      .insert(ticketReplies)
      .values(replyData)
      .returning();

    // Verificar se o status do ticket mudou
    const statusChanged = req.body.statusChanged && ticket.status !== validatedData.status;
    
    if (statusChanged) {
      // Registrar a mudança de status no histórico
      await db.insert(ticketStatusHistory).values({
        ticket_id: ticketId,
        old_status: ticket.status,
        new_status: validatedData.status,
        changed_by_id: sessionUserId,
      });
      
      // Atualizar o status do ticket
      const updateData: any = { 
        status: validatedData.status,
        updated_at: new Date()
      };
      
      // Se o ticket foi resolvido, adicionar data de resolução
      if (validatedData.status === 'resolved' && ticket.status !== 'resolved') {
        updateData.resolved_at = new Date();
      }
      
      // Se é a primeira vez que está em andamento, registrar a data da primeira resposta
      if (validatedData.status === 'ongoing' && !ticket.first_response_at) {
        updateData.first_response_at = new Date();
      }
      
      // Atualizar o ticket
      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));

      // 🔥 FASE 4.2: Enviar notificação WebSocket de mudança de status
      try {
        const { notificationService } = await import('../services/notification-service');
        await notificationService.notifyStatusChange(ticketId, ticket.status, validatedData.status, sessionUserId);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação WebSocket de mudança de status:', notificationError);
        // Não falhar a operação por erro de notificação
      }
    }
    
    // Se foi especificado um atendente e é diferente do atual
    if (validatedData.assigned_to_id && validatedData.assigned_to_id !== ticket.assigned_to_id) {
      // Atualizar o atendente designado
      await db
        .update(tickets)
        .set({ 
          assigned_to_id: validatedData.assigned_to_id,
          updated_at: new Date()
        })
        .where(eq(tickets.id, ticketId));
    }

    return res.status(201).json(createdReply);
  } catch (error) {
    console.error("Erro ao criar resposta:", error);
    return res.status(500).json({ error: "Erro ao criar resposta" });
  }
}