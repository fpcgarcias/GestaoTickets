import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, STATUS_COLORS } from '@/lib/utils';
import { Ticket, Official, TicketReply, TicketStatusHistory } from '@shared/schema';
import { StatusDot } from './status-badge';
import { SLAStatus } from './sla-status';
import { Building, UserCircle2, MessageSquare, Clock, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TicketReplyForm } from './ticket-reply';

interface TicketDetailProps {
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
          <div className="flex items-center gap-2 mb-1">
            {reply.user && (
              <div className="flex items-center">
                <Avatar className="w-5 h-5 mr-1">
                  <AvatarImage src={reply.user.avatar_url || ""} />
                  <AvatarFallback>{reply.user.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{reply.user.name}</span>
              </div>
            )}
            <span className="text-sm text-gray-500">adicionou um comentário</span>
            <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
          </div>
          
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-gray-700 text-sm">
            {reply.message}
          </div>
          
          {reply.is_internal && (
            <Badge variant="outline" className="mt-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
              Interno
            </Badge>
          )}
        </div>
      </div>
    );
  } else {
    const statusChange = item.data as TicketStatusHistory;
    return (
      <div className="flex gap-3 pb-6 relative">
        {/* Linha vertical conectando as atividades */}
        <div className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"></div>
        
        {/* Círculo com ícone */}
        <div className="z-10 flex-shrink-0 w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center border-2 border-white shadow">
          <RefreshCw className="h-5 w-5 text-orange-500" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500">
              Status alterado de 
              <Badge variant="outline" className="mx-1 text-xs">
                {statusChange.old_status || 'não definido'}
              </Badge> 
              para 
              <Badge variant="outline" className="mx-1 text-xs">
                {statusChange.new_status}
              </Badge>
            </span>
            <span className="text-xs text-gray-400">{formatDate(statusChange.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }
};

// Componente para o histórico
const TicketHistory: React.FC<{ ticketId: number }> = ({ ticketId }) => {
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
    return <div className="space-y-4 mt-4">
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
    </div>;
  }
  
  if (historyItems.length === 0) {
    return <div className="text-gray-500 p-4 bg-gray-50 rounded-md mt-4 text-center">
      Nenhuma atividade registrada para este chamado.
    </div>;
  }

  return (
    <div className="mt-4">
      <h3 className="font-medium text-gray-700 mb-4">Histórico de Atendimento</h3>
      <div className="space-y-2">
        {historyItems.map(item => (
          <HistoryItem key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
};

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId }) => {
  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: [`/api/tickets/${ticketId}`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center mb-2">
                <Skeleton className="w-4 h-4 rounded-full mr-3" />
                <Skeleton className="w-40 h-5" />
              </div>
              <Skeleton className="w-60 h-7 mt-2" />
            </div>
            <Skeleton className="w-32 h-5" />
          </div>
          
          <div className="space-y-4">
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-2/3 h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !ticket) {
    return (
      <Card className="bg-red-50">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-red-700">Erro ao Carregar Chamado</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : "Falha ao carregar detalhes do chamado"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center mb-2">
              <StatusDot status={ticket.status} />
              <span className="font-medium text-neutral-800">Chamado #{ticket.ticket_id}</span>
            </div>
            <h2 className="text-xl font-semibold">{ticket.title}</h2>
          </div>
          <div className="text-sm text-neutral-500">
            Criado em {ticket.created_at ? formatDate(ticket.created_at) : 'Data desconhecida'}
          </div>
        </div>
        
        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            {/* Exibir detalhes do cliente apenas se ele existir (pelo ID ou nome) */}
            {ticket.customer?.id || ticket.customer?.name ? (
              <div className="flex items-center gap-2 mb-4 bg-blue-50 p-3 rounded-md">
                <Building className="h-5 w-5 text-blue-500" />
                <div>
                  <span className="text-sm text-blue-700 font-medium">Cliente: </span>
                  <span className="text-sm text-blue-800">{ticket.customer.name}</span>
                  {ticket.customer.email && (
                    <> - <span className="text-sm text-blue-600">{ticket.customer.email}</span></>
                  )}
                </div>
              </div>
            ) : ticket.customer_email ? (
              // Se não há cliente cadastrado, mas temos o email, mostramos isso
              <div className="flex items-center gap-2 mb-4 bg-yellow-50 p-3 rounded-md">
                <Building className="h-5 w-5 text-yellow-500" />
                <div>
                  <span className="text-sm text-yellow-700 font-medium">Cliente: </span>
                  <span className="text-sm text-yellow-800">(Não cadastrado) - {ticket.customer_email}</span>
                </div>
              </div>
            ) : null}
            
            {/* Status do SLA */}
            {ticket.created_at && (
              <div className="mb-4">
                <SLAStatus 
                  ticketCreatedAt={typeof ticket.created_at === 'string' ? ticket.created_at : new Date(ticket.created_at).toISOString()} 
                  ticketPriority={ticket.priority} 
                  ticketStatus={ticket.status} 
                />
              </div>
            )}
            
            {/* Atendente responsável */}
            {ticket.assigned_to_id && ticket.official && (
              <div className="flex items-center gap-2 mb-4 bg-green-50 p-3 rounded-md">
                <UserCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <span className="text-sm text-green-700 font-medium">Atendente Responsável: </span>
                  <span className="text-sm text-green-800">{ticket.official.name}</span>
                  {ticket.official.email && (
                    <> - <span className="text-sm text-green-600">{ticket.official.email}</span></>
                  )}
                </div>
              </div>
            )}
            
            <div className="mb-8 text-neutral-700 space-y-4 whitespace-pre-line">
              {ticket.description}
            </div>
          </TabsContent>
          
          <TabsContent value="history">
            <TicketHistory ticketId={ticketId} />
            
            <Separator className="my-6" />
            
            {/* Formulário de resposta ao ticket */}
            {ticket && ticket.status !== 'resolved' && (
              <TicketReplyForm ticket={ticket} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
