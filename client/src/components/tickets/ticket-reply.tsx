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
import { Ticket, Official } from '@shared/schema';
import { Loader2 } from 'lucide-react';

interface TicketReplyFormProps {
  ticket: Ticket;
}

export const TicketReplyForm: React.FC<TicketReplyFormProps> = ({ ticket }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const form = useForm<InsertTicketReply>({
    resolver: zodResolver(insertTicketReplySchema),
    defaultValues: {
      ticketId: ticket.id,
      message: '',
      status: ticket.status,
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
                      onValueChange={field.onChange} 
                      defaultValue={ticket.type}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
