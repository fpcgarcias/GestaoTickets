import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInMilliseconds, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
export var SLAStatus = function (_a) {
    var ticketCreatedAt = _a.ticketCreatedAt, ticketPriority = _a.ticketPriority, ticketStatus = _a.ticketStatus;
    var _b = useState(''), timeRemaining = _b[0], setTimeRemaining = _b[1];
    var _c = useState(0), percentConsumed = _c[0], setPercentConsumed = _c[1];
    var _d = useState(false), isBreached = _d[0], setIsBreached = _d[1];
    var slaSettingsData = useQuery({
        queryKey: ["/api/settings/sla"],
    }).data;
    useEffect(function () {
        // Garantir que slaSettings é um array
        var slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
        if (!slaSettings || slaSettings.length === 0 || !ticketCreatedAt || ticketStatus === 'resolved')
            return;
        // Encontrar a configuração de SLA para a prioridade deste ticket
        var slaSetting = slaSettings.find(function (s) { return s.priority === ticketPriority; });
        if (!slaSetting)
            return;
        var createdDate = new Date(ticketCreatedAt);
        var resolutionTimeHours = slaSetting.resolutionTimeHours;
        // Cálculo da data de vencimento do SLA
        var dueDate = new Date(createdDate);
        dueDate.setHours(dueDate.getHours() + resolutionTimeHours);
        // Cálculo da porcentagem do tempo já consumido
        var totalTimeMs = resolutionTimeHours * 60 * 60 * 1000;
        var elapsedTimeMs = differenceInMilliseconds(new Date(), createdDate);
        var consumedPercent = Math.min((elapsedTimeMs / totalTimeMs) * 100, 100);
        // Verifica se o SLA foi violado
        var isSLABreached = new Date() > dueDate;
        setPercentConsumed(Math.round(consumedPercent));
        setIsBreached(isSLABreached);
        if (isSLABreached) {
            // SLA violado
            var overdueTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
            setTimeRemaining("SLA excedido ".concat(overdueTime));
        }
        else {
            // SLA ainda dentro do prazo
            var remainingTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
            setTimeRemaining("Vence ".concat(remainingTime));
        }
        // Atualizar a cada minuto
        var interval = setInterval(function () {
            var newElapsedTimeMs = differenceInMilliseconds(new Date(), createdDate);
            var newConsumedPercent = Math.min((newElapsedTimeMs / totalTimeMs) * 100, 100);
            var newIsSLABreached = new Date() > dueDate;
            setPercentConsumed(Math.round(newConsumedPercent));
            setIsBreached(newIsSLABreached);
            if (newIsSLABreached) {
                var overdueTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
                setTimeRemaining("SLA excedido ".concat(overdueTime));
            }
            else {
                var remainingTime = formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true });
                setTimeRemaining("Vence ".concat(remainingTime));
            }
        }, 60000); // Atualiza a cada minuto
        return function () { return clearInterval(interval); };
    }, [slaSettingsData, ticketCreatedAt, ticketPriority, ticketStatus]);
    if (ticketStatus === 'resolved') {
        return (<Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600"/>
        <AlertTitle className="text-green-800">Chamado Resolvido</AlertTitle>
        <AlertDescription className="text-green-700">
          Este chamado foi resolvido e o SLA não se aplica mais.
        </AlertDescription>
      </Alert>);
    }
    // Obter slaSettings como array também para a condição de retorno
    var slaSettingsArray = Array.isArray(slaSettingsData) ? slaSettingsData : [];
    if (!slaSettingsArray || slaSettingsArray.length === 0 || !timeRemaining) {
        return null;
    }
    return (<Alert className={isBreached ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
      {isBreached ? (<AlertTriangle className="h-5 w-5 text-red-600"/>) : (<Clock className="h-5 w-5 text-blue-600"/>)}
      <AlertTitle className={isBreached ? "text-red-800" : "text-blue-800"}>
        Status do SLA
      </AlertTitle>
      <AlertDescription className={isBreached ? "text-red-700" : "text-blue-700"}>
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span>{timeRemaining}</span>
            <span>{percentConsumed}% consumido</span>
          </div>
          <div className={"h-2 w-full rounded-full ".concat(isBreached ? 'bg-red-200' : 'bg-blue-200')}>
            <div className={"h-full rounded-full ".concat(isBreached ? 'bg-red-600' : 'bg-blue-600')} style={{ width: "".concat(percentConsumed, "%") }}></div>
          </div>
        </div>
      </AlertDescription>
    </Alert>);
};
