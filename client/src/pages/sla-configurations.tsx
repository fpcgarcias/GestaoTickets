import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Settings as SettingsIcon, 
  Download,
  Upload,
  Building2,
  Clock,
  Target,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Filter,
  RefreshCw,
  FileText
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from "@/components/ui/skeleton";

// Interfaces
interface Company {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  company_id: number;
}

interface IncidentType {
  id: number;
  name: string;
  department_id: number;
  company_id: number;
}

interface DepartmentPriority {
  id: number;
  name: string;
  weight: number;
  color?: string;
  company_id?: number;
  department_id?: number;
}

interface SLAConfiguration {
  id: number;
  company_id: number;
  department_id: number;
  incident_type_id: number;
  priority_id: number | null;
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SLAConfigurationForm {
  companyId: number;
  departmentId: number;
  incidentTypeId: number;
  priorityId?: number | null;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive: boolean;
}

export default function SLAConfigurations() {
  const { toast } = useToast();
  const { user, company: userCompany } = useAuth();
  
  // Estados para filtros
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (['manager', 'company_admin', 'supervisor'].includes(user?.role || '')) && userCompany?.id ? userCompany.id : undefined
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>();
  const [selectedIncidentTypeId, setSelectedIncidentTypeId] = useState<number | undefined>();
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Estados para modais
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState<SLAConfiguration | null>(null);
  
  // Estado para importação
  const [importResults, setImportResults] = useState<{
    processed: number;
    successful: number;
    errors: number;
    duplicates: number;
    details?: any;
  } | null>(null);

  // Estado do formulário
  const [formData, setFormData] = useState<SLAConfigurationForm>({
    companyId: selectedCompanyId || 1,
    departmentId: 1,
    incidentTypeId: 1,
    priorityId: null,
    responseTimeHours: 1,
    resolutionTimeHours: 8,
    isActive: true
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
  const { data: departments } = useQuery<Department[]>({
    queryKey: ['/api/departments', selectedCompanyId],
    queryFn: async () => {
      const url = selectedCompanyId 
        ? `/api/departments?company_id=${selectedCompanyId}`
        : '/api/departments';
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      
      const response = await res.json();
      return response.data || response.departments || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Buscar tipos de incidente
  const { data: incidentTypes } = useQuery<IncidentType[]>({
    queryKey: ['/api/incident-types', selectedCompanyId, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      let url = '/api/incident-types';
      const params = new URLSearchParams();
      
      if (selectedCompanyId) params.append('company_id', selectedCompanyId.toString());
      if (selectedDepartmentId) params.append('department_id', selectedDepartmentId.toString());
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar tipos de incidente');
      
      const response = await res.json();
      return response.data || response.incidentTypes || [];
    },
    enabled: !!selectedCompanyId && !!selectedDepartmentId,
  });

  // Buscar prioridades do departamento
  const { data: priorities } = useQuery<DepartmentPriority[]>({
    queryKey: ['/api/departments', selectedDepartmentId, 'priorities'],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const res = await fetch(`/api/departments/${selectedDepartmentId}/priorities`);
      if (!res.ok) return [];
      
      const response = await res.json();
      return response.data?.department_priorities || response.data?.priorities || response.priorities || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Buscar prioridades para o formulário
  const { data: formPriorities } = useQuery<DepartmentPriority[]>({
    queryKey: ['/api/departments', formData.departmentId, 'priorities', 'form'],
    queryFn: async () => {
      if (!formData.departmentId) return [];
      
      const res = await fetch(`/api/departments/${formData.departmentId}/priorities`);
      if (!res.ok) return [];
      
      const response = await res.json();
      return response.data?.department_priorities || response.data?.priorities || response.priorities || [];
    },
    enabled: !!(formData.departmentId && (isAddDialogOpen || isEditDialogOpen)),
  });

  // Buscar tipos de incidentes para o formulário
  const { data: formIncidentTypes } = useQuery<IncidentType[]>({
    queryKey: ['/api/incident-types', formData.companyId, formData.departmentId, 'form'],
    queryFn: async () => {
      if (!formData.departmentId) return [];
      
      let url = '/api/incident-types';
      const params = new URLSearchParams();
      
      if (formData.companyId) params.append('company_id', formData.companyId.toString());
      if (formData.departmentId) params.append('department_id', formData.departmentId.toString());
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar tipos de incidente');
      
      const response = await res.json();
      return response.data || response.incidentTypes || [];
    },
    enabled: !!(formData.departmentId && (isAddDialogOpen || isEditDialogOpen)),
  });

  // Buscar configurações SLA
  const { data: slaConfigurations, isLoading: isLoadingSLA, refetch: refetchSLA } = useQuery<SLAConfiguration[]>({
    queryKey: ['/api/sla-configurations', selectedCompanyId, selectedDepartmentId, selectedIncidentTypeId, showOnlyActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedCompanyId) params.append('companyId', selectedCompanyId.toString());
      if (selectedDepartmentId) params.append('departmentId', selectedDepartmentId.toString());
      if (selectedIncidentTypeId) params.append('incidentTypeId', selectedIncidentTypeId.toString());
      if (showOnlyActive) params.append('isActive', 'true');
      
      // Adicionar timestamp para quebrar cache quando necessário
      params.append('_t', Date.now().toString());
      
      const url = `/api/sla-configurations${params.toString() ? `?${params.toString()}` : ''}`;
      
      const res = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error('Erro ao carregar configurações SLA');
      
      const response = await res.json();
      
      return response.data || [];
    },
    enabled: !!selectedCompanyId,
    staleTime: 0, // Sempre considera os dados como "stale" para garantir refresh
    gcTime: 1 * 60 * 1000, // Cache menor - 1 minuto
    refetchOnWindowFocus: true, // Recarregar quando voltar ao foco
    refetchOnMount: 'always', // Sempre recarregar ao montar
    refetchInterval: false, // Não usar polling automático
    retry: 1, // Tentar novamente apenas 1 vez se falhar
  });

  // Buscar TODOS os tipos de incidente da empresa (para a matriz)
  const { data: allIncidentTypes } = useQuery<IncidentType[]>({
    queryKey: ['/api/incident-types/all', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      
      const url = `/api/incident-types?company_id=${selectedCompanyId}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      
      const response = await res.json();
      return response.data || response.incidentTypes || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Buscar TODAS as prioridades da empresa (para a matriz)
  const { data: allPriorities } = useQuery<DepartmentPriority[]>({
    queryKey: ['/api/department-priorities/all', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      
      const url = `/api/department-priorities?company_id=${selectedCompanyId}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      
      const response = await res.json();
      return response.data || response.priorities || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Mutation para criar configuração SLA
  const createSLAMutation = useMutation({
    mutationFn: async (data: SLAConfigurationForm) => {
      const res = await fetch('/api/sla-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        console.error('❌ [FRONTEND] Erro da API:', error);
        throw new Error(error.error || error.message || 'Erro ao criar configuração SLA');
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Sucesso", description: "Configuração SLA criada com sucesso!" });
      
      // Usar função auxiliar para invalidar cache
      await invalidateSLACache();
      
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para editar configuração SLA
  const editSLAMutation = useMutation({
    mutationFn: async (data: { id: number } & Partial<SLAConfigurationForm>) => {
      const { id, ...updateData } = data;
      const res = await fetch(`/api/sla-configurations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar configuração SLA');
      }
      return res.json();
    },
    onSuccess: async (data) => {
      toast({ title: "Sucesso", description: "Configuração SLA atualizada com sucesso!" });
      
      // Usar função auxiliar para invalidar cache
      await invalidateSLACache();
      
      // Aguardar um pouco para garantir que a UI seja atualizada
      setTimeout(() => {
        setIsEditDialogOpen(false);
        setEditingSLA(null);
        resetForm();
      }, 100);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para deletar configuração SLA
  const deleteSLAMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sla-configurations/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao deletar configuração SLA');
      }
      return res.json();
    },
    onSuccess: async (data, variables) => {
      toast({ title: "Sucesso", description: "Configuração SLA removida com sucesso!" });
      
      console.log('🗑️ [DELETE SUCCESS] Configuração deletada:', variables);
      
      // Usar função auxiliar para invalidar cache
      await invalidateSLACache();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Função auxiliar para invalidar cache de forma consistente
  const invalidateSLACache = async () => {
    // Remover todas as queries SLA
    queryClient.removeQueries({ 
      queryKey: ['/api/sla-configurations'],
      exact: false 
    });
    
    // Invalidar queries
    await queryClient.invalidateQueries({ 
      queryKey: ['/api/sla-configurations'],
      exact: false,
      refetchType: 'all'
    });
    
    // Refetch manual
    await refetchSLA();
  };

  // Atualizar formData quando empresa selecionada mudar
  useEffect(() => {
    if (selectedCompanyId) {
      setFormData(prev => ({ ...prev, companyId: selectedCompanyId }));
    }
  }, [selectedCompanyId]);

  // Resetar departamento e tipo quando empresa mudar
  useEffect(() => {
    setSelectedDepartmentId(undefined);
    setSelectedIncidentTypeId(undefined);
  }, [selectedCompanyId]);

  // Resetar tipo quando departamento mudar
  useEffect(() => {
    setSelectedIncidentTypeId(undefined);
  }, [selectedDepartmentId]);

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      companyId: selectedCompanyId || 1,
      departmentId: 1,
      incidentTypeId: 1,
      priorityId: null,
      responseTimeHours: 1,
      resolutionTimeHours: 8,
      isActive: true
    });
  };

  const getDepartmentName = (departmentId: number) => {
    return departments?.find(d => d.id === departmentId)?.name || 'N/A';
  };

  const getIncidentTypeName = (incidentTypeId: number) => {
    // Busca primeiro nos dados globais, depois nos filtrados e formulário
    const allData = [
      ...(allIncidentTypes || []),
      ...(incidentTypes || []), 
      ...(formIncidentTypes || [])
    ];
    const uniqueTypes = allData.filter((type, index, self) => 
      index === self.findIndex(t => t.id === type.id)
    );
    return uniqueTypes.find(t => t.id === incidentTypeId)?.name || 'N/A';
  };

  const getPriorityName = (priorityId: number | null) => {
    if (!priorityId) return 'Padrão';
    // Busca primeiro nos dados globais, depois nos filtrados e formulário
    const allData = [
      ...(allPriorities || []),
      ...(priorities || []), 
      ...(formPriorities || [])
    ];
    const uniquePriorities = allData.filter((priority, index, self) => 
      index === self.findIndex(p => p.id === priority.id)
    );
    return uniquePriorities.find(p => p.id === priorityId)?.name || 'N/A';
  };

  const getPriorityColor = (priorityId: number | null) => {
    if (!priorityId) return '#6B7280';
    // Busca primeiro nos dados globais, depois nos filtrados e formulário
    const allData = [
      ...(allPriorities || []),
      ...(priorities || []), 
      ...(formPriorities || [])
    ];
    const uniquePriorities = allData.filter((priority, index, self) => 
      index === self.findIndex(p => p.id === priority.id)
    );
    return uniquePriorities.find(p => p.id === priorityId)?.color || '#3B82F6';
  };

  const getCompanyName = (companyId: number) => {
    return companies?.find(c => c.id === companyId)?.name || 'N/A';
  };

  const handleAddSLA = () => {
    if (!formData.companyId || formData.companyId <= 0 || !formData.departmentId || formData.departmentId <= 0 || !formData.incidentTypeId || formData.incidentTypeId <= 0) {
      toast({ title: "Erro", description: "Selecione empresa, departamento e tipo de incidente", variant: "destructive" });
      return;
    }

    if (formData.responseTimeHours >= formData.resolutionTimeHours) {
      toast({ title: "Erro", description: "Tempo de resposta deve ser menor que tempo de resolução", variant: "destructive" });
      return;
    }

    createSLAMutation.mutate(formData);
  };

  const handleEditSLA = () => {
    if (!editingSLA) return;

    if (formData.responseTimeHours >= formData.resolutionTimeHours) {
      toast({ title: "Erro", description: "Tempo de resposta deve ser menor que tempo de resolução", variant: "destructive" });
      return;
    }

    editSLAMutation.mutate({
      id: editingSLA.id,
      responseTimeHours: formData.responseTimeHours,
      resolutionTimeHours: formData.resolutionTimeHours,
      isActive: formData.isActive
    });
  };

  const openEditDialog = (slaConfig: SLAConfiguration) => {
    setEditingSLA(slaConfig);
    setFormData({
      companyId: slaConfig.company_id,
      departmentId: slaConfig.department_id,
      incidentTypeId: slaConfig.incident_type_id,
      priorityId: slaConfig.priority_id,
      responseTimeHours: slaConfig.response_time_hours,
      resolutionTimeHours: slaConfig.resolution_time_hours,
      isActive: slaConfig.is_active
    });
    setIsEditDialogOpen(true);
  };

  const handleExportConfigurations = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompanyId) params.append('companyId', selectedCompanyId.toString());
      
      const url = `/api/sla-configurations${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error('Erro ao exportar configurações');
      
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `sla-configurations-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      toast({ title: "Sucesso", description: "Configurações exportadas com sucesso!" });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao exportar configurações", variant: "destructive" });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // Criar CSV template com exemplos
      const headers = [
        'empresa_id',
        'empresa_nome',
        'departamento_id', 
        'departamento_nome',
        'tipo_incidente_id',
        'tipo_incidente_nome',
        'prioridade_id',
        'prioridade_nome',
        'tempo_resposta_horas',
        'tempo_resolucao_horas',
        'ativo'
      ];

      // Dados de exemplo
      const exampleRows = [
        [
          '1',
          'Minha Empresa',
          '1',
          'TI - Suporte',
          '1', 
          'Problema Técnico',
          '1',
          'Alta',
          '2',
          '24',
          'true'
        ],
        [
          '1',
          'Minha Empresa', 
          '1',
          'TI - Suporte',
          '2',
          'Solicitação de Acesso',
          '2', 
          'Média',
          '4',
          '48',
          'true'
        ],
        [
          '1',
          'Minha Empresa',
          '2',
          'RH',
          '3',
          'Questão Administrativa',
          '3',
          'Baixa',
          '8',
          '72',
          'true'
        ]
      ];

      // Montar CSV
      const csvContent = [
        headers.join(','),
        ...exampleRows.map(row => row.join(','))
      ].join('\n');

      // Montar CSV com BOM para UTF-8
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;

      // Criar e baixar arquivo
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `sla-template-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      toast({ 
        title: "Modelo baixado!", 
        description: "Use este arquivo CSV como base para importar suas configurações SLA." 
      });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao baixar modelo", variant: "destructive" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: "Erro", description: "Por favor, selecione um arquivo CSV", variant: "destructive" });
      return;
    }

    try {
      // Ler o arquivo
      const fileContent = await file.text();
      
      // Enviar para a API
      const response = await fetch('/api/sla-configurations/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvData: fileContent }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao importar arquivo');
      }

      const result = await response.json();
      setImportResults(result.data);
      
      // Mostrar toast de sucesso
      toast({ 
        title: "Importação concluída!", 
        description: `${result.data.successful} configurações importadas com sucesso`
      });

    } catch (error) {
      console.error('Erro ao importar CSV:', error);
      toast({ 
        title: "Erro na importação", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive" 
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Configurações de SLA</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Gerencie tempos de resposta e resolução por departamento, tipo e prioridade
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportConfigurations}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileText className="mr-2 h-4 w-4" />
            Modelo CSV
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Configuração
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configurations">Configurações</TabsTrigger>
          <TabsTrigger value="matrix">Matriz SLA</TabsTrigger>
          <TabsTrigger value="bulk">Operações em Lote</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <CardDescription>
                Use os filtros para visualizar configurações específicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Seletor de Empresa (apenas para admin) */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select 
                      value={selectedCompanyId?.toString() || ''} 
                      onValueChange={(value) => setSelectedCompanyId(value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map(company => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {company.name}
                            </div>
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
                    value={selectedDepartmentId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os departamentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os departamentos</SelectItem>
                      {departments?.map(dept => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Tipo de Incidente */}
                <div className="space-y-2">
                  <Label>Tipo de Incidente</Label>
                  <Select 
                    value={selectedIncidentTypeId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedIncidentTypeId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {incidentTypes?.map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggle Apenas Ativos */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="show-only-active"
                      checked={showOnlyActive}
                      onCheckedChange={setShowOnlyActive}
                    />
                    <Label htmlFor="show-only-active" className="text-sm">
                      Apenas configurações ativas
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Configurações */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configurações SLA</CardTitle>
                  <CardDescription>
                    {(Array.isArray(slaConfigurations) ? slaConfigurations.length : 0)} configuração(ões) encontrada(s)
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    toast({ title: "Atualizando", description: "Recarregando configurações..." });
                    await invalidateSLACache();
                    toast({ title: "Sucesso", description: "Configurações atualizadas!" });
                  }}
                  disabled={isLoadingSLA}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSLA ? 'animate-spin' : ''}`} />
                  {isLoadingSLA ? 'Carregando...' : 'Atualizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSLA ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : slaConfigurations && Array.isArray(slaConfigurations) && slaConfigurations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                        <TableHead>Departamento</TableHead>
                        <TableHead>Tipo de Incidente</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4" />
                            Resposta (h)
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Target className="h-4 w-4" />
                            Resolução (h)
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="space-y-1">
                      {(Array.isArray(slaConfigurations) ? slaConfigurations : []).map((config: SLAConfiguration) => (
                        <TableRow key={config.id} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                          {user?.role === 'admin' && (
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-neutral-500" />
                                {getCompanyName(config.company_id)}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="font-medium py-4">
                            {getDepartmentName(config.department_id)}
                          </TableCell>
                          <TableCell className="py-4">{getIncidentTypeName(config.incident_type_id)}</TableCell>
                          <TableCell className="py-4">
                            <Badge 
                              variant="outline" 
                              style={{ 
                                borderColor: getPriorityColor(config.priority_id),
                                color: getPriorityColor(config.priority_id)
                              }}
                            >
                              {getPriorityName(config.priority_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono py-4">
                            {config.response_time_hours}h
                          </TableCell>
                          <TableCell className="text-center font-mono py-4">
                            {config.resolution_time_hours}h
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge variant={config.is_active ? "default" : "secondary"}>
                              {config.is_active ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativo
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Inativo
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(config)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir esta configuração SLA?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSLAMutation.mutate(config.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <SettingsIcon className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">
                    Nenhuma configuração encontrada
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Configure seu primeiro SLA para começar.
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Configuração
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Matriz SLA</CardTitle>
              <CardDescription>
                Visualização em matriz das configurações SLA por departamento e tipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros para a Matriz */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Empresa */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select 
                      value={selectedCompanyId?.toString() || 'all'} 
                      onValueChange={(value) => setSelectedCompanyId(value === 'all' ? undefined : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as empresas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as empresas</SelectItem>
                        {companies?.map(company => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Departamento */}
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select 
                    value={selectedDepartmentId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os departamentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os departamentos</SelectItem>
                      {departments?.map(dept => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Incidente */}
                <div className="space-y-2">
                  <Label>Tipo de Incidente</Label>
                  <Select 
                    value={selectedIncidentTypeId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedIncidentTypeId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedDepartmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {incidentTypes?.map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Matriz SLA */}
              {isLoadingSLA ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : !selectedCompanyId ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">
                    Selecione uma empresa
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Escolha uma empresa para visualizar a matriz SLA
                  </p>
                </div>
              ) : !slaConfigurations?.length ? (
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">
                    Nenhuma configuração SLA encontrada
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Crie configurações SLA na aba "Configurações" para visualizar a matriz
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Agrupar por departamento */}
                  {departments?.filter(dept => 
                    !selectedDepartmentId || dept.id === selectedDepartmentId
                  ).map(department => {
                    const deptSLAs = (Array.isArray(slaConfigurations) ? slaConfigurations : []).filter((sla: SLAConfiguration) => sla.department_id === department.id);
                    
                    if (deptSLAs.length === 0) return null;

                    // Agrupar por tipo de incidente
                    const slaByIncidentType = deptSLAs.reduce((acc: Record<number, SLAConfiguration[]>, sla: SLAConfiguration) => {
                      if (!acc[sla.incident_type_id]) {
                        acc[sla.incident_type_id] = [];
                      }
                      acc[sla.incident_type_id].push(sla);
                      return acc;
                    }, {} as Record<number, SLAConfiguration[]>);

                    return (
                      <div key={department.id} className="border rounded-lg">
                        <div className="bg-neutral-50 px-4 py-3 border-b">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-neutral-600" />
                            <h3 className="font-medium text-neutral-900">{department.name}</h3>
                            <Badge variant="secondary" className="ml-2">
                              {deptSLAs.length} configurações
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[200px]">Tipo de Incidente</TableHead>
                                  <TableHead>Prioridade</TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      Resposta
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Target className="h-4 w-4" />
                                      Resolução
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(slaByIncidentType).map(([incidentTypeId, slas]) => {
                                  const incidentTypeName = getIncidentTypeName(parseInt(incidentTypeId));
                                  
                                  return slas.map((sla, index) => (
                                    <TableRow key={sla.id}>
                                      {index === 0 && (
                                        <TableCell 
                                          className="font-medium border-r"
                                          rowSpan={slas.length}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                            {incidentTypeName}
                                          </div>
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        {sla.priority_id ? (
                                          <div className="flex items-center gap-2">
                                            <div 
                                              className="w-3 h-3 rounded-full"
                                              style={{ backgroundColor: getPriorityColor(sla.priority_id) }}
                                            />
                                            <span className="text-sm font-medium">
                                              {getPriorityName(sla.priority_id)}
                                            </span>
                                          </div>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">
                                            Padrão (todas)
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant="secondary" className="font-mono">
                                          {sla.response_time_hours}h
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant="secondary" className="font-mono">
                                          {sla.resolution_time_hours}h
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {sla.is_active ? (
                                          <Badge variant="default" className="bg-green-100 text-green-800">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Ativo
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Inativo
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ));
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Operações em Lote</CardTitle>
              <CardDescription>
                Crie, atualize ou copie múltiplas configurações SLA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Copy className="mx-auto h-12 w-12 text-neutral-400" />
                <h3 className="mt-2 text-sm font-medium text-neutral-900">
                  Operações em Lote
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para Adicionar/Editar SLA */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          setEditingSLA(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? 'Editar Configuração SLA' : 'Nova Configuração SLA'}
            </DialogTitle>
            <DialogDescription>
              Configure os tempos de resposta e resolução para esta combinação específica.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!isEditDialogOpen && (
              <>
                {/* Seletor de Empresa */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select 
                      value={formData.companyId.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map(company => (
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
                  <Label>Departamento *</Label>
                  <Select 
                    value={formData.departmentId.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: parseInt(value) }))}
                    disabled={!formData.companyId || !departments?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(dept => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Tipo de Incidente */}
                <div className="space-y-2">
                  <Label>Tipo de Incidente *</Label>
                  <Select 
                    value={formData.incidentTypeId.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, incidentTypeId: parseInt(value) }))}
                    disabled={!formData.departmentId || !formIncidentTypes?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {formIncidentTypes?.map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Prioridade */}
                <div className="space-y-2">
                  <Label>Prioridade {formPriorities && `(${formPriorities.length} encontradas)`}</Label>
                  <Select 
                    value={formData.priorityId?.toString() || 'null'} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      priorityId: value === 'null' ? null : parseInt(value) 
                    }))}
                    disabled={!formPriorities?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Padrão (todas as prioridades)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Padrão (todas as prioridades)</SelectItem>
                      {formPriorities?.map(priority => (
                        <SelectItem key={priority.id} value={priority.id.toString()}>
                          <div className="flex items-center gap-2">
                            {priority.color && (
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: priority.color }}
                              />
                            )}
                            {priority.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Tempo de Resposta */}
            <div className="space-y-2">
              <Label>Tempo de Resposta (horas) *</Label>
              <Input
                type="number"
                min="1"
                max="8760"
                value={formData.responseTimeHours}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  responseTimeHours: parseInt(e.target.value) || 1 
                }))}
                placeholder="Ex: 2"
              />
            </div>

            {/* Tempo de Resolução */}
            <div className="space-y-2">
              <Label>Tempo de Resolução (horas) *</Label>
              <Input
                type="number"
                min="1"
                max="8760"
                value={formData.resolutionTimeHours}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  resolutionTimeHours: parseInt(e.target.value) || 8 
                }))}
                placeholder="Ex: 24"
              />
            </div>

            {/* Status Ativo */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="is-active">Configuração ativa</Label>
            </div>

            {/* Validação visual */}
            {formData.responseTimeHours >= formData.resolutionTimeHours && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">
                  Tempo de resposta deve ser menor que tempo de resolução
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
                setEditingSLA(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={isEditDialogOpen ? handleEditSLA : handleAddSLA}
              disabled={createSLAMutation.isPending || editSLAMutation.isPending}
            >
              {(createSLAMutation.isPending || editSLAMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditDialogOpen ? 'Salvar Alterações' : 'Criar Configuração'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Importação */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Configurações SLA</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV com as configurações SLA para importar em lote
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Instruções */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">📋 Como usar:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Baixe o <strong>Modelo CSV</strong> para ver a estrutura necessária</li>
                <li>2. Preencha seus dados seguindo o modelo</li>
                <li>3. Faça upload do arquivo CSV preenchido</li>
              </ol>
            </div>

            {/* Input de arquivo */}
            <div className="space-y-2">
              <Label htmlFor="csv-file">Arquivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Apenas arquivos .csv são aceitos
              </p>
            </div>

            {/* Preview dos resultados */}
            {importResults && (
              <div className="space-y-3">
                <h4 className="font-medium">Resultados da Importação:</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-700">
                      {importResults.successful}
                    </div>
                    <div className="text-xs text-green-600">Sucesso</div>
                  </div>
                  
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-orange-700">
                      {importResults.duplicates}
                    </div>
                    <div className="text-xs text-orange-600">Duplicados</div>
                  </div>
                  
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-red-700">
                      {importResults.errors}
                    </div>
                    <div className="text-xs text-red-600">Erros</div>
                  </div>
                </div>

                {/* Detalhes dos erros */}
                {importResults.details?.errors?.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-red-700">Erros encontrados:</h5>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResults.details.errors.map((error: any, index: number) => (
                        <div key={index} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                          <strong>Linha {error.line}:</strong> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportResults(null);
              }}
            >
              Fechar
            </Button>
            {importResults && importResults.successful > 0 && (
              <Button 
                onClick={async () => {
                  await invalidateSLACache();
                  setIsImportDialogOpen(false);
                  setImportResults(null);
                  toast({ title: "Sucesso", description: "Configurações importadas e atualizadas!" });
                }}
              >
                Concluir
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 