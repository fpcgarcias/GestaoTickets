import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { insertTicketReplySchema, type InsertTicketReply } from '@shared/schema';
import { TICKET_STATUS, TICKET_TYPES } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ticket, Official, IncidentType } from '@shared/schema';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { FileUpload } from './file-upload';
import { useAuth } from '@/hooks/use-auth';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';

interface TicketReplyFormProps {
  ticket: Ticket;
}

export const TicketReplyForm: React.FC<TicketReplyFormProps> = ({ ticket }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Determinar se o usuário é cliente
  const isCustomer = user?.role === 'customer';
  const canModifyStatus = !isCustomer;
  const canModifyAssignment = !isCustomer;
  
  // Buscar a lista de atendentes disponíveis (apenas para não-clientes)
  const { data: officials, isLoading: isLoadingOfficials } = useQuery<Official[]>({
    queryKey: ["/api/officials"],
    enabled: !isCustomer, // Só busca se não for cliente
  });

  // Buscar dados de tipos de incidentes usando a API correta
  const { data: incidentTypesData, isLoading: isLoadingIncidentTypes } = useQuery<IncidentType[]>({
    queryKey: ["/api/incident-types", { active_only: true }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/incident-types?active_only=true');
      return response.json();
    },
  });

  // Garantir que incidentTypes é um array
  const incidentTypes = Array.isArray(incidentTypesData) ? incidentTypesData : [];

  // Filtrar tipos de incidentes pelo departamento do ticket
  const filteredIncidentTypes = ticket.department_id && Array.isArray(incidentTypes)
    ? incidentTypes.filter((type: IncidentType) => type.department_id === ticket.department_id)
    : (incidentTypes || []);

  // Estender o tipo do formulário para incluir incidentTypeId
  const formSchema = insertTicketReplySchema.extend({
    incidentTypeId: z.number().optional(),
    type: z.string().optional()
  });
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm({
    resolver: zodResolver(insertTicketReplySchema),
    defaultValues: {
      ticket_id: ticket.id,
      message: '',
      status: ticket.status,
      assigned_to_id: ticket.assigned_to_id || undefined,
      type: ticket.type,
      is_internal: false,
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: InsertTicketReply) => {
      const response = await apiRequest('POST', '/api/ticket-replies', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Resposta enviada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/replies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/status-history`] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      navigate('/tickets');
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar resposta",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log("🚀 onSubmit chamado com dados:", data);
    
    // Verificar se o formulário é válido
    const formErrors = form.formState.errors;
    console.log("❌ Erros do formulário:", formErrors);
    
    // Para clientes, sempre manter status e atendente originais
    const statusToUse = isCustomer ? ticket.status : data.status;
    const assignedToUse = isCustomer ? ticket.assigned_to_id : data.assigned_to_id;
    
    // Verificar se o status foi alterado para registrar no histórico
    const statusChanged = statusToUse !== ticket.status;
    console.log("📊 Status mudou?", statusChanged, "De:", ticket.status, "Para:", statusToUse);
    
    // Transformar os dados para o formato esperado pela API
    const requestData = {
      ticket_id: data.ticket_id || ticket.id,
      message: data.message || "Status atualizado automaticamente",
      status: statusToUse,
      assigned_to_id: assignedToUse,
      type: data.type,
      is_internal: false,
      statusChanged: statusChanged,
      previousStatus: statusChanged ? ticket.status : undefined,
    };
    
    console.log("📤 Dados que serão enviados:", requestData);
    
    // Enviar a resposta com os dados transformados
    replyMutation.mutate(requestData as any);
  };

  // Função para encontrar o nome do atendente atual
  const getCurrentOfficialName = () => {
    if (!ticket.assigned_to_id || !officials) return 'Não atribuído';
    const official = officials.find(o => o.id === ticket.assigned_to_id);
    return official?.name || 'Atendente não encontrado';
  };

  // Adicionar log para verificar se o formulário está sendo criado corretamente
  console.log("🎯 Ticket carregado:", ticket);
  console.log("🎯 Usuário atual:", user);
  console.log("🎯 É cliente?", isCustomer);
  console.log("🎯 Valores padrão do formulário:", {
    ticket_id: ticket.id,
    message: '',
    status: ticket.status,
    assigned_to_id: ticket.assigned_to_id || undefined,
    type: ticket.type,
  });

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-6">Responder ao Chamado</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormItem>
                <FormLabel>E-mail do Cliente</FormLabel>
                <Input 
                  value={ticket.customer_email} 
                  readOnly 
                  className="bg-neutral-50"
                />
              </FormItem>
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Chamado</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                      disabled={isLoadingIncidentTypes}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            isLoadingIncidentTypes 
                              ? "Carregando tipos..." 
                              : "Escolher Tipo"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingIncidentTypes ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Carregando tipos...</span>
                          </div>
                        ) : filteredIncidentTypes.length > 0 ? (
                          filteredIncidentTypes.map((type: IncidentType) => (
                            <SelectItem key={type.id} value={type.value}>
                              {type.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-neutral-500 text-sm text-center">
                            Nenhum tipo de chamado encontrado para este departamento
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    {isCustomer ? (
                      // Para clientes: campo somente-leitura mostrando o status atual
                      <Input 
                        value={getStatusConfig(ticket.status as TicketStatus).label}
                        readOnly 
                        className="bg-neutral-50"
                      />
                    ) : (
                      // Para atendentes: campo editável
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={TICKET_STATUS.NEW}>
                            {getStatusConfig('new').icon} {getStatusConfig('new').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.ONGOING}>
                            {getStatusConfig('ongoing').icon} {getStatusConfig('ongoing').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.SUSPENDED}>
                            {getStatusConfig('suspended').icon} {getStatusConfig('suspended').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.WAITING_CUSTOMER}>
                            {getStatusConfig('waiting_customer').icon} {getStatusConfig('waiting_customer').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.ESCALATED}>
                            {getStatusConfig('escalated').icon} {getStatusConfig('escalated').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.IN_ANALYSIS}>
                            {getStatusConfig('in_analysis').icon} {getStatusConfig('in_analysis').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.PENDING_DEPLOYMENT}>
                            {getStatusConfig('pending_deployment').icon} {getStatusConfig('pending_deployment').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.REOPENED}>
                            {getStatusConfig('reopened').icon} {getStatusConfig('reopened').label}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.RESOLVED}>
                            {getStatusConfig('resolved').icon} {getStatusConfig('resolved').label}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="assigned_to_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atendente Responsável</FormLabel>
                    {isCustomer ? (
                      // Para clientes: campo somente-leitura mostrando o atendente atual
                      <Input 
                        value={getCurrentOfficialName()}
                        readOnly 
                        className="bg-neutral-50"
                      />
                    ) : (
                      // Para atendentes: campo editável
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar Atendente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingOfficials && (
                            <div className="flex items-center justify-center p-2">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Carregando atendentes...</span>
                            </div>
                          )}
                          {(officials ?? []).map((official: Official) => (
                            <SelectItem key={official.id} value={String(official.id)}>
                              {official.name}
                            </SelectItem>
                          ))}
                          {(!officials || officials.length === 0) && !isLoadingOfficials && (
                            <div className="p-2 text-neutral-500 text-sm text-center">
                              Nenhum atendente encontrado
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem de Resposta</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Digite sua resposta aqui..." 
                      rows={6} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Upload de Arquivos */}
            <div className="border-t pt-6">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900">Anexar Arquivos</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Adicione documentos, imagens ou outros arquivos relacionados à sua resposta.
                </p>
              </div>
              <FileUpload 
                ticketId={ticket.id}
                onUploadSuccess={(attachment) => {
                  toast({
                    title: "Arquivo anexado",
                    description: `${attachment.original_filename} foi anexado com sucesso.`,
                  });
                }}
                onUploadError={(error) => {
                  console.error('Erro no upload:', error);
                }}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="px-6"
                disabled={replyMutation.isPending}
              >
                {replyMutation.isPending ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
