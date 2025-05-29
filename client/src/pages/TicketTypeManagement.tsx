import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, FolderIcon, Search, Filter, Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Department, IncidentType } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';

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
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>(undefined);
  const [includeInactive, setIncludeInactive] = useState(false);
  
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
    data: departments = [], 
    isLoading: isLoadingDepartments,
  } = useQuery<Department[]>({
    queryKey: ['/departments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar departamentos');
      }
      return response.json();
    },
  });

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

  // Buscar a lista de tipos de chamado - AGORA USANDO A TABELA DEDICADA
  const { 
    data: ticketTypes = [], 
    isLoading: isLoadingTicketTypes,
    error: ticketTypesError,
  } = useQuery<IncidentType[]>({
    queryKey: ['/incident-types', { department_id: selectedDepartmentId, active_only: !includeInactive }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { department_id?: number, active_only: boolean }];
      let url = '/api/incident-types';
      
      // Adicionar parâmetros de query
      const queryParams = new URLSearchParams();
      if (params.department_id) {
        queryParams.append('department_id', params.department_id.toString());
      }
      if (params.active_only) {
        queryParams.append('active_only', 'true');
      }
      
      // Adicionar parâmetros à URL se houver algum
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
      
      console.log(`[DEBUG] Acessando URL para buscar tipos de chamado: ${url}`);
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        console.error('[ERRO] Falha ao buscar tipos de chamado:', response.status);
        try {
          const text = await response.clone().text();
          console.error('[ERRO] Resposta:', text.substring(0, 500));
        } catch (err) {
          console.error('[ERRO] Não foi possível ler o corpo da resposta');
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Erro ao processar resposta' }));
        throw new Error(errorData.error || 'Erro ao buscar tipos de chamado');
      }
      
      const data = await response.json();
      console.log('[DEBUG] Tipos de chamado recebidos:', data);
      return data;
    },
  });

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
        title: 'Tipo de chamado criado',
        description: 'O tipo de chamado foi criado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar tipo de chamado',
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
        title: 'Tipo de chamado atualizado',
        description: 'O tipo de chamado foi atualizado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar tipo de chamado',
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
        title: 'Tipo de chamado excluído',
        description: 'O tipo de chamado foi excluído com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/incident-types'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir tipo de chamado',
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
  const handleEdit = (ticketType: IncidentType) => {
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
  const handleDelete = (ticketType: IncidentType) => {
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
        title: 'Valor de referência inválido',
        description: 'O valor de referência deve conter apenas letras minúsculas, números e sublinhados (_).',
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

  // Filtrar tipos de chamado pelo termo de busca e status (ativo/inativo)
  const filteredTicketTypes = ticketTypes.filter(type => {
    // Filtro pelo termo de busca
    const matchesSearchTerm = 
      type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (type.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    // Filtro pelo status ativo/inativo
    // Consideramos todos os tipos como ativos se a propriedade is_active não estiver definida
    const isActive = type.is_active === undefined ? true : type.is_active;
    const matchesActiveFilter = includeInactive || isActive;
    
    return matchesSearchTerm && matchesActiveFilter;
  });

  const isLoading = isLoadingDepartments || isLoadingTicketTypes;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Tipos de Chamado</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Novo Tipo de Chamado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Tipos de Chamado</CardTitle>
          <CardDescription>Gerencie os tipos de chamado disponíveis no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Buscar tipos de chamado" 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="includeInactive" 
                  checked={includeInactive} 
                  onCheckedChange={setIncludeInactive}
                />
                <Label htmlFor="includeInactive">Incluir inativos</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filterDepartment" className="text-sm whitespace-nowrap">
                Filtrar por Departamento:
              </Label>
              <Select
                value={selectedDepartmentId?.toString() || 'all'}
                onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? undefined : parseInt(value))}
              >
                <SelectTrigger id="filterDepartment" className="w-[200px]">
                  <SelectValue placeholder="Todos os departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departments.map((dept) => (
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
                <TableHead>Nome</TableHead>
                <TableHead>Departamento</TableHead>
                {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                    Erro ao carregar tipos de chamado. Tente novamente mais tarde.
                  </TableCell>
                </TableRow>
              ) : filteredTicketTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                    Nenhum tipo de chamado encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTicketTypes.map((type) => (
                  <TableRow key={type.id} className={!type.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      {departments.find(d => d.id === type.department_id)?.name || "—"}
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            {type.company?.name || 'Sistema Global'}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="max-w-xs truncate">{type.description || "—"}</TableCell>
                    <TableCell>
                      {(type.is_active === undefined || type.is_active) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(type)}
                          title="Editar tipo de chamado"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(type)}
                          title="Excluir tipo de chamado"
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
        </CardContent>
      </Card>

      {/* Modal de formulário */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Tipo de Chamado' : 'Novo Tipo de Chamado'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize as informações do tipo de chamado abaixo.' 
                : 'Preencha as informações para criar um novo tipo de chamado.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Tipo</Label>
              <Input
                id="name"
                name="name"
                value={currentTicketType.name}
                onChange={handleInputChange}
                placeholder="Ex: Problema de Conexão"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={currentTicketType.description}
                onChange={handleInputChange}
                placeholder="Digite uma breve descrição..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department_id">Departamento</Label>
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
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa</Label>
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
                    <SelectValue placeholder="Selecione uma empresa" />
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
                  Tipos de chamado são vinculados a uma empresa específica
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="is_active">Ativo</Label>
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
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createTicketTypeMutation.isPending || updateTicketTypeMutation.isPending}
              >
                {(createTicketTypeMutation.isPending || updateTicketTypeMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Salvar Alterações' : 'Criar Tipo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o tipo de chamado "{currentTicketType.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTicketTypeMutation.isPending}
            >
              {deleteTicketTypeMutation.isPending && (
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TicketTypeManagement; 