import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Upload, Download, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Company {
  id: number;
  name: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
  skipped: number;
  total: number;
}

export default function BulkImportDialog({ open, onOpenChange, onImported }: BulkImportDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<number>(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Buscar lista de empresas (apenas para admin)
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === 'admin',
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é CSV ou Excel
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo CSV ou Excel (.csv, .xls, .xlsx)',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const downloadTemplate = () => {
    // Criar CSV template baseado no Users.csv
    const headers = [
      'email',
      'name',
      'phone',
      'password',
      'active',
      'ad_user'
    ];
    
    const csvContent = [
      headers.join(';'),
      'exemplo@empresa.com;Nome do Usuario;(11) 99999-9999;123Mudar;true;false'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_importacao_clientes.csv';
    link.click();
    
    toast({
      title: 'Template baixado',
      description: 'Use este arquivo como base para importar seus clientes',
    });
  };

  const importMutation = useMutation({
    mutationFn: async ({ file, companyId }: { file: File; companyId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', companyId.toString());

      const res = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao importar arquivo');
      }

      return res.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      if (result.errors.length === 0) {
        toast({
          title: 'Importação concluída',
          description: `${result.success} clientes importados com sucesso!`,
        });
      } else {
        toast({
          title: 'Importação concluída com avisos',
          description: `${result.success} clientes importados, ${result.errors.length} com erro`,
          variant: 'default',
        });
      }
      
      if (onImported) onImported();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleImport = () => {
    if (!selectedFile) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo para importar',
        variant: 'destructive',
      });
      return;
    }

    if (!companyId) {
      toast({
        title: 'Empresa não selecionada',
        description: 'Por favor, selecione uma empresa para vincular os clientes',
        variant: 'destructive',
      });
      return;
    }

    importMutation.mutate({ file: selectedFile, companyId });
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCompanyId(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  // Só mostrar para admins
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importação em Lote de Clientes</DialogTitle>
          <DialogDescription>
            Importe múltiplos clientes de uma vez usando um arquivo CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Passo 1: Baixar Template</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Baixe o arquivo modelo para preencher com os dados dos clientes
              </p>
              <Button onClick={downloadTemplate} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Baixar Template CSV
              </Button>
            </CardContent>
          </Card>

          {/* File Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Passo 2: Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Arquivo CSV/Excel</Label>
                <Input
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
              </div>
              
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Passo 3: Selecionar Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select 
                  value={companyId.toString()} 
                  onValueChange={(value) => setCompanyId(parseInt(value))}
                  disabled={isLoadingCompanies}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa para vincular os clientes" />
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
            </CardContent>
          </Card>

          {/* Import Results */}
          {importResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Resultado da Importação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Badge variant="outline" className="text-green-600">
                    ✓ {importResult.success} Criados
                  </Badge>
                  {importResult.skipped > 0 && (
                    <Badge variant="outline" className="text-blue-600">
                      ⏭ {importResult.skipped} Ignorados
                    </Badge>
                  )}
                  {importResult.errors.length > 0 && (
                    <Badge variant="destructive">
                      ✗ {importResult.errors.length} Erros
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    📊 {importResult.total} Total
                  </Badge>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-600">Registros com erro:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResult.errors.map((error, index) => (
                        <Alert key={index} variant="destructive" className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <strong>Linha {error.row}:</strong> {error.email} - {error.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Formato do arquivo:</strong> Use ponto e vírgula (;) como separador. 
              Campos obrigatórios: email, name. Usuários já existentes serão ignorados (não causarão erro).
              Se não informar senha, uma será gerada automaticamente.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {importResult ? 'Fechar' : 'Cancelar'}
            </Button>
            {!importResult && (
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || !companyId || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Clientes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 