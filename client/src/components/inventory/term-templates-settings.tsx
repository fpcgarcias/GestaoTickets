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
  Monitor,
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
const AVAILABLE_VARIABLES: Record<string, { label: string; variables: Array<{ key: string; description: string }> }> = {
  empresa: {
    label: 'Dados da Empresa',
    variables: [
      { key: 'companyName', description: 'Nome da empresa' },
      { key: 'companyDocument', description: 'CNPJ formatado' },
      { key: 'companyCity', description: 'Cidade da empresa' },
    ]
  },
  usuario: {
    label: 'Dados do Usuário/Funcionário',
    variables: [
      { key: 'userName', description: 'Nome completo do funcionário' },
      { key: 'userEmail', description: 'E-mail do funcionário' },
      { key: 'userCpf', description: 'CPF formatado (ou "--" se não informado)' },
      { key: 'userPhone', description: 'Telefone (ou "--" se não informado)' },
    ]
  },
  alocacao: {
    label: 'Dados da Alocação',
    variables: [
      { key: 'assignmentId', description: 'ID da alocação' },
      { key: 'assignedDate', description: 'Data de alocação (dd/mm/yyyy)' },
      { key: 'expectedReturnDate', description: 'Data prevista de devolução' },
    ]
  },
  data: {
    label: 'Dados de Data',
    variables: [
      { key: 'today', description: 'Data atual completa (dd/mm/yyyy)' },
      { key: 'todayDay', description: 'Dia do mês (2 dígitos)' },
      { key: 'todayMonth', description: 'Nome do mês por extenso' },
      { key: 'todayYear', description: 'Ano (4 dígitos)' },
    ]
  },
  produto_unico: {
    label: 'Dados do Produto (Termo Único)',
    variables: [
      { key: 'productName', description: 'Nome do produto' },
      { key: 'productBrand', description: 'Marca do produto' },
      { key: 'productModel', description: 'Modelo do produto' },
      { key: 'productSerial', description: 'Número de série' },
      { key: 'productAsset', description: 'Número de patrimônio' },
    ]
  },
  produto_lote: {
    label: 'Dados dos Produtos (Termo em Lote)',
    variables: [
      { key: 'productsCount', description: 'Quantidade de produtos' },
      { key: 'productsList', description: 'Lista HTML de produtos (ul/li)' },
      { key: 'productsTable', description: 'Tabela HTML completa (EQUIPAMENTO / SERIAL NUMBER)' },
    ]
  },
  responsavel: {
    label: 'Dados do Responsável',
    variables: [
      { key: 'deliveryResponsibleName', description: 'Nome do responsável pela entrega' },
    ]
  },
};

