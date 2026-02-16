import express, { Request, Response } from 'express';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { authRequired } from '../middleware/authorization';
import { webPushService } from '../services/web-push-service';
import { notificationService } from '../services/notification-service';
import { logNotificationError } from '../services/logger';

const router = express.Router();

/**
 * Interface para opções de listagem de notificações
 */
interface _GetNotificationsOptions {
  page?: number;
  limit?: number;
  type?: string;
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Interface para resposta de listagem de notificações
 */
interface NotificationList {
  notifications: any[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * GET /api/notifications
 * Lista notificações do usuário com suporte a paginação e filtros
 * Requirements: 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */
router.get('/', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    // Extrair parâmetros de query
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)); // Máximo 100 por página
    const type = req.query.type as string | undefined;
    const readParam = req.query.read as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined; // 'created_at' | 'priority'
    const sortOrder = req.query.sortOrder as string | undefined; // 'asc' | 'desc'

    // Construir condições de filtro
    const conditions: any[] = [eq(notifications.user_id, userId)];

    // Filtro por tipo (Requirement 8.1)
    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    // Filtro por status de leitura (Requirement 8.2)
    if (readParam !== undefined) {
      const isRead = readParam === 'true';
      if (isRead) {
        conditions.push(sql`${notifications.read_at} IS NOT NULL`);
      } else {
        conditions.push(sql`${notifications.read_at} IS NULL`);
      }
    }

    // Filtro por período de datas (Requirement 8.3)
    if (startDate) {
      conditions.push(gte(notifications.created_at, startDate));
    }
    if (endDate) {
      conditions.push(lte(notifications.created_at, endDate));
    }

