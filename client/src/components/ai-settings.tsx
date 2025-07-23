import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Loader2, 
  Settings2, 
  Brain, 
  TestTube, 
  Trash2, 
  Pencil,
  Eye,
  EyeOff,
  Bot,
  Settings,
  Lightbulb,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Key,
  Globe,
  Server,
  Edit3,
  Target,
  RotateCcw
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Interface para configuração de IA
interface AiConfiguration {
  id: number;
  name: string;
  provider: 'openai' | 'google' | 'anthropic';
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  department_id?: number | null;
  company_id?: number | null;
  temperature: string;
  max_tokens: number;
  timeout_seconds: number;
  max_retries: number;
  fallback_priority: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  is_default: boolean;
  analysis_type: 'priority' | 'reopen';
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  department_name?: string;
}

interface TestResult {
  priority: string;
  justification?: string;
  confidence?: number;
  usedFallback: boolean;
  processingTimeMs: number;
}

interface FormData {
  name: string;
  provider: 'openai' | 'google' | 'anthropic';
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  department_id: number | null;
  company_id: number | null;
  temperature: string;
  max_tokens: number;
  timeout_seconds: number;
  max_retries: number;
  fallback_priority: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  is_default: boolean;
  analysis_type: 'priority' | 'reopen';
}

interface TestData {
  test_title: string;
  test_description: string;
  tempo_espera?: string;
  prioridade_atual?: string;
  ultima_interacao?: string;
}

// Interface para configurações de uso de IA
interface AiUsageSettings {
  ai_permission_granted: boolean;
  ai_usage_enabled: boolean;
}

// Interface para departamentos
interface Department {
  id: number;
  name: string;
  description?: string;
}

interface AiProvider {
  name: string;
  model: string;
  endpoint: string;
  token: string;
  isActive?: boolean;
}

interface TestProviderResult {
  success: boolean;
  message: string;
  response?: any;
  error?: string;
}

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
];