export default function TermTemplatesSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<TermTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [previewMode, setPreviewMode] = useState<'code' | 'visual'>('visual');
  const [showVariablesDoc, setShowVariablesDoc] = useState(false);
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

  const handleNewTemplate = () => {
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

  const handleDeleteTemplate = (templateId: number) => {
    deleteTemplateMutation.mutate(templateId);
  };

  // Função para gerar dados de exemplo para preview
  const generateSampleData = () => {
    return {
      companyName: 'Empresa Exemplo LTDA',
      companyDocument: '12.345.678/0001-90',
      companyCity: 'Rio de Janeiro',
      userName: 'João Silva',
      userEmail: 'joao.silva@empresa.com',
      userCpf: '123.456.789-00',
      userPhone: '(21) 99999-9999',
      assignmentId: '123',
      assignedDate: '18/11/2025',
      expectedReturnDate: '18/11/2026',
      today: '18/11/2025',
      todayDay: '18',
      todayMonth: 'novembro',
      todayYear: '2025',
      productName: 'Notebook Dell Latitude',
      productBrand: 'Dell',
      productModel: 'Latitude 15 3550',
      productSerial: 'SN123456789',
      productAsset: 'PAT-001',
      productsCount: '1',
      productsList: '<ul><li>Notebook Dell Latitude - SN123456789</li></ul>',
      productsTable: `
        <table class="equipment-table">
          <thead>
            <tr>
              <th>EQUIPAMENTO</th>
              <th>SERIAL NUMBER</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Notebook Dell Latitude</td>
              <td>SN123456789</td>
            </tr>
          </tbody>
        </table>
      `,
      deliveryResponsibleName: 'Maria Santos',
    };
  };

  // Função para substituir variáveis no template
  const renderTemplateWithSampleData = (template: string): string => {
    if (!template || typeof template !== 'string') {
      return '';
    }
    
    const sampleData = generateSampleData();
    let rendered = template;
    
    // Substituir todas as variáveis
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    });
    
    return rendered;
  };

  const hasDefaultTemplate = templates?.some(t => t.is_default);

  const renderTemplatesList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Templates de Termos de Responsabilidade</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowVariablesDoc(true)}
          >
            Documentação de Variáveis
          </Button>

          <Button
            variant="outline"
            onClick={() => createDefaultTemplateMutation.mutate()}
            disabled={createDefaultTemplateMutation.isPending}
          >
            {createDefaultTemplateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {hasDefaultTemplate ? 'Recriando...' : 'Criando...'}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {hasDefaultTemplate ? 'Recriar Template Padrão' : 'Criar Template Padrão'}
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
                            className="text-destructive hover:text-destructive/90"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              {template.is_default ? (
                                <>
                                  <strong>Atenção:</strong> Você está prestes a excluir o template PADRÃO "{template.name}". 
                                  Tem certeza? Você pode recriá-lo usando o botão "Recriar Template Padrão".
                                </>
                              ) : (
                                <>Tem certeza que deseja excluir o template "{template.name}"? Esta ação não pode ser desfeita.</>
                              )}
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
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Templates de Termos de Responsabilidade</CardTitle>
          <CardDescription>
            Gerencie os templates usados para gerar termos de responsabilidade de equipamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderTemplatesList()}
        </CardContent>
      </Card>

      {/* Dialog para visualizar template */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>
                    {selectedTemplate.description || 'Visualização do template'}
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
              {previewMode === 'visual' ? (
                <div>
                  <Label className="font-medium">Preview do Template</Label>
                  <div className="mt-1 border border-border rounded-lg bg-card">
                    <div className="p-4 border-b bg-muted rounded-t-lg">
                      <div className="text-sm text-muted-foreground">
                        💡 Esta é uma pré-visualização com dados de exemplo. As variáveis serão substituídas pelos dados reais quando o termo for gerado.
                      </div>
                    </div>
                    <div 
                      className="p-4 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderTemplateWithSampleData(selectedTemplate.content)
                      }}
                    />
                  </div>
                  <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary">
                    💡 Este é um preview com dados de exemplo. As variáveis serão substituídas pelos dados reais quando o termo for gerado.
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="font-medium">Conteúdo HTML</Label>
                  <Textarea 
                    value={selectedTemplate.content} 
                    readOnly 
                    className="h-32 font-mono text-xs"
                  />
                </div>
              )}
              
              {/* Seção de Variáveis Disponíveis */}
              <div>
                <Label className="font-medium">Variáveis Disponíveis</Label>
                <div className="mt-1 p-3 bg-muted rounded border text-xs">
                  {(() => {
                    return (
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(AVAILABLE_VARIABLES).map(([category, info]) => {
                          if (info.variables.length === 0) return null;
                          
                          return (
                            <div key={category}>
                              <h4 className="font-medium text-muted-foreground mb-2">{info.label}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {info.variables.map((variable) => (
                                  <div key={variable.key} className="bg-card p-2 rounded border border-border">
                                    <code className="text-primary font-medium">
                                      {"{{"}{variable.key}{"}}"}
                                    </code>
                                    <div className="text-muted-foreground text-xs mt-1">
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
              Configure o template HTML para termos de responsabilidade
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
                <Label>Descrição</Label>
                <Input
                  value={templateForm.description || ''}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do template (opcional)"
                />
              </div>
            </div>

            <div>
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={templateForm.content || ''}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Template HTML com variáveis {{companyName}}, {{userName}}, etc."
                className="h-40 font-mono text-xs"
              />
              <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary">
                💡 Dica: Use variáveis como {'{{companyName}}'}, {'{{userName}}'}, {'{{productName}}'}, etc. Você pode ver um preview do template após salvá-lo.
              </div>
            </div>

            {/* Documentação de Variáveis Disponíveis */}
            <div className="border border-border rounded-lg p-4 bg-muted">
              <h4 className="font-medium text-foreground mb-3">
                📋 Variáveis Disponíveis
              </h4>
              <div className="max-h-32 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {Object.entries(AVAILABLE_VARIABLES).flatMap(([category, info]) =>
                    info.variables.map((variable) => {
                      return (
                        <div key={variable.key} className="bg-card p-2 rounded border border-border">
                          <code className="text-primary font-medium">
                            {"{{"}{variable.key}{"}}"}
                          </code>
                          {variable.description && (
                            <div className="text-muted-foreground text-xs mt-1">
                              {variable.description}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="template-active"
                checked={templateForm.is_active === true}
                onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="template-active">Template Ativo</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="template-default"
                checked={templateForm.is_default === true}
                onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_default: checked }))}
              />
              <Label htmlFor="template-default">Template Padrão</Label>
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
              Todas as variáveis disponíveis para uso nos templates de termos de responsabilidade
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {Object.entries(AVAILABLE_VARIABLES).map(([category, info]) => (
              <div key={category} className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 text-foreground">{info.label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {info.variables.map((variable) => (
                    <div key={variable.key} className="bg-muted p-3 rounded border">
                      <code className="text-primary font-bold text-sm">
                        {"{{"}{variable.key}{"}}"}
                      </code>
                      <div className="text-muted-foreground text-sm mt-2">
                        {variable.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="border border-border rounded-lg p-4 bg-primary/10">
              <h3 className="font-semibold text-lg mb-3 text-primary">💡 Dicas de Uso</h3>
              <ul className="text-sm text-primary space-y-1">
                <li>• Use as variáveis exatamente como mostrado, incluindo as chaves duplas</li>
                <li>• O sistema substitui automaticamente as variáveis pelos valores reais</li>
                <li>• Use o Preview para ver como o termo ficará com dados de exemplo</li>
                <li>• Variáveis não encontradas aparecerão como texto literal no termo</li>
                <li>• Use <code className="bg-muted px-1 rounded">{`{{productsTable}}`}</code> para termos em lote - ela gera automaticamente uma tabela formatada</li>
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
