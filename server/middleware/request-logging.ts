/**
 * Request Logging Middleware — Captura automática de requisições HTTP.
 *
 * Gera trace_id/span_id, mede duração, extrai contexto de sessão
 * e registra no LogBuffer de forma assíncrona (não bloqueia response).
 *
 * Gera mensagens legíveis baseadas na rota e no body da requisição,
 * para que os logs façam sentido pra quem lê.
 */

import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import type { Request, Response, NextFunction } from 'express';
import os from 'os';
import { logBuffer, type LogEntryInput } from '../services/log-buffer';

const SERVER_IDENTIFIER = process.env.SERVER_IDENTIFIER || os.hostname();

// ---------------------------------------------------------------------------
// Gerador de mensagens legíveis baseado na rota + body
// ---------------------------------------------------------------------------

function buildReadableMessage(req: Request, res: Response): { message: string; details: Record<string, unknown> } {
  const method = req.method;
  const basePath = req.originalUrl.split('?')[0];
  const body = req.body || {};
  const params = req.params || {};
  const details: Record<string, unknown> = {};
  const status = res.statusCode;

  // Prefixo de erro
  const isError = status >= 400;
  const errorPrefix = isError ? `[ERRO ${status}] ` : '';

  // --- TICKETS ---
  // POST /api/tickets → Criação
  if (method === 'POST' && /^\/api\/tickets\/?$/.test(basePath)) {
    details.titulo = body.title;
    details.solicitante = body.customer_email;
    details.departamento_id = body.department_id;
    details.prioridade = body.priority;
    return { message: `${errorPrefix}Novo ticket criado: "${body.title || '(sem título)'}"`, details };
  }

  // PATCH /api/tickets/:id → Atualização de ticket
  if (method === 'PATCH' && /^\/api\/tickets\/\d+$/.test(basePath)) {
    const ticketId = params.id || basePath.split('/').pop();
    const changes = Object.keys(body);
    details.ticket_id = ticketId;
    details.campos_alterados = changes;

    if (body.assigned_to_id !== undefined || body.official_id !== undefined) {
      const officialId = body.assigned_to_id || body.official_id;
      details.atendente_id = officialId;
      return { message: `${errorPrefix}Ticket #${ticketId}: atendente ${officialId ? `atribuído (ID: ${officialId})` : 'removido'}`, details };
    }
    if (body.status !== undefined) {
      details.novo_status = body.status;
      return { message: `${errorPrefix}Ticket #${ticketId}: status alterado para "${body.status}"`, details };
    }
    if (body.priority !== undefined) {
      details.nova_prioridade = body.priority;
      return { message: `${errorPrefix}Ticket #${ticketId}: prioridade alterada para "${body.priority}"`, details };
    }
    if (body.department_id !== undefined) {
      details.novo_departamento_id = body.department_id;
      return { message: `${errorPrefix}Ticket #${ticketId}: transferido para departamento ${body.department_id}`, details };
    }
    if (body.category_id !== undefined) {
      details.nova_categoria_id = body.category_id;
      return { message: `${errorPrefix}Ticket #${ticketId}: categoria alterada`, details };
    }

    const summary = changes.length <= 3 ? changes.join(', ') : `${changes.length} campos`;
    return { message: `${errorPrefix}Ticket #${ticketId}: atualizado (${summary})`, details };
  }

  // POST /api/tickets/:id/transfer → Transferência
  if (method === 'POST' && /^\/api\/tickets\/\d+\/transfer$/.test(basePath)) {
    const ticketId = basePath.split('/')[3];
    details.ticket_id = ticketId;
    details.departamento_destino = body.department_id;
    return { message: `${errorPrefix}Ticket #${ticketId}: transferido para departamento ${body.department_id || '?'}`, details };
  }

  // --- RESPOSTAS DE TICKETS ---
  if (method === 'POST' && /^\/api\/ticket-replies\/?$/.test(basePath)) {
    details.ticket_id = body.ticket_id;
    details.interno = body.is_internal;
    const tipo = body.is_internal ? 'nota interna' : 'resposta';
    const preview = body.message ? body.message.substring(0, 80) : '';
    return { message: `${errorPrefix}Ticket #${body.ticket_id || '?'}: ${tipo} adicionada${preview ? ` — "${preview}..."` : ''}`, details };
  }

  // --- ANEXOS ---
  if (method === 'POST' && /^\/api\/tickets\/\d+\/attachments$/.test(basePath)) {
    const ticketId = basePath.split('/')[3];
    details.ticket_id = ticketId;
    return { message: `${errorPrefix}Ticket #${ticketId}: anexo enviado`, details };
  }

  // --- AUTENTICAÇÃO ---
  if (method === 'POST' && /^\/api\/login\/?$/.test(basePath)) {
    details.username = body.username;
    return { message: isError ? `Falha no login: "${body.username || '?'}"` : `Login realizado: "${body.username || '?'}"`, details };
  }
  if (method === 'POST' && /^\/api\/logout\/?$/.test(basePath)) {
    return { message: 'Logout realizado', details };
  }
  if (method === 'POST' && /^\/api\/register\/?$/.test(basePath)) {
    details.username = body.username;
    details.email = body.email;
    return { message: `${errorPrefix}Novo usuário registrado: "${body.username || '?'}"`, details };
  }

  // --- USUÁRIOS ---
  if (method === 'POST' && /^\/api\/users\/?$/.test(basePath)) {
    details.username = body.username;
    details.role = body.role;
    return { message: `${errorPrefix}Usuário criado: "${body.username || '?'}" (${body.role || '?'})`, details };
  }
  if (method === 'PATCH' && /^\/api\/users\/\d+$/.test(basePath)) {
    const userId = basePath.split('/').pop();
    details.user_id = userId;
    details.campos_alterados = Object.keys(body);
    return { message: `${errorPrefix}Usuário #${userId}: atualizado (${Object.keys(body).join(', ')})`, details };
  }

  // --- NOTIFICAÇÕES ---
  if (/^\/api\/notifications/.test(basePath)) {
    if (method === 'GET') {
      return { message: 'Consulta de notificações', details };
    }
    if (method === 'PATCH' || method === 'POST') {
      return { message: `${errorPrefix}Notificação atualizada`, details };
    }
  }

  // --- DEPARTAMENTOS ---
  if (method === 'POST' && /^\/api\/departments\/?$/.test(basePath)) {
    details.nome = body.name;
    return { message: `${errorPrefix}Departamento criado: "${body.name || '?'}"`, details };
  }

  // --- EMPRESAS ---
  if (method === 'POST' && /^\/api\/companies\/?$/.test(basePath)) {
    details.nome = body.name;
    return { message: `${errorPrefix}Empresa criada: "${body.name || '?'}"`, details };
  }

  // --- CONSULTAS GET genéricas (simplificar) ---
  if (method === 'GET') {
    // Extrair o recurso principal da URL
    const segments = basePath.replace('/api/', '').split('/').filter(Boolean);
    const resource = segments[0] || 'recurso';

    // Mapear nomes de recursos pra português
    const resourceNames: Record<string, string> = {
      'tickets': 'tickets',
      'users': 'usuários',
      'companies': 'empresas',
      'departments': 'departamentos',
      'categories': 'categorias',
      'officials': 'atendentes',
      'customers': 'solicitantes',
      'notifications': 'notificações',
      'priorities': 'prioridades',
      'incident-types': 'tipos de incidente',
      'satisfaction-surveys': 'pesquisas de satisfação',
      'system-logs': 'logs do sistema',
      'dashboard-metrics': 'métricas do dashboard',
    };

    const readableName = resourceNames[resource] || resource;

    // Se tem ID específico
    if (segments.length >= 2 && /^\d+$/.test(segments[1])) {
      return { message: `Consulta: ${readableName} #${segments[1]}`, details };
    }

    return { message: `Consulta: lista de ${readableName}`, details };
  }

  // --- FALLBACK genérico (ainda melhor que antes) ---
  const statusText = status >= 500 ? 'erro interno'
    : status >= 400 ? `erro ${status}`
    : status === 304 ? 'cache'
    : 'ok';
  return { message: `${method} ${basePath} → ${statusText}`, details };
}


