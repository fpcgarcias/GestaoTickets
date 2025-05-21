import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { tickets, ticketStatusHistory } from "@shared/schema";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

// GET /api/tickets/[id]/status-history
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

    // Buscar histórico de status do ticket
    const statusHistory = await db.query.ticketStatusHistory.findMany({
      where: eq(ticketStatusHistory.ticket_id, ticketId),
      orderBy: [ticketStatusHistory.created_at],
      with: {
        changed_by: {
          columns: {
            id: true,
            name: true,
            role: true,
            avatar_url: true,
          },
        },
      },
    });

    return Response.json(statusHistory);
  } catch (error) {
    console.error("Erro ao buscar histórico de status:", error);
    return Response.json(
      { error: "Erro ao buscar histórico de status" },
      { status: 500 }
    );
  }
} 