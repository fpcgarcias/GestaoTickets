import { db } from "../../../db";
import { eq } from "drizzle-orm";
import { ticketReplies, customers } from "@shared/schema";
import { Request, Response } from "express";
import { storage } from "../../../storage";

// Função auxiliar para verificar se um usuário pode acessar um ticket
async function canUserAccessTicket(
  userId: number, 
  userRole: string, 
  ticketId: number, 
  userCompanyId?: number
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    // Buscar o ticket
    const ticket = await storage.getTicket(ticketId, userRole, userCompanyId);
    if (!ticket) {
      return { canAccess: false, reason: "Ticket não encontrado" };
    }

    // 🔥 FASE 4.1: Verificar se o usuário é participante do ticket
    const isParticipant = await storage.isUserTicketParticipant(ticketId, userId);
    
    // Se é participante, sempre pode acessar
    if (isParticipant) {
      return { canAccess: true };
    }

    // Verificar permissões baseadas na role
    if (userRole === 'admin' || userRole === 'support' || userRole === 'manager' || userRole === 'supervisor') {
      return { canAccess: true };
    }

    // Para clientes, verificar se é o criador do ticket
    if (userRole === 'customer') {
      if (ticket.customer_id) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customer_id));
        
        if (customer?.user_id === userId) {
          return { canAccess: true };
        }
      }
      return { canAccess: false, reason: "Apenas o criador do ticket pode acessar" };
    }

    return { canAccess: false, reason: "Permissão insuficiente para acessar este ticket" };
  } catch (error) {
    console.error('Erro ao verificar permissões de acesso:', error);
    return { canAccess: false, reason: "Erro interno ao verificar permissões" };
  }
}

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

    // 🔥 FASE 4.1: Verificar permissões de acesso para participantes
    const sessionUserId = req.session.userId;
    const userRole = req.session.userRole || 'customer'; // Default para customer se não definido
    const userCompanyId = req.session.companyId;
    
    if (!sessionUserId) {
      return res.status(401).json({ error: "Usuário não identificado" });
    }
    
    const permissionCheck = await canUserAccessTicket(sessionUserId, userRole, ticketId, userCompanyId);
    if (!permissionCheck.canAccess) {
      return res.status(403).json({ 
        error: "Acesso negado", 
        details: permissionCheck.reason 
      });
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