import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

// Endpoint único para métricas do dashboard
router.get('/dashboard-metrics', async (req: Request, res: Response) => {
  try {
    // Usar apenas req.session para userId e userRole
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Filtros
    const { start_date, end_date, official_id } = req.query;
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;

    // Estatísticas
    const stats = await storage.getTicketStatsByUserRole(userId, userRole, officialId, startDate, endDate);
    // Tempo médio de início de atendimento
    const averageFirstResponseTime = await storage.getAverageFirstResponseTimeByUserRole(userId, userRole, officialId, startDate, endDate);
    // Tempo médio de resolução
    const averageResolutionTime = await storage.getAverageResolutionTimeByUserRole(userId, userRole, officialId, startDate, endDate);
    // Tickets recentes (limitado a 5) - limit é o 4º argumento
    const recentTickets = await storage.getRecentTicketsByUserRole(userId, userRole, 5, officialId, startDate, endDate);

    return res.json({
      stats,
      averageFirstResponseTime,
      averageResolutionTime,
      recentTickets
    });
  } catch (err) {
    console.error('Erro no dashboard-metrics:', err);
    return res.status(500).json({ error: 'Erro ao buscar métricas do dashboard' });
  }
});

export default router; 