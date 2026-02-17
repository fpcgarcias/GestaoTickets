import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Ticket } from '@shared/schema';
import { StatusDot } from './status-badge';
import { SLAStatus } from './sla-status';
import { AttachmentsList } from './attachments-list';
import { ParticipantManagement } from './participant-management';
import { ServiceProviderManagement } from './service-provider-management';
import { TextWithBreakAll } from '@/components/ui/text-with-links';
import { Building, UserCircle2, Network } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/hooks/use-auth';

interface TicketDetailProps {
  ticketId: number;
}

const ROLES_CAN_SEE_SECTOR = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId }) => {
  const { formatMessage, locale } = useI18n();
  const { user } = useAuth();
  const canSeeSector = user && ROLES_CAN_SEE_SECTOR.includes(user.role);
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
      <Card className="bg-destructive/10">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-destructive">Erro ao Carregar Chamado</h2>
          <p className="text-destructive">
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
              <StatusDot status={ticket.status} className="mr-2" />
              <span className="font-medium text-foreground">{formatMessage('tickets.ticket_number', { number: ticket.ticket_id })}</span>
            </div>
            <h2 className="text-xl font-semibold">{ticket.title}</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatMessage('tickets.created_at')} {ticket.created_at ? formatDate(ticket.created_at, locale) : formatMessage('tickets.unknown_date')}
          </div>
        </div>
        
        {/* Exibir detalhes do solicitante apenas se ele existir (pelo ID ou nome) */}
        {ticket.customer?.id || ticket.customer?.name ? (
          <div className="flex items-center gap-2 mb-4 bg-primary/10 p-3 rounded-md">
            <Building className="h-5 w-5 text-primary shrink-0" />
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-sm text-primary font-medium">{formatMessage('tickets.client')}: </span>
              <span className="text-sm text-primary">{ticket.customer?.name}</span>
              {ticket.customer?.email && (
                <span className="text-sm text-primary">- {ticket.customer?.email}</span>
              )}
              {canSeeSector && (ticket.customer as any)?.sector_name && (
                <Badge variant="secondary" className="text-xs font-normal shrink-0 inline-flex items-center gap-1">
                  <Network className="h-3 w-3" />
                  {(ticket.customer as any).sector_name}
                </Badge>
              )}
            </div>
          </div>
        ) : ticket.customer_email ? (
          // Se não há solicitante cadastrado, mas temos o email, mostramos isso
          <div className="flex items-center gap-2 mb-4 bg-amber-500/10 p-3 rounded-md">
            <Building className="h-5 w-5 text-amber-500" />
            <div>
              <span className="text-sm text-amber-500 font-medium">{formatMessage('tickets.client')}: </span>
              <span className="text-sm text-amber-600">(Não cadastrado) - {ticket.customer_email}</span>
            </div>
          </div>
        ) : null}
        
        {/* Status do SLA */}
        {ticket.created_at && ticket.company_id && ticket.department_id && ticket.incident_type_id && (
          <div className="mb-4">
            <SLAStatus 
              ticketId={ticket.id}
              companyId={ticket.company_id}
              departmentId={ticket.department_id}
              incidentTypeId={ticket.incident_type_id}
              categoryId={ticket.category_id || undefined}
              priority={ticket.priority}
              status={ticket.status}
              createdAt={typeof ticket.created_at === 'string' ? ticket.created_at : new Date(ticket.created_at).toISOString()}
              firstResponseAt={ticket.first_response_at ? (typeof ticket.first_response_at === 'string' ? ticket.first_response_at : new Date(ticket.first_response_at).toISOString()) : undefined}
              resolvedAt={ticket.resolved_at ? (typeof ticket.resolved_at === 'string' ? ticket.resolved_at : new Date(ticket.resolved_at).toISOString()) : undefined}
            />
          </div>
        )}
        
        {/* Atendente responsável */}
        {ticket.assigned_to_id && ticket.official && (
          <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 p-3 rounded-md">
            <UserCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <span className="text-sm text-emerald-400 font-medium">Atendente Responsável: </span>
              <span className="text-sm text-emerald-400">{ticket.official?.name}</span>
              {ticket.official?.email && (
                <> - <span className="text-sm text-emerald-400">{ticket.official?.email}</span></>
              )}
            </div>
          </div>
        )}
        
        <div className="mb-8 text-muted-foreground space-y-4">
          <TextWithBreakAll text={ticket.description} />
        </div>

        {/* Gerenciamento de Participantes */}
        <div className="mt-6 border-t pt-6">
          <ParticipantManagement 
            ticketId={ticket.id}
            ticketCompanyId={ticket.company_id || undefined}
            ticketCreatorId={ticket.customer?.user_id || undefined}
          />
        </div>

        {/* Gerenciamento de Prestadores de Serviços */}
        {ticket.department_id && (
          <div className="mt-6 border-t pt-6">
            <ServiceProviderManagement
              ticketId={ticket.id}
              departmentId={ticket.department_id}
              ticketCompanyId={ticket.company_id || undefined}
            />
          </div>
        )}

        {/* Lista de Anexos */}
        <div className="mt-6 border-t pt-6">
          <AttachmentsList 
            ticketId={ticket.id} 
            attachments={ticket.attachments}
          />
        </div>
      </CardContent>
    </Card>
  );
};


