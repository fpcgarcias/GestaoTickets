import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, Grid3X3, Search, Building2, TagIcon, FolderIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Category, IncidentType, Department } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';

interface CategoryFormData {
  id?: number;
  name: string;
  description: string;
  incident_type_id: number | undefined;
  company_id?: number | null;
  is_active: boolean;
}

const CategoryManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncidentTypeId, setSelectedIncidentTypeId] = useState<number | undefined>(undefined);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<CategoryFormData>({
    name: '',
    description: '',
    incident_type_id: undefined,
    company_id: user?.role === 'admin' ? null : user?.companyId,
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Buscar a lista de tipos de incidente
  const { 
    data: incidentTypesResponse, 
    isLoading: isLoadingIncidentTypes,
  } = useQuery<{
    incidentTypes: IncidentType[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>({
    queryKey: ['/incident-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/incident-types?limit=1000');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar tipos de incidente');
      }
      return response.json();
    },
  });

  const incidentTypes = incidentTypesResponse?.incidentTypes || [];

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

  // Buscar a lista de categorias com paginação
  const { 
    data: categoriesResponse, 
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<{
    categories: any[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>({
    queryKey: ['/categories', { 
      incident_type_id: selectedIncidentTypeId,
      active_only: !includeInactive,
      search: searchTerm,
      page: currentPage,
      company_id: selectedCompanyId
    }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { 
        incident_type_id?: number;
        active_only: boolean;
        search?: string;
        page: number;
        company_id: number | null;
      }];
      
      let url = '/api/categories';
      
      // Adicionar parâmetros de query
      const queryParams = new URLSearchParams();
      if (params.incident_type_id) {
        queryParams.append('incident_type_id', params.incident_type_id.toString());
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
        console.error('[ERRO] Falha ao buscar categorias:', response.status);
        try {
          const text = await response.clone().text();
          console.error('[ERRO] Resposta:', text.substring(0, 500));
        } catch (e) {
          console.error('[ERRO] Não foi possível ler texto da resposta');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar categorias');
      }
      
      return response.json();
    },
  });

  const categories = categoriesResponse?.categories || [];
  const pagination = categoriesResponse?.pagination;

  // Resetar página quando filtros mudarem
  const handleCompanyChange = (companyId: number | null) => {
    setSelectedCompanyId(companyId);
    setCurrentPage(1);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const handleIncidentTypeChange = (incidentTypeId: number | undefined) => {
    setSelectedIncidentTypeId(incidentTypeId);
    setCurrentPage(1);
  };

  const handleIncludeInactiveChange = (include: boolean) => {
    setIncludeInactive(include);
    setCurrentPage(1);
  };

  // Mutation para criar categoria
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiRequest('POST', '/api/categories', {
        name: data.name,
        description: data.description,
        incident_type_id: data.incident_type_id,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar categoria');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Categoria criada',
        description: 'A categoria foi criada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/categories'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar categoria',
        variant: 'destructive',
      });
    },
  });

  // Mutation para atualizar categoria
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (!data.id) {
        throw new Error('ID da categoria é obrigatório para atualização');
      }
      
      const response = await apiRequest('PUT', `/api/categories/${data.id}`, {
        name: data.name,
        description: data.description,
        incident_type_id: data.incident_type_id,
        company_id: data.company_id,
        is_active: data.is_active
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar categoria');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Categoria atualizada',
        description: 'A categoria foi atualizada com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/categories'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar categoria',
        variant: 'destructive',
      });
    },
  });

  // Mutation para excluir categoria
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/categories/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir categoria');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Categoria excluída',
        description: 'A categoria foi excluída com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/categories'] });
      setIsDeleteDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir categoria',
        variant: 'destructive',
      });
    },
  });

  // Resetar formulário
  const resetForm = () => {
    setCurrentCategory({
      name: '',
      description: '',
      incident_type_id: undefined,
      company_id: user?.role === 'admin' ? null : user?.companyId,
      is_active: true,
    });
    setIsEditing(false);
  };

  // Manipuladores de ações
  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (category: any) => {
    setCurrentCategory({
      id: category.id,
      name: category.name,
      description: category.description || '',
      incident_type_id: category.incident_type_id,
      company_id: category.company_id,
      is_active: category.is_active,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = (category: any) => {
    setCurrentCategory({
      id: category.id,
      name: category.name,
      description: category.description || '',
      incident_type_id: category.incident_type_id,
      company_id: category.company_id,
      is_active: category.is_active,
    });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (currentCategory.id) {
      deleteCategoryMutation.mutate(currentCategory.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCategory.name || !currentCategory.incident_type_id) {
      toast({
        title: 'Erro',
        description: 'Nome e tipo de incidente são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const dataToSubmit = {
      ...currentCategory,
      company_id: user?.role === 'admin' ? currentCategory.company_id : user?.companyId
    };
    
    if (isEditing && currentCategory.id) {
      updateCategoryMutation.mutate(dataToSubmit);
    } else {
      createCategoryMutation.mutate(dataToSubmit);
    }
  };

  // Atualizar campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentCategory((prev) => ({
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

  // Função para obter nome do tipo de incidente
  const getIncidentTypeName = (incidentTypeId: number) => {
    const incidentType = incidentTypes.find(it => it.id === incidentTypeId);
    return incidentType?.name || 'Não encontrado';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Categorias</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          Nova Categoria
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Categorias</CardTitle>
          <CardDescription>Gerencie as categorias disponíveis por tipo de incidente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Buscar categorias" 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              
              <div className="w-64">
                <Select
                  value={selectedIncidentTypeId?.toString() || "all"}
                  onValueChange={(value) => handleIncidentTypeChange(value === "all" ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {incidentTypes.map((incidentType) => (
                      <SelectItem key={incidentType.id} value={incidentType.id.toString()}>
                        {incidentType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <TableHead>Tipo de Incidente</TableHead>
                <TableHead>Departamento</TableHead>
                {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingCategories ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : categoriesError ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 8 : 7} className="text-center py-10 text-red-500">
                    Erro ao carregar categorias. Tente novamente mais tarde.
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 7 : 6} className="text-center py-10 text-neutral-500">
                    Nenhuma categoria encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} className={!category.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{category.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4 text-neutral-500" />
                        <span className="text-sm text-neutral-600">
                          {category.incident_type_name || getIncidentTypeName(category.incident_type_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-neutral-500" />
                        <span className="text-sm text-neutral-600">
                          {category.department_name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            {getCompanyName(category.company_id)}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {(category.is_active === undefined || category.is_active) ? (
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
                          onClick={() => handleEdit(category)}
                          title="Editar categoria"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(category)}
                          title="Excluir categoria"
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
                Mostrando {categories.length} de {pagination.total} categorias
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
            <DialogTitle>{isEditing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize as informações da categoria abaixo.' 
                : 'Preencha as informações para criar uma nova categoria.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                value={currentCategory.name}
                onChange={handleInputChange}
                placeholder="Ex: Hardware"
                required
              />
            </div>
            

            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={currentCategory.description}
                onChange={handleInputChange}
                placeholder="Digite uma breve descrição..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="incident_type_id">Tipo de Incidente</Label>
              <Select
                value={currentCategory.incident_type_id?.toString() || ""}
                onValueChange={(value) => 
                  setCurrentCategory((prev) => ({
                    ...prev,
                    incident_type_id: parseInt(value),
                  }))
                }
              >
                <SelectTrigger id="incident_type_id">
                  <SelectValue placeholder="Selecione um tipo de incidente" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((incidentType) => (
                    <SelectItem key={incidentType.id} value={incidentType.id.toString()}>
                      {incidentType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa</Label>
                <Select
                  value={currentCategory.company_id?.toString() || ""}
                  onValueChange={(value) => 
                    setCurrentCategory((prev) => ({
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
                  Categorias são vinculadas a uma empresa específica
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={currentCategory.is_active}
                onCheckedChange={(checked) => 
                  setCurrentCategory((prev) => ({
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
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Salvar Alterações' : 'Criar Categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{currentCategory.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending && (
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

export default CategoryManagement; 