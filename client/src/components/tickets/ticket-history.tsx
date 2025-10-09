import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, translateTicketStatus, translateUserRole } from '@/lib/utils';
import { getPriorityColorByWeight, convertLegacyToWeight } from '@/hooks/use-priorities';
import { useI18n } from '@/i18n';

// Função para traduzir e normalizar prioridades
const translatePriority = (priority: string): string => {
  if (!priority) return 'Não definido';
  
  // Normalizar para primeira letra maiúscula
  const normalized = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  
  // Mapeamento de prioridades legadas para português
  const legacyMap: Record<string, string> = {
    'low': 'Baixa',
    'medium': 'Média', 
    'high': 'Alta',
    'critical': 'Crítica'
  };
  
  // Se é uma prioridade legada em inglês, traduzir
  if (legacyMap[priority.toLowerCase()]) {
    return legacyMap[priority.toLowerCase()];
  }
  
  // Senão, retornar a prioridade normalizada (primeira letra maiúscula)
  return normalized;
};

// Função para cores das prioridades (melhorada para lidar com customizadas)
const getPriorityColors = (priority: string, type: 'old' | 'new'): string => {
  const normalizedPriority = priority.toLowerCase();
  
  const colorMap: Record<string, string> = {
    'baixa': 'bg-green-50 text-green-700 border-green-200',      // Baixa = Verde
    'low': 'bg-green-50 text-green-700 border-green-200',        // Low = Verde
    'média': 'bg-blue-50 text-blue-700 border-blue-200',        // Média = Azul  
    'medium': 'bg-blue-50 text-blue-700 border-blue-200',       // Medium = Azul
    'alta': 'bg-yellow-50 text-yellow-700 border-yellow-200',   // Alta = Amarelo
    'high': 'bg-yellow-50 text-yellow-700 border-yellow-200',   // High = Amarelo
    'crítica': 'bg-red-50 text-red-700 border-red-200',         // Crítica = Vermelho
    'critical': 'bg-red-50 text-red-700 border-red-200'         // Critical = Vermelho
  };
  
  return colorMap[normalizedPriority] || 'bg-gray-50 text-gray-700 border-gray-200';
};

// Função para ícones das prioridades (melhorada)
const getPriorityIcon = (priority: string, type: 'old' | 'new'): string => {
  if (type === 'old') {
    // Prioridade anterior - sempre com seta para baixo (saindo)
    return '⬇️';
  } else {
    // Prioridade nova - ícone baseado no nível de urgência
    const normalizedPriority = priority.toLowerCase();
    const iconMap: Record<string, string> = {
      'baixa': '🟢',      // Baixa = Verde (tranquilo)
      'low': '🟢',        // Low = Verde (tranquilo)
      'média': '🔵',      // Média = Azul (neutro)  
      'medium': '🔵',     // Medium = Azul (neutro)
      'alta': '🟡',       // Alta = Amarelo (atenção)
      'high': '🟡',       // High = Amarelo (atenção)
      'crítica': '🔴',    // Crítica = Vermelho (urgente)
      'critical': '🔴'    // Critical = Vermelho (urgente)
    };
    
    return iconMap[normalizedPriority] || '⚪';
  }
};
import { TicketReply, TicketStatusHistory } from '@shared/schema';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TextWithBreakAll } from '@/components/ui/text-with-links';
  import { MessageSquare, RefreshCw, User, AlertTriangle } from 'lucide-react';

interface TicketHistoryProps {
  ticketId: number;
}

// Tipo para o item de histórico combinado
interface HistoryItem {
  id: number;
  type: 'reply' | 'status_change' | 'assignment_change' | 'department_change';
  created_at: string;
  data: any;
}

