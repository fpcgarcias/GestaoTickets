import React, { useEffect, useState } from 'react';
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
import { insertTicketSchema, type InsertTicket } from '@shared/schema';
import { TICKET_TYPES, PRIORITY_LEVELS } from '@/lib/utils';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { FileUpload } from './file-upload';

// Garante que PRIORITY_LEVELS.LOW etc. sejam tratados como literais específicos.
// Zod z.enum requer um array não vazio de strings literais.
const ZOD_PRIORITY_ENUM_VALUES = [
  PRIORITY_LEVELS.LOW, 
  PRIORITY_LEVELS.MEDIUM, 
  PRIORITY_LEVELS.HIGH, 
  PRIORITY_LEVELS.CRITICAL
] as const;

// Definir o schema estendido para o formulário
const extendedInsertTicketSchema = insertTicketSchema.extend({
  customerId: z.number().optional(), // Para o select do formulário
  // Sobrescreve/Define priority para garantir que seja o enum dos valores corretos e obrigatório
  priority: z.enum(ZOD_PRIORITY_ENUM_VALUES), 
});

// Inferir o tipo a partir do schema estendido
type ExtendedInsertTicket = z.infer<typeof extendedInsertTicketSchema>;

// Definir tipos para os dados buscados
interface Customer {
  id: number;
  name: string;
  email: string;
}

interface IncidentType {
  id: number;
  name: string;
  value: string;
  department_id: number;
}

interface Department {
  id: number;
  name: string;
}

