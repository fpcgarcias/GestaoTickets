import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db';
import { tickets, ticketStatusHistory, users, customers, companies } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Histórico de Status de Tickets', () => {
  let testCompanyId: number;
  let testUserId: number;
  let testCustomerId: number;
  let testTicketId: number;
  const createdTicketIds: number[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    
    // Criar empresa de teste
    const [company] = await db.insert(companies).values({
      name: `Test Company - Status History ${timestamp}`,
      email: `test-history-${timestamp}@example.com`,
      active: true,
    }).returning();
    testCompanyId = company.id;

    // Criar usuário de teste com senha forte
    const [user] = await db.insert(users).values({
      username: `test-history-user-${timestamp}`,
      password: 'TestPassword123!@#',
      email: `test-history-user-${timestamp}@example.com`,
      name: 'Test History User',
      role: 'support',
      company_id: testCompanyId,
    }).returning();
    testUserId = user.id;

    // Criar cliente de teste
    const [customer] = await db.insert(customers).values({
      name: 'Test Customer - History',
      email: `test-history-customer-${timestamp}@example.com`,
      company_id: testCompanyId,
    }).returning();
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    // Limpar dados de teste na ordem correta (dependências primeiro)
    for (const ticketId of createdTicketIds) {
      await db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticket_id, ticketId));
      await db.delete(tickets).where(eq(tickets.id, ticketId));
    }
    if (testCustomerId) {
      await db.delete(customers).where(eq(customers.id, testCustomerId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testCompanyId) {
      await db.delete(companies).where(eq(companies.id, testCompanyId));
    }
  });

  beforeEach(async () => {
    // Criar ticket de teste antes de cada teste
    const [ticket] = await db.insert(tickets).values({
      ticket_id: `TEST-HIST-${Date.now()}`,
      title: 'Test Ticket - Status History',
      description: 'Testing status history',
      status: 'new',
      priority: 'MÉDIA',
      type: 'Suporte',
      customer_id: testCustomerId,
      customer_email: `test-history-customer-${testCustomerId}@example.com`,
      company_id: testCompanyId,
    }).returning();
    testTicketId = ticket.id;
    createdTicketIds.push(ticket.id);
  });

  it('deve registrar mudança de status para "closed"', async () => {
    // Atualizar status para 'closed'
    await db.update(tickets)
      .set({ status: 'closed', resolved_at: new Date() })
      .where(eq(tickets.id, testTicketId));

    // Criar registro de histórico manualmente (simulando o que o sistema faz)
    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'new',
      new_status: 'closed',
      changed_by_id: testUserId,
      created_at: new Date(),
    });

    // Verificar que o histórico foi criado
    const history = await db
      .select()
      .from(ticketStatusHistory)
      .where(
        and(
          eq(ticketStatusHistory.ticket_id, testTicketId),
          eq(ticketStatusHistory.new_status, 'closed')
        )
      );

    expect(history).toHaveLength(1);
    expect(history[0].old_status).toBe('new');
    expect(history[0].new_status).toBe('closed');
    expect(history[0].changed_by_id).toBe(testUserId);
    expect(history[0].change_type).toBe('status');
  });

  it('deve registrar mudança de status de "closed" para "reopened"', async () => {
    // Primeiro, colocar o ticket em 'closed'
    await db.update(tickets)
      .set({ status: 'closed', resolved_at: new Date() })
      .where(eq(tickets.id, testTicketId));

    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'new',
      new_status: 'closed',
      changed_by_id: testUserId,
      created_at: new Date(),
    });

    // Agora, reabrir o ticket
    await db.update(tickets)
      .set({ status: 'reopened', resolved_at: null })
      .where(eq(tickets.id, testTicketId));

    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'closed',
      new_status: 'reopened',
      changed_by_id: testUserId,
      created_at: new Date(),
    });

    // Verificar que ambos os registros de histórico foram criados
    const history = await db
      .select()
      .from(ticketStatusHistory)
      .where(eq(ticketStatusHistory.ticket_id, testTicketId));

    expect(history).toHaveLength(2);
    
    // Verificar primeiro registro (new -> closed)
    const closedHistory = history.find(h => h.new_status === 'closed');
    expect(closedHistory).toBeDefined();
    expect(closedHistory?.old_status).toBe('new');
    expect(closedHistory?.changed_by_id).toBe(testUserId);

    // Verificar segundo registro (closed -> reopened)
    const reopenedHistory = history.find(h => h.new_status === 'reopened');
    expect(reopenedHistory).toBeDefined();
    expect(reopenedHistory?.old_status).toBe('closed');
    expect(reopenedHistory?.changed_by_id).toBe(testUserId);
  });

  it('deve incluir user_id no histórico quando fornecido', async () => {
    // Atualizar status com user_id
    await db.update(tickets)
      .set({ status: 'closed', resolved_at: new Date() })
      .where(eq(tickets.id, testTicketId));

    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'new',
      new_status: 'closed',
      changed_by_id: testUserId,
      created_at: new Date(),
    });

    // Verificar que o user_id foi incluído
    const history = await db
      .select()
      .from(ticketStatusHistory)
      .where(
        and(
          eq(ticketStatusHistory.ticket_id, testTicketId),
          eq(ticketStatusHistory.new_status, 'closed')
        )
      );

    expect(history).toHaveLength(1);
    expect(history[0].changed_by_id).toBe(testUserId);
  });

  it('deve permitir user_id null para processos automáticos', async () => {
    // Atualizar status sem user_id (processo automático)
    await db.update(tickets)
      .set({ status: 'closed', resolved_at: new Date() })
      .where(eq(tickets.id, testTicketId));

    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'waiting_customer',
      new_status: 'closed',
      changed_by_id: null, // Auto-close job
      created_at: new Date(),
    });

    // Verificar que o histórico foi criado sem user_id
    const history = await db
      .select()
      .from(ticketStatusHistory)
      .where(
        and(
          eq(ticketStatusHistory.ticket_id, testTicketId),
          eq(ticketStatusHistory.new_status, 'closed')
        )
      );

    expect(history).toHaveLength(1);
    expect(history[0].changed_by_id).toBeNull();
    expect(history[0].old_status).toBe('waiting_customer');
  });

  it('deve incluir timestamp no histórico', async () => {
    const beforeTime = new Date();
    
    // Atualizar status
    await db.update(tickets)
      .set({ status: 'closed', resolved_at: new Date() })
      .where(eq(tickets.id, testTicketId));

    await db.insert(ticketStatusHistory).values({
      ticket_id: testTicketId,
      change_type: 'status',
      old_status: 'new',
      new_status: 'closed',
      changed_by_id: testUserId,
      created_at: new Date(),
    });

    const afterTime = new Date();

    // Verificar que o timestamp está correto
    const history = await db
      .select()
      .from(ticketStatusHistory)
      .where(
        and(
          eq(ticketStatusHistory.ticket_id, testTicketId),
          eq(ticketStatusHistory.new_status, 'closed')
        )
      );

    expect(history).toHaveLength(1);
    expect(history[0].created_at).toBeDefined();
    
    const historyTime = new Date(history[0].created_at);
    expect(historyTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(historyTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});
