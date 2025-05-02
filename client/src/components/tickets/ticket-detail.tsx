import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, STATUS_COLORS } from '@/lib/utils';
import { Ticket } from '@shared/schema';
import { StatusDot } from './status-badge';

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
          <h2 className="text-lg font-semibold text-red-700">Error Loading Ticket</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : "Failed to load ticket details"}
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
              <span className="font-medium text-neutral-800">Ticket# {ticket.ticketId}</span>
            </div>
            <h2 className="text-xl font-semibold">{ticket.title}</h2>
          </div>
          <div className="text-sm text-neutral-500">
            Posted at {formatDate(ticket.createdAt)}
          </div>
        </div>
        
        <div className="mb-8 text-neutral-700 space-y-4 whitespace-pre-line">
          {ticket.description}
        </div>
      </CardContent>
    </Card>
  );
};
