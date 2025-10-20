import React from 'react';
import { Link, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { TicketReplyForm } from '@/components/tickets/ticket-reply';
import { TicketHistory } from '@/components/tickets/ticket-history';
import AiAnalysisHistory from '@/components/tickets/ai-analysis-history';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket } from '@shared/schema';
import { useI18n } from '@/i18n';

export default function TicketDetailPage() {
  const [, params] = useRoute('/tickets/:id');
  const ticketId = params?.id ? parseInt(params.id) : 0;
  const { formatMessage } = useI18n();

  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: [`/api/tickets/${ticketId}`],
  });

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-4">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage('tickets.back_to_tickets')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{formatMessage('tickets.title')}</h1>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="w-full h-64" />
          <Skeleton className="w-full h-80" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 p-4 rounded-md">
          <h2 className="text-lg font-medium text-destructive">Error</h2>
          <p className="text-destructive">{error instanceof Error ? error.message : "An error occurred"}</p>
        </div>
      ) : ticket ? (
        <div className="space-y-6">
          <TicketDetail ticketId={ticketId} />
          {ticket.status !== 'resolved' && (
            <TicketReplyForm ticket={ticket} />
          )}
          <TicketHistory ticketId={ticketId} />
          <AiAnalysisHistory ticketId={ticketId} />
        </div>
      ) : null}
    </div>
  );
}
