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

    // Iniciar digest diário (todos os dias às 8h)
    this.startDailyDigest();

    // Iniciar digest semanal (todos os domingos às 9h)
    this.startWeeklyDigest();

    console.log('[Scheduler] Agendador iniciado - verificações a cada hora');
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
    console.log('[Scheduler] Agendador interrompido');
  }

  // Iniciar digest diário
  private startDailyDigest(): void {
    console.log('[Scheduler] Configurando digest diário...');
    
    const runDailyDigest = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Executar às 8h da manhã
      if (hour === 8 && minute === 0) {
        this.generateDailyDigest();
      }
    };

    // Executar a cada minuto para verificar se é hora do digest
    this.dailyDigestIntervalId = setInterval(runDailyDigest, 60000); // 1 minuto
    
    // Executar imediatamente se for 8h
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
      this.generateDailyDigest();
    }
  }

  // Iniciar digest semanal
  private startWeeklyDigest(): void {
    console.log('[Scheduler] Configurando digest semanal...');
    
    const runWeeklyDigest = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = domingo
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Executar aos domingos às 9h da manhã
      if (dayOfWeek === 0 && hour === 9 && minute === 0) {
        this.generateWeeklyDigest();
      }
    };

    // Executar a cada minuto para verificar se é hora do digest
    this.weeklyDigestIntervalId = setInterval(runWeeklyDigest, 60000); // 1 minuto
    
    // Executar imediatamente se for domingo às 9h
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 9 && now.getMinutes() === 0) {
      this.generateWeeklyDigest();
    }
  }

  // Gerar digest diário
  private async generateDailyDigest(): Promise<void> {
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';
    console.log(`[Scheduler] Gerando digest diário para empresas: ${companyFilter}`);

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
      console.log('[Scheduler] Digest diário gerado com sucesso');
    } catch (error) {
      console.error('[Scheduler] Erro ao gerar digest diário:', error);
    }
  }

  // Gerar digest semanal
  private async generateWeeklyDigest(): Promise<void> {
    const companyFilter = process.env.SCHEDULER_COMPANY_FILTER || '*';
    console.log(`[Scheduler] Gerando digest semanal para empresas: ${companyFilter}`);

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
      console.log('[Scheduler] Digest semanal gerado com sucesso');
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

  // Método para executar digest diário manual
  async runManualDailyDigest(): Promise<void> {
    console.log('[Scheduler] Executando digest diário manual...');
    await this.generateDailyDigest();
  }

  // Método para executar digest semanal manual
  async runManualWeeklyDigest(): Promise<void> {
    console.log('[Scheduler] Executando digest semanal manual...');
    await this.generateWeeklyDigest();
  }

  // Verificar se o agendador está rodando
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const schedulerService = new SchedulerService(); 