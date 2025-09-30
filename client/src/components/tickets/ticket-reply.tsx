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
import { TICKET_STATUS } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Ticket, Official } from '@shared/schema';
import { Loader2 } from 'lucide-react';
import { FileUpload } from './file-upload';
import { useAuth } from '@/hooks/use-auth';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';
import { TicketTransferDialog } from './TicketTransferDialog';
import { AISuggestionCard } from './ai-suggestion-card';
import { useAISuggestions } from '@/hooks/use-ai-suggestions';

interface TicketReplyFormProps {
  ticket: Ticket;
}

export const TicketReplyForm: React.FC<TicketReplyFormProps> = ({ ticket }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [transferOpen, setTransferOpen] = React.useState(false);
  
  // Hook para sugestões de IA
  const {
    aiConfig,
    isLoadingConfig,
    suggestions,
    generateSuggestion,
    isGenerating,
    canUseAI,
    hasSuggestions,
    latestSuggestion
  } = useAISuggestions(ticket.id, ticket.department_id || 0);
  
  // 🔥 CORREÇÃO: Determinar se o usuário é cliente NESTE TICKET específico
  // Só é cliente se o role for 'customer' E for o criador do ticket
  // Atendentes (company_admin, admin, manager, supervisor, support) NUNCA são clientes
  const isCustomerForThisTicket = user?.role === 'customer' && 
    ticket.customer?.user_id && user?.id && ticket.customer.user_id === user.id;
  
  // Permissões são controladas por isCustomerForThisTicket nas renderizações abaixo
  
  // Buscar a lista de atendentes disponíveis (apenas para não-clientes)
  const { data: officialsResponse, isLoading: isLoadingOfficials } = useQuery({
    queryKey: ["/api/officials", ticket.department_id],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      if (ticket.department_id) {
        params.append('department_id', ticket.department_id.toString());
      }
      const res = await fetch(`/api/officials?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    enabled: !isCustomerForThisTicket, // Só busca se não for cliente neste ticket
  });

  // Filtrar apenas atendentes ativos e ordenar alfabeticamente
  const officials = (officialsResponse?.data || [])
    .filter((official: Official) => official.is_active)
    .sort((a: Official, b: Official) => a.name.localeCompare(b.name, 'pt-BR'));

  // Tipo de chamado não é editável após a abertura

  const form = useForm({
    resolver: zodResolver(insertTicketReplySchema),
    defaultValues: {
      ticket_id: ticket.id,
      message: '',
      status: ticket.status,
      assigned_to_id: ticket.assigned_to_id || undefined,
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
      // 🔥 TESTE: Navegar imediatamente sem invalidateQueries
      // O WebSocket vai atualizar os dados automaticamente
      navigate('/tickets');
    },
    onError: (error: any) => {
      // Extrair a mensagem de erro do backend
      const errorMessage = error.details || error.message || "Falha ao enviar resposta";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    
    // Para clientes, sempre manter status e atendente originais
    const statusToUse = isCustomerForThisTicket ? ticket.status : data.status;
    const assignedToUse = isCustomerForThisTicket ? ticket.assigned_to_id : data.assigned_to_id;
    
    // Verificar se o status foi alterado para registrar no histórico
    const statusChanged = statusToUse !== ticket.status;
    
    // Transformar os dados para o formato esperado pela API
    const requestData: any = {
      ticket_id: data.ticket_id || ticket.id,
      message: data.message || "Status atualizado automaticamente",
      status: statusToUse,
      type: ticket.type,
      is_internal: false,
      statusChanged: statusChanged,
      previousStatus: statusChanged ? ticket.status : undefined,
    };
    
    // Só adicionar assigned_to_id se não for cliente
    if (!isCustomerForThisTicket) {
      requestData.assigned_to_id = assignedToUse;
    }
    
    // Enviar a resposta com os dados transformados
    replyMutation.mutate(requestData as any);
  };

  // Função para solicitar sugestão de IA
  const handleRequestSuggestion = () => {
    if (!user?.id || !ticket.department_id) return;
    
    generateSuggestion({
      ticket_id: ticket.id,
      user_id: user.id,
      department_id: ticket.department_id
    });
  };

  // Função para encontrar o nome do atendente atual
  const getCurrentOfficialName = () => {
    if (!ticket.assigned_to_id) return 'Não atribuído';
    
    // Usar sempre o nome do atendente que veio no ticket
    if (ticket.official?.name) {
      return ticket.official.name;
    }
    
    // Se não tiver o nome no ticket, buscar na lista de atendentes (só para não-clientes)
    if (!isCustomerForThisTicket && officials && officials.length > 0) {
      const official = officials.find((o: Official) => o.id === ticket.assigned_to_id);
      return official?.name || 'Atendente não encontrado';
    }
    
    return 'Atendente não encontrado';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium">Responder ao Chamado</h3>
          <div className="flex gap-2">
            {/* Botão IA: apenas para atendentes com IA habilitada */}
            {user?.role !== 'customer' && canUseAI && (
              <Button 
                variant="outline" 
                onClick={handleRequestSuggestion}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    🤖 Preciso de ajuda
                  </>
                )}
              </Button>
            )}
            {/* Botão Transferir: oculto apenas para customer */}
            {user?.role !== 'customer' && (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                Transferir Chamado
              </Button>
            )}
          </div>
        </div>
        {/* Contexto do Chamado: Departamento / Tipo / Categoria (sem dependência do FormContext) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Departamento</div>
            <Input
              value={(ticket as any).department_name || '—'}
              readOnly
              className="bg-neutral-50"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Tipo de Chamado</div>
            <Input
              value={(ticket as any).incident_type_name || '—'}
              readOnly
              className="bg-neutral-50"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Categoria</div>
            <Input
              value={(ticket as any).category_name || '—'}
              readOnly
              className="bg-neutral-50"
            />
          </div>
        </div>
        
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
              
              {/* Campo de Tipo de Chamado removido do formulário (somente cabeçalho exibe) */}
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    {isCustomerForThisTicket ? (
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
                        value={field.value || ""}
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

              <FormField
                control={form.control}
                name="assigned_to_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atendente Responsável</FormLabel>
                    {isCustomerForThisTicket ? (
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
                        value={field.value ? String(field.value) : ""}
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
                  // Invalidar query dos anexos para recarregar a lista
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/tickets/${ticket.id}/attachments`] 
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
        
        {/* Sugestões de IA - Seção separada após o formulário */}
        {hasSuggestions && latestSuggestion && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-4">💡 Sugestão de Resolução</h4>
            <AISuggestionCard 
              suggestion={latestSuggestion}
              onFeedback={(suggestionId, rating) => {
                // O feedback é gerenciado pelo próprio componente AISuggestionCard
              }}
            />
          </div>
        )}
        
        {/* Modal de Transferência */}
        <TicketTransferDialog 
          open={transferOpen}
          onOpenChange={setTransferOpen}
          ticketId={ticket.id}
          currentDepartmentId={ticket.department_id || undefined}
        />
      </CardContent>
    </Card>
  );
};