export const TicketForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Estado para gerenciar arquivos pendentes
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Adicionar uma consulta para buscar os clientes, habilitada apenas se não for 'customer'
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: user?.role !== 'customer', // Desabilitar para 'customer'
  });

  // Garantir que customers é um array
  const customers = Array.isArray(customersData) ? customersData : [];

  const form = useForm<ExtendedInsertTicket>({
    resolver: zodResolver(extendedInsertTicketSchema),
    defaultValues: {
      title: '',
      description: '',
      customer_email: '',
      customerId: undefined,
      type: '',
      priority: 'medium' as const,
      department_id: undefined,
      incident_type_id: undefined,
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: InsertTicket) => {
      const response = await apiRequest('POST', '/api/tickets', data);
      return response.json();
    },
    onSuccess: async (createdTicket) => {
      // Se há arquivos pendentes, fazer upload
      if (pendingFiles.length > 0) {
        setIsUploadingFiles(true);
        try {
          for (const file of pendingFiles) {
            const formData = new FormData();
            formData.append('file', file);
            
            const uploadResponse = await fetch(`/api/tickets/${createdTicket.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(`Erro no upload de ${file.name}: ${errorData.message || 'Erro desconhecido'}`);
            }
          }
          
          toast({
            title: "Sucesso!",
            description: `Chamado criado com sucesso e ${pendingFiles.length} arquivo(s) anexado(s).`,
          });
        } catch (error) {
          toast({
            title: "Chamado criado com aviso",
            description: `Chamado criado, mas houve erro no upload de arquivos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            variant: "destructive",
          });
        } finally {
          setIsUploadingFiles(false);
          setPendingFiles([]);
        }
      } else {
        toast({
          title: "Sucesso!",
          description: "Chamado criado com sucesso.",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/user-role'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      navigate('/tickets');
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar o chamado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExtendedInsertTicket) => {
    let ticketDataToSend: InsertTicket = {
      title: data.title,
      description: data.description,
      customer_email: data.customer_email,
      type: data.type,
      priority: data.priority,
      department_id: data.department_id,
      incident_type_id: data.incident_type_id,
      // customer_id e company_id serão definidos abaixo ou já estão no data
    };

    if (user?.role === 'customer') {
      // Para 'customer', usar dados do usuário logado
      ticketDataToSend.customer_email = user.email;
      // Assumindo que user.id é o ID do cliente. Se for diferente, ajuste aqui.
      // E que o backend espera customer_id.
      if (user.id) { // user.id pode ser string ou number dependendo da sua definição de AuthUser
        (ticketDataToSend as any).customer_id = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      }
      // Se o usuário customer tiver company_id e for necessário
      if (user.companyId) { // Corrigido de user.company_id para user.companyId
        (ticketDataToSend as any).company_id = user.companyId; // Corrigido de user.company_id para user.companyId
      }
    } else {
      // Para outras roles, usar o cliente selecionado no formulário
      if (data.customerId) {
        const selectedCustomer = customers.find((c: Customer) => c.id === data.customerId);
        if (selectedCustomer) {
          ticketDataToSend.customer_email = selectedCustomer.email;
          (ticketDataToSend as any).customer_id = selectedCustomer.id;
          // Se o cliente selecionado tiver company_id e for necessário
          // (ticketDataToSend as any).company_id = selectedCustomer.company_id; // Ajuste conforme a estrutura de Customer
        }
      }
    }
    
    createTicketMutation.mutate(ticketDataToSend);
  };

  // Buscar dados de departamentos
  const { data: departmentsData } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Garantir que departments é um array
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Buscar dados de tipos de incidentes
  const { data: incidentTypesData } = useQuery<IncidentType[]>({
    queryKey: ["/api/incident-types"],
  });

  // Garantir que incidentTypes é um array
  const incidentTypes = Array.isArray(incidentTypesData) ? incidentTypesData : [];

  // Filtrar tipos de incidentes pelo departamento selecionado
  const selectedDepartmentId = form.watch('department_id');
  const filteredIncidentTypes = selectedDepartmentId 
    ? incidentTypes.filter((type: IncidentType) => type.department_id === selectedDepartmentId)
    : incidentTypes;

  // Efeito para pré-selecionar o cliente quando o usuário for customer
  useEffect(() => {
    if (user?.role === 'customer') {
      // Pré-selecionar o cliente e email diretamente dos dados do usuário
      form.setValue('customer_email', user.email);
      if (user.id) { // Certifique-se que user.id é o esperado para customerId
        // O campo 'customerId' no formulário é usado para o select,
        // mas para o 'customer' não há select, então isso pode não ser estritamente necessário
        // a menos que outra lógica dependa dele.
        // form.setValue('customerId', typeof user.id === 'string' ? parseInt(user.id) : user.id);
      }
      // Forçar atualização do campo de email se necessário (geralmente React Hook Form cuida disso)
      // O campo nome do cliente já deve ser preenchido pelo `value` do Input.
    } else if (customers.length > 0) {
      // Lógica existente para outras roles, se necessário, ou pode ser removida se
      // a seleção do cliente já cobre isso.
      // Este bloco pode ser redundante se o Select já define o email ao mudar o cliente.
    }
  }, [user, customers, form]);

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium mb-2">Criar Novo Chamado</h2>
        <p className="text-neutral-600 mb-6">Adicione um novo chamado de suporte</p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    {user?.role === 'customer' ? (
                      // Se for cliente, mostrar o nome do próprio cliente sem opção de mudança
                      <Input 
                        value={user?.name || ''} // Usar user.name diretamente
                        disabled
                        className="bg-gray-100"
                      />
                    ) : (
                      // Se for admin/support, mostrar a lista de seleção
                      <Select
                        onValueChange={(value) => {
                          const customerId = parseInt(value);
                          field.onChange(customerId);
                          
                          // Atualizar automaticamente o email
                          // Usar 'customers' que é garantido como array
                          const selectedCustomer = customers.find((c: Customer) => c.id === customerId);
                          if (selectedCustomer) {
                            form.setValue('customer_email', selectedCustomer.email);
                          }
                        }}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger disabled={isLoadingCustomers || user?.role === 'customer'}>
                            <SelectValue placeholder={isLoadingCustomers ? "Carregando clientes..." : "Selecione um cliente"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer: Customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email do Cliente</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite o email" 
                        value={field.value} 
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        disabled={user?.role === 'customer' || (user?.role !== 'customer' && !form.getValues('customerId'))} // Desabilitar se não for customer e nenhum cliente selecionado
                        className={user?.role === 'customer' ? "bg-gray-100" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        // Atualizar o departamento selecionado
                        const departmentId = parseInt(value);
                        field.onChange(departmentId);
                        
                        // Limpar o tipo de incidente quando o departamento muda
                        form.setValue('type', '');
                        form.setValue('incident_type_id', undefined);
                      }} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um departamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept: Department) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Chamado</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        
                        // Encontrar o tipo de incidente pelo valor selecionado
                        // Usar 'incidentTypes' que é garantido como array
                        const selectedType = incidentTypes.find((type: IncidentType) => type.value === value);
                        if (selectedType) {
                          // Atualizar o ID do tipo de incidente
                          form.setValue('incident_type_id', selectedType.id);
                          
                          // Se o departamento não estiver selecionado, selecionar automaticamente
                          // baseado no tipo de incidente
                          if (!form.getValues('department_id') && selectedType.department_id) {
                            form.setValue('department_id', selectedType.department_id);
                          }
                        }
                      }} 
                      defaultValue={field.value}
                      disabled={!selectedDepartmentId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedDepartmentId ? "Escolha o tipo" : "Selecione um departamento primeiro"} />
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade" />
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
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Chamado</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o título do chamado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Problema</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o problema detalhadamente..." 
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
                <h4 className="text-sm font-medium text-gray-900">Anexar Arquivos (Opcional)</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Adicione documentos, imagens ou outros arquivos que ajudem a descrever o problema.
                  Os arquivos serão anexados após a criação do chamado.
                </p>
              </div>

              {/* Preview simples dos arquivos selecionados */}
              {pendingFiles.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Arquivos selecionados ({pendingFiles.length}):
                  </h5>
                  <div className="space-y-2">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">{file.name}</span>
                          <span className="text-xs text-gray-400">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPendingFiles(prev => prev.filter((_, i) => i !== index));
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Área de seleção de arquivos */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setPendingFiles(prev => [...prev, ...files]);
                    e.target.value = ''; // Limpar para permitir reenvio
                  }}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">
                      Clique para selecionar arquivos
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      PDF, DOC, TXT, imagens, ZIP (máx. 10MB cada)
                    </span>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="px-6"
                disabled={createTicketMutation.isPending || isUploadingFiles}
              >
                {createTicketMutation.isPending 
                  ? "Criando..." 
                  : isUploadingFiles 
                    ? "Anexando arquivos..." 
                    : "Enviar Chamado"
                }
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
