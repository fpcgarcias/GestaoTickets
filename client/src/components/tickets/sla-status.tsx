/**
 * Componente SLA Status - Visão detalhada do status de SLA de um ticket
 * Mostra informações completas sobre prazos de resposta e resolução
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, Target, CheckCircle, AlertTriangle, Info, Pause } from 'lucide-react';
import { useTicketWithSLA, slaUtils } from '@/hooks/use-sla';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SLAStatusProps {
  ticketId: number;
  companyId: number;
  departmentId: number;
  incidentTypeId: number;
  priority: string;
  status: TicketStatus;
  createdAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  className?: string;
}

export const SLAStatus: React.FC<SLAStatusProps> = ({
  ticketId,
  companyId,
  departmentId,
  incidentTypeId,
  priority,
  status,
  createdAt,
  firstResponseAt,
  resolvedAt,
  className
}) => {
  const ticketSLAInfo = useTicketWithSLA(
    ticketId,
    companyId,
    departmentId,
    incidentTypeId,
    priority,
    createdAt,
    firstResponseAt,
    resolvedAt
  );

  const isFinished = isSlaFinished(status);
  const isPaused = isSlaPaused(status);

  if (!ticketSLAInfo) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status de SLA
          </CardTitle>
          <CardDescription>
            Informações sobre os prazos de atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2" />
            <p>Configuração de SLA não disponível</p>
            <p className="text-sm">Verifique as configurações de SLA para este tipo de chamado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { sla, status: slaStatus } = ticketSLAInfo;

  // Calcular progresso dos prazos
  const responseProgress = firstResponseAt 
    ? 100 
    : Math.max(0, Math.min(100, 100 - (slaStatus.responseTimeRemaining / sla.responseTimeHours) * 100));

  const resolutionProgress = resolvedAt 
    ? 100 
    : Math.max(0, Math.min(100, 100 - (slaStatus.resolutionTimeRemaining / sla.resolutionTimeHours) * 100));

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  };

  const getStatusIcon = () => {
    if (isFinished) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (isPaused) return <Pause className="h-5 w-5 text-orange-600" />;
    if (slaStatus.isResolutionOverdue) return <AlertTriangle className="h-5 w-5 text-red-600" />;
    return <Clock className="h-5 w-5 text-blue-600" />;
  };

  const getStatusBadge = () => {
    if (isFinished) return <Badge variant="default" className="bg-green-100 text-green-800">Resolvido</Badge>;
    if (isPaused) return <Badge variant="secondary">SLA Pausado</Badge>;
    if (slaStatus.isResolutionOverdue) return <Badge variant="destructive">SLA Excedido</Badge>;
    if (slaStatus.resolutionTimeRemaining < 2) return <Badge variant="secondary">Crítico</Badge>;
    if (slaStatus.resolutionTimeRemaining < 8) return <Badge variant="outline">Atenção</Badge>;
    return <Badge variant="outline">No Prazo</Badge>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>Status de SLA</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Informações sobre os prazos de atendimento - {slaUtils.getSLASourceDescription(sla.source)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prazo de Primeira Resposta */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Primeira Resposta</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {sla.responseTimeHours}h prazo
              </div>
              {firstResponseAt ? (
                <div className="text-xs text-green-600">
                  Respondido em {formatDateTime(firstResponseAt)}
                </div>
              ) : (
                <div className={`text-xs ${slaUtils.getSLAStatusColor(slaStatus.responseTimeRemaining, slaStatus.isResponseOverdue)}`}>
                  {slaUtils.formatTimeRemaining(slaStatus.responseTimeRemaining)}
                </div>
              )}
            </div>
          </div>
          
          <Progress 
            value={responseProgress} 
            className="h-2" 
            // @ts-ignore
            style={{
              '--progress-foreground': firstResponseAt 
                ? 'hsl(142, 76%, 36%)' // Verde se respondido
                : slaStatus.isResponseOverdue 
                  ? 'hsl(0, 84%, 60%)' // Vermelho se atrasado
                  : slaStatus.responseTimeRemaining < 2
                    ? 'hsl(25, 95%, 53%)' // Laranja se crítico
                    : 'hsl(221, 83%, 53%)' // Azul se normal
            }}
          />
          
          {firstResponseAt && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span>Primeira resposta realizada</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Prazo de Resolução */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <span className="font-medium">Resolução</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {sla.resolutionTimeHours}h prazo
              </div>
              {resolvedAt ? (
                <div className="text-xs text-green-600">
                  Resolvido em {formatDateTime(resolvedAt)}
                </div>
              ) : isPaused ? (
                <div className="text-xs text-orange-600">
                  SLA pausado
                </div>
              ) : (
                <div className={`text-xs ${slaUtils.getSLAStatusColor(slaStatus.resolutionTimeRemaining, slaStatus.isResolutionOverdue)}`}>
                  {slaUtils.formatTimeRemaining(slaStatus.resolutionTimeRemaining)}
                </div>
              )}
            </div>
          </div>
          
          <Progress 
            value={resolvedAt ? 100 : resolutionProgress} 
            className="h-2" 
            // @ts-ignore
            style={{
              '--progress-foreground': resolvedAt 
                ? 'hsl(142, 76%, 36%)' // Verde se resolvido
                : isPaused 
                  ? 'hsl(25, 95%, 53%)' // Laranja se pausado
                  : slaStatus.isResolutionOverdue 
                    ? 'hsl(0, 84%, 60%)' // Vermelho se atrasado
                    : slaStatus.resolutionTimeRemaining < 2
                      ? 'hsl(25, 95%, 53%)' // Laranja se crítico
                      : 'hsl(142, 76%, 36%)' // Verde se normal
            }}
          />
          
          {resolvedAt ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span>Chamado resolvido</span>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <Pause className="h-3 w-3" />
              <span>SLA pausado pelo status atual</span>
            </div>
          ) : null}
        </div>

        {/* Informações Adicionais */}
        <Separator />
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Criado em:</span>
            <div className="font-medium">{formatDateTime(createdAt)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Prioridade:</span>
            <div className="font-medium capitalize">{priority}</div>
          </div>
          {sla.source !== 'global_fallback' && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Fonte da configuração:</span>
              <div className="font-medium">{slaUtils.getSLASourceDescription(sla.source)}</div>
            </div>
          )}
        </div>

        {/* Alerta se SLA excedido */}
        {slaStatus.isResolutionOverdue && !resolvedAt && !isPaused && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">SLA de resolução excedido</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Este chamado está {slaUtils.formatTimeRemaining(slaStatus.resolutionTimeRemaining)} fora do prazo de resolução.
            </p>
          </div>
        )}

        {/* Informação sobre SLA pausado */}
        {isPaused && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-800">
              <Pause className="h-4 w-4" />
              <span className="font-medium">SLA pausado</span>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              O SLA está pausado devido ao status atual do chamado. O tempo será retomado quando o status permitir.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SLAStatus;
