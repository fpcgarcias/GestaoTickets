/**
 * Utilitário para cálculo de SLA considerando horário comercial
 * Horário comercial: 8h às 18h, segunda a sexta-feira
 */

import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';

export interface SLAResult {
  timeElapsed: number; // Tempo já consumido em milissegundos
  timeRemaining: number; // Tempo restante em milissegundos
  percentConsumed: number; // Porcentagem consumida (0-100)
  isBreached: boolean; // Se o SLA foi violado
  dueDate: Date; // Data/hora de vencimento do SLA
  status: 'ok' | 'warning' | 'critical' | 'breached';
  isPaused: boolean; // Se o SLA está pausado no momento
}

export interface BusinessHours {
  startHour: number; // Hora de início (ex: 8)
  endHour: number; // Hora de fim (ex: 18)
  workDays: number[]; // Dias da semana (0=domingo, 1=segunda, ..., 6=sábado)
}

export interface StatusPeriod {
  status: TicketStatus;
  startTime: Date;
  endTime: Date;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  startHour: 8,
  endHour: 17,
  workDays: [1, 2, 3, 4, 5] // Segunda a sexta
};

/**
 * Função para debug - testa se o cálculo de horário comercial está funcionando
 */
export function testBusinessHoursCalculation(): void {
  console.log('=== TESTE DE HORÁRIO COMERCIAL ===');
  
  // Teste 1: Sexta 17h00 até Segunda 9h00 (deve contar apenas 1h da sexta)
  const friday17 = new Date(2024, 0, 5, 17, 0, 0); // 5 de janeiro 2024, sexta-feira 17h
  const monday9 = new Date(2024, 0, 8, 9, 0, 0);   // 8 de janeiro 2024, segunda-feira 9h
  const businessTime1 = calculateBusinessTimeMs(friday17, monday9);
  console.log(`Sexta 17h até Segunda 9h: ${businessTime1 / (1000 * 60 * 60)}h (deve ser 2h - 1h da sexta + 1h da segunda)`);
  
  // Teste 2: Dentro do horário comercial
  const monday8 = new Date(2024, 0, 8, 8, 0, 0);   // Segunda 8h
  const monday10 = new Date(2024, 0, 8, 10, 0, 0); // Segunda 10h
  const businessTime2 = calculateBusinessTimeMs(monday8, monday10);
  console.log(`Segunda 8h até Segunda 10h: ${businessTime2 / (1000 * 60 * 60)}h (deve ser 2h)`);
  
  // Teste 3: Fora do horário comercial
  const saturday = new Date(2024, 0, 6, 10, 0, 0); // Sábado 10h
  const sunday = new Date(2024, 0, 7, 15, 0, 0);   // Domingo 15h
  const businessTime3 = calculateBusinessTimeMs(saturday, sunday);
  console.log(`Sábado 10h até Domingo 15h: ${businessTime3 / (1000 * 60 * 60)}h (deve ser 0h)`);
  
  console.log('=== FIM DO TESTE ===');
}

/**
 * Verifica se uma data/hora está dentro do horário comercial
 */
function isBusinessHour(date: Date, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): boolean {
  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  
  return businessHours.workDays.includes(dayOfWeek) && 
         hour >= businessHours.startHour && 
         hour < businessHours.endHour;
}

/**
 * Calcula o próximo horário comercial a partir de uma data
 */
function getNextBusinessHour(date: Date, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): Date {
  const nextDate = new Date(date);
  
  // Se já estamos em horário comercial, retorna a própria data
  if (isBusinessHour(nextDate, businessHours)) {
    return nextDate;
  }
  
  const currentDay = nextDate.getDay();
  const currentHour = nextDate.getHours();
  
  // Se estamos em um dia útil mas fora do horário
  if (businessHours.workDays.includes(currentDay)) {
    if (currentHour < businessHours.startHour) {
      // Antes do horário comercial - ir para o início do dia
      nextDate.setHours(businessHours.startHour, 0, 0, 0);
      return nextDate;
    } else {
      // Depois do horário comercial - ir para o próximo dia útil
      nextDate.setDate(nextDate.getDate() + 1);
      nextDate.setHours(businessHours.startHour, 0, 0, 0);
    }
  } else {
    // Fim de semana ou dia não útil - ir para o próximo dia útil
    nextDate.setHours(businessHours.startHour, 0, 0, 0);
  }
  
  // Encontrar o próximo dia útil
  while (!businessHours.workDays.includes(nextDate.getDay())) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return nextDate;
}

