import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * Resolve o official_id do usuário autenticado (para roles support).
 */
async function getOfficialIdForUser(userId: number): Promise<number | null> {
  const official = await storage.getOfficialByUserId(userId);
  return official?.id ?? null;
}

// Endpoint único para métricas do dashboard
router.get('/dashboard-metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Filtros
    const { start_date, end_date, official_id, department_id, incident_type_id, category_id, company_id } = req.query;
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    const baseOpts = { officialId, departmentId, incidentTypeId, categoryId, companyId, recentLimit: 5 };

    // Buscar período atual e anterior em PARALELO
    const currentPromise = storage.getDashboardMetricsOptimized(userId, userRole, {
      ...baseOpts,
      startDate,
      endDate,
    });

    let previousPromise: Promise<{
      stats: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> };
      averageFirstResponseTime: number;
      averageResolutionTime: number;
      recentTickets: any[];
    } | null> = Promise.resolve(null);

    if (startDate && endDate) {
      const periodDuration = endDate.getTime() - startDate.getTime();
      const prevEndDate = new Date(startDate.getTime() - 1);
      const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);
      previousPromise = storage.getDashboardMetricsOptimized(userId, userRole, {
        ...baseOpts,
        startDate: prevStartDate,
        endDate: prevEndDate,
        recentLimit: 0, // não precisa de recent tickets pro período anterior
      });
    }

    const [current, previous] = await Promise.all([currentPromise, previousPromise]);

    return res.json({
      stats: current.stats,
      averageFirstResponseTime: current.averageFirstResponseTime,
      averageResolutionTime: current.averageResolutionTime,
      recentTickets: current.recentTickets,
      previousStats: previous?.stats ?? null,
      previousAverageFirstResponseTime: previous?.averageFirstResponseTime ?? null,
      previousAverageResolutionTime: previous?.averageResolutionTime ?? null,
    });
  } catch (err) {
    console.error('Erro no dashboard-metrics:', err);
    return res.status(500).json({ error: 'Erro ao buscar métricas do dashboard' });
  }
});

// Endpoint de tendência temporal para line chart
router.get('/dashboard-trend', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { start_date, end_date, granularity, group_by, official_id, department_id, incident_type_id, category_id, company_id } = req.query;

    // Validar granularidade
    const validGranularities = ['day', 'week', 'month'];
    const gran = String(granularity || 'day');
    if (!validGranularities.includes(gran)) {
      return res.status(400).json({ error: `Granularidade inválida. Valores válidos: ${validGranularities.join(', ')}` });
    }

    // Validar group_by
    const validGroupBy = ['status', 'priority'];
    const groupBy = group_by ? String(group_by) : undefined;
    if (groupBy && !validGroupBy.includes(groupBy)) {
      return res.status(400).json({ error: `group_by inválido. Valores válidos: ${validGroupBy.join(', ')}` });
    }

    // Validar datas
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date inválido' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date inválido' });
    }
    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({ error: 'start_date deve ser anterior a end_date' });
    }

    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;

    // company_id para admin filtrar por empresa
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    const result = await storage.getDashboardTrendData(userId, userRole, {
      granularity: gran as 'day' | 'week' | 'month',
      groupBy: groupBy as 'status' | 'priority' | undefined,
      officialId,
      startDate,
      endDate,
      departmentId,
      incidentTypeId,
      categoryId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-trend:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados de tendência' });
  }
});

// Endpoint de heatmap de volume por dia da semana e hora
router.get('/dashboard-heatmap', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { start_date, end_date, official_id, department_id, incident_type_id, category_id, company_id } = req.query;

    // Validar datas
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date inválido' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date inválido' });
    }
    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({ error: 'start_date deve ser anterior a end_date' });
    }

    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    const result = await storage.getDashboardHeatmapData(userId, userRole, {
      officialId,
      startDate,
      endDate,
      departmentId,
      incidentTypeId,
      categoryId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-heatmap:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados do heatmap' });
  }
});

// Endpoint de ranking de atendentes
router.get('/dashboard-ranking', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Ocultar para roles sem permissão (customer, viewer, quality)
    if (['customer', 'viewer', 'quality'].includes(userRole)) {
      return res.status(403).json({ error: 'Acesso negado: usuários com este perfil não têm permissão para acessar o ranking de atendentes' });
    }

    const { start_date, end_date, sort_by, official_id, department_id, incident_type_id, category_id, company_id } = req.query;

    // Validar sort_by
    const validSortBy = ['resolved_count', 'avg_first_response', 'avg_resolution'];
    const sortBy = sort_by ? String(sort_by) : 'resolved_count';
    if (!validSortBy.includes(sortBy)) {
      return res.status(400).json({ error: `sort_by inválido. Valores válidos: ${validSortBy.join(', ')}` });
    }

    // Validar datas
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date inválido' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date inválido' });
    }
    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({ error: 'start_date deve ser anterior a end_date' });
    }

    let officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    // Para role support, forçar official_id ao próprio atendente (não confiar no frontend)
    if (userRole === 'support') {
      const ownOfficialId = await getOfficialIdForUser(userId);
      if (!ownOfficialId) {
        return res.status(403).json({ error: 'Acesso negado: atendente não encontrado para o usuário autenticado' });
      }
      officialId = ownOfficialId;
    }

    const result = await storage.getDashboardRankingData(userId, userRole, {
      startDate,
      endDate,
      sortBy: sortBy as 'resolved_count' | 'avg_first_response' | 'avg_resolution',
      officialId,
      departmentId,
      incidentTypeId,
      categoryId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-ranking:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados do ranking' });
  }
});

