import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Loader2, 
  Edit3, 
  Trash2, 
  Eye,
  FileText,
  Code,
  Check,
  Copy,
} from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';

interface TermTemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
  is_active: boolean;
  is_default: boolean;
  version: number;
  company_id?: number;
  created_at: string;
  updated_at: string;
}

// Variáveis disponíveis para templates de termos
const AVAILABLE_VARIABLES = {
  'Empresa': {
    variables: [
      { name: 'companyName', description: 'Nome da empresa' },
      { name: 'companyDocument', description: 'CNPJ formatado' },
      { name: 'companyCity', description: 'Cidade da empresa' },
    ]
  },
  'Usuário': {
    variables: [
      { name: 'userName', description: 'Nome completo do funcionário' },
      { name: 'userEmail', description: 'E-mail do funcionário' },
      { name: 'userCpf', description: 'CPF formatado (ou "--" se não informado)' },
      { name: 'userPhone', description: 'Telefone (ou "--" se não informado)' },
    ]
  },
  'Alocação': {
    variables: [
      { name: 'assignmentId', description: 'ID da alocação' },
      { name: 'assignedDate', description: 'Data de alocação (dd/mm/yyyy)' },
      { name: 'expectedReturnDate', description: 'Data prevista de devolução' },
    ]
  },
  'Data': {
    variables: [
      { name: 'today', description: 'Data atual completa (dd/mm/yyyy)' },
      { name: 'todayDay', description: 'Dia do mês (2 dígitos)' },
      { name: 'todayMonth', description: 'Nome do mês por extenso' },
      { name: 'todayYear', description: 'Ano (4 dígitos)' },
    ]
  },
  'Produtos (Termo Único)': {
    variables: [
      { name: 'productName', description: 'Nome do produto' },
      { name: 'productBrand', description: 'Marca do produto' },
      { name: 'productModel', description: 'Modelo do produto' },
      { name: 'productSerial', description: 'Número de série' },
      { name: 'productAsset', description: 'Número de patrimônio' },
    ]
  },
  'Produtos (Termo em Lote)': {
    variables: [
      { name: 'productsCount', description: 'Quantidade de produtos' },
      { name: 'productsList', description: 'Lista HTML de produtos (ul/li)' },
      { name: 'productsTable', description: 'Tabela HTML completa (EQUIPAMENTO / SERIAL NUMBER)' },
    ]
  },
  'Responsável': {
    variables: [
      { name: 'deliveryResponsibleName', description: 'Nome do responsável pela entrega' },
    ]
  },
};

