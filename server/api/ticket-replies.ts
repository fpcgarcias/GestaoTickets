import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { tickets, ticketReplies, ticketStatusHistory } from "@shared/schema";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { insertTicketReplySchema } from "@shared/schema";

// POST /api/ticket-replies
export async function POST(req: Request) {
  try {
    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Validar os dados recebidos
    const data = await req.json();
    const validatedData = insertTicketReplySchema.parse(data);

    const ticketId = validatedData.ticket_id;
    
    // Verificar se o ticket existe
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });

    if (!ticket) {
      return Response.json({ error: "Ticket não encontrado" }, { status: 404 });
    }

    // Verificar permissões para responder ao ticket
    // (administrador, suporte ou o cliente dono do ticket)
    if (
      session.user.role !== "admin" &&
      session.user.role !== "support" &&
      (session.user.role === "customer" && ticket.customer_email !== session.user.email)
    ) {
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Estruturar os dados da resposta
    const replyData = {
      ticket_id: ticketId,
      user_id: parseInt(session.user.id),
      message: validatedData.message,
      is_internal: validatedData.is_internal || false,
    };

    // Criar a resposta
    const [createdReply] = await db
      .insert(ticketReplies)
      .values(replyData)
      .returning();

    // Verificar se o status do ticket mudou
    const statusChanged = data.statusChanged && ticket.status !== validatedData.status;
    
    if (statusChanged) {
      // Registrar a mudança de status no histórico
      await db.insert(ticketStatusHistory).values({
        ticket_id: ticketId,
        old_status: ticket.status,
        new_status: validatedData.status,
        changed_by_id: parseInt(session.user.id),
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

    return Response.json(createdReply, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar resposta:", error);
    return Response.json(
      { error: "Erro ao criar resposta" },
      { status: 500 }
    );
  }
} 