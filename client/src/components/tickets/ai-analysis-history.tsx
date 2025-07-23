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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
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
          <div className="text-center p-4 text-red-600">
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
          <div className="text-center p-4 text-gray-500">
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
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  {new Date(item.created_at).toLocaleString('pt-BR')}
                </div>
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
                  <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
                    {item.ai_justification}
                  </div>
                </div>
              )}

              {/* Informações técnicas - ocultar para customers */}
              {!isCustomer && (
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
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