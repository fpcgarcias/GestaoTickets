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
import { 
  Plus, 
  Loader2, 
  Settings2, 
  Brain, 
  TestTube, 
  Trash2, 
  Pencil,
  Eye,
  EyeOff 
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
} from "@/components/ui/alert-dialog";

// Interface para configuração de IA
interface AiConfiguration {
  id: number;
  name: string;
  provider: 'openai' | 'google' | 'anthropic';
  model: string;
  api_key: string;
  api_endpoint?: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: string;
  max_tokens: number;
  timeout_seconds: number;
  max_retries: number;
  fallback_priority: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
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
  api_key: string;
  api_endpoint: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: string;
  max_tokens: number;
  timeout_seconds: number;
  max_retries: number;
  fallback_priority: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  is_default: boolean;
}

interface TestData {
  test_title: string;
  test_description: string;
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
  system: `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios:

CRITICAL: Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente e impedem operações essenciais.

HIGH: Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados, falhas que afetam produtividade significativamente.

MEDIUM: Problemas que causam inconveniência mas têm soluções alternativas, funcionalidades secundárias não funcionando, solicitações de melhorias importantes mas não urgentes.

LOW: Dúvidas simples, solicitações de treinamento, melhorias estéticas, configurações pessoais, problemas que não impedem o trabalho.

ATENÇÃO: Responda APENAS com uma das palavras exatas: critical, high, medium ou low (sempre em minúsculas e em inglês).`,
  user: `Título: {titulo}

Descrição: {descricao}

Prioridade:`
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

export default function AiSettings() {
  const { toast } = useToast();
  const { user, company: userCompany } = useAuth();
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    user?.role === 'admin' ? undefined : userCompany?.id
  );
  
  // Estados do formulário
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [deleteConfigId, setDeleteConfigId] = useState<number | null>(null);
  const [editingConfig, setEditingConfig] = useState<AiConfiguration | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Formulário
  const [formData, setFormData] = useState<FormData>({
    name: '',
    provider: 'openai' as const,
    model: 'gpt-4o',
    api_key: '',
    api_endpoint: '',
    system_prompt: DEFAULT_PROMPTS.system,
    user_prompt_template: DEFAULT_PROMPTS.user,
    temperature: '0.1',
    max_tokens: 100,
    timeout_seconds: 30,
    max_retries: 3,
    fallback_priority: 'medium',
    is_active: true,
    is_default: false,
  });
  
