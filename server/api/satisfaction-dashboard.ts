import { Request, Response } from 'express';
import { db } from '../db';
import { satisfactionSurveys, tickets, departments, officials } from '@shared/schema';
import { eq, and, gte, lte, desc, sql, inArray, isNull, lt } from 'drizzle-orm';
import { format } from 'date-fns';

function resolveCompanyScope(userRole: string, sessionCompanyId: unknown): number | undefined {
  if (userRole === 'admin') {
    return undefined;
  }

  if (sessionCompanyId === null || sessionCompanyId === undefined) {
    return undefined;
  }

  const numericId =
    typeof sessionCompanyId === 'number'
      ? sessionCompanyId
      : Number(sessionCompanyId);

  if (!Number.isFinite(numericId)) {
    return undefined;
  }

  return numericId;
}

async function expireOutdatedSurveysForScope(companyId?: number) {
  try {
    const now = new Date();

    const expireConditions = [
      eq(satisfactionSurveys.status, 'sent'),
      isNull(satisfactionSurveys.responded_at),
      lt(satisfactionSurveys.expires_at, now)
    ];

    if (typeof companyId === 'number') {
      expireConditions.push(eq(satisfactionSurveys.company_id, companyId));
    }

    await db
      .update(satisfactionSurveys)
      .set({ status: 'expired' })
      .where(and(...expireConditions));
  } catch (error) {
    console.error('Erro ao expirar pesquisas de satisfação atrasadas:', error);
  }
}

