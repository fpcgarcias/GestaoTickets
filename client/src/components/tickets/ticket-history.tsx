import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, translateTicketStatus } from '@/lib/utils';

// Função para traduzir prioridades
const translatePriority = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    'low': 'Baixa',
    'medium': 'Média', 
    'high': 'Alta',
    'critical': 'Crítica'
  };
  return priorityMap[priority] || priority;
};

// Função para cores das prioridades
const getPriorityColors = (priority: string, type: 'old' | 'new'): string => {
  const colorMap: Record<string, string> = {
    'low': 'bg-green-50 text-green-700 border-green-200',      // Baixa = Verde
    'medium': 'bg-blue-50 text-blue-700 border-blue-200',      // Média = Azul  
    'high': 'bg-yellow-50 text-yellow-700 border-yellow-200',  // Alta = Amarelo
    'critical': 'bg-red-50 text-red-700 border-red-200'        // Crítica = Vermelho
  };
  
  return colorMap[priority] || 'bg-gray-50 text-gray-700 border-gray-200';
};

// Função para ícones das prioridades
const getPriorityIcon = (priority: string, type: 'old' | 'new'): string => {
  if (type === 'old') {
    // Prioridade anterior - sempre com seta para baixo (saindo)
    return '⬇️';
  } else {
    // Prioridade nova - ícone baseado no nível de urgência
    const iconMap: Record<string, string> = {
      'low': '🟢',      // Baixa = Verde (tranquilo)
      'medium': '🔵',   // Média = Azul (neutro)  
      'high': '🟡',     // Alta = Amarelo (atenção)
      'critical': '🔴'  // Crítica = Vermelho (urgente)
    };
    
    return iconMap[priority] || '⚪';
  }
};
import { TicketReply, TicketStatusHistory } from '@shared/schema';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
  import { MessageSquare, RefreshCw, User, AlertTriangle } from 'lucide-react';

interface TicketHistoryProps {
  ticketId: number;
}

// Tipo para o item de histórico combinado
interface HistoryItem {
  id: number;
  type: 'reply' | 'status_change';
  created_at: string;
  data: TicketReply | TicketStatusHistory;
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
            <span className="text-xs text-gray-400 ml-auto">{formatDate(reply.created_at)}</span>
          </div>
          
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-700 text-sm border-l-3 border-l-blue-400">
            {reply.message}
          </div>
          
          <div className="flex gap-2 mt-2">
            {reply.is_internal && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                💼 Comentário Interno
              </Badge>
            )}
            {reply.user?.role && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {reply.user.role === 'support' ? '🎧 Suporte' : 
                 reply.user.role === 'admin' ? '👑 Admin' :
                 reply.user.role === 'customer' ? '👤 Cliente' : 
                 reply.user.role === 'manager' ? '📊 Gestor' : reply.user.role}
              </Badge>
            )}
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
              <span className="text-xs text-gray-400 ml-auto">{formatDate(statusChange.created_at)}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${getPriorityColors(oldPriority, 'old')}`}>
                {getPriorityIcon(oldPriority, 'old')} {translatePriority(oldPriority)}
              </Badge> 
              <span className="text-sm text-gray-400">→</span>
              <Badge variant="outline" className={`text-xs ${getPriorityColors(newPriority, 'new')}`}>
                {getPriorityIcon(newPriority, 'new')} {translatePriority(newPriority)}
              </Badge>
              
              {statusChange.user?.role && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 ml-2">
                  {statusChange.user.role === 'support' ? '🎧 Suporte' : 
                   statusChange.user.role === 'admin' ? '👑 Admin' :
                   statusChange.user.role === 'customer' ? '👤 Cliente' : 
                   statusChange.user.role === 'manager' ? '📊 Gestor' : 
                   statusChange.user.role === 'integration_bot' ? '🤖 Robo IA' : statusChange.user.role}
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
                  <span className="font-semibold text-sm text-orange-700">{statusChange.user.name}</span>
                  <span className="text-sm text-gray-500">alterou o status de</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 italic">Usuário não identificado alterou o status de</span>
                </>
              )}
              <span className="text-xs text-gray-400 ml-auto">{formatDate(statusChange.created_at)}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                ❌ {translateTicketStatus(statusChange.old_status || 'não definido')}
              </Badge> 
              <span className="text-sm text-gray-400">→</span>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                ✅ {translateTicketStatus(statusChange.new_status || 'não definido')}
              </Badge>
              
              {statusChange.user?.role && (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 ml-2">
                  {statusChange.user.role === 'support' ? '🎧 Suporte' : 
                   statusChange.user.role === 'admin' ? '👑 Admin' :
                   statusChange.user.role === 'customer' ? '👤 Cliente' : 
                   statusChange.user.role === 'manager' ? '📊 Gestor' : 
                   statusChange.user.role === 'integration_bot' ? '🤖 Robo IA' : statusChange.user.role}
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
        items.push({
          id: status.id,
          type: 'status_change',
          created_at: typeof status.created_at === 'string' 
            ? status.created_at 
            : new Date(status.created_at).toISOString(),
          data: status
        });
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
          <CardTitle>📋 Histórico de Atendimento</CardTitle>
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
        <CardTitle>📋 Histórico de Atendimento</CardTitle>
      </CardHeader>
      <CardContent>
        {historyItems.length === 0 ? (
          <div className="text-gray-500 p-4 bg-gray-50 rounded-md text-center">
            📝 Nenhuma atividade registrada para este chamado.
            <br />
            <span className="text-xs text-gray-400">Adicione um comentário ou altere o status para começar o histórico.</span>
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