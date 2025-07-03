import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, FolderIcon, Search, Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Department } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';

interface DepartmentFormData {
  id?: number;
  name: string;
  description: string;
  company_id?: number | null;
  is_active: boolean;
}

const DepartmentManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState<DepartmentFormData>({
    name: '',
    description: '',
    company_id: user?.role === 'admin' ? null : user?.companyId,
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Buscar a lista de empresas (apenas para admin)
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
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

  // Buscar a lista de departamentos com paginação
  const { 
    data: departmentsResponse, 
    isLoading,
    error,
  } = useQuery<{
    departments: Department[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>({
    queryKey: ['/departments', { 
      active_only: !includeInactive, 
      search: searchTerm,
      page: currentPage,
      company_id: selectedCompanyId
    }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { 
        active_only: boolean; 
        search?: string;
        page: number;
        company_id: number | null;
      }];
      
      let url = '/api/departments';
      
      // Adicionar parâmetros de query
      const queryParams = new URLSearchParams();
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar departamentos');
      }
      
      return response.json();
    },
  });

  const departments = departmentsResponse?.departments || [];
  const pagination = departmentsResponse?.pagination;

  // Resetar página quando filtros mudarem
  const handleCompanyChange = (companyId: number | null) => {
    setSelectedCompanyId(companyId);
    setCurrentPage(1);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const handleIncludeInactiveChange = (include: boolean) => {
    setIncludeInactive(include);
    setCurrentPage(1);
  };

  // Mutation para criar departamento
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const response = await apiRequest('POST', '/api/departments', {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar departamento');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Departamento criado',
        description: 'O departamento foi criado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar departamento',
        variant: 'destructive',
      });
    },
  });

  // Mutation para atualizar departamento
  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      if (!data.id) {
        throw new Error('ID do departamento é obrigatório para atualização');
      }
      
      const response = await apiRequest('PUT', `/api/departments/${data.id}`, {
        name: data.name,
        description: data.description,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar departamento');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Departamento atualizado',
        description: 'O departamento foi atualizado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar departamento',
        variant: 'destructive',
      });
    },
  });

  // Mutation para excluir departamento
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/departments/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir departamento');
      }
      
      return id;
    },
    onSuccess: () => {
      toast({
        title: 'Departamento excluído',
        description: 'O departamento foi excluído com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir departamento',
        variant: 'destructive',
      });
    },
  });

  // Reset do formulário
  const resetForm = () => {
    setCurrentDepartment({
      name: '',
      description: '',
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
  const handleEdit = (department: Department) => {
    setCurrentDepartment({
      id: department.id,
      name: department.name,
      description: department.description || '',
      company_id: department.company_id,
      is_active: department.is_active,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Confirmar exclusão
  const handleDelete = (department: Department) => {
    setCurrentDepartment({
      id: department.id,
      name: department.name,
      description: department.description || '',
      company_id: department.company_id,
      is_active: department.is_active,
    });
    setIsDeleteDialogOpen(true);
  };

  // Confirmar ação de exclusão
  const confirmDelete = () => {
    if (currentDepartment.id) {
      deleteDepartmentMutation.mutate(currentDepartment.id);
    }
  };

  // Enviar formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se não for admin, garantir que a empresa do usuário seja usada
    const dataToSubmit = {
      ...currentDepartment,
      company_id: user?.role === 'admin' ? currentDepartment.company_id : user?.companyId
    };
    
    if (isEditing && currentDepartment.id) {
      updateDepartmentMutation.mutate(dataToSubmit);
    } else {
      createDepartmentMutation.mutate(dataToSubmit);
    }
  };

  // Atualizar campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentDepartment((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Função para obter nome da empresa
  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return 'Sistema Global';
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Sistema Global';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Departamentos</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Novo Departamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Departamentos</CardTitle>
          <CardDescription>Gerencie os departamentos disponíveis no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Buscar departamentos" 
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
                      <SelectValue placeholder="Filtrar por empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
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
                <Label htmlFor="includeInactive">Incluir inativos</Label>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 5 : 4} className="text-center py-10 text-red-500">
                    Erro ao carregar departamentos. Tente novamente mais tarde.
                  </TableCell>
                </TableRow>
              ) : departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 5 : 4} className="text-center py-10 text-neutral-500">
                    Nenhum departamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id} className={!dept.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{dept.description || "—"}</TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            {(dept as any).company?.name || getCompanyName(dept.company_id)}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {(dept.is_active === undefined || dept.is_active) ? (
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
                          onClick={() => handleEdit(dept)}
                          title="Editar departamento"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(dept)}
                          title="Excluir departamento"
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
                Mostrando {departments.length} de {pagination.total} departamentos
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Anterior
                </Button>
                <div className="text-sm text-neutral-600">
                  Página {currentPage} de {pagination.pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= pagination.pages}
                >
                  Próxima
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
            <DialogTitle>{isEditing ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize as informações do departamento abaixo.' 
                : 'Preencha as informações para criar um novo departamento.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                value={currentDepartment.name}
                onChange={handleInputChange}
                placeholder="Ex: Suporte Técnico"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={currentDepartment.description}
                onChange={handleInputChange}
                placeholder="Digite uma breve descrição..."
                rows={3}
              />
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa</Label>
                <Select
                  value={currentDepartment.company_id?.toString() || ""}
                  onValueChange={(value) => 
                    setCurrentDepartment((prev) => ({
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
                  Departamentos são vinculados a uma empresa específica
                </p>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={currentDepartment.is_active}
                onCheckedChange={(checked) => 
                  setCurrentDepartment((prev) => ({
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
                disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              >
                {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Salvar Alterações' : 'Criar Departamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Departamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o departamento "{currentDepartment.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDepartmentMutation.isPending}
            >
              {deleteDepartmentMutation.isPending && (
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

export default DepartmentManagement; 