// Endpoint de taxa de conformidade SLA
router.get('/dashboard-sla', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Ocultar para roles sem permissão (customer, viewer, quality)
    if (['customer', 'viewer', 'quality'].includes(userRole)) {
      return res.status(403).json({ error: 'Acesso negado: usuários com perfil cliente não têm permissão para acessar dados de SLA' });
    }

    const { start_date, end_date, official_id, department_id, incident_type_id, category_id, company_id } = req.query;

    // Validar datas
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date inválido' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date inválido' });
    }
    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({ error: 'start_date deve ser anterior a end_date' });
    }

    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    const result = await storage.getDashboardSlaData(userId, userRole, {
      startDate,
      endDate,
      officialId,
      departmentId,
      incidentTypeId,
      categoryId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-sla:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados de SLA' });
  }
});

// Endpoint de métricas de backlog
router.get('/dashboard-backlog', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Ocultar para roles sem permissão (customer, viewer, quality)
    if (['customer', 'viewer', 'quality'].includes(userRole)) {
      return res.status(403).json({ error: 'Acesso negado: usuários com perfil cliente não têm permissão para acessar métricas de backlog' });
    }

    const { official_id, department_id, company_id } = req.query;

    let officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    // Para role support, forçar official_id ao próprio atendente (não confiar no frontend)
    if (userRole === 'support') {
      const ownOfficialId = await getOfficialIdForUser(userId);
      if (!ownOfficialId) {
        return res.status(403).json({ error: 'Acesso negado: atendente não encontrado para o usuário autenticado' });
      }
      officialId = ownOfficialId;
    }

    const result = await storage.getDashboardBacklogData(userId, userRole, {
      officialId,
      departmentId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-backlog:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados de backlog' });
  }
});

// Endpoint de drill-down para lista paginada de tickets
router.get('/dashboard-drilldown', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { type, value, page, page_size, start_date, end_date, official_id, department_id, incident_type_id, category_id, company_id } = req.query;

    // Validar type
    const validTypes = ['status', 'priority', 'department', 'official', 'incident_type', 'category', 'backlog_type'];
    const drillType = type ? String(type) : undefined;
    if (!drillType || !validTypes.includes(drillType)) {
      return res.status(400).json({ error: `type inválido. Valores válidos: ${validTypes.join(', ')}` });
    }

    // Validar value
    const drillValue = value ? String(value) : undefined;
    if (!drillValue) {
      return res.status(400).json({ error: 'value é obrigatório' });
    }

    // Validar page e page_size
    const pageNum = page ? parseInt(String(page), 10) : 1;
    const pageSizeNum = page_size ? parseInt(String(page_size), 10) : 20;
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'page deve ser um inteiro positivo' });
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({ error: 'page_size deve ser um inteiro entre 1 e 100' });
    }

    // Validar datas
    const startDate = start_date ? new Date(String(start_date)) : undefined;
    const endDate = end_date ? new Date(String(end_date)) : undefined;
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'start_date inválido' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'end_date inválido' });
    }
    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({ error: 'start_date deve ser anterior a end_date' });
    }

    const officialId = official_id && official_id !== 'all' ? Number(official_id) : undefined;
    const departmentId = department_id && department_id !== 'all' ? Number(department_id) : undefined;
    const incidentTypeId = incident_type_id && incident_type_id !== 'all' ? Number(incident_type_id) : undefined;
    const categoryId = category_id && category_id !== 'all' ? Number(category_id) : undefined;
    const companyId = (userRole === 'admin' && company_id && company_id !== 'all') ? Number(company_id) : undefined;

    const result = await storage.getDashboardDrilldownData(userId, userRole, {
      type: drillType as 'status' | 'priority' | 'department' | 'official' | 'incident_type' | 'category' | 'backlog_type',
      value: drillValue,
      page: pageNum,
      pageSize: pageSizeNum,
      officialId,
      startDate,
      endDate,
      departmentId,
      incidentTypeId,
      categoryId,
      companyId,
    });

    return res.json(result);
  } catch (err) {
    console.error('Erro no dashboard-drilldown:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados de drill-down' });
  }
});

export default router;
