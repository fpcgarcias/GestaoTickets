import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, CheckCircle, Pause } from 'lucide-react';
import { calculateSLAStatus, formatTimeRemaining, getBusinessHoursConfig, convertStatusHistoryToPeriods } from '@shared/utils/sla-calculator';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';

interface SLAIndicatorProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: TicketStatus;
  ticketCompanyId: number;
  ticketId: number;
  resolvedAt?: string;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({ 
  ticketCreatedAt, 
  ticketPriority,
  ticketStatus,
  ticketCompanyId,
  ticketId,
  resolvedAt
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [percentConsumed, setPercentConsumed] = useState<number>(0);
  const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'critical' | 'breached'>('ok');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  const { data: slaSettingsData, isLoading, error } = useQuery({
    queryKey: ["/api/settings/sla", ticketCompanyId],
    queryFn: async () => {
      const url = `/api/settings/sla?company_id=${ticketCompanyId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao buscar SLA: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!ticketCompanyId,
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
    enabled: !!ticketId,
    staleTime: 30 * 1000,
  });
  
  useEffect(() => {
    console.log('SLAIndicator - Debug data:', {
      slaSettingsData,
      isLoading,
      error,
      ticketCreatedAt,
      ticketPriority,
      ticketStatus,
      ticketCompanyId,
      ticketId,
      resolvedAt,
      statusHistory
    });
    
    if (isLoading || error || !slaSettingsData || !ticketCreatedAt) return;
    
    // Verificar se o SLA está pausado ou finalizado
    const slaIsPaused = isSlaPaused(ticketStatus);
    const slaIsFinished = isSlaFinished(ticketStatus);
    setIsPaused(slaIsPaused);
    
    if (slaIsFinished) return;
    
    try {
      // Encontrar a configuração de SLA para a prioridade deste ticket
      let resolutionTimeHours: number;
      
      if (slaSettingsData && typeof slaSettingsData === 'object' && 'settings' in slaSettingsData) {
        // Formato novo da API
        const slaSetting = (slaSettingsData as any).settings[ticketPriority];
        console.log('SLAIndicator - SLA setting found:', slaSetting);
        if (!slaSetting || !slaSetting.resolution_time_hours) return;
        resolutionTimeHours = slaSetting.resolution_time_hours;
      } else {
        // Formato antigo (array)
        const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
        const slaSetting = slaSettings.find((s: any) => s.priority === ticketPriority);
        console.log('SLAIndicator - SLA setting found (legacy):', slaSetting);
        if (!slaSetting) return;
        resolutionTimeHours = slaSetting.resolutionTimeHours || slaSetting.resolution_time_hours || 24;
      }
      
      console.log('SLAIndicator - Resolution time hours:', resolutionTimeHours);
      
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
          console.log('SLAIndicator - Status periods:', statusPeriods);
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
      
      console.log('SLAIndicator - SLA result:', slaResult);
      
      setPercentConsumed(slaResult.percentConsumed);
      setSlaStatus(slaResult.status);
      
      // Formatar texto baseado no status
      if (slaIsPaused) {
        setTimeRemaining('SLA pausado');
      } else if (slaResult.isBreached) {
        const overdueTime = formatTimeRemaining(slaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
        setTimeRemaining(`Excedido em ${overdueTime}`);
      } else {
        const remainingTime = formatTimeRemaining(slaResult.timeRemaining);
        setTimeRemaining(`${remainingTime} restantes`);
      }
      
    } catch (error) {
      console.error("Erro no cálculo de SLA:", error);
    }
  }, [slaSettingsData, isLoading, error, ticketCreatedAt, ticketPriority, ticketStatus, ticketCompanyId, ticketId, resolvedAt, statusHistory]);
  
  if (isSlaFinished(ticketStatus)) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3 text-green-600" />
        <span className="text-green-600">Resolvido</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="h-3 w-3 animate-pulse" />
        <span>Carregando SLA...</span>
      </div>
    );
  }

  if (error || !slaSettingsData || !timeRemaining) {
    console.log('SLAIndicator - Not showing due to:', { error, slaSettingsData, timeRemaining });
    return null;
  }
  
  // Se o SLA está pausado, mostrar indicador específico
  if (isPaused) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <Pause className="h-3 w-3 text-orange-600" />
        <span className="text-orange-600">SLA pausado</span>
      </div>
    );
  }
  
  // Cores baseadas no status
  const getStatusColor = () => {
    switch (slaStatus) {
      case 'breached': return 'text-red-600';
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };
  
  const getIcon = () => {
    switch (slaStatus) {
      case 'breached':
      case 'critical':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const IconComponent = getIcon();
  const statusColor = getStatusColor();

  return (
    <div className="flex items-center gap-1 text-xs">
      <IconComponent className={`h-3 w-3 ${statusColor}`} />
      <span className={statusColor}>{timeRemaining}</span>
    </div>
  );
};
