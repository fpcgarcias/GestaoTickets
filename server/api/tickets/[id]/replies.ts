import { db } from "../../../db";
import { eq } from "drizzle-orm";
import { tickets, ticketReplies, customers } from "@shared/schema";
import { Request, Response } from "express";

// GET /api/tickets/[id]/replies
export async function GET(req: Request, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: "ID do ticket inválido" });
    }

    // Verificar se há sessão ativa
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    // Verificar se o ticket existe
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    // Verificar se o usuário tem acesso ao ticket
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole;
    let hasAccess = false;
    
    // Admin e suporte sempre têm acesso
    if (userRole === "admin" || userRole === "support") {
      hasAccess = true;
    } else if (userRole === "customer") {
      // Para clientes, verificar se é o dono do ticket através da relação customer_id->user_id
      if (ticket.customer_id) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id));
        hasAccess = customer?.user_id === sessionUserId;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Acesso negado" });
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

    return res.json(replies);
  } catch (error) {
    console.error("Erro ao buscar respostas do ticket:", error);
    return res.status(500).json({ error: "Erro ao buscar respostas" });
  }
} 