/**
 * Calcula o tempo em milissegundos entre duas datas considerando apenas horário comercial
 */
function calculateBusinessTimeMs(startDate: Date, endDate: Date, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): number {
  if (startDate >= endDate) return 0;
  
  let totalBusinessTime = 0;
  const current = new Date(startDate);
  
  let dayCount = 0;
  const maxDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 2;
  
  while (current < endDate && dayCount < maxDays) {
    const currentDay = current.getDay();
    
    if (businessHours.workDays.includes(currentDay)) {
      const dayStart = new Date(current);
      dayStart.setHours(businessHours.startHour, 0, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setHours(businessHours.endHour, 0, 0, 0);
      
      const effectiveStart = current > dayStart ? current : dayStart;
      const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
      
      if (effectiveStart < effectiveEnd) {
        const dayTime = effectiveEnd.getTime() - effectiveStart.getTime();
        totalBusinessTime += dayTime;
      }
    }
    
    // Ir para o próximo dia
    current.setDate(current.getDate() + 1);
    current.setHours(businessHours.startHour, 0, 0, 0);
    dayCount++;
  }
  
  return totalBusinessTime;
}

/**
 * Adiciona tempo de horário comercial a uma data
 */
export function addBusinessTime(startDate: Date, businessHoursToAdd: number, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): Date {
  const msToAdd = businessHoursToAdd * 60 * 60 * 1000;
  let remainingMs = msToAdd;
  const current = getNextBusinessHour(startDate, businessHours);
  
  while (remainingMs > 0) {
    const currentDay = current.getDay();
    
    // Se é um dia útil
    if (businessHours.workDays.includes(currentDay)) {
      const dayEnd = new Date(current);
      dayEnd.setHours(businessHours.endHour, 0, 0, 0);
      
      // Tempo disponível no dia atual
      const timeLeftInDay = dayEnd.getTime() - current.getTime();
      
      if (remainingMs <= timeLeftInDay) {
        // Todo o tempo restante cabe no dia atual
        current.setTime(current.getTime() + remainingMs);
        remainingMs = 0;
      } else {
        // Não cabe no dia atual, usar todo o tempo do dia e ir para o próximo
        remainingMs -= timeLeftInDay;
        current.setDate(current.getDate() + 1);
        current.setHours(businessHours.startHour, 0, 0, 0);
        
        // Pular fins de semana
        while (!businessHours.workDays.includes(current.getDay())) {
          current.setDate(current.getDate() + 1);
        }
      }
    } else {
      // Dia não útil, ir para o próximo dia útil
      current.setDate(current.getDate() + 1);
      current.setHours(businessHours.startHour, 0, 0, 0);
    }
  }
  
  return current;
}

/**
 * Calcula tempo de SLA efetivo considerando períodos pausados
 */
export function calculateEffectiveBusinessTime(
  ticketCreatedAt: Date,
  currentTime: Date,
  statusPeriods: StatusPeriod[],
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS
): number {
  let totalEffectiveTime = 0;
  let lastActiveEnd = ticketCreatedAt;
  
  // Se não há histórico de status, considerar tempo total como ativo
  if (statusPeriods.length === 0) {
    const simpleTime = calculateBusinessTimeMs(ticketCreatedAt, currentTime, businessHours);
    return simpleTime;
  }
  
  // Processar períodos históricos
  for (const period of statusPeriods) {
    const periodStart = new Date(period.startTime);
    const periodEnd = new Date(period.endTime);
    
    // Se o status NÃO pausa o SLA E NÃO finaliza o SLA, contar o tempo
    if (!isSlaPaused(period.status) && !isSlaFinished(period.status)) {
      // Garantir que começamos do fim do último período ativo ou criação do ticket
      const effectiveStart = periodStart > lastActiveEnd ? periodStart : lastActiveEnd;
      
      if (effectiveStart < periodEnd) {
        const periodTime = calculateBusinessTimeMs(effectiveStart, periodEnd, businessHours);
        totalEffectiveTime += periodTime;
        lastActiveEnd = periodEnd;
      }
    }
  }
  
  // CORREÇÃO: Calcular período atual (do último período até agora) apenas se necessário
  // Se temos histórico, o último período pode não cobrir até o tempo atual
  const lastPeriod = statusPeriods[statusPeriods.length - 1];
  
  if (lastPeriod) {
    const lastPeriodEnd = new Date(lastPeriod.endTime);
    
    // Se há um gap entre o último período e o tempo atual, 
    // assumir que continua com o último status
    if (lastPeriodEnd < currentTime) {
      // Se o último status não pausa o SLA E não finaliza o SLA, adicionar o tempo restante
      if (!isSlaPaused(lastPeriod.status) && !isSlaFinished(lastPeriod.status)) {
        const finalPeriodTime = calculateBusinessTimeMs(lastPeriodEnd, currentTime, businessHours);
        totalEffectiveTime += finalPeriodTime;
      }
    }
  } else {
    // Se não há períodos mas chegamos aqui, algo está errado
    // Usar cálculo simples como fallback
    return calculateBusinessTimeMs(ticketCreatedAt, currentTime, businessHours);
  }
  
  return totalEffectiveTime;
}

/**
 * Calcula o status do SLA para um ticket considerando histórico de status
 */
export function calculateSLAStatus(
  ticketCreatedAt: Date,
  slaHours: number,
  currentTime: Date = new Date(),
  resolvedAt?: Date,
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  statusPeriods: StatusPeriod[] = [],
  currentStatus: TicketStatus = 'new'
): SLAResult {
  // Se já foi resolvido, calcular baseado na data de resolução
  const isResolved = !!resolvedAt || isSlaFinished(currentStatus);
  let effectiveEndTime = currentTime;
  
  if (isResolved) {
    if (resolvedAt) {
      effectiveEndTime = resolvedAt;
    } else if (statusPeriods.length > 0) {
      // Se não temos resolvedAt, mas temos histórico, usar o último período
      const lastPeriod = statusPeriods[statusPeriods.length - 1];
      effectiveEndTime = lastPeriod.endTime;
    }
  }
  
  const isPaused = !isResolved && isSlaPaused(currentStatus);
  
  // Calcular a data de vencimento do SLA
  const dueDate = addBusinessTime(ticketCreatedAt, slaHours, businessHours);
  
  // CORREÇÃO: Sempre usar cálculo de horário comercial
  let timeElapsed: number;
  
  if (statusPeriods.length > 0) {
    // Se há histórico de status, usar cálculo com períodos
    timeElapsed = calculateEffectiveBusinessTime(ticketCreatedAt, effectiveEndTime, statusPeriods, businessHours);
  } else {
    // Se não há histórico, usar cálculo simples MAS sempre respeitando horário comercial
    // NUNCA usar tempo total - sempre usar calculateBusinessTimeMs
    timeElapsed = calculateBusinessTimeMs(ticketCreatedAt, effectiveEndTime, businessHours);
  }
  
  // Tempo total do SLA em milissegundos
  const totalSlaMs = slaHours * 60 * 60 * 1000;
  
  // Tempo restante
  const timeRemaining = Math.max(0, totalSlaMs - timeElapsed);
  
  // Porcentagem consumida
  const percentConsumed = Math.min(100, (timeElapsed / totalSlaMs) * 100);
  
  // Verificar se foi violado
  const isBreached = timeElapsed > totalSlaMs;
  
  // Determinar status
  let status: SLAResult['status'] = 'ok';
  if (isBreached) {
    status = 'breached';
  } else if (percentConsumed >= 90) {
    status = 'critical';
  } else if (percentConsumed >= 75) {
    status = 'warning';
  }
  
  const result = {
    timeElapsed,
    timeRemaining,
    percentConsumed: Math.round(percentConsumed),
    isBreached,
    dueDate,
    status,
    isPaused
  };
  
  return result;
}

/**
 * Formata tempo em milissegundos para texto legível
 */
export function formatTimeRemaining(timeMs: number, isBreached: boolean = false): string {
  if (timeMs <= 0) {
    return isBreached ? 'SLA excedido' : 'Vencido';
  }
  
  const hours = Math.floor(timeMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Obter configuração de horário comercial (futuramente pode vir do banco)
 */
export function getBusinessHoursConfig(): BusinessHours {
  return DEFAULT_BUSINESS_HOURS;
}

/**
 * Converte histórico de status do banco para períodos de status para cálculo de SLA
 */
export function convertStatusHistoryToPeriods(
  ticketCreatedAt: Date,
  currentStatus: TicketStatus,
  statusHistory: unknown[]
): StatusPeriod[] {
  const periods: StatusPeriod[] = [];
  
  // Filtrar apenas mudanças de status (não prioridade)
  const statusChanges = statusHistory
    .filter(h => h.change_type === 'status')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  let currentPeriodStart = ticketCreatedAt;
  let currentPeriodStatus: TicketStatus = 'new'; // Status inicial
  
  // Processar cada mudança de status
  for (const change of statusChanges) {
    const changeTime = new Date(change.created_at);
    
    // Finalizar período anterior
    if (currentPeriodStart < changeTime) {
      const period = {
        status: currentPeriodStatus,
        startTime: currentPeriodStart,
        endTime: changeTime
      };
      periods.push(period);
    }
    
    // Iniciar novo período
    currentPeriodStart = changeTime;
    currentPeriodStatus = (change.new_status || currentPeriodStatus) as TicketStatus;
  }
  
  // CORREÇÃO: Para o período final, NÃO adicionar automaticamente até "agora"
  // Isso será feito na função principal calculateSLAStatus com o parâmetro currentTime correto
  
  // Só adicionar período final se há mudanças de status E o ticket está resolvido
  if (statusChanges.length > 0 && isSlaFinished(currentStatus)) {
    const lastStatusChange = statusChanges[statusChanges.length - 1];
    const finalEndTime = new Date(lastStatusChange.created_at);
    
    if (currentPeriodStart < finalEndTime) {
      const finalPeriod = {
        status: currentPeriodStatus,
        startTime: currentPeriodStart,
        endTime: finalEndTime
      };
      periods.push(finalPeriod);
    }
  }
  
  return periods;
}

/**
 * Função de teste completo do sistema de SLA
 */
export function testSLASystem(): void {
  console.log('=== TESTE COMPLETO DO SISTEMA SLA ===');
  
  // Cenário 1: Ticket criado na sexta às 16h, deve pausar no fim de semana
  console.log('\n--- Cenário 1: Ticket criado sexta 16h ---');
  const friday16 = new Date(2024, 0, 5, 16, 0, 0); // 5 de janeiro 2024, sexta-feira 16h
  const monday10 = new Date(2024, 0, 8, 10, 0, 0); // 8 de janeiro 2024, segunda-feira 10h
  
  calculateSLAStatus(
    friday16, 
    4, // 4 horas de SLA
    monday10,
    undefined, // não resolvido
    DEFAULT_BUSINESS_HOURS,
    [], // sem histórico
    'new'
  );
  
  console.log('Resultado esperado: 4h consumidas (2h sexta + 2h segunda), SLA no limite');
  
  // Cenário 2: Ticket com status pausado (escalated)
  console.log('\n--- Cenário 2: Ticket escalado (SLA pausado) ---');
  const monday8 = new Date(2024, 0, 8, 8, 0, 0);   // Segunda 8h
  const monday12 = new Date(2024, 0, 8, 12, 0, 0); // Segunda 12h
  
  const statusPeriods: StatusPeriod[] = [
    {
      status: 'new',
      startTime: monday8,
      endTime: new Date(2024, 0, 8, 9, 0, 0) // 1h ativo
    },
    {
      status: 'escalated', // pausado
      startTime: new Date(2024, 0, 8, 9, 0, 0),
      endTime: new Date(2024, 0, 8, 11, 0, 0) // 2h pausado
    },
    {
      status: 'ongoing',
      startTime: new Date(2024, 0, 8, 11, 0, 0),
      endTime: monday12 // 1h ativo
    }
  ];
  
  calculateSLAStatus(
    monday8,
    4, // 4 horas de SLA
    monday12,
    undefined,
    DEFAULT_BUSINESS_HOURS,
    statusPeriods,
    'ongoing'
  );
  
  console.log('Resultado esperado: 2h consumidas (escalated pausou por 2h), SLA ok');
  
  // Cenário 3: Ticket resolvido fora do horário comercial
  console.log('\n--- Cenário 3: Ticket resolvido às 20h ---');
  const tuesday8 = new Date(2024, 0, 9, 8, 0, 0);  // Terça 8h
  const tuesday20 = new Date(2024, 0, 9, 20, 0, 0); // Terça 20h (fora do horário)
  
  calculateSLAStatus(
    tuesday8,
    8, // 8 horas de SLA
    tuesday20,
    new Date(2024, 0, 9, 19, 0, 0), // resolvido às 19h
    DEFAULT_BUSINESS_HOURS,
    [],
    'resolved'
  );
  
  console.log('Resultado esperado: 10h consumidas (8h-18h), SLA ok');
  
  console.log('\n=== FIM DO TESTE COMPLETO ===');
}

/**
 * Função para teste rápido - pode ser executada no console
 * Para testar: import { quickSLATest } from '@shared/utils/sla-calculator'; quickSLATest();
 */
export function quickSLATest(): boolean {
  console.log('🔍 Testando sistema de SLA...');
  
  try {
    // Teste 1: Horário comercial
    const monday8 = new Date(2024, 0, 8, 8, 0, 0);   // Segunda 8h
    const monday10 = new Date(2024, 0, 8, 10, 0, 0); // Segunda 10h
    const businessTime = calculateBusinessTimeMs(monday8, monday10);
    const expectedTime = 2 * 60 * 60 * 1000; // 2 horas em ms
    
    if (Math.abs(businessTime - expectedTime) > 1000) {
      console.error('❌ Falha no teste de horário comercial');
      return false;
    }
    
    // Teste 2: Status pausado
    const statusPeriods: StatusPeriod[] = [
      { status: 'new', startTime: monday8, endTime: new Date(2024, 0, 8, 9, 0, 0) },
      { status: 'escalated', startTime: new Date(2024, 0, 8, 9, 0, 0), endTime: monday10 }
    ];
    
    const slaResult = calculateSLAStatus(monday8, 4, monday10, undefined, DEFAULT_BUSINESS_HOURS, statusPeriods, 'escalated');
    
    if (!slaResult.isPaused) {
      console.error('❌ Falha no teste de status pausado');
      return false;
    }
    
    console.log('✅ Todos os testes passaram!');
    console.log('📊 Resultados:');
    console.log(`   - Horário comercial: ${businessTime / (1000 * 60 * 60)}h calculadas`);
    console.log(`   - Status escalated pausa SLA: ${slaResult.isPaused ? 'SIM' : 'NÃO'}`);
    console.log(`   - Configuração: 8h às 18h, segunda a sexta`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    return false;
  }
}

/**
 * Teste específico para o bug reportado
 */
export function testBugScenario(): void {
  console.log('🐛 Testando cenário com bug reportado...');
  
  // Dados do chamado com problema:
  // Criado: 02/07/2025 às 17:13
  // Atual: provavelmente 03/07/2025 às 09:45
  
  const ticketCreated = new Date(2025, 6, 2, 17, 13, 0); // 02/07/2025 17:13
  const currentTime = new Date(2025, 6, 3, 9, 45, 0);   // 03/07/2025 09:45
  
  console.log('📅 Dados do teste:');
  console.log(`   Criado: ${ticketCreated.toISOString()} (${ticketCreated.toLocaleDateString('pt-BR')} ${ticketCreated.toLocaleTimeString('pt-BR')})`);
  console.log(`   Atual:  ${currentTime.toISOString()} (${currentTime.toLocaleDateString('pt-BR')} ${currentTime.toLocaleTimeString('pt-BR')})`);
  console.log(`   Dia da semana criação: ${ticketCreated.getDay()} (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab)`);
  console.log(`   Dia da semana atual: ${currentTime.getDay()}`);
  
  // Calcular tempo de negócio manualmente
  const businessTime = calculateBusinessTimeMs(ticketCreated, currentTime);
  console.log(`⏱️  Tempo comercial calculado: ${businessTime / (1000 * 60 * 60)} horas`);
  
  // Calcular SLA (assumindo 4h para crítico)
  const slaResult = calculateSLAStatus(
    ticketCreated,
    4, // 4 horas de SLA para crítico
    currentTime,
    undefined, // não resolvido
    DEFAULT_BUSINESS_HOURS,
    [], // sem histórico de status por enquanto
    'new'
  );
  
  console.log('📊 Resultado SLA:');
  console.log(`   Tempo consumido: ${slaResult.timeElapsed / (1000 * 60 * 60)} horas`);
  console.log(`   Tempo restante: ${slaResult.timeRemaining / (1000 * 60 * 60)} horas`);
  console.log(`   Porcentagem: ${slaResult.percentConsumed}%`);
  console.log(`   Status: ${slaResult.status}`);
  console.log(`   Excedido: ${slaResult.isBreached}`);
  console.log(`   Data vencimento: ${slaResult.dueDate.toISOString()}`);
  
  // Cálculo esperado:
  // 02/07 17:13 até 18:00 = 47 minutos
  // 03/07 08:00 até 09:45 = 1h45
  // Total esperado: 2h32 aproximadamente
  
  console.log('🎯 Resultado esperado: ~2.5 horas consumidas, SLA ok');
} 