    // Busca textual (Requirement 8.4)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(notifications.title, searchTerm),
          ilike(notifications.message, searchTerm)
        )
      );
    }

    // Combinar todas as condições com AND (Requirement 8.5)
    const whereClause = and(...conditions);

    // Contar total de notificações
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(whereClause);

    // Contar notificações não lidas
    const [{ count: unreadCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        sql`${notifications.read_at} IS NULL`
      ));

    // Configurar ordenação (Requirement 9.4)
    let orderByClause;
    if (sortBy === 'priority') {
      // Ordenar por prioridade: critical > high > medium > low
      const priorityOrder = sql`
        CASE ${notifications.priority}
          WHEN 'critical' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
          ELSE 0
        END
      `;
      orderByClause = sortOrder === 'asc' ? priorityOrder : desc(priorityOrder);
    } else {
      // Ordenação padrão por data de criação
      orderByClause = sortOrder === 'asc' ? notifications.created_at : desc(notifications.created_at);
    }

    // Buscar notificações com paginação (Requirement 1.5)
    const offset = (page - 1) * limit;
    const notificationsList = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const hasMore = offset + notificationsList.length < totalCount;

    const response: NotificationList = {
      notifications: notificationsList,
      total: totalCount,
      unreadCount,
      page,
      limit,
      hasMore
    };

    res.json(response);
  } catch (error) {
    logNotificationError(
      'API: List notifications failed',
      error,
      'error',
      { userId: req.user?.id, query: req.query }
    );
    res.status(500).json({ 
      message: 'Erro ao listar notificações',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Retorna contador de notificações não lidas
 * Requirements: 2.6, 6.1
 */
router.get('/unread-count', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    // Contar notificações não lidas (Requirement 6.1)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        sql`${notifications.read_at} IS NULL`
      ));

    res.json({ count });
  } catch (error) {
    logNotificationError(
      'API: Count unread notifications failed',
      error,
      'error',
      { userId: req.user?.id }
    );
    res.status(500).json({ 
      message: 'Erro ao contar notificações não lidas',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marca uma notificação como lida
 * Requirements: 2.1, 2.2, 2.6
 */
router.patch('/:id/read', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'ID de notificação inválido' });
    }

    // Verificar se a notificação pertence ao usuário (Requirement 6.1 - autorização)
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.user_id, userId)
      ))
      .limit(1);

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    // Marcar como lida (Requirement 2.1, 2.2)
    await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(eq(notifications.id, notificationId));

    // Retornar contador atualizado (Requirement 2.6)
    const [{ count: unreadCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        sql`${notifications.read_at} IS NULL`
      ));

    // 🔥 SINCRONIZAÇÃO DE CONTADOR VIA WEBSOCKET (Requirement 6.5)
    // Após marcar como lida, enviar novo contador para usuário online
    await notificationService.sendUnreadCountUpdate(userId);

    res.json({ success: true, unreadCount });
  } catch (error) {
    logNotificationError(
      'API: Mark notification as read failed',
      error,
      'error',
      { userId: req.user?.id, notificationId: req.params.id }
    );
    res.status(500).json({ 
      message: 'Erro ao marcar notificação como lida',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marca todas as notificações do usuário como lidas
 * Requirements: 2.3, 2.6
 */
router.patch('/read-all', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    // Marcar todas as notificações não lidas como lidas (Requirement 2.3)
    await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(and(
        eq(notifications.user_id, userId),
        sql`${notifications.read_at} IS NULL`
      ));

    // 🔥 SINCRONIZAÇÃO DE CONTADOR VIA WEBSOCKET (Requirement 6.5)
    // Após marcar todas como lidas, enviar contador atualizado (deve ser 0)
    await notificationService.sendUnreadCountUpdate(userId);

    // Retornar contador atualizado (deve ser 0) (Requirement 2.6)
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    logNotificationError(
      'API: Mark all notifications as read failed',
      error,
      'error',
      { userId: req.user?.id }
    );
    res.status(500).json({ 
      message: 'Erro ao marcar todas as notificações como lidas',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Exclui uma notificação
 * Requirements: 2.4
 */
router.delete('/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'ID de notificação inválido' });
    }

    // Verificar se a notificação pertence ao usuário (Requirement 6.1 - autorização)
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.user_id, userId)
      ))
      .limit(1);

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }

    // Excluir notificação (Requirement 2.4)
    await db
      .delete(notifications)
      .where(eq(notifications.id, notificationId));

    res.json({ success: true });
  } catch (error) {
    logNotificationError(
      'API: Delete notification failed',
      error,
      'error',
      { userId: req.user?.id, notificationId: req.params.id }
    );
    res.status(500).json({ 
      message: 'Erro ao excluir notificação',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/notifications (batch)
 * Exclui múltiplas notificações
 * Requirements: 2.5
 */
router.delete('/', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const { ids } = req.body;
    
    // Validar input
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs de notificações inválidos' });
    }

    // Limitar a 100 notificações por operação
    if (ids.length > 100) {
      return res.status(400).json({ message: 'Máximo de 100 notificações por operação' });
    }

    // Validar que todos os IDs são números
    const notificationIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (notificationIds.length !== ids.length) {
      return res.status(400).json({ message: 'Alguns IDs são inválidos' });
    }

    // Excluir apenas notificações que pertencem ao usuário (Requirement 2.5, 6.1)
    const result = await db
      .delete(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        sql`${notifications.id} = ANY(${notificationIds})`
      ))
      .returning({ id: notifications.id });

    res.json({ success: true, deletedCount: result.length });
  } catch (error) {
    logNotificationError(
      'API: Batch delete notifications failed',
      error,
      'error',
      { userId: req.user?.id, notificationIds: req.body.ids }
    );
    res.status(500).json({ 
      message: 'Erro ao excluir notificações em lote',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/notifications/push/subscribe
 * Registra uma nova push subscription para o usuário
 * Requirements: 3.2, 3.5
 */
router.post('/push/subscribe', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const { endpoint, keys } = req.body;

    // Validar dados da subscription (Requirement 3.2)
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ message: 'Endpoint inválido' });
    }

    if (!keys || typeof keys !== 'object') {
      return res.status(400).json({ message: 'Keys inválidas' });
    }

    if (!keys.p256dh || typeof keys.p256dh !== 'string') {
      return res.status(400).json({ message: 'Chave p256dh inválida' });
    }

    if (!keys.auth || typeof keys.auth !== 'string') {
      return res.status(400).json({ message: 'Chave auth inválida' });
    }

    // Extrair user agent do request
    const userAgent = req.headers['user-agent'];

    // Registrar subscription usando o WebPushService
    // O serviço já trata duplicatas internamente (Requirement 3.5)
    await webPushService.subscribe(
      userId,
      { endpoint, keys },
      userAgent
    );

    res.status(201).json({ success: true });
  } catch (error) {
    logNotificationError(
      'API: Register push subscription failed',
      error,
      'error',
      { userId: req.user?.id, endpoint: req.body.endpoint }
    );
    res.status(500).json({ 
      message: 'Erro ao registrar push subscription',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/notifications/push/unsubscribe
 * Remove uma push subscription do usuário
 * Requirements: 3.5
 */
router.post('/push/unsubscribe', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const { endpoint } = req.body;

    // Validar endpoint
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ message: 'Endpoint inválido' });
    }

    // Remover subscription usando o WebPushService (Requirement 3.5)
    await webPushService.unsubscribe(userId, endpoint);

    res.json({ success: true });
  } catch (error) {
    logNotificationError(
      'API: Remove push subscription failed',
      error,
      'error',
      { userId: req.user?.id, endpoint: req.body.endpoint }
    );
    res.status(500).json({ 
      message: 'Erro ao remover push subscription',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/notifications/push/public-key
 * Retorna a chave pública VAPID para uso no frontend
 * Requirements: 3.2
 */
router.get('/push/public-key', async (req: Request, res: Response) => {
  try {
    // Obter chave pública do WebPushService (Requirement 3.2)
    const publicKey = webPushService.getPublicKey();

    if (!publicKey) {
      return res.status(503).json({ 
        message: 'Web Push não configurado no servidor',
        publicKey: null
      });
    }

    res.json({ publicKey });
  } catch (error) {
    logNotificationError(
      'API: Get VAPID public key failed',
      error,
      'error'
    );
    res.status(500).json({ 
      message: 'Erro ao obter chave pública VAPID',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
