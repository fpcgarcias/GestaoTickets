import webPush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import logger, { logNotificationError } from './logger';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PersistentNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  ticketId?: number | null;
  ticketCode?: string | null;
  metadata?: any;
  readAt?: Date | null;
  createdAt: Date;
}

/**
 * Serviço para gerenciar Web Push Notifications
 * Responsável por registrar subscriptions, enviar notificações push e limpar subscriptions inválidas
 */
class WebPushService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;

  constructor() {
    // Configurar VAPID keys a partir de variáveis de ambiente
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      logger.warn('VAPID keys não configuradas. Web Push não funcionará. Execute: npx web-push generate-vapid-keys');
    } else {
      // Configurar web-push com as chaves VAPID
      webPush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey
      );
      logger.info('WebPushService inicializado com sucesso');
    }
  }

  /**
   * Registra uma nova push subscription para um usuário
   * @param userId ID do usuário
   * @param subscription Dados da subscription do navegador
   * @param userAgent User agent do navegador (opcional)
   */
  async subscribe(userId: number, subscription: PushSubscriptionData, userAgent?: string): Promise<void> {
    try {
      // Verificar se já existe uma subscription com este endpoint
      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .limit(1);

      if (existing.length > 0) {
        // Atualizar last_used_at se já existe
        await db
          .update(pushSubscriptions)
          .set({ last_used_at: new Date() })
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

        logger.info(`Push subscription atualizada para usuário ${userId}`);
        return;
      }

      // Inserir nova subscription
      await db.insert(pushSubscriptions).values({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent,
        last_used_at: new Date(),
      });

      logger.info(`Nova push subscription registrada para usuário ${userId}`);
    } catch (error) {
      logNotificationError(
        'Push subscription registration failed',
        error,
        'error',
        { userId, endpoint: subscription.endpoint }
      );
      throw error;
    }
  }

  /**
   * Remove uma push subscription
   * @param userId ID do usuário
   * @param endpoint Endpoint da subscription a ser removida
   */
  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    try {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.user_id, userId),
            eq(pushSubscriptions.endpoint, endpoint)
          )
        );

      logger.info(`Push subscription removida para usuário ${userId}`);
    } catch (error) {
      logNotificationError(
        'Push subscription removal failed',
        error,
        'error',
        { userId, endpoint }
      );
      throw error;
    }
  }

  /**
   * Busca todas as subscriptions de um usuário
   * @param userId ID do usuário
   * @returns Array de subscriptions
   */
  async getSubscriptions(userId: number): Promise<PushSubscriptionData[]> {
    try {
      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.user_id, userId));

      return subs.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key,
        },
      }));
    } catch (error) {
      logNotificationError(
        'Failed to fetch push subscriptions',
        error,
        'error',
        { userId }
      );
      return [];
    }
  }

  /**
   * Busca todas as subscriptions de múltiplos usuários de uma vez
   * @param userIds Array de IDs de usuários
   * @returns Mapa de userId para array de subscriptions
   */
  async getSubscriptionsBatch(userIds: number[]): Promise<Map<number, PushSubscriptionData[]>> {
    try {
      if (!userIds.length) return new Map();

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.user_id, userIds));

      const resultMap = new Map<number, PushSubscriptionData[]>();

      // Inicializar mapa para garantir que todos usuarios tenham entrada
      userIds.forEach(id => resultMap.set(id, []));

      // Popula o mapa
      subs.forEach(sub => {
        const userSubs = resultMap.get(sub.user_id) || [];
        userSubs.push({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        });
        resultMap.set(sub.user_id, userSubs);
      });

      return resultMap;
    } catch (error) {
      logNotificationError(
        'Failed to fetch push subscriptions batch',
        error,
        'error',
        { userIdsCount: userIds.length }
      );
      return new Map();
    }
  }

  /**
   * Envia uma notificação push para todas as subscriptions de um usuário
   * @param userId ID do usuário
   * @param notification Dados da notificação
   */
  async sendPushNotification(userId: number, notification: PersistentNotification): Promise<void> {
    try {
      // Verificar se VAPID está configurado
      if (!this.vapidPublicKey || !this.vapidPrivateKey) {
        logger.warn('Web Push não configurado. Notificação não enviada.');
        return;
      }

      // Buscar todas as subscriptions do usuário
      const subscriptions = await this.getSubscriptions(userId);

      if (subscriptions.length === 0) {
        logger.debug(`Nenhuma push subscription encontrada para usuário ${userId}`);
        return;
      }

      // Preparar payload da notificação com configurações baseadas na prioridade
      const payload = JSON.stringify({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        ticketId: notification.ticketId,
        ticketCode: notification.ticketCode,
        url: notification.ticketId
          ? `/tickets/${notification.ticketId}`
          : '/',
        timestamp: notification.createdAt.toISOString(),
        // Configurações específicas por prioridade (Requirements 9.2)
        requireInteraction: notification.priority === 'critical',
        vibrate: notification.priority === 'critical'
          ? [200, 100, 200]
          : notification.priority === 'high'
            ? [100]
            : undefined,
      });

      // Enviar para todas as subscriptions
      const sendPromises = subscriptions.map(sub =>
        this.sendToSubscription(sub, payload, notification.priority)
      );

      const results = await Promise.allSettled(sendPromises);

      // Contar sucessos e falhas
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`Web Push enviado para usuário ${userId}: ${successful} sucesso, ${failed} falhas`);
    } catch (error) {
      logNotificationError(
        'Push notification sending failed',
        error,
        'error',
        { userId, notificationId: notification.id }
      );
      // Não propagar erro - falha de Web Push não deve quebrar o fluxo
    }
  }

  /**
   * 🔥 OTIMIZAÇÃO N+1: Envia notificação usando subscriptions já buscadas
   * @param userId ID do usuário
   * @param notification Dados da notificação
   * @param subscriptions Subscriptions já buscadas em batch
   */
  async sendPushNotificationWithSubscriptions(
    userId: number,
    notification: PersistentNotification,
    subscriptions: PushSubscriptionData[]
  ): Promise<void> {
    try {
      // Verificar se VAPID está configurado
      if (!this.vapidPublicKey || !this.vapidPrivateKey) {
        return;
      }

      if (subscriptions.length === 0) {
        return;
      }

      // Preparar payload da notificação com configurações baseadas na prioridade
      const payload = JSON.stringify({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        ticketId: notification.ticketId,
        ticketCode: notification.ticketCode,
        url: notification.ticketId
          ? `/tickets/${notification.ticketId}`
          : '/',
        timestamp: notification.createdAt.toISOString(),
        // Configurações específicas por prioridade (Requirements 9.2)
        requireInteraction: notification.priority === 'critical',
        vibrate: notification.priority === 'critical'
          ? [200, 100, 200]
          : notification.priority === 'high'
            ? [100]
            : undefined,
      });

      // Enviar para todas as subscriptions
      const sendPromises = subscriptions.map(sub =>
        this.sendToSubscription(sub, payload, notification.priority)
      );

      const results = await Promise.allSettled(sendPromises);

      // Contar sucessos e falhas
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`[BATCH] Web Push enviado para usuário ${userId}: ${successful} sucesso, ${failed} falhas`);
    } catch (error) {
      logNotificationError(
        'Push notification with subscriptions failed',
        error,
        'error',
        { userId, notificationId: notification.id }
      );
      // Não propagar erro - falha de Web Push não deve quebrar o fluxo
    }
  }

  /**
   * Envia notificação para uma subscription específica com retry logic
   * @param subscription Dados da subscription
   * @param payload Payload JSON da notificação
   * @param priority Prioridade da notificação
   * @param retryCount Contador de tentativas (interno)
   * @returns true se enviado com sucesso, false caso contrário
   */
  private async sendToSubscription(
    subscription: PushSubscriptionData,
    payload: string,
    priority: string = 'medium',
    retryCount: number = 0
  ): Promise<boolean> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000; // 1 segundo

    try {
      // Configurar opções baseadas na prioridade
      const options: webPush.RequestOptions = {
        TTL: 86400, // 24 horas
      };

      // Notificações críticas têm urgência alta
      if (priority === 'critical') {
        options.urgency = 'high';
      } else if (priority === 'high') {
        options.urgency = 'high';
      } else {
        options.urgency = 'normal';
      }

      // Enviar notificação
      await webPush.sendNotification(subscription, payload, options);

      // Atualizar last_used_at
      await db
        .update(pushSubscriptions)
        .set({ last_used_at: new Date() })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      return true;
    } catch (error: any) {
      // Verificar se é erro 410 (Gone) ou 404 (Not Found) - subscription inválida
      if (error.statusCode === 410 || error.statusCode === 404) {
        logger.info(`Push subscription inválida (${error.statusCode}), removendo: ${subscription.endpoint}`);
        await this.removeInvalidSubscription(subscription.endpoint);
        return false;
      }

      // Retry logic para outros erros
      if (retryCount < MAX_RETRIES) {
        logger.warn(`Erro ao enviar push, tentando novamente (${retryCount + 1}/${MAX_RETRIES}):`, {
          endpoint: subscription.endpoint,
          error: error.message,
        });

        // Aguardar antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retryCount)));

        return this.sendToSubscription(subscription, payload, priority, retryCount + 1);
      }

      // Falha após todas as tentativas
      logNotificationError(
        'Push notification failed after retries',
        error,
        'error',
        { endpoint: subscription.endpoint, retries: MAX_RETRIES, statusCode: error.statusCode }
      );

      return false;
    }
  }

  /**
   * Remove uma subscription inválida do banco de dados
   * @param endpoint Endpoint da subscription a ser removida
   */
  async removeInvalidSubscription(endpoint: string): Promise<void> {
    try {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint));

      logger.info(`Subscription inválida removida: ${endpoint}`);
    } catch (error) {
      logNotificationError(
        'Failed to remove invalid subscription',
        error,
        'error',
        { endpoint }
      );
    }
  }

  /**
   * Retorna a chave pública VAPID para uso no frontend
   * @returns Chave pública VAPID
   */
  getPublicKey(): string {
    return this.vapidPublicKey;
  }
}

// Exportar instância singleton
export const webPushService = new WebPushService();
export default webPushService;
