import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { tickets, ticketReplies } from "@shared/schema";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

// GET /api/tickets/[id]/replies
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = parseInt(params.id);
    if (isNaN(ticketId)) {
      return Response.json({ error: "ID do ticket inválido" }, { status: 400 });
    }

    // Verificar se o ticket existe
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });

    if (!ticket) {
      return Response.json({ error: "Ticket não encontrado" }, { status: 404 });
    }

    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem acesso ao ticket
    // (administradores, atendentes ou o cliente proprietário do ticket)
    if (
      session.user.role !== "admin" &&
      session.user.role !== "support" &&
      (session.user.role === "customer" && ticket.customer_email !== session.user.email)
    ) {
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar respostas do ticket com dados do usuário que as criou
    const replies = await db.query.ticketReplies.findMany({
      where: eq(ticketReplies.ticket_id, ticketId),
      orderBy: [ticketReplies.created_at],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            role: true,
            avatar_url: true,
          },
        },
      },
    });

    return Response.json(replies);
  } catch (error) {
    console.error("Erro ao buscar respostas do ticket:", error);
    return Response.json(
      { error: "Erro ao buscar respostas" },
      { status: 500 }
    );
  }
} 