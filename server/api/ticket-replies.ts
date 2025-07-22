import { db } from "../db";
import { eq, and, ne, exists } from "drizzle-orm";
import { tickets, ticketReplies, ticketStatusHistory, customers, ticketParticipants, users } from "@shared/schema";
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
    // Buscar o ticket com customer em uma única query (JOIN otimizado)
    const ticketWithCustomer = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        customer_id: tickets.customer_id,
        company_id: tickets.company_id,
        customer_user_id: customers.user_id,
      })
      .from(tickets)
      .leftJoin(customers, eq(tickets.customer_id, customers.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    const ticket = ticketWithCustomer[0];
    if (!ticket) {
      return { canReply: false, reason: "Ticket não encontrado" };
    }

    // Verificar se o ticket está resolvido
    if (ticket.status === 'resolved') {
      return { canReply: false, reason: "Não é possível responder a tickets resolvidos" };
    }

    // 🔥 OTIMIZAÇÃO: Verificar se o usuário é participante usando EXISTS (muito mais rápido)
    if (userRole !== 'admin' && userRole !== 'support' && userRole !== 'manager' && userRole !== 'supervisor' && userRole !== 'company_admin') {
      const [isParticipantResult] = await db
        .select({ exists: exists(
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, ticketId),
              eq(ticketParticipants.user_id, userId)
            ))
        )})
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      // Se é participante, sempre pode responder
      if (isParticipantResult?.exists) {
        return { canReply: true };
      }
    }

    // Verificar permissões baseadas na role
    if (userRole === 'admin' || userRole === 'support' || userRole === 'manager' || userRole === 'supervisor' || userRole === 'company_admin') {
      return { canReply: true };
    }

    // Para clientes, verificar se é o criador do ticket (já temos o customer_user_id do JOIN)
    if (userRole === 'customer') {
      if (ticket.customer_user_id === userId) {
        return { canReply: true };
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
    console.time('[PERF] ticket-replies TOTAL');
    // Verificar se há sessão ativa
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    console.time('[PERF] Buscar ticket');
    // Validar os dados recebidos
    const validatedData = insertTicketReplySchema.parse(req.body);
    const ticketId = validatedData.ticket_id;
    
    // 🔥 OTIMIZAÇÃO: Buscar ticket com customer e official em uma única query
    const ticketWithRelations = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        assigned_to_id: tickets.assigned_to_id,
        customer_id: tickets.customer_id,
        company_id: tickets.company_id,
        first_response_at: tickets.first_response_at,
        customer_user_id: customers.user_id,
      })
      .from(tickets)
      .leftJoin(customers, eq(tickets.customer_id, customers.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    
    const ticket = ticketWithRelations[0];
    console.timeEnd('[PERF] Buscar ticket');

    if (!ticket) {
      console.timeEnd('[PERF] ticket-replies TOTAL');
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    // 🔥 FASE 4.1: Verificar permissões de resposta para participantes
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole;
    const userCompanyId = req.session.companyId;
    console.time('[PERF] Verificar permissões');
    const permissionCheck = await canUserReplyToTicket(sessionUserId, userRole, ticketId, userCompanyId);
    console.timeEnd('[PERF] Verificar permissões');
    if (!permissionCheck.canReply) {
      console.timeEnd('[PERF] ticket-replies TOTAL');
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

    console.time('[PERF] Inserir resposta');
    // Criar a resposta
    const [createdReply] = await db
      .insert(ticketReplies)
      .values(replyData)
      .returning();
    console.timeEnd('[PERF] Inserir resposta');

    // Verificar se o status do ticket mudou
    const statusChanged = req.body.statusChanged && ticket.status !== validatedData.status;
    if (statusChanged) {
      console.time('[PERF] Inserir histórico');
      // Registrar a mudança de status no histórico
      await db.insert(ticketStatusHistory).values({
        ticket_id: ticketId,
        old_status: ticket.status,
        new_status: validatedData.status,
        changed_by_id: sessionUserId,
      });
      console.timeEnd('[PERF] Inserir histórico');

      // Atualizar o status do ticket
      const updateData: any = { 
        status: validatedData.status,
        updated_at: new Date()
      };
      if (validatedData.status === 'resolved' && ticket.status !== 'resolved') {
        updateData.resolved_at = new Date();
      }
      if (validatedData.status === 'ongoing' && !ticket.first_response_at) {
        updateData.first_response_at = new Date();
      }
      console.time('[PERF] Atualizar ticket');
      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));
      console.timeEnd('[PERF] Atualizar ticket');

      // 🔥 FASE 4.2: Enviar notificação WebSocket de mudança de status
      try {
        const { notificationService } = await import('../services/notification-service');
        notificationService.notifyStatusChange(
          ticketId,
          String(ticket.status || ''),
          String(validatedData.status || 'new'),
          Number(sessionUserId)
        );
      } catch (notificationError) {
        console.error('Erro ao enviar notificação WebSocket de mudança de status:', notificationError);
      }
    }

    if (validatedData.assigned_to_id && validatedData.assigned_to_id !== ticket.assigned_to_id) {
      console.time('[PERF] Atualizar atendente');
      await db
        .update(tickets)
        .set({ 
          assigned_to_id: validatedData.assigned_to_id,
          updated_at: new Date()
        })
        .where(eq(tickets.id, ticketId));
      console.timeEnd('[PERF] Atualizar atendente');
    }

    console.timeEnd('[PERF] ticket-replies TOTAL');
    return res.status(201).json(createdReply);
  } catch (error) {
    console.timeEnd('[PERF] ticket-replies TOTAL');
    console.error("Erro ao criar resposta:", error);
    return res.status(500).json({ error: "Erro ao criar resposta" });
  }
}