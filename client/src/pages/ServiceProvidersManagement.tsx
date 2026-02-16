import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PencilIcon, TrashIcon, PlusIcon, LoaderIcon, Search, Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ServiceProvider } from '@shared/schema';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn, formatCNPJ, cleanCNPJ, formatPhone, cleanPhone } from '@/lib/utils';

interface ServiceProviderFormData {
  id?: number;
  name: string;
  is_external: boolean;
  company_id?: number | null;
  company_name?: string | null;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  departments?: string[]; // Array de nomes de departamentos
}

const ServiceProvidersManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'external'>('all');
  
  // Estados para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<ServiceProviderFormData>({
    name: '',
    is_external: false,
    company_id: user?.role === 'admin' ? null : user?.companyId,
    company_name: null,
    cnpj: null,
    address: null,
    phone: null,
    email: null,
    notes: null,
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados para departamentos
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const lastProviderIdRef = useRef<number | undefined>(undefined);

  // Buscar a lista de empresas (apenas para admin)
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar empresas');
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Buscar departamentos disponíveis (apenas os que têm use_service_providers habilitado)
  const { data: departmentsData } = useQuery<any[]>({
    queryKey: ['/api/departments', { active_only: true, use_service_providers: true, company_id: currentProvider.company_id || selectedCompanyId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      
      // Filtrar por empresa se disponível
      const companyId = currentProvider.company_id || selectedCompanyId || user?.companyId;
      if (companyId) {
        params.append('company_id', companyId.toString());
      }
      
      const response = await apiRequest('GET', `/api/departments?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const departments = Array.isArray(data.departments) ? data.departments : Array.isArray(data) ? data : [];
      
      // Filtrar apenas departamentos com use_service_providers habilitado
      return departments.filter((dept: any) => dept.use_service_providers === true);
    },
    enabled: true,
  });

  // Mapear departamentos para o formato usado no componente
  const availableDepartments = Array.isArray(departmentsData) ? departmentsData.map((dept: { id: number; name: string; description?: string }) => ({
    value: dept.name,
    label: dept.name,
    id: dept.id
  })) : [];

  // Buscar departamentos já vinculados ao prestador (apenas ao editar)
  const { data: providerDepartments = [] } = useQuery<string[]>({
    queryKey: ['/api/service-providers', currentProvider.id, 'departments'],
    queryFn: async () => {
      if (!currentProvider.id) return [];
      // Buscar todos os departamentos e filtrar os que têm este prestador
      const allDepts = Array.isArray(departmentsData) ? departmentsData : [];
      const deptIds: number[] = [];
      
      // Buscar departamentos vinculados a este prestador
      for (const dept of allDepts) {
        try {
          const response = await fetch(`/api/departments/${dept.id}/service-providers`);
          if (response.ok) {
            const providers = await response.json();
            if (providers.some((p: ServiceProvider) => p.id === currentProvider.id)) {
              deptIds.push(dept.id);
            }
          }
        } catch {
          // Ignorar erros
        }
      }
      
      return allDepts.filter((d: any) => deptIds.includes(d.id)).map((d: any) => d.name);
    },
    enabled: isEditing && !!currentProvider.id && availableDepartments.length > 0,
  });

  // Atualizar departamentos selecionados quando carregar prestador para edição
  useEffect(() => {
    if (!isEditing || !currentProvider.id) {
      lastProviderIdRef.current = undefined;
      return;
    }
    
    // Só atualizar se o provider mudou ou se ainda não carregamos os departamentos
    const providerChanged = lastProviderIdRef.current !== currentProvider.id;
    
    if (providerChanged && providerDepartments.length > 0) {
      lastProviderIdRef.current = currentProvider.id;
      setSelectedDepartments(providerDepartments);
    } else if (providerChanged && providerDepartments.length === 0) {
      // Se mudou o provider mas ainda não carregou, limpar seleção
      lastProviderIdRef.current = currentProvider.id;
      setSelectedDepartments([]);
    }
  }, [isEditing, currentProvider.id, providerDepartments.join(',')]);

  const toggleDepartment = (department: string) => {
    setSelectedDepartments(prev => {
      if (prev.includes(department)) {
        return prev.filter(d => d !== department);
      } else {
        return [...prev, department];
      }
    });
  };

  const removeDepartment = (department: string) => {
    setSelectedDepartments(prev => prev.filter(d => d !== department));
  };

  // Buscar a lista de prestadores
  const { 
    data: providers = [], 
    isLoading,
    error,
  } = useQuery<ServiceProvider[]>({
    queryKey: ['/api/service-providers', { 
      is_active: includeInactive ? undefined : true,
      company_id: selectedCompanyId,
      is_external: filterType === 'all' ? undefined : filterType === 'external',
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!includeInactive) {
        params.append('is_active', 'true');
      }
      if (selectedCompanyId) {
        params.append('company_id', selectedCompanyId.toString());
      }
      if (filterType !== 'all') {
        params.append('is_external', filterType === 'external' ? 'true' : 'false');
      }
      
      const response = await apiRequest('GET', `/api/service-providers?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar prestadores');
      }
      return response.json();
    },
  });

  // Filtrar por busca
  const filteredProviders = providers.filter(provider => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      provider.name.toLowerCase().includes(searchLower) ||
      provider.company_name?.toLowerCase().includes(searchLower) ||
      cleanCNPJ(provider.cnpj || '').toLowerCase().includes(searchLower) ||
      provider.email?.toLowerCase().includes(searchLower) ||
      cleanPhone(provider.phone || '').toLowerCase().includes(searchLower)
    );
  });

  // Mutation para criar prestador
  const createProviderMutation = useMutation({
    mutationFn: async (data: ServiceProviderFormData & { departments?: string[] }) => {
      const { departments, ...providerData } = data;
      const response = await apiRequest('POST', '/api/service-providers', providerData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar prestador');
      }
      const provider = await response.json();
      
      // Vincular departamentos após criar o prestador
      if (departments && departments.length > 0 && provider.id) {
        const departmentIds = departments.map(deptName => {
          const dept = availableDepartments.find(d => d.value === deptName);
          return dept?.id;
        }).filter(id => id !== undefined) as number[];
        
        // Vincular cada departamento
        for (const deptId of departmentIds) {
          try {
            await apiRequest('POST', `/api/departments/${deptId}/service-providers`, {
              service_provider_id: provider.id
            });
          } catch (error) {
            console.error(`Erro ao vincular departamento ${deptId}:`, error);
          }
        }
      }
      
      return provider;
    },
    onSuccess: () => {
      toast({
        title: 'Prestador criado com sucesso',
        description: 'O prestador de serviço foi criado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar prestador',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao criar o prestador',
        variant: 'destructive',
      });
    },
  });

  // Mutation para atualizar prestador
  const updateProviderMutation = useMutation({
    mutationFn: async (data: ServiceProviderFormData & { departments?: string[] }) => {
      const { departments, ...providerData } = data;
      const response = await apiRequest('PATCH', `/api/service-providers/${data.id}`, providerData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar prestador');
      }
      const provider = await response.json();
      
      // Atualizar vinculações de departamentos
      if (data.id && departments !== undefined) {
        // Buscar departamentos atualmente vinculados
        const currentDeptIds: number[] = [];
        for (const dept of availableDepartments) {
          try {
            const deptResponse = await fetch(`/api/departments/${dept.id}/service-providers`);
            if (deptResponse.ok) {
              const providers = await deptResponse.json();
              if (providers.some((p: ServiceProvider) => p.id === data.id)) {
                currentDeptIds.push(dept.id);
              }
            }
          } catch {
            // Ignorar erros
          }
        }
        
        // Determinar quais adicionar e quais remover
        const newDeptIds = departments.map(deptName => {
          const dept = availableDepartments.find(d => d.value === deptName);
          return dept?.id;
        }).filter(id => id !== undefined) as number[];
        
        // Remover vinculações que não estão mais na lista
        for (const deptId of currentDeptIds) {
          if (!newDeptIds.includes(deptId)) {
            try {
              await apiRequest('DELETE', `/api/departments/${deptId}/service-providers/${data.id}`);
            } catch (error) {
              console.error(`Erro ao desvincular departamento ${deptId}:`, error);
            }
          }
        }
        
        // Adicionar novas vinculações
        for (const deptId of newDeptIds) {
          if (!currentDeptIds.includes(deptId)) {
            try {
              await apiRequest('POST', `/api/departments/${deptId}/service-providers`, {
                service_provider_id: data.id
              });
            } catch (error) {
              console.error(`Erro ao vincular departamento ${deptId}:`, error);
            }
          }
        }
      }
      
      return provider;
    },
    onSuccess: () => {
      toast({
        title: 'Prestador atualizado com sucesso',
        description: 'O prestador de serviço foi atualizado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar prestador',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao atualizar o prestador',
        variant: 'destructive',
      });
    },
  });

  // Mutation para desativar prestador
  const deleteProviderMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/service-providers/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao desativar prestador');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Prestador desativado com sucesso',
        description: 'O prestador de serviço foi desativado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-providers'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao desativar prestador',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao desativar o prestador',
        variant: 'destructive',
      });
    },
  });

  // Reset do formulário
  const resetForm = () => {
    setCurrentProvider({
      name: '',
      is_external: false,
      company_id: user?.role === 'admin' ? null : user?.companyId,
      company_name: null,
      cnpj: null,
      address: null,
      phone: null,
      email: null,
      notes: null,
      is_active: true,
    });
    setSelectedDepartments([]);
    setIsEditing(false);
  };

  // Abrir formulário para criação
  const handleCreate = () => {
    resetForm();
    setSelectedDepartments([]);
    setIsDialogOpen(true);
  };

  // Abrir formulário para edição
  const handleEdit = (provider: ServiceProvider) => {
    setCurrentProvider({
      id: provider.id,
      name: provider.name,
      is_external: provider.is_external,
      company_id: provider.company_id,
      company_name: provider.company_name || null,
      cnpj: provider.cnpj || null,
      address: provider.address || null,
      phone: provider.phone || null,
      email: provider.email || null,
      notes: provider.notes || null,
      is_active: provider.is_active,
    });
    // Limpar departamentos selecionados ao abrir para edição (será preenchido pela query)
    setSelectedDepartments([]);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Confirmar exclusão
  const handleDelete = (provider: ServiceProvider) => {
    setCurrentProvider({
      id: provider.id,
      name: provider.name,
      is_external: provider.is_external,
      company_id: provider.company_id,
      is_active: provider.is_active,
    });
    setIsDeleteDialogOpen(true);
  };

  // Confirmar ação de exclusão
  const confirmDelete = () => {
    if (currentProvider.id) {
      deleteProviderMutation.mutate(currentProvider.id);
    }
  };

  // Enviar formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToSubmit = {
      ...currentProvider,
      company_id: user?.role === 'admin' ? currentProvider.company_id : user?.companyId,
      departments: selectedDepartments
    };
    
    if (isEditing && currentProvider.id) {
      updateProviderMutation.mutate(dataToSubmit);
    } else {
      createProviderMutation.mutate(dataToSubmit);
    }
  };

  // Atualizar campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentProvider((prev) => ({
      ...prev,
      [name]: value || null,
    }));
  };

  const getCompanyName = (companyId: number | null | undefined) => {
    if (!companyId) return '—';
    const company = companies.find((c: any) => c.id === companyId);
    return company?.name || '—';
  };

  // Verificar permissões - bloquear customer
  if (!user || user.role === 'customer') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Prestadores de Serviços</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie prestadores de serviços internos e externos
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Adicionar Prestador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Prestadores</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os prestadores de serviços cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa, CNPJ, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            {user?.role === 'admin' && (
              <div className="w-full md:w-48">
                <Select
                  value={selectedCompanyId?.toString() || "all"}
                  onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as empresas" />
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
            
            <div className="w-full md:w-48">
              <Select
                value={filterType}
                onValueChange={(value) => setFilterType(value as 'all' | 'internal' | 'external')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="internal">Internos</SelectItem>
                  <SelectItem value="external">Externos</SelectItem>
                </SelectContent>
              </Select>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                <TableHead>Informações de Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-red-500">
                    Erro ao carregar prestadores
                  </TableCell>
                </TableRow>
              ) : filteredProviders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                    Nenhum prestador encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredProviders.map((provider) => (
                  <TableRow key={provider.id} className={!provider.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>
                      {provider.is_external ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Externo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Interno
                        </span>
                      )}
                    </TableCell>
                    {user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <span className="text-sm text-neutral-600">
                            {getCompanyName(provider.company_id)}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {provider.company_name && (
                          <div className="text-neutral-600">Razão Social: {provider.company_name}</div>
                        )}
                        {provider.cnpj && (
                          <div className="text-neutral-600">CNPJ: {formatCNPJ(provider.cnpj)}</div>
                        )}
                        {provider.email && (
                          <div className="text-neutral-600">Email: {provider.email}</div>
                        )}
                        {provider.phone && (
                          <div className="text-neutral-600">Telefone: {formatPhone(provider.phone)}</div>
                        )}
                        {!provider.company_name && !provider.cnpj && !provider.email && !provider.phone && (
                          <span className="text-neutral-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {provider.is_active ? (
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
                          onClick={() => handleEdit(provider)}
                          title="Editar prestador"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(provider)}
                          title="Desativar prestador"
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          // Limpar departamentos ao fechar o diálogo
          setSelectedDepartments([]);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Prestador' : 'Adicionar Prestador'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Edite as informações do prestador de serviço' 
                : 'Preencha os dados para criar um novo prestador de serviço'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                value={currentProvider.name}
                onChange={handleInputChange}
                placeholder="Nome do prestador"
                required
              />
            </div>

            {/* Switch para interno/externo */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="is_external" className="font-medium">
                  Prestador Externo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Marque se este é um prestador externo (empresa terceirizada)
                </p>
              </div>
              <Switch
                id="is_external"
                checked={currentProvider.is_external}
                onCheckedChange={(checked) =>
                  setCurrentProvider((prev) => ({
                    ...prev,
                    is_external: checked,
                  }))
                }
              />
            </div>

            {/* Campos para prestadores externos */}
            {currentProvider.is_external && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-medium">Informações da Empresa (Opcional)</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="company_name">Razão Social</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    value={currentProvider.company_name || ''}
                    onChange={handleInputChange}
                    placeholder="Razão social da empresa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    value={formatCNPJ(currentProvider.cnpj || '')}
                    onChange={(e) => {
                      // Salvar apenas números no estado
                      const cleaned = cleanCNPJ(e.target.value);
                      setCurrentProvider((prev) => ({
                        ...prev,
                        cnpj: cleaned || null,
                      }));
                    }}
                    placeholder="00.000.000/0000-00"
                    maxLength={18} // 14 dígitos + 4 caracteres de formatação
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={currentProvider.address || ''}
                    onChange={handleInputChange}
                    placeholder="Endereço completo"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone_external">Telefone</Label>
                    <Input
                      id="phone_external"
                      name="phone"
                      value={formatPhone(currentProvider.phone || '')}
                      onChange={(e) => {
                        // Salvar apenas números no estado
                        const cleaned = cleanPhone(e.target.value);
                        setCurrentProvider((prev) => ({
                          ...prev,
                          phone: cleaned || null,
                        }));
                      }}
                      placeholder="(00) 00000-0000 ou (00) 0000-0000"
                      maxLength={15} // 11 dígitos + 4 caracteres de formatação
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={currentProvider.email || ''}
                      onChange={handleInputChange}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Campos de contato para prestadores internos */}
            {!currentProvider.is_external && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_internal">Telefone (Opcional)</Label>
                  <Input
                    id="phone_internal"
                    name="phone"
                    value={formatPhone(currentProvider.phone || '')}
                    onChange={(e) => {
                      // Salvar apenas números no estado
                      const cleaned = cleanPhone(e.target.value);
                      setCurrentProvider((prev) => ({
                        ...prev,
                        phone: cleaned || null,
                      }));
                    }}
                    placeholder="(00) 00000-0000 ou (00) 0000-0000"
                    maxLength={15} // 11 dígitos + 4 caracteres de formatação
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Opcional)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={currentProvider.email || ''}
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                value={currentProvider.notes || ''}
                onChange={handleInputChange}
                placeholder="Observações adicionais sobre o prestador"
                rows={3}
              />
            </div>
            
            {user?.role === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa</Label>
                <Select
                  value={currentProvider.company_id?.toString() || ""}
                  onValueChange={(value) => 
                    setCurrentProvider((prev) => ({
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
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={currentProvider.is_active}
                onCheckedChange={(checked) => 
                  setCurrentProvider((prev) => ({
                    ...prev,
                    is_active: checked,
                  }))
                }
              />
              <Label htmlFor="is_active">Ativo</Label>
            </div>
            
            {/* Seção de Departamentos */}
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <p className="text-sm text-muted-foreground">
                Selecione os departamentos onde este prestador pode ser atribuído (apenas departamentos com prestadores habilitados)
              </p>
              
              {/* Exibir departamentos selecionados */}
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedDepartments.map((dept) => {
                  const deptInfo = availableDepartments.find(d => d.value === dept);
                  return (
                    <Badge key={dept} variant="secondary" className="px-3 py-1">
                      {deptInfo?.label || dept}
                      <X 
                        className="ml-2 h-3 w-3 cursor-pointer" 
                        onClick={() => removeDepartment(dept)}
                      />
                    </Badge>
                  );
                })}
              </div>
              
              {/* Seletor de departamentos */}
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    type="button"
                  >
                    <span>Selecionar departamentos...</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar departamento..." />
                    <CommandEmpty>Nenhum departamento encontrado</CommandEmpty>
                    <CommandGroup>
                      {availableDepartments.map((dept) => (
                        <CommandItem
                          key={dept.value}
                          value={dept.value}
                          onSelect={() => {
                            toggleDepartment(dept.value);
                            setPopoverOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDepartments.includes(dept.value) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span>{dept.label}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
                disabled={createProviderMutation.isPending || updateProviderMutation.isPending}
              >
                {(createProviderMutation.isPending || updateProviderMutation.isPending) && (
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Prestador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o prestador "{currentProvider.name}"? Esta ação pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProviderMutation.isPending}
            >
              {deleteProviderMutation.isPending && (
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceProvidersManagement;

