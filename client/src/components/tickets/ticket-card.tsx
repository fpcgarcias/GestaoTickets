import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot, StatusBadge, PriorityBadge } from './status-badge';
import { SLAIndicator } from './sla-indicator';
import { formatDate } from '@/lib/utils';
import { Ticket, Official } from '@shared/schema';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface TicketCardProps {
  ticket: Ticket;
  onAssignTicket: (ticketId: number, assignedToId: number | null) => void;
  isAssigning: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onAssignTicket, isAssigning }) => {
  const {
    id,
    ticket_id: ticketId,
    title,
    description,
    status,
    priority,
    created_at: createdAt,
    customer,
    assigned_to_id: assignedToId,
    department_id: departmentId,
  } = ticket;
  
  const { data: allOfficialsData, isLoading: isOfficialsLoading } = useQuery<Official[]>({
    queryKey: ['/api/officials'],
    staleTime: 5 * 60 * 1000,
  });

  // Simplificando completamente a lógica - mostrar TODOS os atendentes
  // Não filtrar por departamento para garantir que SEMPRE apareça atendentes
  const officials = React.useMemo(() => {
    return Array.isArray(allOfficialsData) ? allOfficialsData : [];
  }, [allOfficialsData]);

  const handleSelectChange = (value: string) => {
    const officialId = value === "unassigned" ? null : parseInt(value);
    onAssignTicket(id, officialId);
  };

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
              Criado em {createdAt ? formatDate(createdAt) : 'Data desconhecida'}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium">{title}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-neutral-600 line-clamp-2">{description}</p>
        </div>
        
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center">
            <Avatar className="w-7 h-7 mr-2">
              <AvatarImage src={customer.avatar_url || ""} alt={customer.name} />
              <AvatarFallback>{customer.name?.charAt(0) || "C"}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-700">{customer.name || 'Cliente não informado'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isOfficialsLoading ? (
              <div className="text-xs text-gray-500">Carregando atendentes...</div>
            ) : officials.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                Sem atendentes cadastrados
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isAssigning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <Select 
                  value={assignedToId?.toString() || "unassigned"}
                  onValueChange={handleSelectChange}
                  disabled={isAssigning || isOfficialsLoading}
                >
                  <SelectTrigger 
                    className="w-[180px] h-8 text-xs bg-primary/5 border-2 border-primary/20 hover:border-primary/30 focus:border-primary/50 font-medium"
                  >
                    <SelectValue placeholder="Atribuir a..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-[180px] z-50">
                    <SelectItem value="unassigned" className="text-gray-500 font-medium">
                      Não atribuído
                    </SelectItem>
                    {officials.map((official) => (
                      <SelectItem 
                        key={official.id} 
                        value={official.id.toString()} 
                        className="text-primary-dark font-medium"
                      >
                        {official.name || `Atendente ${official.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button 
              variant="link" 
              className="text-primary hover:text-primary-dark text-sm font-medium px-0 h-8"
              asChild
            >
              <Link href={`/tickets/${id}`}>Abrir</Link>
            </Button>
          </div>
        </div>
        
        {status !== 'resolved' && createdAt && (
          <div className="mt-3">
            <SLAIndicator 
              ticketCreatedAt={typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString()} 
              ticketPriority={priority} 
              ticketStatus={status} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
