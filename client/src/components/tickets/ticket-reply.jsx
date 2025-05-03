var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { insertTicketReplySchema } from '@shared/schema';
import { TICKET_STATUS } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
export var TicketReplyForm = function (_a) {
    var ticket = _a.ticket;
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _b = useLocation(), navigate = _b[1];
    // Buscar a lista de atendentes disponíveis
    var _c = useQuery({
        queryKey: ["/api/officials"],
    }), officials = _c.data, isLoadingOfficials = _c.isLoading;
    // Buscar dados de tipos de incidentes
    var incidentTypesData = useQuery({
        queryKey: ["/api/settings/incident-types"],
    }).data;
    // Garantir que incidentTypes é um array
    var incidentTypes = Array.isArray(incidentTypesData) ? incidentTypesData : [];
    
    // Buscar lista completa de clientes para encontrar pelo email
    var customersQuery = useQuery({
        queryKey: ["/api/customers"],
        staleTime: 10 * 60 * 1000, // 10 minutos
    });
    var customersList = Array.isArray(customersQuery.data) ? customersQuery.data : [];
    
    // Usar useMemo para buscar o cliente pelo email quando não houver cliente definido
    var customerData = React.useMemo(function() {
        // Se já temos dados do cliente no ticket, usamos
        if (ticket.customer && ticket.customer.name) {
            return ticket.customer;
        }
        
        // Se temos apenas o email, tentamos encontrar o cliente correspondente
        if (ticket.customerEmail && customersList.length > 0) {
            var foundCustomer = customersList.find(function(c) {
                return c.email === ticket.customerEmail;
            });
            
            if (foundCustomer) {
                console.log("[DEBUG] Encontrado cliente pelo email:", foundCustomer.name);
                return foundCustomer;
            }
        }
        
        // Caso não encontre, retorna um objeto com os dados básicos
        return {
            name: "Cliente não localizado",
            email: ticket.customerEmail || ""
        };
    }, [ticket.customer, ticket.customerEmail, customersList]);
    
    // Filtrar tipos de incidentes pelo departamento do ticket
    var filteredIncidentTypes = ticket.departmentId && Array.isArray(incidentTypes)
        ? incidentTypes.filter(function (type) { return type.departmentId === ticket.departmentId; })
        : (incidentTypes || []);
    // Estender o tipo do formulário para incluir incidentTypeId
    var formSchema = insertTicketReplySchema.extend({
        incidentTypeId: z.number().optional(),
        type: z.string().optional()
    });
    var form = useForm({
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
    var replyMutation = useMutation({
        mutationFn: function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest('POST', '/api/ticket-replies', data)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            toast({
                title: "Sucesso!",
                description: "Resposta enviada com sucesso.",
            });
            
            // Atualizar o cache do ticket específico
            queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}`] });
            
            // Atualizar imediatamente o cache na lista de tickets
            queryClient.setQueryData(['/api/tickets/user-role'], (oldData) => {
                console.log('[DEBUG] Atualizando tickets na lista após resposta (status atual):', form.getValues('status'));
                
                if (!Array.isArray(oldData)) return oldData;
                
                // Encontrar e atualizar o ticket na lista
                return oldData.map(oldTicket => {
                    if (oldTicket.id === ticket.id) {
                        console.log(`[DEBUG] Atualizando ticket ${ticket.id} na lista para status:`, form.getValues('status'));
                        return {
                            ...oldTicket,
                            status: form.getValues('status'),
                            assignedToId: form.getValues('assignedToId'),
                            // Se uma mudança de atendente foi feita, atualizar também o oficial
                            ...(form.getValues('assignedToId') !== oldTicket.assignedToId && {
                                official: {
                                    id: form.getValues('assignedToId'),
                                    name: officials?.find(o => o.id === form.getValues('assignedToId'))?.name || "Atendente"
                                }
                            })
                        };
                    }
                    return oldTicket;
                });
            });
            
            // Forçar um refetch depois para garantir sincronização
            queryClient.invalidateQueries({ queryKey: ['/api/tickets/user-role'] });
            queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
            
            // Navegar para a lista após pequeno delay 
            setTimeout(() => {
                navigate('/tickets');
            }, 300);
        },
        onError: function (error) {
            toast({
                title: "Erro",
                description: error.message || "Falha ao enviar resposta",
                variant: "destructive",
            });
        },
    });
    var onSubmit = function (data) {
        replyMutation.mutate(data);
    };
    // Encontrar o incident type pelo id ou nome, se existir
    React.useEffect(() => {
      // Se temos o incidentTypeId, tentar encontrar o tipo para mostrar no dropdown
      if (ticket.incidentTypeId && Array.isArray(incidentTypes) && incidentTypes.length > 0) {
        const selectedType = incidentTypes.find(type => type.id === ticket.incidentTypeId);
        if (selectedType) {
          // Atualizar o campo type com o nome do tipo de incidente
          form.setValue('type', selectedType.name);
          console.log("[DEBUG] Encontrado tipo de incidente pelo ID:", selectedType.name);
        }
      }
    }, [incidentTypes, ticket.incidentTypeId, form]);
    
    // Logs para debug
    console.log("[DEBUG] Valores do ticket:", {
      type: ticket.type,
      incidentTypeId: ticket.incidentTypeId,
      avaliableTypes: filteredIncidentTypes.map(t => ({ id: t.id, name: t.name }))
    });
    return (<Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-6">Responder ao Chamado</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Primeira linha: NOME DO CLIENTE, E-MAIL DO CLIENTE, TIPO DO CHAMADO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nome do Cliente */}
              <FormItem>
                <FormLabel>Nome do Cliente</FormLabel>
                <Input 
                  value={customerData.name} 
                  readOnly 
                  className="bg-neutral-50"
                />
              </FormItem>
              
              {/* E-mail do Cliente */}
              <FormItem>
                <FormLabel>E-mail do Cliente</FormLabel>
                <Input 
                  value={customerData.email} 
                  readOnly 
                  className="bg-neutral-50"
                />
              </FormItem>
              
              {/* Tipo do Chamado */}
              <FormField 
                control={form.control} 
                name="type" 
                render={function (_a) {
                  var field = _a.field;
                  const currentIncidentTypeId = form.getValues('incidentTypeId');
                  const typeValue = currentIncidentTypeId ? 
                    String(currentIncidentTypeId) : 
                    (field.value ? field.value : "");
                    
                  return (
                    <FormItem>
                      <FormLabel>Tipo de Chamado</FormLabel>
                      <Select 
                        onValueChange={function (value) {
                          if (!isNaN(parseInt(value))) {
                            const selectedType = filteredIncidentTypes.find(
                              type => type.id.toString() === value
                            );
                            if (selectedType) {
                              form.setValue('incidentTypeId', selectedType.id);
                              form.setValue('type', selectedType.name);
                              field.onChange(selectedType.name);
                            }
                          } else {
                            field.onChange(value);
                            form.setValue('incidentTypeId', undefined);
                          }
                        }} 
                        defaultValue={typeValue}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolher Tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredIncidentTypes.map(function (type) { 
                            return (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            
            {/* Segunda linha: ATENDENTE RESPONSÁVEL, STATUS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Atendente Responsável */}
              <FormField 
                control={form.control} 
                name="assignedToId" 
                render={function (_a) {
                  var field = _a.field;
                  return (
                    <FormItem>
                      <FormLabel>Atendente Responsável</FormLabel>
                      <Select 
                        onValueChange={function (value) { 
                          return field.onChange(parseInt(value)); 
                        }} 
                        defaultValue={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar Atendente"/>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingOfficials && (
                            <div className="flex items-center justify-center p-2">
                              <Loader2 className="h-4 w-4 animate-spin mr-2"/>
                              <span>Carregando atendentes...</span>
                            </div>
                          )}
                          {(officials || []).map(function (official) { 
                            return (
                              <SelectItem key={official.id} value={String(official.id)}>
                                {official.name}
                              </SelectItem>
                            ); 
                          })}
                          {(!officials || officials.length === 0) && !isLoadingOfficials && (
                            <div className="p-2 text-neutral-500 text-sm text-center">
                              Nenhum atendente encontrado
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              
              {/* Status */}
              <FormField 
                control={form.control} 
                name="status" 
                render={function (_a) {
                  var field = _a.field;
                  return (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar Status"/>
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
                  );
                }}
              />
            </div>
            
            {/* Mensagem de Resposta */}
            <FormField 
              control={form.control} 
              name="message" 
              render={function (_a) {
                var field = _a.field;
                return (
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
                );
              }}
            />
            
            <div className="flex justify-end">
              <Button type="submit" className="px-6" disabled={replyMutation.isPending}>
                {replyMutation.isPending ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>);
};
