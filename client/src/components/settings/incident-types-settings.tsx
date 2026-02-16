import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface IncidentType {
  id: number;
  name: string;
  value: string;
  departmentId: number;
}

interface Department {
  id: number;
  name: string;
  description: string;
}

export function IncidentTypesSettings() {
  const { toast } = useToast();
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Formulário para novo tipo de incidente
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState<number | null>(null);
  
  // Formulário para edição
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);

  // Carregar tipos de incidentes e departamentos
  const { data: incidentTypesData, isLoading: isLoadingIncidentTypes } = useQuery<IncidentType[]>({
    queryKey: ["/api/settings/incident-types"],
  });

  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery<Department[]>({
    queryKey: ["/api/settings/departments"],
  });

  // Atualizar estados quando os dados são carregados
  useEffect(() => {
    setIncidentTypes(Array.isArray(incidentTypesData) ? incidentTypesData : []);
  }, [incidentTypesData]);

  // Garante que departments é um array para uso posterior
  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Mutação para salvar tipos de incidentes
  const saveIncidentTypesMutation = useMutation({
    mutationFn: async (updatedIncidentTypes: IncidentType[]) => {
      await apiRequest("POST", "/api/settings/incident-types", updatedIncidentTypes);
    },
    onSuccess: () => {
      toast({
        title: "Tipos de chamado salvos",
        description: "Os tipos de chamado foram atualizados com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/incident-types"] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar tipos de chamado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewName('');
    setNewValue('');
    setNewDepartmentId(null);
    setEditName('');
    setEditValue('');
    setEditDepartmentId(null);
  };

  const startEdit = (incidentType: IncidentType) => {
    setEditingId(incidentType.id);
    setEditName(incidentType.name);
    setEditValue(incidentType.value);
    setEditDepartmentId(incidentType.departmentId);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do tipo de chamado é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!editValue.trim()) {
      toast({
        title: "Erro",
        description: "O valor de referência do tipo de chamado é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!editDepartmentId) {
      toast({
        title: "Erro",
        description: "É necessário selecionar um departamento",
        variant: "destructive",
      });
      return;
    }

    const updatedIncidentTypes = incidentTypes.map(type => 
      type.id === editingId ? { 
        ...type, 
        name: editName, 
        value: editValue,
        departmentId: editDepartmentId 
      } : type
    );
    
    saveIncidentTypesMutation.mutate(updatedIncidentTypes);
  };

  const addIncidentType = () => {
    if (!newName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do tipo de chamado é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!newValue.trim()) {
      toast({
        title: "Erro",
        description: "O valor de referência do tipo de chamado é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!newDepartmentId) {
      toast({
        title: "Erro",
        description: "É necessário selecionar um departamento",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o valor já existe
    if (incidentTypes.some(type => type.value === newValue)) {
      toast({
        title: "Erro",
        description: "Este valor de referência já está em uso",
        variant: "destructive",
      });
      return;
    }

    const newId = incidentTypes.length > 0 
      ? Math.max(...incidentTypes.map(d => d.id)) + 1 
      : 1;

    const newIncidentType = {
      id: newId,
      name: newName,
      value: newValue,
      departmentId: newDepartmentId,
    };

    const updatedIncidentTypes = [...incidentTypes, newIncidentType];
    saveIncidentTypesMutation.mutate(updatedIncidentTypes);
  };

  const deleteIncidentType = (id: number) => {
    const updatedIncidentTypes = incidentTypes.filter(type => type.id !== id);
    saveIncidentTypesMutation.mutate(updatedIncidentTypes);
  };

  if (isLoadingIncidentTypes || isLoadingDepartments) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const getDepartmentName = (id: number) => {
    const department = departments.find((dept: Department) => dept.id === id);
    return department ? department.name : 'Departamento não encontrado';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Tipos de Chamado</CardTitle>
        <CardDescription>Configure e gerencie os tipos de chamados disponíveis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {incidentTypes && incidentTypes.length > 0 ? (
            incidentTypes.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 border rounded-md">
                {editingId === type.id ? (
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`edit-name-${type.id}`}>Nome do Tipo</Label>
                    <Input
                      id={`edit-name-${type.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    
                    <Label htmlFor={`edit-value-${type.id}`}>Valor de Referência</Label>
                    <Input
                      id={`edit-value-${type.id}`}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />

                    <Label htmlFor={`edit-department-${type.id}`}>Departamento</Label>
                    <Select
                      onValueChange={(value: string) => setEditDepartmentId(parseInt(value))}
                      value={type.departmentId?.toString() || ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept: Department) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2 mt-2">
                      <Button onClick={saveEdit} variant="default" size="sm" disabled={saveIncidentTypesMutation.isPending}>
                        {saveIncidentTypesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
                      <h3 className="font-medium">{type.name}</h3>
                      <p className="text-sm text-neutral-500">
                        Valor: <code className="bg-neutral-100 px-1 py-0.5 rounded">{type.value}</code>
                      </p>
                      <p className="text-sm text-neutral-500">
                        Departamento: {getDepartmentName(type.departmentId)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(type)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => deleteIncidentType(type.id)}
                        disabled={saveIncidentTypesMutation.isPending}
                      >
                        {saveIncidentTypesMutation.isPending ? (
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
              Nenhum tipo de chamado encontrado. Adicione seu primeiro tipo.
            </div>
          )}
        </div>
        
        {isAdding ? (
          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-medium">Novo Tipo de Chamado</h3>
            
            <div>
              <Label htmlFor="new-name">Nome do Tipo</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Problema Técnico"
              />
            </div>
            
            <div>
              <Label htmlFor="new-value">Valor de Referência</Label>
              <Input
                id="new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Ex: technical"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Este valor é usado internamente no sistema e deve ser único
              </p>
            </div>

            <div>
              <Label htmlFor="new-department">Departamento</Label>
              <Select
                onValueChange={(value: string) => setNewDepartmentId(parseInt(value))}
                value={newDepartmentId?.toString() || ""}
              >
                <SelectTrigger id="new-department">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={addIncidentType}
                disabled={saveIncidentTypesMutation.isPending}
              >
                {saveIncidentTypesMutation.isPending ? (
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
              Adicionar Tipo de Chamado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 