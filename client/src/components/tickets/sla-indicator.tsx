import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, CheckCircle, Pause, Target } from 'lucide-react';
import { calculateSLAStatus, formatTimeRemaining, getBusinessHoursConfig, convertStatusHistoryToPeriods } from '@shared/utils/sla-calculator';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';
import { useTicketWithSLA } from '@/hooks/use-sla';
import { Badge } from '../ui/badge';
import { useI18n } from '@/i18n';
import { useSLAFormatting } from '@/lib/sla-utils';

interface SLAIndicatorProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: TicketStatus;
  ticketCompanyId: number;
  ticketId: number;
  resolvedAt?: string;
  // Novos campos para o sistema flexível de SLA
  departmentId?: number;
  incidentTypeId?: number;
  categoryId?: number;
  firstResponseAt?: string;
  className?: string;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({ 
  ticketCreatedAt, 
  ticketPriority,
  ticketStatus,
  ticketCompanyId,
  ticketId,
  resolvedAt,
  departmentId,
  incidentTypeId,
  categoryId,
  firstResponseAt,
  className = ""
}) => {
  const { formatMessage } = useI18n();
  const { formatTimeRemaining: formatTimeRemainingTranslated } = useSLAFormatting();
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [_percentConsumed, setPercentConsumed] = useState<number>(0);
  const [_slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'critical' | 'breached'>('ok');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [useNewSLA, setUseNewSLA] = useState<boolean>(false);

  // Tentar usar o novo sistema de SLA primeiro
  const ticketSLAInfo = useTicketWithSLA(
    ticketId,
    ticketCompanyId,
    departmentId,
    incidentTypeId,
    categoryId,
    ticketPriority,
    ticketCreatedAt,
    firstResponseAt,
    resolvedAt,
    ticketStatus
  );

  // Fallback para o sistema antigo
  const { data: slaSettingsData, isLoading: isOldSLALoading, error: oldSLAError } = useQuery({
    queryKey: ["/api/settings/sla", ticketCompanyId],
    queryFn: async () => {
      const url = `/api/settings/sla?company_id=${ticketCompanyId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao buscar SLA: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!ticketCompanyId, // Sempre buscar configurações SLA antigas como fallback
  });
  
  const { data: statusHistory } = useQuery({
    queryKey: [`/api/tickets/${ticketId}/status-history`],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${ticketId}/status-history`);
      if (!response.ok) {
        throw new Error('Erro ao buscar histórico de status');
      }
      return response.json();
    },
    enabled: !!ticketId, // Sempre buscar histórico para cálculos precisos
    staleTime: 30 * 1000,
  });
  
  useEffect(() => {
    // 🔥 CRÍTICO: Se o ticket está resolvido, NÃO fazer nenhum cálculo de SLA
    if (isSlaFinished(ticketStatus)) {
      // Removido log de debug
      return;
    }

    // 🔥 CRÍTICO: Se o ticket NÃO está mais "new", significa que já foi respondido
    // Só deve calcular SLA de resolução, NÃO de primeira resposta
    if (ticketStatus !== 'new' && !firstResponseAt) {
      // Removido log de debug
    }

    // Removido log de debug geral

    // Primeiro, tentar usar o novo sistema de SLA
    if (ticketSLAInfo) {
      setUseNewSLA(true);
      const { status } = ticketSLAInfo;
      
      // Verificar se o SLA está pausado ou finalizado
      const slaIsPaused = isSlaPaused(ticketStatus);
      const slaIsFinished = isSlaFinished(ticketStatus);
      setIsPaused(slaIsPaused);
      
      if (slaIsFinished) return;
      
      if (slaIsPaused) {
        setTimeRemaining(formatMessage('tickets.sla.paused'));
        setSlaStatus('warning');
      } else if (status.isResolutionOverdue) {
        setTimeRemaining(formatTimeRemainingTranslated(status.resolutionTimeRemaining));
        setSlaStatus('breached');
      } else {
        setTimeRemaining(formatTimeRemainingTranslated(status.resolutionTimeRemaining));
        
        // Determinar status baseado no tempo restante
        if (status.resolutionTimeRemaining < 2) {
          setSlaStatus('critical');
        } else if (status.resolutionTimeRemaining < 8) {
          setSlaStatus('warning');
        } else {
          setSlaStatus('ok');
        }
      }
      
      return;
    }

    // Fallback para o sistema antigo
    if (isOldSLALoading || oldSLAError || !slaSettingsData || !ticketCreatedAt) return;
    
    // Verificar se o SLA está pausado ou finalizado
    const slaIsPaused = isSlaPaused(ticketStatus);
    const slaIsFinished = isSlaFinished(ticketStatus);
    setIsPaused(slaIsPaused);
    
    if (slaIsFinished) return;
    
    try {
      // Encontrar a configuração de SLA para a prioridade deste ticket
      let resolutionTimeHours: number;
      
      if (slaSettingsData && typeof slaSettingsData === 'object' && 'settings' in slaSettingsData) {
        // Formato novo da API - procurar por match case-insensitive
        const settings = (slaSettingsData as any).settings;
        const slaSetting = Object.keys(settings).reduce((found: any, key) => {
          if (found) return found;
          return key.toLowerCase() === ticketPriority.toLowerCase() ? settings[key] : null;
        }, null as any);
        
        if (!slaSetting || !slaSetting.resolution_time_hours) {
          // Se não encontrar configuração específica, usar valores padrão baseados na prioridade
          const defaultSLAs = {
            'critical': 4,
            'high': 8, 
            'medium': 24,
            'low': 48,
            'crítica': 4,
            'alta': 8,
            'média': 24,
            'baixa': 48
          };
          const priorityKey = ticketPriority.toLowerCase();
          resolutionTimeHours = defaultSLAs[priorityKey as keyof typeof defaultSLAs] || 24;
        } else {
          resolutionTimeHours = slaSetting.resolution_time_hours;
        }
      } else {
        // Formato antigo (array)
        const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
        const slaSetting = slaSettings.find((s: any) => s.priority?.toLowerCase() === ticketPriority.toLowerCase());
        if (!slaSetting) {
          // Se não encontrar configuração específica, usar valores padrão baseados na prioridade
          const defaultSLAs = {
            'critical': 4,
            'high': 8, 
            'medium': 24,
            'low': 48,
            'crítica': 4,
            'alta': 8,
            'média': 24,
            'baixa': 48
          };
          const priorityKey = ticketPriority.toLowerCase();
          resolutionTimeHours = defaultSLAs[priorityKey as keyof typeof defaultSLAs] || 24;
        } else {
          resolutionTimeHours = slaSetting.resolutionTimeHours || slaSetting.resolution_time_hours || 24;
        }
      }
      
      // Converter datas
      const createdDate = new Date(ticketCreatedAt);
      const resolvedDate = resolvedAt ? new Date(resolvedAt) : undefined;
      
      if (isNaN(createdDate.getTime())) {
        console.error("Data de criação inválida:", ticketCreatedAt);
        return;
      }
      
      // Converter histórico de status para períodos (se disponível)
      let statusPeriods: any[] = [];
      if (statusHistory && Array.isArray(statusHistory)) {
        try {
          statusPeriods = convertStatusHistoryToPeriods(
            createdDate,
            ticketStatus,
            statusHistory
          );
        } catch (historyError) {
          console.warn('Erro ao processar histórico de status:', historyError);
          statusPeriods = [];
        }
      }
      
      // Calcular SLA usando o novo sistema com histórico
      const businessHours = getBusinessHoursConfig();
      const slaResult = calculateSLAStatus(
        createdDate,
        resolutionTimeHours,
        new Date(),
        resolvedDate,
        businessHours,
        statusPeriods,
        ticketStatus
      );
      
      setPercentConsumed(slaResult.percentConsumed);
      setSlaStatus(slaResult.status);
      
      // Formatar texto baseado no status
      if (slaIsPaused) {
        setTimeRemaining('SLA pausado');
      } else if (slaResult.isBreached) {
        const overdueTime = formatTimeRemaining(slaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
        setTimeRemaining(`Excedido em ${overdueTime}`);
      } else {
        const _remainingTime = formatTimeRemaining(slaResult.timeRemaining);
        setTimeRemaining(formatTimeRemainingTranslated(slaResult.timeRemaining / (60 * 60 * 1000)));
      }
      
    } catch (calcError) {
      console.error("Erro no cálculo de SLA:", calcError);
    }
  }, [ticketSLAInfo, slaSettingsData, isOldSLALoading, oldSLAError, ticketCreatedAt, ticketPriority, ticketStatus, ticketCompanyId, ticketId, resolvedAt, statusHistory]);
  
  if (isSlaFinished(ticketStatus)) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3 text-emerald-400" />
        <span className="text-emerald-400">{formatMessage('tickets.sla.resolved')}</span>
      </div>
    );
  }

  // Loading state - mostrar apenas se estiver carregando e não tiver informação de SLA ainda
  if ((isOldSLALoading && !ticketSLAInfo) || (!useNewSLA && !slaSettingsData && isOldSLALoading)) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Clock className="w-4 h-4" />
        <span className="text-sm">{formatMessage('tickets.sla.loading')}</span>
      </div>
    );
  }

  // Error state - mostrar informação útil mesmo se houver erro
  if (!ticketSLAInfo && !useNewSLA && (oldSLAError || !slaSettingsData) && !timeRemaining) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertTriangle className="w-4 h-4 text-muted-foreground/80" />
        <span className="text-sm text-muted-foreground">{formatMessage('tickets.sla.not_configured')}</span>
      </div>
    );
  }
  
  // Se o SLA está pausado, mostrar indicador específico
  if (isPaused) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <Pause className="h-3 w-3 text-amber-500 dark:text-amber-300" />
        <span className="text-amber-500 dark:text-amber-300">{formatMessage('tickets.sla.paused')}</span>
      </div>
    );
  }
  
  // Se não tiver timeRemaining ainda, mostrar algo útil
  const displayText = timeRemaining || 'Calculando SLA...';

  // 🔥 NOVA LÓGICA: Mostrar primeira resposta se status='new', senão mostrar resolução
  if (ticketStatus === 'new' && ticketSLAInfo) {
    const { status } = ticketSLAInfo;
    const responseTimeText = status.isResponseOverdue 
      ? formatTimeRemainingTranslated(status.responseTimeRemaining)
      : formatTimeRemainingTranslated(status.responseTimeRemaining);
    
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Badge variant="outline" className="flex items-center gap-1 w-fit border-border text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="text-xs">{formatMessage('tickets.sla.response')}: {responseTimeText}</span>
        </Badge>
      </div>
    );
  }

  // Para outros status, mostrar tempo de resolução
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Badge variant="outline" className="flex items-center gap-1 w-fit border-border text-muted-foreground">
        <Target className="w-3 h-3" />
        <span className="text-xs">{formatMessage('tickets.sla.resolution')}: {displayText}</span>
      </Badge>
    </div>
  );
};

