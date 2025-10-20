import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

// Função para calcular período anterior
function getPreviousPeriod(startDate: Date, endDate: Date): { prevStartDate: Date, prevEndDate: Date } {
  const periodDuration = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1); // Um dia antes do período atual
  const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);
  return { prevStartDate, prevEndDate };
}

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
    const { start_date, end_date, official_id, department_id, incident_type_id } = req.query;
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;

    // Calcular período anterior para comparação
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;
    if (startDate && endDate) {
      const previousPeriod = getPreviousPeriod(startDate, endDate);
      prevStartDate = previousPeriod.prevStartDate;
      prevEndDate = previousPeriod.prevEndDate;
    }

    // Estatísticas do período atual
    const stats = await storage.getTicketStatsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId);
    const averageFirstResponseTime = await storage.getAverageFirstResponseTimeByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId);
    const averageResolutionTime = await storage.getAverageResolutionTimeByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId);
    const recentTickets = await storage.getRecentTicketsForDashboardByUserRole(userId, userRole, 5, officialId, startDate, endDate, departmentId, incidentTypeId);

    // Estatísticas do período anterior para comparação
    let previousStats = null;
    let previousAverageFirstResponseTime = null;
    let previousAverageResolutionTime = null;
    
    if (prevStartDate && prevEndDate) {
      previousStats = await storage.getTicketStatsForDashboardByUserRole(userId, userRole, officialId, prevStartDate, prevEndDate, departmentId, incidentTypeId);
      previousAverageFirstResponseTime = await storage.getAverageFirstResponseTimeByUserRole(userId, userRole, officialId, prevStartDate, prevEndDate, departmentId, incidentTypeId);
      previousAverageResolutionTime = await storage.getAverageResolutionTimeByUserRole(userId, userRole, officialId, prevStartDate, prevEndDate, departmentId, incidentTypeId);
    }

    return res.json({
      stats,
      averageFirstResponseTime,
      averageResolutionTime,
      recentTickets,
      // Dados de comparação
      previousStats,
      previousAverageFirstResponseTime,
      previousAverageResolutionTime
    });
  } catch (err) {
    console.error('Erro no dashboard-metrics:', err);
    return res.status(500).json({ error: 'Erro ao buscar métricas do dashboard' });
  }
});

export default router; 
