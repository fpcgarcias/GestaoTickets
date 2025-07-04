import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Loader2, 
  Mail, 
  Settings, 
  Edit3, 
  Trash2, 
  Eye, 
  TestTube,
  Copy,
  Check,
  Code,
  Monitor,
  FileText,
  AlertCircle,
  Building2
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';

// Interfaces
interface SMTPConfig {
  provider: 'smtp' | 'brevo' | 'sendgrid' | 'mailgun';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  api_key?: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
}

interface EmailTemplate {
  id: number;
  name: string;
  type: string;
  description?: string;
  subject_template: string;
  html_template: string;
  text_template?: string;
  is_active: boolean;
  is_default: boolean;
  available_variables?: string;
  company_id?: number;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: number;
  name: string;
}

const EMAIL_TEMPLATE_TYPES = [
  { value: 'new_ticket', label: 'Novo Ticket' },
  { value: 'ticket_assigned', label: 'Ticket Atribuído' },
  { value: 'ticket_reply', label: 'Nova Resposta' },
  { value: 'status_changed', label: 'Status Alterado' },
  { value: 'ticket_resolved', label: 'Ticket Resolvido' },
  { value: 'ticket_escalated', label: 'Ticket Escalado' },
  { value: 'ticket_due_soon', label: 'Vencimento Próximo' },
  { value: 'customer_registered', label: 'Cliente Registrado' },
  { value: 'user_created', label: 'Usuário Criado' },
  { value: 'system_maintenance', label: 'Manutenção do Sistema' }
];

const PROVIDERS = [
  { value: 'smtp', label: 'SMTP Personalizado' },
  { value: 'brevo', label: 'Brevo (SendinBlue)' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'mailgun', label: 'Mailgun' }
];

// Documentação completa das variáveis disponíveis
const AVAILABLE_VARIABLES = {
  ticket: {
    label: 'Dados do Ticket',
    variables: [
      { key: 'ticket.id', description: 'ID interno do ticket' },
      { key: 'ticket.ticket_id', description: 'Número do ticket (ex: TKT-2024-001)' },
      { key: 'ticket.title', description: 'Título do ticket' },
      { key: 'ticket.description', description: 'Descrição completa do ticket' },
      { key: 'ticket.status', description: 'Status atual (new, ongoing, resolved)' },
      { key: 'ticket.status_text', description: 'Status traduzido (Novo, Em Andamento, Resolvido)' },
      { key: 'ticket.priority', description: 'Prioridade (low, medium, high, critical)' },
      { key: 'ticket.priority_text', description: 'Prioridade traduzida (Baixa, Média, Alta, Crítica)' },
      { key: 'ticket.type', description: 'Tipo do ticket' },
      { key: 'ticket.created_at', description: 'Data e hora de criação (formato ISO)' },
      { key: 'ticket.created_at_formatted', description: 'Data e hora de criação formatada (dd/mm/aaaa hh:mm)' },
      { key: 'ticket.updated_at', description: 'Data e hora da última atualização (formato ISO)' },
      { key: 'ticket.updated_at_formatted', description: 'Data e hora da última atualização formatada' },
      { key: 'ticket.first_response_at_formatted', description: 'Data da primeira resposta formatada' },
      { key: 'ticket.resolved_at', description: 'Data e hora de resolução (formato ISO)' },
      { key: 'ticket.resolved_at_formatted', description: 'Data e hora de resolução formatada' },
      { key: 'ticket.link', description: 'Link direto para o ticket no sistema' }
    ]
  },
  customer: {
    label: 'Dados do Cliente',
    variables: [
      { key: 'customer.name', description: 'Nome do cliente' },
      { key: 'customer.email', description: 'Email do cliente' },
      { key: 'customer.phone', description: 'Telefone do cliente' },
      { key: 'customer.company', description: 'Empresa do cliente' }
    ]
  },
  user: {
    label: 'Dados do Usuário/Atendente',
    variables: [
      { key: 'user.name', description: 'Nome do usuário' },
      { key: 'user.email', description: 'Email do usuário' },
      { key: 'user.role', description: 'Função do usuário (admin, support, etc.)' },
      { key: 'user.role_text', description: 'Função traduzida (Administrador, Suporte, etc.)' }
    ]
  },
  official: {
    label: 'Dados do Atendente',
    variables: [
      { key: 'official.name', description: 'Nome do atendente' },
      { key: 'official.email', description: 'Email do atendente' },
      { key: 'official.role', description: 'Função do atendente' },
      { key: 'official.role_text', description: 'Função do atendente traduzida' }
    ]
  },
  reply: {
    label: 'Dados da Resposta',
    variables: [
      { key: 'reply.message', description: 'Conteúdo da resposta' },
      { key: 'reply.created_at', description: 'Data e hora da resposta (formato ISO)' },
      { key: 'reply.created_at_formatted', description: 'Data e hora da resposta formatada' },
      { key: 'reply.author_name', description: 'Nome de quem respondeu (compatibilidade)' },
      { key: 'reply.user.name', description: 'Nome de quem respondeu' },
      { key: 'reply.user.email', description: 'Email de quem respondeu' },
      { key: 'reply.user.role', description: 'Função de quem respondeu' },
      { key: 'reply.user.role_text', description: 'Função de quem respondeu traduzida' }
    ]
  },
  status_change: {
    label: 'Mudança de Status',
    variables: [
      { key: 'status_change.old_status', description: 'Status anterior (traduzido)' },
      { key: 'status_change.new_status', description: 'Novo status (traduzido)' },
      { key: 'status_change.old_status_text', description: 'Status anterior traduzido' },
      { key: 'status_change.new_status_text', description: 'Novo status traduzido' },
      { key: 'status_change.created_at_formatted', description: 'Data da alteração formatada' },
      { key: 'status_change.changed_by.name', description: 'Nome de quem alterou o status' },
      { key: 'status_change.changed_by.email', description: 'Email de quem alterou o status' },
      { key: 'status_change.changed_by.role', description: 'Função de quem alterou o status' },
      { key: 'status_change.changed_by.role_text', description: 'Função de quem alterou traduzida' }
    ]
  },
  system: {
    label: 'Dados do Sistema',
    variables: [
      { key: 'system.base_url', description: 'URL base do sistema (específica por domínio)' },
      { key: 'system.company_name', description: 'Nome da empresa' },
      { key: 'system.support_email', description: 'Email de suporte' },
      { key: 'system.message', description: 'Mensagem do sistema (contexto específico)' },
      { key: 'company_name', description: 'Nome da empresa (compatibilidade)' },
      { key: 'support_email', description: 'Email de suporte (compatibilidade)' },
      { key: 'base_url', description: 'URL base do sistema (compatibilidade)' }
    ]
  }
};

