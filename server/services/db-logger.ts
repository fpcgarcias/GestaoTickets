/**
 * DbLogger — Logger programático que delega ao LogBuffer.
 *
 * Expõe log.debug(), log.info(), log.warn(), log.error(), log.fatal()
 * e mantém compatibilidade com a interface do Winston (logger.info, logger.error, etc.)
 * para migração gradual.
 */

import os from 'os';
import { logBuffer, type LogLevel } from './log-buffer';

const SERVER_IDENTIFIER = process.env.SERVER_IDENTIFIER || os.hostname();

// Contexto thread-local (simplificado via closure — adequado para Node single-thread)
let _traceId: string | undefined;
let _spanId: string | undefined;
let _userId: number | undefined;
let _companyId: number | undefined;

/** Define trace_id e span_id para os próximos logs */
function setTraceContext(traceId: string, spanId?: string): void {
  _traceId = traceId;
  _spanId = spanId;
}

/** Define user_id e company_id para os próximos logs */
function setUserContext(userId: number, companyId: number): void {
  _userId = userId;
  _companyId = companyId;
}

/** Limpa todo o contexto (útil entre requisições) */
function clearContext(): void {
  _traceId = undefined;
  _spanId = undefined;
  _userId = undefined;
  _companyId = undefined;
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  // Se context contém company_id ou user_id, usa como override (útil para logs fora de request, ex: email)
  const ctxCompanyId = context?.company_id as number | undefined;
  const ctxUserId = context?.user_id as number | undefined;

  logBuffer.add({
    level,
    message,
    server_identifier: SERVER_IDENTIFIER,
    trace_id: _traceId,
    span_id: _spanId,
    company_id: ctxCompanyId ?? _companyId ?? null,
    user_id: ctxUserId ?? _userId ?? null,
    context_data: context ?? null,
  });
}

/**
 * Logger programático — interface principal.
 *
 * Uso:
 *   import { log } from './db-logger';
 *   log.info('Ticket criado', { ticket_id: 42 });
 */
export const log = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info:  (message: string, context?: Record<string, unknown>) => write('info',  message, context),
  warn:  (message: string, context?: Record<string, unknown>) => write('warn',  message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  fatal: (message: string, context?: Record<string, unknown>) => write('fatal', message, context),
  setTraceContext,
  setUserContext,
  clearContext,
};

/**
 * Alias compatível com Winston para migração gradual.
 *
 * Permite substituir `import logger from './logger'` por `import { dbLogger as logger } from './db-logger'`
 * sem alterar chamadas existentes como `logger.info(...)`, `logger.error(...)`.
 */
export const dbLogger = {
  debug: log.debug,
  info:  log.info,
  warn:  log.warn,
  error: log.error,
  fatal: log.fatal,
  // Winston usa 'log' com level como primeiro arg — atalho de compatibilidade
  log: (level: string, message: string, context?: Record<string, unknown>) => {
    const validLevels: Record<string, LogLevel> = {
      debug: 'debug', info: 'info', warn: 'warn', warning: 'warn',
      error: 'error', fatal: 'fatal',
    };
    const mapped = validLevels[level];
    if (mapped) write(mapped, message, context);
  },
};

export { setTraceContext, setUserContext, clearContext };
