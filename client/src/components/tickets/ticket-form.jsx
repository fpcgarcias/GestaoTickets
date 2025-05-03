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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
import { insertTicketSchema } from '@shared/schema';
import { PRIORITY_LEVELS, DEPARTMENTS } from '@/lib/utils';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
export var TicketForm = function () {
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _a = useLocation(), navigate = _a[1];
    // Adicionar uma consulta para buscar os clientes
    var _b = useQuery({
        queryKey: ["/api/customers"],
    }), customersData = _b.data, isLoadingCustomers = _b.isLoading;
    // Garantir que customers é um array
    var customers = Array.isArray(customersData) ? customersData : [];
    var form = useForm({
        resolver: zodResolver(insertTicketSchema.extend({
            customerId: z.number().optional()
        })),
        defaultValues: {
            title: '',
            description: '',
            customerEmail: '',
            customerId: undefined,
            type: '',
            priority: 'medium',
            departmentId: undefined,
            incidentTypeId: undefined,
        },
    });
    var createTicketMutation = useMutation({
        mutationFn: function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest('POST', '/api/tickets', data)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        onSuccess: function (newTicket) {
            // Mostrar a notificação de sucesso primeiro
            toast({
                title: "Sucesso!",
                description: "Chamado criado com sucesso.",
            });
            
            // Forçar uma atualização imediata do estado no React Query
            queryClient.setQueryData(['/api/tickets/user-role'], (oldData) => {
                console.log('[DEBUG] Atualizando cache com novo ticket:', newTicket);
                // Se já tivermos dados, adicionamos o novo ticket ao início do array
                if (Array.isArray(oldData)) {
                    return [newTicket, ...oldData];
                }
                // Se não houver dados anteriores, retornamos um array com apenas o novo ticket
                return [newTicket];
            });
            
            // Invalidar a query para garantir que os dados serão recarregados
            // da próxima vez que a página for visitada
            queryClient.invalidateQueries({ 
                queryKey: ['/api/tickets/user-role'],
                // Definir como false para não forçar o refetch imediato, 
                // já que já incluímos o novo ticket no estado
                refetchType: 'none'
            });
            
            // Esperar um pouco antes de navegar para garantir que 
            // as atualizações de estado sejam processadas
            setTimeout(() => {
                navigate('/tickets');
            }, 100);
        },
        onError: function (error) {
            toast({
                title: "Erro",
                description: error.message || "Falha ao criar o chamado",
                variant: "destructive",
            });
        },
    });
    var onSubmit = function (data) {
        // Se um cliente foi selecionado, usar seu email
        if (data.customerId) {
            // Usar 'customers' que é garantido como array
            var selectedCustomer = customers.find(function (c) { return c.id === data.customerId; });
            if (selectedCustomer) {
                data.customerEmail = selectedCustomer.email;
            }
            console.log("[DEBUG] Enviando ticket com cliente selecionado:", 
                { customerId: data.customerId, customerEmail: data.customerEmail });
        } else {
            console.log("[DEBUG] Enviando ticket sem cliente selecionado, apenas email:", data.customerEmail);
        }
        // Não remover customerId, enviá-lo para o backend
        createTicketMutation.mutate(data);
    };
    // Buscar dados de departamentos
    var departmentsData = useQuery({
        queryKey: ["/api/settings/departments"],
        initialData: DEPARTMENTS.map(function (dept) { return ({ id: parseInt(dept.value), name: dept.label }); })
    }).data;
    // Garantir que departments é um array
    var departments = Array.isArray(departmentsData) ? departmentsData : [];
    // Buscar dados de tipos de incidentes
    var incidentTypesData = useQuery({
        queryKey: ["/api/settings/incident-types"],
    }).data;
    // Garantir que incidentTypes é um array
    var incidentTypes = Array.isArray(incidentTypesData) ? incidentTypesData : [];
    // Filtrar tipos de incidentes pelo departamento selecionado
    var selectedDepartmentId = form.watch('departmentId');
    var filteredIncidentTypes = selectedDepartmentId
        ? incidentTypes.filter(function (type) { return type.departmentId === selectedDepartmentId; })
        : incidentTypes;
    return (<Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium mb-2">Criar Novo Chamado</h2>
        <p className="text-neutral-600 mb-6">Adicione um novo chamado de suporte</p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="customerId" render={function (_a) {
            var _b;
            var field = _a.field;
            return (<FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={function (value) {
                    var customerId = parseInt(value);
                    field.onChange(customerId);
                    // Atualizar automaticamente o email
                    // Usar 'customers' que é garantido como array
                    var selectedCustomer = customers.find(function (c) { return c.id === customerId; });
                    if (selectedCustomer) {
                        form.setValue('customerEmail', selectedCustomer.email);
                    }
                }} defaultValue={(_b = field.value) === null || _b === void 0 ? void 0 : _b.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente"/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map(function (customer) { return (<SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name}
                          </SelectItem>); })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>);
        }}/>
              
              <FormField control={form.control} name="customerEmail" render={function (_a) {
            var field = _a.field;
            return (<FormItem>
                    <FormLabel>Email do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o email" {...field}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>);
        }}/>
              
              <FormField control={form.control} name="departmentId" render={function (_a) {
            var _b;
            var field = _a.field;
            return (<FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select onValueChange={function (value) {
                    // Atualizar o departamento selecionado
                    var departmentId = parseInt(value);
                    field.onChange(departmentId);
                    // Limpar o tipo de incidente quando o departamento muda
                    form.setValue('type', '');
                    form.setValue('incidentTypeId', undefined);
                }} defaultValue={(_b = field.value) === null || _b === void 0 ? void 0 : _b.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um departamento"/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(function (dept) { return (<SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>); })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>);
        }}/>
              
              <FormField control={form.control} name="type" render={function (_a) {
            var field = _a.field;
            return (<FormItem>
                    <FormLabel>Tipo de Chamado</FormLabel>
                    <Select onValueChange={function (value) {
                    field.onChange(value);
                    // Encontrar o tipo de incidente pelo ID selecionado
                    // Usar 'incidentTypes' que é garantido como array
                    var selectedType = incidentTypes.find(function (type) { return type.id.toString() === value; });
                    if (selectedType) {
                        // Atualizar o ID do tipo de incidente
                        form.setValue('incidentTypeId', selectedType.id);
                        // Atualizar o campo type com o nome do incidente (para compatibilidade)
                        form.setValue('type', selectedType.name);
                        // Se o departamento não estiver selecionado, selecionar automaticamente
                        // baseado no tipo de incidente
                        if (!form.getValues('departmentId') && selectedType.departmentId) {
                            form.setValue('departmentId', selectedType.departmentId);
                        }
                    }
                }} defaultValue={field.value} disabled={!selectedDepartmentId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedDepartmentId ? "Escolha o tipo" : "Selecione um departamento primeiro"}/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredIncidentTypes.map(function (type) { return (<SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>); })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>);
        }}/>
              
              <FormField control={form.control} name="priority" render={function (_a) {
            var field = _a.field;
            return (<FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade"/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PRIORITY_LEVELS.LOW}>Baixa</SelectItem>
                        <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Média</SelectItem>
                        <SelectItem value={PRIORITY_LEVELS.HIGH}>Alta</SelectItem>
                        <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>);
        }}/>
            </div>
            
            <FormField control={form.control} name="title" render={function (_a) {
            var field = _a.field;
            return (<FormItem>
                  <FormLabel>Título do Chamado</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o título do chamado" {...field}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>);
        }}/>
            
            <FormField control={form.control} name="description" render={function (_a) {
            var field = _a.field;
            return (<FormItem>
                  <FormLabel>Descrição do Problema</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o problema detalhadamente..." rows={6} {...field}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>);
        }}/>
            
            <div className="flex justify-end">
              <Button type="submit" className="px-6" disabled={createTicketMutation.isPending}>
                {createTicketMutation.isPending ? "Criando..." : "Enviar Chamado"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>);
};
