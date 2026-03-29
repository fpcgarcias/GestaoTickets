/**
 * API de Consulta de Logs — Endpoints GET /api/logs e GET /api/logs/stats.
 *
 * Cursor-based pagination, filtros avançados (incluindo JSONB),
 * isolamento multi-tenant e estatísticas agregadas.
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { systemLogs } from '@shared/schema';
import {
  eq, and, desc, asc, lt, gte, lte, like, sql, count, avg, SQL,
} from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface LogsQueryParams {
  cursor?: string;
  limit?: string;
  level?: string;
  server_identifier?: string;
  trace_id?: string;
  company_id?: string;
  user_id?: string;
  request_url?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  context_filter?: string;
  sort_order?: 'asc' | 'desc';
  min_response_time?: string;
}

interface StatsQueryParams {
  date_from?: string;
  date_to?: string;
  company_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEffectiveCompanyId(req: Request, queryCompanyId?: string): number | null {
  const isSuperAdmin = req.session?.userRole === 'admin';
  if (isSuperAdmin) {
    return queryCompanyId ? parseInt(queryCompanyId, 10) : null; // null = todos
  }
  return req.session?.companyId ?? null;
}

function buildFilters(
  params: LogsQueryParams,
  effectiveCompanyId: number | null,
  isSuperAdmin: boolean,
): SQL[] {
  const conditions: SQL[] = [];

  // Multi-tenant: não-super_admin sempre filtra pela própria empresa
  if (!isSuperAdmin && effectiveCompanyId !== null) {
    conditions.push(eq(systemLogs.company_id, effectiveCompanyId));
  } else if (isSuperAdmin && effectiveCompanyId !== null) {
    conditions.push(eq(systemLogs.company_id, effectiveCompanyId));
  }

  if (params.level) {
    conditions.push(eq(systemLogs.level, params.level));
  }
  if (params.server_identifier) {
    conditions.push(eq(systemLogs.server_identifier, params.server_identifier));
  }
  if (params.trace_id) {
    conditions.push(eq(systemLogs.trace_id, params.trace_id));
  }
  if (params.user_id) {
    conditions.push(eq(systemLogs.user_id, parseInt(params.user_id, 10)));
  }
  if (params.request_url) {
    conditions.push(like(systemLogs.request_url, `%${params.request_url}%`));
  }
  if (params.date_from) {
    conditions.push(gte(systemLogs.created_at, new Date(params.date_from)));
  }
  if (params.date_to) {
    conditions.push(lte(systemLogs.created_at, new Date(params.date_to)));
  }
  if (params.search) {
    conditions.push(sql`${systemLogs.message} ILIKE ${'%' + params.search + '%'}`);
  }
  if (params.min_response_time) {
    const minTime = parseInt(params.min_response_time, 10);
    if (!isNaN(minTime)) {
      conditions.push(gte(systemLogs.response_time_ms, minTime));
    }
  }

  // Filtro JSONB: espera JSON string com { key, operator, value }
  if (params.context_filter) {
    try {
      const filter = JSON.parse(params.context_filter) as {
        key: string;
        operator: string;
        value: unknown;
      };
      const jsonPath = filter.key;
      const val = JSON.stringify(filter.value);

      switch (filter.operator) {
        case 'eq':
          conditions.push(
            sql`${systemLogs.context_data}->>${sql.raw(`'${jsonPath}'`)} = ${String(filter.value)}`,
          );
          break;
        case 'contains':
          conditions.push(
            sql`${systemLogs.context_data} @> ${val}::jsonb`,
          );
          break;
        case 'exists':
          conditions.push(
            sql`${systemLogs.context_data} ? ${jsonPath}`,
          );
          break;
        default:
          break;
      }
    } catch {
      // context_filter inválido — ignorar silenciosamente
    }
  }

  // Cursor: id decrescente
  if (params.cursor) {
    const cursorId = parseInt(params.cursor, 10);
    if (!isNaN(cursorId)) {
      conditions.push(lt(systemLogs.id, cursorId));
    }
  }

  return conditions;
}

// ---------------------------------------------------------------------------
// GET /api/logs — Consulta paginada de logs
// ---------------------------------------------------------------------------

export async function listSystemLogs(req: Request, res: Response) {
  try {
    const params = req.query as unknown as LogsQueryParams;
    const limit = Math.min(parseInt(params.limit || '50', 10) || 50, 200);
    const isSuperAdmin = req.session?.userRole === 'admin';
    const effectiveCompanyId = getEffectiveCompanyId(req, params.company_id);

    const conditions = buildFilters(params, effectiveCompanyId, isSuperAdmin);

    // Condições sem cursor para contagem total
    const countConditions = conditions.filter(
      (c) => !params.cursor || c !== conditions[conditions.length - 1] || !params.cursor,
    );
    // Reconstruir sem cursor para total
    const countFilters = buildFilters(
      { ...params, cursor: undefined },
      effectiveCompanyId,
      isSuperAdmin,
    );

    // Determinar ordenação (trace_id presente → ASC para trace view)
    const isTraceView = !!params.trace_id && params.sort_order === 'asc';
    const orderBy = isTraceView
      ? asc(systemLogs.created_at)
      : desc(systemLogs.id);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(systemLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(orderBy)
        .limit(limit + 1), // +1 para saber se há mais
      db
        .select({ total: count() })
        .from(systemLogs)
        .where(countFilters.length > 0 ? and(...countFilters) : undefined),
    ]);

    const hasMore = data.length > limit;
    if (hasMore) data.pop();

    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;
    const total = totalResult[0]?.total ?? 0;

    return res.json({
      data,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    });
  } catch (error) {
    console.error('[logs-api] Erro ao listar logs:', error);
    return res.status(500).json({ message: 'Erro ao consultar logs' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/logs/stats — Estatísticas agregadas
// ---------------------------------------------------------------------------

export async function getSystemLogStats(req: Request, res: Response) {
  try {
    const params = req.query as unknown as StatsQueryParams;
    const isSuperAdmin = req.session?.userRole === 'admin';
    const effectiveCompanyId = getEffectiveCompanyId(req, params.company_id);

    const conditions: SQL[] = [];

    if (!isSuperAdmin && effectiveCompanyId !== null) {
      conditions.push(eq(systemLogs.company_id, effectiveCompanyId));
    } else if (isSuperAdmin && effectiveCompanyId !== null) {
      conditions.push(eq(systemLogs.company_id, effectiveCompanyId));
    }

    if (params.date_from) {
      conditions.push(gte(systemLogs.created_at, new Date(params.date_from)));
    }
    if (params.date_to) {
      conditions.push(lte(systemLogs.created_at, new Date(params.date_to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [
      totalResult,
      errorResult,
      avgTimeResult,
      slowResult,
      byLevelResult,
      byServerResult,
    ] = await Promise.all([
      // Total de logs
      db.select({ total: count() }).from(systemLogs).where(whereClause),

      // Total de erros (error + fatal)
      db
        .select({ total: count() })
        .from(systemLogs)
        .where(
          whereClause
            ? and(whereClause, sql`${systemLogs.level} IN ('error', 'fatal')`)
            : sql`${systemLogs.level} IN ('error', 'fatal')`,
        ),

      // Média de response_time_ms
      db
        .select({ avg: avg(systemLogs.response_time_ms) })
        .from(systemLogs)
        .where(
          whereClause
            ? and(whereClause, sql`${systemLogs.response_time_ms} IS NOT NULL`)
            : sql`${systemLogs.response_time_ms} IS NOT NULL`,
        ),

      // Requisições lentas (> 1000ms)
      db
        .select({ total: count() })
        .from(systemLogs)
        .where(
          whereClause
            ? and(whereClause, sql`${systemLogs.response_time_ms} > 1000`)
            : sql`${systemLogs.response_time_ms} > 1000`,
        ),

      // Contagem por nível
      db
        .select({
          level: systemLogs.level,
          count: count(),
        })
        .from(systemLogs)
        .where(whereClause)
        .groupBy(systemLogs.level),

      // Contagem por servidor
      db
        .select({
          server: systemLogs.server_identifier,
          count: count(),
        })
        .from(systemLogs)
        .where(whereClause)
        .groupBy(systemLogs.server_identifier),
    ]);

    const byLevel: Record<string, number> = {};
    for (const row of byLevelResult) {
      byLevel[row.level] = Number(row.count);
    }

    const byServer: Record<string, number> = {};
    for (const row of byServerResult) {
      byServer[row.server] = Number(row.count);
    }

    return res.json({
      totalLogs: Number(totalResult[0]?.total ?? 0),
      totalErrors: Number(errorResult[0]?.total ?? 0),
      avgResponseTime: Math.round(Number(avgTimeResult[0]?.avg ?? 0)),
      slowRequests: Number(slowResult[0]?.total ?? 0),
      byLevel,
      byServer,
    });
  } catch (error) {
    console.error('[logs-api] Erro ao obter estatísticas:', error);
    return res.status(500).json({ message: 'Erro ao obter estatísticas de logs' });
  }
}
