import webPush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '@/shared/schema';
import { eq, and } from 'drizzle-orm';
import logger from './logger';

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
  ticketId?: number;
  ticketCode?: string;
  metadata?: any;
  readAt?: Date;
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
      logger.error('Erro ao registrar push subscription:', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Erro ao remover push subscription:', {
        userId,
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Erro ao buscar push subscriptions:', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
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

      // Preparar payload da notificação
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
      logger.error('Erro ao enviar push notification:', {
        userId,
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      logger.error('Falha ao enviar push notification após retries:', {
        endpoint: subscription.endpoint,
        retries: MAX_RETRIES,
        error: error.message,
        statusCode: error.statusCode,
      });

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
      logger.error('Erro ao remover subscription inválida:', {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
