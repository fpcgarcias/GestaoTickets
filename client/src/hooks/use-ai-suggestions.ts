import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import React from 'react';

interface AISuggestion {
  id: number;
  ticket_id: number;
  similar_tickets_count: number;
  success_rate: number;
  confidence: number;
  suggestion: {
    summary: string;
    confidence: number;
    step_by_step: string[];
    commands?: string[];
    additional_notes?: string;
    estimated_time?: string;
  };
  feedback_rating?: number;
  created_at: string;
}

interface AIConfig {
  is_active: boolean;
  has_config: boolean;
  model?: string;
  max_tokens?: number;
  reason?: string;
}

interface GenerateSuggestionRequest {
  ticket_id: number;
  user_id: number;
  department_id: number;
}

export const useAISuggestions = (ticketId: number, departmentId: number) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Buscar configuração de IA
  const { data: aiConfig, isLoading: isLoadingConfig } = useQuery<AIConfig>({
    queryKey: ['ai-config', departmentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        department_id: departmentId.toString(),
        analysis_type: 'ticket_suggestions'
      });
      const response = await apiRequest('GET', `/api/ai-configurations?${params.toString()}`);
      const data = await response.json();
      console.log('🔍 AI Config Response:', data);
      console.log('🔍 Response type:', typeof data);
      console.log('🔍 Is array:', Array.isArray(data));
      
      // A API retorna o array diretamente
      const configs = Array.isArray(data) ? data : [];
      const activeConfig = configs.find(config => config.is_active && config.analysis_type === 'ticket_suggestions');
      
      console.log('🔍 Active Config:', activeConfig);
      console.log('🔍 Configs found:', configs.length);
      console.log('🔍 All configs:', configs);
      
      return {
        is_active: !!activeConfig,
        has_config: !!activeConfig,
        model: activeConfig?.model,
        max_tokens: activeConfig?.max_tokens
      };
    },
    enabled: !!departmentId,
  });

  // Buscar histórico de sugestões - APENAS quando explicitamente solicitado
  const [shouldFetchSuggestions, setShouldFetchSuggestions] = useState(false);
  
  const { data: suggestions, isLoading: isLoadingHistory } = useQuery<AISuggestion[]>({
    queryKey: ['ai-suggestions', ticketId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ai-suggestions/ticket/${ticketId}`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!ticketId && shouldFetchSuggestions,
  });

  // Gerar nova sugestão
  const generateSuggestionMutation = useMutation({
    mutationFn: async (data: GenerateSuggestionRequest) => {
      const response = await apiRequest('POST', '/api/ai-suggestions', data);
      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      // Ativar busca de sugestões após gerar uma nova
      setShouldFetchSuggestions(true);
      
      toast({
        title: "Sugestão gerada!",
        description: `Encontramos ${data.similar_tickets_count} casos similares com ${data.success_rate}% de sucesso.`,
      });
      
      // Invalidar cache para recarregar o histórico
      queryClient.invalidateQueries({ 
        queryKey: ['ai-suggestions', ticketId] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar sugestão",
        description: error.message || "Não foi possível gerar a sugestão. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Registrar feedback
  const feedbackMutation = useMutation({
    mutationFn: async ({ 
      suggestionId, 
      rating, 
      comment 
    }: { 
      suggestionId: number; 
      rating: number; 
      comment?: string; 
    }) => {
      const response = await apiRequest('POST', `/api/ai-suggestions/${suggestionId}/feedback`, {
        rating,
        comment
      });
      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      // Invalidar cache para recarregar o histórico com feedback atualizado
      queryClient.invalidateQueries({ 
        queryKey: ['ai-suggestions', ticketId] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar feedback",
        description: error.message || "Não foi possível registrar o feedback.",
        variant: "destructive",
      });
    },
  });

  return {
    // Configuração
    aiConfig,
    isLoadingConfig,
    
    // Histórico
    suggestions: suggestions || [],
    isLoadingHistory,
    
    // Ações
    generateSuggestion: generateSuggestionMutation.mutate,
    isGenerating: generateSuggestionMutation.isPending,
    
    recordFeedback: feedbackMutation.mutate,
    isSubmittingFeedback: feedbackMutation.isPending,
    
    // Estados
    canUseAI: React.useMemo(() => {
      const allowedRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
      const canUse = !!user?.id && allowedRoles.includes(user.role) && (aiConfig?.is_active ?? false);
      console.log('🤖 canUseAI check:', { 
        user: user ? { id: user.id, role: user.role } : null, 
        aiConfig, 
        canUse,
        userRole: user?.role,
        isActive: aiConfig?.is_active
      });
      return canUse;
    }, [user, aiConfig]),
    hasSuggestions: (suggestions?.length ?? 0) > 0,
    latestSuggestion: suggestions?.[0],
  };
};
