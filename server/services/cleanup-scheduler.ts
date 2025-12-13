/**
 * CleanupScheduler - Serviço de Limpeza Automática de Notificações
 * 
 * Este serviço agenda e executa a limpeza automática de notificações antigas
 * para manter o banco de dados otimizado e evitar acúmulo excessivo de dados.
 */

import * as cron from 'node-cron';
import { db } from '../db';
import { notifications } from '../../shared/schema';
import { logNotificationError } from './logger';
import { and, lt, isNotNull, isNull } from 'drizzle-orm';

export class CleanupScheduler {
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  // Configurações de retenção (em dias)
  private readonly READ_NOTIFICATIONS_RETENTION_DAYS = parseInt(
    process.env.READ_NOTIFICATIONS_RETENTION_DAYS || '90'
  );
  private readonly UNREAD_NOTIFICATIONS_RETENTION_DAYS = parseInt(
    process.env.UNREAD_NOTIFICATIONS_RETENTION_DAYS || '180'
  );

  /**
   * Inicia o scheduler de limpeza automática
   * Agenda execução diária às 3h da manhã
   */
  start(): void {
    if (this.scheduledTask) {
      console.log('[🧹 CLEANUP] Scheduler já está rodando');
      return;
    }

    // Agenda para executar todos os dias às 3h da manhã
    this.scheduledTask = cron.schedule('0 3 * * *', async () => {
      await this.runCleanup();
    }, {
      timezone: 'America/Sao_Paulo'
    });

    console.log('[🧹 CLEANUP] Scheduler iniciado - execução diária às 3h');
  }

  /**
   * Para o scheduler de limpeza automática
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      console.log('[🧹 CLEANUP] Scheduler parado');
    }
  }

  /**
   * Executa a limpeza de notificações antigas
   * Pode ser chamado manualmente para testes ou limpeza imediata
   */
  async runCleanup(): Promise<void> {
    if (this.isRunning) {
      console.log('[🧹 CLEANUP] Limpeza já está em execução, pulando...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[🧹 CLEANUP] Iniciando limpeza de notificações antigas...');

      const { readCount, unreadCount } = await this.cleanupOldNotifications();
      
      const duration = Date.now() - startTime;
      console.log(`[🧹 CLEANUP] ✅ Limpeza concluída em ${duration}ms`);
      console.log(`[🧹 CLEANUP] 📊 Removidas: ${readCount} lidas + ${unreadCount} não lidas = ${readCount + unreadCount} total`);

    } catch (error) {
      logNotificationError(
        'Cleanup scheduler execution failed',
        error,
        'critical'
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Remove notificações antigas do banco de dados
   * - Notificações lidas com mais de 90 dias (configurável)
   * - Notificações não lidas com mais de 180 dias (configurável)
   * 
   * @returns Objeto com contadores de notificações removidas
   */
  async cleanupOldNotifications(): Promise<{ readCount: number; unreadCount: number }> {
    const now = new Date();
    
    // Calcular datas de corte
    const readCutoffDate = new Date(now.getTime() - (this.READ_NOTIFICATIONS_RETENTION_DAYS * 24 * 60 * 60 * 1000));
    const unreadCutoffDate = new Date(now.getTime() - (this.UNREAD_NOTIFICATIONS_RETENTION_DAYS * 24 * 60 * 60 * 1000));

    console.log(`[🧹 CLEANUP] Removendo notificações lidas antes de: ${readCutoffDate.toISOString()}`);
    console.log(`[🧹 CLEANUP] Removendo notificações não lidas antes de: ${unreadCutoffDate.toISOString()}`);

    // Remover notificações lidas antigas
    const readNotificationsToDelete = await db
      .delete(notifications)
      .where(
        and(
          isNotNull(notifications.read_at), // Notificações lidas
          lt(notifications.created_at, readCutoffDate) // Mais antigas que o limite
        )
      )
      .returning({ id: notifications.id });

    // Remover notificações não lidas antigas
    const unreadNotificationsToDelete = await db
      .delete(notifications)
      .where(
        and(
          isNull(notifications.read_at), // Notificações não lidas
          lt(notifications.created_at, unreadCutoffDate) // Mais antigas que o limite
        )
      )
      .returning({ id: notifications.id });

    const readCount = readNotificationsToDelete.length;
    const unreadCount = unreadNotificationsToDelete.length;

    console.log(`[🧹 CLEANUP] 🗑️ Removidas ${readCount} notificações lidas antigas`);
    console.log(`[🧹 CLEANUP] 🗑️ Removidas ${unreadCount} notificações não lidas antigas`);

    return { readCount, unreadCount };
  }

  /**
   * Verifica se o scheduler está rodando
   */
  isSchedulerRunning(): boolean {
    return this.scheduledTask !== null;
  }

  /**
   * Verifica se uma limpeza está em execução no momento
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna as configurações de retenção atuais
   */
  getRetentionSettings(): { readDays: number; unreadDays: number } {
    return {
      readDays: this.READ_NOTIFICATIONS_RETENTION_DAYS,
      unreadDays: this.UNREAD_NOTIFICATIONS_RETENTION_DAYS
    };
  }
}

// Instância singleton do scheduler
export const cleanupScheduler = new CleanupScheduler();