const DEFAULT_MODELS = {
  openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  google: ['gemini-pro', 'gemini-pro-vision'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
};

const DEFAULT_PROMPTS = {
  priority: {
    system: `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios:

CRITICAL: Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente e impedem operações essenciais.

HIGH: Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados, falhas que afetam produtividade significativamente.

MEDIUM: Problemas que causam inconveniência mas têm soluções alternativas, funcionalidades secundárias não funcionando, solicitações de melhorias importantes mas não urgentes.

LOW: Dúvidas simples, solicitações de treinamento, melhorias estéticas, configurações pessoais, problemas que não impedem o trabalho.

IMPORTANTE: Responda EXATAMENTE no formato:
<PRIORIDADE>nome_da_prioridade</PRIORIDADE>
<JUSTIFICATIVA>explicação detalhada da análise baseada no conteúdo do ticket</JUSTIFICATIVA>

Use apenas: critical, high, medium ou low (sempre em minúsculas e em inglês).`,
    user: `Título: {titulo}

Descrição: {descricao}

Analise este ticket e determine sua prioridade. Responda no formato:
<PRIORIDADE>prioridade</PRIORIDADE>
<JUSTIFICATIVA>justificativa</JUSTIFICATIVA>`
  },
  reopen: {
    system: `Você é um assistente especializado em análise de tickets de suporte que estão aguardando resposta do cliente (status wait_customer). Sua função é determinar se um ticket deve ser reaberto automaticamente baseado no tempo de espera e critérios específicos.

Analise as seguintes informações:
- Tempo desde a última interação
- Prioridade do ticket
- Tipo de problema
- Histórico de interações
- Contexto do departamento

Critérios para reabertura:
- CRITICAL/HIGH: Reabrir após 24-48h sem resposta
- MEDIUM: Reabrir após 72h-1 semana sem resposta  
- LOW: Reabrir após 1-2 semanas sem resposta
- Considerar urgência do problema
- Verificar se é um problema recorrente
- Avaliar impacto no negócio

IMPORTANTE: Responda EXATAMENTE no formato:
<ACAO>reabrir|manter_aguardando</ACAO>
<JUSTIFICATIVA>explicação detalhada da decisão baseada nos critérios</JUSTIFICATIVA>
<NOVA_PRIORIDADE>critical|high|medium|low</NOVA_PRIORIDADE>`,
    user: `Título: {titulo}

Descrição: {descricao}

Tempo aguardando: {tempo_espera}
Prioridade atual: {prioridade_atual}
Última interação: {ultima_interacao}

Analise se este ticket deve ser reaberto. Responda no formato:
<ACAO>acao</ACAO>
<JUSTIFICATIVA>justificativa</JUSTIFICATIVA>
<NOVA_PRIORIDADE>prioridade</NOVA_PRIORIDADE>`
  }
};

// Modelos disponíveis atualizados em Dezembro 2024
// OpenAI: GPT-4o (mais recente), GPT-4o-mini (mais eficiente), GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
// Google: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro  
// Anthropic: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
const modelOptions: Record<string, string[]> = {
  openai: [
    'gpt-4.1',
    'gpt-4.1-2025-04-14',
    'gpt-4.1-mini',
    'gpt-4.1-mini-2025-04-14',
    'gpt-4.1-nano',
    'gpt-4.1-nano-2025-04-14',
    'gpt-4.5-preview',
    'gpt-4.5-preview-2025-02-27',
    'gpt-4o',
    'gpt-4o-2024-08-06',
    'gpt-4o-audio-preview',
    'gpt-4o-audio-preview-2024-12-17',
    'gpt-4o-realtime-preview',
    'gpt-4o-realtime-preview-2024-12-17',
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    'gpt-4o-mini-audio-preview',
    'gpt-4o-mini-audio-preview-2024-12-17',
    'gpt-4o-mini-realtime-preview',
    'gpt-4o-mini-realtime-preview-2024-12-17',
    'o1',
    'o1-2024-12-17',
    'o1-pro',
    'o1-pro-2025-03-19',
    'o3',
    'o3-2025-04-16',
    'o4-mini',
    'o4-mini-2025-04-16',
    'o3-mini',
    'o3-mini-2025-01-31',
    'o1-mini',
    'o1-mini-2024-09-12',
    'codex-mini-latest'
  ],
  google: [
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.0-flash',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro'
  ],
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-20241022',
    'claude-3-5-haiku-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-opus-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ]
};

interface AiUsageToggleProps {
  usageSettings?: AiUsageSettings;
  isLoading: boolean;
  refetch: () => void;
}

// Componente para company_admin gerenciar o toggle de uso de IA
function AiUsageToggle({ usageSettings, isLoading, refetch }: AiUsageToggleProps) {
  const { toast } = useToast();

  // Mutação para atualizar configurações de uso
  const updateUsageMutation = useMutation({
    mutationFn: async (ai_usage_enabled: boolean) => {
      const response = await apiRequest("PUT", "/api/settings/ai-usage", { ai_usage_enabled });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar configurações');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações de IA atualizadas com sucesso!",
      });
      refetch(); // Chama a função refetch passada por props
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  if (!usageSettings?.ai_permission_granted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Inteligência Artificial
          </CardTitle>
          <CardDescription>
            Configurações de IA para sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 border border-dashed rounded-lg">
            <Brain className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">IA não disponível</h3>
            <p className="text-gray-500">
              Sua empresa não tem permissão para usar funcionalidades de IA. 
              Entre em contato com o administrador do sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Inteligência Artificial
        </CardTitle>
        <CardDescription>
          Configure o uso de IA para análise automática de tickets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Toggle de uso de IA */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="ai-usage-toggle" className="text-base font-medium">
                Usar Inteligência Artificial
              </Label>
              <p className="text-sm text-muted-foreground">
                Ativa a análise automática de prioridade de tickets usando IA
              </p>
            </div>
            <Switch
              id="ai-usage-toggle"
              checked={usageSettings.ai_usage_enabled}
              onCheckedChange={(checked) => updateUsageMutation.mutate(checked)}
              disabled={updateUsageMutation.isPending}
            />
          </div>

          {/* Informações sobre a IA */}
          {usageSettings.ai_usage_enabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">IA Ativada</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    A inteligência artificial está analisando automaticamente a prioridade dos novos tickets 
                    baseada no título e descrição fornecidos.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente principal - agora diferencia entre admin e company_admin
export default function AiSettings() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Acesso não autorizado.</p>
        </CardContent>
      </Card>
    );
  }

  // Admin vê configuração completa global, company_admin, manager e supervisor veem toggle + configuração por departamento
  if (user?.role === 'admin') {
    return <AdminAiConfiguration />;
  } else if (user?.role === 'company_admin' || user?.role === 'manager' || user?.role === 'supervisor') {
    return <CompanyAiConfiguration />;
  } else {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Acesso não autorizado.</p>
        </CardContent>
      </Card>
    );
  }
}

// Componente para company_admin, manager, supervisor - toggle + configuração por departamento
function CompanyAiConfiguration() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Garantir que o usuário está completamente carregado antes de fazer a query
  const shouldFetch = !isAuthLoading && 
                     !!user && 
                     !!user.id && 
                     (user.role === 'company_admin' || user.role === 'manager' || user.role === 'supervisor');

  // Log para debug
  React.useEffect(() => {
    console.log('CompanyAiConfiguration - shouldFetch:', shouldFetch, {
      isAuthLoading,
      hasUser: !!user,
      userId: user?.id,
      userRole: user?.role
    });
  }, [shouldFetch, isAuthLoading, user]);

  // Buscar configurações de uso de IA uma única vez
  const { data: usageSettings, isLoading: isUsageSettingsLoading, refetch } = useQuery<AiUsageSettings>({
    queryKey: ["/api/settings/ai-usage"],
    queryFn: async () => {
      // Double check antes de fazer a requisição
      if (!user || !user.id) {
        return { ai_permission_granted: false, ai_usage_enabled: false };
      }
      
      try {
        const response = await apiRequest("GET", "/api/settings/ai-usage");
        if (!response.ok) {
          // Não jogue erro para 401, apenas retorne null ou um objeto padrão
          if (response.status === 401) {
            console.warn('Usuário não autenticado ao buscar configurações de IA');
            return { ai_permission_granted: false, ai_usage_enabled: false };
          }
          if (response.status === 403) {
            // Empresa não tem permissão
            const data = await response.json();
            return { 
              ai_permission_granted: false, 
              ai_usage_enabled: false,
              message: data.message 
            };
          }
          const errorData = await response.json();
          throw new Error(errorData.message || 'Falha ao buscar configurações de IA');
        }
        return response.json();
      } catch (error) {
        console.error('Erro ao buscar configurações de IA:', error);
        return { ai_permission_granted: false, ai_usage_enabled: false };
      }
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: false, // Desabilitar retry automático para evitar loops
    refetchOnWindowFocus: false, // Evitar refetch automático no foco da janela
  });

  if (isAuthLoading || isUsageSettingsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  // Verificar se a empresa tem permissão para usar IA
  if (!usageSettings?.ai_permission_granted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Configurações de IA
          </CardTitle>
          <CardDescription>
            Análise inteligente de prioridades usando Inteligência Artificial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-4">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
              <div>
                <p className="text-lg font-medium">Recurso não disponível</p>
                <p className="text-muted-foreground mt-2">
                  Sua empresa não possui permissão para usar recursos de IA. 
                  Entre em contato com o administrador do sistema para solicitar acesso.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle de uso da IA */}
      <AiUsageToggle usageSettings={usageSettings} isLoading={isUsageSettingsLoading} refetch={refetch} />
      
      {/* Configurações de IA por departamento */}
      <DepartmentAiConfigurationWrapper />
    </div>
  );
}

// Wrapper que verifica permissões antes de mostrar configurações por departamento
function DepartmentAiConfigurationWrapper() {
  const { user } = useAuth();

  // Este componente agora só é renderizado quando há permissão
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configurações de IA por Departamento
        </CardTitle>
        <CardDescription>
          Configure prompts específicos para análise de IA por departamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DepartmentAiConfiguration />
      </CardContent>
    </Card>
  );
}