// Componente de item de histórico
const HistoryItem: React.FC<{ item: HistoryItem }> = ({ item }) => {
  if (item.type === 'reply') {
    const reply = item.data as TicketReply;
    return (
      <div className="flex gap-3 pb-6 relative">
        {/* Linha vertical conectando as atividades */}
        <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
        
        {/* Círculo com ícone */}
        <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow">
          <MessageSquare className="h-5 w-5 text-blue-500" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {reply.user ? (
              <>
                <Avatar className="w-6 h-6">
                  <AvatarImage src={reply.user.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{reply.user.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm text-blue-700">{reply.user.name}</span>
                <span className="text-sm text-gray-500">adicionou um comentário</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 italic">Usuário não identificado adicionou um comentário</span>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">{formatDate(reply.created_at, locale)}</span>
          </div>
          
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-700 text-sm border-l-3 border-l-blue-400">
            <TextWithBreakAll text={reply.message} />
          </div>
          
          <div className="flex gap-2 mt-2">
            {reply.is_internal && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                💼 Comentário Interno
              </Badge>
            )}
            {reply.user?.role && ['integration_bot', 'quality', 'triage', 'admin'].includes(reply.user.role) && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {translateUserRole(reply.user.role)}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  } else if (item.type === 'department_change') {
    const deptChange = item.data as any;
    return (
      <div className="flex gap-3 pb-6 relative">
        <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center border-2 border-white shadow">
          <RefreshCw className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {deptChange.user ? (
              <>
                <Avatar className="w-6 h-6">
                  <AvatarImage src={deptChange.user.avatar_url || ""} />
                  <AvatarFallback className="text-xs">
                    {deptChange.user.role === 'integration_bot' ? '🤖' : deptChange.user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm text-indigo-700">{deptChange.user.name}</span>
                <span className="text-sm text-gray-500">transferiu o chamado</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 italic">Usuário não identificado transferiu o chamado</span>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">{formatDate(deptChange.created_at, locale)}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700 space-y-1">
            <div>
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">Departamento:</Badge>
              <span className="ml-2">{deptChange.old_department_name || '—'}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span>{deptChange.new_department_name || '—'}</span>
            </div>
            <div>
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">Tipo:</Badge>
              <span className="ml-2">{deptChange.old_incident_type_name || '—'}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span>{deptChange.new_incident_type_name || '—'}</span>
            </div>
            <div>
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">Categoria:</Badge>
              <span className="ml-2">{deptChange.old_category_name || '—'}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span>{deptChange.new_category_name || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (item.type === 'assignment_change') {
    const assignment = item.data as any;
    const oldOfficial = assignment.old_assigned_official;
    const newOfficial = assignment.new_assigned_official;
    return (
      <div className="flex gap-3 pb-6 relative">
        {/* Linha vertical conectando as atividades */}
        <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
        {/* Círculo com ícone */}
        <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center border-2 border-white shadow">
          <User className="h-5 w-5 text-teal-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {assignment.user ? (
              <>
                <Avatar className="w-6 h-6">
                  <AvatarImage src={assignment.user.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{assignment.user.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm text-teal-700">{assignment.user.name}</span>
                <span className="text-sm text-gray-500">transferiu a responsabilidade</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 italic">Usuário não identificado transferiu a responsabilidade</span>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">{formatDate(assignment.created_at, locale)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
              De: {oldOfficial?.name || 'Não atribuído'}
            </Badge>
            <span className="text-sm text-gray-400">→</span>
            <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
              Para: {newOfficial?.name || 'Não atribuído'}
            </Badge>
          </div>
        </div>
      </div>
    );
  } else {
    const statusChange = item.data as TicketStatusHistory;
    
    // Detectar se é mudança de prioridade usando o campo change_type
    const isPriorityChange = (statusChange as any).change_type === 'priority';
    
    if (isPriorityChange) {
      // Usar os campos específicos de prioridade
      const oldPriority = (statusChange as any).old_priority || 'não definido';
      const newPriority = (statusChange as any).new_priority || 'não definido';
      
      return (
        <div className="flex gap-3 pb-6 relative">
          {/* Linha vertical conectando as atividades */}
          <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
          
          {/* Círculo com ícone */}
          <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center border-2 border-white shadow">
            <AlertTriangle className="h-5 w-5 text-purple-500" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {statusChange.user ? (
                <>
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={statusChange.user.avatar_url || ""} />
                    <AvatarFallback className="text-xs">
                      {statusChange.user.role === 'integration_bot' ? '🤖' : statusChange.user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm text-purple-700">{statusChange.user.name}</span>
                  <span className="text-sm text-gray-500">alterou a prioridade de</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 italic">Usuário não identificado alterou a prioridade de</span>
                </>
              )}
              <span className="text-xs text-gray-400 ml-auto">{formatDate(statusChange.created_at, locale)}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${getPriorityColors(oldPriority, 'old')}`}>
                {getPriorityIcon(oldPriority, 'old')} {translatePriority(oldPriority)}
              </Badge> 
              <span className="text-sm text-gray-400">→</span>
              <Badge variant="outline" className={`text-xs ${getPriorityColors(newPriority, 'new')}`}>
                {getPriorityIcon(newPriority, 'new')} {translatePriority(newPriority)}
              </Badge>
              
              {statusChange.user?.role && ['integration_bot', 'quality', 'triage', 'admin'].includes(statusChange.user.role) && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 ml-2">
                  {translateUserRole(statusChange.user.role)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      // Mudança de status normal
      return (
        <div className="flex gap-3 pb-6 relative">
          {/* Linha vertical conectando as atividades */}
          <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
          
          {/* Círculo com ícone */}
          <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center border-2 border-white shadow">
            <RefreshCw className="h-5 w-5 text-orange-500" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {statusChange.user ? (
                <>
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={statusChange.user.avatar_url || ""} />
                    <AvatarFallback className="text-xs">
                      {statusChange.user.role === 'integration_bot' ? '🤖' : statusChange.user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                                     <span className="font-semibold text-sm text-purple-700">{statusChange.user.name}</span>
                  <span className="text-sm text-gray-500">alterou o status de</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 italic">Usuário não identificado alterou o status de</span>
                </>
              )}
              <span className="text-xs text-gray-400 ml-auto">{formatDate(statusChange.created_at, locale)}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                ❌ {translateTicketStatus(statusChange.old_status || 'não definido')}
              </Badge> 
              <span className="text-sm text-gray-400">→</span>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                ✅ {translateTicketStatus(statusChange.new_status || 'não definido')}
              </Badge>
              
              {statusChange.user?.role && ['integration_bot', 'quality', 'triage', 'admin'].includes(statusChange.user.role) && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 ml-2">
                  {translateUserRole(statusChange.user.role)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    }
  }
};

export const TicketHistory: React.FC<TicketHistoryProps> = ({ ticketId }) => {
  const { formatMessage, locale } = useI18n();
  
  // Buscar respostas do ticket
  const { data: ticketReplies, isLoading: isRepliesLoading } = useQuery<TicketReply[]>({
    queryKey: [`/api/tickets/${ticketId}/replies`],
    staleTime: 30 * 1000, // 30 segundos
  });
  
  // Buscar histórico de status
  const { data: statusHistory, isLoading: isStatusHistoryLoading } = useQuery<TicketStatusHistory[]>({
    queryKey: [`/api/tickets/${ticketId}/status-history`],
    staleTime: 30 * 1000,
  });
  
  // Combinar os dois tipos de histórico
  const historyItems: HistoryItem[] = React.useMemo(() => {
    const items: HistoryItem[] = [];
    
    if (ticketReplies) {
      ticketReplies.forEach(reply => {
        items.push({
          id: reply.id,
          type: 'reply',
          created_at: typeof reply.created_at === 'string' 
            ? reply.created_at 
            : new Date(reply.created_at).toISOString(),
          data: reply
        });
      });
    }
    
    if (statusHistory) {
      statusHistory.forEach(status => {
        const baseItem = {
          id: status.id,
          created_at: typeof status.created_at === 'string' 
            ? status.created_at 
            : new Date(status.created_at).toISOString(),
          data: status as any
        } as any;

        const ct = (status as any).change_type;
        if (ct === 'assignment') {
          items.push({ ...baseItem, type: 'assignment_change' });
        } else if (ct === 'department') {
          items.push({ ...baseItem, type: 'department_change' });
        } else {
          items.push({ ...baseItem, type: 'status_change' });
        }
      });
    }
    
    // Ordenar por data (mais recentes primeiro)
    return items.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [ticketReplies, statusHistory]);
  
  if (isRepliesLoading || isStatusHistoryLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📋 {formatMessage('ticket_history.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-40 h-4" />
                  </div>
                  <Skeleton className="w-full h-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>📋 {formatMessage('ticket_history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {historyItems.length === 0 ? (
          <div className="text-gray-500 p-4 bg-gray-50 rounded-md text-center">
            📝 {formatMessage('ticket_history.no_activity')}
            <br />
            <span className="text-xs text-gray-400">{formatMessage('ticket_history.start_history')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {historyItems.map(item => (
              <HistoryItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};