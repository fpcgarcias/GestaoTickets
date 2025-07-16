import { db } from "../db";
import { eq } from "drizzle-orm";
import { tickets, ticketReplies, ticketStatusHistory, customers } from "@shared/schema";
import { insertTicketReplySchema } from "@shared/schema";
import { Request, Response } from "express";

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

    // Verificar permissões para responder ao ticket
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole;
    let isOwner = false;
    
    // Para clientes, verificar se é o dono do ticket através da relação customer_id->user_id
    if (userRole === 'customer' && ticket.customer_id) {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, ticket.customer_id));
      isOwner = customer?.user_id === sessionUserId;
    }

    if (
      userRole !== "admin" &&
      userRole !== "support" &&
      userRole !== "manager" &&
      userRole !== "company_admin" &&
      !isOwner
    ) {
      return res.status(403).json({ error: "Acesso negado: você não tem permissão para responder a este ticket." });
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