export default function TermTemplatesSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<TermTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isViewingTemplate, setIsViewingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    content: '',
    is_active: true,
    is_default: false,
  });

  // Query para listar templates
  const { data: templates, isLoading: isLoadingTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ['term-templates'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/term-templates");
      if (!response.ok) {
        throw new Error('Falha ao carregar templates');
      }
      const data = await response.json();
      return data.data as TermTemplate[];
    },
  });

  // Mutation para criar template padrão
  const createDefaultTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/inventory/term-templates/seed-defaults", {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar template padrão');
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

  // Mutation para criar template
  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof templateForm) => {
      const response = await apiRequest("POST", "/api/inventory/term-templates", template);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao criar template');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Template criado com sucesso!",
      });
      refetchTemplates();
      setIsEditingTemplate(false);
      setTemplateForm({
        name: '',
        description: '',
        content: '',
        is_active: true,
        is_default: false,
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

  // Mutation para atualizar template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, template }: { id: number; template: typeof templateForm }) => {
      const response = await apiRequest("PUT", `/api/inventory/term-templates/${id}`, template);
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
      const response = await apiRequest("DELETE", `/api/inventory/term-templates/${id}`);
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

  const handleEditTemplate = (template: TermTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      content: template.content,
      is_active: template.is_active,
      is_default: template.is_default,
    });
    setIsEditingTemplate(true);
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setTemplateForm({
      name: '',
      description: '',
      content: '',
      is_active: true,
      is_default: false,
    });
    setIsEditingTemplate(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.content) {
      toast({
        title: "Erro",
        description: "Nome e conteúdo são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, template: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    deleteTemplateMutation.mutate(id);
  };

  const copyVariable = (variableName: string) => {
    navigator.clipboard.writeText(`{{${variableName}}}`);
    toast({
      title: "Copiado!",
      description: `Variável {{${variableName}}} copiada para a área de transferência`,
    });
  };

  const hasDefaultTemplate = templates?.some(t => t.is_default);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Templates de Termos de Responsabilidade</CardTitle>
              <CardDescription>
                Gerencie os templates usados para gerar termos de responsabilidade de equipamentos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!hasDefaultTemplate && (
                <Button
                  onClick={() => createDefaultTemplateMutation.mutate()}
                  disabled={createDefaultTemplateMutation.isPending}
                  variant="outline"
                >
                  {createDefaultTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Criar Template Padrão
                </Button>
              )}
              <Button onClick={handleCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando templates...</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates && templates.length > 0 ? (
                templates.map((template) => (
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
                            <Badge variant="outline">v{template.version}</Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setIsViewingTemplate(true);
                            }}
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
                          {!template.is_default && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive/90"
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
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center text-muted-foreground p-8 rounded-md border border-dashed">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/60" />
                  <p className="text-lg font-medium mb-2">Nenhum template encontrado</p>
                  <p className="text-sm mb-4">
                    Crie um template padrão para começar a usar termos de responsabilidade.
                  </p>
                  <Button onClick={() => createDefaultTemplateMutation.mutate()}>
                    <FileText className="h-4 w-4 mr-2" />
                    Criar Template Padrão
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para visualizar template */}
      {isViewingTemplate && selectedTemplate && (
        <Dialog open={isViewingTemplate} onOpenChange={setIsViewingTemplate}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                {selectedTemplate.description || 'Visualização do template'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Conteúdo do Template</Label>
                <div className="mt-2 p-4 bg-muted rounded border font-mono text-xs overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{selectedTemplate.content}</pre>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewingTemplate(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para editar/criar template */}
      <Dialog open={isEditingTemplate} onOpenChange={setIsEditingTemplate}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Configure o template HTML para termos de responsabilidade. Use as variáveis disponíveis abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="Ex: Termo Padrão"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="Descrição do template"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content">Conteúdo HTML *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const textarea = document.getElementById('content') as HTMLTextAreaElement;
                      if (textarea) {
                        textarea.focus();
                        document.execCommand('paste');
                      }
                    }}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Colar HTML
                  </Button>
                </div>
              </div>
              <Textarea
                id="content"
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                placeholder="Cole ou digite o HTML do template aqui..."
                className="font-mono text-xs"
                rows={20}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={templateForm.is_active}
                  onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })}
                />
                <Label htmlFor="is_active">Template Ativo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={templateForm.is_default}
                  onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_default: checked })}
                />
                <Label htmlFor="is_default">Template Padrão</Label>
              </div>
            </div>

            {/* Variáveis disponíveis */}
            <div className="mt-4 p-4 bg-muted rounded border">
              <div className="flex items-center gap-2 mb-3">
                <Code className="h-4 w-4" />
                <Label className="text-sm font-medium">Variáveis Disponíveis</Label>
              </div>
              <div className="space-y-3">
                {Object.entries(AVAILABLE_VARIABLES).map(([category, info]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">{category}</div>
                    <div className="flex flex-wrap gap-2">
                      {info.variables.map((variable) => (
                        <Button
                          key={variable.name}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => copyVariable(variable.name)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {`{{${variable.name}}}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-background rounded border text-xs">
                <p className="font-semibold mb-1">Como usar:</p>
                <p className="text-muted-foreground">
                  Clique em uma variável acima para copiá-la. Cole no template usando o formato <code className="bg-muted px-1 rounded">{`{{nomeDaVariavel}}`}</code>.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Importante:</strong> Use <code className="bg-muted px-1 rounded">{`{{productsTable}}`}</code> para termos em lote - ela gera automaticamente uma tabela formatada.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingTemplate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {selectedTemplate ? 'Salvar Alterações' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

