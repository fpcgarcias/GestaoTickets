import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, FolderIcon, Search, Building2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Department } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup, SaveButton, CancelButton } from '@/components/ui/standardized-button';

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

  // Handlers padronizados
  const handleCreateDepartment = () => {
    handleCreate();
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleView = (department: Department) => {
    // Função para visualizar departamento - implementar depois
    console.log('Visualizar departamento:', department);
  };

  const handleEditDepartment = (department: Department) => {
    handleEdit(department);
  };

  const handleDeleteDepartment = (department: Department) => {
    handleDelete(department);
  };

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

  // Buscar a lista de departamentos
  const { 
    data: departments = [], 
    isLoading,
    error,
  } = useQuery<Department[]>({
    queryKey: ['/departments', { active_only: !includeInactive }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { active_only: boolean }];
      
      let url = '/api/departments';
      
      // Adicionar parâmetros de query
      const queryParams = new URLSearchParams();
      if (params.active_only) {
        queryParams.append('active_only', 'true');
      }
      
      // Adicionar parâmetros à URL se houver algum
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
      
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar departamentos');
      }
      
      return response.json();
    },
  });

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
        title: 'Erro ao criar',
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
        title: 'Erro ao atualizar',
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
        title: 'Erro ao excluir',
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

  // Handlers antigos mantidos para compatibilidade
  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (department: Department) => {
    setCurrentDepartment({
      id: department.id,
      name: department.name,
      description: department.description || '',
      company_id: (department as any).company_id || null,
      is_active: department.is_active !== false,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = (department: Department) => {
    setCurrentDepartment({
      id: department.id,
      name: department.name,
      description: department.description || '',
      company_id: (department as any).company_id || null,
      is_active: department.is_active !== false,
    });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (currentDepartment.id) {
      deleteDepartmentMutation.mutate(currentDepartment.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!currentDepartment.name.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'O nome do departamento é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    const dataToSubmit = { ...currentDepartment };
    
    if (isEditing) {
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

  // Filtrar departamentos pelo termo de busca
  const filteredDepartments = departments.filter(dept => {
    // Filtro pelo termo de busca
    const matchesSearchTerm = 
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dept.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    // Filtro pelo status ativo/inativo
    const isActive = dept.is_active === undefined ? true : dept.is_active;
    const matchesActiveFilter = includeInactive || isActive;
    
    return matchesSearchTerm && matchesActiveFilter;
  });

  // Estado de erro
  if (error) {
    return (
      <StandardPage
        icon={FolderIcon}
        title="Departamentos"
        description="Gerencie os departamentos do sistema"
        createButtonText="Novo Departamento"
        onCreateClick={handleCreateDepartment}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar departamentos..."
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {error instanceof Error ? error.message : 'Ocorreu um erro inesperado'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  // Estado vazio quando não há departamentos
  if (filteredDepartments && filteredDepartments.length === 0 && !isLoading && !searchTerm) {
    return (
      <>
        <StandardPage
          icon={FolderIcon}
          title="Departamentos"
          description="Gerencie os departamentos disponíveis no sistema"
          createButtonText="Novo Departamento"
          onCreateClick={handleCreateDepartment}
          onSearchChange={handleSearchChange}
          searchValue={searchTerm}
          searchPlaceholder="Buscar departamentos..."
        >
          <EmptyState
            icon={FolderIcon}
            title="Nenhum departamento encontrado"
            description="Não há departamentos cadastrados no sistema. Clique no botão abaixo para criar o primeiro departamento."
            actionLabel="Criar Primeiro Departamento"
            onAction={handleCreateDepartment}
          />
        </StandardPage>

        {/* Modais mantidos */}
        {renderModals()}
      </>
    );
  }

  // Função para renderizar os modais
  function renderModals() {
    return (
      <>
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
              
              <div className="space-y-2">
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
              
              <DialogFooter className="flex gap-3">
                <CancelButton
                  onClick={() => setIsDialogOpen(false)}
                  disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
                />
                <SaveButton
                  onClick={handleSubmit}
                  loading={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
                  text={isEditing ? 'Salvar Alterações' : 'Criar Departamento'}
                />
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
      </>
    );
  }

  return (
    <>
      <StandardPage
        icon={FolderIcon}
        title="Departamentos"
        description="Gerencie os departamentos disponíveis no sistema"
        createButtonText="Novo Departamento"
        onCreateClick={handleCreateDepartment}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar departamentos..."
        isLoading={isLoading}
      >
        {/* Filtro adicional para incluir inativos */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="includeInactive" 
              checked={includeInactive} 
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="includeInactive">Incluir departamentos inativos</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredDepartments ? `${filteredDepartments.length} departamento(s) encontrado(s)` : ''}
          </div>
        </div>

        {filteredDepartments && filteredDepartments.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum departamento encontrado"
            description={`Não foram encontrados departamentos com o termo "${searchTerm}".`}
            actionLabel="Limpar busca"
            onAction={() => setSearchTerm('')}
          />
        ) : (
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
              ) : (
                filteredDepartments.map((dept) => (
                  <TableRow key={dept.id} className={!dept.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{dept.description || "—"}</TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {(dept as any).company?.name || 'Sistema Global'}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge isActive={dept.is_active !== false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButtonGroup
                        onView={() => handleView(dept)}
                        onEdit={() => handleEditDepartment(dept)}
                        onDelete={() => handleDeleteDepartment(dept)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </StandardPage>

      {renderModals()}
    </>
  );
};

export default DepartmentManagement; 