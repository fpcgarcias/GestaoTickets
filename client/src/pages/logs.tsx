import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  HardDrive,
  Activity,
  AlertTriangle,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  BarChart3
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { formatBytes, formatDate } from '@/lib/utils';

interface LogFile {
  name: string;
  size: number;
  modified: Date;
  type: 'combined' | 'error' | 'performance' | 'security';
  version?: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  details?: any;
}

interface LogContent {
  entries: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  fileInfo: {
    name: string;
    size: number;
    modified: Date;
    totalLines: number;
  };
}

interface LogStats {
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
  recentActivity: Array<{
    name: string;
    modified: Date;
    size: number;
  }>;
}

export default function LogsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Redirecionar se não for admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar os logs do sistema.",
        variant: "destructive",
      });
      // Redirecionar para dashboard
      window.location.href = '/';
    }
  }, [user, toast]);

  // Buscar lista de arquivos de log
  const { 
    data: logFiles, 
    isLoading: isLoadingFiles, 
    refetch: refetchFiles 
  } = useQuery<LogFile[]>({
    queryKey: ['logs', 'files'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/logs");
      if (!response.ok) {
        throw new Error('Falha ao carregar arquivos de log');
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Buscar estatísticas dos logs
  const { 
    data: logStats, 
    isLoading: isLoadingStats 
  } = useQuery<LogStats>({
    queryKey: ['logs', 'stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/logs/stats");
      if (!response.ok) {
        throw new Error('Falha ao carregar estatísticas');
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
  });

  // Buscar conteúdo do arquivo selecionado
  const { 
    data: logContent, 
    isLoading: isLoadingContent,
    refetch: refetchContent 
  } = useQuery<LogContent>({
    queryKey: ['logs', 'content', selectedFile, currentPage, searchTerm, levelFilter, startDate, endDate],
    queryFn: async () => {
      if (!selectedFile) throw new Error('Nenhum arquivo selecionado');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '1000',
        ...(searchTerm && { search: searchTerm }),
        ...(levelFilter && levelFilter !== 'all' && { level: levelFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await apiRequest("GET", `/api/logs/${selectedFile}?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar conteúdo do log');
      }
      
      return response.json();
    },
    enabled: !!selectedFile && user?.role === 'admin',
  });

  // Função para fazer download do arquivo
  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`/api/logs/${filename}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Falha ao fazer download');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: `Arquivo ${filename} está sendo baixado.`,
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível fazer o download do arquivo.",
        variant: "destructive",
      });
    }
  };

  // Função para obter ícone baseado no tipo de log
  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'performance': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'security': return <HardDrive className="h-4 w-4 text-orange-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // Função para obter cor do nível de log
  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'WARN': return 'bg-yellow-100 text-yellow-800';
      case 'INFO': return 'bg-blue-100 text-blue-800';
      case 'DEBUG': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Se não for admin, não renderizar nada
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Logs do Sistema</h1>
        </div>
        <Button 
          onClick={() => refetchFiles()} 
          variant="outline" 
          size="sm"
          disabled={isLoadingFiles}
        >
          {isLoadingFiles ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="files" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Arquivos de Log
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Lista de arquivos */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Arquivos Disponíveis
                  </CardTitle>
                  <CardDescription>
                    Selecione um arquivo para visualizar seu conteúdo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : logFiles && logFiles.length > 0 ? (
                    logFiles.map((file) => (
                      <div
                        key={file.name}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFile === file.name
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedFile(file.name);
                          setCurrentPage(1);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getLogIcon(file.type)}
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatBytes(file.size)} • {formatDate(file.modified)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.name);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      Nenhum arquivo de log encontrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Visualização do conteúdo */}
            <div className="lg:col-span-2">
              {selectedFile ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {selectedFile}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(selectedFile)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {logContent?.fileInfo && (
                        <div className="flex items-center gap-4 text-sm">
                          <span>{formatBytes(logContent.fileInfo.size)}</span>
                          <span>•</span>
                          <span>{logContent.fileInfo.totalLines.toLocaleString()} linhas</span>
                          <span>•</span>
                          <span>Modificado em {formatDate(logContent.fileInfo.modified)}</span>
                        </div>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filtros */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="search">Buscar</Label>
                          <Input
                            id="search"
                            placeholder="Buscar no log..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="level">Nível</Label>
                          <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos os níveis" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os níveis</SelectItem>
                              <SelectItem value="ERROR">Error</SelectItem>
                              <SelectItem value="WARN">Warning</SelectItem>
                              <SelectItem value="INFO">Info</SelectItem>
                              <SelectItem value="DEBUG">Debug</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="startDate">Data Início</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate">Data Fim</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {/* Botões de ação */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm('');
                            setLevelFilter('all');
                            setStartDate('');
                            setEndDate('');
                            setCurrentPage(1);
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Limpar Filtros
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchContent()}
                          disabled={isLoadingContent}
                        >
                          {isLoadingContent ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 mr-1" />
                          )}
                          Aplicar Filtros
                        </Button>
                      </div>
                    </div>

                    {/* Conteúdo do log */}
                    {isLoadingContent ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : logContent ? (
                      <div className="space-y-4">
                        {/* Paginação superior */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <p className="text-sm text-gray-500">
                              Mostrando {logContent.entries.length} de {logContent.pagination.total} entradas
                            </p>
                            
                            {/* Indicador de filtros ativos */}
                            {(searchTerm || levelFilter !== 'all' || startDate || endDate) && (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  <Filter className="h-3 w-3 mr-1" />
                                  Filtros ativos
                                </Badge>
                                {searchTerm && (
                                  <Badge variant="outline" className="text-xs">
                                    Busca: "{searchTerm}"
                                  </Badge>
                                )}
                                {levelFilter !== 'all' && (
                                  <Badge variant="outline" className="text-xs">
                                    Nível: {levelFilter}
                                  </Badge>
                                )}
                                {(startDate || endDate) && (
                                  <Badge variant="outline" className="text-xs">
                                    {startDate && endDate ? `${startDate} → ${endDate}` : startDate || endDate}
                                    <span className="ml-1 text-gray-500">
                                      ({startDate && endDate ? 'Período' : startDate ? 'A partir de' : 'Até'})
                                    </span>
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={!logContent.pagination.hasPrev}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">
                              Página {logContent.pagination.page} de {logContent.pagination.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={!logContent.pagination.hasNext}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Entradas do log */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="max-h-[600px] overflow-y-auto">
                            {logContent.entries.map((entry, index) => {
                              // Tentar extrair informações estruturadas da mensagem
                              let formattedMessage = entry.message;
                              let messageDetails: any = null;
                              
                              // Se a mensagem é JSON, tentar parsear
                              try {
                                if (entry.message.trim().startsWith('{') && entry.message.trim().endsWith('}')) {
                                  const parsed = JSON.parse(entry.message);
                                  messageDetails = parsed;
                                  
                                  // Formatar a mensagem de forma mais limpa
                                  if (parsed.message) {
                                    formattedMessage = parsed.message;
                                  }
                                }
                              } catch (e) {
                                // Se não for JSON válido, usar a mensagem original
                              }
                              
                              return (
                                <div
                                  key={index}
                                  className="p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-start gap-3">
                                    <Badge className={`${getLevelColor(entry.level)} font-medium`}>
                                      {entry.level}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                        <Clock className="h-3 w-3" />
                                        <span className="font-mono">
                                          {entry.timestamp ? entry.timestamp : 'Sem timestamp'}
                                        </span>
                                      </div>
                                      
                                      {/* Mensagem formatada */}
                                      <div className="text-sm leading-relaxed">
                                        {messageDetails ? (
                                          <div className="space-y-2">
                                            {/* Mensagem principal */}
                                            <div className="text-gray-900 font-medium">
                                              {formattedMessage}
                                            </div>
                                            
                                            {/* Detalhes adicionais se houver */}
                                            {messageDetails.level && messageDetails.level !== entry.level && (
                                              <div className="text-xs text-gray-600">
                                                Nível interno: {messageDetails.level}
                                              </div>
                                            )}
                                            
                                            {/* Outros campos JSON se houver */}
                                            {Object.keys(messageDetails).length > 3 && (
                                              <details className="mt-2">
                                                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                                                  Ver detalhes técnicos
                                                </summary>
                                                <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                                  {JSON.stringify(messageDetails, null, 2)}
                                                </pre>
                                              </details>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-gray-900">
                                            {formattedMessage}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Paginação inferior */}
                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={!logContent.pagination.hasPrev}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Anterior
                            </Button>
                            <span className="text-sm px-4">
                              Página {logContent.pagination.page} de {logContent.pagination.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={!logContent.pagination.hasNext}
                            >
                              Próxima
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        Selecione um arquivo para visualizar seu conteúdo
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecione um arquivo de log para visualizar seu conteúdo</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Estatísticas dos Logs
              </CardTitle>
              <CardDescription>
                Visão geral dos arquivos de log do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : logStats ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium">Total de Arquivos</h3>
                    </div>
                    <p className="text-2xl font-bold mt-2">{logStats.totalFiles}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-green-500" />
                      <h3 className="font-medium">Tamanho Total</h3>
                    </div>
                    <p className="text-2xl font-bold mt-2">{formatBytes(logStats.totalSize)}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-orange-500" />
                      <h3 className="font-medium">Tipos de Log</h3>
                    </div>
                    <p className="text-2xl font-bold mt-2">{Object.keys(logStats.fileTypes).length}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-purple-500" />
                      <h3 className="font-medium">Atividade Recente</h3>
                    </div>
                    <p className="text-2xl font-bold mt-2">{logStats.recentActivity.length}</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Não foi possível carregar as estatísticas
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 