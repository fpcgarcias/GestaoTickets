/**
 * LogBuffer — Buffer em memória para persistência batch de logs no PostgreSQL.
 *
 * Acumula LogEntryInput em memória e faz flush periódico (a cada 2 s ou 50 entries)
 * usando batch INSERT via Drizzle ORM. Retry com backoff exponencial (3 tentativas).
 */

import { db } from '../db';
import { systemLogs } from '../../shared/schema';

// Níveis válidos de log
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal'] as const);
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntryInput {
  level: string;
  message: string;
  server_identifier: string;
  trace_id?: string | null;
  span_id?: string | null;
  context_data?: Record<string, unknown> | null;
  company_id?: number | null;
  user_id?: number | null;
  request_method?: string | null;
  request_url?: string | null;
  response_status?: number | null;
  response_time_ms?: number | null;
}

export class LogBuffer {
  private buffer: LogEntryInput[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 2000;
  private readonly MAX_RETRIES = 3;

  /** Inicia o timer de flush periódico */
  start(): void {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      this.flush().catch(() => {});
    }, this.FLUSH_INTERVAL_MS);
  }

  /** Flush final e para o timer */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush().catch(() => {});
  }

  /**
   * Adiciona uma entry ao buffer.
   * Rejeita silenciosamente se o level for inválido.
   * Dispara flush automático se o buffer atingir MAX_BUFFER_SIZE.
   */
  add(entry: LogEntryInput): void {
    if (!VALID_LEVELS.has(entry.level as LogLevel)) return;
    this.buffer.push(entry);
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush().catch(() => {});
    }
  }

  /** Batch INSERT no banco com retry e backoff exponencial */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        await db.insert(systemLogs).values(
          batch.map((entry) => ({
            level: entry.level,
            message: entry.message,
            server_identifier: entry.server_identifier,
            trace_id: entry.trace_id ?? null,
            span_id: entry.span_id ?? null,
            context_data: entry.context_data ?? {},
            company_id: entry.company_id ?? null,
            user_id: entry.user_id ?? null,
            request_method: entry.request_method ?? null,
            request_url: entry.request_url ?? null,
            response_status: entry.response_status ?? null,
            response_time_ms: entry.response_time_ms ?? null,
          })),
        );
        return; // sucesso
      } catch (err) {
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.error('[LogBuffer] Falha ao persistir batch após 3 tentativas, descartando', err);
        }
      }
    }
  }
}

// Instância singleton
export const logBuffer = new LogBuffer();