// Função para obter variáveis por tipo de template
const getVariablesByTemplateType = (templateType: string): string[] => {
  const typeVariables: Record<string, string[]> = {
    new_ticket: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 
      'ticket.priority', 'ticket.priority_text', 'ticket.status', 'ticket.status_text', 'ticket.type', 'ticket.created_at', 'ticket.updated_at',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    ticket_assigned: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description',
      'ticket.priority', 'ticket.priority_text', 'ticket.status', 'ticket.status_text', 'ticket.type', 'ticket.created_at',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'user.name', 'user.email', 'user.role', 'user.role_text',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    ticket_reply: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 'ticket.status', 'ticket.status_text',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'reply.message', 'reply.created_at', 'reply.user.name', 'reply.user.email',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    status_changed: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 'ticket.status', 'ticket.status_text', 'ticket.priority', 'ticket.priority_text',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'status_change.old_status', 'status_change.new_status', 'status_change.old_status_text', 'status_change.new_status_text', 'status_change.changed_by.name', 'status_change.created_at',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    ticket_resolved: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 'ticket.resolved_at', 'ticket.resolved_at_formatted',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'user.name', 'user.email', 'user.role', 'user.role_text',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    ticket_escalated: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 'ticket.priority', 'ticket.priority_text',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'user.name', 'user.email', 'user.role', 'user.role_text',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    ticket_due_soon: [
      'ticket.id', 'ticket.ticket_id', 'ticket.title', 'ticket.description', 'ticket.priority', 'ticket.priority_text',
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'user.name', 'user.email', 'user.role', 'user.role_text',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    customer_registered: [
      'customer.name', 'customer.email', 'customer.company', 'customer.phone',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    user_created: [
      'user.name', 'user.email', 'user.role', 'user.role_text',
      'system.base_url', 'system.company_name', 'system.support_email'
    ],
    system_maintenance: [
      'system.base_url', 'system.company_name', 'system.support_email'
    ]
  };

  return typeVariables[templateType] || [];
};

export default function EmailSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Estado para empresa selecionada (apenas para admin)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    user?.role === 'admin' ? undefined : user?.company?.id
  );

  // Estados para configurações SMTP
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    provider: 'smtp',
    host: '',
    port: 587,
    username: '',
    password: '',
    api_key: '',
    from_email: '',
    from_name: '',
    use_tls: true
  });

  // Flag para controlar se o usuário fez alterações manuais
  const [userMadeChanges, setUserMadeChanges] = useState(false);

  // Estados para templates
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState<'code' | 'visual'>('visual');
  const [showVariablesDoc, setShowVariablesDoc] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: '',
    description: '',
    subject_template: '',
    html_template: '',
    text_template: '',
    is_active: true
  });

  // Buscar lista de empresas (apenas para admin)
  const { 
    data: companies, 
    isLoading: isLoadingCompanies 
  } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      if (!response.ok) {
        throw new Error('Falha ao carregar empresas');
      }
      return response.json();
    },
    enabled: user?.role === 'admin'
  });

  // Definir empresa padrão para admin quando as empresas são carregadas
  useEffect(() => {
    if (user?.role === 'admin' && companies && companies.length > 0 && !selectedCompanyId) {
      // Se o usuário admin tem uma empresa associada, usar ela
      const userCompanyId = user?.company?.id;
      if (userCompanyId && companies.some(c => c.id === userCompanyId)) {
        setSelectedCompanyId(userCompanyId);
      } else {
        // Caso contrário, usar a primeira empresa da lista
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [user, companies, selectedCompanyId]);

  // Construir query key dinâmica baseada na empresa selecionada
  const emailConfigQueryKey = user?.role === 'admin' && selectedCompanyId 
    ? ["/api/email-config", selectedCompanyId] 
    : ["/api/email-config"];

  const emailTemplatesQueryKey = user?.role === 'admin' && selectedCompanyId 
    ? ["/api/email-templates", selectedCompanyId] 
    : ["/api/email-templates"];

  // Buscar configurações de email
  const { 
    data: emailConfig, 
    isLoading: isLoadingConfig,
    refetch: refetchConfig
  } = useQuery<SMTPConfig>({
    queryKey: emailConfigQueryKey,
    queryFn: async () => {
      let url = "/api/email-config";
      if (user?.role === 'admin' && selectedCompanyId) {
        url += `?company_id=${selectedCompanyId}`;
      }
      
      const response = await apiRequest("GET", url);
      if (!response.ok) {
        throw new Error('Falha ao carregar configurações de email');
      }
      return response.json();
    },
    enabled: user?.role !== 'admin' || (user?.role === 'admin' && selectedCompanyId !== undefined)
  });

  // Buscar templates de email
  const { 
    data: emailTemplates, 
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates
  } = useQuery<EmailTemplate[]>({
    queryKey: emailTemplatesQueryKey,
    queryFn: async () => {
      let url = "/api/email-templates";
      if (user?.role === 'admin' && selectedCompanyId) {
        url += `?company_id=${selectedCompanyId}`;
      }
      
      const response = await apiRequest("GET", url);
      if (!response.ok) {
        throw new Error('Falha ao carregar templates de email');
      }
      return response.json();
    },
    enabled: user?.role !== 'admin' || (user?.role === 'admin' && selectedCompanyId !== undefined)
  });

  // Mutation para salvar configurações SMTP
  const saveConfigMutation = useMutation({
    mutationFn: async (config: SMTPConfig) => {
      console.log('[DEBUG Frontend] Entrando no mutationFn com config:', config);
      console.log('[DEBUG Frontend] Stringifying config:', JSON.stringify(config));
      
      let requestConfig: any = config;
      
      // Para admin, enviar company_id no body
      if (user?.role === 'admin' && selectedCompanyId) {
        requestConfig = { ...config, company_id: selectedCompanyId };
      }
      
      const response = await apiRequest("POST", "/api/email-config", requestConfig);
      
      console.log('[DEBUG Frontend] Response status:', response.status);
      console.log('[DEBUG Frontend] Response ok:', response.ok);
      
      if (!response.ok) {
        const error = await response.json();
        console.log('[DEBUG Frontend] Erro na resposta:', error);
        throw new Error(error.message || 'Falha ao salvar configurações');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Configurações de email salvas com sucesso!",
      });
      setUserMadeChanges(false); // Resetar flag de alterações
      refetchConfig();
    },
    onError: (error: Error) => {
      console.log('[DEBUG Frontend] onError chamado:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para salvar template
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      let requestTemplate = template;
      
      // Para admin, enviar company_id no body
      if (user?.role === 'admin' && selectedCompanyId) {
        requestTemplate = { ...template, company_id: selectedCompanyId };
      }
      
      const response = await apiRequest("POST", "/api/email-templates", requestTemplate);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao salvar template');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Template salvo com sucesso!",
      });
      refetchTemplates();
      setIsEditingTemplate(false);
      setTemplateForm({
        name: '',
        type: '',
        description: '',
        subject_template: '',
        html_template: '',
        text_template: '',
        is_active: true
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para criar templates padrão
  const createDefaultTemplatesMutation = useMutation({
    mutationFn: async () => {
      let body = {};
      
      // Para admin, enviar company_id no body
      if (user?.role === 'admin' && selectedCompanyId) {
        body = { company_id: selectedCompanyId };
      }
      
      const response = await apiRequest("POST", "/api/email-templates/seed-defaults", body);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar templates padrão');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.created === 0) {
        toast({
          title: "Informação",
          description: data.message,
        });
      } else {
        toast({
          title: "Sucesso",
          description: data.message,
        });
        refetchTemplates();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, template }: { id: number; template: any }) => {
      let requestTemplate = template;
      
      // Para admin, enviar company_id no body
      if (user?.role === 'admin' && selectedCompanyId) {
        requestTemplate = { ...template, company_id: selectedCompanyId };
      }
      
      const response = await apiRequest("PUT", `/api/email-templates/${id}`, requestTemplate);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao atualizar template');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Template atualizado com sucesso!",
      });
      refetchTemplates();
      setIsEditingTemplate(false);
      setSelectedTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para deletar template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/email-templates/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao deletar template');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Template deletado com sucesso!",
      });
      refetchTemplates();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Função helper para atualizar configuração e marcar alterações
  const updateSMTPConfig = (updates: Partial<SMTPConfig>) => {
    setSmtpConfig(prev => ({ ...prev, ...updates }));
    setUserMadeChanges(true);
  };

  // Atualizar estado quando carregar dados
  useEffect(() => {
    // Só atualizar se o usuário não fez alterações manuais
    if (emailConfig && !userMadeChanges) {
      console.log('[DEBUG Frontend] Dados carregados do backend:', emailConfig);
      
      const newConfig = {
        provider: emailConfig.provider || 'smtp',
        host: emailConfig.host || '',
        port: emailConfig.port || 587,
        username: emailConfig.username || '',
        password: emailConfig.password || '',
        api_key: emailConfig.api_key || '',
        from_email: emailConfig.from_email || '',
        from_name: emailConfig.from_name || 'Sistema de Tickets',
        use_tls: emailConfig.use_tls !== false // Garantir que seja boolean
      };
      
      console.log('[DEBUG Frontend] Novo estado que será setado (sem sobrescrever alterações do usuário):', newConfig);
      setSmtpConfig(newConfig);
    } else if (emailConfig && userMadeChanges) {
      console.log('[DEBUG Frontend] Dados carregados do backend, mas usuário fez alterações - não sobrescrevendo:', emailConfig);
    }
  }, [emailConfig, userMadeChanges]);

  const handleSaveConfig = () => {
    // Validar campos obrigatórios
    if (!smtpConfig.provider || smtpConfig.provider.trim() === '') {
      toast({
        title: "Erro",
        description: "Provedor de email é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!smtpConfig.from_email || smtpConfig.from_email.trim() === '') {
      toast({
        title: "Erro",
        description: "Email do remetente é obrigatório",
        variant: "destructive",
      });
      return;
    }

    // Validações específicas por provedor
    if (smtpConfig.provider === 'smtp') {
      // Para SMTP, validar campos específicos
      if (!smtpConfig.host || smtpConfig.host.trim() === '') {
        toast({
          title: "Erro",
          description: "Servidor SMTP é obrigatório",
          variant: "destructive",
        });
        return;
      }

      if (!smtpConfig.username || smtpConfig.username.trim() === '') {
        toast({
          title: "Erro",
          description: "Usuário SMTP é obrigatório",
          variant: "destructive",
        });
        return;
      }

      if (!smtpConfig.password || smtpConfig.password.trim() === '') {
        toast({
          title: "Erro",
          description: "Senha SMTP é obrigatória",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Para provedores de API (Brevo, SendGrid, Mailgun)
      if (!smtpConfig.api_key || smtpConfig.api_key.trim() === '') {
        toast({
          title: "Erro",
          description: "Chave da API é obrigatória",
          variant: "destructive",
        });
        return;
      }
    }

    // Preparar dados para envio, garantindo que não temos valores nulos
    const configToSave: SMTPConfig = {
      provider: smtpConfig.provider,
      host: smtpConfig.host || '',
      port: smtpConfig.port || 587,
      username: smtpConfig.username || '',
      password: smtpConfig.password || '',
      api_key: smtpConfig.api_key || '',
      from_email: smtpConfig.from_email,
      from_name: smtpConfig.from_name || 'Sistema de Tickets',
      use_tls: smtpConfig.use_tls !== false // Garantir que seja boolean
    };

    // Debug: Logar o que está sendo enviado
    console.log('[DEBUG Frontend] Estado atual smtpConfig:', smtpConfig);
    console.log('[DEBUG Frontend] Dados que serão enviados:', configToSave);
    console.log('[DEBUG Frontend] Provider:', configToSave.provider);
    console.log('[DEBUG Frontend] From email:', configToSave.from_email);

    saveConfigMutation.mutate(configToSave);
  };

  const handleTestConnection = async () => {
    try {
      const response = await apiRequest("POST", "/api/email-config/test", smtpConfig);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha no teste de conexão');
      }

      toast({
        title: "Sucesso",
        description: "Teste de conexão realizado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro no Teste",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.type || !templateForm.subject_template || !templateForm.html_template) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate) {
      // Atualizar template existente
      updateTemplateMutation.mutate({
        id: selectedTemplate.id,
        template: templateForm
      });
    } else {
      // Criar novo template
      saveTemplateMutation.mutate(templateForm);
    }
  };

  const handleDeleteTemplate = (templateId: number) => {
    deleteTemplateMutation.mutate(templateId);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      description: template.description || '',
      subject_template: template.subject_template,
      html_template: template.html_template,
      text_template: template.text_template || '',
      is_active: template.is_active
    });
    setIsEditingTemplate(true);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setTemplateForm({
      name: '',
      type: '',
      description: '',
      subject_template: '',
      html_template: '',
      text_template: '',
      is_active: true
    });
    setIsEditingTemplate(true);
  };

  // Função para gerar dados de exemplo para preview
  const generateSampleData = (templateType: string) => {
    const baseData = {
      ticket: {
        id: 123,
        ticket_id: 'TKT-2025-001',
        title: 'Problema com login no sistema',
        description: 'Usuário não consegue acessar o sistema após redefinir senha.',
        status: 'ongoing',
        status_text: 'Em Andamento',
        priority: 'high',
        priority_text: 'Alta',
        type: 'Suporte Técnico',
        created_at: '2025-01-31T10:30:00Z',
        created_at_formatted: '31/01/2025 10:30',
        updated_at: '2025-01-31T14:45:00Z',
        updated_at_formatted: '31/01/2025 14:45',
        first_response_at_formatted: '31/01/2025 11:15',
        resolved_at: null,
        resolved_at_formatted: '',
        link: 'https://sistema.empresa.com/tickets/123'
      },
      customer: {
        name: 'João Silva',
        email: 'joao.silva@empresa.com',
        phone: '(11) 99999-9999',
        company: 'Empresa ABC Ltda'
      },
      user: {
        name: 'Maria Santos',
        email: 'maria.santos@suporte.com',
        role: 'support',
        role_text: 'Suporte'
      },
      official: {
        name: 'Carlos Oliveira',
        email: 'carlos.oliveira@suporte.com',
        role: 'support',
        role_text: 'Suporte'
      },
      reply: {
        message: 'Olá! Recebemos seu chamado e já estamos trabalhando na solução. Verificamos que o problema está relacionado ao cache do navegador.',
        created_at: '2025-01-31T14:45:00Z',
        created_at_formatted: '31/01/2025 14:45',
        author_name: 'Maria Santos',
        user: {
          name: 'Maria Santos',
          email: 'maria.santos@suporte.com',
          role: 'support',
          role_text: 'Suporte'
        }
      },
      status_change: {
        old_status: 'Novo',
        new_status: 'Em Andamento',
        old_status_text: 'Novo',
        new_status_text: 'Em Andamento',
        created_at_formatted: '31/01/2025 15:00',
        changed_by: {
          name: 'Maria Santos',
          email: 'maria.santos@suporte.com',
          role: 'support',
          role_text: 'Suporte'
        }
      },
      system: {
        base_url: 'https://sistema.empresa.com',
        company_name: 'Sistema de Tickets',
        support_email: 'suporte@empresa.com',
        message: 'Mensagem específica do contexto'
      },
      // Variáveis de compatibilidade
      company_name: 'Sistema de Tickets',
      support_email: 'suporte@empresa.com',
      base_url: 'https://sistema.empresa.com'
    };

    return baseData;
  };

  // Função para substituir variáveis no template
  const renderTemplateWithSampleData = (template: string, data: any): string => {
    if (!template || typeof template !== 'string') {
      return '';
    }
    
    let rendered = template;
    
    // Substituir variáveis aninhadas como {{ticket.title}} ou {{status_change.changed_by.name}}
    rendered = rendered.replace(/\{\{(\w+)\.(\w+)(?:\.(\w+))?\}\}/g, (match, obj, prop, subProp) => {
      try {
        if (subProp) {
          // Três níveis: {{status_change.changed_by.name}}
          return data[obj]?.[prop]?.[subProp] || match;
        } else {
          // Dois níveis: {{ticket.title}}
          return data[obj]?.[prop] || match;
        }
      } catch (e) {
        return match;
      }
    });
    
    // Substituir variáveis simples como {{company_name}}
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, prop) => {
      try {
        return data[prop] || match;
      } catch (e) {
        return match;
      }
    });
    
    return rendered;
  };

  const renderSMTPForm = () => (
    <div className="space-y-6">
      <div>
        <Label>Provedor de Email</Label>
        <Select 
          value={smtpConfig.provider} 
          onValueChange={(value: any) => {
            console.log('[DEBUG Frontend] Select onValueChange chamado com valor:', value);
            console.log('[DEBUG Frontend] Estado atual antes da mudança:', smtpConfig);
            
            const newConfig = { 
              ...smtpConfig, 
              provider: value,
              // Limpar campos não relevantes quando mudar de provedor
              host: value === 'smtp' ? smtpConfig.host : '',
              username: value === 'smtp' ? smtpConfig.username : '',
              password: value === 'smtp' ? smtpConfig.password : '',
              api_key: value !== 'smtp' ? smtpConfig.api_key : ''
            };
            
            console.log('[DEBUG Frontend] Novo estado que será setado:', newConfig);
            setSmtpConfig(newConfig);
            setUserMadeChanges(true); // Marcar que usuário fez alterações
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map(provider => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Email do Remetente *</Label>
          <Input
            type="email"
            value={smtpConfig.from_email || ''}
            onChange={(e) => updateSMTPConfig({ from_email: e.target.value })}
            placeholder="noreply@empresa.com"
          />
        </div>
        <div>
          <Label>Nome do Remetente</Label>
          <Input
            value={smtpConfig.from_name || ''}
            onChange={(e) => updateSMTPConfig({ from_name: e.target.value })}
            placeholder="Sistema de Tickets"
          />
        </div>
      </div>

      {smtpConfig.provider === 'smtp' && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium">Configurações SMTP</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Servidor SMTP *</Label>
              <Input
                value={smtpConfig.host || ''}
                onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label>Porta</Label>
              <Input
                type="number"
                value={smtpConfig.port || 587}
                onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
              />
            </div>
            <div>
              <Label>Usuário *</Label>
              <Input
                value={smtpConfig.username || ''}
                onChange={(e) => setSmtpConfig(prev => ({ ...prev, username: e.target.value }))}
                placeholder="seu-email@gmail.com"
              />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input
                type="password"
                value={smtpConfig.password || ''}
                onChange={(e) => setSmtpConfig(prev => ({ ...prev, password: e.target.value }))}
                placeholder="sua-senha-de-app"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={smtpConfig.use_tls === true}
              onCheckedChange={(checked) => setSmtpConfig(prev => ({ ...prev, use_tls: checked }))}
            />
            <Label>Usar TLS/SSL</Label>
          </div>
        </div>
      )}

      {smtpConfig.provider !== 'smtp' && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <h4 className="font-medium mb-3 text-blue-800">
            Configuração da API {PROVIDERS.find(p => p.value === smtpConfig.provider)?.label}
          </h4>
          <div className="space-y-3">
            <div>
              <Label>Chave da API *</Label>
              <Input
                type="password"
                value={smtpConfig.api_key || ''}
                onChange={(e) => updateSMTPConfig({ api_key: e.target.value })}
                placeholder={`Insira sua chave da API do ${PROVIDERS.find(p => p.value === smtpConfig.provider)?.label}`}
              />
            </div>
            {smtpConfig.provider === 'brevo' && (
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
                💡 <strong>Brevo (SendinBlue):</strong> Você pode encontrar sua chave de API em: 
                Configurações → Chaves da API → Criar uma nova chave
              </div>
            )}
            {smtpConfig.provider === 'sendgrid' && (
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
                💡 <strong>SendGrid:</strong> Crie uma chave de API em: 
                Settings → API Keys → Create API Key
              </div>
            )}
            {smtpConfig.provider === 'mailgun' && (
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded">
                💡 <strong>Mailgun:</strong> Encontre sua chave de API em: 
                Settings → API Keys → Private API key
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button 
          onClick={handleSaveConfig}
          disabled={saveConfigMutation.isPending}
        >
          {saveConfigMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Settings className="mr-2 h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={!smtpConfig.from_email}
        >
          <TestTube className="mr-2 h-4 w-4" />
          Testar Conexão
        </Button>
      </div>
    </div>
  );

  const renderTemplatesList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Templates de Email</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowVariablesDoc(true)}
          >
            📋 Documentação de Variáveis
          </Button>
          <Button 
            variant="outline"
            onClick={() => createDefaultTemplatesMutation.mutate()}
            disabled={createDefaultTemplatesMutation.isPending}
          >
            {createDefaultTemplatesMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Criar Templates Padrão
              </>
            )}
          </Button>
          <Button onClick={handleNewTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </div>

      {isLoadingTemplates ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando templates...</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {emailTemplates?.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      {template.is_default && (
                        <Badge variant="outline">Padrão</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Tipo: {EMAIL_TEMPLATE_TYPES.find(t => t.value === template.type)?.label}
                    </p>
                    {template.description && (
                      <p className="text-sm text-gray-500">{template.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o template "{template.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="smtp" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações SMTP
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Templates de Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Email</CardTitle>
              <CardDescription>
                Configure as configurações de envio de email para notificações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Dropdown de seleção de empresa para admin */}
              {user?.role === 'admin' && (
                <div className="mb-6 p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium text-blue-800">
                      Selecionar Empresa
                    </Label>
                  </div>
                  <Select 
                    value={selectedCompanyId?.toString() || ''} 
                    onValueChange={(value) => {
                      setSelectedCompanyId(value ? parseInt(value) : undefined);
                      setUserMadeChanges(false); // Reset alterações quando trocar empresa
                    }}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue 
                        placeholder={isLoadingCompanies ? "Carregando empresas..." : "Selecione uma empresa"} 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600 mt-1">
                    Configurações de email são específicas por empresa
                  </p>
                </div>
              )}

              {/* Mensagem para admin que ainda não selecionou empresa */}
              {user?.role === 'admin' && !selectedCompanyId && (
                <div className="text-center text-neutral-500 p-8 rounded-md border border-dashed">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
                  <p className="text-lg font-medium mb-2">Selecione uma empresa</p>
                  <p className="text-sm">
                    Para configurar as definições de email, primeiro selecione a empresa desejada.
                  </p>
                </div>
              )}

              {/* Conteúdo principal - só mostra se não for admin ou se admin já selecionou empresa */}
              {(user?.role !== 'admin' || selectedCompanyId) && (
                <>
                  {isLoadingConfig ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Carregando configurações...</span>
                    </div>
                  ) : (
                    renderSMTPForm()
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Email</CardTitle>
              <CardDescription>
                Gerencie os templates usados para diferentes tipos de notificações por email
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Dropdown de seleção de empresa para admin */}
              {user?.role === 'admin' && (
                <div className="mb-6 p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium text-blue-800">
                      Selecionar Empresa
                    </Label>
                  </div>
                  <Select 
                    value={selectedCompanyId?.toString() || ''} 
                    onValueChange={(value) => setSelectedCompanyId(value ? parseInt(value) : undefined)}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue 
                        placeholder={isLoadingCompanies ? "Carregando empresas..." : "Selecione uma empresa"} 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600 mt-1">
                    Templates de email são específicos por empresa
                  </p>
                </div>
              )}

              {/* Mensagem para admin que ainda não selecionou empresa */}
              {user?.role === 'admin' && !selectedCompanyId && (
                <div className="text-center text-neutral-500 p-8 rounded-md border border-dashed">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
                  <p className="text-lg font-medium mb-2">Selecione uma empresa</p>
                  <p className="text-sm">
                    Para gerenciar templates de email, primeiro selecione a empresa desejada.
                  </p>
                </div>
              )}

              {/* Conteúdo principal - só mostra se não for admin ou se admin já selecionou empresa */}
              {(user?.role !== 'admin' || selectedCompanyId) && renderTemplatesList()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para visualizar template */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>
                    Template do tipo: {EMAIL_TEMPLATE_TYPES.find(t => t.value === selectedTemplate.type)?.label}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={previewMode === 'visual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('visual')}
                  >
                    <Monitor className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant={previewMode === 'code' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('code')}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Código
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="font-medium">Assunto</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded border">
                  {previewMode === 'visual' ? (
                    <span className="text-sm">
                      {renderTemplateWithSampleData(
                        selectedTemplate.subject_template, 
                        generateSampleData(selectedTemplate.type)
                      )}
                    </span>
                  ) : (
                    <code className="text-sm">{selectedTemplate.subject_template}</code>
                  )}
                </div>
              </div>
              
              {previewMode === 'visual' ? (
                <div>
                  <Label className="font-medium">Preview do Email</Label>
                  <div className="mt-1 border rounded-lg bg-white">
                    <div className="p-4 border-b bg-gray-50 rounded-t-lg">
                      <div className="text-sm text-gray-600">
                        <strong>De:</strong> Sistema de Tickets &lt;noreply@empresa.com&gt;<br/>
                        <strong>Para:</strong> joao.silva@empresa.com<br/>
                        <strong>Assunto:</strong> {renderTemplateWithSampleData(
                          selectedTemplate.subject_template, 
                          generateSampleData(selectedTemplate.type)
                        )}
                      </div>
                    </div>
                    <div 
                      className="p-4 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderTemplateWithSampleData(
                          selectedTemplate.html_template,
                          generateSampleData(selectedTemplate.type)
                        )
                      }}
                    />
                  </div>
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    💡 Este é um preview com dados de exemplo. As variáveis serão substituídas pelos dados reais quando o email for enviado.
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="font-medium">Conteúdo HTML</Label>
                    <Textarea 
                      value={selectedTemplate.html_template} 
                      readOnly 
                      className="h-32 font-mono text-xs"
                    />
                  </div>
                  {selectedTemplate.text_template && (
                    <div>
                      <Label className="font-medium">Conteúdo Texto</Label>
                      <Textarea 
                        value={selectedTemplate.text_template} 
                        readOnly 
                        className="h-24 font-mono text-xs"
                      />
                    </div>
                  )}
                </>
              )}
              
              {/* Seção de Variáveis Disponíveis */}
              <div>
                <Label className="font-medium">Variáveis Disponíveis para este Tipo</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded border text-xs">
                  {(() => {
                    const availableVars = getVariablesByTemplateType(selectedTemplate.type);
                    if (availableVars.length === 0) {
                      return <span className="text-gray-500">Nenhuma variável específica para este tipo</span>;
                    }
                    
                    return (
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(AVAILABLE_VARIABLES).map(([category, info]) => {
                          const categoryVars = info.variables.filter(v => 
                            availableVars.includes(v.key)
                          );
                          
                          if (categoryVars.length === 0) return null;
                          
                          return (
                            <div key={category}>
                              <h4 className="font-medium text-gray-700 mb-2">{info.label}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {categoryVars.map((variable) => (
                                  <div key={variable.key} className="bg-white p-2 rounded border">
                                    <code className="text-blue-600 font-medium">
                                      {"{{"}{variable.key}{"}"}
                                    </code>
                                    <div className="text-gray-600 text-xs mt-1">
                                      {variable.description}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para editar/criar template */}
      <Dialog open={isEditingTemplate} onOpenChange={setIsEditingTemplate}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Configure o template de email para notificações automáticas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome do Template</Label>
                <Input
                  value={templateForm.name || ''}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do template"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select 
                  value={templateForm.type || ''} 
                  onValueChange={(value) => setTemplateForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Descrição</Label>
              <Input
                value={templateForm.description || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do template (opcional)"
              />
            </div>

            <div>
              <Label>Assunto do Email</Label>
              <Input
                value={templateForm.subject_template || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, subject_template: e.target.value }))}
                placeholder={`Ex: Novo Ticket: {{ticket.title}}`}
              />
            </div>

            <div>
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={templateForm.html_template || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, html_template: e.target.value }))}
                placeholder={`Template HTML com variáveis {{ticket.title}}, {{customer.name}}, etc.`}
                className="h-40 font-mono text-xs"
              />
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                💡 Dica: Use variáveis como {"{{"} ticket.title{"}"}, {"{{"} customer.name{"}"}, {"{{"} ticket.ticket_id{"}"}, {"{{"} user.name{"}"}, etc. 
                Você pode ver um preview do template após salvá-lo.
              </div>
            </div>

            {/* Documentação de Variáveis Disponíveis */}
            {templateForm.type && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-800 mb-3">
                  📋 Variáveis Disponíveis para "{EMAIL_TEMPLATE_TYPES.find(t => t.value === templateForm.type)?.label}"
                </h4>
                <div className="max-h-32 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {getVariablesByTemplateType(templateForm.type).map((variable) => {
                      const variableInfo = Object.values(AVAILABLE_VARIABLES)
                        .flatMap(category => category.variables)
                        .find(v => v.key === variable);
                      
                      return (
                        <div key={variable} className="bg-white p-2 rounded border">
                          <code className="text-blue-600 font-medium">
                            {"{{"}{variable}{"}"}
                          </code>
                          {variableInfo && (
                            <div className="text-gray-600 text-xs mt-1">
                              {variableInfo.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Conteúdo Texto (opcional)</Label>
              <Textarea
                value={templateForm.text_template || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, text_template: e.target.value }))}
                placeholder="Versão em texto simples (opcional)"
                className="h-24 font-mono text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="template-active">Template Ativo</Label>
              <Switch
                id="template-active"
                checked={templateForm.is_active === true}
                onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingTemplate(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={saveTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(saveTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Documentação de Variáveis */}
      <Dialog open={showVariablesDoc} onOpenChange={setShowVariablesDoc}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Documentação Completa de Variáveis</DialogTitle>
            <DialogDescription>
              Todas as variáveis disponíveis para uso nos templates de email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {Object.entries(AVAILABLE_VARIABLES).map(([category, info]) => (
              <div key={category} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 text-gray-800">{info.label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {info.variables.map((variable) => (
                    <div key={variable.key} className="bg-gray-50 p-3 rounded border">
                      <code className="text-blue-600 font-bold text-sm">
                        {"{{"}{variable.key}{"}"}
                      </code>
                      <div className="text-gray-700 text-sm mt-2">
                        {variable.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-lg mb-3 text-blue-800">💡 Dicas de Uso</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Use as variáveis exatamente como mostrado, incluindo as chaves duplas</li>
                <li>• Nem todas as variáveis estão disponíveis para todos os tipos de template</li>
                <li>• O sistema substitui automaticamente as variáveis pelos valores reais</li>
                <li>• Use o Preview para ver como o email ficará com dados de exemplo</li>
                <li>• Variáveis não encontradas aparecerão como texto literal no email</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowVariablesDoc(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 