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
import { Label } from '@/components/ui/label';
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
import { useI18n } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { UserSearch } from '@/components/inventory/user-search';

interface TicketReplyFormProps {
  ticket: Ticket;
}

export const TicketReplyForm: React.FC<TicketReplyFormProps> = ({ ticket }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = React.useState(false);
  const [movementType, setMovementType] = React.useState<'ENTREGA_USUARIO' | 'DEVOLUCAO_USUARIO' | 'EMPRESTIMO_TEMPORARIO' | 'TROCA_EQUIPAMENTO' | 'ENVIO_MANUTENCAO'>('ENTREGA_USUARIO');
  const [productOutId, setProductOutId] = React.useState<string>("");
  const [productOutIds, setProductOutIds] = React.useState<string[]>([]);
  const [productInId, setProductInId] = React.useState<string>("");
  const [movementNotes, setMovementNotes] = React.useState<string>("");
  const [movementLocationId, setMovementLocationId] = React.useState<string>("");
  const [expectedReturnDate, setExpectedReturnDate] = React.useState<string>("");
  const [searchOut, setSearchOut] = React.useState<string>("");
  const [searchIn, setSearchIn] = React.useState<string>("");
  const [popoverOpenOut, setPopoverOpenOut] = React.useState(false);
  const [popoverOpenIn, setPopoverOpenIn] = React.useState(false);
  const [deliverToOtherUser, setDeliverToOtherUser] = React.useState<boolean>(false);
  const [responsibleUserId, setResponsibleUserId] = React.useState<string>("");
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  
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

  // Buscar usuários para seleção de responsável
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ["/api/company/users"],
    queryFn: async () => {
      const response = await fetch('/api/company/users?includeInactive=false');
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: deliverToOtherUser,
  });

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

  // Produtos de inventário para vincular ao ticket - busca com filtro de pesquisa
  // 🔥 FILTRAR equipamentos por status baseado no tipo de movimentação
  const getStatusFilterOut = (): string | undefined => {
    switch (movementType) {
      case 'ENTREGA_USUARIO':
        return 'available'; // Só equipamentos disponíveis
      case 'DEVOLUCAO_USUARIO':
        return 'in_use'; // Só equipamentos em uso
      case 'TROCA_EQUIPAMENTO':
        return 'in_use'; // Para devolver: só equipamentos em uso
      case 'EMPRESTIMO_TEMPORARIO':
        return 'available'; // Só equipamentos disponíveis
      case 'ENVIO_MANUTENCAO':
        return 'in_use'; // Só equipamentos em uso
      default:
        return undefined;
    }
  };
  
  const getStatusFilterIn = (): string | undefined => {
    // Para TROCA_EQUIPAMENTO, o equipamento "IN" (entregar) deve ser disponível
    if (movementType === 'TROCA_EQUIPAMENTO') {
      return 'available';
    }
    return undefined;
  };
  
  // Verificar se o usuário tem acesso ao inventário (customer não tem acesso)
  const canAccessInventory = !!user && user.role !== 'customer';
  
  const inventoryProductsQueryOut = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["inventory", "products", { page: 1, limit: 100, search: searchOut || undefined, status: getStatusFilterOut() }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '100');
      if (searchOut) params.append('search', searchOut);
      const status = getStatusFilterOut();
      if (status) params.append('status', status);
      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar produtos');
      return res.json();
    },
    enabled: canAccessInventory,
  });
  
  const inventoryProductsQueryIn = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["inventory", "products", { page: 1, limit: 100, search: searchIn || undefined, status: getStatusFilterIn() }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '100');
      if (searchIn) params.append('search', searchIn);
      const status = getStatusFilterIn();
      if (status) params.append('status', status);
      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar produtos');
      return res.json();
    },
    enabled: canAccessInventory,
  });
  
  const productsOut = inventoryProductsQueryOut.data?.data ?? [];
  const productsIn = inventoryProductsQueryIn.data?.data ?? [];
  
  // Buscar localizações disponíveis
  const locationsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["inventory", "locations"],
    queryFn: async () => {
      const res = await fetch('/api/inventory/locations');
      if (!res.ok) throw new Error('Erro ao carregar localizações');
      return res.json();
    },
    enabled: canAccessInventory,
  });
  const locations = locationsQuery.data?.data ?? [];
  
  const selectedProductOut = productsOut.find((p: any) => String(p.id) === productOutId);
  const selectedProductIn = productsIn.find((p: any) => String(p.id) === productInId);
  
  // Limpar seleções quando o tipo de movimentação mudar
  React.useEffect(() => {
    setProductOutId('');
    setProductOutIds([]);
    setProductInId('');
    setSearchOut('');
    setSearchIn('');
    setMovementLocationId('');
  }, [movementType]);
  
  const getProductDisplayText = (product: any) => {
    if (!product) return "";
    const parts = [product.name];
    if (product.serial_number) parts.push(`S/N: ${product.serial_number}`);
    if (product.service_tag) parts.push(`Service Tag: ${product.service_tag}`);
    if (product.asset_number) parts.push(`Patrimônio: ${product.asset_number}`);
    return parts.join(" • ");
  };

  const replyMutation = useMutation({
    mutationFn: async (data: InsertTicketReply) => {
      const response = await apiRequest('POST', '/api/ticket-replies', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('ticket_reply.success'),
        description: formatMessage('ticket_reply.reply_sent_successfully'),
      });
      // 🔥 TESTE: Navegar imediatamente sem invalidateQueries
      // O WebSocket vai atualizar os dados automaticamente
      navigate('/tickets');
    },
    onError: (error: any) => {
      // Extrair a mensagem de erro do backend
      const errorMessage = error.details || error.message || formatMessage('ticket_reply.failed_to_send_reply');
      
      toast({
        title: formatMessage('ticket_reply.error'),
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
      message: data.message || formatMessage('ticket_reply.status_updated_automatically'),
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

  // Função para encontrar o nome do atendente atual
  const getCurrentOfficialName = () => {
    if (!ticket.assigned_to_id) return formatMessage('ticket_reply.not_assigned');
    
    // Usar sempre o nome do atendente que veio no ticket
    if (ticket.official?.name) {
      return ticket.official.name;
    }
    
    // Se não tiver o nome no ticket, buscar na lista de atendentes (só para não-clientes)
    if (!isCustomerForThisTicket && officials && officials.length > 0) {
      const official = officials.find((o: Official) => o.id === ticket.assigned_to_id);
      return official?.name || formatMessage('ticket_reply.official_not_found');
    }
    
    return formatMessage('ticket_reply.official_not_found');
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium">{formatMessage('ticket_reply.reply_to_ticket')}</h3>
          {/* Botão Transferir: oculto apenas para customer */}
          {user?.role !== 'customer' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInventoryDialogOpen(true)}>
                {formatMessage('ticket_reply.inventory_move_button')}
              </Button>
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                {formatMessage('ticket_reply.transfer_ticket')}
              </Button>
            </div>
          )}
        </div>
        {/* Contexto do Chamado: Departamento / Tipo / Categoria (sem dependência do FormContext) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">{formatMessage('ticket_reply.department')}</div>
            <Input
              value={(ticket as any).department_name || '—'}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">{formatMessage('ticket_reply.ticket_type')}</div>
            <Input
              value={(ticket as any).incident_type_name || '—'}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">{formatMessage('ticket_reply.category')}</div>
            <Input
              value={(ticket as any).category_name || '—'}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormItem>
                <FormLabel>{formatMessage('ticket_reply.customer_email')}</FormLabel>
                <Input 
                  value={ticket.customer_email} 
                  readOnly 
                  className="bg-muted"
                />
              </FormItem>
              
              {/* Campo de Tipo de Chamado removido do formulário (somente cabeçalho exibe) */}
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{formatMessage('ticket_reply.status')}</FormLabel>
                    {isCustomerForThisTicket ? (
                      // Para clientes: campo somente-leitura mostrando o status atual
                      <Input 
                        value={formatMessage(`tickets.${ticket.status}`)}
                        readOnly 
                        className="bg-muted"
                      />
                    ) : (
                      // Para atendentes: campo editável
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={formatMessage('ticket_reply.select_status')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={TICKET_STATUS.NEW}>
                            {getStatusConfig('new').icon} {formatMessage('tickets.new')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.ONGOING}>
                            {getStatusConfig('ongoing').icon} {formatMessage('tickets.ongoing')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.SUSPENDED}>
                            {getStatusConfig('suspended').icon} {formatMessage('tickets.suspended')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.WAITING_CUSTOMER}>
                            {getStatusConfig('waiting_customer').icon} {formatMessage('tickets.waiting_customer')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.ESCALATED}>
                            {getStatusConfig('escalated').icon} {formatMessage('tickets.escalated')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.IN_ANALYSIS}>
                            {getStatusConfig('in_analysis').icon} {formatMessage('tickets.in_analysis')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.PENDING_DEPLOYMENT}>
                            {getStatusConfig('pending_deployment').icon} {formatMessage('tickets.pending_deployment')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.REOPENED}>
                            {getStatusConfig('reopened').icon} {formatMessage('tickets.reopened')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.RESOLVED}>
                            {getStatusConfig('resolved').icon} {formatMessage('tickets.resolved')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.CLOSED}>
                            {getStatusConfig('closed').icon} {formatMessage('tickets.closed')}
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
                    <FormLabel>{formatMessage('ticket_reply.responsible_official')}</FormLabel>
                    {isCustomerForThisTicket ? (
                      // Para clientes: campo somente-leitura mostrando o atendente atual
                      <Input 
                        value={getCurrentOfficialName()}
                        readOnly 
                        className="bg-muted"
                      />
                    ) : (
                      // Para atendentes: campo editável
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={formatMessage('ticket_reply.select_official')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingOfficials && (
                            <div className="flex items-center justify-center p-2">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>{formatMessage('ticket_reply.loading_officials')}</span>
                            </div>
                          )}
                          {(officials ?? []).map((official: Official) => (
                            <SelectItem key={official.id} value={String(official.id)}>
                              {official.name}
                            </SelectItem>
                          ))}
                          {(!officials || officials.length === 0) && !isLoadingOfficials && (
                            <div className="p-2 text-muted-foreground text-sm text-center">
                              {formatMessage('ticket_reply.no_officials_found')}
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
                  <FormLabel>{formatMessage('ticket_reply.reply_message')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={formatMessage('ticket_reply.type_reply_here')} 
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
                <h4 className="text-sm font-medium text-foreground">{formatMessage('ticket_reply.attach_files')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMessage('ticket_reply.attach_files_description')}
                </p>
              </div>
              <FileUpload 
                ticketId={ticket.id}
                onUploadSuccess={(attachment) => {
                  toast({
                    title: formatMessage('ticket_reply.file_attached'),
                    description: formatMessage('ticket_reply.file_attached_successfully', { filename: attachment.original_filename }),
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
                {replyMutation.isPending ? formatMessage('ticket_reply.sending') : formatMessage('ticket_reply.send_reply')}
              </Button>
            </div>
          </form>
        </Form>
        {/* Modal de Transferência */}
        <TicketTransferDialog 
          open={transferOpen}
          onOpenChange={setTransferOpen}
          ticketId={ticket.id}
          currentDepartmentId={ticket.department_id || undefined}
        />
        {/* Modal simples para movimentar equipamento vinculado ao ticket */}
        {user?.role !== 'customer' && inventoryDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background rounded-md shadow-lg max-w-xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {formatMessage('ticket_reply.inventory_section_title')}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInventoryDialogOpen(false)}
                >
                  ✕
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage('ticket_reply.inventory_section_description')}
              </p>
              <form className="space-y-4">
                {/* Tipo de Movimentação */}
                <div className="space-y-2">
                  <Label>{formatMessage('ticket_reply.inventory_action')}</Label>
                  <Select
                    value={movementType}
                    onValueChange={(val) =>
                      setMovementType(val as typeof movementType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTREGA_USUARIO">
                        {formatMessage('ticket_reply.inventory_action_loan')}
                      </SelectItem>
                      <SelectItem value="DEVOLUCAO_USUARIO">
                        {formatMessage('ticket_reply.inventory_action_return')}
                      </SelectItem>
                      <SelectItem value="EMPRESTIMO_TEMPORARIO">
                        {formatMessage('ticket_reply.inventory_action_temp_loan')}
                      </SelectItem>
                      <SelectItem value="TROCA_EQUIPAMENTO">
                        {formatMessage('ticket_reply.inventory_action_swap')}
                      </SelectItem>
                      <SelectItem value="ENVIO_MANUTENCAO">
                        {formatMessage('ticket_reply.inventory_action_maintenance')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Seleção de Equipamentos */}
                {movementType === 'TROCA_EQUIPAMENTO' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        {formatMessage('ticket_reply.inventory_product_out')}
                      </Label>
                      <Popover open={popoverOpenOut} onOpenChange={setPopoverOpenOut}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpenOut}
                            className="w-full justify-between items-center h-auto min-h-11 whitespace-normal text-left"
                          >
                            {selectedProductOut ? (
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{selectedProductOut.name}</span>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {selectedProductOut.serial_number && <span>S/N: {selectedProductOut.serial_number}</span>}
                                  {selectedProductOut.service_tag && <span>Service Tag: {selectedProductOut.service_tag}</span>}
                                  {selectedProductOut.asset_number && <span>Patrimônio: {selectedProductOut.asset_number}</span>}
                                </div>
                              </div>
                            ) : (
                              formatMessage('ticket_reply.inventory_product_placeholder')
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full min-w-[400px] max-w-md p-0" align="start">
                          <Command className="max-h-[300px]">
                            <CommandInput 
                              placeholder={formatMessage('ticket_reply.inventory_product_search_placeholder')}
                              value={searchOut}
                              onValueChange={setSearchOut}
                            />
                            <CommandList className="max-h-[200px] overflow-y-auto">
                              <CommandEmpty>
                                <div className="py-6 text-center text-sm">
                                  {formatMessage('ticket_reply.inventory_product_not_found')}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {productsOut.map((p: any) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.serial_number || ''} ${p.service_tag || ''} ${p.asset_number || ''}`}
                                    onSelect={() => {
                                      setProductOutId(String(p.id));
                                      setPopoverOpenOut(false);
                                      setSearchOut("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        productOutId === String(p.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{p.name}</span>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        {p.serial_number && <span>S/N: {p.serial_number}</span>}
                                        {p.service_tag && <span>Service Tag: {p.service_tag}</span>}
                                        {p.asset_number && <span>Patrimônio: {p.asset_number}</span>}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {formatMessage('ticket_reply.inventory_product_in')}
                      </Label>
                      <Popover open={popoverOpenIn} onOpenChange={setPopoverOpenIn}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpenIn}
                          className="w-full justify-between items-center h-auto min-h-11 whitespace-normal text-left"
                          >
                            {selectedProductIn ? (
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{selectedProductIn.name}</span>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {selectedProductIn.serial_number && <span>S/N: {selectedProductIn.serial_number}</span>}
                                  {selectedProductIn.service_tag && <span>Service Tag: {selectedProductIn.service_tag}</span>}
                                  {selectedProductIn.asset_number && <span>Patrimônio: {selectedProductIn.asset_number}</span>}
                                </div>
                              </div>
                            ) : (
                              formatMessage('ticket_reply.inventory_product_placeholder')
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full min-w-[400px] max-w-md p-0" align="start">
                          <Command className="max-h-[300px]">
                            <CommandInput 
                              placeholder={formatMessage('ticket_reply.inventory_product_search_placeholder')}
                              value={searchIn}
                              onValueChange={setSearchIn}
                            />
                            <CommandList className="max-h-[200px] overflow-y-auto">
                              <CommandEmpty>
                                <div className="py-6 text-center text-sm">
                                  {formatMessage('ticket_reply.inventory_product_not_found')}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {productsIn.map((p: any) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.serial_number || ''} ${p.service_tag || ''} ${p.asset_number || ''}`}
                                    onSelect={() => {
                                      setProductInId(String(p.id));
                                      setPopoverOpenIn(false);
                                      setSearchIn("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        productInId === String(p.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{p.name}</span>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        {p.serial_number && <span>S/N: {p.serial_number}</span>}
                                        {p.service_tag && <span>Service Tag: {p.service_tag}</span>}
                                        {p.asset_number && <span>Patrimônio: {p.asset_number}</span>}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>
                      {formatMessage('ticket_reply.inventory_product')}
                    </Label>
                    <Popover open={popoverOpenOut} onOpenChange={setPopoverOpenOut}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpenOut}
                          className="w-full justify-between items-center h-auto min-h-11 whitespace-normal text-left"
                        >
                          <div className="flex flex-wrap gap-2 py-1">
                            {productsOut
                              .filter((p: any) => productOutIds.includes(String(p.id)))
                              .map((p: any) => (
                                <Badge key={p.id} variant="secondary" className="gap-1">
                                  <span className="font-medium">{p.name}</span>
                                  {p.serial_number && <span className="text-xs text-muted-foreground"> · S/N: {p.serial_number}</span>}
                                  {p.service_tag && <span className="text-xs text-muted-foreground"> · ST: {p.service_tag}</span>}
                                  {p.asset_number && <span className="text-xs text-muted-foreground"> · PAT: {p.asset_number}</span>}
                                  <X
                                    className="ml-1 h-3 w-3 cursor-pointer opacity-70"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProductOutIds((ids) => ids.filter((id) => id !== String(p.id)));
                                    }}
                                  />
                                </Badge>
                              ))}
                            {productOutIds.length === 0 && (
                              <span className="text-muted-foreground">{formatMessage('ticket_reply.inventory_product_placeholder')}</span>
                            )}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full min-w-[400px] max-w-md p-0" align="start">
                        <Command className="max-h-[300px]">
                          <CommandInput 
                            placeholder={formatMessage('ticket_reply.inventory_product_search_placeholder')}
                            value={searchOut}
                            onValueChange={setSearchOut}
                          />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>
                              <div className="py-6 text-center text-sm">
                                {formatMessage('ticket_reply.inventory_product_not_found')}
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {productsOut.map((p: any) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.serial_number || ''} ${p.service_tag || ''} ${p.asset_number || ''}`}
                                  onSelect={() => {
                                    setProductOutIds((ids) => {
                                      const strId = String(p.id);
                                      return ids.includes(strId) ? ids.filter((id) => id !== strId) : [...ids, strId];
                                    });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      productOutIds.includes(String(p.id)) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{p.name}</span>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                      {p.serial_number && <span>S/N: {p.serial_number}</span>}
                                      {p.service_tag && <span>Service Tag: {p.service_tag}</span>}
                                      {p.asset_number && <span>Patrimônio: {p.asset_number}</span>}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Checkbox para entregar para outro usuário */}
                {(movementType === 'ENTREGA_USUARIO' || movementType === 'EMPRESTIMO_TEMPORARIO') && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="deliverToOtherUser"
                      checked={deliverToOtherUser}
                      onCheckedChange={(checked) => {
                        setDeliverToOtherUser(checked === true);
                        if (!checked) {
                          setResponsibleUserId("");
                        }
                      }}
                    />
                    <Label htmlFor="deliverToOtherUser" className="font-normal cursor-pointer">
                      Entregar para outro usuário
                    </Label>
                  </div>
                )}

                {/* Seleção de usuário responsável */}
                {deliverToOtherUser && (movementType === 'ENTREGA_USUARIO' || movementType === 'EMPRESTIMO_TEMPORARIO') && (
                  <div className="space-y-2">
                    <Label>Usuário responsável *</Label>
                    <UserSearch
                      value={responsibleUserId}
                      onValueChange={setResponsibleUserId}
                      placeholder="Selecione o usuário responsável"
                    />
                  </div>
                )}

                {/* Localização */}
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Select
                    value={movementLocationId}
                    onValueChange={setMovementLocationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a localização (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location: any) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data prevista de devolução - apenas para empréstimo temporário e manutenção */}
                {(movementType === 'EMPRESTIMO_TEMPORARIO' || movementType === 'ENVIO_MANUTENCAO') && (
                  <div className="space-y-2">
                    <Label>Data prevista de devolução *</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expectedReturnDate ? (
                            format(new Date(expectedReturnDate), locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy", {
                              locale: locale === "en-US" ? enUS : ptBR,
                            })
                          ) : (
                            <span className="text-muted-foreground">Selecione a data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expectedReturnDate ? new Date(expectedReturnDate) : undefined}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              setExpectedReturnDate(format(date, "yyyy-MM-dd"));
                              setCalendarOpen(false);
                            }
                          }}
                          locale={locale === "en-US" ? enUS : ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-2">
                  <Label>{formatMessage('ticket_reply.inventory_notes')}</Label>
                  <Textarea
                    rows={3}
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Adicione observações sobre a movimentação (opcional)"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setInventoryDialogOpen(false)}
                  >
                    {formatMessage('common.cancel')}
                  </Button>
                  <Button
                    onClick={async () => {
                      const hasOut =
                        movementType === 'TROCA_EQUIPAMENTO'
                          ? Boolean(productOutId)
                          : productOutIds.length > 0;
                      if (!hasOut || (movementType === 'TROCA_EQUIPAMENTO' && !productInId)) {
                        toast({
                          title: formatMessage('ticket_reply.inventory_validation_product'),
                          variant: 'destructive',
                        });
                        return;
                      }

                      // Validação: se checkbox estiver marcado, usuário deve ser selecionado
                      if (deliverToOtherUser && !responsibleUserId) {
                        toast({
                          title: 'Selecione o usuário responsável',
                          variant: 'destructive',
                        });
                        return;
                      }

                      // Validação: data prevista é obrigatória para empréstimo temporário e manutenção
                      if ((movementType === 'EMPRESTIMO_TEMPORARIO' || movementType === 'ENVIO_MANUTENCAO') && !expectedReturnDate) {
                        toast({
                          title: 'Data prevista de devolução é obrigatória',
                          variant: 'destructive',
                        });
                        return;
                      }

                      const baseBody = {
                        quantity: 1,
                        notes: movementNotes || undefined,
                        to_location_id: movementLocationId ? Number(movementLocationId) : undefined,
                      };

                      const mapAction = (uiType: typeof movementType): 'delivery' | 'return' | 'replacement' | 'consumption' | 'reservation' => {
                        switch (uiType) {
                          case 'ENTREGA_USUARIO':
                            return 'delivery';
                          case 'DEVOLUCAO_USUARIO':
                            return 'return';
                          case 'TROCA_EQUIPAMENTO':
                            return 'replacement';
                          case 'EMPRESTIMO_TEMPORARIO':
                            return 'reservation';
                          case 'ENVIO_MANUTENCAO':
                            // Não existe 'maintenance' em action_type. Usamos 'reservation' para vincular ao ticket.
                            return 'reservation';
                          default:
                            return 'reservation';
                        }
                      };

                      const call = async (productId: number, actionUi: typeof movementType, movement: string) => {
                        const body: any = {
                          ...baseBody,
                          product_id: productId,
                          action_type: mapAction(actionUi),
                          movement_type: movement,
                        };
                        
                        // Se checkbox estiver marcado, enviar responsible_id
                        if (deliverToOtherUser && responsibleUserId) {
                          body.responsible_id = Number(responsibleUserId);
                        }
                        
                        // Adicionar data prevista de devolução para empréstimo temporário e manutenção
                        if ((actionUi === 'EMPRESTIMO_TEMPORARIO' || actionUi === 'ENVIO_MANUTENCAO') && expectedReturnDate) {
                          body.assignment = {
                            expectedReturnDate: expectedReturnDate,
                          };
                        }
                        
                        await apiRequest('POST', `/api/tickets/${ticket.id}/inventory`, body);
                      };

                      const callBatch = async (productIds: number[], actionUi: typeof movementType, movement: string) => {
                        const body: any = {
                          ...baseBody,
                          product_ids: productIds,
                          action_type: mapAction(actionUi),
                          movement_type: movement,
                        };
                        
                        // Se checkbox estiver marcado, enviar responsible_id
                        if (deliverToOtherUser && responsibleUserId) {
                          body.responsible_id = Number(responsibleUserId);
                        }
                        
                        // Adicionar data prevista de devolução para empréstimo temporário e manutenção
                        if ((actionUi === 'EMPRESTIMO_TEMPORARIO' || actionUi === 'ENVIO_MANUTENCAO') && expectedReturnDate) {
                          body.assignment = {
                            expectedReturnDate: expectedReturnDate,
                          };
                        }
                        
                        await apiRequest('POST', `/api/tickets/${ticket.id}/inventory`, body);
                      };

                      try {
                        if (movementType === 'TROCA_EQUIPAMENTO') {
                          // Troca sempre é única (1 produto sai, 1 produto entra)
                          await call(Number(productOutId), 'TROCA_EQUIPAMENTO', 'withdrawal');
                          await call(Number(productInId), 'TROCA_EQUIPAMENTO', 'entry');
                        } else if (movementType === 'ENTREGA_USUARIO') {
                          // Se múltiplos produtos, usar batch
                          if (productOutIds.length > 1) {
                            await callBatch(productOutIds.map(id => Number(id)), 'ENTREGA_USUARIO', 'withdrawal');
                          } else {
                            await call(Number(productOutIds[0]), 'ENTREGA_USUARIO', 'withdrawal');
                          }
                        } else if (movementType === 'DEVOLUCAO_USUARIO') {
                          // Se múltiplos produtos, usar batch
                          if (productOutIds.length > 1) {
                            await callBatch(productOutIds.map(id => Number(id)), 'DEVOLUCAO_USUARIO', 'entry');
                          } else {
                            await call(Number(productOutIds[0]), 'DEVOLUCAO_USUARIO', 'entry');
                          }
                        } else if (movementType === 'EMPRESTIMO_TEMPORARIO') {
                          // Se múltiplos produtos, usar batch
                          if (productOutIds.length > 1) {
                            await callBatch(productOutIds.map(id => Number(id)), 'EMPRESTIMO_TEMPORARIO', 'withdrawal');
                          } else {
                            await call(Number(productOutIds[0]), 'EMPRESTIMO_TEMPORARIO', 'withdrawal');
                          }
                        } else if (movementType === 'ENVIO_MANUTENCAO') {
                          // Se múltiplos produtos, usar batch
                          if (productOutIds.length > 1) {
                            await callBatch(productOutIds.map(id => Number(id)), 'ENVIO_MANUTENCAO', 'maintenance');
                          } else {
                            await call(Number(productOutIds[0]), 'ENVIO_MANUTENCAO', 'maintenance');
                          }
                        }

                        setInventoryDialogOpen(false);
                        setProductOutId('');
                        setProductOutIds([]);
                        setProductInId('');
                        setMovementNotes('');
                        setMovementLocationId('');
                        setDeliverToOtherUser(false);
                        setResponsibleUserId('');
                        toast({
                          title: formatMessage('ticket_reply.inventory_link_success'),
                        });
                      } catch (error: any) {
                        toast({
                          title: formatMessage('ticket_reply.inventory_link_error'),
                          description: error?.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    {formatMessage('ticket_reply.inventory_link_button')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};











