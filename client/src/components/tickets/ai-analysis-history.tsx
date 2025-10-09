import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Zap, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';

interface AiAnalysisHistoryItem {
  id: number;
  suggested_priority: string;
  ai_justification: string;
  provider: string;
  model: string;
  processing_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'fallback';
  created_at: string;
  config_name: string;
  analysis_type: string;
}

interface AiAnalysisHistoryProps {
  ticketId: number;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'fallback':
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusText = (status: string, formatMessage: any) => {
  switch (status) {
    case 'success':
      return formatMessage('ai_analysis.success');
    case 'error':
      return formatMessage('ai_analysis.error');
    case 'timeout':
      return formatMessage('ai_analysis.timeout');
    case 'fallback':
      return formatMessage('ai_analysis.fallback');
    default:
      return formatMessage('ai_analysis.unknown');
  }
};

const getPriorityColor = (priority: string) => {
  const normalizedPriority = priority.toLowerCase();
  switch (normalizedPriority) {
    case 'crítica':
    case 'critica':
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'alta':
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'média':
    case 'media':
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'baixa':
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getAnalysisTypeColor = (type: string) => {
  switch (type) {
    case 'priority':
      return 'bg-blue-100 text-blue-800';
    case 'reopen':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getAnalysisTypeText = (type: string, formatMessage: any) => {
  switch (type) {
    case 'priority':
      return formatMessage('ai_analysis.priority');
    case 'reopen':
      return formatMessage('ai_analysis.reopen');
    default:
      return type;
  }
};

export default function AiAnalysisHistory({ ticketId }: AiAnalysisHistoryProps) {
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  
  // Verificar se o usuário é customer (para ocultar campos técnicos)
  const isCustomer = user!.role === 'customer';
  
  const { data: aiHistory, isLoading, error } = useQuery<AiAnalysisHistoryItem[]>({
    queryKey: [`/api/tickets/${ticketId}/ai-analysis-history`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tickets/${ticketId}/ai-analysis-history`);
      if (!response.ok) {
        throw new Error(formatMessage('ai_analysis.failed_to_load'));
      }
      return response.json();
    },
    enabled: !!ticketId, // Buscar para todos os usuários
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {formatMessage('ai_analysis.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">{formatMessage('ai_analysis.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {formatMessage('ai_analysis.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-red-600">
            {formatMessage('ai_analysis.error_loading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiHistory?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {formatMessage('ai_analysis.title')}
          </CardTitle>
          <CardDescription>
            {formatMessage('ai_analysis.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-gray-500">
            {formatMessage('ai_analysis.no_analysis')}
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
            {formatMessage('ai_analysis.title')}
          </CardTitle>
          <CardDescription>
            {formatMessage('ai_analysis.description')}
          </CardDescription>
        </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {aiHistory?.map((item: AiAnalysisHistoryItem) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              {/* Cabeçalho com status e informações básicas */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(item.status)}
                  <span className="text-sm font-medium">
                    {getStatusText(item.status, formatMessage)}
                  </span>
                  <Badge className={getAnalysisTypeColor(item.analysis_type)}>
                    {getAnalysisTypeText(item.analysis_type, formatMessage)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  {new Date(item.created_at).toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: locale === 'en-US'
                  })}
                </div>
              </div>

              {/* Resultado da análise */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {item.analysis_type === 'priority' ? formatMessage('ai_analysis.suggested_priority') : formatMessage('ai_analysis.suggested_action')}
                </span>
                <Badge className={getPriorityColor(item.suggested_priority)}>
                  {item.suggested_priority}
                </Badge>
              </div>

              {/* Justificativa */}
              {item.ai_justification && (
                <div>
                  <span className="text-sm font-medium">{formatMessage('ai_analysis.justification')}</span>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
                    {item.ai_justification}
                  </div>
                </div>
              )}

              {/* Informações técnicas - ocultar para customers */}
              {!isCustomer && (
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">{formatMessage('ai_analysis.provider')}</span> {item.provider}
                  </div>
                  <div>
                    <span className="font-medium">{formatMessage('ai_analysis.model')}</span> {item.model}
                  </div>
                  <div>
                    <span className="font-medium">{formatMessage('ai_analysis.configuration')}</span> {item.config_name || 'N/A'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span>{item.processing_time_ms}ms</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 