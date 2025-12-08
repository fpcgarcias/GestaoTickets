import express, { Request, Response } from 'express';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { authRequired } from '../middleware/authorization';

const router = express.Router();

/**
 * Interface para opções de listagem de notificações
 */
interface GetNotificationsOptions {
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

    // Buscar notificações com paginação (Requirement 1.5)
    const offset = (page - 1) * limit;
    const notificationsList = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.created_at))
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
    console.error('[API NOTIFICAÇÕES] Erro ao listar notificações:', error);
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
    console.error('[API NOTIFICAÇÕES] Erro ao contar notificações não lidas:', error);
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

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('[API NOTIFICAÇÕES] Erro ao marcar notificação como lida:', error);
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

    // Retornar contador atualizado (deve ser 0) (Requirement 2.6)
    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    console.error('[API NOTIFICAÇÕES] Erro ao marcar todas as notificações como lidas:', error);
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
    console.error('[API NOTIFICAÇÕES] Erro ao excluir notificação:', error);
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
    console.error('[API NOTIFICAÇÕES] Erro ao excluir notificações em lote:', error);
    res.status(500).json({ 
      message: 'Erro ao excluir notificações em lote',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
