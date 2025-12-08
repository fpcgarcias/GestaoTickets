/**
 * Testes de Propriedade para Schema de Notificações
 * Feature: notification-system, Property 1: Persistência completa de notificações
 * Validates: Requirements 1.1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../db';
import { notifications, users, companies, tickets, customers, insertNotificationSchema } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Property 1: Persistência completa de notificações', () => {
  let testCompanyId: number;
  let testUserId: number;
  let testTicketId: number;
  let setupComplete = false;

  beforeAll(async () => {
    try {
      // Usar timestamp para garantir unicidade
      const timestamp = Date.now();
      
      // Criar empresa de teste
      const [company] = await db.insert(companies).values({
        name: `Test Company - Notifications ${timestamp}`,
        email: `test-notifications-${timestamp}@example.com`,
        active: true,
      }).returning();
      testCompanyId = company.id;

      // Criar usuário de teste
      const [user] = await db.insert(users).values({
        username: `test-notification-user-${timestamp}`,
        password: 'test-password',
        email: `test-notification-user-${timestamp}@example.com`,
        name: 'Test Notification User',
        role: 'customer',
        company_id: testCompanyId,
      }).returning();
      testUserId = user.id;

      // Criar cliente de teste
      const [customer] = await db.insert(customers).values({
        name: 'Test Customer',
        email: `test-customer-${timestamp}@example.com`,
        company_id: testCompanyId,
      }).returning();

      // Criar ticket de teste
      const [ticket] = await db.insert(tickets).values({
        ticket_id: `TEST-${timestamp}`,
        title: 'Test Ticket',
        description: 'Test Description',
        status: 'new',
        priority: 'MÉDIA',
        type: 'Suporte',
        customer_id: customer.id,
        customer_email: customer.email,
        company_id: testCompanyId,
      }).returning();
      testTicketId = ticket.id;

      setupComplete = true;
      console.log('✅ Setup de testes concluído com sucesso');
    } catch (error) {
      console.error('❌ Erro no setup dos testes:', error);
      throw error;
    }
  }, 30000); // Timeout de 30 segundos para setup

  afterAll(async () => {
    if (setupComplete) {
      try {
        // Limpar dados de teste
        await db.delete(notifications).where(eq(notifications.user_id, testUserId));
        await db.delete(tickets).where(eq(tickets.id, testTicketId));
        await db.delete(customers).where(eq(customers.company_id, testCompanyId));
        await db.delete(users).where(eq(users.id, testUserId));
        await db.delete(companies).where(eq(companies.id, testCompanyId));
        console.log('✅ Limpeza de testes concluída');
      } catch (error) {
        console.error('❌ Erro na limpeza dos testes:', error);
      }
    }
  }, 30000);

  beforeEach(async () => {
    if (setupComplete) {
      // Limpar notificações antes de cada teste
      await db.delete(notifications).where(eq(notifications.user_id, testUserId));
    }
  });

  it('Property 1: Para qualquer notificação criada, deve ser armazenada no banco com todos os campos obrigatórios', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        // Geradores de dados aleatórios
        fc.constantFrom('new_ticket', 'status_change', 'new_reply', 'participant_added', 'participant_removed'),
        fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0), // Excluir strings vazias/só espaços
        fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0), // Excluir strings vazias/só espaços
        fc.constantFrom('low', 'medium', 'high', 'critical'),
        fc.boolean(),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (type, title, message, priority, includeTicket, action, details) => {
          // Criar metadata manualmente para evitar __proto__: null
          const metadata = { action, details };
          // Criar notificação
          const notificationData = {
            user_id: testUserId,
            type,
            title,
            message,
            priority,
            ticket_id: includeTicket ? testTicketId : null,
            ticket_code: includeTicket ? 'TEST-001' : null,
            metadata,
          };

          const [inserted] = await db.insert(notifications)
            .values(notificationData)
            .returning();

          // Verificar que a notificação foi inserida
          expect(inserted).toBeDefined();
          expect(inserted.id).toBeGreaterThan(0);

          // Buscar a notificação do banco
          const [retrieved] = await db.select()
            .from(notifications)
            .where(eq(notifications.id, inserted.id));

          // Verificar que todos os campos obrigatórios estão presentes e corretos
          expect(retrieved).toBeDefined();
          expect(retrieved.user_id).toBe(testUserId);
          expect(retrieved.type).toBe(type);
          expect(retrieved.title).toBe(title);
          expect(retrieved.message).toBe(message);
          expect(retrieved.priority).toBe(priority);
          expect(retrieved.created_at).toBeInstanceOf(Date);
          
          // Verificar campos opcionais
          if (includeTicket) {
            expect(retrieved.ticket_id).toBe(testTicketId);
            expect(retrieved.ticket_code).toBe('TEST-001');
          } else {
            expect(retrieved.ticket_id).toBeNull();
            expect(retrieved.ticket_code).toBeNull();
          }

          // Verificar metadata
          expect(retrieved.metadata).toEqual(metadata);

          // Verificar que read_at é null (não lida)
          expect(retrieved.read_at).toBeNull();

          // Limpar após o teste
          await db.delete(notifications).where(eq(notifications.id, inserted.id));
        }
      ),
      { numRuns: 100 } // Executar 100 iterações conforme especificação
    );
  }, 60000); // Timeout de 60 segundos para o teste de propriedade

  it('Property 1 - Edge Case: Notificação com campos mínimos obrigatórios', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Testar com apenas os campos obrigatórios
    const [inserted] = await db.insert(notifications)
      .values({
        user_id: testUserId,
        type: 'new_ticket',
        title: 'Test',
        message: 'Test message',
        priority: 'medium',
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.user_id).toBe(testUserId);
    expect(inserted.type).toBe('new_ticket');
    expect(inserted.title).toBe('Test');
    expect(inserted.message).toBe('Test message');
    expect(inserted.priority).toBe('medium');
    expect(inserted.created_at).toBeInstanceOf(Date);
    expect(inserted.read_at).toBeNull();
    expect(inserted.ticket_id).toBeNull();
    expect(inserted.ticket_code).toBeNull();
    expect(inserted.metadata).toBeNull();
  });

  it('Property 1 - Edge Case: Notificação com todos os campos opcionais', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    const metadata = {
      participantId: 123,
      participantName: 'John Doe',
      action: 'added',
      oldStatus: 'new',
      newStatus: 'ongoing',
    };

    const [inserted] = await db.insert(notifications)
      .values({
        user_id: testUserId,
        type: 'participant_added',
        title: 'Participante adicionado',
        message: 'John Doe foi adicionado ao ticket',
        priority: 'high',
        ticket_id: testTicketId,
        ticket_code: 'TEST-001',
        metadata,
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.ticket_id).toBe(testTicketId);
    expect(inserted.ticket_code).toBe('TEST-001');
    expect(inserted.metadata).toEqual(metadata);
  });

  it('Property 1 - Validação: Prioridade deve ser um valor válido', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Testar que apenas prioridades válidas são aceitas
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    for (const priority of validPriorities) {
      const [inserted] = await db.insert(notifications)
        .values({
          user_id: testUserId,
          type: 'new_ticket',
          title: 'Test',
          message: 'Test message',
          priority,
        })
        .returning();

      expect(inserted.priority).toBe(priority);
      await db.delete(notifications).where(eq(notifications.id, inserted.id));
    }
  });

  it('Property 1 - Validação: Prioridade padrão deve ser medium', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Inserir sem especificar prioridade (usando default do banco)
    const [inserted] = await db.insert(notifications)
      .values({
        user_id: testUserId,
        type: 'new_ticket',
        title: 'Test',
        message: 'Test message',
        // priority não especificado - deve usar default
      })
      .returning();

    expect(inserted.priority).toBe('medium');
  });

  it('Property 1 - Validação: Schema Zod valida campos obrigatórios', () => {
    // Teste sem conexão ao banco - valida apenas o schema Zod
    const validNotification = {
      user_id: 1,
      type: 'new_ticket',
      title: 'Test Title',
      message: 'Test Message',
      priority: 'medium',
    };

    const result = insertNotificationSchema.safeParse(validNotification);
    expect(result.success).toBe(true);

    // Testar com campos faltando
    const invalidNotification = {
      user_id: 1,
      type: 'new_ticket',
      // title faltando
      message: 'Test Message',
    };

    const invalidResult = insertNotificationSchema.safeParse(invalidNotification);
    expect(invalidResult.success).toBe(false);
  });
});
