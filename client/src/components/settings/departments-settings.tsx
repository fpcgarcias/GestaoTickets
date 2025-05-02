import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: number;
  name: string;
  description: string;
}

export function DepartmentsSettings() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Formulário para novo departamento
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  
  // Formulário para edição
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Carregar departamentos
  const { data: departmentsData, isLoading } = useQuery({
    queryKey: ["/api/settings/departments"],
  });

  // Atualizar estados quando os dados são carregados
  useEffect(() => {
    if (departmentsData) {
      setDepartments(departmentsData);
    }
  }, [departmentsData]);

  // Mutação para salvar departamentos
  const saveDepartmentsMutation = useMutation({
    mutationFn: async (updatedDepartments: Department[]) => {
      await apiRequest("POST", "/api/settings/departments", updatedDepartments);
    },
    onSuccess: () => {
      toast({
        title: "Departamentos salvos",
        description: "Os departamentos foram atualizados com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/departments"] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar departamentos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewName('');
    setNewDescription('');
    setEditName('');
    setEditDescription('');
  };

  const startEdit = (department: Department) => {
    setEditingId(department.id);
    setEditName(department.name);
    setEditDescription(department.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do departamento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const updatedDepartments = departments.map(dept => 
      dept.id === editingId ? { ...dept, name: editName, description: editDescription } : dept
    );
    
    saveDepartmentsMutation.mutate(updatedDepartments);
  };

  const addDepartment = () => {
    if (!newName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do departamento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const newId = departments.length > 0 
      ? Math.max(...departments.map(d => d.id)) + 1 
      : 1;

    const newDepartment = {
      id: newId,
      name: newName,
      description: newDescription,
    };

    const updatedDepartments = [...departments, newDepartment];
    saveDepartmentsMutation.mutate(updatedDepartments);
  };

  const deleteDepartment = (id: number) => {
    const updatedDepartments = departments.filter(dept => dept.id !== id);
    saveDepartmentsMutation.mutate(updatedDepartments);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Departamentos</CardTitle>
        <CardDescription>Configure e gerencie departamentos de suporte</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {departments && departments.length > 0 ? (
            departments.map(dept => (
              <div key={dept.id} className="flex items-center justify-between p-3 border rounded-md">
                {editingId === dept.id ? (
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`edit-name-${dept.id}`}>Nome do Departamento</Label>
                    <Input
                      id={`edit-name-${dept.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    
                    <Label htmlFor={`edit-desc-${dept.id}`}>Descrição</Label>
                    <Textarea
                      id={`edit-desc-${dept.id}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                    />
                    
                    <div className="flex gap-2 mt-2">
                      <Button onClick={saveEdit} variant="default" size="sm" disabled={saveDepartmentsMutation.isPending}>
                        {saveDepartmentsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Salvar
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" size="sm">
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="font-medium">{dept.name}</h3>
                      <p className="text-sm text-neutral-500">{dept.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(dept)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => deleteDepartment(dept.id)}
                        disabled={saveDepartmentsMutation.isPending}
                      >
                        {saveDepartmentsMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Excluir
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum departamento encontrado. Adicione seu primeiro departamento.
            </div>
          )}
        </div>
        
        {isAdding ? (
          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-medium">Novo Departamento</h3>
            
            <div>
              <Label htmlFor="new-name">Nome do Departamento</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Suporte Técnico"
              />
            </div>
            
            <div>
              <Label htmlFor="new-description">Descrição</Label>
              <Textarea
                id="new-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Breve descrição do departamento"
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={addDepartment}
                disabled={saveDepartmentsMutation.isPending}
              >
                {saveDepartmentsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Adicionar
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Departamento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
