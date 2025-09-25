import { emailNotificationService } from './email-notification-service';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private dailyDigestIntervalId: NodeJS.Timeout | null = null;
  private weeklyDigestIntervalId: NodeJS.Timeout | null = null;
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
      return;
    }

    this.isRunning = true;

    // Executar imediatamente uma vez
    this.checkTickets();

    // Agendar para rodar a cada hora (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkTickets();
    }, 3600000); // 1 hora

    // Iniciar digest diário (todos os dias às 8h)
    this.startDailyDigest();

    // Iniciar digest semanal (todos os domingos às 9h)
    this.startWeeklyDigest();
  }

  // Parar o agendador
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.dailyDigestIntervalId) {
      clearInterval(this.dailyDigestIntervalId);
      this.dailyDigestIntervalId = null;
    }
    if (this.weeklyDigestIntervalId) {
      clearInterval(this.weeklyDigestIntervalId);
      this.weeklyDigestIntervalId = null;
    }
    this.isRunning = false;
  }

  // Iniciar digest diário
  private startDailyDigest(): void {
    const runDailyDigest = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Respeitar horário de hibernação: não executar entre 21h e 6h
      if ((hour >= 21) || (hour < 6)) {
        return;
      }
      
      // Executar às 8h da manhã
      if (hour === 8 && minute === 0) {
        this.generateDailyDigest();
      }
    };

    // Executar a cada minuto para verificar se é hora do digest
    this.dailyDigestIntervalId = setInterval(runDailyDigest, 60000); // 1 minuto
    
    // Executar imediatamente se for 8h e estiver no horário permitido
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0 && now.getHours() >= 6 && now.getHours() < 21) {
      this.generateDailyDigest();
    }
  }

  // Iniciar digest semanal
  private startWeeklyDigest(): void {
    const runWeeklyDigest = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = domingo
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Respeitar horário de hibernação: não executar entre 21h e 6h
      if ((hour >= 21) || (hour < 6)) {
        return;
      }
      
      // Executar aos domingos às 9h da manhã
      if (dayOfWeek === 0 && hour === 9 && minute === 0) {
        this.generateWeeklyDigest();
      }
    };

    // Executar a cada minuto para verificar se é hora do digest
    this.weeklyDigestIntervalId = setInterval(runWeeklyDigest, 60000); // 1 minuto
    
    // Executar imediatamente se for domingo às 9h e estiver no horário permitido
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 9 && now.getMinutes() === 0 && now.getHours() >= 6 && now.getHours() < 21) {
      this.generateWeeklyDigest();
    }
  }

  // Gerar digest diário
  private async generateDailyDigest(): Promise<void> {
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';

    try {
      if (companyFilter === '*') {
        // Para todas as empresas
        await emailNotificationService.generateDailyDigestForParticipants();
      } else {
        // Para empresas específicas
        const companyIds = companyFilter.split(',').map(id => parseInt(id.trim()));
        for (const companyId of companyIds) {
          await emailNotificationService.generateDailyDigestForParticipants(companyId);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Erro ao gerar digest diário:', error);
    }
  }

  // Gerar digest semanal
  private async generateWeeklyDigest(): Promise<void> {
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';

    try {
      if (companyFilter === '*') {
        // Para todas as empresas
        await emailNotificationService.generateWeeklyDigestForParticipants();
      } else {
        // Para empresas específicas
        const companyIds = companyFilter.split(',').map(id => parseInt(id.trim()));
        for (const companyId of companyIds) {
          await emailNotificationService.generateWeeklyDigestForParticipants(companyId);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Erro ao gerar digest semanal:', error);
    }
  }

  // Verificar tickets e enviar notificações
  private async checkTickets(): Promise<void> {
    // Adiciona restrição de horário: só executa entre 06:01 e 21:59
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    // Fora do intervalo permitido: antes de 6h, ou depois de 21h, ou exatamente 6:00 ou 22:00+
    if ((hour < 6) || (hour > 21) || (hour === 6 && minute === 0)) {
      return;
    }

    // Obter filtro de empresa da variável de ambiente
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';

    try {
      await emailNotificationService.checkTicketsDueSoon(companyFilter);
      await emailNotificationService.checkSatisfactionSurveyReminders(companyFilter);
    } catch (error) {
      console.error('[Scheduler] Erro na verificação de tickets:', error);
    }
  }

  // Método para executar verificação manual
  async runManualCheck(): Promise<void> {
    await this.checkTickets();
  }

  // Método para executar digest diário manual
  async runManualDailyDigest(): Promise<void> {
    await this.generateDailyDigest();
  }

  // Método para executar digest semanal manual
  async runManualWeeklyDigest(): Promise<void> {
    await this.generateWeeklyDigest();
  }

  // Verificar se o agendador está rodando
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const schedulerService = new SchedulerService(); 