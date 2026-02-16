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
  CheckCircle,
  AlertTriangle,
  Key,
  Edit3,
  Target,
  RotateCcw,
  Search
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { config } from '@/lib/config';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

// AI_PROVIDERS removido - agora usa dados dinâmicos do banco

// DEFAULT_MODELS removido - agora usa dados dinâmicos do banco

const DEFAULT_PROMPTS = {
  pt: {
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
      system: `Você é um assistente especializado em análise de respostas de clientes para tickets em status wait_customer. Sua única função é determinar se a resposta do cliente indica que:

1. O problema foi RESOLVIDO (manter status wait_customer)
2. O problema ainda PERSISTE (reabrir ticket para status ongoing)

Analise APENAS o conteúdo da mensagem do cliente.

Indicadores de problema RESOLVIDO:
- Cliente confirma que o problema foi solucionado
- Cliente agradece pela solução
- Cliente indica que tudo está funcionando
- Cliente confirma que pode fechar o ticket
- Mensagens de satisfação ou confirmação positiva

Indicadores de problema PERSISTENTE:
- Cliente relata que o problema continua
- Cliente descreve novos sintomas relacionados
- Cliente solicita mais ajuda
- Cliente indica que a solução não funcionou
- Cliente faz novas perguntas sobre o mesmo problema

IMPORTANTE: Responda EXATAMENTE no formato:
<ACAO>manter_aguardando|reabrir</ACAO>
<JUSTIFICATIVA>explicação baseada na análise da resposta do cliente</JUSTIFICATIVA>`,
      user: `Resposta do Cliente:
{mensagem_cliente}

Analise se esta resposta indica que o problema foi resolvido ou ainda persiste. Responda no formato:
<ACAO>acao</ACAO>
<JUSTIFICATIVA>justificativa</JUSTIFICATIVA>`
    }
  },
  en: {
    priority: {
      system: `You are a specialized assistant for technical support ticket priority analysis. Analyze the ticket title and description and determine the appropriate priority based on the following criteria:

CRITICAL: Systems completely down, critical security failures, data loss, problems affecting multiple users immediately and preventing essential operations.

HIGH: Main functionalities not working, problems preventing specific users from working, upcoming deadlines being impacted, failures significantly affecting productivity.

MEDIUM: Problems that cause inconvenience but have alternative solutions, secondary functionalities not working, important but not urgent improvement requests.

LOW: Simple questions, training requests, aesthetic improvements, personal settings, problems that don't prevent work.

IMPORTANT: Respond EXACTLY in the format:
<PRIORITY>priority_name</PRIORITY>
<JUSTIFICATION>detailed explanation of the analysis based on the ticket content</JUSTIFICATION>

Use only: critical, high, medium or low (always lowercase and in English).`,
      user: `Title: {title}

Description: {description}

Analyze this ticket and determine its priority. Respond in the format:
<PRIORITY>priority</PRIORITY>
<JUSTIFICATION>justification</JUSTIFICATION>`
    },
    reopen: {
      system: `You are a specialized assistant for analyzing customer responses to tickets in wait_customer status. Your only function is to determine if the customer's response indicates that:

1. The problem was RESOLVED (maintain wait_customer status)
2. The problem still PERSISTS (reopen ticket to ongoing status)

Analyze ONLY the customer's message content.

Indicators of RESOLVED problem:
- Customer confirms the problem was solved
- Customer thanks for the solution
- Customer indicates everything is working
- Customer confirms they can close the ticket
- Messages of satisfaction or positive confirmation

Indicators of PERSISTENT problem:
- Customer reports the problem continues
- Customer describes new related symptoms
- Customer requests more help
- Customer indicates the solution didn't work
- Customer asks new questions about the same problem

IMPORTANT: Respond EXACTLY in the format:
<ACTION>keep_waiting|reopen</ACTION>
<JUSTIFICATION>explanation based on the analysis of the customer's response</JUSTIFICATION>`,
      user: `Customer Response:
{customer_message}

Analyze if this response indicates that the problem was resolved or still persists. Respond in the format:
<ACTION>action</ACTION>
<JUSTIFICATION>justification</JUSTIFICATION>`
    }
  }
};

// Modelos disponíveis atualizados em Dezembro 2024
// OpenAI: GPT-4o (mais recente), GPT-4o-mini (mais eficiente), GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
// Google: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro  
// Função para obter prompts padrão baseados no idioma
const getDefaultPrompts = (analysisType: 'priority' | 'reopen', locale: string) => {
  const lang = locale === 'en-US' ? 'en' : 'pt';
  return DEFAULT_PROMPTS[lang][analysisType];
};