// Componente para configuração de IA específica por departamento
function DepartmentAiConfiguration() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Estados
  const [configurations, setConfigurations] = useState<AiConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfiguration | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState({
    test_title: "Sistema de email não está funcionando",
    test_description: "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe.",
    tempo_espera: "",
    prioridade_atual: "",
    ultima_interacao: ""
  });
  const [availableProviders, setAvailableProviders] = useState<AiProvider[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as 'openai' | 'google' | 'anthropic',
    model: 'gpt-4o',
    system_prompt: '',
    user_prompt_template: '',
    department_id: null as number | null,
    company_id: user?.company?.id || null,
    temperature: '0.1',
    max_tokens: 500,
    timeout_seconds: 30,
    max_retries: 3,
    fallback_priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    is_active: true,
    is_default: false,
    analysis_type: 'priority' as 'priority' | 'reopen'
  });

  const [selectedAnalysisType, setSelectedAnalysisType] = useState<'priority' | 'reopen'>('priority');

  // Buscar configurações de IA (backend já filtra por empresa)
  const fetchConfigurations = async (analysisType?: 'priority' | 'reopen') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (analysisType) {
        params.append('analysis_type', analysisType);
      }
      const response = await apiRequest('GET', `/api/ai-configurations?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Backend já retorna apenas as configurações da empresa do usuário
        setConfigurations(data);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar provedores disponíveis
  const fetchAvailableProviders = async () => {
    try {
      const response = await apiRequest('GET', '/api/ai-configurations/providers');
      if (response.ok) {
        const data = await response.json();
        setAvailableProviders(data);
      }
    } catch (error) {
      console.error('Erro ao buscar provedores disponíveis:', error);
    }
  };

  // Buscar departamentos
  const { data: departmentsData } = useQuery<{departments: Department[]}>({    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments');
      if (!response.ok) throw new Error('Erro ao buscar departamentos');
      return response.json();
    }
  });

  const departments = departmentsData?.departments || [];

  useEffect(() => {
    fetchConfigurations(selectedAnalysisType);
    fetchAvailableProviders();
  }, [selectedAnalysisType]);

  useEffect(() => {
    fetchConfigurations();
    fetchAvailableProviders();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai',
      model: 'gpt-4o',
      system_prompt: '',
      user_prompt_template: '',
      department_id: null,
      company_id: user?.company?.id || null,
      temperature: '0.1',
      max_tokens: 100,
      timeout_seconds: 30,
      max_retries: 3,
      fallback_priority: 'medium',
      is_active: true,
      is_default: false,
      analysis_type: selectedAnalysisType,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Omit<typeof formData, 'id'>) => {
      const response = await fetch('/api/ai-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar configuração');
      }
      return response.json();
    },
    onSuccess: () => {
      setShowForm(false);
      resetForm();
      fetchConfigurations(selectedAnalysisType);
      toast({
        title: "Sucesso",
        description: "Configuração criada com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const response = await fetch(`/api/ai-configurations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar configuração');
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingConfig(null);
      resetForm();
      fetchConfigurations(selectedAnalysisType);
      toast({
        title: "Sucesso",
        description: "Configuração atualizada com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.name) {
      toast({
        title: "Erro",
        description: "Nome da configuração é obrigatório",
        variant: "destructive"
      });
      return;
    }
    
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Função para decodificar caracteres HTML
  const decodeHtml = (text: string): string => {
    if (!text) return text;
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  };

  const openEditDialog = (config: AiConfiguration) => {
    setEditingConfig(config);
    setFormData({
      name: config.name || '',
      provider: config.provider,
      model: config.model || 'gpt-4o',
      system_prompt: decodeHtml(config.system_prompt || ''),
      user_prompt_template: decodeHtml(config.user_prompt_template || ''),
      department_id: config.department_id || null,
      company_id: config.company_id || user?.company?.id || null,
      temperature: config.temperature || '0.1',
      max_tokens: config.max_tokens || 100,
      timeout_seconds: config.timeout_seconds || 30,
      max_retries: config.max_retries || 3,
      fallback_priority: config.fallback_priority || 'medium',
      is_active: config.is_active !== undefined ? config.is_active : true,
      is_default: config.is_default !== undefined ? config.is_default : false,
      analysis_type: config.analysis_type || 'priority',
    });
  };

  const handleTest = async () => {
    setIsTestLoading(true);
    setTestResult(null);

    try {
      const testPayload = {
        provider: formData.provider,
        model: formData.model,
        system_prompt: formData.system_prompt,
        user_prompt_template: formData.user_prompt_template,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        timeout_seconds: formData.timeout_seconds,
        max_retries: formData.max_retries,
        department_id: formData.department_id,
        test_title: testData.test_title || "Sistema de email não está funcionando",
        test_description: testData.test_description || "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
      };

      const response = await fetch('/api/ai-configurations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Falha no teste');
      }

      if (result.success) {
        setTestResult(result.result);
        toast({
          title: "Sucesso",
          description: "Teste executado com sucesso!"
        });
      } else {
        throw new Error(result.error || result.message || 'Teste falhou');
      }

    } catch (error: any) {
      console.error('Erro no teste da configuração:', error);
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive"
      });
      setTestResult({
        priority: 'medium',
        justification: `Erro no teste: ${error.message}`,
        confidence: 0,
        usedFallback: true,
        processingTimeMs: 0
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  if (isLoading) {
    return <div>Carregando configurações...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Abas para tipos de análise */}
      <Tabs value={selectedAnalysisType} onValueChange={(value) => {
        const analysisType = value as 'priority' | 'reopen';
        setSelectedAnalysisType(analysisType);
        fetchConfigurations(analysisType);
      }} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="priority" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <Target className="mr-2 h-4 w-4" />
            Análise de Prioridade
          </TabsTrigger>
          <TabsTrigger value="reopen" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <RotateCcw className="mr-2 h-4 w-4" />
            Análise de Reabertura
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Botão para adicionar nova configuração */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={() => setShowForm(true)}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      {/* Lista de configurações existentes */}
      {configurations.length > 0 ? (
        <div className="space-y-3">
          {configurations.map((config) => (
            <Card key={config.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{config.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {config.department_name} • {config.provider} - {config.model}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(config)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma configuração de IA por departamento encontrada.</p>
          <p className="text-sm mt-2">Clique no botão acima para criar sua primeira configuração.</p>
        </div>
      )}

      {/* Modal para criar/editar configuração */}
      <Dialog open={showForm || !!editingConfig} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingConfig(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingConfig ? 'Editar' : 'Nova'} Configuração de IA - {formData.analysis_type === 'priority' ? 'Prioridade' : 'Reabertura'}
            </DialogTitle>
            <DialogDescription>
              Configure os prompts específicos para análise de {formData.analysis_type === 'priority' ? 'prioridade' : 'reabertura'} deste departamento
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-6">
            {/* Nome, Departamento e Tipo de Análise */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name">Nome da Configuração</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Análise TI, Análise RH..."
                />
              </div>
              <div>
                <Label htmlFor="department">Departamento *</Label>
                <Select 
                  value={formData.department_id?.toString() || ''} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    department_id: v ? parseInt(v) : null 
                  }))}
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
              </div>
              <div>
                <Label htmlFor="analysis_type">Tipo de Análise *</Label>
                <Select 
                  value={formData.analysis_type} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    analysis_type: v as 'priority' | 'reopen'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Análise de Prioridade</SelectItem>
                    <SelectItem value="reopen">Análise de Reabertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provedor e Modelo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Provedor</Label>
                <Select 
                  value={formData.provider} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    provider: v as any,
                    model: modelOptions[v as keyof typeof modelOptions]?.[0] || 'gpt-4o' // Reset model when provider changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model">Modelo</Label>
                <Select 
                  value={formData.model} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelOptions[formData.provider] || []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Prompts */}
            <div className="grid grid-cols-1 gap-4">
              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="system_prompt">Prompt do Sistema</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      system_prompt: DEFAULT_PROMPTS[formData.analysis_type]?.system || DEFAULT_PROMPTS.priority.system 
                    }))}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Usar Padrão
                  </Button>
                </div>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="Instruções específicas para o departamento..."
                  rows={4}
                />
              </div>

              {/* User Prompt Template */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="user_prompt_template">Template do Prompt do Usuário</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      user_prompt_template: DEFAULT_PROMPTS[formData.analysis_type]?.user || DEFAULT_PROMPTS.priority.user 
                    }))}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Usar Padrão
                  </Button>
                </div>
                <Textarea
                  id="user_prompt_template"
                  value={formData.user_prompt_template}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_prompt_template: e.target.value }))}
                  placeholder="Template para análise. Use {titulo} e {descricao} como variáveis..."
                  rows={3}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.analysis_type === 'priority' ? (
                    <>Use <code>{"{titulo}"}</code> e <code>{"{descricao}"}</code> como variáveis que serão substituídas.</>
                  ) : (
                    <>Use <code>{"{titulo}"}</code>, <code>{"{descricao}"}</code>, <code>{"{tempo_espera}"}</code>, <code>{"{prioridade_atual}"}</code> e <code>{"{ultima_interacao}"}</code> como variáveis.</>
                  )}
                </p>
              </div>
            </div>

            {/* Configurações Técnicas */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="temperature">Temperatura</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  min="1"
                  max="4000"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 100 }))}
                />
              </div>
              <div>
                <Label htmlFor="timeout_seconds">Timeout (seg)</Label>
                <Input
                  id="timeout_seconds"
                  type="number"
                  min="1"
                  max="300"
                  value={formData.timeout_seconds}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
                />
              </div>
              <div>
                <Label htmlFor="max_retries">Tentativas</Label>
                <Input
                  id="max_retries"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_retries}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
                />
              </div>
            </div>

            {/* Prioridade de Fallback e Status */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="fallback_priority">Prioridade de Fallback</Label>
                <Select 
                  value={formData.fallback_priority} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, fallback_priority: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Ativa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                />
                <Label htmlFor="is_default">Padrão p/ Departamento</Label>
              </div>
            </div>

            {/* Seção de teste */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Testar Configuração - {formData.analysis_type === 'priority' ? 'Prioridade' : 'Reabertura'}</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="test-title">Título do Teste</Label>
                  <Input
                    id="test-title"
                    value={testData.test_title}
                    onChange={(e) => setTestData(prev => ({ ...prev, test_title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="test-description">Descrição do Teste</Label>
                  <Textarea
                    id="test-description"
                    value={testData.test_description}
                    onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
                    rows={3}
                  />
                </div>
                {formData.analysis_type === 'reopen' && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="test-tempo-espera">Tempo Aguardando</Label>
                        <Input
                          id="test-tempo-espera"
                          value={testData.tempo_espera || '3 dias'}
                          onChange={(e) => setTestData(prev => ({ ...prev, tempo_espera: e.target.value }))}
                          placeholder="Ex: 3 dias, 1 semana"
                        />
                      </div>
                      <div>
                        <Label htmlFor="test-prioridade-atual">Prioridade Atual</Label>
                        <Input
                          id="test-prioridade-atual"
                          value={testData.prioridade_atual || 'medium'}
                          onChange={(e) => setTestData(prev => ({ ...prev, prioridade_atual: e.target.value }))}
                          placeholder="Ex: high, medium, low"
                        />
                      </div>
                      <div>
                        <Label htmlFor="test-ultima-interacao">Última Interação</Label>
                        <Input
                          id="test-ultima-interacao"
                          value={testData.ultima_interacao || 'Solicitação de informações adicionais'}
                          onChange={(e) => setTestData(prev => ({ ...prev, ultima_interacao: e.target.value }))}
                          placeholder="Ex: Resposta do cliente"
                        />
                      </div>
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTestLoading}
                >
                  {isTestLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Testar
                    </>
                  )}
                </Button>
                
                {testResult && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <h5 className="font-medium mb-2">Resultado do Teste:</h5>
                    <div className="text-sm space-y-2">
                      <div><strong>Prioridade:</strong> {testResult.priority}</div>
                      {testResult.justification && (
                        <div>
                          <strong>Justificativa:</strong>
                          <div className="mt-1 p-2 bg-white border rounded text-gray-700">
                            {testResult.justification}
                          </div>
                        </div>
                      )}
                      <div><strong>Tempo:</strong> {testResult.processingTimeMs}ms</div>
                      <div><strong>Fallback:</strong> {testResult.usedFallback ? 'Sim' : 'Não'}</div>
                      {testResult.confidence && (
                        <div><strong>Confiança:</strong> {(testResult.confidence * 100).toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingConfig(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingConfig ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para administradores - configuração global
function AdminAiConfiguration() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Estados
  const [configurations, setConfigurations] = useState<AiConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfiguration | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<AiConfiguration | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState({
    test_title: "Sistema de email não está funcionando",
    test_description: "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
  });

  // Estado do formulário
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as 'openai' | 'google' | 'anthropic',
    model: 'gpt-4o',
    system_prompt: '',
    user_prompt_template: '',
    department_id: null as number | null,
    company_id: null as number | null,
    temperature: '0.1',
    max_tokens: 100,
    timeout_seconds: 30,
    max_retries: 3,
    fallback_priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    is_active: true,
    is_default: false,
    analysis_type: 'priority' as 'priority' | 'reopen'
  });

  // Estado para controlar o tipo de análise selecionado
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<'priority' | 'reopen'>('priority');

  // Estados para administração de provedores
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AiProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<AiProvider | null>(null);
  const [testProviderResult, setTestProviderResult] = useState<TestProviderResult | null>(null);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [providerFormData, setProviderFormData] = useState({
    name: '',
    model: '',
    endpoint: '',
    token: ''
  });

  // Estado para filtro de empresas (apenas para admin)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // Buscar configurações de IA
  const fetchConfigurations = async (analysisType?: 'priority' | 'reopen') => {
    setIsLoading(true);
    try {
      let url = '/api/ai-configurations';
      const params = new URLSearchParams();
      
      if (user?.role === 'admin' && selectedCompanyId) {
        params.append('company_id', selectedCompanyId.toString());
      }
      
      if (analysisType) {
        params.append('analysis_type', analysisType);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await apiRequest('GET', url);
      if (response.ok) {
        const data = await response.json();
        setConfigurations(data);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar provedores de IA
  const fetchProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const response = await apiRequest('GET', '/api/ai-configurations/admin/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Erro ao buscar provedores:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  // Buscar provedores disponíveis
  const fetchAvailableProviders = async () => {
    try {
      const response = await apiRequest('GET', '/api/ai-configurations/providers');
      if (response.ok) {
        const data = await response.json();
        setAvailableProviders(data);
      }
    } catch (error) {
      console.error('Erro ao buscar provedores disponíveis:', error);
    }
  };

  // Buscar departamentos
  const { data: departmentsData } = useQuery<{departments: Department[]}>({
    queryKey: ["/api/departments", selectedCompanyId],
    queryFn: async () => {
      let url = '/api/departments?active_only=true';
      if (user?.role === 'admin' && selectedCompanyId) {
        url += `&company_id=${selectedCompanyId}`;
      }
      const response = await apiRequest('GET', url);
      if (!response.ok) throw new Error('Erro ao buscar departamentos');
      return response.json();
    }
  });

  // Buscar empresas (apenas para admin)
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      if (!response.ok) throw new Error('Erro ao buscar empresas');
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  const departments = departmentsData?.departments || [];

  // Carregar dados na montagem do componente
  useEffect(() => {
    fetchConfigurations(selectedAnalysisType);
    fetchProviders();
    fetchAvailableProviders();
  }, [selectedCompanyId, selectedAnalysisType]); // Recarregar quando empresa selecionada ou tipo de análise mudar

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai',
      model: 'gpt-4o',
      system_prompt: '',
      user_prompt_template: '',
      department_id: null,
      company_id: null,
      temperature: '0.1',
      max_tokens: 100,
      timeout_seconds: 30,
      max_retries: 3,
      fallback_priority: 'medium',
      is_active: true,
      is_default: false,
      analysis_type: selectedAnalysisType,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Omit<FormData, 'id'>) => {
      const response = await fetch('/api/ai-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar configuração');
      }
      return response.json();
    },
    onSuccess: () => {
      setShowForm(false);
      resetForm();
      fetchConfigurations(selectedAnalysisType);
      toast({
        title: "Sucesso",
        description: "Configuração criada com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FormData> }) => {
      const response = await fetch(`/api/ai-configurations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar configuração');
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingConfig(null);
      resetForm();
      fetchConfigurations(selectedAnalysisType);
      toast({
        title: "Sucesso",
        description: "Configuração atualizada com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/ai-configurations/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao deletar configuração');
      }
      return response.json();
    },
    onSuccess: () => {
      fetchConfigurations(selectedAnalysisType);
      toast({
        title: "Sucesso",
        description: "Configuração deletada com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Mutations para provedores
  const updateProvidersMutation = useMutation({
    mutationFn: async (providers: AiProvider[]) => {
      const response = await apiRequest("PUT", "/api/ai-configurations/admin/providers", {
        providers
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Falha ao atualizar provedores' }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
    onSuccess: () => {
      fetchProviders();
      toast({
        title: "Sucesso",
        description: "Provedores atualizados com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const testProviderMutation = useMutation({
    mutationFn: async (provider: AiProvider) => {
      const response = await apiRequest("POST", "/api/ai-configurations/test", {
        provider: provider.name,
        model: provider.model,
        test_title: "Teste de conectividade",
        test_description: "Verificando se o provedor está funcionando corretamente."
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Falha ao testar provedor' }));
        throw new Error(errorBody.message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTestProviderResult({
        success: true,
        message: "Provedor testado com sucesso!",
        response: data
      });
      toast({
        title: "Sucesso",
        description: "Provedor testado com sucesso!",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      setTestProviderResult({
        success: false,
        message: "Falha ao testar provedor",
        error: error.message
      });
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const isLoading_action = createMutation.isPending || updateMutation.isPending;

  const resetProviderForm = () => {
    setProviderFormData({
      name: '',
      model: '',
      endpoint: '',
      token: ''
    });
  };

  const handleAddProvider = () => {
    if (!providerFormData.name || !providerFormData.model || !providerFormData.token) {
      toast({
        title: "Erro",
        description: "Nome, modelo e token são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const newProvider: AiProvider = {
      name: providerFormData.name,
      model: providerFormData.model,
      endpoint: providerFormData.endpoint || '',
      token: providerFormData.token
    };

    const updatedProviders = [...providers, newProvider];
    updateProvidersMutation.mutate(updatedProviders);
    setShowAddProviderDialog(false);
    resetProviderForm();
  };

  const handleEditProvider = () => {
    if (!editingProvider || !providerFormData.name || !providerFormData.model || !providerFormData.token) {
      toast({
        title: "Erro",
        description: "Nome, modelo e token são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const updatedProviders = providers.map(provider => 
      provider.name === editingProvider.name 
        ? {
            ...provider,
            name: providerFormData.name,
            model: providerFormData.model,
            endpoint: providerFormData.endpoint,
            token: providerFormData.token
          }
        : provider
    );

    updateProvidersMutation.mutate(updatedProviders);
    setEditingProvider(null);
    resetProviderForm();
  };

  const handleDeleteProvider = () => {
    if (!deletingProvider) return;

    const updatedProviders = providers.filter(provider => provider.name !== deletingProvider.name);
    updateProvidersMutation.mutate(updatedProviders);
    setDeletingProvider(null);
  };

  const handleTestProvider = async (provider: AiProvider) => {
    try {
      await testProviderMutation.mutateAsync(provider);
    } catch (error) {
      // Erro já tratado na mutation
    }
  };

  const openEditProviderDialog = (provider: AiProvider) => {
    setProviderFormData({
      name: provider.name,
      model: provider.model,
      endpoint: provider.endpoint,
      token: provider.token
    });
    setEditingProvider(provider);
  };

  const toggleTokenVisibility = (providerName: string) => {
    setShowToken(prev => ({
      ...prev,
      [providerName]: !prev[providerName]
    }));
  };

  const getDefaultEndpoint = (providerName: string) => {
    const endpoints = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      google: 'https://generativelanguage.googleapis.com'
    };
    return endpoints[providerName as keyof typeof endpoints] || '';
  };

  // Função para decodificar caracteres HTML
  const decodeHtml = (text: string): string => {
    if (!text) return text;
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  };

  const openEditDialog = (config: AiConfiguration) => {
    setEditingConfig(config);
    setFormData({
      name: config.name || '',
      provider: config.provider,
      model: config.model || 'gpt-4o',
      system_prompt: decodeHtml(config.system_prompt || ''),
      user_prompt_template: decodeHtml(config.user_prompt_template || ''),
      department_id: config.department_id || null,
      company_id: config.company_id || null,
      temperature: config.temperature || '0.1',
      max_tokens: config.max_tokens || 100,
      timeout_seconds: config.timeout_seconds || 30,
      max_retries: config.max_retries || 3,
      fallback_priority: config.fallback_priority || 'medium',
      is_active: config.is_active !== undefined ? config.is_active : true,
      is_default: config.is_default !== undefined ? config.is_default : false,
      analysis_type: config.analysis_type || 'priority',
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.provider || !formData.model) {
      toast({
        title: "Erro",
        description: "Nome, provedor e modelo são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleTest = async () => {
    if (!testData.test_title || !testData.test_description) {
      toast({
        title: "Erro",
        description: "Título e descrição do teste são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setIsTestLoading(true);
    try {
      const response = await apiRequest('POST', '/api/ai-configurations/test', {
        test_title: testData.test_title,
        test_description: testData.test_description,
        provider: formData.provider,
        model: formData.model,
        system_prompt: formData.system_prompt,
        user_prompt_template: formData.user_prompt_template,
        temperature: parseFloat(formData.temperature),
        max_tokens: formData.max_tokens,
        timeout_seconds: formData.timeout_seconds,
        max_retries: formData.max_retries,
        fallback_priority: formData.fallback_priority
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
        toast({
          title: "Sucesso",
          description: "Teste executado com sucesso!",
          variant: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao executar teste');
      }
    } catch (error: any) {
      console.error('Erro ao testar configuração:', error);
      toast({
        title: "Erro",
        description: error.message || 'Falha ao executar teste',
        variant: "destructive"
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">


      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="configurations" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Configurações de IA
          </TabsTrigger>
          <TabsTrigger value="providers" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Provedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          {/* Configurações de IA */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Configurações de IA
                  </CardTitle>
                  <CardDescription>
                    Gerencie as configurações de IA por departamento
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {/* Filtro de Empresas para Admin */}
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedCompanyId?.toString() || "all"}
                        onValueChange={(value) => {
                          setSelectedCompanyId(value === "all" ? null : parseInt(value));
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filtrar por empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              🏢 {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={() => setShowForm(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Configuração
                  </Button>
                </div>
              </div>
              
              {/* Abas para tipos de análise */}
              <Tabs value={selectedAnalysisType} onValueChange={(value) => setSelectedAnalysisType(value as 'priority' | 'reopen')} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
                  <TabsTrigger value="priority" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
                    <Target className="mr-2 h-4 w-4" />
                    Análise de Prioridade
                  </TabsTrigger>
                  <TabsTrigger value="reopen" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Análise de Reabertura
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : configurations.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma configuração encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {user?.role === 'admin' && selectedCompanyId 
                      ? 'Nenhuma configuração encontrada para a empresa selecionada'
                      : 'Crie sua primeira configuração de IA para começar'
                    }
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Configuração
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {configurations.map((config) => (
                    <ConfigurationCard
                      key={config.id}
                      config={config}
                      onEdit={openEditDialog}
                      onDelete={(id) => setDeleteConfig(configurations.find(c => c.id === id) || null)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado do Teste */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Resultado do Teste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={testResult.priority === 'critical' ? 'destructive' : 
                                   testResult.priority === 'high' ? 'default' : 
                                   testResult.priority === 'medium' ? 'secondary' : 'outline'}>
                      {testResult.priority.toUpperCase()}
                    </Badge>
                    {testResult.usedFallback && (
                      <Badge variant="outline">Fallback</Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {testResult.processingTimeMs}ms
                    </span>
                  </div>
                  {testResult.justification && (
                    <div>
                      <h4 className="font-medium mb-2">Justificativa:</h4>
                      <p className="text-sm text-muted-foreground">{testResult.justification}</p>
                    </div>
                  )}
                  {testResult.confidence && (
                    <div>
                      <h4 className="font-medium mb-2">Confiança:</h4>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${testResult.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(testResult.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          {/* Provedores de IA */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Provedores Configurados
                  </CardTitle>
                  <CardDescription>
                    Gerencie os provedores de IA disponíveis para as empresas
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddProviderDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Provedor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProviders ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum provedor configurado</h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione provedores de IA para que as empresas possam utilizá-los
                  </p>
                  <Button onClick={() => setShowAddProviderDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Provedor
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider) => (
                    <Card key={provider.name} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{provider.name}</h3>
                            <Badge variant="outline">{provider.model}</Badge>
                            {provider.token && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                Token Configurado
                              </Badge>
                            )}
                          </div>
                          {provider.endpoint && (
                            <p className="text-sm text-muted-foreground">
                              Endpoint: {provider.endpoint}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestProvider(provider)}
                            disabled={testProviderMutation.isPending}
                          >
                            {testProviderMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditProviderDialog(provider)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingProvider(provider)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o provedor "{provider.name}"? 
                                  Esta ação não pode ser desfeita e pode afetar as configurações das empresas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteProvider}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado do Teste de Provedor */}
          {testProviderResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testProviderResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  Resultado do Teste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-4 rounded-lg ${
                  testProviderResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className="font-medium mb-2">{testProviderResult.message}</p>
                  {testProviderResult.error && (
                    <p className="text-sm text-red-600">{testProviderResult.error}</p>
                  )}
                  {testProviderResult.response && (
                    <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                      {JSON.stringify(testProviderResult.response, null, 2)}
                    </pre>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de edição */}
      <Dialog open={editingConfig !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingConfig(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Configuração de IA</DialogTitle>
            <DialogDescription>
              Modifique as configurações do provedor de IA
            </DialogDescription>
          </DialogHeader>
          <ConfigurationForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onTest={handleTest}
            testResult={testResult}
            testData={testData}
            setTestData={setTestData}
            isLoading={isLoading_action}
            isTestLoading={isTestLoading}
            departments={departments}
            availableProviders={availableProviders}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para criar nova configuração */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Configuração de IA</DialogTitle>
            <DialogDescription>
              Configure um novo provedor de IA para análise de tickets
            </DialogDescription>
          </DialogHeader>
          <ConfigurationForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onTest={handleTest}
            testResult={testResult}
            testData={testData}
            setTestData={setTestData}
            isLoading={isLoading_action}
            isTestLoading={isTestLoading}
            departments={departments}
            availableProviders={availableProviders}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para Adicionar/Editar Provedor */}
      <Dialog open={showAddProviderDialog || !!editingProvider} onOpenChange={(open) => {
        if (!open) {
          setShowAddProviderDialog(false);
          setEditingProvider(null);
          resetProviderForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingProvider ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingProvider ? 'Editar Provedor' : 'Adicionar Provedor'}
            </DialogTitle>
            <DialogDescription>
              Configure um novo provedor de IA com suas credenciais e parâmetros
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider-name">Nome do Provedor *</Label>
                <Select
                  value={providerFormData.name}
                  onValueChange={(value) => {
                    setProviderFormData(prev => ({ 
                      ...prev, 
                      name: value,
                      model: modelOptions[value]?.[0] || '',
                      endpoint: getDefaultEndpoint(value)
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="provider-model">Modelo *</Label>
                <Select
                  value={providerFormData.model}
                  onValueChange={(value) => setProviderFormData(prev => ({ ...prev, model: value }))}
                  disabled={!providerFormData.name}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelOptions[providerFormData.name] || []).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="provider-endpoint">Endpoint (Opcional)</Label>
              <Input
                id="provider-endpoint"
                value={providerFormData.endpoint}
                onChange={(e) => setProviderFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder={getDefaultEndpoint(providerFormData.name) || "https://api.exemplo.com"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deixe em branco para usar o endpoint padrão do provedor
              </p>
            </div>
            
            <div>
              <Label htmlFor="provider-token">Token de API *</Label>
              <div className="relative">
                <Input
                  id="provider-token"
                  type={showToken[providerFormData.name] ? "text" : "password"}
                  value={providerFormData.token}
                  onChange={(e) => setProviderFormData(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="sk-... ou chave de API"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => toggleTokenVisibility(providerFormData.name)}
                >
                  {showToken[providerFormData.name] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Token de autenticação para acessar a API do provedor
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddProviderDialog(false);
                setEditingProvider(null);
                resetProviderForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingProvider ? handleEditProvider : handleAddProvider}
              disabled={updateProvidersMutation.isPending}
            >
              {updateProvidersMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingProvider ? 'Salvar Alterações' : 'Adicionar Provedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente do formulário
interface ConfigurationFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: () => void;
  onTest: () => void;
  testResult: TestResult | null;
  testData: TestData;
  setTestData: React.Dispatch<React.SetStateAction<TestData>>;
  isLoading: boolean;
  isTestLoading: boolean;
  isEditing?: boolean;
  departments?: Department[];
  availableProviders?: AiProvider[];
}

function ConfigurationForm({ 
  formData, 
  setFormData, 
  onSubmit, 
  onTest,
  testResult,
  testData,
  setTestData,
  isLoading, 
  isTestLoading,
  isEditing = false,
  departments = [],
  availableProviders = []
}: ConfigurationFormProps) {
  
  // Criar mapeamento de provedores e modelos disponíveis
  const configuredProviders = availableProviders.reduce((acc, provider) => {
    if (!acc[provider.name]) {
      acc[provider.name] = [];
    }
    if (!acc[provider.name].includes(provider.model)) {
      acc[provider.name].push(provider.model);
    }
    return acc;
  }, {} as Record<string, string[]>);
  
  const providerOptions = Object.keys(configuredProviders).map(name => ({
    value: name,
    label: AI_PROVIDERS.find(p => p.value === name)?.label || name
  }));
  return (
    <div className="space-y-4">
      {/* Nome */}
      <div>
        <Label htmlFor="name">Nome da Configuração</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: OpenAI Produção"
        />
      </div>

      {/* Provedor e modelo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="provider">Provedor</Label>
          <Select 
            value={formData.provider} 
            onValueChange={(v) => setFormData(prev => ({ 
              ...prev, 
              provider: v as any,
              model: configuredProviders[v]?.[0] || ''
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um provedor" />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.length > 0 ? (
                providerOptions.map(provider => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  Nenhum provedor configurado
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="model">Modelo</Label>
          <Select 
            value={formData.model} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, model: v }))}
            disabled={!formData.provider || !configuredProviders[formData.provider]}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {configuredProviders[formData.provider]?.length > 0 ? (
                configuredProviders[formData.provider].map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  {formData.provider ? 'Nenhum modelo configurado' : 'Selecione um provedor primeiro'}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prompts */}
      <div>
        <Label htmlFor="system-prompt">Prompt do Sistema</Label>
        <Textarea
          id="system-prompt"
          value={formData.system_prompt}
          onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
          rows={8}
          className="text-sm"
        />
      </div>

      <div>
        <Label htmlFor="user-prompt">Template do Prompt do Usuário</Label>
        <Textarea
          id="user-prompt"
          value={formData.user_prompt_template}
          onChange={(e) => setFormData(prev => ({ ...prev, user_prompt_template: e.target.value }))}
          rows={4}
          className="text-sm"
          placeholder="Use {titulo} e {descricao} como placeholders"
        />
      </div>

      {/* Configurações técnicas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="temperature">Temperatura</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={formData.temperature}
            onChange={(e) => setFormData(prev => ({ ...prev, temperature: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            min="10"
            max="4000"
            value={formData.max_tokens}
            onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 100 }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="timeout">Timeout (segundos)</Label>
          <Input
            id="timeout"
            type="number"
            min="5"
            max="300"
            value={formData.timeout_seconds}
            onChange={(e) => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
          />
        </div>
        
        <div>
          <Label htmlFor="retries">Max Tentativas</Label>
          <Input
            id="retries"
            type="number"
            min="1"
            max="10"
            value={formData.max_retries}
            onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
          />
        </div>
      </div>

      {/* Seleção de Departamento */}
      <div>
        <Label htmlFor="department">Departamento</Label>
        <Select 
          value={formData.department_id?.toString() || 'global'} 
          onValueChange={(v) => setFormData(prev => ({ 
            ...prev, 
            department_id: v === 'global' ? null : parseInt(v) 
          }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">🌐 Configuração Global (Todos os Departamentos)</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id.toString()}>
                🏢 {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Configurações específicas de departamento têm prioridade sobre configurações globais
        </p>
      </div>

      {/* Prioridade de fallback */}
      <div>
        <Label htmlFor="fallback">Prioridade de Fallback</Label>
        <Select 
          value={formData.fallback_priority} 
          onValueChange={(v) => setFormData(prev => ({ ...prev, fallback_priority: v as any }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Switches */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="is-active">Configuração Ativa</Label>
          <p className="text-sm text-gray-500">Se deve ser usada para análise de tickets</p>
        </div>
        <Switch
          id="is-active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="is-default">Configuração Padrão</Label>
          <p className="text-sm text-gray-500">Se deve ser a configuração principal</p>
        </div>
        <Switch
          id="is-default"
          checked={formData.is_default}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
        />
      </div>

      {/* Seção de teste */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Testar Configuração</h4>
        <div className="space-y-3">
          <div>
            <Label htmlFor="test-title">Título do Teste</Label>
            <Input
              id="test-title"
              value={testData.test_title}
              onChange={(e) => setTestData(prev => ({ ...prev, test_title: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="test-description">Descrição do Teste</Label>
            <Textarea
              id="test-description"
              value={testData.test_description}
              onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
              rows={3}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={isTestLoading}
          >
            {isTestLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Testar
              </>
            )}
          </Button>
          
          {testResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium mb-2">Resultado do Teste:</h5>
              <div className="text-sm space-y-2">
                                      <div><strong>Prioridade:</strong> {testResult.priority}</div>
                {testResult.justification && (
                  <div>
                    <strong>Justificativa:</strong>
                    <div className="mt-1 p-2 bg-white border rounded text-gray-700">
                      {testResult.justification}
                    </div>
                  </div>
                )}
                <div><strong>Tempo:</strong> {testResult.processingTimeMs}ms</div>
                <div><strong>Fallback:</strong> {testResult.usedFallback ? 'Sim' : 'Não'}</div>
                {testResult.confidence && (
                  <div><strong>Confiança:</strong> {(testResult.confidence * 100).toFixed(1)}%</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Fechar dialog
          }}
        >
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Salvando...' : 'Criando...'}
            </>
          ) : (
            isEditing ? 'Salvar' : 'Criar'
          )}
        </Button>
      </div>
    </div>
  );
}

// Componente do card de configuração
function ConfigurationCard({ 
  config, 
  onEdit, 
  onDelete
}: { 
  config: AiConfiguration; 
  onEdit: (config: AiConfiguration) => void; 
  onDelete: (id: number) => void; 
}) {
  return (
    <Card className={`relative ${config.is_default ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <CardDescription>
                {AI_PROVIDERS.find(p => p.value === config.provider)?.label} - {config.model}
                {config.department_name && (
                  <span className="ml-2 text-blue-600">• {config.department_name}</span>
                )}
                {!config.department_name && (
                  <span className="ml-2 text-gray-600">• Global</span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.is_default && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Padrão
              </span>
            )}
            <div className={`
              w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-400'}
            `} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Temperatura:</span> {config.temperature}
          </div>
          <div>
            <span className="font-medium">Max Tokens:</span> {config.max_tokens}
          </div>
          <div>
            <span className="font-medium">Timeout:</span> {config.timeout_seconds}s
          </div>
          <div>
            <span className="font-medium">Fallback:</span> {config.fallback_priority}
          </div>
          <div>
            <span className="font-medium">Criado em:</span> {new Date(config.created_at).toLocaleDateString()}
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(config)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(config.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}