import { emailNotificationService } from './email-notification-service';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Iniciar o agendador (rodar a cada hora)
  start(): void {
    if (this.isRunning) {
      console.log('[Scheduler] Agendador já está rodando');
      return;
    }

    console.log('[Scheduler] Iniciando verificação automática de tickets...');
    this.isRunning = true;

    // Executar imediatamente uma vez
    this.checkTickets();

    // Agendar para rodar a cada hora (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkTickets();
    }, 3600000); // 1 hora

    console.log('[Scheduler] Agendador iniciado - verificações a cada hora');
  }

  // Parar o agendador
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Agendador interrompido');
  }

  // Verificar tickets e enviar notificações
  private async checkTickets(): Promise<void> {
    try {
      console.log('[Scheduler] Executando verificação de tickets próximos do vencimento...');
      await emailNotificationService.checkTicketsDueSoon();
      console.log('[Scheduler] Verificação de tickets concluída');
    } catch (error) {
      console.error('[Scheduler] Erro na verificação de tickets:', error);
    }
  }

  // Método para executar verificação manual
  async runManualCheck(): Promise<void> {
    console.log('[Scheduler] Executando verificação manual...');
    await this.checkTickets();
  }

  // Verificar se o agendador está rodando
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const schedulerService = new SchedulerService(); 