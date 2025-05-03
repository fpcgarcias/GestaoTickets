import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInMilliseconds, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertTriangle } from 'lucide-react';

interface SLAIndicatorProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: string;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({ 
  ticketCreatedAt, 
  ticketPriority,
  ticketStatus,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [percentConsumed, setPercentConsumed] = useState<number>(0);
  const [isBreached, setIsBreached] = useState<boolean>(false);
  
  const { data: slaSettingsData } = useQuery({
    queryKey: ["/api/settings/sla"],
  });
  
  useEffect(() => {
    // Garantir que slaSettings é um array
    const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];

    if (!slaSettings || slaSettings.length === 0 || !ticketCreatedAt || ticketStatus === 'resolved') return;
    
    // Encontrar a configuração de SLA para a prioridade deste ticket
    const slaSetting = slaSettings.find((s: any) => s.priority === ticketPriority);
    if (!slaSetting) return;
    
    const createdDate = new Date(ticketCreatedAt);
    const resolutionTimeHours = slaSetting.resolutionTimeHours;
    
    // Cálculo da data de vencimento do SLA
    const dueDate = new Date(createdDate);
    dueDate.setHours(dueDate.getHours() + resolutionTimeHours);
    
    // Cálculo da porcentagem do tempo já consumido
    const totalTimeMs = resolutionTimeHours * 60 * 60 * 1000;
    const elapsedTimeMs = differenceInMilliseconds(new Date(), createdDate);
    const consumedPercent = Math.min((elapsedTimeMs / totalTimeMs) * 100, 100);
    
    // Verifica se o SLA foi violado
    const isSLABreached = new Date() > dueDate;
    
    setPercentConsumed(Math.round(consumedPercent));
    setIsBreached(isSLABreached);
    
    if (isSLABreached) {
      // SLA violado
      const overdueTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
      setTimeRemaining(`SLA excedido ${overdueTime}`);
    } else {
      // SLA ainda dentro do prazo
      const remainingTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
      setTimeRemaining(`Vence ${remainingTime}`);
    }
    
  }, [slaSettingsData, ticketCreatedAt, ticketPriority, ticketStatus]);
  
  // Obter slaSettings como array também para a condição de retorno
  const slaSettingsArray = Array.isArray(slaSettingsData) ? slaSettingsData : [];

  if (ticketStatus === 'resolved' || !slaSettingsArray || slaSettingsArray.length === 0 || !timeRemaining) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-1 text-xs">
      {isBreached ? (
        <>
          <AlertTriangle className="h-3 w-3 text-red-600" />
          <span className="text-red-600">{timeRemaining}</span>
        </>
      ) : (
        <>
          <Clock className="h-3 w-3 text-blue-600" />
          <span className="text-blue-600">{timeRemaining}</span>
        </>
      )}
    </div>
  );
};
