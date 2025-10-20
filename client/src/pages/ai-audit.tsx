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
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { formatDate } from '@/lib/utils';

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
  const { formatMessage, locale } = useI18n();
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
        title: formatMessage('ai_audit.access_denied'),
        description: formatMessage('ai_audit.access_denied_description'),
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
      // Converter datas do formato local para ISO
      const convertDateToISO = (dateStr: string) => {
        if (!dateStr || dateStr.length !== 10) return '';
        const parts = dateStr.split('/');
        if (locale === 'en-US') {
          // mm/dd/yyyy -> yyyy-mm-dd
          return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else {
          // dd/mm/yyyy -> yyyy-mm-dd
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      };

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(filters.analysis_type && filters.analysis_type !== 'all' && { analysis_type: filters.analysis_type }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.provider && filters.provider !== 'all' && { provider: filters.provider }),
        ...(filters.start_date && { start_date: convertDateToISO(filters.start_date) }),
        ...(filters.end_date && { end_date: convertDateToISO(filters.end_date) }),
        ...(filters.ticket_id && { ticket_id: filters.ticket_id }),
        ...(filters.company_id && user?.role === 'admin' && { company_id: filters.company_id }),
      });

      const response = await apiRequest('GET', `/api/ai-analysis-audit?${params}`);
      if (!response.ok) {
        throw new Error(formatMessage('ai_audit.load_data_error'));
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
        return formatMessage('ai_audit.success');
      case 'error':
        return formatMessage('ai_audit.error');
      case 'timeout':
        return formatMessage('ai_audit.timeout');
      case 'fallback':
        return formatMessage('ai_audit.fallback');
      default:
        return formatMessage('ai_audit.unknown');
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
        return formatMessage('ai_audit.priority');
      case 'reopen':
        return formatMessage('ai_audit.reopen');
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
        <span className="ml-2">{formatMessage('ai_audit.loading')}</span>
      </div>
    );
  }

  // Se não tiver permissão, não renderizar nada
  if (user.role !== 'admin' && user.role !== 'company_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">{formatMessage('ai_audit.access_denied')}</h2>
          <p className="text-muted-foreground">{formatMessage('ai_audit.access_denied_description')}</p>
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
          <h1 className="text-2xl font-bold">{formatMessage('ai_audit.title')}</h1>
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
          {formatMessage('ai_audit.refresh')}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {formatMessage('ai_audit.filters')}
          </CardTitle>
          <CardDescription>
            {formatMessage('ai_audit.filters_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo de Análise */}
            <div>
              <Label htmlFor="analysis_type">{formatMessage('ai_audit.analysis_type')}</Label>
              <Select 
                value={filters.analysis_type} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, analysis_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage('ai_audit.all_types')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage('ai_audit.all_types')}</SelectItem>
                  <SelectItem value="priority">{formatMessage('ai_audit.priority_analysis')}</SelectItem>
                  <SelectItem value="reopen">{formatMessage('ai_audit.reopen_analysis')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">{formatMessage('ai_audit.status')}</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage('ai_audit.all_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage('ai_audit.all_status')}</SelectItem>
                  <SelectItem value="success">{formatMessage('ai_audit.success')}</SelectItem>
                  <SelectItem value="error">{formatMessage('ai_audit.error')}</SelectItem>
                  <SelectItem value="timeout">{formatMessage('ai_audit.timeout')}</SelectItem>
                  <SelectItem value="fallback">{formatMessage('ai_audit.fallback')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provedor */}
            <div>
              <Label htmlFor="provider">{formatMessage('ai_audit.provider')}</Label>
              <Select 
                value={filters.provider} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage('ai_audit.all_providers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage('ai_audit.all_providers')}</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ID do Ticket */}
            <div>
              <Label htmlFor="ticket_id">{formatMessage('ai_audit.ticket_id')}</Label>
              <Input
                id="ticket_id"
                placeholder={formatMessage('ai_audit.ticket_id_placeholder')}
                value={filters.ticket_id}
                onChange={(e) => setFilters(prev => ({ ...prev, ticket_id: e.target.value }))}
              />
            </div>

            {/* Data Início */}
            <div>
              <Label htmlFor="start_date">{formatMessage('ai_audit.start_date')}</Label>
              <Input
                id="start_date"
                type="text"
                placeholder={locale === 'en-US' ? 'mm/dd/yyyy' : 'dd/mm/aaaa'}
                value={filters.start_date}
                onChange={(e) => {
                  let value = e.target.value;
                  // Aplicar máscara baseada no locale
                  if (locale === 'en-US') {
                    // Formato americano: mm/dd/yyyy
                    value = value.replace(/\D/g, '');
                    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                  } else {
                    // Formato brasileiro: dd/mm/aaaa
                    value = value.replace(/\D/g, '');
                    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                  }
                  setFilters(prev => ({ ...prev, start_date: value }));
                }}
              />
            </div>

            {/* Data Fim */}
            <div>
              <Label htmlFor="end_date">{formatMessage('ai_audit.end_date')}</Label>
              <Input
                id="end_date"
                type="text"
                placeholder={locale === 'en-US' ? 'mm/dd/yyyy' : 'dd/mm/aaaa'}
                value={filters.end_date}
                onChange={(e) => {
                  let value = e.target.value;
                  // Aplicar máscara baseada no locale
                  if (locale === 'en-US') {
                    // Formato americano: mm/dd/yyyy
                    value = value.replace(/\D/g, '');
                    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                  } else {
                    // Formato brasileiro: dd/mm/aaaa
                    value = value.replace(/\D/g, '');
                    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
                  }
                  setFilters(prev => ({ ...prev, end_date: value }));
                }}
              />
            </div>

            {/* Empresa (apenas para admin) */}
            {user?.role === 'admin' && (
              <div>
                <Label htmlFor="company_id">{formatMessage('ai_audit.company')}</Label>
                <Input
                  id="company_id"
                  placeholder={formatMessage('ai_audit.company_placeholder')}
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
              {formatMessage('ai_audit.clear_filters')}
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
              {formatMessage('ai_audit.apply_filters')}
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
              {formatMessage('ai_audit.audit_results')}
            </div>
            {auditData && (
              <div className="text-sm text-muted-foreground">
                {formatMessage('ai_audit.records_found', { count: auditData.pagination.total })}
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
              {formatMessage('ai_audit.error_loading_data')}
            </div>
          ) : auditData && auditData.data.length > 0 ? (
            <div className="space-y-4">
              {/* Indicador de filtros ativos */}
              {(filters.analysis_type || filters.status || filters.provider || filters.start_date || filters.end_date || filters.ticket_id || (filters.company_id && user?.role === 'admin')) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    {formatMessage('ai_audit.active_filters')}
                  </Badge>
                  {filters.analysis_type && (
                    <Badge variant="outline" className="text-xs">
                      {formatMessage('ai_audit.type')}: {getAnalysisTypeText(filters.analysis_type)}
                    </Badge>
                  )}
                  {filters.status && (
                    <Badge variant="outline" className="text-xs">
                      {formatMessage('ai_audit.status')}: {getStatusText(filters.status)}
                    </Badge>
                  )}
                  {filters.provider && (
                    <Badge variant="outline" className="text-xs">
                      {formatMessage('ai_audit.provider')}: {filters.provider}
                    </Badge>
                  )}
                  {filters.ticket_id && (
                    <Badge variant="outline" className="text-xs">
                      {formatMessage('ai_audit.ticket')}: #{filters.ticket_id}
                    </Badge>
                  )}
                  {filters.company_id && user?.role === 'admin' && (
                    <Badge variant="outline" className="text-xs">
                      {formatMessage('ai_audit.company')}: {filters.company_id}
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
                        {new Date(item.created_at).toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR')}
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
                        {item.ticket_title || formatMessage('ai_audit.no_title')}
                      </span>
                    </div>

                    {/* Empresa */}
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {item.company_name || formatMessage('ai_audit.company_not_identified')}
                      </span>
                    </div>

                    {/* Prioridade sugerida */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatMessage('ai_audit.suggested_priority')}:</span>
                      <Badge className={getPriorityColor(item.suggested_priority)}>
                        {item.suggested_priority}
                      </Badge>
                    </div>

                    {/* Justificativa */}
                    {item.ai_justification && (
                      <div>
                        <span className="text-sm font-medium">{formatMessage('ai_audit.justification')}:</span>
                        <div className="mt-1 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                          {item.ai_justification}
                        </div>
                      </div>
                    )}

                    {/* Informações técnicas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">{formatMessage('ai_audit.provider')}:</span> {item.provider}
                      </div>
                      <div>
                        <span className="font-medium">{formatMessage('ai_audit.model')}:</span> {item.model}
                      </div>
                      <div>
                        <span className="font-medium">{formatMessage('ai_audit.configuration')}:</span> {item.config_name || formatMessage('ai_audit.not_available')}
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
                    {formatMessage('ai_audit.previous')}
                  </Button>
                  <span className="text-sm px-4">
                    {formatMessage('ai_audit.page_of', { current: auditData.pagination.page, total: auditData.pagination.totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!auditData.pagination.hasNext}
                  >
                    {formatMessage('ai_audit.next')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              {formatMessage('ai_audit.no_analyses_found')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 

















