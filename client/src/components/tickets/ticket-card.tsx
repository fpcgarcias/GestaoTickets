import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useI18n } from '@/i18n';
import { TextWithLinkBreaks } from '@/components/ui/text-with-links';

interface TicketCardProps {
  ticket: Ticket;
  onAssignTicket: (ticketId: number, assignedToId: number | null) => void;
  isAssigning: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  company_id?: number;
}

interface TicketParticipant {
  id: number;
  ticket_id: number;
  user_id: number;
  added_by_id: number;
  added_at: string;
  user?: User;
  added_by?: User;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onAssignTicket, isAssigning }) => {
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  
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
    incident_type_id: incidentTypeId,
    category_id: categoryId,
    // campos enriquecidos do backend
    // @ts-ignore
    department_name: departmentName,
    // @ts-ignore
    incident_type_name: incidentTypeName,
    // @ts-ignore
    category_name: categoryName,
  } = ticket as any;
  
  // Buscar prioridades do departamento para obter informações adicionais
  const { data: priorities = [] } = usePriorities(departmentId || undefined);
  
  // 🔥 CORREÇÃO: Para a role 'customer', este campo deve ser somente leitura SEMPRE
  // Não depende de ser o criador do ticket. Basta a role ser 'customer'.
  const isCustomerForThisTicket = user?.role === 'customer';
  
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
    enabled: !isCustomerForThisTicket, // Clientes não devem carregar a lista de atendentes
  });

  // Buscar participantes do ticket
  const { data: participantsResponse, isLoading: participantsLoading } = useQuery({
    queryKey: [`/api/ticket-participants/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/ticket-participants/${id}`);
      if (!response.ok) {
        // Se der erro 404, retornar array vazio (ticket pode não ter participantes)
        if (response.status === 404) {
          return { data: [] };
        }
        throw new Error('Falha ao carregar participantes');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    retry: 1, // Tentar apenas 1 vez
    retryDelay: 1000, // Esperar 1 segundo antes de tentar novamente
  });

  const participants = participantsResponse?.data || [];

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
    if (!assignedToId) return formatMessage('tickets.card.not_assigned');
    
    // Para clientes, usar informação básica do ticket se disponível
    if (isCustomerForThisTicket) {
      // Se o ticket tem informação do oficial diretamente, usar
      if (ticket.official?.name) {
        return ticket.official.name;
      }
      // Senão, mostrar ID genérico
      return `Atendente #${assignedToId}`;
    }
    
    // Para atendentes, usar a lista completa
    if (!officials) return formatMessage('tickets.card.loading_officials');
    const official = officials.find(o => o.id === assignedToId);
    return official?.name || 'Atendente não encontrado';
  };

  return (
    <Card className="ticket-card hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center">
            <StatusDot status={status} className="mr-2" />
            <span className="font-medium text-foreground">Ticket# {ticketId}</span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
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
            <div className="text-sm text-muted-foreground">
              {formatMessage('tickets.created_at')} {createdAt ? formatDate(createdAt, locale) : 'Data desconhecida'}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-lg font-medium break-words">{title}</h3>
            <StatusBadge status={status} />
          </div>
          <div className="text-muted-foreground line-clamp-2">
            <TextWithLinkBreaks text={description} />
          </div>
        </div>
        {/* Metadados: Departamento / Tipo / Categoria */}
        <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
          {departmentName && (
            <span className="bg-muted border border-border px-2 py-0.5 rounded-full">{formatMessage('tickets.card.department')}: {departmentName}</span>
          )}
          {incidentTypeName && (
            <span className="bg-muted border border-border px-2 py-0.5 rounded-full">{formatMessage('tickets.card.type')}: {incidentTypeName}</span>
          )}
          {categoryName && (
            <span className="bg-muted border border-border px-2 py-0.5 rounded-full">{formatMessage('tickets.card.category')}: {categoryName}</span>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border flex-wrap gap-3">
          <div className="flex items-center">
            <Avatar className="w-7 h-7 mr-2">
              <AvatarImage src={customer?.avatar_url || ""} alt={customer?.name} />
              <AvatarFallback>{customer?.name?.charAt(0) || "C"}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{customer?.name || formatMessage('tickets.card.customer_not_informed')}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {isCustomerForThisTicket ? (
              // Para clientes: dropdown bloqueado
              <div className="flex items-center gap-2">
                <Select 
                  value={assignedToId?.toString() || "unassigned"}
                  disabled={true} // Sempre desabilitado para clientes
                >
                  <SelectTrigger 
                    className="w-[180px] h-8 text-xs font-medium bg-muted border-border text-muted-foreground cursor-not-allowed"
                  >
                    <SelectValue placeholder={formatMessage('tickets.card.assign_to')} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-[180px] z-50">
                    <SelectItem value="unassigned" className="text-muted-foreground font-medium">
                      {formatMessage('tickets.card.unassigned')}
                    </SelectItem>
                    <SelectItem value={assignedToId?.toString() || "unassigned"} className="text-muted-foreground font-medium">
                      {getCurrentOfficialName()}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Para atendentes: dropdown editável
              <>
                {isOfficialsLoading ? (
                  <div className="text-xs text-muted-foreground">{formatMessage('tickets.card.loading_officials')}</div>
                ) : officials.length === 0 ? (
                  <div className="text-xs text-amber-500 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
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
                        <SelectValue placeholder={formatMessage('tickets.card.assign_to')} />
                      </SelectTrigger>
                      <SelectContent position="popper" className="min-w-[180px] z-50">
                        <SelectItem value="unassigned" className="text-muted-foreground font-medium">
                          {formatMessage('tickets.card.unassigned')}
                        </SelectItem>
                        {[...officials].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map((official) => (
                          <SelectItem 
                            key={official.id} 
                            value={official.id.toString()} 
                            className="text-primary/80 font-medium"
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
              className="text-primary hover:text-primary/80 text-sm font-medium px-0 h-8"
              asChild
            >
              <Link href={`/tickets/${id}`}>{formatMessage('tickets.open')}</Link>
            </Button>
          </div>
        </div>
        
        {/* Participantes do Ticket */}
        {participants.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <span className="text-xs text-muted-foreground mr-1">👥</span>
                      <div className="flex items-center gap-1">
                                          {participants.slice(0, 2).map((participant: TicketParticipant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"
                    >
                      <div className="w-4 h-4 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {participant.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-16">
                        {participant.user?.name || formatMessage('tickets.card.user')}
                      </span>
                    </div>
                  ))}
                        {participants.length > 2 && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            +{participants.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{formatMessage('tickets.card.participants')} ({participants.length})</div>
                      {participants.map((participant: TicketParticipant) => (
                        <div key={participant.id} className="text-xs">
                          <span className="font-medium">{participant.user?.name || formatMessage('tickets.card.user')}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-xs text-muted-foreground">
                {participants.length} {participants.length > 1 ? formatMessage('tickets.card.participants_plural') : formatMessage('tickets.card.participant')}
              </span>
            </div>
          </div>
        )}
        
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
              categoryId={ticket.category_id || undefined}
              firstResponseAt={ticket.first_response_at ? (typeof ticket.first_response_at === 'string' ? ticket.first_response_at : new Date(ticket.first_response_at).toISOString()) : undefined}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};





