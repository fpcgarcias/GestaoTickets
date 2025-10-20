import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Zap, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

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
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-amber-400" />;
    case 'fallback':
      return <AlertCircle className="h-4 w-4 text-primary" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

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

const getPriorityColor = (priority: string) => {
  const normalizedPriority = priority.toLowerCase();
  switch (normalizedPriority) {
    case 'crítica':
    case 'critica':
    case 'critical':
      return 'bg-destructive/15 text-destructive';
    case 'alta':
    case 'high':
      return 'bg-amber-500/10 text-amber-500 dark:text-amber-300';
    case 'média':
    case 'media':
    case 'medium':
      return 'bg-primary/10 text-primary';
    case 'baixa':
    case 'low':
      return 'bg-emerald-500/10 text-emerald-400';
    default:
      return 'bg-muted/60 text-muted-foreground';
  }
};

const getAnalysisTypeColor = (type: string) => {
  switch (type) {
    case 'priority':
      return 'bg-primary/10 text-primary';
    case 'reopen':
      return 'bg-indigo-500/10 text-indigo-400 dark:text-indigo-300';
    default:
      return 'bg-muted/60 text-muted-foreground';
  }
};

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

export default function AiAnalysisHistory({ ticketId }: AiAnalysisHistoryProps) {
  const { user } = useAuth();
  
  // Verificar se o usuário é customer (para ocultar campos técnicos)
  const isCustomer = user!.role === 'customer';
  
  const { data: aiHistory, isLoading, error } = useQuery<AiAnalysisHistoryItem[]>({
    queryKey: [`/api/tickets/${ticketId}/ai-analysis-history`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tickets/${ticketId}/ai-analysis-history`);
      if (!response.ok) {
        throw new Error('Falha ao buscar histórico de análise de IA');
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
            Análise de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando...</span>
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
            Análise de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-destructive">
            Erro ao carregar histórico de análise de IA
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
            Análise de IA
          </CardTitle>
          <CardDescription>
            Histórico de análises de inteligência artificial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-muted-foreground">
            Nenhuma análise de IA encontrada para este ticket
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
          Análise de IA
        </CardTitle>
        <CardDescription>
          Histórico de análises de inteligência artificial
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

              {/* Resultado da análise */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {item.analysis_type === 'priority' ? 'Prioridade sugerida:' : 'Ação sugerida:'}
                </span>
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

              {/* Informações técnicas - ocultar para customers */}
              {!isCustomer && (
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
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
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 

