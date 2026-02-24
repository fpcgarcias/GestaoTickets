import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, Search, Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Department } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';

interface TicketTypeFormData {
  id?: number;
  name: string;
  value: string;
  description: string;
  department_id: number | undefined;
  company_id?: number | null;
  is_active: boolean;
}

const TicketTypeManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>(undefined);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentTicketType, setCurrentTicketType] = useState<TicketTypeFormData>({
    name: '',
    value: '',
    description: '',
    department_id: undefined,
    company_id: user?.role === 'admin' ? null : user?.companyId,
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Buscar a lista de departamentos - AGORA USANDO A TABELA DEDICADA
  const { 
    data: departmentsResponse, 
    isLoading: isLoadingDepartments,
  } = useQuery<{
    departments: Department[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>({
    queryKey: ['/departments', { active_only: true }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments?active_only=true');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar departamentos');
      }
      return response.json();
    },
  });

  const departments = departmentsResponse?.departments || [];

  // 🎯 Departamentos permitidos: a API GET /api/departments já filtra por role.
  // Admin/Company_admin: todos (da empresa ou sistema). Manager/Supervisor/Support: apenas os vinculados ao usuário.
  const allowedDepartments = React.useMemo(() => {
    if (!user) return [];
    return departments;
  }, [user, departments]);

  // 🔒 IDs dos departamentos permitidos para filtrar tipos de chamado
  const allowedDepartmentIds = React.useMemo(() => {
    return allowedDepartments.map(dept => dept.id);
  }, [allowedDepartments]);

  // Buscar a lista de empresas (apenas para admin)
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar empresas');
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Buscar a lista de tipos de chamado com paginação
  const { 
    data: ticketTypesResponse, 
    isLoading: isLoadingTicketTypes,
    error: ticketTypesError,
  } = useQuery<{
    incidentTypes: any[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>({
    queryKey: ['/incident-types', { 
      department_id: selectedDepartmentId, 
      active_only: !includeInactive,
      search: searchTerm,
      page: currentPage,
      company_id: selectedCompanyId,
      allowed_departments: allowedDepartmentIds
    }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { 
        department_id?: number;
        active_only: boolean;
        search?: string;
        page: number;
        company_id: number | null;
        allowed_departments: number[];
      }];
      let url = '/api/incident-types';
      
      // Adicionar parâmetros de query
      const queryParams = new URLSearchParams();
      if (params.department_id) {
        queryParams.append('department_id', params.department_id.toString());
      }
      if (params.active_only) {
        queryParams.append('active_only', 'true');
      }
      if (params.search && params.search.trim()) {
        queryParams.append('search', params.search.trim());
      }
      queryParams.append('page', params.page.toString());
      queryParams.append('limit', '50');
      if (params.company_id) {
        queryParams.append('company_id', params.company_id.toString());
      }
      
      // Adicionar parâmetros à URL
      url += `?${queryParams.toString()}`;
      
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[ERRO] Falha ao buscar tipos de chamado:', response.status);
        }
        try {
          const text = await response.clone().text();
          if (process.env.NODE_ENV !== 'production') {
            console.error('[ERRO] Resposta:', text.substring(0, 500));
          }
        } catch (_err) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[ERRO] Não foi possível ler o corpo da resposta');
          }
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Erro ao processar resposta' }));
        throw new Error(errorData.error || 'Erro ao buscar tipos de chamado');
      }
      
      const data = await response.json();
      return data;
    },
  });

  // 🔍 Filtrar tipos de chamado pelos departamentos permitidos
  const rawTicketTypes = ticketTypesResponse?.incidentTypes || [];
  
  const ticketTypes = React.useMemo(() => {
    if (!user) return [];
    
    // Admin vê todos
    if (user.role === 'admin') {
      return rawTicketTypes;
    }
    
    // Company_admin vê todos da sua empresa (já filtrado pela API)
    if (user.role === 'company_admin') {
      return rawTicketTypes;
    }
    
    // Manager/Supervisor/Support veem apenas dos seus departamentos
    if (['manager', 'supervisor', 'support'].includes(user.role)) {
      return rawTicketTypes.filter((type: any) => 
        allowedDepartmentIds.includes(type.department_id)
      );
    }
    
    return rawTicketTypes;
  }, [rawTicketTypes, user, allowedDepartmentIds]);
  const pagination = ticketTypesResponse?.pagination;

  // Resetar página quando filtros mudarem
  const handleCompanyChange = (companyId: number | null) => {
    setSelectedCompanyId(companyId);
    setCurrentPage(1);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const handleDepartmentChange = (departmentId: number | undefined) => {
    setSelectedDepartmentId(departmentId);
    setCurrentPage(1);
  };

  const handleIncludeInactiveChange = (include: boolean) => {
    setIncludeInactive(include);
    setCurrentPage(1);
  };

  // Mutation para criar tipo de chamado
  const createTicketTypeMutation = useMutation({
    mutationFn: async (data: TicketTypeFormData) => {
      // Usar a API diretamente
      const response = await apiRequest('POST', '/api/incident-types', {
        name: data.name,
        value: data.value,
        description: data.description || '',
        department_id: data.department_id,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar tipo de chamado');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('ticket_types.add_ticket_type_dialog.created_success'),
        description: formatMessage('ticket_types.add_ticket_type_dialog.created_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: formatMessage('ticket_types.add_ticket_type_dialog.error_title'),
        description: error instanceof Error ? error.message : formatMessage('ticket_types.add_ticket_type_dialog.error_title'),
        variant: 'destructive',
      });
    },
  });

  // Mutation para atualizar tipo de chamado
  const updateTicketTypeMutation = useMutation({
    mutationFn: async (data: TicketTypeFormData) => {
      // Usar a API diretamente
      if (!data.id) {
        throw new Error('ID do tipo de chamado é obrigatório para atualização');
      }
      
      const response = await apiRequest('PUT', `/api/incident-types/${data.id}`, {
        name: data.name,
        value: data.value,
        description: data.description || '',
        department_id: data.department_id,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar tipo de chamado');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('ticket_types.edit_ticket_type_dialog.updated_success'),
        description: formatMessage('ticket_types.edit_ticket_type_dialog.updated_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: formatMessage('ticket_types.edit_ticket_type_dialog.error_title'),
        description: error instanceof Error ? error.message : formatMessage('ticket_types.edit_ticket_type_dialog.error_title'),
        variant: 'destructive',
      });
    },
  });

  // Mutation para excluir tipo de chamado
  const deleteTicketTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      // Usar a API diretamente
      const response = await apiRequest('DELETE', `/api/incident-types/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir tipo de chamado');
      }
      
      return id;
    },
    onSuccess: () => {
      toast({
        title: formatMessage('ticket_types.delete_ticket_type_dialog.deleted_success'),
        description: formatMessage('ticket_types.delete_ticket_type_dialog.deleted_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      // Mostrar mensagem de erro mais específica
      let errorMessage = error instanceof Error ? error.message : formatMessage('ticket_types.delete_ticket_type_dialog.error_title');
      
      // Traduzir mensagens específicas do backend
      if (errorMessage.includes('vinculado a') && errorMessage.includes('chamado(s)')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('ticket_types.delete_ticket_type_dialog.linked_to_tickets', { count });
      } else if (errorMessage.includes('vinculado a') && errorMessage.includes('categoria(s)')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('ticket_types.delete_ticket_type_dialog.linked_to_categories', { count });
      }
      
      toast({
        title: formatMessage('ticket_types.delete_ticket_type_dialog.error_title'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Reset do formulário
  const resetForm = () => {
    setCurrentTicketType({
      name: '',
      value: '',
      description: '',
      department_id: undefined,
      company_id: user?.role === 'admin' ? null : user?.companyId,
      is_active: true,
    });
    setIsEditing(false);
  };

  // Abrir formulário para criação
  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Abrir formulário para edição
  const handleEdit = (ticketType: any) => {
    setCurrentTicketType({
      id: ticketType.id,
      name: ticketType.name,
      value: ticketType.value,
      description: ticketType.description || '',
      department_id: ticketType.department_id ?? undefined,
      company_id: ticketType.company_id,
      is_active: ticketType.is_active,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Confirmar exclusão
  const handleDelete = (ticketType: any) => {
    setCurrentTicketType({
      id: ticketType.id,
      name: ticketType.name,
      value: ticketType.value,
      description: ticketType.description || '',
      department_id: ticketType.department_id ?? undefined,
      company_id: ticketType.company_id,
      is_active: ticketType.is_active,
    });
    setIsDeleteDialogOpen(true);
  };

  // Confirmar ação de exclusão
  const confirmDelete = () => {
    if (currentTicketType.id) {
      deleteTicketTypeMutation.mutate(currentTicketType.id);
    }
  };

  // Enviar formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar valor de referência - apenas letras, números e sublinhados
    if (!/^[a-z0-9_]+$/.test(currentTicketType.value)) {
      toast({
        title: formatMessage('ticket_types.add_ticket_type_dialog.invalid_value'),
        description: formatMessage('ticket_types.add_ticket_type_dialog.invalid_value_desc'),
        variant: 'destructive',
      });
      return;
    }
    
    // Se não for admin, garantir que a empresa do usuário seja usada
    const dataToSubmit = {
      ...currentTicketType,
      company_id: user?.role === 'admin' ? currentTicketType.company_id : user?.companyId
    };
    
    if (isEditing && currentTicketType.id) {
      updateTicketTypeMutation.mutate(dataToSubmit);
    } else {
      createTicketTypeMutation.mutate(dataToSubmit);
    }
  };

  // Atualizar campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentTicketType((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Sempre gerar um valor de referência automaticamente com base no nome
  useEffect(() => {
    if (currentTicketType.name) {
      // Converter para minúsculas, substituir espaços por underscore, remover caracteres especiais
      const value = currentTicketType.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      setCurrentTicketType((prev) => ({
        ...prev,
        value,
      }));
    }
  }, [currentTicketType.name]);

  // Função para obter nome da empresa
  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return formatMessage('ticket_types.global_system');
    const company = companies.find(c => c.id === companyId);
    return company?.name || formatMessage('ticket_types.company_not_found');
  };

  const isLoading = isLoadingDepartments || isLoadingTicketTypes;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('ticket_types.title')}</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          {formatMessage('ticket_types.new_ticket_type')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('ticket_types.management_title')}</CardTitle>
          <CardDescription>{formatMessage('ticket_types.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder={formatMessage('ticket_types.search_placeholder')} 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              
              {user?.role === 'admin' && (
                <div className="w-64">
                  <Select
                    value={selectedCompanyId?.toString() || "all"}
                    onValueChange={(value) => handleCompanyChange(value === "all" ? null : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('ticket_types.filter_by_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('ticket_types.all_companies')}</SelectItem>
                      {companies.map((company: any) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="includeInactive" 
                  checked={includeInactive} 
                  onCheckedChange={handleIncludeInactiveChange}
                />
                <Label htmlFor="includeInactive">{formatMessage('ticket_types.include_inactive')}</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filterDepartment" className="text-sm whitespace-nowrap">
                {formatMessage('ticket_types.filter_by_department')}
              </Label>
              <Select
                value={selectedDepartmentId?.toString() || 'all'}
                onValueChange={(value) => handleDepartmentChange(value === 'all' ? undefined : parseInt(value))}
              >
                <SelectTrigger id="filterDepartment" className="w-[200px]">
                  <SelectValue placeholder={formatMessage('ticket_types.all_departments')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {user?.role === 'admin' ? formatMessage('ticket_types.all_departments') : formatMessage('ticket_types.my_departments')}
                  </SelectItem>
                  {allowedDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{formatMessage('ticket_types.name')}</TableHead>
                <TableHead>{formatMessage('ticket_types.department')}</TableHead>
                {user?.role === 'admin' && <TableHead>{formatMessage('ticket_types.company')}</TableHead>}
                <TableHead>{formatMessage('ticket_types.description')}</TableHead>
                <TableHead>{formatMessage('ticket_types.status')}</TableHead>
                <TableHead className="text-right">{formatMessage('ticket_types.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : ticketTypesError ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-red-500">
                    {formatMessage('ticket_types.error_loading')}
                  </TableCell>
                </TableRow>
              ) : ticketTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                    {formatMessage('ticket_types.no_ticket_types_found')}
                  </TableCell>
                </TableRow>
              ) : (
                ticketTypes.map((type: any) => (
                  <TableRow key={type.id} className={!type.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      {allowedDepartments.find(d => d.id === type.department_id)?.name || "—"}
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            {type.company?.name || getCompanyName(type.company_id)}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="max-w-xs truncate">{type.description || "—"}</TableCell>
                    <TableCell>
                      {(type.is_active === undefined || type.is_active) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {formatMessage('ticket_types.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {formatMessage('ticket_types.inactive')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(type)}
                          title={formatMessage('ticket_types.edit_ticket_type')}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(type)}
                          title={formatMessage('ticket_types.delete_ticket_type')}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-neutral-600">
                {formatMessage('ticket_types.showing_results', { count: ticketTypes.length, total: pagination.total })}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  {formatMessage('ticket_types.previous')}
                </Button>
                <div className="text-sm text-neutral-600">
                  {formatMessage('ticket_types.page')} {currentPage} {formatMessage('ticket_types.of')} {pagination.pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= pagination.pages}
                >
                  {formatMessage('ticket_types.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de formulário */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? formatMessage('ticket_types.edit_ticket_type_dialog.title') : formatMessage('ticket_types.add_ticket_type_dialog.title')}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? formatMessage('ticket_types.edit_ticket_type_dialog.description')
                : formatMessage('ticket_types.add_ticket_type_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{formatMessage('ticket_types.add_ticket_type_dialog.name')}</Label>
              <Input
                id="name"
                name="name"
                value={currentTicketType.name}
                onChange={handleInputChange}
                placeholder={formatMessage('ticket_types.add_ticket_type_dialog.name_placeholder')}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">{formatMessage('ticket_types.add_ticket_type_dialog.description')}</Label>
              <Textarea
                id="description"
                name="description"
                value={currentTicketType.description}
                onChange={handleInputChange}
                placeholder={formatMessage('ticket_types.add_ticket_type_dialog.description_placeholder')}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department_id">{formatMessage('ticket_types.add_ticket_type_dialog.department')}</Label>
              <Select
                value={currentTicketType.department_id?.toString() || ''}
                onValueChange={(value) => 
                  setCurrentTicketType((prev) => ({
                    ...prev,
                    department_id: value ? parseInt(value) : undefined,
                  }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage('ticket_types.add_ticket_type_dialog.department_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allowedDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">{formatMessage('ticket_types.add_ticket_type_dialog.company')}</Label>
                <Select
                  value={currentTicketType.company_id?.toString() || ""}
                  onValueChange={(value) => 
                    setCurrentTicketType((prev) => ({
                      ...prev,
                      company_id: value ? parseInt(value) : null,
                    }))
                  }
                >
                  <SelectTrigger id="company_id">
                    <SelectValue placeholder={formatMessage('ticket_types.add_ticket_type_dialog.company_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formatMessage('ticket_types.add_ticket_type_dialog.company_help')}
                </p>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Label htmlFor="is_active">{formatMessage('ticket_types.add_ticket_type_dialog.active')}</Label>
              <Switch
                id="is_active"
                checked={currentTicketType.is_active}
                onCheckedChange={(checked) => 
                  setCurrentTicketType((prev) => ({
                    ...prev,
                    is_active: checked,
                  }))
                }
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {formatMessage('ticket_types.add_ticket_type_dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createTicketTypeMutation.isPending || updateTicketTypeMutation.isPending}
              >
                {(createTicketTypeMutation.isPending || updateTicketTypeMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? formatMessage('ticket_types.edit_ticket_type_dialog.save') : formatMessage('ticket_types.add_ticket_type_dialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{formatMessage('ticket_types.delete_ticket_type_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage('ticket_types.delete_ticket_type_dialog.description', { name: currentTicketType.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{formatMessage('ticket_types.delete_ticket_type_dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTicketTypeMutation.isPending}
            >
              {deleteTicketTypeMutation.isPending && (
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              {formatMessage('ticket_types.delete_ticket_type_dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TicketTypeManagement; 