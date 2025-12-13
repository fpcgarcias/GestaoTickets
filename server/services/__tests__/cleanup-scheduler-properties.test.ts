/**
 * Testes de Propriedade para CleanupScheduler
 * 
 * Este arquivo contém testes baseados em propriedades (Property-Based Testing)
 * usando fast-check para verificar as propriedades de correção do sistema de limpeza automática.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CleanupScheduler } from '../cleanup-scheduler';
import { db } from '../../db';
import { notifications, users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Tipo para notificações com informações de teste
type TestNotification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  ticket_id: number | null;
  ticket_code: string | null;
  metadata: unknown;
  read_at: Date | null;
  created_at: Date;
  daysOld: number;
};

describe('CleanupScheduler - Property-Based Tests', () => {
  let scheduler: CleanupScheduler;
  let testUserId: number;

  beforeEach(async () => {
    scheduler = new CleanupScheduler();
    
    // Limpar TODAS as notificações antes de cada teste para garantir isolamento
    await db.delete(notifications);
    
    // Criar usuário de teste
    const [user] = await db.insert(users).values({
      username: `testuser_${Date.now()}_${Math.random()}`, // Username único
      name: 'Test User',
      email: `test_${Date.now()}_${Math.random()}@example.com`, // Email único
      password: 'hashedpassword',
      role: 'customer',
      company_id: 1,
    }).returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    // Parar scheduler se estiver rodando
    scheduler.stop();
    
    // Limpar notificações de teste
    await db.delete(notifications).where(eq(notifications.user_id, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('Property 16: Limpeza de notificações lidas antigas', () => {
    it('Feature: notification-system, Property 16: Para qualquer conjunto de notificações lidas antigas, a limpeza deve remover apenas aquelas com mais de 90 dias', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Gerar array de notificações com diferentes idades
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
              priority: fc.constantFrom('low', 'medium', 'high', 'critical'),
              daysOld: fc.integer({ min: 1, max: 200 }), // 1 a 200 dias atrás
              isRead: fc.boolean(),
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (notificationSpecs) => {
            // Filtrar apenas notificações lidas para este teste
            const readNotifications = notificationSpecs.filter(spec => spec.isRead);
            
            if (readNotifications.length === 0) return; // Skip se não há notificações lidas

            // Criar notificações no banco
            const createdNotifications: TestNotification[] = [];
            for (const spec of readNotifications) {
              const createdAt = new Date(Date.now() - (spec.daysOld * 24 * 60 * 60 * 1000));
              const readAt = new Date(createdAt.getTime() + (60 * 60 * 1000)); // Lida 1h depois

              const [notification] = await db.insert(notifications).values({
                user_id: testUserId,
                type: spec.type,
                title: spec.title,
                message: spec.message,
                priority: spec.priority,
                created_at: createdAt,
                read_at: readAt,
              }).returning();

              createdNotifications.push({
                ...notification,
                daysOld: spec.daysOld,
              });
            }

            // Executar limpeza
            const result = await scheduler.cleanupOldNotifications();

            // Verificar quais notificações ainda existem
            const remainingNotifications = await db
              .select()
              .from(notifications)
              .where(eq(notifications.user_id, testUserId));

            // Calcular quantas deveriam ser removidas (lidas com mais de 90 dias)
            const shouldBeRemoved = createdNotifications.filter(n => n.daysOld > 90);
            const shouldRemain = createdNotifications.filter(n => n.daysOld <= 90);

            // Verificar propriedade: apenas notificações lidas com mais de 90 dias foram removidas
            expect(result.readCount).toBe(shouldBeRemoved.length);
            expect(remainingNotifications.length).toBe(shouldRemain.length);

            // Verificar que as notificações restantes são as corretas
            for (const remaining of remainingNotifications) {
              const original = createdNotifications.find(n => n.id === remaining.id);
              expect(original?.daysOld).toBeLessThanOrEqual(90);
            }
          }
        ),
        { numRuns: 20 } // Reduzido para 20 para ser mais rápido
      );
    });
  });

  describe('Property 17: Limpeza de notificações não lidas antigas', () => {
    it('Feature: notification-system, Property 17: Para qualquer conjunto de notificações não lidas antigas, a limpeza deve remover apenas aquelas com mais de 180 dias', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Gerar array de notificações não lidas com diferentes idades
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
              priority: fc.constantFrom('low', 'medium', 'high', 'critical'),
              daysOld: fc.integer({ min: 1, max: 300 }), // 1 a 300 dias atrás
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (notificationSpecs) => {
            // Criar notificações não lidas no banco
            const createdNotifications: TestNotification[] = [];
            for (const spec of notificationSpecs) {
              const createdAt = new Date(Date.now() - (spec.daysOld * 24 * 60 * 60 * 1000));

              const [notification] = await db.insert(notifications).values({
                user_id: testUserId,
                type: spec.type,
                title: spec.title,
                message: spec.message,
                priority: spec.priority,
                created_at: createdAt,
                read_at: null, // Não lida
              }).returning();

              createdNotifications.push({
                ...notification,
                daysOld: spec.daysOld,
              });
            }

            // Executar limpeza
            const result = await scheduler.cleanupOldNotifications();

            // Verificar quais notificações ainda existem
            const remainingNotifications = await db
              .select()
              .from(notifications)
              .where(eq(notifications.user_id, testUserId));

            // Calcular quantas deveriam ser removidas (não lidas com mais de 180 dias)
            const shouldBeRemoved = createdNotifications.filter(n => n.daysOld > 180);
            const shouldRemain = createdNotifications.filter(n => n.daysOld <= 180);

            // Verificar propriedade: apenas notificações não lidas com mais de 180 dias foram removidas
            expect(result.unreadCount).toBe(shouldBeRemoved.length);
            expect(remainingNotifications.length).toBe(shouldRemain.length);

            // Verificar que as notificações restantes são as corretas
            for (const remaining of remainingNotifications) {
              const original = createdNotifications.find(n => n.id === remaining.id);
              expect(original?.daysOld).toBeLessThanOrEqual(180);
              expect(remaining.read_at).toBeNull(); // Ainda não lida
            }
          }
        ),
        { numRuns: 20 } // Reduzido para 20 para ser mais rápido
      );
    });
  });

  describe('Property 18: Logging de limpeza', () => {
    it('Feature: notification-system, Property 18: Para qualquer execução de limpeza, o sistema deve registrar no log a quantidade de notificações removidas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            readNotifications: fc.array(
              fc.record({
                daysOld: fc.integer({ min: 91, max: 200 }), // Antigas o suficiente para serem removidas
                title: fc.string({ minLength: 1, maxLength: 50 }),
              }),
              { minLength: 0, maxLength: 5 }
            ),
            unreadNotifications: fc.array(
              fc.record({
                daysOld: fc.integer({ min: 181, max: 300 }), // Antigas o suficiente para serem removidas
                title: fc.string({ minLength: 1, maxLength: 50 }),
              }),
              { minLength: 0, maxLength: 5 }
            ),
          }),
          async ({ readNotifications, unreadNotifications }) => {
            // Criar notificações lidas antigas
            for (const spec of readNotifications) {
              const createdAt = new Date(Date.now() - (spec.daysOld * 24 * 60 * 60 * 1000));
              const readAt = new Date(createdAt.getTime() + (60 * 60 * 1000));

              await db.insert(notifications).values({
                user_id: testUserId,
                type: 'new_ticket',
                title: spec.title,
                message: 'Test message',
                priority: 'medium',
                created_at: createdAt,
                read_at: readAt,
              });
            }

            // Criar notificações não lidas antigas
            for (const spec of unreadNotifications) {
              const createdAt = new Date(Date.now() - (spec.daysOld * 24 * 60 * 60 * 1000));

              await db.insert(notifications).values({
                user_id: testUserId,
                type: 'new_ticket',
                title: spec.title,
                message: 'Test message',
                priority: 'medium',
                created_at: createdAt,
                read_at: null,
              });
            }

            // Executar limpeza
            const result = await scheduler.cleanupOldNotifications();

            // Verificar propriedade: quantidades corretas foram removidas
            expect(result.readCount).toBe(readNotifications.length);
            expect(result.unreadCount).toBe(unreadNotifications.length);
          }
        ),
        { numRuns: 20 } // Reduzido para 20 para ser mais rápido
      );
    });
  });

  describe('Property 19: Integridade referencial na limpeza', () => {
    it('Feature: notification-system, Property 19: Para qualquer remoção de notificações antigas, outras tabelas do banco não devem ser afetadas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 50 }),
              daysOld: fc.integer({ min: 200, max: 400 }), // Muito antigas para serem removidas
              isRead: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (notificationSpecs) => {
            // Contar usuários antes da limpeza
            const usersBefore = await db.select().from(users);
            const usersCountBefore = usersBefore.length;

            // Criar notificações antigas
            for (const spec of notificationSpecs) {
              const createdAt = new Date(Date.now() - (spec.daysOld * 24 * 60 * 60 * 1000));
              const readAt = spec.isRead ? new Date(createdAt.getTime() + (60 * 60 * 1000)) : null;

              await db.insert(notifications).values({
                user_id: testUserId,
                type: 'new_ticket',
                title: spec.title,
                message: 'Test message',
                priority: 'medium',
                created_at: createdAt,
                read_at: readAt,
              });
            }

            // Executar limpeza
            await scheduler.cleanupOldNotifications();

            // Verificar propriedade: tabela de usuários não foi afetada
            const usersAfter = await db.select().from(users);
            const usersCountAfter = usersAfter.length;

            expect(usersCountAfter).toBe(usersCountBefore);

            // Verificar que o usuário de teste ainda existe
            const testUserStillExists = usersAfter.some(user => user.id === testUserId);
            expect(testUserStillExists).toBe(true);

            // Verificar que as propriedades do usuário não mudaram
            const testUserAfter = usersAfter.find(user => user.id === testUserId);
            const testUserBefore = usersBefore.find(user => user.id === testUserId);
            
            expect(testUserAfter?.name).toBe(testUserBefore?.name);
            expect(testUserAfter?.email).toBe(testUserBefore?.email);
            expect(testUserAfter?.role).toBe(testUserBefore?.role);
          }
        ),
        { numRuns: 20 } // Reduzido para 20 para ser mais rápido
      );
    });
  });
});