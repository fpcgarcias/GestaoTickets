import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  GripVertical, 
  Settings as SettingsIcon, 
  Palette,
  Save,
  X,
  ChevronLeft,
  Building2,
  Loader2,
  ArrowUpDown,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { motion, Reorder } from 'framer-motion';

// Interfaces
interface Department {
  id: number;
  name: string;
  company_id: number;
}

interface DepartmentPriority {
  id: number;
  company_id: number;
  department_id: number;
  name: string;
  weight: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PriorityResult {
  department: Department;
  priorities: DepartmentPriority[];
  isDefault: boolean;
  source: 'custom' | 'default' | 'none';
  count: number;
}

interface Company {
  id: number;
  name: string;
}

// Cores padrão para seleção
const DEFAULT_COLORS = [
  '#6B7280', // Gray
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
];

export default function PrioritySettings() {
  const { toast } = useToast();
  const { user, company: userCompany, isLoading: isLoadingAuth } = useAuth();
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (['manager', 'company_admin', 'supervisor'].includes(user?.role || '')) && userCompany?.id ? userCompany.id : undefined
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<DepartmentPriority | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    color: DEFAULT_COLORS[0],
    weight: 1
  });

  // Buscar empresas (apenas para admin)
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin',
  });

  // Buscar departamentos
  const { data: departments, isLoading: isLoadingDepartments, error: departmentsError } = useQuery<Department[]>({
    queryKey: ['/api/departments', selectedCompanyId],
    queryFn: async () => {
      // CORREÇÃO: Para admin, supervisor, manager, company_admin, sempre passar company_id se disponível
      const url = selectedCompanyId 
        ? `/api/departments?company_id=${selectedCompanyId}`
        : '/api/departments';
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Erro ao carregar departamentos');
      }
      
      const response = await res.json();
      return response.data || response.departments || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Buscar prioridades do departamento selecionado
  const { data: prioritiesData, isLoading: isLoadingPriorities, refetch: refetchPriorities } = useQuery<{success: boolean, data: PriorityResult}>({
    queryKey: ['/api/departments', selectedDepartmentId, 'priorities'],
    queryFn: async () => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities`);
      if (!res.ok) throw new Error('Erro ao carregar prioridades');
      return res.json();
    },
    enabled: !!selectedDepartmentId,
  });

  // Mutation para criar prioridade
  const createPriorityMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; weight: number }) => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar prioridade');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Prioridade criada com sucesso!" });
      refetchPriorities();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para editar prioridade
  const editPriorityMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; color: string; weight: number }) => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao editar prioridade');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Prioridade atualizada com sucesso!" });
      refetchPriorities();
      setIsEditDialogOpen(false);
      setEditingPriority(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para excluir prioridade
  const deletePriorityMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao excluir prioridade');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Prioridade excluída com sucesso!" });
      refetchPriorities();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para reordenar prioridades
  const reorderPrioritiesMutation = useMutation({
    mutationFn: async (priorities: Array<{ id: number; weight: number }>) => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorities }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao reordenar prioridades');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Prioridades reordenadas com sucesso!" });
      refetchPriorities();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para criar prioridades padrão
  const createDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities/create-defaults`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar prioridades padrão');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Prioridades padrão criadas com sucesso!" });
      refetchPriorities();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Effects
  useEffect(() => {
    if (user?.role === 'admin' && companies && !selectedCompanyId) {
      if (userCompany?.id && companies.some(c => c.id === userCompany.id)) {
        setSelectedCompanyId(userCompany.id);
      } else if (companies.length > 0) {
        setSelectedCompanyId(companies[0].id);
      }
    } else if (['manager', 'company_admin', 'supervisor'].includes(user?.role || '') && userCompany?.id && !selectedCompanyId) {
      setSelectedCompanyId(userCompany.id);
    }
  }, [companies, user?.role, userCompany, selectedCompanyId]);

  useEffect(() => {
    if (departments && departments.length > 0 && !selectedDepartmentId) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments, selectedDepartmentId]);

  // Handlers
  const resetForm = () => {
    setFormData({
      name: '',
      color: DEFAULT_COLORS[0],
      weight: 1
    });
  };

  const handleAddPriority = () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome da prioridade é obrigatório", variant: "destructive" });
      return;
    }

    // Validar peso duplicado
    const existingWeights = currentPriorities.map(p => p.weight);
    if (existingWeights.includes(formData.weight)) {
      toast({ 
        title: "Erro", 
        description: `Já existe uma prioridade com peso ${formData.weight}. Escolha um peso diferente.`, 
        variant: "destructive" 
      });
      return;
    }

    // Validar nome duplicado
    const existingNames = currentPriorities.map(p => p.name.toLowerCase());
    if (existingNames.includes(formData.name.trim().toLowerCase())) {
      toast({ 
        title: "Erro", 
        description: `Já existe uma prioridade com o nome "${formData.name.trim()}". Escolha um nome diferente.`, 
        variant: "destructive" 
      });
      return;
    }

    createPriorityMutation.mutate({
      name: formData.name.trim(),
      color: formData.color,
      weight: formData.weight
    });
  };

  const handleEditPriority = () => {
    if (!editingPriority) return;
    
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome da prioridade é obrigatório", variant: "destructive" });
      return;
    }

    // Validar peso duplicado (excluindo a prioridade atual)
    const existingWeights = currentPriorities
      .filter(p => p.id !== editingPriority.id)
      .map(p => p.weight);
    if (existingWeights.includes(formData.weight)) {
      toast({ 
        title: "Erro", 
        description: `Já existe uma prioridade com peso ${formData.weight}. Escolha um peso diferente.`, 
        variant: "destructive" 
      });
      return;
    }

    // Validar nome duplicado (excluindo a prioridade atual)
    const existingNames = currentPriorities
      .filter(p => p.id !== editingPriority.id)
      .map(p => p.name.toLowerCase());
    if (existingNames.includes(formData.name.trim().toLowerCase())) {
      toast({ 
        title: "Erro", 
        description: `Já existe uma prioridade com o nome "${formData.name.trim()}". Escolha um nome diferente.`, 
        variant: "destructive" 
      });
      return;
    }

    editPriorityMutation.mutate({
      id: editingPriority.id,
      name: formData.name.trim(),
      color: formData.color,
      weight: formData.weight
    });
  };

  const openEditDialog = (priority: DepartmentPriority) => {
    setEditingPriority(priority);
    setFormData({
      name: priority.name,
      color: priority.color,
      weight: priority.weight
    });
    setIsEditDialogOpen(true);
  };

  const currentPriorities = prioritiesData?.data?.priorities || [];
  
  // Estado local para controlar a ordem durante o drag
  const [localPriorities, setLocalPriorities] = useState<DepartmentPriority[]>([]);

  // Atualizar estado local quando dados mudam
  useEffect(() => {
    if (currentPriorities.length > 0) {
      setLocalPriorities([...currentPriorities].sort((a, b) => a.weight - b.weight));
    }
  }, [currentPriorities]);

  const handleReorderDrag = (newOrder: DepartmentPriority[]) => {
    // APENAS atualizar estado local durante o drag (sem API)
    setLocalPriorities(newOrder);
  };

  const handleReorderComplete = (finalOrder: DepartmentPriority[]) => {
    // SÓ CHAMA API quando SOLTAR (drag completo)
    const reorderedPriorities = finalOrder.map((priority, index) => ({
      id: priority.id,
      weight: index + 1
    }));

    reorderPrioritiesMutation.mutate(reorderedPriorities);
  };
  const currentDepartment = prioritiesData?.data?.department;
  const isUsingDefaults = prioritiesData?.data?.isDefault || false;

  // Verificar permissões
  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !['admin', 'company_admin', 'manager', 'supervisor'].includes(user.role)) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
              <p className="text-muted-foreground">Você não tem permissão para acessar as configurações de prioridades.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Configuração de Prioridades</h1>
        </div>
      </div>

      {/* Seletores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Seleção de Contexto
          </CardTitle>
          <CardDescription>
            Escolha a empresa e departamento para configurar as prioridades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seletor de Empresa (apenas para admin) */}
            {user.role === 'admin' && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select
                  value={selectedCompanyId?.toString() || ''}
                  onValueChange={(value) => {
                    setSelectedCompanyId(parseInt(value));
                    setSelectedDepartmentId(undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Seletor de Departamento */}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={selectedDepartmentId?.toString() || ''}
                onValueChange={(value) => setSelectedDepartmentId(parseInt(value))}
                disabled={isLoadingDepartments || !departments?.length}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      isLoadingDepartments 
                        ? "Carregando departamentos..." 
                        : !departments?.length 
                          ? "Nenhum departamento encontrado"
                          : "Selecione um departamento"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((department) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração de Prioridades */}
      {selectedDepartmentId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Prioridades do Departamento
                  {currentDepartment && (
                    <Badge variant="outline">{currentDepartment.name}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isUsingDefaults 
                    ? "Usando prioridades padrão (não customizadas). Você pode criar prioridades personalizadas ou usar as padrões."
                    : "Prioridades personalizadas configuradas. Arraste para reordenar."
                  }
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                {isUsingDefaults && (
                  <Button
                    onClick={() => createDefaultsMutation.mutate()}
                    disabled={createDefaultsMutation.isPending}
                    variant="outline"
                  >
                    {createDefaultsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Criar Padrões
                  </Button>
                )}
                
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Prioridade
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Nova Prioridade</DialogTitle>
                      <DialogDescription>
                        Configure uma nova prioridade para este departamento
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome da Prioridade</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Super Urgente"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="weight">Nível (Peso)</Label>
                        <Input
                          id="weight"
                          type="number"
                          min={1}
                          value={formData.weight}
                          onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                          placeholder="1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Número maior = maior prioridade. Pesos já usados: {currentPriorities.map(p => p.weight).sort((a, b) => a - b).join(', ')}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <div className="flex gap-2 flex-wrap">
                          {DEFAULT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-8 h-8 rounded-full border-2 ${
                                formData.color === color ? 'border-gray-900' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setFormData(prev => ({ ...prev, color }))}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            type="color"
                            value={formData.color}
                            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                            className="w-12 h-8 p-0 border-0"
                          />
                          <span className="text-sm text-muted-foreground">
                            Ou escolha uma cor personalizada
                          </span>
                        </div>
                      </div>
                      
                      {/* Preview */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label>Preview</Label>
                        <div className="pt-2">
                          <Badge 
                            style={{ backgroundColor: formData.color, color: '#fff' }}
                            className="text-white px-3 py-1"
                          >
                            {formData.name || 'Nome da Prioridade'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          resetForm();
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleAddPriority}
                        disabled={createPriorityMutation.isPending}
                      >
                        {createPriorityMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Criar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoadingPriorities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : currentPriorities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma prioridade configurada para este departamento</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Reorder.Group
                  axis="y"
                  values={localPriorities}
                  onReorder={handleReorderDrag}
                  className="space-y-2"
                >
                  {localPriorities.map((priority) => (
                    <Reorder.Item
                      key={priority.id}
                      value={priority}
                      className="cursor-grab active:cursor-grabbing"
                      onDragEnd={() => handleReorderComplete(localPriorities)}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                          <div className="flex items-center gap-3">
                            <Badge 
                              style={{ backgroundColor: priority.color, color: '#fff' }}
                              className="text-white"
                            >
                              {priority.name}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Peso: {priority.weight}
                            </span>
                            {isUsingDefaults && (
                              <Badge variant="outline" className="text-xs">
                                Padrão
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(priority)}
                            disabled={isUsingDefaults}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUsingDefaults}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a prioridade "{priority.name}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePriorityMutation.mutate(priority.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </motion.div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Prioridade</DialogTitle>
            <DialogDescription>
              Modifique as configurações da prioridade selecionada
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da Prioridade</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Super Urgente"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-weight">Nível (Peso)</Label>
                              <Input
                  id="edit-weight"
                  type="number"
                  min={1}
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Número maior = maior prioridade. Pesos já usados: {currentPriorities.filter(p => p.id !== editingPriority?.id).map(p => p.weight).sort((a, b) => a - b).join(', ')}
                </p>
            </div>
            
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-8 p-0 border-0"
                />
                <span className="text-sm text-muted-foreground">
                  Ou escolha uma cor personalizada
                </span>
              </div>
            </div>
            
                         {/* Preview */}
             <div className="border rounded-lg p-4 space-y-3">
               <Label>Preview</Label>
               <div className="pt-2">
                 <Badge 
                   style={{ backgroundColor: formData.color, color: '#fff' }}
                   className="text-white px-3 py-1"
                 >
                   {formData.name || 'Nome da Prioridade'}
                 </Badge>
               </div>
             </div>
           </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingPriority(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditPriority}
              disabled={editPriorityMutation.isPending}
            >
              {editPriorityMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}