  // Estados do teste
  const [testData, setTestData] = useState<TestData>({
    test_title: 'Sistema de email não está funcionando',
    test_description: 'Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe.',
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Buscar configurações
  const { data: configurations = [], isLoading, refetch } = useQuery<AiConfiguration[]>({
    queryKey: ["/api/ai-configurations", selectedCompanyId],
    queryFn: async () => {
      const endpoint = user?.role === 'admin' && selectedCompanyId 
        ? `/api/ai-configurations?company_id=${selectedCompanyId}`
        : '/api/ai-configurations';
      
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) {
        throw new Error('Falha ao buscar configurações de IA');
      }
      return response.json();
    },
    enabled: !!(user && (selectedCompanyId || user.role !== 'admin')),
  });

  // Buscar empresas (se admin)
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      if (!response.ok) throw new Error('Falha ao buscar empresas');
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Mutação para criar/editar
  const saveConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editingConfig 
        ? `/api/ai-configurations/${editingConfig.id}`
        : '/api/ai-configurations';
      
      const method = editingConfig ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        ...data,
        company_id: selectedCompanyId,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao salvar configuração');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: `Configuração ${editingConfig ? 'atualizada' : 'criada'} com sucesso!` });
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingConfig(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Mutação para deletar
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: number) => {
      const response = await apiRequest("DELETE", `/api/ai-configurations/${configId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao deletar configuração');
      }
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configuração deletada com sucesso!" });
      setDeleteConfigId(null);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutação para testar
  const testConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/ai-configurations/test", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha no teste');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data.result);
      toast({ title: "Teste executado", description: "Configuração testada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
      setTestResult(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai' as const,
      model: 'gpt-4o',
      api_key: '',
      api_endpoint: '',
      system_prompt: DEFAULT_PROMPTS.system,
      user_prompt_template: DEFAULT_PROMPTS.user,
      temperature: '0.1',
      max_tokens: 100,
      timeout_seconds: 30,
      max_retries: 3,
      fallback_priority: 'medium',
      is_active: true,
      is_default: false,
    });
    setShowApiKey(false);
  };

  const openEditDialog = (config: AiConfiguration) => {
    setEditingConfig(config);
    setFormData({
      name: config.name || '',
      provider: config.provider,
      model: config.model || 'gpt-4o',
      api_key: config.api_key || '',
      api_endpoint: config.api_endpoint || '',
      system_prompt: config.system_prompt || DEFAULT_PROMPTS.system,
      user_prompt_template: config.user_prompt_template || DEFAULT_PROMPTS.user,
      temperature: config.temperature || '0.1',
      max_tokens: config.max_tokens || 100,
      timeout_seconds: config.timeout_seconds || 30,
      max_retries: config.max_retries || 3,
      fallback_priority: config.fallback_priority || 'medium',
      is_active: config.is_active !== undefined ? config.is_active : true,
      is_default: config.is_default !== undefined ? config.is_default : false,
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.api_key) {
      toast({ title: "Erro", description: "Nome e API Key são obrigatórios", variant: "destructive" });
      return;
    }
    
    saveConfigMutation.mutate(formData);
  };

  const handleTest = () => {
    testConfigMutation.mutate({
      ...formData,
      ...testData,
    });
  };

  const maskApiKey = (key: string | null | undefined) => {
    if (!key || key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  if (user?.role !== 'admin' && user?.role !== 'company_admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acesso Negado</CardTitle>
          <CardDescription>Você não tem permissão para acessar as configurações de IA.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configurações de IA
          </CardTitle>
          <CardDescription>
            Configure provedores de IA para análise automática de prioridade de tickets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de empresa (para admin) */}
          {user?.role === 'admin' && (
            <div>
              <Label htmlFor="company-select">Empresa</Label>
              <Select 
                value={selectedCompanyId?.toString() || ''} 
                onValueChange={(v) => setSelectedCompanyId(v ? parseInt(v) : undefined)}
              >
                <SelectTrigger className="w-full md:w-1/2">
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

          {/* Botão para adicionar nova configuração */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Configurações Ativas</h3>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Configuração
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Configuração de IA</DialogTitle>
                  <DialogDescription>
                    Configure um novo provedor de IA para análise de tickets
                  </DialogDescription>
                </DialogHeader>
                {/* Formulário será renderizado aqui */}
                <ConfigurationForm 
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  onTest={handleTest}
                  testResult={testResult}
                  testData={testData}
                  setTestData={setTestData}
                  isLoading={saveConfigMutation.isPending}
                  isTestLoading={testConfigMutation.isPending}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de configurações */}
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando configurações...</span>
            </div>
          ) : configurations.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg">
              <Brain className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma configuração encontrada</h3>
              <p className="text-gray-500 mb-4">Crie sua primeira configuração de IA para começar.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Configuração
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {configurations.map((config) => (
                <ConfigurationCard
                  key={config.id}
                  config={config}
                  onEdit={openEditDialog}
                  onDelete={setDeleteConfigId}
                  maskApiKey={maskApiKey}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            isLoading={saveConfigMutation.isPending}
            isTestLoading={testConfigMutation.isPending}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            isEditing={true}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfigId} onOpenChange={() => setDeleteConfigId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta configuração de IA? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfigId && deleteConfigMutation.mutate(deleteConfigId)}
              disabled={deleteConfigMutation.isPending}
            >
              {deleteConfigMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  isEditing?: boolean;
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
  showApiKey,
  setShowApiKey,
  isEditing = false 
}: ConfigurationFormProps) {
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
              model: DEFAULT_MODELS[v as keyof typeof DEFAULT_MODELS]?.[0] || ''
            }))}
          >
            <SelectTrigger>
              <SelectValue />
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
          <Label htmlFor="model">Modelo</Label>
          <Select 
            value={formData.model} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, model: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions[formData.provider]?.map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* API Key */}
      <div>
        <Label htmlFor="api-key">API Key</Label>
        <div className="relative">
          <Input
            id="api-key"
            type={showApiKey ? "text" : "password"}
            value={formData.api_key}
            onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
            placeholder="Sua API Key"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Endpoint (opcional) */}
      <div>
        <Label htmlFor="api-endpoint">Endpoint da API (opcional)</Label>
        <Input
          id="api-endpoint"
          value={formData.api_endpoint}
          onChange={(e) => setFormData(prev => ({ ...prev, api_endpoint: e.target.value }))}
          placeholder={
            formData.provider === 'openai' ? 'https://api.openai.com/v1' :
            formData.provider === 'google' ? 'https://generativelanguage.googleapis.com/v1beta' :
            formData.provider === 'anthropic' ? 'https://api.anthropic.com/v1' :
            'Endpoint personalizado da API'
          }
        />
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
            disabled={isTestLoading || !formData.api_key}
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
              <div className="text-sm space-y-1">
                <div><strong>Prioridade:</strong> {testResult.priority.toUpperCase()}</div>
                {testResult.justification && (
                  <div><strong>Justificativa:</strong> {testResult.justification}</div>
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
  onDelete, 
  maskApiKey 
}: { 
  config: AiConfiguration; 
  onEdit: (config: AiConfiguration) => void; 
  onDelete: (id: number) => void; 
  maskApiKey: (key: string | null | undefined) => string; 
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
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.is_default && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Padrão
              </span>
            )}
            <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">API Key:</span> {maskApiKey(config.api_key)}
          </div>
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