// ---------------------------------------------------------------------------
// Middleware principal
// ---------------------------------------------------------------------------

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Ignorar requisições de assets estáticos (Vite dev server, arquivos do frontend)
  const IGNORED_EXTENSIONS = /\.(css|js|ts|tsx|jsx|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)(\?.*)?$/i;
  const IGNORED_PREFIXES = ['/src/', '/node_modules/', '/@', '/assets/'];
  const urlPath = req.originalUrl.split('?')[0];
  if (IGNORED_EXTENSIONS.test(urlPath) || IGNORED_PREFIXES.some(p => urlPath.startsWith(p))) {
    return next();
  }

  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const spanId = randomUUID();
  const startTime = performance.now();

  // Expor trace_id no header de resposta para correlação
  res.setHeader('x-trace-id', traceId);

  // Capturar corpo de resposta JSON para erros
  let capturedErrorBody: unknown = undefined;
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (res.statusCode >= 400) {
      capturedErrorBody = body;
    }
    return originalJson(body);
  };

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startTime);

    const userId = req.session?.userId ?? null;
    const companyId = req.session?.companyId ?? null;
    const level = res.statusCode >= 400 ? 'error' : 'info';

    // Gerar mensagem legível com contexto
    const { message, details } = buildReadableMessage(req, res);

    const contextData: Record<string, unknown> = { ...details };
    if (req.params && Object.keys(req.params).length > 0) {
      contextData.route_params = req.params;
    }
    if (level === 'error' && capturedErrorBody !== undefined) {
      contextData.error_body = capturedErrorBody;
    }
    // Guardar query params no context_data se existirem
    const queryString = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : null;
    if (queryString) {
      contextData.query_params = queryString;
    }

    const entry: LogEntryInput = {
      level,
      message,
      server_identifier: SERVER_IDENTIFIER,
      trace_id: traceId,
      span_id: spanId,
      context_data: Object.keys(contextData).length > 0 ? contextData : null,
      company_id: companyId,
      user_id: userId,
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: res.statusCode,
      response_time_ms: durationMs,
    };

    logBuffer.add(entry);

    // Log adicional de warn para requisições lentas (> 1s)
    if (durationMs > 1000) {
      const warnEntry: LogEntryInput = {
        level: 'warn',
        message: `⚠ Lenta: ${message} (${durationMs}ms)`,
        server_identifier: SERVER_IDENTIFIER,
        trace_id: traceId,
        span_id: spanId,
        context_data: {
          ...details,
          total_time_ms: durationMs,
          response_status: res.statusCode,
        },
        company_id: companyId,
        user_id: userId,
        request_method: req.method,
        request_url: req.originalUrl,
        response_status: res.statusCode,
        response_time_ms: durationMs,
      };
      logBuffer.add(warnEntry);
    }
  });

  next();
}
