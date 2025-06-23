import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle, User, Mail } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { calculateSLAStatus, formatTimeRemaining, getBusinessHoursConfig, convertStatusHistoryToPeriods } from '@shared/utils/sla-calculator';

interface SLAStatusProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: string;
  ticketCompanyId: number;
  ticketId: number;
  resolvedAt?: string;
}

export const SLAStatus: React.FC<SLAStatusProps> = ({ 
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
  const [dueDate, setDueDate] = useState<Date | null>(null);
  
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

  // Buscar histórico de status para cálculo preciso de SLA
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
    staleTime: 30 * 1000, // 30 segundos
  });
  
  useEffect(() => {
    console.log('SLAStatus - Debug data:', {
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
    
    try {
      // Encontrar a configuração de SLA para a prioridade deste ticket
      let resolutionTimeHours: number;
      
      if (slaSettingsData && typeof slaSettingsData === 'object' && 'settings' in slaSettingsData) {
        // Formato novo da API
        const slaSetting = (slaSettingsData as any).settings[ticketPriority];
        console.log('SLAStatus - SLA setting found:', slaSetting);
        if (!slaSetting || !slaSetting.resolution_time_hours) return;
        resolutionTimeHours = slaSetting.resolution_time_hours;
      } else {
        // Formato antigo (array)
        const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
        const slaSetting = slaSettings.find((s: any) => s.priority === ticketPriority);
        console.log('SLAStatus - SLA setting found (legacy):', slaSetting);
        if (!slaSetting) return;
        resolutionTimeHours = slaSetting.resolutionTimeHours || slaSetting.resolution_time_hours || 24;
      }
      
      console.log('SLAStatus - Resolution time hours:', resolutionTimeHours);
      
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
            ticketStatus as any,
            statusHistory
          );
          console.log('SLAStatus - Status periods:', statusPeriods);
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
        statusPeriods, // Usar histórico processado
        ticketStatus as any
      );
      
      console.log('SLAStatus - SLA result:', slaResult);
      
      setPercentConsumed(slaResult.percentConsumed);
      setSlaStatus(slaResult.status);
      setDueDate(slaResult.dueDate);
      
      // Formatar texto baseado no status
      if (ticketStatus === 'resolved') {
        if (slaResult.isBreached) {
          const overdueTime = formatTimeRemaining(slaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
          setTimeRemaining(`Resolvido com atraso de ${overdueTime}`);
        } else {
          const usedTime = formatTimeRemaining(slaResult.timeElapsed);
          setTimeRemaining(`Resolvido em ${usedTime} (dentro do SLA)`);
        }
      } else {
        if (slaResult.isBreached) {
          const overdueTime = formatTimeRemaining(slaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
          setTimeRemaining(`SLA excedido em ${overdueTime}`);
        } else {
          const remainingTime = formatTimeRemaining(slaResult.timeRemaining);
          setTimeRemaining(remainingTime);
        }
      }
      
      // Atualizar a cada minuto se o ticket não estiver resolvido
      if (ticketStatus !== 'resolved') {
        const interval = setInterval(() => {
          const updatedSlaResult = calculateSLAStatus(
            createdDate,
            resolutionTimeHours,
            new Date(),
            resolvedDate,
            businessHours
          );
          
          setPercentConsumed(updatedSlaResult.percentConsumed);
          setSlaStatus(updatedSlaResult.status);
          
          if (updatedSlaResult.isBreached) {
            const overdueTime = formatTimeRemaining(updatedSlaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
            setTimeRemaining(`SLA excedido em ${overdueTime}`);
          } else {
            const remainingTime = formatTimeRemaining(updatedSlaResult.timeRemaining);
            setTimeRemaining(remainingTime);
          }
        }, 60000);
        
        return () => clearInterval(interval);
      }
      
    } catch (error) {
      console.error("Erro no cálculo de SLA:", error);
    }
  }, [slaSettingsData, isLoading, error, ticketCreatedAt, ticketPriority, ticketStatus, ticketCompanyId, ticketId, resolvedAt, statusHistory]);
  
  if (isLoading) {
    return (
      <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 mt-0.5 text-gray-400 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-medium text-gray-600 mb-1">
              Status do SLA
            </h3>
            <div className="text-sm text-gray-500">
              Carregando configurações de SLA...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !slaSettingsData || !timeRemaining) {
    console.log('SLAStatus - Not showing due to:', { error, slaSettingsData, timeRemaining });
    return null;
  }
  
  // Cores e estilos baseados no status
  const getStatusConfig = () => {
    if (ticketStatus === 'resolved') {
      return slaStatus === 'breached' 
        ? {
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200',
            iconColor: 'text-orange-600',
            titleColor: 'text-orange-800',
            descColor: 'text-orange-700',
            progressColor: 'bg-orange-600',
            progressBg: 'bg-orange-200',
            icon: CheckCircle
          }
        : {
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            iconColor: 'text-green-600',
            titleColor: 'text-green-800',
            descColor: 'text-green-700',
            progressColor: 'bg-green-600',
            progressBg: 'bg-green-200',
            icon: CheckCircle
          };
    }
    
    switch (slaStatus) {
      case 'breached':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          descColor: 'text-red-700',
          progressColor: 'bg-red-600',
          progressBg: 'bg-red-200',
          icon: AlertTriangle
        };
      case 'critical':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-500',
          titleColor: 'text-red-800',
          descColor: 'text-red-700',
          progressColor: 'bg-red-500',
          progressBg: 'bg-red-200',
          icon: AlertTriangle
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          descColor: 'text-yellow-700',
          progressColor: 'bg-yellow-600',
          progressBg: 'bg-yellow-200',
          icon: Clock
        };
      default:
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600',
          titleColor: 'text-blue-800',
          descColor: 'text-blue-700',
          progressColor: 'bg-blue-600',
          progressBg: 'bg-blue-200',
          icon: Clock
        };
    }
  };
  
  const config = getStatusConfig();
  const IconComponent = config.icon;
  
  const formatDueDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className={`rounded-lg p-4 ${config.bgColor} ${config.borderColor} border`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1">
          <h3 className={`font-medium ${config.titleColor} mb-1`}>
            Status do SLA
          </h3>
          <div className={`text-sm ${config.descColor} space-y-2`}>
            <div className="flex justify-between items-center">
              <span>{timeRemaining}</span>
              <span className="font-medium">{percentConsumed}% consumido</span>
            </div>
            <div className={`h-2 w-full rounded-full ${config.progressBg}`}>
              <div 
                className={`h-full rounded-full transition-all duration-300 ${config.progressColor}`}
                style={{ width: `${Math.min(percentConsumed, 100)}%` }}
              ></div>
            </div>
            {dueDate && (
              <div className="text-xs opacity-75">
                {ticketStatus === 'resolved' 
                  ? `Prazo era: ${formatDueDate(dueDate)}`
                  : `Prazo: ${formatDueDate(dueDate)}`
                }
              </div>
            )}
            <div className="text-xs opacity-75">
              Horário comercial: 8h às 18h (seg-sex)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
