import React from 'react';
import { Link, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { TicketReplyForm } from '@/components/tickets/ticket-reply';
import { Skeleton } from '@/components/ui/skeleton';
export default function TicketDetailPage() {
    var _a = useRoute('/tickets/:id'), params = _a[1];
    var ticketId = (params === null || params === void 0 ? void 0 : params.id) ? parseInt(params.id) : 0;
    var _b = useQuery({
        queryKey: ["/api/tickets/".concat(ticketId)],
    }), ticket = _b.data, isLoading = _b.isLoading, error = _b.error;
    return (<div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-4">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4 mr-2"/>
            Voltar para chamados
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-neutral-900">Chamados</h1>
      </div>

      {isLoading ? (<div className="space-y-6">
          <Skeleton className="w-full h-64"/>
          <Skeleton className="w-full h-80"/>
        </div>) : error ? (<div className="bg-red-50 p-4 rounded-md">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="text-red-600">{error instanceof Error ? error.message : "An error occurred"}</p>
        </div>) : ticket ? (<div className="space-y-6">
          <TicketDetail ticketId={ticketId}/>
          <TicketReplyForm ticket={ticket}/>
        </div>) : null}
    </div>);
}
