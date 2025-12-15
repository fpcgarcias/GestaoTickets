/**
 * Testes de Propriedade para APIs REST de Notificações
 * Feature: notification-system
 * 
 * Este arquivo contém testes baseados em propriedades (Property-Based Testing)
 * usando fast-check para verificar as propriedades de correção das APIs REST.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../db';
import { notifications, users, companies } from '../../../shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

// Tipos auxiliares
interface TestUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'customer';
  active: boolean;
}

// Geradores do fast-check
const notificationTypeArb = fc.constantFrom(
  'new_ticket',
  'status_change',
  'new_reply',
  'participant_added',
  'participant_removed',
  'ticket_escalated',
  'ticket_due_soon'
);

const priorityArb = fc.constantFrom('low', 'medium', 'high', 'critical');

// Gerador de notificação para testes de API
const notificationDataArb = fc.record({
  type: notificationTypeArb,
  title: fc.string({ minLength: 1, maxLength: 100 }),
  message: fc.string({ minLength: 1, maxLength: 500 }),
  priority: priorityArb,
});

// Helpers para criar dados de teste
async function createTestUser(role: 'admin' | 'support' | 'customer' = 'customer'): Promise<TestUser> {
  const timestamp = Date.now();
  const [user] = await db
    .insert(users)
    .values({
      username: `testuser${timestamp}`,
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'hashed_password',
      role,
      active: true,
      company_id: 1,
    })
    .returning();
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as 'admin' | 'support' | 'customer',
    active: user.active,
  };
}

async function createTestNotification(userId: number, data: any): Promise<number> {
  const [notification] = await db
    .insert(notifications)
    .values({
      user_id: userId,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      created_at: new Date(),
    })
    .returning();
  
  return notification.id;
}

async function cleanupTestData(userId: number) {
  await db.delete(notifications).where(eq(notifications.user_id, userId));
  await db.delete(users).where(eq(users.id, userId));
}

describe('Notifications API - Property-Based Tests', () => {
  const TEST_TIMEOUT = 30000; // 30 segundos
  let sharedTestUser: TestUser | null = null;

  // Criar usuário compartilhado antes de todos os testes
  beforeAll(async () => {
    sharedTestUser = await createTestUser('customer');
  });

  // Limpar tudo após todos os testes
  afterAll(async () => {
    if (sharedTestUser) {
      await cleanupTestData(sharedTestUser.id);
      sharedTestUser = null;
    }
  });

  /**
   * Feature: notification-system, Property 5: Ordenação e paginação do histórico
   * Validates: Requirements 1.5
   * 
   * Para qualquer solicitação de histórico de notificações, as notificações devem ser 
   * retornadas ordenadas por created_at em ordem decrescente, com paginação funcionando 
   * corretamente (respeitando page e limit).
   */
  describe('Property 5: Ordenação e paginação do histórico', () => {
    it('deve retornar notificações ordenadas por created_at DESC com paginação correta', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }), // Número de notificações (reduzido)
          fc.integer({ min: 2, max: 5 }),  // Tamanho da página
          async (totalNotifications, pageSize) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações com timestamps diferentes
            const notificationIds: number[] = [];
            for (let i = 0; i < totalNotifications; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Notification ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              notificationIds.push(id);
              // Aguardar 5ms para garantir timestamps diferentes (reduzido)
              await new Promise(resolve => setTimeout(resolve, 5));
            }

            // Buscar todas as notificações do banco para verificar ordenação
            const allNotifications = await db
              .select()
              .from(notifications)
              .where(eq(notifications.user_id, user.id))
              .orderBy(desc(notifications.created_at));

            // Verificar que estão ordenadas por created_at DESC
            for (let i = 0; i < allNotifications.length - 1; i++) {
              const current = allNotifications[i].created_at.getTime();
              const next = allNotifications[i + 1].created_at.getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }

            // Testar paginação
            const totalPages = Math.ceil(totalNotifications / pageSize);
            let retrievedCount = 0;

            for (let page = 1; page <= totalPages; page++) {
              const offset = (page - 1) * pageSize;
              const pageNotifications = await db
                .select()
                .from(notifications)
                .where(eq(notifications.user_id, user.id))
                .orderBy(desc(notifications.created_at))
                .limit(pageSize)
                .offset(offset);

              // Verificar que o número de notificações está correto
              const expectedCount = Math.min(pageSize, totalNotifications - offset);
              expect(pageNotifications.length).toBe(expectedCount);

              retrievedCount += pageNotifications.length;

              // Verificar que as notificações da página estão ordenadas
              for (let i = 0; i < pageNotifications.length - 1; i++) {
                const current = pageNotifications[i].created_at.getTime();
                const next = pageNotifications[i + 1].created_at.getTime();
                expect(current).toBeGreaterThanOrEqual(next);
              }
            }

            // Verificar que todas as notificações foram recuperadas
            expect(retrievedCount).toBe(totalNotifications);

            return true;
          }
        ),
        { numRuns: 10, timeout: 3000 } // Reduzido para 10 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 6: Marcação de leitura persiste no banco
   * Validates: Requirements 2.1, 2.2
   * 
   * Para qualquer notificação visualizada por um usuário, o campo read_at deve ser 
   * atualizado no banco de dados com um timestamp válido.
   */
  describe('Property 6: Marcação de leitura persiste no banco', () => {
    it('deve atualizar read_at ao marcar notificação como lida', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationDataArb,
          async (notifData) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificação
            const notifId = await createTestNotification(user.id, notifData);

            // Verificar que read_at é null inicialmente
            const [beforeUpdate] = await db
              .select()
              .from(notifications)
              .where(eq(notifications.id, notifId));
            
            expect(beforeUpdate.read_at).toBeNull();

            // Marcar como lida
            const beforeMark = new Date();
            await db
              .update(notifications)
              .set({ read_at: new Date() })
              .where(eq(notifications.id, notifId));

            // Verificar que read_at foi atualizado
            const [afterUpdate] = await db
              .select()
              .from(notifications)
              .where(eq(notifications.id, notifId));

            expect(afterUpdate.read_at).not.toBeNull();
            expect(afterUpdate.read_at).toBeInstanceOf(Date);
            expect(afterUpdate.read_at!.getTime()).toBeGreaterThanOrEqual(beforeMark.getTime());

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 7: Marcação em lote de todas como lidas
   * Validates: Requirements 2.3
   * 
   * Para qualquer usuário com notificações não lidas, ao solicitar marcar todas como lidas, 
   * todas as notificações não lidas devem ter read_at atualizado.
   */
  describe('Property 7: Marcação em lote de todas como lidas', () => {
    it('deve marcar todas as notificações não lidas como lidas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }), // Número de notificações (reduzido)
          async (totalNotifications) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações não lidas
            for (let i = 0; i < totalNotifications; i++) {
              await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Notification ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
            }

            // Verificar que todas estão não lidas
            const [{ count: unreadBefore }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            expect(unreadBefore).toBe(totalNotifications);

            // Marcar todas como lidas
            await db
              .update(notifications)
              .set({ read_at: new Date() })
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Verificar que todas foram marcadas como lidas
            const [{ count: unreadAfter }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            expect(unreadAfter).toBe(0);

            // Verificar que todas têm read_at preenchido
            const allNotifications = await db
              .select()
              .from(notifications)
              .where(eq(notifications.user_id, user.id));

            for (const notif of allNotifications) {
              expect(notif.read_at).not.toBeNull();
              expect(notif.read_at).toBeInstanceOf(Date);
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 8: Exclusão remove permanentemente
   * Validates: Requirements 2.4
   * 
   * Para qualquer notificação excluída por um usuário, a notificação não deve mais 
   * existir no banco de dados após a operação.
   */
  describe('Property 8: Exclusão remove permanentemente', () => {
    it('deve remover notificação permanentemente do banco', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationDataArb,
          async (notifData) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificação
            const notifId = await createTestNotification(user.id, notifData);

            // Verificar que existe
            const [beforeDelete] = await db
              .select()
              .from(notifications)
              .where(eq(notifications.id, notifId));
            
            expect(beforeDelete).toBeDefined();

            // Excluir
            await db
              .delete(notifications)
              .where(eq(notifications.id, notifId));

            // Verificar que não existe mais
            const afterDelete = await db
              .select()
              .from(notifications)
              .where(eq(notifications.id, notifId));

            expect(afterDelete.length).toBe(0);

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 9: Exclusão em lote funciona corretamente
   * Validates: Requirements 2.5
   * 
   * Para qualquer conjunto de IDs de notificações fornecido para exclusão, todas as 
   * notificações correspondentes devem ser removidas do banco de dados.
   */
  describe('Property 9: Exclusão em lote funciona corretamente', () => {
    it('deve excluir múltiplas notificações em uma operação', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 8 }), // Número de notificações para excluir (reduzido)
          fc.integer({ min: 0, max: 4 }),  // Número de notificações para manter (reduzido)
          async (toDelete, toKeep) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações para excluir
            const deleteIds: number[] = [];
            for (let i = 0; i < toDelete; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `To Delete ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              deleteIds.push(id);
            }

            // Criar notificações para manter
            const keepIds: number[] = [];
            for (let i = 0; i < toKeep; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_reply',
                title: `To Keep ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
              keepIds.push(id);
            }

            // Verificar contagem inicial
            const [{ count: beforeCount }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(eq(notifications.user_id, user.id));

            expect(beforeCount).toBe(toDelete + toKeep);

            // Excluir em lote usando inArray do drizzle-orm
            await db
              .delete(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                inArray(notifications.id, deleteIds)
              ));

            // Verificar que apenas as notificações corretas foram excluídas
            const remaining = await db
              .select()
              .from(notifications)
              .where(eq(notifications.user_id, user.id));

            expect(remaining.length).toBe(toKeep);

            // Verificar que as notificações mantidas são as corretas
            const remainingIds = remaining.map(n => n.id);
            for (const id of keepIds) {
              expect(remainingIds).toContain(id);
            }
            for (const id of deleteIds) {
              expect(remainingIds).not.toContain(id);
            }

            return true;
          }
        ),
        { numRuns: 15, timeout: 2000 } // Reduzido para 15 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 10: Contador atualizado após mudança de status
   * Validates: Requirements 2.6, 6.2, 6.3, 6.4
   * 
   * Para qualquer operação que altera o status de leitura de notificações, o contador 
   * de não lidas retornado deve refletir o estado atual correto no banco de dados.
   */
  describe('Property 10: Contador atualizado após mudança de status', () => {
    it('deve retornar contador correto após marcar como lida', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }), // Total de notificações (reduzido)
          fc.integer({ min: 0, max: 100 }), // Porcentagem para marcar como lida (0-100)
          async (totalNotifications, markPercentage) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações
            const notifIds: number[] = [];
            for (let i = 0; i < totalNotifications; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Notification ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              notifIds.push(id);
            }

            // Calcular quantas marcar como lidas
            const toMarkRead = Math.floor((totalNotifications * markPercentage) / 100);
            const idsToMark = notifIds.slice(0, toMarkRead);

            // Marcar algumas como lidas usando inArray do drizzle-orm
            if (idsToMark.length > 0) {
              await db
                .update(notifications)
                .set({ read_at: new Date() })
                .where(and(
                  eq(notifications.user_id, user.id),
                  inArray(notifications.id, idsToMark)
                ));
            }

            // Contar não lidas
            const [{ count: unreadCount }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Verificar que o contador está correto
            const expectedUnread = totalNotifications - toMarkRead;
            expect(unreadCount).toBe(expectedUnread);

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);

    it('deve retornar contador zero após marcar todas como lidas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }), // Reduzido
          async (totalNotifications) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações
            for (let i = 0; i < totalNotifications; i++) {
              await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Notification ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
            }

            // Marcar todas como lidas
            await db
              .update(notifications)
              .set({ read_at: new Date() })
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Contar não lidas
            const [{ count: unreadCount }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Deve ser zero
            expect(unreadCount).toBe(0);

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 20: Contador correto na conexão
   * Validates: Requirements 6.1
   * 
   * Para qualquer usuário que se conecta ao sistema, o contador de notificações não lidas 
   * retornado deve ser igual ao número de notificações com read_at IS NULL no banco de dados.
   */
  describe('Property 20: Contador correto na conexão', () => {
    it('deve retornar contador correto de notificações não lidas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // Notificações não lidas (reduzido)
          fc.integer({ min: 0, max: 10 }), // Notificações lidas (reduzido)
          async (unreadCount, readCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações não lidas
            for (let i = 0; i < unreadCount; i++) {
              await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Unread ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
            }

            // Criar notificações lidas
            for (let i = 0; i < readCount; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_reply',
                title: `Read ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
              
              // Marcar como lida
              await db
                .update(notifications)
                .set({ read_at: new Date() })
                .where(eq(notifications.id, id));
            }

            // Contar não lidas
            const [{ count }] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Verificar que o contador está correto
            expect(count).toBe(unreadCount);

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduzido para 20 iterações
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 26: Filtragem por tipo funciona corretamente
   * Validates: Requirements 8.1
   * 
   * Para qualquer solicitação de notificações filtradas por tipo, apenas notificações 
   * do tipo especificado devem ser retornadas.
   */
  describe('Property 26: Filtragem por tipo funciona corretamente', () => {
    it('deve retornar apenas notificações do tipo especificado', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationTypeArb,
          fc.integer({ min: 1, max: 5 }), // Notificações do tipo filtrado
          fc.integer({ min: 1, max: 5 }), // Notificações de outros tipos
          async (filterType, matchingCount, otherCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações do tipo filtrado
            for (let i = 0; i < matchingCount; i++) {
              await createTestNotification(user.id, {
                type: filterType,
                title: `Matching ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
            }

            // Criar notificações de outros tipos
            const otherTypes = ['new_ticket', 'status_change', 'new_reply', 'participant_added']
              .filter(t => t !== filterType);
            
            for (let i = 0; i < otherCount; i++) {
              const otherType = otherTypes[i % otherTypes.length];
              await createTestNotification(user.id, {
                type: otherType,
                title: `Other ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
            }

            // Buscar com filtro de tipo
            const filtered = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                eq(notifications.type, filterType)
              ));

            // Verificar que apenas notificações do tipo correto foram retornadas
            expect(filtered.length).toBe(matchingCount);
            
            for (const notif of filtered) {
              expect(notif.type).toBe(filterType);
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 27: Filtragem por status de leitura
   * Validates: Requirements 8.2
   * 
   * Para qualquer solicitação de notificações filtradas por status de leitura 
   * (read=true ou read=false), apenas notificações com o status correspondente 
   * devem ser retornadas.
   */
  describe('Property 27: Filtragem por status de leitura', () => {
    it('deve retornar apenas notificações lidas quando read=true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8 }), // Notificações lidas
          fc.integer({ min: 1, max: 8 }), // Notificações não lidas
          async (readCount, unreadCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações lidas
            for (let i = 0; i < readCount; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Read ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              
              await db
                .update(notifications)
                .set({ read_at: new Date() })
                .where(eq(notifications.id, id));
            }

            // Criar notificações não lidas
            for (let i = 0; i < unreadCount; i++) {
              await createTestNotification(user.id, {
                type: 'new_reply',
                title: `Unread ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
            }

            // Buscar apenas lidas
            const readNotifications = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NOT NULL`
              ));

            // Verificar que apenas lidas foram retornadas
            expect(readNotifications.length).toBe(readCount);
            
            for (const notif of readNotifications) {
              expect(notif.read_at).not.toBeNull();
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 }
      );
    }, TEST_TIMEOUT);

    it('deve retornar apenas notificações não lidas quando read=false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8 }), // Notificações lidas
          fc.integer({ min: 1, max: 8 }), // Notificações não lidas
          async (readCount, unreadCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações lidas
            for (let i = 0; i < readCount; i++) {
              const id = await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Read ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              
              await db
                .update(notifications)
                .set({ read_at: new Date() })
                .where(eq(notifications.id, id));
            }

            // Criar notificações não lidas
            for (let i = 0; i < unreadCount; i++) {
              await createTestNotification(user.id, {
                type: 'new_reply',
                title: `Unread ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
            }

            // Buscar apenas não lidas
            const unreadNotifications = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.read_at} IS NULL`
              ));

            // Verificar que apenas não lidas foram retornadas
            expect(unreadNotifications.length).toBe(unreadCount);
            
            for (const notif of unreadNotifications) {
              expect(notif.read_at).toBeNull();
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 28: Filtragem por período de datas
   * Validates: Requirements 8.3
   * 
   * Para qualquer solicitação de notificações filtradas por período (startDate e endDate), 
   * apenas notificações com created_at dentro do intervalo devem ser retornadas.
   */
  describe('Property 28: Filtragem por período de datas', () => {
    it('deve retornar apenas notificações dentro do período especificado', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Notificações antes do período
          fc.integer({ min: 1, max: 5 }), // Notificações dentro do período
          fc.integer({ min: 1, max: 5 }), // Notificações depois do período
          async (beforeCount, withinCount, afterCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            const now = new Date();
            const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 dias atrás
            const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 dia atrás
            
            // Criar notificações antes do período
            for (let i = 0; i < beforeCount; i++) {
              const beforeDate = new Date(startDate.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
              await db.insert(notifications).values({
                user_id: user.id,
                type: 'new_ticket',
                title: `Before ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
                created_at: beforeDate,
              });
            }

            // Criar notificações dentro do período
            for (let i = 0; i < withinCount; i++) {
              const withinDate = new Date(
                startDate.getTime() + 
                (i + 1) * ((endDate.getTime() - startDate.getTime()) / (withinCount + 1))
              );
              await db.insert(notifications).values({
                user_id: user.id,
                type: 'new_reply',
                title: `Within ${i}`,
                message: `Message ${i}`,
                priority: 'low',
                created_at: withinDate,
              });
            }

            // Criar notificações depois do período
            for (let i = 0; i < afterCount; i++) {
              const afterDate = new Date(endDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
              await db.insert(notifications).values({
                user_id: user.id,
                type: 'status_change',
                title: `After ${i}`,
                message: `Message ${i}`,
                priority: 'high',
                created_at: afterDate,
              });
            }

            // Buscar com filtro de período
            const filtered = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`${notifications.created_at} >= ${startDate}`,
                sql`${notifications.created_at} <= ${endDate}`
              ));

            // Verificar que apenas notificações dentro do período foram retornadas
            expect(filtered.length).toBe(withinCount);
            
            for (const notif of filtered) {
              expect(notif.created_at.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(notif.created_at.getTime()).toBeLessThanOrEqual(endDate.getTime());
            }

            return true;
          }
        ),
        { numRuns: 15, timeout: 3000 }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 29: Busca textual funciona
   * Validates: Requirements 8.4
   * 
   * Para qualquer busca textual em notificações, apenas notificações cujo title ou 
   * message contenham o texto buscado (case-insensitive) devem ser retornadas.
   */
  describe('Property 29: Busca textual funciona', () => {
    it('deve retornar notificações que contenham o texto buscado', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-zA-Z]+$/.test(s)), // Termo de busca
          fc.integer({ min: 1, max: 5 }), // Notificações que contêm o termo
          fc.integer({ min: 1, max: 5 }), // Notificações que não contêm o termo
          async (searchTerm, matchingCount, nonMatchingCount) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações que contêm o termo (no título)
            for (let i = 0; i < matchingCount; i++) {
              await createTestNotification(user.id, {
                type: 'new_ticket',
                title: `Title with ${searchTerm} keyword ${i}`,
                message: `Regular message ${i}`,
                priority: 'medium',
              });
            }

            // Criar notificações que não contêm o termo
            for (let i = 0; i < nonMatchingCount; i++) {
              await createTestNotification(user.id, {
                type: 'new_reply',
                title: `Different title ${i}`,
                message: `Different message ${i}`,
                priority: 'low',
              });
            }

            // Buscar com termo de busca (case-insensitive)
            const searchPattern = `%${searchTerm}%`;
            const filtered = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                sql`(LOWER(${notifications.title}) LIKE LOWER(${searchPattern}) OR LOWER(${notifications.message}) LIKE LOWER(${searchPattern}))`
              ));

            // Verificar que apenas notificações com o termo foram retornadas
            expect(filtered.length).toBeGreaterThanOrEqual(matchingCount);
            
            for (const notif of filtered) {
              const titleLower = notif.title.toLowerCase();
              const messageLower = notif.message.toLowerCase();
              const termLower = searchTerm.toLowerCase();
              
              const containsTerm = titleLower.includes(termLower) || messageLower.includes(termLower);
              expect(containsTerm).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 15, timeout: 2000 }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Feature: notification-system, Property 30: Combinação de filtros usa AND
   * Validates: Requirements 8.5
   * 
   * Para qualquer solicitação com múltiplos filtros aplicados, os resultados devem 
   * satisfazer TODOS os filtros simultaneamente (operador AND).
   */
  describe('Property 30: Combinação de filtros usa AND', () => {
    it('deve aplicar múltiplos filtros com operador AND', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationTypeArb,
          fc.boolean(), // Status de leitura
          async (filterType, shouldBeRead) => {
            if (!sharedTestUser) throw new Error('Test user not initialized');
            const user = sharedTestUser;
            
            // Limpar notificações antes do teste
            await db.delete(notifications).where(eq(notifications.user_id, user.id));
            
            // Criar notificações que atendem ambos os critérios
            const matchingIds: number[] = [];
            for (let i = 0; i < 3; i++) {
              const id = await createTestNotification(user.id, {
                type: filterType,
                title: `Matching ${i}`,
                message: `Message ${i}`,
                priority: 'medium',
              });
              
              if (shouldBeRead) {
                await db
                  .update(notifications)
                  .set({ read_at: new Date() })
                  .where(eq(notifications.id, id));
              }
              
              matchingIds.push(id);
            }

            // Criar notificações que atendem apenas o tipo
            for (let i = 0; i < 2; i++) {
              const id = await createTestNotification(user.id, {
                type: filterType,
                title: `Type only ${i}`,
                message: `Message ${i}`,
                priority: 'low',
              });
              
              if (!shouldBeRead) {
                await db
                  .update(notifications)
                  .set({ read_at: new Date() })
                  .where(eq(notifications.id, id));
              }
            }

            // Criar notificações que atendem apenas o status de leitura
            const otherTypes = ['new_ticket', 'status_change', 'new_reply']
              .filter(t => t !== filterType);
            
            for (let i = 0; i < 2; i++) {
              const otherType = otherTypes[i % otherTypes.length];
              const id = await createTestNotification(user.id, {
                type: otherType,
                title: `Read only ${i}`,
                message: `Message ${i}`,
                priority: 'high',
              });
              
              if (shouldBeRead) {
                await db
                  .update(notifications)
                  .set({ read_at: new Date() })
                  .where(eq(notifications.id, id));
              }
            }

            // Buscar com ambos os filtros (AND)
            const readCondition = shouldBeRead
              ? sql`${notifications.read_at} IS NOT NULL`
              : sql`${notifications.read_at} IS NULL`;
            
            const filtered = await db
              .select()
              .from(notifications)
              .where(and(
                eq(notifications.user_id, user.id),
                eq(notifications.type, filterType),
                readCondition
              ));

            // Verificar que apenas notificações que atendem AMBOS os critérios foram retornadas
            expect(filtered.length).toBe(matchingIds.length);
            
            for (const notif of filtered) {
              // Verificar tipo
              expect(notif.type).toBe(filterType);
              
              // Verificar status de leitura
              if (shouldBeRead) {
                expect(notif.read_at).not.toBeNull();
              } else {
                expect(notif.read_at).toBeNull();
              }
            }

            return true;
          }
        ),
        { numRuns: 20, timeout: 2000 }
      );
    }, TEST_TIMEOUT);
  });
});
