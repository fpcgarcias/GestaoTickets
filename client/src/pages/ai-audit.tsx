import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Brain, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building2,
  TicketIcon
} from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface AiAnalysisAuditItem {
  id: number;
  ticket_id: number;
  suggested_priority: string;
  ai_justification: string;
  provider: string;
  model: string;
  processing_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'fallback';
  created_at: string;
  analysis_type: string;
  config_name: string;
  ticket_title: string;
  company_name: string;
}

interface AiAnalysisAuditResponse {
  data: AiAnalysisAuditItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function AiAuditPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    analysis_type: 'all',
    status: 'all',
    provider: 'all',
    start_date: '',
    end_date: '',
    ticket_id: '',
    company_id: ''
  });



  // Redirecionar se não tiver permissão
  React.useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'company_admin') {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar a auditoria de IA.",
        variant: "destructive",
      });
      window.location.href = '/';
    }
  }, [user, toast]);

  // Buscar dados de auditoria
  const { 
    data: auditData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<AiAnalysisAuditResponse>({
    queryKey: ['ai-audit', currentPage, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(filters.analysis_type && filters.analysis_type !== 'all' && { analysis_type: filters.analysis_type }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.provider && filters.provider !== 'all' && { provider: filters.provider }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
        ...(filters.ticket_id && { ticket_id: filters.ticket_id }),
        ...(filters.company_id && user?.role === 'admin' && { company_id: filters.company_id }),
      });

      const response = await apiRequest('GET', `/api/ai-analysis-audit?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar dados de auditoria');
      }
      return response.json();
    },
    enabled: user?.role === 'admin' || user?.role === 'company_admin',
  });

  // Função para obter ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'fallback':
      return <AlertCircle className="h-4 w-4 text-primary" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

  // Função para obter texto de status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      case 'timeout':
        return 'Timeout';
      case 'fallback':
        return 'Fallback';
      default:
        return 'Desconhecido';
    }
  };

  // Função para obter cor da prioridade
  const getPriorityColor = (priority: string) => {
    const normalizedPriority = priority.toLowerCase();
    switch (normalizedPriority) {
      case 'crítica':
      case 'critica':
      case 'critical':
        return 'bg-destructive/15 text-destructive';
      case 'alta':
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'média':
      case 'media':
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 dark:text-amber-300';
      case 'baixa':
      case 'low':
        return 'bg-emerald-500/10 text-emerald-400';
      default:
        return 'bg-muted/60 text-muted-foreground';
    }
  };

  // Função para obter cor do tipo de análise
  const getAnalysisTypeColor = (type: string) => {
    switch (type) {
      case 'priority':
        return 'bg-primary/10 text-primary';
      case 'reopen':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-muted/60 text-muted-foreground';
    }
  };

  // Função para obter texto do tipo de análise
  const getAnalysisTypeText = (type: string) => {
    switch (type) {
      case 'priority':
        return 'Prioridade';
      case 'reopen':
        return 'Reabertura';
      default:
        return type;
    }
  };

  // Função para limpar filtros
  const clearFilters = () => {
    setFilters({
      analysis_type: 'all',
      status: 'all',
      provider: 'all',
      start_date: '',
      end_date: '',
      ticket_id: '',
      company_id: ''
    });
    setCurrentPage(1);
  };

  // Se o usuário ainda não foi carregado, mostrar loading
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Se não tiver permissão, não renderizar nada
  if (user.role !== 'admin' && user.role !== 'company_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar a auditoria de IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Auditoria de Análises de IA</h1>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtre as análises de IA por diferentes critérios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo de Análise */}
            <div>
              <Label htmlFor="analysis_type">Tipo de Análise</Label>
              <Select 
                value={filters.analysis_type} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, analysis_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="priority">Análise de Prioridade</SelectItem>
                  <SelectItem value="reopen">Análise de Reabertura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provedor */}
            <div>
              <Label htmlFor="provider">Provedor</Label>
              <Select 
                value={filters.provider} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os provedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os provedores</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ID do Ticket */}
            <div>
              <Label htmlFor="ticket_id">ID do Ticket</Label>
              <Input
                id="ticket_id"
                placeholder="Ex: 123"
                value={filters.ticket_id}
                onChange={(e) => setFilters(prev => ({ ...prev, ticket_id: e.target.value }))}
              />
            </div>

            {/* Data Início */}
            <div>
              <Label htmlFor="start_date">Data Início</Label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            {/* Data Fim */}
            <div>
              <Label htmlFor="end_date">Data Fim</Label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>

            {/* Empresa (apenas para admin) */}
            {user?.role === 'admin' && (
              <div>
                <Label htmlFor="company_id">Empresa</Label>
                <Input
                  id="company_id"
                  placeholder="ID da empresa"
                  value={filters.company_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, company_id: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentPage(1);
                refetch();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1" />
              )}
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultados da Auditoria
            </div>
            {auditData && (
              <div className="text-sm text-muted-foreground">
                {auditData.pagination.total} registros encontrados
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive p-8">
              Erro ao carregar dados de auditoria
            </div>
          ) : auditData && auditData.data.length > 0 ? (
            <div className="space-y-4">
              {/* Indicador de filtros ativos */}
              {(filters.analysis_type || filters.status || filters.provider || filters.start_date || filters.end_date || filters.ticket_id || (filters.company_id && user?.role === 'admin')) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    Filtros ativos
                  </Badge>
                  {filters.analysis_type && (
                    <Badge variant="outline" className="text-xs">
                      Tipo: {getAnalysisTypeText(filters.analysis_type)}
                    </Badge>
                  )}
                  {filters.status && (
                    <Badge variant="outline" className="text-xs">
                      Status: {getStatusText(filters.status)}
                    </Badge>
                  )}
                  {filters.provider && (
                    <Badge variant="outline" className="text-xs">
                      Provedor: {filters.provider}
                    </Badge>
                  )}
                  {filters.ticket_id && (
                    <Badge variant="outline" className="text-xs">
                      Ticket: #{filters.ticket_id}
                    </Badge>
                  )}
                  {filters.company_id && user?.role === 'admin' && (
                    <Badge variant="outline" className="text-xs">
                      Empresa: {filters.company_id}
                    </Badge>
                  )}
                  {(filters.start_date || filters.end_date) && (
                    <Badge variant="outline" className="text-xs">
                      {filters.start_date && filters.end_date ? `${filters.start_date} → ${filters.end_date}` : filters.start_date || filters.end_date}
                    </Badge>
                  )}
                </div>
              )}

              {/* Lista de análises */}
              <div className="space-y-4">
                {auditData.data.map((item) => (
                  <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm font-medium">
                          {getStatusText(item.status)}
                        </span>
                        <Badge className={getAnalysisTypeColor(item.analysis_type)}>
                          {getAnalysisTypeText(item.analysis_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    {/* Informações do ticket */}
                    <div className="flex items-center gap-2">
                      <TicketIcon className="h-4 w-4 text-muted-foreground" />
                      <Link href={`/tickets/${item.ticket_id}`}>
                        <span className="text-sm text-primary hover:underline cursor-pointer">
                          Ticket #{item.ticket_id}
                        </span>
                      </Link>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {item.ticket_title || 'Sem título'}
                      </span>
                    </div>

                    {/* Empresa */}
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {item.company_name || 'Empresa não identificada'}
                      </span>
                    </div>

                    {/* Prioridade sugerida */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Prioridade sugerida:</span>
                      <Badge className={getPriorityColor(item.suggested_priority)}>
                        {item.suggested_priority}
                      </Badge>
                    </div>

                    {/* Justificativa */}
                    {item.ai_justification && (
                      <div>
                        <span className="text-sm font-medium">Justificativa:</span>
                        <div className="mt-1 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                          {item.ai_justification}
                        </div>
                      </div>
                    )}

                    {/* Informações técnicas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Provedor:</span> {item.provider}
                      </div>
                      <div>
                        <span className="font-medium">Modelo:</span> {item.model}
                      </div>
                      <div>
                        <span className="font-medium">Configuração:</span> {item.config_name || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        <span>{item.processing_time_ms}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {auditData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!auditData.pagination.hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm px-4">
                    Página {auditData.pagination.page} de {auditData.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!auditData.pagination.hasNext}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma análise de IA encontrada com os filtros aplicados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 

















