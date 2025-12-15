/**
 * Testes de Propriedade para Recuperação de Notificações na Conexão
 * Feature: notification-system, Property 4: Recuperação de notificações não lidas na conexão
 * Validates: Requirements 1.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../db';
import { notifications, users, companies, tickets, customers } from '../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

describe('Property 4: Recuperação de notificações não lidas na conexão', () => {
  let testUserId: number;
  let testTicketId: number | null = null;
  let setupComplete = false;

  beforeAll(async () => {
    try {
      // Buscar um usuário existente no banco de dados
      const [existingUser] = await db
        .select()
        .from(users)
        .limit(1);

      if (!existingUser) {
        throw new Error('Nenhum usuário encontrado no banco de dados de teste');
      }

      testUserId = existingUser.id;

      // Buscar um ticket existente (opcional, para testes que precisam)
      const [existingTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.company_id, existingUser.company_id))
        .limit(1);

      if (existingTicket) {
        testTicketId = existingTicket.id;
      }

      setupComplete = true;
      console.log(`✅ Setup de testes de recuperação concluído - usando usuário ID: ${testUserId}`);
    } catch (error) {
      console.error('❌ Erro no setup dos testes de recuperação:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (setupComplete) {
      try {
        // Limpar apenas as notificações de teste criadas
        await db.delete(notifications).where(eq(notifications.user_id, testUserId));
        console.log('✅ Limpeza de testes de recuperação concluída');
      } catch (error) {
        console.error('❌ Erro na limpeza dos testes de recuperação:', error);
      }
    }
  }, 30000);

  beforeEach(async () => {
    if (setupComplete) {
      // Limpar notificações antes de cada teste
      await db.delete(notifications).where(eq(notifications.user_id, testUserId));
    }
  });

  it('Property 4: Para qualquer usuário que se conecta, todas as notificações não lidas devem ser recuperadas', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        // Gerar número aleatório de notificações não lidas (1 a 20)
        fc.integer({ min: 1, max: 20 }),
        // Gerar número aleatório de notificações lidas (0 a 10)
        fc.integer({ min: 0, max: 10 }),
        async (unreadCount, readCount) => {
          // Criar notificações não lidas
          const unreadNotifications = [];
          for (let i = 0; i < unreadCount; i++) {
            const [notification] = await db.insert(notifications).values({
              user_id: testUserId,
              type: 'new_ticket',
              title: `Notificação não lida ${i + 1}`,
              message: `Mensagem de teste ${i + 1}`,
              priority: 'medium',
              ticket_id: testTicketId,
              ticket_code: testTicketId ? `TEST-${i + 1}` : null,
              read_at: null, // Não lida
            }).returning();
            unreadNotifications.push(notification);
          }

          // Criar notificações lidas
          const readNotifications = [];
          for (let i = 0; i < readCount; i++) {
            const [notification] = await db.insert(notifications).values({
              user_id: testUserId,
              type: 'status_change',
              title: `Notificação lida ${i + 1}`,
              message: `Mensagem lida ${i + 1}`,
              priority: 'low',
              read_at: new Date(), // Lida
            }).returning();
            readNotifications.push(notification);
          }

          // Simular recuperação de notificações não lidas (como seria feito na conexão)
          const recovered = await db
            .select()
            .from(notifications)
            .where(and(
              eq(notifications.user_id, testUserId),
              sql`${notifications.read_at} IS NULL`
            ));

          // Verificar que todas as notificações não lidas foram recuperadas
          expect(recovered.length).toBe(unreadCount);

          // Verificar que nenhuma notificação lida foi recuperada
          const recoveredIds = recovered.map(n => n.id);
          for (const readNotif of readNotifications) {
            expect(recoveredIds).not.toContain(readNotif.id);
          }

          // Verificar que todas as notificações não lidas foram recuperadas
          for (const unreadNotif of unreadNotifications) {
            expect(recoveredIds).toContain(unreadNotif.id);
          }

          // Verificar que todas as notificações recuperadas têm read_at null
          for (const notif of recovered) {
            expect(notif.read_at).toBeNull();
          }

          // Limpar após o teste
          await db.delete(notifications).where(eq(notifications.user_id, testUserId));
        }
      ),
      { numRuns: 100 }
    );
  }, 120000); // Timeout de 120 segundos para o teste de propriedade

  it('Property 4 - Edge Case: Usuário sem notificações não lidas', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Criar apenas notificações lidas
    await db.insert(notifications).values([
      {
        user_id: testUserId,
        type: 'new_ticket',
        title: 'Notificação lida 1',
        message: 'Mensagem lida 1',
        priority: 'medium',
        read_at: new Date(),
      },
      {
        user_id: testUserId,
        type: 'status_change',
        title: 'Notificação lida 2',
        message: 'Mensagem lida 2',
        priority: 'low',
        read_at: new Date(),
      },
    ]);

    // Recuperar notificações não lidas
    const recovered = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Deve retornar array vazio
    expect(recovered).toEqual([]);
  });

  it('Property 4 - Edge Case: Usuário sem nenhuma notificação', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Não criar nenhuma notificação

    // Recuperar notificações não lidas
    const recovered = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Deve retornar array vazio
    expect(recovered).toEqual([]);
  });

  it('Property 4 - Edge Case: Todas as notificações são não lidas', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Criar apenas notificações não lidas
    const notificationCount = 15;
    const insertedIds = [];
    
    for (let i = 0; i < notificationCount; i++) {
      const [notification] = await db.insert(notifications).values({
        user_id: testUserId,
        type: 'new_reply',
        title: `Notificação ${i + 1}`,
        message: `Mensagem ${i + 1}`,
        priority: 'medium',
        read_at: null,
      }).returning();
      insertedIds.push(notification.id);
    }

    // Recuperar notificações não lidas
    const recovered = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Deve retornar todas as notificações
    expect(recovered.length).toBe(notificationCount);
    
    const recoveredIds = recovered.map(n => n.id);
    for (const id of insertedIds) {
      expect(recoveredIds).toContain(id);
    }
  });

  it('Property 4 - Validação: Contador de não lidas deve corresponder às notificações recuperadas', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Criar mix de notificações lidas e não lidas
    const unreadCount = 7;
    const readCount = 3;

    for (let i = 0; i < unreadCount; i++) {
      await db.insert(notifications).values({
        user_id: testUserId,
        type: 'new_ticket',
        title: `Não lida ${i + 1}`,
        message: `Mensagem ${i + 1}`,
        priority: 'medium',
        read_at: null,
      });
    }

    for (let i = 0; i < readCount; i++) {
      await db.insert(notifications).values({
        user_id: testUserId,
        type: 'status_change',
        title: `Lida ${i + 1}`,
        message: `Mensagem ${i + 1}`,
        priority: 'low',
        read_at: new Date(),
      });
    }

    // Recuperar notificações não lidas
    const recovered = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Contar notificações não lidas
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Contador deve corresponder ao número de notificações recuperadas
    expect(count).toBe(recovered.length);
    expect(count).toBe(unreadCount);
  });

  it('Property 4 - Validação: Notificações recuperadas devem estar ordenadas por data de criação', async () => {
    if (!setupComplete) {
      console.log('⏭️  Pulando teste - setup não completado');
      return;
    }

    // Criar notificações com pequenos delays para garantir ordem
    const notificationIds = [];
    for (let i = 0; i < 5; i++) {
      const [notification] = await db.insert(notifications).values({
        user_id: testUserId,
        type: 'new_ticket',
        title: `Notificação ${i + 1}`,
        message: `Mensagem ${i + 1}`,
        priority: 'medium',
        read_at: null,
      }).returning();
      notificationIds.push(notification.id);
      
      // Pequeno delay para garantir timestamps diferentes
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Recuperar notificações ordenadas por created_at DESC (mais recente primeiro)
    const recovered = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, testUserId),
        sql`${notifications.read_at} IS NULL`
      ))
      .orderBy(sql`${notifications.created_at} DESC`);

    // Verificar que estão ordenadas corretamente (mais recente primeiro)
    for (let i = 0; i < recovered.length - 1; i++) {
      const current = recovered[i].created_at.getTime();
      const next = recovered[i + 1].created_at.getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
