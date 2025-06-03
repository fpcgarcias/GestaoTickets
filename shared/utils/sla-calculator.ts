/**
 * Utilitário para cálculo de SLA considerando horário comercial
 * Horário comercial: 8h às 18h, segunda a sexta-feira
 */

import { isSlaPaused, isSlaFinished, shouldRestartSla, type TicketStatus } from '@shared/ticket-utils';

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
  endHour: 18,
  workDays: [1, 2, 3, 4, 5] // Segunda a sexta
};

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
  const dailyBusinessHours = businessHours.endHour - businessHours.startHour;
  const dailyBusinessMs = dailyBusinessHours * 60 * 60 * 1000;
  
  while (current < endDate) {
    const currentDay = current.getDay();
    
    // Se é um dia útil
    if (businessHours.workDays.includes(currentDay)) {
      const dayStart = new Date(current);
      dayStart.setHours(businessHours.startHour, 0, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setHours(businessHours.endHour, 0, 0, 0);
      
      // Determinar o início efetivo (maior entre current e início do dia)
      const effectiveStart = current > dayStart ? current : dayStart;
      
      // Determinar o fim efetivo (menor entre endDate e fim do dia)
      const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
      
      // Se há sobreposição no dia atual
      if (effectiveStart < effectiveEnd) {
        totalBusinessTime += effectiveEnd.getTime() - effectiveStart.getTime();
      }
    }
    
    // Ir para o próximo dia
    current.setDate(current.getDate() + 1);
    current.setHours(businessHours.startHour, 0, 0, 0);
  }
  
  return totalBusinessTime;
}

/**
 * Adiciona tempo de horário comercial a uma data
 */
function addBusinessTime(startDate: Date, businessHoursToAdd: number, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): Date {
  const msToAdd = businessHoursToAdd * 60 * 60 * 1000;
  let remainingMs = msToAdd;
  let current = getNextBusinessHour(startDate, businessHours);
  
  const dailyBusinessHours = businessHours.endHour - businessHours.startHour;
  const dailyBusinessMs = dailyBusinessHours * 60 * 60 * 1000;
  
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
function calculateEffectiveBusinessTime(
  ticketCreatedAt: Date,
  currentTime: Date,
  statusPeriods: StatusPeriod[],
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS
): number {
  let totalEffectiveTime = 0;
  let lastActiveEnd = ticketCreatedAt;
  
  // Se não há histórico de status, considerar tempo total como ativo
  if (statusPeriods.length === 0) {
    return calculateBusinessTimeMs(ticketCreatedAt, currentTime, businessHours);
  }
  
  for (const period of statusPeriods) {
    const periodStart = new Date(period.startTime);
    const periodEnd = new Date(period.endTime);
    
    // Se o status NÃO pausa o SLA, contar o tempo
    if (!isSlaPaused(period.status)) {
      // Garantir que começamos do fim do último período ativo ou criação do ticket
      const effectiveStart = periodStart > lastActiveEnd ? periodStart : lastActiveEnd;
      
      if (effectiveStart < periodEnd) {
        totalEffectiveTime += calculateBusinessTimeMs(effectiveStart, periodEnd, businessHours);
        lastActiveEnd = periodEnd;
      }
    }
  }
  
  // Se o período atual (do último status até agora) está ativo, adicionar
  const lastPeriod = statusPeriods[statusPeriods.length - 1];
  if (lastPeriod && !isSlaPaused(lastPeriod.status)) {
    const lastPeriodEnd = new Date(lastPeriod.endTime);
    if (lastPeriodEnd < currentTime) {
      totalEffectiveTime += calculateBusinessTimeMs(lastPeriodEnd, currentTime, businessHours);
    }
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
  const effectiveEndTime = resolvedAt || currentTime;
  const isResolved = !!resolvedAt || isSlaFinished(currentStatus);
  const isPaused = !isResolved && isSlaPaused(currentStatus);
  
  // Calcular a data de vencimento do SLA
  const dueDate = addBusinessTime(ticketCreatedAt, slaHours, businessHours);
  
  // Calcular tempo decorrido considerando pausas
  let timeElapsed: number;
  if (statusPeriods.length > 0) {
    timeElapsed = calculateEffectiveBusinessTime(ticketCreatedAt, effectiveEndTime, statusPeriods, businessHours);
  } else {
    // Fallback: calcular tempo simples se não há histórico
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
  
  return {
    timeElapsed,
    timeRemaining,
    percentConsumed: Math.round(percentConsumed),
    isBreached,
    dueDate,
    status,
    isPaused
  };
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