import { emailNotificationService } from './email-notification-service';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Função para interpretar o filtro de empresas
  private parseCompanyFilter(filter: string): (companyId: number) => boolean {
    if (!filter || filter === '*') {
      return () => true; // Todas as empresas
    }
    
    if (filter.startsWith('<>')) {
      const excludedId = parseInt(filter.substring(2));
      return (companyId: number) => companyId !== excludedId;
    }
    
    if (filter.includes(',')) {
      const allowedIds = filter.split(',').map(id => parseInt(id.trim()));
      return (companyId: number) => allowedIds.includes(companyId);
    }
    
    const specificId = parseInt(filter);
    return (companyId: number) => companyId === specificId;
  }

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
    // Adiciona restrição de horário: só executa entre 06:01 e 21:59
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    // Fora do intervalo permitido: antes de 6h, ou depois de 21h, ou exatamente 6:00 ou 22:00+
    if ((hour < 6) || (hour > 21) || (hour === 6 && minute === 0)) {
      console.log('[Scheduler] Fora do horário permitido (06:01-21:59). Não será feita verificação de tickets agora.');
      return;
    }

    // Obter filtro de empresa da variável de ambiente
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';
    console.log(`[Scheduler] Filtro de empresa configurado: ${companyFilter}`);

    try {
      console.log('[Scheduler] Executando verificação de tickets próximos do vencimento...');
      await emailNotificationService.checkTicketsDueSoon(companyFilter);
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