import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInMilliseconds, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SLAStatusProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: string;
}

export const SLAStatus: React.FC<SLAStatusProps> = ({ 
  ticketCreatedAt, 
  ticketPriority,
  ticketStatus,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [percentConsumed, setPercentConsumed] = useState<number>(0);
  const [isBreached, setIsBreached] = useState<boolean>(false);
  
  const { data: slaSettings } = useQuery({
    queryKey: ["/api/settings/sla"],
  });
  
  useEffect(() => {
    if (!slaSettings || !ticketCreatedAt || ticketStatus === 'resolved') return;
    
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
    
    // Atualizar a cada minuto
    const interval = setInterval(() => {
      const newElapsedTimeMs = differenceInMilliseconds(new Date(), createdDate);
      const newConsumedPercent = Math.min((newElapsedTimeMs / totalTimeMs) * 100, 100);
      const newIsSLABreached = new Date() > dueDate;
      
      setPercentConsumed(Math.round(newConsumedPercent));
      setIsBreached(newIsSLABreached);
      
      if (newIsSLABreached) {
        const overdueTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
        setTimeRemaining(`SLA excedido ${overdueTime}`);
      } else {
        const remainingTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
        setTimeRemaining(`Vence ${remainingTime}`);
      }
    }, 60000); // Atualiza a cada minuto
    
    return () => clearInterval(interval);
  }, [slaSettings, ticketCreatedAt, ticketPriority, ticketStatus]);
  
  if (ticketStatus === 'resolved') {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-800">Chamado Resolvido</AlertTitle>
        <AlertDescription className="text-green-700">
          Este chamado foi resolvido e o SLA não se aplica mais.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!slaSettings || !timeRemaining) {
    return null;
  }
  
  return (
    <Alert className={isBreached ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
      {isBreached ? (
        <AlertTriangle className="h-5 w-5 text-red-600" />
      ) : (
        <Clock className="h-5 w-5 text-blue-600" />
      )}
      <AlertTitle className={isBreached ? "text-red-800" : "text-blue-800"}>
        Status do SLA
      </AlertTitle>
      <AlertDescription className={isBreached ? "text-red-700" : "text-blue-700"}>
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span>{timeRemaining}</span>
            <span>{percentConsumed}% consumido</span>
          </div>
          <div className={`h-2 w-full rounded-full ${isBreached ? 'bg-red-200' : 'bg-blue-200'}`}>
            <div 
              className={`h-full rounded-full ${isBreached ? 'bg-red-600' : 'bg-blue-600'}`}
              style={{ width: `${percentConsumed}%` }}
            ></div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
