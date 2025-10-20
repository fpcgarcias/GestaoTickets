import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TicketForm } from '@/components/tickets/ticket-form';
import { useI18n } from '@/i18n';

export default function NewTicket() {
  const { formatMessage } = useI18n();
  
  return (
    <div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-4">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage('new_ticket.back_to_tickets')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{formatMessage('new_ticket.title')}</h1>
      </div>

      <TicketForm />
    </div>
  );
}