// Dados de teste padrão por idioma
const DEFAULT_TEST_DATA = {
  pt: {
    test_title: "Sistema de email não está funcionando",
    test_description: "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
  },
  en: {
    test_title: "Email system is not working",
    test_description: "I can't send or receive emails since this morning. This is affecting all team work."
  }
};

// Função para obter dados de teste padrão baseados no idioma
const getDefaultTestData = (locale: string) => {
  const lang = locale === 'en-US' ? 'en' : 'pt';
  return DEFAULT_TEST_DATA[lang];
};

// Função para obter modelos disponíveis baseado nos provedores configurados no banco
const getAvailableModels = (providerName: string, availableProviders: AiProvider[]): string[] => {
  const provider = availableProviders.find(p => p.name === providerName);
  return provider ? [provider.model] : [];
};

// Função para obter provedores disponíveis como opções de select
const getAvailableProviderOptions = (availableProviders: AiProvider[]) => {
  return availableProviders.map(provider => ({
    key: provider.name,
    name: provider.name
  }));
};

interface AiUsageToggleProps {
  usageSettings?: AiUsageSettings;
  isLoading: boolean;
  refetch: () => void;
}

// Componente para company_admin gerenciar o toggle de uso de IA
function AiUsageToggle({ usageSettings, isLoading, refetch }: AiUsageToggleProps) {
  const { toast } = useToast();
  const { formatMessage } = useI18n();

  // Mutação para atualizar configurações de uso
  const updateUsageMutation = useMutation({
    mutationFn: async (ai_usage_enabled: boolean) => {
      const response = await apiRequest("PUT", "/api/settings/ai-usage", { ai_usage_enabled });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || formatMessage('ai.error_updating_settings'));
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('ai.success'),
        description: formatMessage('ai.settings_updated_successfully'),
      });
      refetch(); // Chama a função refetch passada por props
    },
    onError: (error: any) => {
      toast({
        title: formatMessage('ai.ai_error'),
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
            {formatMessage('ai.artificial_intelligence')}
          </CardTitle>
          <CardDescription>
            {formatMessage('ai.ai_settings_for_company')}
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
          {formatMessage('ai.artificial_intelligence')}
        </CardTitle>
        <CardDescription>
          {formatMessage('ai.configure_ai_usage')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Toggle de uso de IA */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="ai-usage-toggle" className="text-base font-medium">
                {formatMessage('ai.use_artificial_intelligence')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formatMessage('ai.activates_automatic_analysis')}
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
                  <h4 className="font-medium text-blue-900">{formatMessage('ai.ai_activated')}</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {formatMessage('ai.ai_analyzing_automatically')}
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
  const { formatMessage } = useI18n();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>{formatMessage('ai.loading')}</span>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">{formatMessage('ai.unauthorized_access')}</p>
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
          <p className="text-muted-foreground">{formatMessage('ai.unauthorized_access')}</p>
        </CardContent>
      </Card>
    );
  }
}

// Componente para company_admin, manager, supervisor - toggle + configuração por departamento
function CompanyAiConfiguration() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { formatMessage } = useI18n();

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
      
      // Usar fetch diretamente para evitar que apiRequest trate 403 como sessão expirada
      // neste caso específico, pois 403 pode significar "empresa sem permissão de IA"
      const url = `/api/settings/ai-usage`.startsWith('http') 
        ? `/api/settings/ai-usage` 
        : `${config.apiBaseUrl}/api/settings/ai-usage`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          // Tratar 403 como "empresa sem permissão de IA" (não como sessão expirada)
          if (response.status === 403) {
            const data = await response.json();
            // Verificar se é um erro de permissão de IA ou sessão expirada
            if (data.message && data.message.includes('Empresa não tem permissão para usar IA')) {
              // É um erro de permissão de IA, não de sessão expirada
              return { 
                ai_permission_granted: false, 
                ai_usage_enabled: false,
                message: data.message 
              };
            }
            // Se for outro tipo de 403, pode ser sessão expirada
            console.warn('403 Forbidden ao buscar configurações de IA:', data.message);
            return { ai_permission_granted: false, ai_usage_enabled: false };
          }
          
          // Para 401, retornar sem permissão mas não fazer logoff
          if (response.status === 401) {
            console.warn('Usuário não autenticado ao buscar configurações de IA');
            return { ai_permission_granted: false, ai_usage_enabled: false };
          }
          
          const errorData = await response.json();
          throw new Error(errorData.message || 'Falha ao buscar configurações de IA');
        }
        
        return response.json();
      } catch (error: any) {
        // Se for um erro de rede ou outro tipo, não fazer logoff
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
            {formatMessage('ai.ai_configurations')}
          </CardTitle>
          <CardDescription>
            {formatMessage('ai.intelligent_priority_analysis')}
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
  const { user: _user } = useAuth();
  const { formatMessage } = useI18n();

  // Este componente agora só é renderizado quando há permissão
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          {formatMessage('ai.ai_configurations_by_department')}
        </CardTitle>
        <CardDescription>
          {formatMessage('ai.configure_specific_prompts')}
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
  const { formatMessage, locale } = useI18n();

  // Estados
  const [configurations, setConfigurations] = useState<AiConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfiguration | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState({
    test_title: "",
    test_description: ""
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
  const { data: departmentsData } = useQuery<{departments: Department[]}>({    queryKey: ["/api/departments", { active_only: true }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/departments?active_only=true');
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

  // Sincronizar formData.analysis_type com selectedAnalysisType
  useEffect(() => {
    setFormData(prev => ({ ...prev, analysis_type: selectedAnalysisType }));
  }, [selectedAnalysisType]);

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

  const openNewConfigDialog = () => {
    const defaultTestData = getDefaultTestData(locale);
    resetForm();
    setFormData(prev => ({
      ...prev,
      analysis_type: selectedAnalysisType,
      system_prompt: getDefaultPrompts(selectedAnalysisType, locale).system,
      user_prompt_template: getDefaultPrompts(selectedAnalysisType, locale).user
    }));
    setTestData({
      test_title: defaultTestData.test_title,
      test_description: defaultTestData.test_description
    });
    setShowForm(true);
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.provider_created'),
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.provider_updated'),
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
        analysis_type: formData.analysis_type,
        test_title: testData.test_title || getDefaultTestData(locale).test_title,
        test_description: testData.test_description || getDefaultTestData(locale).test_description
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
          title: formatMessage('ai.success'),
          description: formatMessage('ai.test_executed_successfully')
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
            {formatMessage('ai.priority_analysis')}
          </TabsTrigger>
          <TabsTrigger value="reopen" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <RotateCcw className="mr-2 h-4 w-4" />
            {formatMessage('ai.reopen_analysis')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Botão para adicionar nova configuração */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={openNewConfigDialog}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          {formatMessage('ai.new_configuration')}
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
              {editingConfig ? formatMessage('common.edit') : formatMessage('common.new')} {formatMessage('ai.ai_configuration')} - {formData.analysis_type === 'priority' ? formatMessage('ai.priority_analysis') : formatMessage('ai.reopen_analysis')}
            </DialogTitle>
            <DialogDescription>
              {formatMessage('ai.configure_specific_prompts_for')} {formData.analysis_type === 'priority' ? formatMessage('ai.priority').toLowerCase() : formatMessage('ai.reopen').toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-4 pb-6">
            {/* Nome, Departamento e Tipo de Análise */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name">{formatMessage('ai.configuration_name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={formatMessage('ai.configuration_name_placeholder')}
                />
              </div>
              <div>
                <Label htmlFor="department">{formatMessage('ai.department')} *</Label>
                <Select 
                  value={formData.department_id?.toString() || ''} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    department_id: v ? parseInt(v) : null 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('ai.select_department')} />
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
                <Label htmlFor="analysis_type">{formatMessage('ai.analysis_type')} *</Label>
                <Select 
                  value={formData.analysis_type} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    analysis_type: v as 'priority' | 'reopen'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">{formatMessage('ai.priority_analysis')}</SelectItem>
                    <SelectItem value="reopen">{formatMessage('ai.reopen_analysis')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provedor e Modelo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">{formatMessage('ai.provider')}</Label>
                <Select 
                  value={formData.provider} 
                  onValueChange={(v) => {
                    const availableModels = getAvailableModels(v, availableProviders);
                    setFormData(prev => ({ 
                      ...prev, 
                      provider: v as any,
                      model: availableModels[0] || '' // Reset model when provider changes
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('ai.select_provider')} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableProviderOptions(availableProviders).map((provider) => (
                      <SelectItem key={provider.key} value={provider.key}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model">{formatMessage('ai.model')}</Label>
                <Select 
                  value={formData.model} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, model: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('ai.select_model')} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels(formData.provider, availableProviders).map((model) => (
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
                  <Label htmlFor="system_prompt">{formatMessage('ai.system_prompt')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      system_prompt: getDefaultPrompts(formData.analysis_type, locale).system
                    }))}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    {formatMessage('ai.use_default')}
                  </Button>
                </div>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder={formatMessage('ai.system_prompt_placeholder')}
                  rows={4}
                />
              </div>

              {/* User Prompt Template */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="user_prompt_template">{formatMessage('ai.user_prompt_template')}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      user_prompt_template: getDefaultPrompts(formData.analysis_type, locale).user
                    }))}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    {formatMessage('ai.use_default')}
                  </Button>
                </div>
                <Textarea
                  id="user_prompt_template"
                  value={formData.user_prompt_template}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_prompt_template: e.target.value }))}
                  placeholder={formData.analysis_type === 'priority' 
                    ? formatMessage('ai.user_prompt_placeholder_priority')
                    : formatMessage('ai.user_prompt_placeholder_reopen')}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.analysis_type === 'priority' ? (
                    formatMessage('ai.use_variables_priority')
                  ) : (
                    formatMessage('ai.use_variables_reopen')
                  )}
                </p>
              </div>
            </div>

            {/* Configurações Técnicas */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="temperature">{formatMessage('ai.temperature')}</Label>
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
                <Label htmlFor="timeout_seconds">{formatMessage('ai.timeout_seconds')}</Label>
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
                <Label htmlFor="max_retries">{formatMessage('ai.max_attempts')}</Label>
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
            <div className={`grid gap-4 items-end ${formData.analysis_type === 'reopen' ? 'grid-cols-2' : (formData.analysis_type === 'priority' && formData.department_id ? 'grid-cols-3' : 'grid-cols-2')}`}>
              {formData.analysis_type === 'priority' && formData.department_id && (
                <div>
                  <Label htmlFor="fallback_priority">{formatMessage('ai.fallback_priority')}</Label>
                  <Select 
                    value={formData.fallback_priority} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, fallback_priority: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{formatMessage('ai.low')}</SelectItem>
                      <SelectItem value="medium">{formatMessage('ai.medium')}</SelectItem>
                      <SelectItem value="high">{formatMessage('ai.high')}</SelectItem>
                      <SelectItem value="critical">{formatMessage('ai.critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">{formatMessage('ai.active')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                />
                <Label htmlFor="is_default">{formatMessage('ai.default_for_department')}</Label>
              </div>
            </div>

            {/* Seção de teste */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">{formatMessage('ai.test_configuration')} - {formData.analysis_type === 'priority' ? formatMessage('ai.priority_analysis') : formatMessage('ai.reopen_analysis')}</h4>
              <div className="space-y-3">
                {formData.analysis_type === 'priority' ? (
                  <>
                    <div>
                      <Label htmlFor="test-title">{formatMessage('ai.test_title')}</Label>
                      <Input
                        id="test-title"
                        value={testData.test_title}
                        onChange={(e) => setTestData(prev => ({ ...prev, test_title: e.target.value }))}
                        placeholder={formatMessage('ai.test_title_placeholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="test-description">{formatMessage('ai.test_description')}</Label>
                      <Textarea
                        id="test-description"
                        value={testData.test_description}
                        onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
                        placeholder={formatMessage('ai.test_description_placeholder')}
                        rows={3}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label htmlFor="test-client-message">{formatMessage('ai.test_description')}</Label>
                    <Textarea
                      id="test-client-message"
                      value={testData.test_description}
                      onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
                      placeholder={formatMessage('ai.test_description_placeholder')}
                      rows={4}
                    />
                  </div>
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
                      {formatMessage('ai.testing')}
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      {formatMessage('ai.test_button')}
                    </>
                  )}
                </Button>
                
                {testResult && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <h5 className="font-medium mb-2">{formatMessage('ai.test_result')}</h5>
                    <div className="text-sm space-y-2">
                      <div><strong>{formData.analysis_type === 'reopen' ? formatMessage('ai.action') : formatMessage('ai.priority_label')}</strong> {testResult.priority}</div>
                      {testResult.justification && (
                        <div>
                          <strong>{formatMessage('ai.justification')}</strong>
                          <div className="mt-1 p-2 bg-white border rounded text-gray-700">
                            {testResult.justification}
                          </div>
                        </div>
                      )}
                      <div><strong>Tempo:</strong> {testResult.processingTimeMs}ms</div>
                      <div><strong>{formatMessage('ai.fallback')}:</strong> {testResult.usedFallback ? formatMessage('ai.yes') : formatMessage('ai.no')}</div>
                      {testResult.confidence && (
                        <div><strong>{formatMessage('ai.confidence')}</strong> {(testResult.confidence * 100).toFixed(1)}%</div>
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
              {formatMessage('ai.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingConfig ? formatMessage('common.save') : formatMessage('ai.create')}
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
  const { formatMessage, locale } = useI18n();

  // Estados
  const [configurations, setConfigurations] = useState<AiConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfiguration | null>(null);
  const [_deleteConfig, setDeleteConfig] = useState<AiConfiguration | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState({
    test_title: "",
    test_description: ""
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
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchTerm, setModelSearchTerm] = useState('');
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

  // Sincronizar formData.analysis_type com selectedAnalysisType
  useEffect(() => {
    setFormData(prev => ({ ...prev, analysis_type: selectedAnalysisType }));
  }, [selectedAnalysisType]);

  // Carregar dados na montagem do componente
  useEffect(() => {
    fetchConfigurations(selectedAnalysisType);
    fetchProviders();
    fetchAvailableProviders();
  }, [selectedCompanyId, selectedAnalysisType]); // Recarregar quando empresa selecionada ou tipo de análise mudar

  // Sincronizar formData.analysis_type com selectedAnalysisType
  useEffect(() => {
    setFormData(prev => ({ ...prev, analysis_type: selectedAnalysisType }));
  }, [selectedAnalysisType]);

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

  const openNewConfigDialog = () => {
    const defaultTestData = getDefaultTestData(locale);
    resetForm();
    setFormData(prev => ({
      ...prev,
      analysis_type: selectedAnalysisType,
      system_prompt: getDefaultPrompts(selectedAnalysisType, locale).system,
      user_prompt_template: getDefaultPrompts(selectedAnalysisType, locale).user
    }));
    setTestData({
      test_title: defaultTestData.test_title,
      test_description: defaultTestData.test_description
    });
    setShowForm(true);
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.provider_created'),
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.provider_updated'),
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

  const _deleteMutation = useMutation({
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.configuration_deleted'),
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.providers_updated'),
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
        title: formatMessage('ai.success'),
        description: formatMessage('ai.provider_tested'),
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
    setAvailableModels([]);
    setModelSearchTerm('');
  };

  // Buscar modelos disponíveis de um provedor dinamicamente
  const fetchProviderModels = async (providerName: string, endpoint?: string, token?: string) => {
    if (!providerName) {
      setAvailableModels([]);
      return;
    }

    // Se for OpenAI e tiver token, buscar da API
    if (providerName === 'openai' && token && token.trim().length > 0) {
      setIsLoadingModels(true);
      try {
        const params = new URLSearchParams();
        const finalEndpoint = endpoint || getDefaultEndpoint(providerName);
        if (finalEndpoint) params.append('endpoint', finalEndpoint);
        if (token) params.append('token', token);
        
        const response = await apiRequest('GET', `/api/ai-configurations/models/${providerName}?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const apiModels = (data.models || []).filter((m: string) => m && m.trim().length > 0);
          // Se a API retornar modelos, usar eles, senão usar hardcoded
          if (apiModels.length > 0) {
            setAvailableModels(apiModels);
          } else {
            // Se não retornou modelos, usar lista hardcoded como fallback
            const hardcodedProvider = HARDCODED_AI_PROVIDERS.find(p => p.key === providerName);
            setAvailableModels(hardcodedProvider?.models?.filter(m => m && m.trim().length > 0) || []);
          }
        } else {
          // Se falhar, usar lista hardcoded como fallback
          const hardcodedProvider = HARDCODED_AI_PROVIDERS.find(p => p.key === providerName);
          setAvailableModels(hardcodedProvider?.models?.filter(m => m && m.trim().length > 0) || []);
        }
      } catch (error) {
        console.error('Erro ao buscar modelos:', error);
        // Em caso de erro, usar lista hardcoded como fallback
        const hardcodedProvider = HARDCODED_AI_PROVIDERS.find(p => p.key === providerName);
        setAvailableModels(hardcodedProvider?.models || []);
      } finally {
        setIsLoadingModels(false);
      }
    } else {
      // Para outros provedores ou quando não há token, usar lista hardcoded
      const hardcodedProvider = HARDCODED_AI_PROVIDERS.find(p => p.key === providerName);
      setAvailableModels(hardcodedProvider?.models?.filter(m => m && m.trim().length > 0) || []);
    }
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
    } catch (_error) {
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
    // Buscar modelos quando abrir o dialog de edição
    fetchProviderModels(provider.name, provider.endpoint, provider.token);
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
    // Validação baseada no tipo de análise
    if (formData.analysis_type === 'priority') {
      if (!testData.test_title || !testData.test_description) {
        toast({
          title: "Erro",
          description: "Título e descrição do teste são obrigatórios",
          variant: "destructive"
        });
        return;
      }
    } else {
      if (!testData.test_description) {
        toast({
          title: "Erro",
          description: "Mensagem do cliente é obrigatória",
          variant: "destructive"
        });
        return;
      }
    }

    setIsTestLoading(true);
    try {
      const testPayload = {
        provider: formData.provider,
        model: formData.model,
        system_prompt: formData.system_prompt,
        user_prompt_template: formData.user_prompt_template,
        temperature: parseFloat(formData.temperature),
        max_tokens: formData.max_tokens,
        timeout_seconds: formData.timeout_seconds,
        max_retries: formData.max_retries,
        analysis_type: formData.analysis_type,
        ...(formData.analysis_type === 'priority' ? {
          test_title: testData.test_title,
          test_description: testData.test_description,
          fallback_priority: formData.fallback_priority
        } : {
          test_description: testData.test_description // Para reabertura, apenas a mensagem do cliente
        })
      };

      const response = await apiRequest('POST', '/api/ai-configurations/test', testPayload);

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
        toast({
          title: formatMessage('ai.success'),
          description: formatMessage('ai.test_executed_successfully'),
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

  useEffect(() => {
    if (selectedAnalysisType === 'priority') {
      setTestData({
        test_title: 'Sistema de email não está funcionando',
        test_description: 'Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe.'
      });
    } else if (selectedAnalysisType === 'reopen') {
      setTestData({
        test_title: 'Solicitação de reabertura',
        test_description: 'Solicito a reabertura deste chamado, pois o problema voltou a ocorrer e ainda não foi resolvido.'
      });
    }
  }, [selectedAnalysisType]);

  // Lista hardcoded exclusiva para o modal de admin (OpenAI)
  const HARDCODED_AI_PROVIDERS = [
    {
      key: 'openai',
      name: 'OpenAI',
      models: [
        "gpt-4-0613",
        "gpt-4",
        "gpt-3.5-turbo",
        "o4-mini-deep-research-2025-06-26",
        "codex-mini-latest",
        "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4o-audio-preview-2025-06-03",
        "o4-mini-deep-research",
        "davinci-002",
        "babbage-002",
        "gpt-3.5-turbo-instruct",
        "gpt-3.5-turbo-instruct-0914",
        "dall-e-3",
        "dall-e-2",
        "gpt-4-1106-preview",
        "gpt-3.5-turbo-1106",
        "tts-1-hd",
        "tts-1-1106",
        "tts-1-hd-1106",
        "text-embedding-3-small",
        "text-embedding-3-large",
        "gpt-4-0125-preview",
        "gpt-4-turbo-preview",
        "gpt-3.5-turbo-0125",
        "gpt-4-turbo",
        "gpt-4-turbo-2024-04-09",
        "gpt-4o",
        "gpt-4o-2024-05-13",
        "gpt-4o-mini-2024-07-18",
        "gpt-4o-mini",
        "gpt-4o-2024-08-06",
        "chatgpt-4o-latest",
        "o1-preview-2024-09-12",
        "o1-preview",
        "o1-mini-2024-09-12",
        "o1-mini",
        "gpt-4o-realtime-preview-2024-10-01",
        "gpt-4o-audio-preview-2024-10-01",
        "gpt-4o-audio-preview",
        "gpt-4o-realtime-preview",
        "omni-moderation-latest",
        "omni-moderation-2024-09-26",
        "gpt-4o-realtime-preview-2024-12-17",
        "gpt-4o-audio-preview-2024-12-17",
        "gpt-4o-mini-realtime-preview-2024-12-17",
        "gpt-4o-mini-audio-preview-2024-12-17",
        "o1-2024-12-17",
        "o1",
        "gpt-4o-mini-realtime-preview",
        "gpt-4o-mini-audio-preview",
        "o3-mini",
        "o3-mini-2025-01-31",
        "gpt-4o-2024-11-20",
        "gpt-4o-search-preview-2025-03-11",
        "gpt-4o-search-preview",
        "gpt-4o-mini-search-preview-2025-03-11",
        "gpt-4o-mini-search-preview",
        "gpt-4o-transcribe",
        "gpt-4o-mini-transcribe",
        "o1-pro-2025-03-19",
        "o1-pro",
        "gpt-4o-mini-tts",
        "o4-mini-2025-04-16",
        "o4-mini",
        "gpt-4.1-2025-04-14",
        "gpt-4.1",
        "gpt-4.1-mini-2025-04-14",
        "gpt-4.1-mini",
        "gpt-4.1-nano-2025-04-14",
        "gpt-4.1-nano",
        "gpt-image-1",
        "gpt-3.5-turbo-16k",
        "tts-1",
        "whisper-1",
        "text-embedding-ada-002"
      ]
    },
    {
      key: 'google',
      name: 'Google Gemini',
      models: [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash-preview-native-audio-dialog",
        "gemini-2.5-flash-exp-native-audio-thinking-dialog",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
        "gemini-2.0-flash",
        "gemini-2.0-flash-preview-image-generation",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-embedding-001",
        "imagen-4.0-generate-preview-06-06",
        "imagen-4.0-ultra-generate-preview-06-06",
        "imagen-3.0-generate-002",
        "veo-3.0-generate-preview",
        "veo-2.0-generate-001",
        "gemini-live-2.5-flash-preview",
        "gemini-2.0-flash-live-001"
      ]
    },
    {
      key: 'anthropic',
      name: 'Anthropic Claude',
      models: [
        "claude-3.5-sonnet",
        "claude-3.5-haiku",
        "claude-3.7-sonnet",
        "claude-3.7-haiku",
        "claude-4-opus",
        "claude-4-sonnet",
        "claude-4-haiku"
      ]
    }
  ];

  return (
    <div className="space-y-6">


      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="configurations" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            {formatMessage('ai.ai_configurations')}
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
                    {formatMessage('ai.ai_configurations')}
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
                  <Button onClick={openNewConfigDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {formatMessage('ai.new_configuration')}
                  </Button>
                </div>
              </div>
              
              {/* Abas para tipos de análise */}
              <Tabs value={selectedAnalysisType} onValueChange={(value) => setSelectedAnalysisType(value as 'priority' | 'reopen')} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
                  <TabsTrigger value="priority" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
                    <Target className="mr-2 h-4 w-4" />
                    {formatMessage('ai.priority_analysis')}
                  </TabsTrigger>
                  <TabsTrigger value="reopen" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {formatMessage('ai.reopen_analysis')}
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
                  <Button onClick={openNewConfigDialog}>
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
                    <Badge variant={
                      selectedAnalysisType === 'reopen' 
                        ? (testResult.priority?.toLowerCase().includes('persist') ? 'destructive' : 'secondary')
                        : (testResult.priority === 'critical' ? 'destructive' : 
                           testResult.priority === 'high' ? 'default' : 
                           testResult.priority === 'medium' ? 'secondary' : 'outline')
                    }>
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
                      <h4 className="font-medium mb-2">{formatMessage('ai.justification')}</h4>
                      <p className="text-sm text-muted-foreground">{testResult.justification}</p>
                    </div>
                  )}
                  {testResult.confidence && (
                    <div>
                      <h4 className="font-medium mb-2">{formatMessage('ai.confidence')}</h4>
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
            <DialogTitle>{formatMessage('ai.new_ai_configuration')}</DialogTitle>
            <DialogDescription>
              {formatMessage('ai.new_ai_configuration_description')}
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
          setModelSearchTerm('');
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
                    const endpoint = getDefaultEndpoint(value);
                    setProviderFormData(prev => ({ 
                      ...prev, 
                      name: value,
                      model: '',
                      endpoint: endpoint
                    }));
                    setModelSearchTerm('');
                    // Buscar modelos quando o provedor for selecionado
                    fetchProviderModels(value, endpoint, providerFormData.token);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(providers.length > 0
                      ? getAvailableProviderOptions(providers)
                      : HARDCODED_AI_PROVIDERS.map(p => ({ key: p.key, name: p.name }))
                    ).map(provider => (
                      <SelectItem key={provider.key} value={provider.key}>
                        {provider.name}
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
                  disabled={!providerFormData.name || isLoadingModels || availableModels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingModels ? "Carregando modelos..." : availableModels.length === 0 ? "Nenhum modelo disponível" : "Selecione um modelo"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {/* Campo de busca */}
                    {!isLoadingModels && availableModels.length > 0 && (
                      <div className="sticky top-0 z-10 bg-popover border-b px-2 py-1.5">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar modelo..."
                            value={modelSearchTerm}
                            onChange={(e) => {
                              e.stopPropagation();
                              setModelSearchTerm(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                    <div className="overflow-y-auto max-h-[250px]">
                      {isLoadingModels ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Carregando modelos...
                        </div>
                      ) : availableModels.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {providerFormData.name === 'openai' && !providerFormData.token 
                            ? "Preencha o token para ver os modelos disponíveis"
                            : "Nenhum modelo disponível"}
                        </div>
                      ) : (() => {
                        const filteredModels = availableModels
                          .filter(model => model && model.trim().length > 0)
                          .filter(model => 
                            modelSearchTerm === '' || 
                            model.toLowerCase().includes(modelSearchTerm.toLowerCase())
                          );
                        
                        return filteredModels.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Nenhum modelo encontrado para "{modelSearchTerm}"
                          </div>
                        ) : (
                          filteredModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))
                        );
                      })()}
                    </div>
                  </SelectContent>
                </Select>
                {providerFormData.name === 'openai' && !providerFormData.token && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Preencha o token para ver os modelos disponíveis da API
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="provider-endpoint">Endpoint (Opcional)</Label>
              <Input
                id="provider-endpoint"
                value={providerFormData.endpoint}
                onChange={(e) => {
                  setProviderFormData(prev => ({ ...prev, endpoint: e.target.value }));
                  // Se for OpenAI e tiver token, buscar modelos novamente quando endpoint mudar
                  if (providerFormData.name === 'openai' && providerFormData.token) {
                    fetchProviderModels(providerFormData.name, e.target.value, providerFormData.token);
                  }
                }}
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
                  onChange={(e) => {
                    setProviderFormData(prev => ({ ...prev, token: e.target.value }));
                    // Se for OpenAI e já tiver nome do provedor, buscar modelos quando token for preenchido
                    if (providerFormData.name === 'openai' && e.target.value) {
                      fetchProviderModels(providerFormData.name, providerFormData.endpoint, e.target.value);
                    }
                  }}
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
  const { formatMessage } = useI18n();
  
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
    label: name
  }));
  return (
    <div className="space-y-4">
      {/* Nome */}
      <div>
        <Label htmlFor="name">{formatMessage('ai.configuration_name')}</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={formatMessage('ai.configuration_name_placeholder')}
        />
      </div>

      {/* Provedor e modelo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="provider">{formatMessage('ai.provider')}</Label>
          <Select 
            value={formData.provider} 
            onValueChange={(v) => setFormData(prev => ({ 
              ...prev, 
              provider: v as any,
              model: configuredProviders[v]?.[0] || ''
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={formatMessage('ai.select_provider')} />
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
                  {formatMessage('ai.no_provider_configured')}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="model">{formatMessage('ai.model')}</Label>
          <Select 
            value={formData.model} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, model: v }))}
            disabled={!formData.provider || !configuredProviders[formData.provider]}
          >
            <SelectTrigger>
              <SelectValue placeholder={formatMessage('ai.select_model')} />
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
                  {formData.provider ? formatMessage('ai.no_model_configured') : formatMessage('ai.select_provider_first')}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prompts */}
      <div>
        <Label htmlFor="system-prompt">{formatMessage('ai.system_prompt')}</Label>
        <Textarea
          id="system-prompt"
          value={formData.system_prompt}
          onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
          rows={8}
          className="text-sm"
        />
      </div>

      <div>
        <Label htmlFor="user-prompt">{formatMessage('ai.user_prompt_template')}</Label>
        <Textarea
          id="user-prompt"
          value={formData.user_prompt_template}
          onChange={(e) => setFormData(prev => ({ ...prev, user_prompt_template: e.target.value }))}
          rows={4}
          className="text-sm"
          placeholder={formData.analysis_type === 'priority' 
            ? formatMessage('ai.user_prompt_placeholder_priority')
            : formatMessage('ai.user_prompt_placeholder_reopen')}
        />
      </div>

      {/* Configurações técnicas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="temperature">{formatMessage('ai.temperature')}</Label>
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
        
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="timeout">{formatMessage('ai.timeout_seconds')}</Label>
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
          <Label htmlFor="retries">{formatMessage('ai.max_attempts')}</Label>
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
        <Label htmlFor="department">{formatMessage('ai.department')}</Label>
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
            <SelectItem value="global">{formatMessage('ai.global_configuration')}</SelectItem>
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
        <h4 className="font-medium mb-3">{formatMessage('ai.test_configuration')}</h4>
        <div className="space-y-3">
          {formData.analysis_type === 'priority' ? (
            <>
              <div>
                <Label htmlFor="test-title">{formatMessage('ai.test_title')}</Label>
                <Input
                  id="test-title"
                  value={testData.test_title}
                  onChange={(e) => setTestData(prev => ({ ...prev, test_title: e.target.value }))}
                  placeholder={formatMessage('ai.test_title_placeholder')}
                />
              </div>
              <div>
                <Label htmlFor="test-description">{formatMessage('ai.test_description')}</Label>
                <Textarea
                  id="test-description"
                  value={testData.test_description}
                  onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
                  placeholder={formatMessage('ai.test_description_placeholder')}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="test-description">{formatMessage('ai.test_description')}</Label>
              <Textarea
                id="test-description"
                value={testData.test_description}
                onChange={(e) => setTestData(prev => ({ ...prev, test_description: e.target.value }))}
                placeholder={formatMessage('ai.test_description_placeholder')}
                rows={3}
              />
            </div>
          )}
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
                <div><strong>{formData.analysis_type === 'reopen' ? 'Ação' : 'Prioridade'}:</strong> {testResult.priority}</div>
                {testResult.justification && (
                  <div>
                    <strong>Justificativa:</strong>
                    <div className="mt-1 p-2 bg-white border rounded text-gray-700">
                      {testResult.justification}
                    </div>
                  </div>
                )}
                <div><strong>Tempo:</strong> {testResult.processingTimeMs}ms</div>
                <div><strong>{formatMessage('ai.fallback')}:</strong> {testResult.usedFallback ? formatMessage('ai.yes') : formatMessage('ai.no')}</div>
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
                {config.provider} - {config.model}
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