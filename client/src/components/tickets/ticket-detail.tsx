import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, STATUS_COLORS } from '@/lib/utils';
import { Ticket, Official } from '@shared/schema';
import { StatusDot } from './status-badge';
import { SLAStatus } from './sla-status';
import { Building, UserCircle2 } from 'lucide-react';

interface TicketDetailProps {
  ticketId: number;
}

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
              <span className="font-medium text-neutral-800">Chamado #{ticket.ticketId}</span>
            </div>
            <h2 className="text-xl font-semibold">{ticket.title}</h2>
          </div>
          <div className="text-sm text-neutral-500">
            Criado em {formatDate(ticket.createdAt)}
          </div>
        </div>
        
        {ticket.customer && (
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
        )}
        
        {/* Status do SLA */}
        <div className="mb-4">
          <SLAStatus 
            ticketCreatedAt={ticket.createdAt.toString()} 
            ticketPriority={ticket.priority} 
            ticketStatus={ticket.status} 
          />
        </div>
        
        {/* Atendente responsável */}
        {ticket.assignedToId && ticket.official && (
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
      </CardContent>
    </Card>
  );
};
