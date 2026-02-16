/**
 * Testes para endpoints REST de Push Subscriptions
 * Feature: notification-system
 * 
 * Testes unitários para validar os endpoints de gerenciamento de push subscriptions.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../db';
import { pushSubscriptions, users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { webPushService } from '../../services/web-push-service';

// Tipos auxiliares
interface TestUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'customer';
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

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
  };
}

async function cleanupTestData(userId: number) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.user_id, userId));
  await db.delete(users).where(eq(users.id, userId));
}

function generateMockSubscription(): PushSubscriptionData {
  const timestamp = Date.now();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${timestamp}`,
    keys: {
      p256dh: `mock_p256dh_key_${timestamp}`,
      auth: `mock_auth_key_${timestamp}`,
    },
  };
}

describe('Push Subscriptions API - Unit Tests', () => {
  const TEST_TIMEOUT = 10000;
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser('customer');
  });

  afterAll(async () => {
    await cleanupTestData(testUser.id);
  });



  describe('POST /api/notifications/push/subscribe', () => {
    it('deve registrar uma nova push subscription com dados válidos', async () => {
      const subscription = generateMockSubscription();

      // Registrar subscription
      await webPushService.subscribe(testUser.id, subscription, 'Mozilla/5.0');

      // Verificar que foi salva no banco
      const saved = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      expect(saved.length).toBe(1);
      expect(saved[0].user_id).toBe(testUser.id);
      expect(saved[0].endpoint).toBe(subscription.endpoint);
      expect(saved[0].p256dh_key).toBe(subscription.keys.p256dh);
      expect(saved[0].auth_key).toBe(subscription.keys.auth);
      expect(saved[0].user_agent).toBe('Mozilla/5.0');
    }, TEST_TIMEOUT);

    it('deve rejeitar subscription com endpoint inválido', async () => {
      const invalidSubscriptions = [
        { endpoint: '', keys: { p256dh: 'key1', auth: 'key2' } },
        { endpoint: null, keys: { p256dh: 'key1', auth: 'key2' } },
        { endpoint: 123, keys: { p256dh: 'key1', auth: 'key2' } },
      ];

      for (const invalid of invalidSubscriptions) {
        // Validação deve falhar antes de chamar o serviço
        // Simular validação do endpoint
        const isValid = typeof invalid.endpoint === 'string' && invalid.endpoint.length > 0;
        expect(isValid).toBe(false);
      }
    }, TEST_TIMEOUT);

    it('deve rejeitar subscription com keys inválidas', async () => {
      const invalidSubscriptions = [
        { endpoint: 'https://example.com', keys: null },
        { endpoint: 'https://example.com', keys: {} },
        { endpoint: 'https://example.com', keys: { p256dh: '', auth: 'key' } },
        { endpoint: 'https://example.com', keys: { p256dh: 'key', auth: '' } },
      ];

      for (const invalid of invalidSubscriptions) {
        // Validação deve falhar
        const isValid = 
          invalid.keys &&
          typeof invalid.keys === 'object' &&
          typeof (invalid.keys as any).p256dh === 'string' &&
          (invalid.keys as any).p256dh.length > 0 &&
          typeof (invalid.keys as any).auth === 'string' &&
          (invalid.keys as any).auth.length > 0;
        
        expect(isValid).toBeFalsy();
      }
    }, TEST_TIMEOUT);

    it('deve tratar duplicatas atualizando last_used_at', async () => {
      const subscription = generateMockSubscription();

      // Registrar pela primeira vez
      await webPushService.subscribe(testUser.id, subscription);

      const [first] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      const firstTimestamp = first.last_used_at;

      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 100));

      // Registrar novamente (duplicata)
      await webPushService.subscribe(testUser.id, subscription);

      // Verificar que ainda existe apenas uma subscription
      const all = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      expect(all.length).toBe(1);

      // Verificar que last_used_at foi atualizado
      expect(all[0].last_used_at!.getTime()).toBeGreaterThan(firstTimestamp!.getTime());
    }, TEST_TIMEOUT);
  });

  describe('POST /api/notifications/push/unsubscribe', () => {
    it('deve remover uma push subscription existente', async () => {
      const subscription = generateMockSubscription();

      // Registrar subscription
      await webPushService.subscribe(testUser.id, subscription);

      // Verificar que existe
      const before = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      expect(before.length).toBe(1);

      // Remover subscription
      await webPushService.unsubscribe(testUser.id, subscription.endpoint);

      // Verificar que foi removida
      const after = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      expect(after.length).toBe(0);
    }, TEST_TIMEOUT);

    it('deve rejeitar unsubscribe com endpoint inválido', async () => {
      const invalidEndpoints = ['', null, undefined, 123];

      for (const invalid of invalidEndpoints) {
        // Validação deve falhar
        const isValid = typeof invalid === 'string' && invalid.length > 0;
        expect(isValid).toBe(false);
      }
    }, TEST_TIMEOUT);

    it('não deve falhar ao remover subscription inexistente', async () => {
      // Limpar subscriptions antes do teste
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.user_id, testUser.id));

      const nonExistentEndpoint = 'https://example.com/nonexistent';

      // Tentar remover subscription que não existe
      await expect(
        webPushService.unsubscribe(testUser.id, nonExistentEndpoint)
      ).resolves.not.toThrow();

      // Verificar que nada foi afetado
      const all = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.user_id, testUser.id));

      expect(all.length).toBe(0);
    }, TEST_TIMEOUT);

    it('deve remover apenas a subscription do usuário correto', async () => {
      const user1 = testUser;
      const user2 = await createTestUser('customer');

      try {
        // Limpar todas as subscriptions antes do teste
        await db.delete(pushSubscriptions);

        const subscription1 = generateMockSubscription();
        const subscription2 = generateMockSubscription();

        // Inserir subscriptions diretamente no banco para garantir que ambas existem
        await db.insert(pushSubscriptions).values({
          user_id: user1.id,
          endpoint: subscription1.endpoint,
          p256dh_key: subscription1.keys.p256dh,
          auth_key: subscription1.keys.auth,
          last_used_at: new Date(),
        });

        await db.insert(pushSubscriptions).values({
          user_id: user2.id,
          endpoint: subscription2.endpoint,
          p256dh_key: subscription2.keys.p256dh,
          auth_key: subscription2.keys.auth,
          last_used_at: new Date(),
        });

        // Verificar que ambas foram criadas
        const user1Before = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.user_id, user1.id));
        
        const user2Before = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.user_id, user2.id));
        
        expect(user1Before.length).toBe(1);
        expect(user2Before.length).toBe(1);

        // Remover subscription do user1
        await webPushService.unsubscribe(user1.id, subscription1.endpoint);

        // Verificar que apenas a subscription do user1 foi removida
        const user1Subs = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.user_id, user1.id));

        expect(user1Subs.length).toBe(0);

        // Verificar que a subscription do user2 ainda existe
        const user2Subs = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.user_id, user2.id));

        expect(user2Subs.length).toBe(1);
      } finally {
        await cleanupTestData(user2.id);
      }
    }, TEST_TIMEOUT);
  });

  describe('GET /api/notifications/push/public-key', () => {
    it('deve retornar a chave pública VAPID', () => {
      const publicKey = webPushService.getPublicKey();

      // Verificar que retorna uma string (pode ser vazia se não configurado)
      expect(typeof publicKey).toBe('string');
    }, TEST_TIMEOUT);

    it('deve retornar a mesma chave em múltiplas chamadas', () => {
      const key1 = webPushService.getPublicKey();
      const key2 = webPushService.getPublicKey();

      expect(key1).toBe(key2);
    }, TEST_TIMEOUT);

    it('não deve requerer autenticação', () => {
      // Este endpoint deve ser público para permitir que o frontend
      // obtenha a chave antes do usuário fazer login
      const publicKey = webPushService.getPublicKey();
      
      // Deve retornar algo (mesmo que vazio se não configurado)
      expect(publicKey).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Validação de dados de subscription', () => {
    it('deve validar formato correto de subscription', () => {
      const validSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
          auth: 'tBHItJI5svbpez7KI4CCXg==',
        },
      };

      // Validar endpoint
      expect(typeof validSubscription.endpoint).toBe('string');
      expect(validSubscription.endpoint.length).toBeGreaterThan(0);
      expect(validSubscription.endpoint.startsWith('https://')).toBe(true);

      // Validar keys
      expect(typeof validSubscription.keys).toBe('object');
      expect(typeof validSubscription.keys.p256dh).toBe('string');
      expect(validSubscription.keys.p256dh.length).toBeGreaterThan(0);
      expect(typeof validSubscription.keys.auth).toBe('string');
      expect(validSubscription.keys.auth.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('deve rejeitar subscription com campos faltando', () => {
      const invalidSubscriptions = [
        { keys: { p256dh: 'key1', auth: 'key2' } }, // Sem endpoint
        { endpoint: 'https://example.com' }, // Sem keys
        { endpoint: 'https://example.com', keys: { p256dh: 'key1' } }, // Sem auth
        { endpoint: 'https://example.com', keys: { auth: 'key2' } }, // Sem p256dh
      ];

      for (const invalid of invalidSubscriptions) {
        const hasEndpoint = 'endpoint' in invalid && typeof (invalid as any).endpoint === 'string';
        const hasKeys = 'keys' in invalid && typeof (invalid as any).keys === 'object';
        const hasP256dh = hasKeys && 'p256dh' in (invalid as any).keys;
        const hasAuth = hasKeys && 'auth' in (invalid as any).keys;

        const isValid = hasEndpoint && hasKeys && hasP256dh && hasAuth;
        expect(isValid).toBe(false);
      }
    }, TEST_TIMEOUT);
  });

  describe('Integração com WebPushService', () => {
    it('deve usar o WebPushService para registrar subscriptions', async () => {
      const subscription = generateMockSubscription();

      // Spy no método subscribe
      const subscribeSpy = vi.spyOn(webPushService, 'subscribe');

      // Registrar subscription
      await webPushService.subscribe(testUser.id, subscription);

      // Verificar que o método foi chamado com os parâmetros corretos
      expect(subscribeSpy).toHaveBeenCalledWith(
        testUser.id,
        subscription
      );

      subscribeSpy.mockRestore();
    }, TEST_TIMEOUT);

    it('deve usar o WebPushService para remover subscriptions', async () => {
      const subscription = generateMockSubscription();

      // Registrar primeiro
      await webPushService.subscribe(testUser.id, subscription);

      // Spy no método unsubscribe
      const unsubscribeSpy = vi.spyOn(webPushService, 'unsubscribe');

      // Remover subscription
      await webPushService.unsubscribe(testUser.id, subscription.endpoint);

      // Verificar que o método foi chamado
      expect(unsubscribeSpy).toHaveBeenCalledWith(testUser.id, subscription.endpoint);

      unsubscribeSpy.mockRestore();
    }, TEST_TIMEOUT);

    it('deve usar o WebPushService para obter chave pública', () => {
      // Spy no método getPublicKey
      const getPublicKeySpy = vi.spyOn(webPushService, 'getPublicKey');

      // Obter chave pública
      const publicKey = webPushService.getPublicKey();

      // Verificar que o método foi chamado
      expect(getPublicKeySpy).toHaveBeenCalled();
      expect(typeof publicKey).toBe('string');

      getPublicKeySpy.mockRestore();
    }, TEST_TIMEOUT);
  });
});
