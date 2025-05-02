import React from 'react';
import { Link } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot, PriorityBadge } from './status-badge';
import { formatDate } from '@/lib/utils';
import { Ticket } from '@shared/schema';

interface TicketCardProps {
  ticket: Ticket;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  const {
    id,
    ticketId,
    title,
    description,
    status,
    priority,
    createdAt,
    customer,
  } = ticket;

  return (
    <Card className="ticket-card hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <StatusDot status={status} />
            <span className="font-medium text-neutral-800">Ticket# {ticketId}</span>
          </div>
          <div className="flex items-center">
            {priority && <PriorityBadge priority={priority} />}
            <div className="text-sm text-neutral-500">
              Postado em {formatDate(createdAt)}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <p className="text-neutral-600 line-clamp-2">{description}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Avatar className="w-7 h-7 mr-2">
              <AvatarImage src={customer.avatarUrl || ""} alt={customer.name} />
              <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-700">{customer.name}</span>
          </div>
          <Button 
            variant="link" 
            className="text-primary hover:text-primary-dark text-sm font-medium px-0"
            asChild
          >
            <Link href={`/tickets/${id}`}>Abrir Chamado</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
