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

interface TicketReplyFormProps {
  ticket: Ticket;
}

export const TicketReplyForm: React.FC<TicketReplyFormProps> = ({ ticket }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  // Buscar a lista de atendentes disponíveis
  const { data: officials, isLoading: isLoadingOfficials } = useQuery<Official[]>({
    queryKey: ["/api/officials"],
  });

  // Buscar dados de tipos de incidentes
  const { data: incidentTypesData } = useQuery<IncidentType[]>({
    queryKey: ["/api/settings/incident-types"],
  });

  // Garantir que incidentTypes é um array
  const incidentTypes = Array.isArray(incidentTypesData) ? incidentTypesData : [];

  // Filtrar tipos de incidentes pelo departamento do ticket
  const filteredIncidentTypes = ticket.departmentId && Array.isArray(incidentTypes)
    ? incidentTypes.filter((type: IncidentType) => type.departmentId === ticket.departmentId)
    : (incidentTypes || []);

  // Estender o tipo do formulário para incluir incidentTypeId
  const formSchema = insertTicketReplySchema.extend({
    incidentTypeId: z.number().optional(),
    type: z.string().optional()
  });
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticketId: ticket.id,
      message: '',
      status: ticket.status,
      assignedToId: ticket.assignedToId || undefined,
      type: ticket.type,
      incidentTypeId: ticket.incidentTypeId || undefined,
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

  const onSubmit = (data: InsertTicketReply) => {
    replyMutation.mutate(data);
  };

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
                  value={ticket.customerEmail} 
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
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredIncidentTypes.map((type: IncidentType) => (
                          <SelectItem key={type.id} value={type.value}>
                            {type.name}
                          </SelectItem>
                        ))}
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
                        <SelectItem value={TICKET_STATUS.NEW}>Novo</SelectItem>
                        <SelectItem value={TICKET_STATUS.ONGOING}>Em Andamento</SelectItem>
                        <SelectItem value={TICKET_STATUS.RESOLVED}>Resolvido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atendente Responsável</FormLabel>
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
