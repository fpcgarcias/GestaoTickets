import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInMilliseconds, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertTriangle } from 'lucide-react';
export var SLAIndicator = function (_a) {
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
    }, [slaSettingsData, ticketCreatedAt, ticketPriority, ticketStatus]);
    // Obter slaSettings como array também para a condição de retorno
    var slaSettingsArray = Array.isArray(slaSettingsData) ? slaSettingsData : [];
    if (ticketStatus === 'resolved' || !slaSettingsArray || slaSettingsArray.length === 0 || !timeRemaining) {
        return null;
    }
    return (<div className="flex items-center gap-1 text-xs">
      {isBreached ? (<>
          <AlertTriangle className="h-3 w-3 text-red-600"/>
          <span className="text-red-600">{timeRemaining}</span>
        </>) : (<>
          <Clock className="h-3 w-3 text-blue-600"/>
          <span className="text-blue-600">{timeRemaining}</span>
        </>)}
    </div>);
};
