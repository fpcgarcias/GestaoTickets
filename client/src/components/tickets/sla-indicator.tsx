import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInMilliseconds, formatDistanceToNow, isValid } from 'date-fns';
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
    
    try {
      // Encontrar a configuração de SLA para a prioridade deste ticket
      const slaSetting = slaSettings.find((s: any) => s.priority === ticketPriority);
      if (!slaSetting) return;
      
      // Garantir que temos uma data válida
      let createdDate: Date;
      
      try {
        createdDate = new Date(ticketCreatedAt);
        
        // Verificar se a data é válida
        if (!isValid(createdDate)) {
          console.error("Data de criação inválida:", ticketCreatedAt);
          return;
        }
      } catch (error) {
        console.error("Erro ao converter data:", error);
        return;
      }
      
      const resolutionTimeHours = slaSetting.resolutionTimeHours || 24; // Fallback para 24h
      
      // Cálculo da data de vencimento do SLA
      const dueDate = new Date(createdDate);
      dueDate.setHours(dueDate.getHours() + resolutionTimeHours);
      
      // Verificar novamente se dueDate é válido
      if (!isValid(dueDate)) {
        console.error("Data de vencimento inválida:", dueDate);
        return;
      }
      
      // Cálculo da porcentagem do tempo já consumido
      const totalTimeMs = resolutionTimeHours * 60 * 60 * 1000;
      const elapsedTimeMs = differenceInMilliseconds(new Date(), createdDate);
      const consumedPercent = Math.min((elapsedTimeMs / totalTimeMs) * 100, 100);
      
      // Verifica se o SLA foi violado
      const isSLABreached = new Date() > dueDate;
      
      setPercentConsumed(Math.round(consumedPercent));
      setIsBreached(isSLABreached);
      
      // Formatação do tempo remanescente com tratamento de erro
      try {
        if (isSLABreached) {
          // SLA violado
          const overdueTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
          setTimeRemaining(`SLA excedido ${overdueTime}`);
        } else {
          // SLA ainda dentro do prazo
          const remainingTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
          setTimeRemaining(`Vence ${remainingTime}`);
        }
      } catch (error) {
        console.error("Erro ao formatar tempo:", error);
        setTimeRemaining("Tempo indisponível");
      }
    } catch (error) {
      console.error("Erro no cálculo de SLA:", error);
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