// GET /api/satisfaction-dashboard/surveys - Listar pesquisas de satisfação
export async function getSurveys(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole as string;
    const userId = req.session?.userId;
    const sessionCompanyId = req.session?.companyId;

    // Verificar permissões
    if (!['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const scopedCompanyId = resolveCompanyScope(userRole, sessionCompanyId);
    await expireOutdatedSurveysForScope(scopedCompanyId);

    // Parâmetros de filtro
    const {
      department_id,
      official_id,
      status,
      rating,
      date_from,
      date_to,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Construir condições WHERE
    const conditions: any[] = [];

    // Filtro por empresa (obrigatório para não-admin)
    if (userRole !== 'admin') {
      conditions.push(eq(satisfactionSurveys.company_id, sessionCompanyId!));
    }

    // Filtros específicos
    if (department_id && department_id !== 'all') {
      conditions.push(eq(tickets.department_id, parseInt(department_id as string)));
    }

    if (official_id && official_id !== 'all') {
      conditions.push(eq(tickets.assigned_to_id, parseInt(official_id as string)));
    }

    if (status && status !== 'all') {
      conditions.push(eq(satisfactionSurveys.status, status as "sent" | "responded" | "expired"));
    }

    if (rating && rating !== 'all') {
      conditions.push(eq(satisfactionSurveys.rating, parseInt(rating as string)));
    }

    if (date_from) {
      conditions.push(gte(satisfactionSurveys.sent_at, new Date(date_from as string)));
    }

    if (date_to) {
      const endDate = new Date(date_to as string);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(satisfactionSurveys.sent_at, endDate));
    }

    // Para manager/supervisor, filtrar apenas departamentos que podem ver
    if (['manager', 'supervisor'].includes(userRole)) {
      // Buscar departamentos do usuário
      const userDepartments = await db
        .select({ department_id: sql<number>`department_id` })
        .from(sql`official_departments od 
                  INNER JOIN officials o ON od.official_id = o.id`)
        .where(sql`o.user_id = ${userId}`);

      const allowedDepartmentIds = userDepartments
        .map(d => d.department_id)
        .filter(id => id !== null);

      if (allowedDepartmentIds.length > 0) {
        conditions.push(inArray(tickets.department_id, allowedDepartmentIds));
      } else {
        // Se não tem departamentos, retornar vazio
        return res.json({ surveys: [], pagination: { total: 0, pages: 0, current: pageNum } });
      }
    }

    // Buscar pesquisas com dados relacionados
    const surveysQuery = db
      .select({
        id: satisfactionSurveys.id,
        ticket_id: satisfactionSurveys.ticket_id,
        customer_email: satisfactionSurveys.customer_email,
        rating: satisfactionSurveys.rating,
        comments: satisfactionSurveys.comments,
        sent_at: satisfactionSurveys.sent_at,
        responded_at: satisfactionSurveys.responded_at,
        status: satisfactionSurveys.status,
        expires_at: satisfactionSurveys.expires_at,
        ticket_ticket_id: tickets.ticket_id,
        ticket_title: tickets.title,
        department_name: departments.name,
        official_name: officials.name,
      })
      .from(satisfactionSurveys)
      .innerJoin(tickets, eq(satisfactionSurveys.ticket_id, tickets.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(satisfactionSurveys.sent_at))
      .limit(limitNum)
      .offset(offset);

    const surveys = await surveysQuery;

    // Contar total
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(satisfactionSurveys)
      .innerJoin(tickets, eq(satisfactionSurveys.ticket_id, tickets.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [{ count: totalCount }] = await countQuery;

    // Formatar resposta
    const formattedSurveys = surveys.map(survey => ({
      id: survey.id,
      ticket_id: survey.ticket_id,
      customer_email: survey.customer_email,
      rating: survey.rating,
      comments: survey.comments,
      sent_at: survey.sent_at,
      responded_at: survey.responded_at,
      status: survey.status,
      expires_at: survey.expires_at,
      ticket: {
        ticket_id: survey.ticket_ticket_id,
        title: survey.ticket_title,
        department_name: survey.department_name || 'N/A',
        assigned_official_name: survey.official_name
      }
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      surveys: formattedSurveys,
      pagination: {
        total: totalCount,
        pages: totalPages,
        current: pageNum,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Erro ao buscar pesquisas de satisfação:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// GET /api/satisfaction-dashboard/stats - Estatísticas do dashboard
export async function getStats(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole as string;
    const userId = req.session?.userId;
    const sessionCompanyId = req.session?.companyId;

    // Verificar permissões
    if (!['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const scopedCompanyId = resolveCompanyScope(userRole, sessionCompanyId);
    await expireOutdatedSurveysForScope(scopedCompanyId);

    // Parâmetros de filtro
    const {
      department_id,
      official_id,
      status,
      rating,
      date_from,
      date_to
    } = req.query;

    // Construir condições WHERE
    const conditions: any[] = [];

    // Filtro por empresa (obrigatório para não-admin)
    if (userRole !== 'admin') {
      conditions.push(eq(satisfactionSurveys.company_id, sessionCompanyId!));
    }

    // Filtros específicos
    if (department_id && department_id !== 'all') {
      conditions.push(eq(tickets.department_id, parseInt(department_id as string)));
    }

    if (official_id && official_id !== 'all') {
      conditions.push(eq(tickets.assigned_to_id, parseInt(official_id as string)));
    }

    if (status && status !== 'all') {
      conditions.push(eq(satisfactionSurveys.status, status as "sent" | "responded" | "expired"));
    }

    if (rating && rating !== 'all') {
      conditions.push(eq(satisfactionSurveys.rating, parseInt(rating as string)));
    }

    if (date_from) {
      conditions.push(gte(satisfactionSurveys.sent_at, new Date(date_from as string)));
    }

    if (date_to) {
      const endDate = new Date(date_to as string);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(satisfactionSurveys.sent_at, endDate));
    }

    // Para manager/supervisor, filtrar apenas departamentos que podem ver
    if (['manager', 'supervisor'].includes(userRole)) {
      // Buscar departamentos do usuário
      const userDepartments = await db
        .select({ department_id: sql<number>`department_id` })
        .from(sql`official_departments od 
                  INNER JOIN officials o ON od.official_id = o.id`)
        .where(sql`o.user_id = ${userId}`);

      const allowedDepartmentIds = userDepartments
        .map(d => d.department_id)
        .filter(id => id !== null);

      if (allowedDepartmentIds.length > 0) {
        conditions.push(inArray(tickets.department_id, allowedDepartmentIds));
      } else {
        // Se não tem departamentos, retornar stats vazias
        return res.json({
          total_sent: 0,
          total_responded: 0,
          response_rate: 0,
          average_rating: 0,
          ratings_breakdown: {},
          trend: {
            rating_trend: 0,
            response_rate_trend: 0
          }
        });
      }
    }

    // Buscar estatísticas básicas
    const statsQuery = db
      .select({
        total_sent: sql<number>`count(*)`,
        total_responded: sql<number>`count(case when ${satisfactionSurveys.status} = 'responded' then 1 end)`,
        average_rating: sql<number>`avg(case when ${satisfactionSurveys.rating} is not null then ${satisfactionSurveys.rating} end)`,
      })
      .from(satisfactionSurveys)
      .innerJoin(tickets, eq(satisfactionSurveys.ticket_id, tickets.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [stats] = await statsQuery;

    // Buscar distribuição de avaliações
    const ratingsQuery = db
      .select({
        rating: satisfactionSurveys.rating,
        count: sql<number>`count(*)`
      })
      .from(satisfactionSurveys)
      .innerJoin(tickets, eq(satisfactionSurveys.ticket_id, tickets.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
      .where(and(
        eq(satisfactionSurveys.status, 'responded'),
        ...(conditions.length > 0 ? conditions : [])
      ))
      .groupBy(satisfactionSurveys.rating);

    const ratingsData = await ratingsQuery;

    // Construir breakdown de avaliações
    const ratingsBreakdown: { [key: number]: number } = {};
    ratingsData.forEach(item => {
      if (item.rating !== null) {
        ratingsBreakdown[item.rating] = item.count;
      }
    });

    // Calcular taxa de resposta
    const responseRate = stats.total_sent > 0 
      ? (stats.total_responded / stats.total_sent) * 100 
      : 0;

    // TODO: Implementar cálculo de tendências (comparar com período anterior)
    const trend = {
      rating_trend: 0,
      response_rate_trend: 0
    };

    res.json({
      total_sent: stats.total_sent || 0,
      total_responded: stats.total_responded || 0,
      response_rate: responseRate,
      average_rating: stats.average_rating ? parseFloat(parseFloat(stats.average_rating.toString()).toFixed(2)) : 0,
      ratings_breakdown: ratingsBreakdown,
      trend
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de satisfação:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// GET /api/satisfaction-dashboard/export - Exportar dados para CSV
export async function exportData(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole as string;
    const userId = req.session?.userId;
    const sessionCompanyId = req.session?.companyId;

    // Verificar permissões
    if (!['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const scopedCompanyId = resolveCompanyScope(userRole, sessionCompanyId);
    await expireOutdatedSurveysForScope(scopedCompanyId);

    // Parâmetros de filtro (mesma lógica do getSurveys)
    const {
      department_id,
      official_id,
      date_from,
      date_to
    } = req.query;

    const conditions: any[] = [];

    // Filtro por empresa (obrigatório para não-admin)
    if (userRole !== 'admin') {
      conditions.push(eq(satisfactionSurveys.company_id, sessionCompanyId!));
    }

    if (department_id && department_id !== 'all') {
      conditions.push(eq(tickets.department_id, parseInt(department_id as string)));
    }

    if (official_id && official_id !== 'all') {
      conditions.push(eq(tickets.assigned_to_id, parseInt(official_id as string)));
    }

    if (date_from) {
      conditions.push(gte(satisfactionSurveys.sent_at, new Date(date_from as string)));
    }

    if (date_to) {
      const endDate = new Date(date_to as string);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(satisfactionSurveys.sent_at, endDate));
    }

    // Para manager/supervisor, filtrar apenas departamentos que podem ver
    if (['manager', 'supervisor'].includes(userRole)) {
      const userDepartments = await db
        .select({ department_id: sql<number>`department_id` })
        .from(sql`official_departments od 
                  INNER JOIN officials o ON od.official_id = o.id`)
        .where(sql`o.user_id = ${userId}`);

      const allowedDepartmentIds = userDepartments
        .map(d => d.department_id)
        .filter(id => id !== null);

      if (allowedDepartmentIds.length > 0) {
        conditions.push(inArray(tickets.department_id, allowedDepartmentIds));
      }
    }

    // Buscar dados para exportação
    const exportQuery = db
      .select({
        ticket_id: tickets.ticket_id,
        ticket_title: tickets.title,
        customer_email: satisfactionSurveys.customer_email,
        department_name: departments.name,
        official_name: officials.name,
        rating: satisfactionSurveys.rating,
        comments: satisfactionSurveys.comments,
        sent_at: satisfactionSurveys.sent_at,
        responded_at: satisfactionSurveys.responded_at,
        status: satisfactionSurveys.status,
      })
      .from(satisfactionSurveys)
      .innerJoin(tickets, eq(satisfactionSurveys.ticket_id, tickets.id))
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(satisfactionSurveys.sent_at));

    const data = await exportQuery;

    // Gerar CSV
    const csvHeaders = [
      'Ticket',
      'Título',
      'Solicitante',
      'Departamento',
      'Atendente',
      'Avaliação',
      'Comentários',
      'Enviado em',
      'Respondido em',
      'Status'
    ].join(',');

    const csvRows = data.map(row => [
      row.ticket_id,
      `"${row.ticket_title?.replace(/"/g, '""') || ''}"`,
      row.customer_email,
      row.department_name || 'N/A',
      row.official_name || 'Não atribuído',
      row.rating || '',
      `"${row.comments?.replace(/"/g, '""') || ''}"`,
      row.sent_at ? format(new Date(row.sent_at), 'dd/MM/yyyy HH:mm') : '',
      row.responded_at ? format(new Date(row.responded_at), 'dd/MM/yyyy HH:mm') : '',
      row.status
    ].join(','));

    const csv = [csvHeaders, ...csvRows].join('\n');

    // Configurar headers para download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pesquisa-satisfacao-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));

    // Adicionar BOM para UTF-8
    res.write('\uFEFF');
    res.end(csv);

  } catch (error) {
    console.error('Erro ao exportar dados de satisfação:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
