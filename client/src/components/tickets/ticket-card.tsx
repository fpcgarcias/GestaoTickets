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
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePriorities, convertLegacyToWeight } from '@/hooks/use-priorities';

interface TicketCardProps {
  ticket: Ticket;
  onAssignTicket: (ticketId: number, assignedToId: number | null) => void;
  isAssigning: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onAssignTicket, isAssigning }) => {
  const { user } = useAuth();
  
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
    company_id: companyId,
  } = ticket;
  
  // Buscar prioridades do departamento para obter informações adicionais
  const { data: priorities = [] } = usePriorities(departmentId || undefined);
  
  // Determinar se o usuário é cliente
  const isCustomer = user?.role === 'customer';
  
  const { data: officialsResponse, isLoading: isOfficialsLoading } = useQuery({
    queryKey: ['/api/officials', departmentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (departmentId) {
        params.append('department_id', departmentId.toString());
      }
      const res = await fetch(`/api/officials?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const allOfficialsData = officialsResponse?.data || [];

  // Filtrar atendentes por departamento do ticket
  const officials = React.useMemo(() => {
    return Array.isArray(allOfficialsData) ? allOfficialsData : [];
  }, [allOfficialsData]);

  const handleSelectChange = (value: string) => {
    const officialId = value === "unassigned" ? null : parseInt(value);
    onAssignTicket(id, officialId);
  };

  // Função para encontrar o nome do atendente atual
  const getCurrentOfficialName = () => {
    if (!assignedToId) return 'Não atribuído';
    
    // Para clientes, usar informação básica do ticket se disponível
    if (isCustomer) {
      // Se o ticket tem informação do oficial diretamente, usar
      if (ticket.official?.name) {
        return ticket.official.name;
      }
      // Senão, mostrar ID genérico
      return `Atendente #${assignedToId}`;
    }
    
    // Para atendentes, usar a lista completa
    if (!officials) return 'Carregando...';
    const official = officials.find(o => o.id === assignedToId);
    return official?.name || 'Atendente não encontrado';
  };

  return (
    <Card className="ticket-card hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <StatusDot status={status} className="mr-2" />
            <span className="font-medium text-neutral-800">Ticket# {ticketId}</span>
          </div>
          <div className="flex items-center">
            {priority && (
              <PriorityBadge 
                priority={priority}
                weight={convertLegacyToWeight(priority)}
                color={priorities.find((p: any) => 
                  p.name?.toLowerCase() === priority.toLowerCase() || 
                  p.legacyValue?.toLowerCase() === priority.toLowerCase()
                )?.color}
                name={priorities.find((p: any) => 
                  p.name?.toLowerCase() === priority.toLowerCase() || 
                  p.legacyValue?.toLowerCase() === priority.toLowerCase()
                )?.name || priority}
              />
            )}
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
            {isCustomer ? (
              // Para clientes: dropdown bloqueado
              <div className="flex items-center gap-2">
                <Select 
                  value={assignedToId?.toString() || "unassigned"}
                  disabled={true} // Sempre desabilitado para clientes
                >
                  <SelectTrigger 
                    className="w-[180px] h-8 text-xs font-medium bg-neutral-50 border-neutral-200 text-neutral-600 cursor-not-allowed"
                  >
                    <SelectValue placeholder="Atribuir a..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-[180px] z-50">
                    <SelectItem value="unassigned" className="text-gray-500 font-medium">
                      Não atribuído
                    </SelectItem>
                    <SelectItem value={assignedToId?.toString() || "unassigned"} className="text-neutral-600 font-medium">
                      {getCurrentOfficialName()}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Para atendentes: dropdown editável
              <>
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
                        className="w-[180px] h-8 text-xs font-medium bg-primary/5 border-2 border-primary/20 hover:border-primary/30 focus:border-primary/50"
                      >
                        <SelectValue placeholder="Atribuir a..." />
                      </SelectTrigger>
                      <SelectContent position="popper" className="min-w-[180px] z-50">
                        <SelectItem value="unassigned" className="text-gray-500 font-medium">
                          Não atribuído
                        </SelectItem>
                        {[...officials].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map((official) => (
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
              </>
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
        
        {createdAt && companyId && priority && (
          <div className="mt-3">
            <SLAIndicator 
              ticketCreatedAt={typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString()} 
              ticketPriority={priority} 
              ticketStatus={status}
              ticketCompanyId={companyId}
              ticketId={id}
              resolvedAt={ticket.resolved_at ? (typeof ticket.resolved_at === 'string' ? ticket.resolved_at : new Date(ticket.resolved_at).toISOString()) : undefined}
              departmentId={departmentId || undefined}
              incidentTypeId={ticket.incident_type_id || undefined}
              firstResponseAt={ticket.first_response_at ? (typeof ticket.first_response_at === 'string' ? ticket.first_response_at : new Date(ticket.first_response_at).toISOString()) : undefined}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
