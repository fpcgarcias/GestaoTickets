/**
 * LogRetentionJob - Serviço de Limpeza Automática de Logs Antigos
 *
 * Agenda e executa a remoção de logs antigos da tabela system_logs
 * para manter o banco de dados otimizado. Segue o mesmo padrão do CleanupScheduler.
 */

import * as cron from 'node-cron';
import { db } from '../db';
import { systemLogs } from '../../shared/schema';
import { log as dbLog } from './db-logger';
import { lt } from 'drizzle-orm';

export class LogRetentionJob {
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private readonly DEFAULT_RETENTION_DAYS = 90;

  private getRetentionDays(): number {
    const envValue = process.env.LOG_RETENTION_DAYS;
    if (envValue) {
      const parsed = parseInt(envValue, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return this.DEFAULT_RETENTION_DAYS;
  }

  /**
   * Inicia o scheduler de retenção de logs
   * Agenda execução diária às 2h da manhã (antes do cleanup de notificações às 3h)
   */
  start(): void {
    if (this.scheduledTask) {
      console.log('[📋 LOG-RETENTION] Scheduler já está rodando');
      return;
    }

    this.scheduledTask = cron.schedule('0 2 * * *', async () => {
      await this.runCleanup();
    }, {
      timezone: 'America/Sao_Paulo'
    });

    console.log(`[📋 LOG-RETENTION] Scheduler iniciado - execução diária às 2h (retenção: ${this.getRetentionDays()} dias)`);
  }

  /**
   * Para o scheduler de retenção
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      console.log('[📋 LOG-RETENTION] Scheduler parado');
    }
  }

  /**
   * Executa a limpeza de logs antigos
   */
  async runCleanup(): Promise<{ deletedCount: number }> {
    if (this.isRunning) {
      console.log('[📋 LOG-RETENTION] Limpeza já está em execução, pulando...');
      return { deletedCount: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const retentionDays = this.getRetentionDays();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      console.log(`[📋 LOG-RETENTION] Iniciando limpeza de logs anteriores a ${cutoffDate.toISOString()} (${retentionDays} dias)...`);

      const deleted = await db
        .delete(systemLogs)
        .where(lt(systemLogs.created_at, cutoffDate))
        .returning({ id: systemLogs.id });

      const deletedCount = deleted.length;
      const duration = Date.now() - startTime;

      console.log(`[📋 LOG-RETENTION] ✅ Limpeza concluída em ${duration}ms - ${deletedCount} logs removidos`);

      return { deletedCount };
    } catch (error) {
      console.error('[📋 LOG-RETENTION] ❌ Erro ao executar limpeza de logs:', error);
      console.error('[📋 LOG-RETENTION] Tentará novamente na próxima execução');
      dbLog.error('Log retention: falha na limpeza', {
        tipo: 'sistema',
        job: 'log_retention',
        erro: (error as any)?.message || String(error),
      });
      return { deletedCount: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  isSchedulerRunning(): boolean {
    return this.scheduledTask !== null;
  }

  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  getRetentionSettings(): { retentionDays: number } {
    return { retentionDays: this.getRetentionDays() };
  }
}

// Instância singleton
export const logRetentionJob = new LogRetentionJob();
