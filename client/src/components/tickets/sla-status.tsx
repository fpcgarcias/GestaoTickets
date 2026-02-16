/**
 * Componente SLA Status - Visão detalhada do status de SLA de um ticket
 * Mostra informações completas sobre prazos de resposta e resolução
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, Target, CheckCircle, AlertTriangle, Info, Pause, XCircle } from 'lucide-react';
import { useTicketWithSLA, useTicketSLAStatus, slaUtils } from '@/hooks/use-sla';
import { usePriorities } from '@/hooks/use-priorities';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';
import { addBusinessTime, getBusinessHoursConfig } from '@shared/utils/sla-calculator';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useI18n } from '@/i18n';

interface SLAStatusProps {
  ticketId: number;
  companyId: number;
  departmentId: number;
  incidentTypeId: number;
  categoryId?: number;
  priority: string;
  status: TicketStatus;
  createdAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  className?: string;
  variant?: 'full' | 'compact';
}

export const SLAStatus: React.FC<SLAStatusProps> = ({
  ticketId,
  companyId,
  departmentId,
  incidentTypeId,
  categoryId,
  priority,
  status,
  createdAt,
  firstResponseAt,
  resolvedAt,
  className,
  variant = 'full'
}) => {
  const { formatMessage, locale } = useI18n();
  const ticketSLAInfo = useTicketWithSLA(
    ticketId,
    companyId,
    departmentId,
    incidentTypeId,
    categoryId,
    priority,
    createdAt,
    firstResponseAt,
    resolvedAt,
    status
  );

  // Fallback: buscar configurações de SLA legadas por companhia
  const { data: legacySlaSettings } = useQuery({
    queryKey: ["/api/settings/sla", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/sla?company_id=${companyId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Extrair horas de SLA do formato legado
  const getLegacySLAHours = (): { responseTimeHours: number; resolutionTimeHours: number } | null => {
    if (!legacySlaSettings) return null;
    const priorityKey = priority.toLowerCase();
    const defaults: Record<string, number> = {
      critical: 4, high: 8, medium: 24, low: 48,
      'crítica': 4, 'alta': 8, 'média': 24, 'baixa': 48,
    };
    let responseTimeHours: number = defaults[priorityKey] ?? 24;
    let resolutionTimeHours: number = defaults[priorityKey] ?? 24;
    if (legacySlaSettings && typeof legacySlaSettings === 'object' && 'settings' in legacySlaSettings) {
      const settings = (legacySlaSettings as any).settings;
      const matchKey = Object.keys(settings).find(k => k.toLowerCase() === priorityKey);
      const setting = matchKey ? settings[matchKey] : null;
      responseTimeHours = setting?.response_time_hours ?? responseTimeHours;
      resolutionTimeHours = setting?.resolution_time_hours ?? resolutionTimeHours;
    } else if (Array.isArray(legacySlaSettings)) {
      const setting = legacySlaSettings.find((s: any) => s.priority?.toLowerCase() === priorityKey);
      responseTimeHours = setting?.responseTimeHours ?? setting?.response_time_hours ?? responseTimeHours;
      resolutionTimeHours = setting?.resolutionTimeHours ?? setting?.resolution_time_hours ?? resolutionTimeHours;
    }
    return { responseTimeHours, resolutionTimeHours };
  };

  // Buscar prioridades do departamento para obter o nome correto
  const { data: priorities = [] } = usePriorities(departmentId);
  
  // Encontrar a prioridade atual pelo legacyValue, value ou name (case-insensitive)
  const currentPriority = priorities.find((p: any) => 
    p.legacyValue?.toLowerCase() === priority.toLowerCase() || 
    p.value?.toLowerCase() === priority.toLowerCase() ||
    p.name?.toLowerCase() === priority.toLowerCase()
  );
  
  // Nome da prioridade (do banco) ou fallback para o valor original
  const priorityName = currentPriority?.name || priority;

  const isFinished = isSlaFinished(status);
  const isPaused = isSlaPaused(status);

  // Consolidar SLA: novo sistema ou fallback legado
  const consolidatedSLA = ticketSLAInfo?.sla || (() => {
    const legacy = getLegacySLAHours();
    return legacy ? { ...legacy, source: 'company_default' as const } : null;
  })();

  const createdDateForStatus = new Date(createdAt);
  const firstResponseDateForStatus = firstResponseAt ? new Date(firstResponseAt) : undefined;
  const resolvedDateForStatus = resolvedAt ? new Date(resolvedAt) : undefined;
  const slaStatus = useTicketSLAStatus(
    ticketId,
    createdDateForStatus,
    firstResponseDateForStatus,
    resolvedDateForStatus,
    consolidatedSLA ?? undefined,
    status
  );

  if (!consolidatedSLA) {
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

  const sla = consolidatedSLA;
  const slaStatusNonNull = slaStatus!;

  // Calcular progresso dos prazos
  const responseProgress = (firstResponseAt || status !== 'new')
    ? 100 
    : Math.max(0, Math.min(100, 100 - (slaStatusNonNull.responseTimeRemaining / sla.responseTimeHours) * 100));

  const resolutionProgress = resolvedAt 
    ? 100 
    : Math.max(0, Math.min(100, 100 - (slaStatusNonNull.resolutionTimeRemaining / sla.resolutionTimeHours) * 100));

  const formatDateTime = (dateStr: string) => {
    if (locale === 'en-US') {
      // Formato americano: MM/dd/yyyy at h:mm AM/PM
      return format(new Date(dateStr), 'MM/dd/yyyy \'at\' h:mm a', { locale: enUS });
    } else {
      // Formato brasileiro: dd/MM/yyyy às HH:mm
      return format(new Date(dateStr), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
    }
  };

  // 🔥 NOVA FUNÇÃO: Verificar se a primeira resposta foi excedida
  const isFirstResponseOverdue = () => {
    if (!firstResponseAt || !ticketSLAInfo) return false;
    
    const responseDate = new Date(firstResponseAt);
    const createdDate = new Date(createdAt);
    
    // Usar o mesmo sistema de horário comercial que o SLA usa
    const businessHours = getBusinessHoursConfig();
    const responseDeadline = addBusinessTime(createdDate, sla.responseTimeHours, businessHours);
    
    return responseDate > responseDeadline;
  };

  // 🔥 NOVA FUNÇÃO: Verificar se a resolução foi excedida
  const isResolutionOverdue = () => {
    if (!resolvedAt || !ticketSLAInfo) return false;
    
    const resolutionDate = new Date(resolvedAt);
    const createdDate = new Date(createdAt);
    
    // Usar o mesmo sistema de horário comercial que o SLA usa
    const businessHours = getBusinessHoursConfig();
    const resolutionDeadline = addBusinessTime(createdDate, sla.resolutionTimeHours, businessHours);
    
    return resolutionDate > resolutionDeadline;
  };

  const getStatusIcon = () => {
    if (isFinished) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (isPaused) return <Pause className="h-5 w-5 text-orange-600" />;
    if (slaStatusNonNull.isResolutionOverdue) return <AlertTriangle className="h-5 w-5 text-red-600" />;
    return <Clock className="h-5 w-5 text-blue-600" />;
  };

  const getStatusBadge = () => {
    if (isFinished) return <Badge variant="default" className="bg-green-100 text-green-800">{formatMessage('sla_status.completed')}</Badge>;
    if (isPaused) return <Badge variant="secondary">{formatMessage('sla_status.paused')}</Badge>;
    if (slaStatusNonNull.isResolutionOverdue) return <Badge variant="destructive">{formatMessage('sla_status.overdue_status')}</Badge>;
    if (slaStatusNonNull.resolutionTimeRemaining < 2) return <Badge variant="secondary">{formatMessage('sla_status.critical')}</Badge>;
    if (slaStatusNonNull.resolutionTimeRemaining < 8) return <Badge variant="outline">{formatMessage('sla_status.attention')}</Badge>;
    return <Badge variant="outline">{formatMessage('sla_status.on_time')}</Badge>;
  };

  if (variant === 'compact') {
    const overallStatus = slaStatusNonNull.isResolutionOverdue || responseProgress < 100 ? 'breached' :
                         responseProgress < 100 ? 'pending' : 'met';

    const badgeVariant = overallStatus === 'met' ? 'default' :
                        overallStatus === 'pending' ? 'secondary' : 'destructive';

    const icon = overallStatus === 'met' ? CheckCircle :
                overallStatus === 'pending' ? Clock : XCircle;

    const IconComponent = icon;

    return (
      <Badge variant={badgeVariant} className="flex items-center gap-1">
        <IconComponent className="w-3 h-3" />
        <span className="text-xs">
          {overallStatus === 'met' ? 'SLA OK' :
           overallStatus === 'pending' ? formatMessage('sla_status.on_time') : formatMessage('sla_status.overdue_status')}
        </span>
      </Badge>
    );
  }

  // Versão completa
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>{formatMessage('sla_status.title')}</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          {formatMessage('sla_status.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prazo de Primeira Resposta */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">{formatMessage('sla_status.first_response')}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {sla.responseTimeHours}h {formatMessage('sla_status.deadline')}
              </div>
                             {firstResponseAt ? (
                 <div className={`text-xs ${isFirstResponseOverdue() ? 'text-red-600' : 'text-green-600'}`}>
                   {formatMessage('sla_status.responded_at')} {formatDateTime(firstResponseAt)}
                 </div>
               ) : status !== 'new' ? (
                 <div className="text-xs text-green-600">
                   {formatMessage('sla_status.service_started')}
                 </div>
               ) : (
                 <div className={`text-xs ${slaUtils.getSLAStatusColor(slaStatusNonNull.responseTimeRemaining, slaStatusNonNull.isResponseOverdue)}`}>
                   {slaUtils.formatTimeRemaining(slaStatusNonNull.responseTimeRemaining, locale)}
                 </div>
               )}
            </div>
          </div>
          
          <div
            style={{
              // usamos uma div wrapper para evitar erro de tipagem do CSS var no componente Progress
              ['--progress-foreground' as any]: firstResponseAt
                ? (isFirstResponseOverdue() ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 36%)')
                : status !== 'new'
                  ? 'hsl(142, 76%, 36%)'
                  : slaStatusNonNull.isResponseOverdue
                    ? 'hsl(0, 84%, 60%)'
                    : slaStatusNonNull.responseTimeRemaining < 2
                      ? 'hsl(25, 95%, 53%)'
                      : 'hsl(221, 83%, 53%)'
            }}
          >
            <Progress value={responseProgress} className="h-2" />
          </div>
          
                     {firstResponseAt && (
             <div className={`flex items-center gap-1 text-xs ${isFirstResponseOverdue() ? 'text-red-600' : 'text-green-600'}`}>
               <CheckCircle className="h-3 w-3" />
               <span>{isFirstResponseOverdue() ? formatMessage('sla_status.service_started_outside_sla') : formatMessage('sla_status.service_started')}</span>
             </div>
           )}
        </div>

        <Separator />

        {/* Prazo de Resolução */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <span className="font-medium">{formatMessage('sla_status.resolution')}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {sla.resolutionTimeHours}h {formatMessage('sla_status.deadline')}
              </div>
                             {resolvedAt ? (
                 <div className={`text-xs ${isResolutionOverdue() ? 'text-red-600' : 'text-green-600'}`}>
                   {formatMessage('sla_status.resolved_at')} {formatDateTime(resolvedAt)}
                 </div>
               ) : isPaused ? (
                 <div className="text-xs text-orange-600">
                   {formatMessage('sla_status.paused')}
                 </div>
               ) : (
                 <div className={`text-xs ${slaUtils.getSLAStatusColor(slaStatusNonNull.resolutionTimeRemaining, slaStatusNonNull.isResolutionOverdue)}`}>
                   {slaUtils.formatTimeRemaining(slaStatusNonNull.resolutionTimeRemaining, locale)}
                 </div>
               )}
            </div>
          </div>
          
           <div
             style={{
               ['--progress-foreground' as any]: resolvedAt
                 ? (isResolutionOverdue() ? 'hsl(0, 84%, 60%)' : 'hsl(142, 76%, 36%)')
                 : isPaused
                   ? 'hsl(25, 95%, 53%)'
                   : slaStatusNonNull.isResolutionOverdue
                     ? 'hsl(0, 84%, 60%)'
                     : slaStatusNonNull.resolutionTimeRemaining < 2
                       ? 'hsl(25, 95%, 53%)'
                       : 'hsl(142, 76%, 36%)'
             }}
           >
             <Progress value={resolvedAt ? 100 : resolutionProgress} className="h-2" />
           </div>
          
                     {resolvedAt ? (
             <div className={`flex items-center gap-1 text-xs ${isResolutionOverdue() ? 'text-red-600' : 'text-green-600'}`}>
               <CheckCircle className="h-3 w-3" />
               <span>{isResolutionOverdue() ? formatMessage('sla_status.resolved_outside_sla') : formatMessage('sla_status.resolved')}</span>
             </div>
           ) : isPaused ? (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <Pause className="h-3 w-3" />
              <span>{formatMessage('sla_status.paused_by_status')}</span>
            </div>
          ) : null}
        </div>

        {/* Informações Adicionais */}
        <Separator />
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{formatMessage('sla_status.created_at')}</span>
            <div className="font-medium">{formatDateTime(createdAt)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{formatMessage('sla_status.priority_label')}</span>
            <div className="font-medium">{priorityName}</div>
          </div>
        </div>

        {/* Alerta se SLA excedido */}
        {slaStatusNonNull.isResolutionOverdue && !resolvedAt && !isPaused && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{formatMessage('sla_status.resolution_exceeded')}</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {formatMessage('sla_status.resolution_exceeded_message', { time: slaUtils.formatTimeRemaining(slaStatusNonNull.resolutionTimeRemaining, locale) })}
            </p>
          </div>
        )}

        {/* Informação sobre SLA pausado */}
        {isPaused && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-800">
              <Pause className="h-4 w-4" />
              <span className="font-medium">{formatMessage('sla_status.paused')}</span>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              {formatMessage('sla_status.paused_message')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SLAStatus;
