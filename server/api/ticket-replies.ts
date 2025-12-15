import { db } from "../db";
import { eq, and, ne, exists } from "drizzle-orm";
import { tickets, ticketReplies, ticketStatusHistory, customers, ticketParticipants, users } from "@shared/schema";
import * as schema from "@shared/schema";
import { insertTicketReplySchema } from "@shared/schema";
import { Request, Response } from "express";
import { storage } from "../storage";
import { AiService } from "../services/ai-service";
import { getDefaultAiBotName } from "../utils/ai-bot-names";

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
    // Verificar se há sessão ativa
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

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
        department_id: tickets.department_id, // ADICIONADO
        first_response_at: tickets.first_response_at,
        customer_user_id: customers.user_id,
      })
      .from(tickets)
      .leftJoin(customers, eq(tickets.customer_id, customers.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    
    const ticket = ticketWithRelations[0];

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    // 🔥 FASE 4.1: Verificar permissões de resposta para participantes
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole || '';
    const userCompanyId = req.session.companyId;

    // Verificar se o usuário é participante do ticket
    let isUserParticipant = false;
    try {
      const isParticipant = await db
        .select({ exists: exists(
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, ticketId),
              eq(ticketParticipants.user_id, sessionUserId)
            ))
        )})
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      isUserParticipant = Boolean(isParticipant[0]?.exists);
    } catch (err) {
      isUserParticipant = false;
    }

    const permissionCheck = await canUserReplyToTicket(sessionUserId, userRole, ticketId, userCompanyId);
    if (!permissionCheck.canReply) {
      return res.status(403).json({ 
        error: "Acesso negado", 
        details: permissionCheck.reason 
      });
    }

    // --- INÍCIO LÓGICA DE REABERTURA AUTOMÁTICA (ANTES DE SALVAR A RESPOSTA) ---
    let shouldReopenByAI = false;
    let aiReopenResult: any = null;
    
    // Acionar IA se:
    // - status atual do ticket for 'waiting_customer'
    // - usuário for o criador OU participante
    const condition1 = ticket.status === 'waiting_customer';
    const condition2 = (userRole === 'customer' && ticket.customer_user_id === sessionUserId);
    const condition3 = isUserParticipant;
    const shouldAnalyze = condition1 && (condition2 || condition3);
    
    if (shouldAnalyze) {
      try {
        const aiService = new AiService();
        const departmentId = typeof ticket.department_id === 'number' ? ticket.department_id : 0;
        const companyId = typeof ticket.company_id === 'number' ? ticket.company_id : 0;
        const aiResult = await aiService.analyzeTicketReopen(
          ticketId,
          companyId,
          departmentId,
          String(validatedData.message),
          db
        );
        aiReopenResult = aiResult;
        if (aiResult.shouldReopen) {
          shouldReopenByAI = true;
        }
      } catch (err) {
        console.error('[AI] Erro ao analisar reabertura automática:', err);
      }
    }
    // --- FIM LÓGICA DE REABERTURA AUTOMÁTICA ---

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
    let statusChanged = ticket.status !== validatedData.status;
    // Se IA decidir reabrir, forçar mudança de status para 'reopened'
    if (shouldReopenByAI) {
      statusChanged = true;
      validatedData.status = 'reopened';
    }
    // 🔥 VALIDAÇÃO: Se está tentando alterar de 'novo' para outro status, deve ter atendente vinculado
    if (statusChanged && ticket.status === 'new' && !validatedData.assigned_to_id && !ticket.assigned_to_id) {
      return res.status(400).json({ 
        error: "Não é possível alterar status", 
        details: "É necessário atribuir um atendente ao ticket antes de alterar o status." 
      });
    }
    if (statusChanged) {
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
            name: getDefaultAiBotName(),
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

      // Se a IA decidiu reabrir, usar o bot como responsável pela mudança
      const changedByUserId = shouldReopenByAI ? botUserId : sessionUserId;

      // Registrar a mudança de status no histórico
      await db.insert(ticketStatusHistory).values({
        ticket_id: ticketId,
        old_status: ticket.status,
        new_status: validatedData.status,
        changed_by_id: changedByUserId,
      });

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
      if (validatedData.status === 'reopened') {
        updateData.reopened_at = new Date();
      }
      await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId));

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

      // 🔥 ADICIONAR NOTIFICAÇÃO DE EMAIL PARA MUDANÇA DE STATUS
      try {
        const { emailNotificationService } = await import('../services/email-notification-service');
        
        // Enviar notificação de email para mudança de status
        emailNotificationService.notifyStatusChanged(
          ticketId,
          String(ticket.status || ''),
          String(validatedData.status || 'new'),
          shouldReopenByAI ? botUserId : sessionUserId
        ).catch((emailError) => {
          console.error(`[📧 EMAIL] ❌ Erro ao enviar notificação de mudança de status:`, emailError);
          console.error(`[📧 EMAIL] ❌ Stack trace:`, emailError.stack);
        });
      } catch (notificationError) {
        console.error('Erro ao importar serviço de email para notificação de mudança de status:', notificationError);
      }
    }

    if (validatedData.assigned_to_id && validatedData.assigned_to_id !== ticket.assigned_to_id) {
      // Registrar histórico de transferência (assignment)
      await db.insert(ticketStatusHistory).values({
        ticket_id: ticketId,
        change_type: 'assignment',
        old_assigned_to_id: ticket.assigned_to_id || null,
        new_assigned_to_id: validatedData.assigned_to_id,
        changed_by_id: sessionUserId,
        created_at: new Date(),
      });

      // Atualizar atribuição
      await db
        .update(tickets)
        .set({ 
          assigned_to_id: validatedData.assigned_to_id,
          updated_at: new Date()
        })
        .where(eq(tickets.id, ticketId));
    }

    // 🔥 ADICIONAR NOTIFICAÇÃO DE EMAIL PARA RESPOSTA DE TICKET
    try {
      const { emailNotificationService } = await import('../services/email-notification-service');
      
      // Enviar notificação de email para resposta de ticket
      emailNotificationService.notifyTicketReply(
        ticketId,
        sessionUserId,
        validatedData.message
      ).catch((emailError) => {
        console.error(`[📧 EMAIL] ❌ Erro ao enviar notificação de resposta:`, emailError);
      });
    } catch (notificationError) {
      console.error('Erro ao importar serviço de email para notificação de resposta:', notificationError);
    }

    // 🔔 ENVIAR NOTIFICAÇÃO PERSISTENTE DE NOVA RESPOSTA
    try {
      const { notificationService } = await import('../services/notification-service');
      await notificationService.notifyNewReply(ticketId, sessionUserId);
    } catch (notificationError) {
      console.error('Erro ao enviar notificação de nova resposta:', notificationError);
    }

    return res.status(201).json(createdReply);
  } catch (error) {
    console.error("Erro ao criar resposta:", error);
    return res.status(500).json({ error: "Erro ao criar resposta" });
  }
}