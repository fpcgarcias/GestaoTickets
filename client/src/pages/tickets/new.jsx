import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TicketForm } from '@/components/tickets/ticket-form';
export default function NewTicket() {
    return (<div>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" asChild className="mr-4">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4 mr-2"/>
            Voltar para chamados
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-neutral-900">Novo Chamado</h1>
      </div>

      <TicketForm />
    </div>);
}
