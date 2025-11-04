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
import { useI18n } from '@/i18n';

interface DepartmentFormData {
  id?: number;
  name: string;
  description: string;
  company_id?: number | null;
  is_active: boolean;
  sla_mode?: 'type' | 'category';
  satisfaction_survey_enabled?: boolean;
  use_service_providers?: boolean;
}

const DepartmentManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  
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
    sla_mode: 'type',
    satisfaction_survey_enabled: false,
    use_service_providers: false,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Buscar a lista de empresas (apenas para admin)
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || formatMessage('departments.error_loading'));
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
        throw new Error(errorData.error || formatMessage('departments.error_loading'));
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
        is_active: data.is_active,
        sla_mode: data.sla_mode || 'type',
        satisfaction_survey_enabled: data.satisfaction_survey_enabled || false
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || formatMessage('departments.add_department_dialog.error_title');
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('departments.add_department_dialog.created_success'),
        description: formatMessage('departments.add_department_dialog.created_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : formatMessage('departments.add_department_dialog.error_title');
      toast({
        title: formatMessage('departments.add_department_dialog.error_title'),
        description: errorMessage,
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
        is_active: data.is_active,
        sla_mode: data.sla_mode || 'type',
        satisfaction_survey_enabled: data.satisfaction_survey_enabled || false,
        use_service_providers: data.use_service_providers || false
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || formatMessage('departments.edit_department_dialog.error_title');
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('departments.edit_department_dialog.updated_success'),
        description: formatMessage('departments.edit_department_dialog.updated_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : formatMessage('departments.edit_department_dialog.error_title');
      toast({
        title: formatMessage('departments.edit_department_dialog.error_title'),
        description: errorMessage,
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
        // Extrair a mensagem específica do erro
        const errorMessage = errorData.message || errorData.error || formatMessage('departments.delete_department_dialog.error_title');
        throw new Error(errorMessage);
      }
      
      return id;
    },
    onSuccess: () => {
      toast({
        title: formatMessage('departments.delete_department_dialog.deleted_success'),
        description: formatMessage('departments.delete_department_dialog.deleted_desc'),
      });
      queryClient.invalidateQueries({ queryKey: ['/departments'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      // Mostrar mensagem de erro mais específica
      let errorMessage = error instanceof Error ? error.message : formatMessage('departments.delete_department_dialog.error_title');
      
      // Traduzir mensagens específicas do backend
      if (errorMessage.includes('vinculado a') && errorMessage.includes('chamado(s)')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('departments.delete_department_dialog.linked_to_tickets', { count });
      } else if (errorMessage.includes('vinculado a') && errorMessage.includes('tipo(s) de chamado')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('departments.delete_department_dialog.linked_to_incident_types', { count });
      } else if (errorMessage.includes('vinculado a') && errorMessage.includes('oficial(is)')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('departments.delete_department_dialog.linked_to_officials', { count });
      } else if (errorMessage.includes('vinculado a') && errorMessage.includes('categoria(s)')) {
        const count = errorMessage.match(/(\d+)/)?.[1] || '0';
        errorMessage = formatMessage('departments.delete_department_dialog.linked_to_categories', { count });
      }
      
      toast({
        title: formatMessage('departments.delete_department_dialog.error_title'),
        description: errorMessage,
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
      sla_mode: 'type',
      satisfaction_survey_enabled: false,
      use_service_providers: false,
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
      sla_mode: (department as any).sla_mode || 'type',
      satisfaction_survey_enabled: (department as any).satisfaction_survey_enabled || false,
      use_service_providers: (department as any).use_service_providers || false,
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
    if (!companyId) return formatMessage('departments.global_system');
    const company = companies.find(c => c.id === companyId);
    return company?.name || formatMessage('departments.global_system');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('departments.title')}</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          {formatMessage('departments.new_department')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('departments.management_title')}</CardTitle>
          <CardDescription>{formatMessage('departments.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder={formatMessage('departments.search_placeholder')} 
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
                      <SelectValue placeholder={formatMessage('departments.filter_by_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('departments.all_companies')}</SelectItem>
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
                <Label htmlFor="includeInactive">{formatMessage('departments.include_inactive')}</Label>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{formatMessage('departments.name')}</TableHead>
                <TableHead>{formatMessage('departments.description')}</TableHead>
                {user?.role === 'admin' && <TableHead>{formatMessage('departments.company')}</TableHead>}
                <TableHead>{formatMessage('departments.status')}</TableHead>
                <TableHead>{formatMessage('departments.satisfaction_survey')}</TableHead>
                <TableHead className="text-right">{formatMessage('departments.actions')}</TableHead>
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
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-red-500">
                    {formatMessage('departments.error_loading')}
                  </TableCell>
                </TableRow>
              ) : departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                    {formatMessage('departments.no_departments_found')}
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
                          {formatMessage('departments.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {formatMessage('departments.inactive')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(dept as any).satisfaction_survey_enabled ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {formatMessage('departments.enabled')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {formatMessage('departments.disabled')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(dept)}
                          title={formatMessage('departments.edit_department')}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(dept)}
                          title={formatMessage('departments.delete_department')}
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
                {formatMessage('departments.showing_results', { count: departments.length, total: pagination.total })}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  {formatMessage('departments.previous')}
                </Button>
                <div className="text-sm text-neutral-600">
                  {formatMessage('departments.page')} {currentPage} {formatMessage('departments.of')} {pagination.pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= pagination.pages}
                >
                  {formatMessage('departments.next')}
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
            <DialogTitle>{isEditing ? formatMessage('departments.edit_department_dialog.title') : formatMessage('departments.add_department_dialog.title')}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? formatMessage('departments.edit_department_dialog.description') 
                : formatMessage('departments.add_department_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{formatMessage('departments.add_department_dialog.name')}</Label>
              <Input
                id="name"
                name="name"
                value={currentDepartment.name}
                onChange={handleInputChange}
                placeholder={formatMessage('departments.add_department_dialog.name_placeholder')}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">{formatMessage('departments.add_department_dialog.description')}</Label>
              <Textarea
                id="description"
                name="description"
                value={currentDepartment.description}
                onChange={handleInputChange}
                placeholder={formatMessage('departments.add_department_dialog.description_placeholder')}
                rows={3}
              />
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">{formatMessage('departments.add_department_dialog.company')}</Label>
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
                    <SelectValue placeholder={formatMessage('departments.add_department_dialog.company_placeholder')} />
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
                  {formatMessage('departments.add_department_dialog.company_help')}
                </p>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Label htmlFor="is_active">{formatMessage('departments.add_department_dialog.active')}</Label>
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

            {/* Toggle: SLA por categoria */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="sla_mode">{formatMessage('departments.add_department_dialog.sla_by_category')}</Label>
              <Switch
                id="sla_mode"
                checked={currentDepartment.sla_mode === 'category'}
                onCheckedChange={(checked) =>
                  setCurrentDepartment((prev) => ({
                    ...prev,
                    sla_mode: checked ? 'category' : 'type',
                  }))
                }
              />
            </div>

            {/* Toggle: Pesquisa de Satisfação */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="satisfaction_survey_enabled" className="font-medium">
                  {formatMessage('departments.add_department_dialog.satisfaction_survey')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formatMessage('departments.add_department_dialog.satisfaction_survey_desc')}
                </p>
              </div>
              <Switch
                id="satisfaction_survey_enabled"
                checked={currentDepartment.satisfaction_survey_enabled || false}
                onCheckedChange={(checked) =>
                  setCurrentDepartment((prev) => ({
                    ...prev,
                    satisfaction_survey_enabled: checked,
                  }))
                }
              />
            </div>

            {/* Toggle: Prestadores de Serviços */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="use_service_providers" className="font-medium">
                  Utilizar Prestadores de Serviços
                </Label>
                <p className="text-sm text-muted-foreground">
                  Habilita o uso de prestadores de serviços (internos ou externos) para tickets deste departamento
                </p>
              </div>
              <Switch
                id="use_service_providers"
                checked={currentDepartment.use_service_providers || false}
                onCheckedChange={(checked) =>
                  setCurrentDepartment((prev) => ({
                    ...prev,
                    use_service_providers: checked,
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
                {formatMessage('departments.add_department_dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              >
                {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? formatMessage('departments.edit_department_dialog.save') : formatMessage('departments.add_department_dialog.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{formatMessage('departments.delete_department_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage('departments.delete_department_dialog.description', { name: currentDepartment.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{formatMessage('departments.delete_department_dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDepartmentMutation.isPending}
            >
              {deleteDepartmentMutation.isPending && (
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              {formatMessage('departments.delete_department_dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DepartmentManagement; 