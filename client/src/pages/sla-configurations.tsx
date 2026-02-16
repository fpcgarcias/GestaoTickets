import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  FileText,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from '@/i18n';

// Interfaces
interface Company {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  company_id: number;
  is_active?: boolean;
  active?: boolean;
}

interface IncidentType {
  id: number;
  name: string;
  department_id: number;
  company_id: number;
  is_active?: boolean;
  active?: boolean;
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
  category_id?: number | null;
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
  categoryId?: number | null;
  priorityId?: number | null;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive: boolean;
}

export default function SLAConfigurations() {
  const { toast } = useToast();
  const { user, company: userCompany } = useAuth();
  const { formatMessage } = useI18n();
  
  // Estados para filtros
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    (['manager', 'company_admin', 'supervisor'].includes(user?.role || '')) && userCompany?.id ? userCompany.id : undefined
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>();
  const [selectedIncidentTypeId, setSelectedIncidentTypeId] = useState<number | undefined>();
  const [departmentSlaMode, setDepartmentSlaMode] = useState<'type' | 'category'>('type');
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Estados para modais
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState<SLAConfiguration | null>(null);
  // Unidade de tempo do formulário (apenas para UI). Mantemos o estado interno sempre em horas
  const [timeUnit, setTimeUnit] = useState<'hours' | 'days'>('hours');
  // Estado do combobox de categoria (busca + rolagem, igual ao modal de clientes/atendentes)
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  
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
    categoryId: null,
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
      let url = selectedCompanyId 
        ? `/api/departments?company_id=${selectedCompanyId}`
        : '/api/departments';
      url += (url.includes('?') ? '&' : '?') + 'active_only=true';
      
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
      params.append('active_only', 'true');
      
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
      params.append('active_only', 'true');
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar tipos de incidente');
      
      const response = await res.json();
      return response.data || response.incidentTypes || [];
    },
    enabled: !!(formData.departmentId && (isAddDialogOpen || isEditDialogOpen)),
  });

  // Buscar modo de SLA do departamento selecionado NO FORMULÁRIO (para controlar o modal)
  const { data: deptModeData } = useQuery<{ id: number; sla_mode: 'type' | 'category' } | null>({
    queryKey: ['/api/departments', formData.departmentId, 'sla-mode', (isAddDialogOpen || isEditDialogOpen) ? 'open' : 'closed'],
    queryFn: async () => {
      if (!formData.departmentId) return null;
      const res = await fetch(`/api/departments/${formData.departmentId}/sla-mode`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!formData.departmentId && (isAddDialogOpen || isEditDialogOpen),
  });

  useEffect(() => {
    if (deptModeData?.sla_mode) {
      setDepartmentSlaMode(deptModeData.sla_mode);
    }
  }, [deptModeData]);

  // Buscar categorias quando modo=category e tipo selecionado
  const { data: formCategories } = useQuery<any[]>({
    queryKey: ['/api/categories', formData.incidentTypeId, 'form'],
    queryFn: async () => {
      if (!formData.incidentTypeId) return [];
      const params = new URLSearchParams();
      params.append('incident_type_id', formData.incidentTypeId.toString());
      params.append('active_only', 'true');
      params.append('limit', '1000'); // Garantir lista completa (API usa limit=50 por padrão)
      const res = await fetch(`/api/categories?${params.toString()}`);
      if (!res.ok) return [];
      const response = await res.json();
      return response.categories || [];
    },
    enabled: departmentSlaMode === 'category' && !!formData.incidentTypeId && (isAddDialogOpen || isEditDialogOpen),
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

  // Buscar TODAS as categorias da empresa (para listar nomes em tabela/matriz)
  // Usar limit alto para evitar paginação: em produção pode haver >50 categorias,
  // e a API retorna apenas 50 por padrão, causando fallback para #id na tabela
  const { data: allCategories } = useQuery<any[]>({
    queryKey: ['/api/categories/all', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const params = new URLSearchParams();
      params.append('company_id', String(selectedCompanyId));
      params.append('active_only', 'true');
      params.append('limit', '5000'); // Buscar todas para exibir nomes corretos (API usa limit=50 por padrão)
      const res = await fetch(`/api/categories?${params.toString()}`);
      if (!res.ok) return [];
      const response = await res.json();
      return response.categories || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Helper: monta mensagem de erro a partir da resposta da API (suporta i18n e códigos conhecidos)
  type APIErrorBody = { code?: string; message?: string; error?: string; errors?: Array<{ message?: string; code?: string }> };
  const getSLAErrorMessage = (
    body: APIErrorBody,
    fallbackKey: 'error_create_failed' | 'error_update_failed' | 'error_delete_failed'
  ): string => {
    if (body?.code === 'DUPLICATE_CONFIGURATION') {
      return formatMessage('sla_config.error_duplicate_configuration');
    }
    if (body?.message && typeof body.message === 'string') return body.message;
    if (Array.isArray(body?.errors) && body.errors[0]?.message) return body.errors[0].message;
    return formatMessage(`sla_config.${fallbackKey}`);
  };

  // Mutation para criar configuração SLA
  const createSLAMutation = useMutation({
    mutationFn: async (data: SLAConfigurationForm) => {
      const payload: any = { ...data };
      if (departmentSlaMode === 'type') {
        delete payload.categoryId;
      }
      const res = await fetch('/api/sla-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let body: Record<string, unknown> = {};
        try {
          body = await res.json();
        } catch {
          // Resposta não é JSON (ex.: HTML de erro)
        }
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ [FRONTEND] Erro da API:', body);
        }
        const message = getSLAErrorMessage(body as APIErrorBody, 'error_create_failed');
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.sla_configuration_created') });

      await invalidateSLACache();

      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: formatMessage('sla_config.error'), description: error.message, variant: "destructive" });
    },
  });

  // Mutation para editar configuração SLA
  const editSLAMutation = useMutation({
    mutationFn: async (data: { id: number } & Partial<SLAConfigurationForm>) => {
      const { id, ...updateData } = data;
      const payload: any = { ...updateData };
      if (departmentSlaMode === 'type') {
        delete payload.categoryId;
      }
      const res = await fetch(`/api/sla-configurations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let body: Record<string, unknown> = {};
        try {
          body = await res.json();
        } catch {
          //
        }
        const message = getSLAErrorMessage(body as APIErrorBody, 'error_update_failed');
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: async (_data) => {
      toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.sla_configuration_updated') });
      
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
      toast({ title: formatMessage('sla_config.error'), description: error.message, variant: "destructive" });
    },
  });

  // Mutation para deletar configuração SLA
  const deleteSLAMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sla-configurations/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        let body: Record<string, unknown> = {};
        try {
          body = await res.json();
        } catch {
          //
        }
        const message = getSLAErrorMessage(body as APIErrorBody, 'error_delete_failed');
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: async (_data, _variables) => {
      toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.sla_configuration_removed') });
      
      // Usar função auxiliar para invalidar cache
      await invalidateSLACache();
    },
    onError: (error: Error) => {
      toast({ title: formatMessage('sla_config.error'), description: error.message, variant: "destructive" });
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
      categoryId: null,
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

   // Obter nome da categoria
  const getCategoryName = (categoryId: number | null | undefined) => {
    if (!categoryId) return '—';
    const fromAll = (allCategories || []).find((c: any) => c.id === categoryId);
    if (fromAll) return fromAll.name;
    // fallback: procurar nas categorias do formulário
    const fromForm = (formCategories || []).find((c: any) => c.id === categoryId);
    if (fromForm) return fromForm.name;
    return `#${categoryId}`;
  };

  const getPriorityName = (priorityId: number | null) => {
    if (!priorityId) return formatMessage('sla_config.default');
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
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.select_company_department_incident_type'), variant: "destructive" });
      return;
    }

    if (formData.responseTimeHours >= formData.resolutionTimeHours) {
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.response_time_validation'), variant: "destructive" });
      return;
    }

    if (departmentSlaMode === 'category') {
      const hasCategories = (formCategories || []).length > 0;
      if (hasCategories && (!formData.categoryId || formData.categoryId <= 0)) {
        toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.select_category'), variant: "destructive" });
        return;
      }
    }

    createSLAMutation.mutate(formData);
  };

  const handleEditSLA = () => {
    if (!editingSLA) return;

    if (formData.responseTimeHours >= formData.resolutionTimeHours) {
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.response_time_validation'), variant: "destructive" });
      return;
    }

    if (departmentSlaMode === 'category') {
      // Em edição de tempos, não exigimos mudar categoria; validação de backend cobre consistência
      if (!editingSLA?.category_id && (!formData.categoryId || formData.categoryId <= 0)) {
        // nada a fazer; seguimos pois não mudamos a chave de combinação
      }
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
      categoryId: (slaConfig as any).category_id ?? null,
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
      
      toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.configurations_exported') });
    } catch (_error) {
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.export_error'), variant: "destructive" });
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
        title: formatMessage('sla_config.template_downloaded'), 
        description: formatMessage('sla_config.use_csv_template_description') 
      });
    } catch (_error) {
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.download_template_error'), variant: "destructive" });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: formatMessage('sla_config.error'), description: formatMessage('sla_config.please_select_csv_file'), variant: "destructive" });
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
        if (process.env.NODE_ENV !== 'production') {
          console.error('Erro ao importar CSV:', error);
        }
        throw new Error(error.error || 'Erro ao importar arquivo');
      }

      const result = await response.json();
      setImportResults(result.data);
      
      // Mostrar toast de sucesso
      toast({ 
        title: formatMessage('sla_config.import_completed'), 
        description: formatMessage('sla_config.configurations_imported_successfully', { count: result.data.successful })
      });

    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erro ao importar CSV:', error);
      }
      toast({ 
        title: formatMessage('sla_config.import_error'), 
        description: error instanceof Error ? error.message : formatMessage('sla_config.unknown_error'),
        variant: "destructive" 
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('sla_config.title')}</h1>
          <p className="text-sm text-neutral-600 mt-1">
            {formatMessage('sla_config.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportConfigurations}>
            <Download className="mr-2 h-4 w-4" />
            {formatMessage('sla_config.export')}
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileText className="mr-2 h-4 w-4" />
            {formatMessage('sla_config.csv_template')}
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {formatMessage('sla_config.import')}
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {formatMessage('sla_config.new_configuration')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configurations">{formatMessage('sla_config.configurations')}</TabsTrigger>
          <TabsTrigger value="matrix">{formatMessage('sla_config.sla_matrix')}</TabsTrigger>
          <TabsTrigger value="bulk">{formatMessage('sla_config.bulk_operations')}</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {formatMessage('sla_config.filters')}
              </CardTitle>
              <CardDescription>
                {formatMessage('sla_config.filters_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Seletor de Empresa (apenas para admin) */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>{formatMessage('sla_config.company')}</Label>
                    <Select 
                      value={selectedCompanyId?.toString() || ''} 
                      onValueChange={(value) => setSelectedCompanyId(value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formatMessage('sla_config.select_company')} />
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
                  <Label>{formatMessage('sla_config.department')}</Label>
                  <Select 
                    value={selectedDepartmentId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.all_departments')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('sla_config.all_departments')}</SelectItem>
                      {departments
                        ?.filter(dept => (dept.is_active ?? dept.active ?? true))
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
                        .map(dept => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Tipo de Incidente */}
                <div className="space-y-2">
                  <Label>{formatMessage('sla_config.incident_type')}</Label>
                  <Select 
                    value={selectedIncidentTypeId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedIncidentTypeId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.all_types')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('sla_config.all_types')}</SelectItem>
                      {incidentTypes
                        ?.filter(type => (type.is_active ?? type.active ?? true))
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
                        .map(type => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggle Apenas Ativos */}
                <div className="space-y-2">
                  <Label>{formatMessage('sla_config.status')}</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="show-only-active"
                      checked={showOnlyActive}
                      onCheckedChange={setShowOnlyActive}
                    />
                    <Label htmlFor="show-only-active" className="text-sm">
                      {formatMessage('sla_config.only_active_configurations')}
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
                  <CardTitle>{formatMessage('sla_config.sla_configurations')}</CardTitle>
                  <CardDescription>
                    {formatMessage('sla_config.configurations_found', { count: (Array.isArray(slaConfigurations) ? slaConfigurations.length : 0) })}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    toast({ title: formatMessage('sla_config.updating'), description: formatMessage('sla_config.reloading_configurations') });
                    await invalidateSLACache();
                    toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.configurations_updated') });
                  }}
                  disabled={isLoadingSLA}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSLA ? 'animate-spin' : ''}`} />
                  {isLoadingSLA ? formatMessage('sla_config.loading') : formatMessage('sla_config.refresh')}
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
                        {user?.role === 'admin' && <TableHead>{formatMessage('sla_config.company')}</TableHead>}
                        <TableHead>{formatMessage('sla_config.department')}</TableHead>
                        <TableHead>{formatMessage('sla_config.incident_type')}</TableHead>
                           <TableHead>{formatMessage('sla_config.category')}</TableHead>
                        <TableHead>{formatMessage('sla_config.priority')}</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatMessage('sla_config.response_hours')}
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Target className="h-4 w-4" />
                            {formatMessage('sla_config.resolution_hours')}
                          </div>
                        </TableHead>
                        <TableHead className="text-center">{formatMessage('sla_config.status')}</TableHead>
                        <TableHead className="text-center">{formatMessage('sla_config.actions')}</TableHead>
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
                             <TableCell className="py-4">{getCategoryName((config as any).category_id)}</TableCell>
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
                                  {formatMessage('sla_config.active')}
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {formatMessage('sla_config.inactive')}
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
                                    <AlertDialogTitle>{formatMessage('sla_config.confirm_deletion')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {formatMessage('sla_config.confirm_deletion_description')}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{formatMessage('sla_config.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSLAMutation.mutate(config.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {formatMessage('sla_config.delete')}
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
                    {formatMessage('sla_config.no_configurations_found')}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatMessage('sla_config.configure_first_sla')}
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {formatMessage('sla_config.new_configuration')}
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
              <CardTitle>{formatMessage('sla_config.sla_matrix')}</CardTitle>
              <CardDescription>
                {formatMessage('sla_config.sla_matrix_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros para a Matriz */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Empresa */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>{formatMessage('sla_config.company')}</Label>
                    <Select 
                      value={selectedCompanyId?.toString() || 'all'} 
                      onValueChange={(value) => setSelectedCompanyId(value === 'all' ? undefined : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formatMessage('sla_config.all_companies')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{formatMessage('sla_config.all_companies')}</SelectItem>
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
                  <Label>{formatMessage('sla_config.department')}</Label>
                  <Select 
                    value={selectedDepartmentId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.all_departments')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('sla_config.all_departments')}</SelectItem>
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
                  <Label>{formatMessage('sla_config.incident_type')}</Label>
                  <Select 
                    value={selectedIncidentTypeId?.toString() || 'all'} 
                    onValueChange={(value) => setSelectedIncidentTypeId(value === 'all' ? undefined : parseInt(value))}
                    disabled={!selectedDepartmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.all_types')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('sla_config.all_types')}</SelectItem>
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
                    {formatMessage('sla_config.select_company')}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatMessage('sla_config.choose_company_to_view_matrix')}
                  </p>
                </div>
              ) : !slaConfigurations?.length ? (
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900">
                    {formatMessage('sla_config.no_sla_configurations_found')}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatMessage('sla_config.create_sla_configs_to_view_matrix')}
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
                              {formatMessage('sla_config.configurations_count', { count: deptSLAs.length })}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[200px]">{formatMessage('sla_config.incident_type')}</TableHead>
                                <TableHead>{formatMessage('sla_config.category')}</TableHead>
                                  <TableHead>{formatMessage('sla_config.priority')}</TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {formatMessage('sla_config.response')}
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Target className="h-4 w-4" />
                                      {formatMessage('sla_config.resolution')}
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">{formatMessage('sla_config.status')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(slaByIncidentType).map(([incidentTypeId, slas]) => {
                                  const incidentTypeName = getIncidentTypeName(parseInt(incidentTypeId));
                                  // Agrupar por categoria para mesclar células de categoria
                                  const byCategory = (slas as SLAConfiguration[]).reduce((acc: Record<string, SLAConfiguration[]>, item: any) => {
                                    const key = item.category_id ?? 'null';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(item);
                                    return acc;
                                  }, {} as Record<string, SLAConfiguration[]>);

                                  const rows: React.ReactElement[] = [];
                                  let incidentCellRendered = false;

                                  Object.entries(byCategory).forEach(([catId, list]) => {
                                    list.forEach((sla, idx) => {
                                      rows.push(
                                        <TableRow key={`${incidentTypeId}-${catId}-${sla.id}`}>
                                          {!incidentCellRendered && idx === 0 && (
                                            <TableCell 
                                              className="font-medium border-r"
                                              rowSpan={(slas as SLAConfiguration[]).length}
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                {incidentTypeName}
                                              </div>
                                            </TableCell>
                                          )}
                                          {idx === 0 && (
                                            <TableCell rowSpan={list.length}>
                                              {getCategoryName(catId === 'null' ? null : parseInt(catId))}
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
                                                {formatMessage('sla_config.default_all')}
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
                                                {formatMessage('sla_config.active')}
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                {formatMessage('sla_config.inactive')}
                                              </Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    });
                                    incidentCellRendered = true;
                                  });

                                  return rows;
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
              <CardTitle>{formatMessage('sla_config.bulk_operations')}</CardTitle>
              <CardDescription>
                {formatMessage('sla_config.bulk_operations_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Copy className="mx-auto h-12 w-12 text-neutral-400" />
                <h3 className="mt-2 text-sm font-medium text-neutral-900">
                  {formatMessage('sla_config.bulk_operations')}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatMessage('sla_config.feature_in_development')}
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
          setCategoryPopoverOpen(false);
          setCategorySearch('');
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? formatMessage('sla_config.edit_sla_configuration') : formatMessage('sla_config.new_sla_configuration')}
            </DialogTitle>
            <DialogDescription>
              {formatMessage('sla_config.configure_response_resolution_times')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!isEditDialogOpen && (
              <>
                {/* Seletor de Empresa */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>{formatMessage('sla_config.company')} *</Label>
                    <Select 
                      value={formData.companyId.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formatMessage('sla_config.select_company')} />
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
                  <Label>{formatMessage('sla_config.department')} *</Label>
                  <Select 
                    value={formData.departmentId.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      departmentId: parseInt(value), 
                      // zera dependentes ao trocar de depto
                      incidentTypeId: 0 as any,
                      categoryId: null
                    }))}
                    disabled={!formData.companyId || !departments?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.select_department')} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments
                        ?.filter(dept => (dept.is_active ?? dept.active ?? true))
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
                        .map(dept => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Tipo de Chamado */}
                <div className="space-y-2">
                  <Label>{formatMessage('sla_config.incident_type')} *</Label>
                  <Select 
                    value={formData.incidentTypeId ? formData.incidentTypeId.toString() : ''} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      incidentTypeId: parseInt(value),
                      categoryId: null
                    }))}
                    disabled={!formData.departmentId || !formIncidentTypes?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.select_type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {formIncidentTypes
                        ?.filter(type => (type.is_active ?? type.active ?? true))
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
                        .map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seletor de Categoria (apenas quando modo = category) - com barra de busca e rolagem, igual ao modal de clientes */}
                {departmentSlaMode === 'category' && (
                  <div className="space-y-2">
                    <Label>{formatMessage('sla_config.category')} *</Label>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={categoryPopoverOpen}
                          disabled={!(formCategories && formCategories.length > 0)}
                          className="w-full justify-between font-normal"
                        >
                          {formData.categoryId && formCategories?.length
                            ? (formCategories.find((c: any) => c.id === formData.categoryId) as any)?.name ?? formatMessage('sla_config.select_category')
                            : (formCategories && formCategories.length > 0) ? formatMessage('sla_config.select_category') : formatMessage('sla_config.no_categories_for_type')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command className="max-h-[300px]">
                          <CommandInput
                            placeholder={formatMessage('sla_config.search_category')}
                            value={categorySearch}
                            onValueChange={setCategorySearch}
                          />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                {formatMessage('sla_config.no_categories_for_type')}
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {formCategories
                                ?.filter((cat: any) => (cat?.is_active ?? cat?.active ?? true))
                                .slice()
                                .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
                                .map((cat: any) => (
                                  <CommandItem
                                    key={cat.id}
                                    value={cat.name}
                                    onSelect={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        categoryId: cat.id,
                                      }));
                                      setCategoryPopoverOpen(false);
                                      setCategorySearch('');
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.categoryId === cat.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {cat.name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Seletor de Prioridade */}
                <div className="space-y-2">
                  <Label>{formatMessage('sla_config.priority')} {formPriorities && `(${formPriorities.length} ${formatMessage('sla_config.found')})`}</Label>
                  <Select 
                    value={formData.priorityId?.toString() || 'null'} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      priorityId: value === 'null' ? null : parseInt(value) 
                    }))}
                    disabled={!formPriorities?.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('sla_config.default_all_priorities')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">{formatMessage('sla_config.default_all_priorities')}</SelectItem>
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

            {/* Unidade de tempo (toggle) */}
            <div className="flex items-center justify-between">
              <Label htmlFor="toggle-time-unit">{formatMessage('sla_config.use_days')}</Label>
              <Switch
                id="toggle-time-unit"
                checked={timeUnit === 'days'}
                onCheckedChange={(checked) => setTimeUnit(checked ? 'days' : 'hours')}
              />
            </div>

            {/* Tempo de Resposta */}
            <div className="space-y-2">
              <Label>{formatMessage('sla_config.response_time')} ({timeUnit === 'hours' ? formatMessage('sla_config.hours') : formatMessage('sla_config.days')}) *</Label>
              <Input
                type="number"
                min={1}
                max={timeUnit === 'hours' ? 8760 : 365}
                step={timeUnit === 'days' ? 0.5 : 1}
                value={
                  timeUnit === 'hours'
                    ? formData.responseTimeHours
                    : Number((formData.responseTimeHours / 24).toFixed(2))
                }
                onChange={(e) => {
                  const inputValue = parseFloat(e.target.value);
                  const normalized = Number.isNaN(inputValue) ? 1 : Math.max(1, inputValue);
                  const hours = timeUnit === 'hours'
                    ? Math.round(normalized)
                    : Math.round(normalized * 24);
                  setFormData(prev => ({ ...prev, responseTimeHours: hours }));
                }}
                placeholder="Ex: 2"
              />
            </div>

            {/* Tempo de Resolução */}
            <div className="space-y-2">
              <Label>{formatMessage('sla_config.resolution_time')} ({timeUnit === 'hours' ? formatMessage('sla_config.hours') : formatMessage('sla_config.days')}) *</Label>
              <Input
                type="number"
                min={1}
                max={timeUnit === 'hours' ? 8760 : 365}
                step={timeUnit === 'days' ? 0.5 : 1}
                value={
                  timeUnit === 'hours'
                    ? formData.resolutionTimeHours
                    : Number((formData.resolutionTimeHours / 24).toFixed(2))
                }
                onChange={(e) => {
                  const inputValue = parseFloat(e.target.value);
                  const normalized = Number.isNaN(inputValue) ? 1 : Math.max(1, inputValue);
                  const hours = timeUnit === 'hours'
                    ? Math.round(normalized)
                    : Math.round(normalized * 24);
                  setFormData(prev => ({ ...prev, resolutionTimeHours: hours }));
                }}
                placeholder="Ex: 24"
              />
            </div>

            {/* Status Ativo */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="is-active">{formatMessage('sla_config.active_configuration')}</Label>
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            {/* Validação visual */}
            {formData.responseTimeHours >= formData.resolutionTimeHours && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">
                  {formatMessage('sla_config.response_time_validation')}
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
                setCategoryPopoverOpen(false);
                setCategorySearch('');
                resetForm();
              }}
            >
              {formatMessage('sla_config.cancel')}
            </Button>
            <Button 
              onClick={isEditDialogOpen ? handleEditSLA : handleAddSLA}
              disabled={createSLAMutation.isPending || editSLAMutation.isPending}
            >
              {(createSLAMutation.isPending || editSLAMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditDialogOpen ? formatMessage('sla_config.save_changes') : formatMessage('sla_config.create_configuration')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Importação */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formatMessage('sla_config.import_sla_configurations')}</DialogTitle>
            <DialogDescription>
              {formatMessage('sla_config.import_sla_description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Instruções */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">📋 {formatMessage('sla_config.how_to_use')}:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. {formatMessage('sla_config.download_csv_template')}</li>
                <li>2. {formatMessage('sla_config.fill_data_following_template')}</li>
                <li>3. {formatMessage('sla_config.upload_filled_csv')}</li>
              </ol>
            </div>

            {/* Input de arquivo */}
            <div className="space-y-2">
              <Label htmlFor="csv-file">{formatMessage('sla_config.csv_file')}</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage('sla_config.only_csv_files_accepted')}
              </p>
            </div>

            {/* Preview dos resultados */}
            {importResults && (
              <div className="space-y-3">
                <h4 className="font-medium">{formatMessage('sla_config.import_results')}:</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-700">
                      {importResults.successful}
                    </div>
                    <div className="text-xs text-green-600">{formatMessage('sla_config.success')}</div>
                  </div>
                  
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-orange-700">
                      {importResults.duplicates}
                    </div>
                    <div className="text-xs text-orange-600">{formatMessage('sla_config.duplicates')}</div>
                  </div>
                  
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                    <div className="text-lg font-bold text-red-700">
                      {importResults.errors}
                    </div>
                    <div className="text-xs text-red-600">{formatMessage('sla_config.errors')}</div>
                  </div>
                </div>

                {/* Detalhes dos erros */}
                {importResults.details?.errors?.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-red-700">{formatMessage('sla_config.errors_found')}:</h5>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResults.details.errors.map((error: any, index: number) => (
                        <div key={index} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                          <strong>{formatMessage('sla_config.line')} {error.line}:</strong> {error.error}
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
              {formatMessage('sla_config.close')}
            </Button>
            {importResults && importResults.successful > 0 && (
              <Button 
                onClick={async () => {
                  await invalidateSLACache();
                  setIsImportDialogOpen(false);
                  setImportResults(null);
                  toast({ title: formatMessage('sla_config.success'), description: formatMessage('sla_config.configurations_imported_updated') });
                }}
              >
                {formatMessage('sla_config.complete')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 