import { Request, Response } from 'express';
import { db } from '../db';
import { tickets, customers, departments, ticketStatusHistory, ticketReplies, users } from '@shared/schema';
import { eq, and, desc, ne } from 'drizzle-orm';

/**
 * GET /api/tickets/waiting-customer-pending
 * Retorna tickets em status waiting_customer do cliente autenticado
 * onde o cliente AINDA NÃO RESPONDEU desde que o ticket entrou em waiting_customer.
 *
 * Mesma lógica do fechamento automático (checkWaitingCustomerAutoClose):
 *   - entered_at = última vez que entrou em waiting_customer
 *   - last_customer_reply_at = última resposta do cliente
 *   - Elegível se: last_customer_reply_at == null OU last_customer_reply_at < entered_at
 *
 * Apenas role === 'customer'.
 */
export async function getWaitingCustomerPending(req: Request, res: Response) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const userRole = req.session.userRole as string;
    const userId = req.session.userId;

    if (userRole !== 'customer') {
      return res.status(403).json({ message: 'Acesso permitido apenas para clientes' });
    }

    const list = await db
      .select({
        id: tickets.id,
        ticket_number: tickets.ticket_id,
        title: tickets.title,
        department_id: tickets.department_id,
        waiting_customer_alert_sent_at: tickets.waiting_customer_alert_sent_at,
        department_name: departments.name,
        auto_close_enabled: departments.auto_close_waiting_customer,
        customer_user_id: customers.user_id,
      })
      .from(tickets)
      .innerJoin(customers, eq(tickets.customer_id, customers.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .where(
        and(
          eq(tickets.status, 'waiting_customer'),
          eq(customers.user_id, userId)
        )
      )
      .orderBy(desc(tickets.updated_at));

    const result = [];

    for (const row of list) {
      // Quando o ticket entrou em waiting_customer
      const [enteredRow] = await db
        .select({ created_at: ticketStatusHistory.created_at })
        .from(ticketStatusHistory)
        .where(
          and(
            eq(ticketStatusHistory.ticket_id, row.id),
            eq(ticketStatusHistory.change_type, 'status'),
            eq(ticketStatusHistory.new_status, 'waiting_customer')
          )
        )
        .orderBy(desc(ticketStatusHistory.created_at))
        .limit(1);

      const entered_at = enteredRow?.created_at ? new Date(enteredRow.created_at) : null;
      if (!entered_at) continue; // Sem histórico, pular

      const customerUserId = row.customer_user_id ?? null;

      // Última resposta do cliente neste ticket
      const lastCustomerReply = customerUserId != null
        ? await db
            .select({ created_at: ticketReplies.created_at })
            .from(ticketReplies)
            .where(
              and(
                eq(ticketReplies.ticket_id, row.id),
                eq(ticketReplies.user_id, customerUserId)
              )
            )
            .orderBy(desc(ticketReplies.created_at))
            .limit(1)
        : [];

      const last_customer_reply_at = lastCustomerReply[0]?.created_at
        ? new Date(lastCustomerReply[0].created_at)
        : null;

      // Mesma regra do auto-close: só elegível se o cliente NÃO respondeu desde que entrou em waiting_customer
      const eligible = last_customer_reply_at == null || last_customer_reply_at.getTime() < entered_at.getTime();
      if (!eligible) continue;

      // Última mensagem do atendente (para contexto)
      const lastAttendantReply = customerUserId != null
        ? await db
            .select({
              message: ticketReplies.message,
              created_at: ticketReplies.created_at,
              author_name: users.name,
            })
            .from(ticketReplies)
            .leftJoin(users, eq(ticketReplies.user_id, users.id))
            .where(
              and(
                eq(ticketReplies.ticket_id, row.id),
                ne(ticketReplies.user_id, customerUserId),
                eq(ticketReplies.is_internal, false)
              )
            )
            .orderBy(desc(ticketReplies.created_at))
            .limit(1)
        : [];

      const lastReply = lastAttendantReply[0];

      result.push({
        id: row.id,
        ticket_number: row.ticket_number,
        title: row.title,
        department_name: row.department_name ?? null,
        entered_waiting_at: entered_at,
        auto_close_enabled: row.auto_close_enabled ?? false,
        alert_sent_at: row.waiting_customer_alert_sent_at ?? null,
        last_attendant_reply: lastReply
          ? {
              message: lastReply.message,
              created_at: lastReply.created_at,
              author_name: lastReply.author_name ?? null,
            }
          : null,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('[waiting-customer-pending] Erro:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
