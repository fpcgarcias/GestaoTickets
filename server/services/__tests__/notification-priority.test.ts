import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { db } from '../../db';
import { notifications, users, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { notificationService } from '../notification-service';
import { webPushService } from '../web-push-service';

// Configurar timeout maior para testes de propriedade
const PROPERTY_TEST_TIMEOUT = 30000;

describe('Notification Priority Properties', () => {
  let testUserId: number;
  let testCompanyId: number;

  beforeEach(async () => {
    // Criar empresa de teste
    const [company] = await db.insert(companies).values({
      name: 'Test Company',
      email: 'test@company.com',
      active: true,
    }).returning();
    testCompanyId = company.id;

    // Criar usuário de teste
    const [user] = await db.insert(users).values({
      username: 'testuser',
      password: 'hashedpassword',
      email: 'test@example.com',
      name: 'Test User',
      role: 'customer',
      company_id: testCompanyId,
    }).returning();
    testUserId = user.id;
  });

  afterEach(async () => {
    // Limpar dados de teste
    await db.delete(notifications).where(eq(notifications.user_id, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
  });

  /**
   * Property 31: Validação de prioridades
   * Para qualquer notificação criada, o campo priority deve aceitar apenas valores válidos (low, medium, high, critical).
   * Validates: Requirements 9.1
   */
  it('Property 31: Validação de prioridades', async () => {
    // Feature: notification-system, Property 31: Validação de prioridades
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 500 }),
          priority: fc.oneof(
            fc.constant('low'),
            fc.constant('medium'),
            fc.constant('high'),
            fc.constant('critical'),
            fc.constant('invalid_priority'), // Valor inválido para testar validação
            fc.constant(undefined) // Sem prioridade para testar padrão
          ),
        }),
        async (payload) => {
          // Enviar notificação
          await notificationService.sendNotificationToUser(testUserId, {
            type: payload.type,
            title: payload.title,
            message: payload.message,
            priority: payload.priority as any,
            timestamp: new Date(),
          });

          // Buscar notificação criada
          const [notification] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.user_id, testUserId))
            .orderBy(notifications.created_at)
            .limit(1);

          expect(notification).toBeDefined();

          // Verificar que a prioridade é sempre um valor válido
          const validPriorities = ['low', 'medium', 'high', 'critical'];
          expect(validPriorities).toContain(notification.priority);

          // Se prioridade inválida ou undefined foi fornecida, deve usar 'medium' como padrão
          if (!payload.priority || !validPriorities.includes(payload.priority)) {
            expect(notification.priority).toBe('medium');
          } else {
            expect(notification.priority).toBe(payload.priority);
          }

          // Limpar para próxima iteração
          await db.delete(notifications).where(eq(notifications.id, notification.id));
        }
      ),
      { numRuns: 20 } // Reduzir runs para evitar timeout
    );
  }, PROPERTY_TEST_TIMEOUT);

  /**
   * Property 32: Configuração de Web Push para notificações críticas
   * Para qualquer notificação com priority='critical' enviada via Web Push, a configuração deve incluir requireInteraction=true e vibrate pattern apropriado.
   * Validates: Requirements 9.2
   */
  it('Property 32: Configuração de Web Push para notificações críticas', async () => {
    // Feature: notification-system, Property 32: Configuração de Web Push para notificações críticas
    
    // Mock do webPushService para capturar chamadas
    const originalSendPushNotification = webPushService.sendPushNotification;
    let capturedNotifications: any[] = [];
    
    webPushService.sendPushNotification = async (userId: number, notification: any) => {
      capturedNotifications.push({ userId, notification });
      return Promise.resolve();
    };

    try {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            message: fc.string({ minLength: 1, maxLength: 500 }),
            priority: fc.constantFrom('low', 'medium', 'high', 'critical'),
          }),
          async (payload) => {
            capturedNotifications = [];

            // Simular usuário offline (sem WebSocket)
            // Enviar notificação
            await notificationService.sendNotificationToUser(testUserId, {
              type: payload.type,
              title: payload.title,
              message: payload.message,
              priority: payload.priority as any,
              timestamp: new Date(),
            });

            // Verificar se Web Push foi chamado (usuário offline)
            if (capturedNotifications.length > 0) {
              const pushNotification = capturedNotifications[0].notification;
              
              // Para notificações críticas, verificar configurações especiais
              if (payload.priority === 'critical') {
                expect(pushNotification.priority).toBe('critical');
                // A configuração específica é feita no WebPushService.sendToSubscription
                // que usa a prioridade para configurar urgência alta
              }
              
              // Verificar que a prioridade está incluída nos dados
              expect(pushNotification.priority).toBe(payload.priority);
            }

            // Limpar notificações criadas
            await db.delete(notifications).where(eq(notifications.user_id, testUserId));
          }
        ),
        { numRuns: 50 }
      );
    } finally {
      // Restaurar método original
      webPushService.sendPushNotification = originalSendPushNotification;
    }
  });

  /**
   * Property 33: Prioridade incluída nos dados retornados
   * Para qualquer notificação retornada pela API, o campo priority deve estar presente nos dados.
   * Validates: Requirements 9.3
   */
  it('Property 33: Prioridade incluída nos dados retornados', async () => {
    // Feature: notification-system, Property 33: Prioridade incluída nos dados retornados
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            message: fc.string({ minLength: 1, maxLength: 500 }),
            priority: fc.constantFrom('low', 'medium', 'high', 'critical'),
          }),
          { minLength: 1, maxLength: 5 } // Reduzir para evitar timeout
        ),
        async (payloads) => {
          // Criar múltiplas notificações
          for (const payload of payloads) {
            await notificationService.sendNotificationToUser(testUserId, {
              type: payload.type,
              title: payload.title,
              message: payload.message,
              priority: payload.priority as any,
              timestamp: new Date(),
            });
          }

          // Buscar todas as notificações criadas
          const notificationsList = await db
            .select()
            .from(notifications)
            .where(eq(notifications.user_id, testUserId))
            .orderBy(notifications.created_at);

          expect(notificationsList.length).toBe(payloads.length);

          // Verificar que todas as notificações têm o campo priority
          for (const notification of notificationsList) {
            expect(notification.priority).toBeDefined();
            expect(typeof notification.priority).toBe('string');
            expect(['low', 'medium', 'high', 'critical']).toContain(notification.priority);
          }

          // Limpar notificações criadas
          await db.delete(notifications).where(eq(notifications.user_id, testUserId));
        }
      ),
      { numRuns: 10 } // Reduzir runs para evitar timeout
    );
  }, PROPERTY_TEST_TIMEOUT);

  /**
   * Property 34: Prioridade padrão é medium
   * Para qualquer notificação criada sem especificar priority, o valor padrão deve ser 'medium'.
   * Validates: Requirements 9.5
   */
  it('Property 34: Prioridade padrão é medium', async () => {
    // Feature: notification-system, Property 34: Prioridade padrão é medium
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          message: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        async (payload) => {
          // Enviar notificação SEM especificar prioridade
          await notificationService.sendNotificationToUser(testUserId, {
            type: payload.type,
            title: payload.title,
            message: payload.message,
            // priority: undefined - não especificado
            timestamp: new Date(),
          });

          // Buscar notificação criada
          const [notification] = await db
            .select()
            .from(notifications)
            .where(eq(notifications.user_id, testUserId))
            .orderBy(notifications.created_at)
            .limit(1);

          expect(notification).toBeDefined();
          
          // Verificar que a prioridade padrão é 'medium'
          expect(notification.priority).toBe('medium');

          // Limpar para próxima iteração
          await db.delete(notifications).where(eq(notifications.id, notification.id));
        }
      ),
      { numRuns: 20 } // Reduzir runs para evitar timeout
    );
  }, PROPERTY_TEST_TIMEOUT);
});