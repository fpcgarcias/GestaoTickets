import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  ThumbsUp, 
  ThumbsDown,
  Clock,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

interface AISuggestionCardProps {
  suggestion: AISuggestion;
  onFeedback?: (suggestionId: number, rating: number, comment?: string) => void;
}

export const AISuggestionCard: React.FC<AISuggestionCardProps> = ({ 
  suggestion, 
  onFeedback 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const { toast } = useToast();

  const handleFeedback = async (rating: number) => {
    if (isSubmittingFeedback) return;
    
    setIsSubmittingFeedback(true);
    try {
      await apiRequest('POST', `/api/ai-suggestions/${suggestion.id}/feedback`, {
        rating
      });
      
      toast({
        title: "Feedback registrado!",
        description: "Obrigado pelo seu feedback. Isso nos ajuda a melhorar o sistema.",
      });
      
      onFeedback?.(suggestion.id, rating);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível registrar o feedback. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-800";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return <CheckCircle className="h-4 w-4" />;
    if (confidence >= 60) return <AlertCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <h4 className="text-sm font-medium text-blue-900">Sugestão de Resolução</h4>
            <Badge variant="secondary" className="text-xs">
              {suggestion.similar_tickets_count} casos similares
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Métricas */}
        <div className="flex items-center gap-4 text-xs text-blue-700">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{suggestion.success_rate}% sucesso</span>
          </div>
          <div className="flex items-center gap-1">
            {getConfidenceIcon(suggestion.confidence)}
            <span className={getConfidenceColor(suggestion.confidence)}>
              {suggestion.confidence}% confiança
            </span>
          </div>
          {suggestion.suggestion.estimated_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{suggestion.suggestion.estimated_time}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Resumo */}
        <p className="text-sm text-gray-700 mb-4">
          {suggestion.suggestion.summary}
        </p>

        {/* Conteúdo expandido */}
        {isExpanded && (
          <div className="space-y-4">
            {/* Passo a passo */}
            {suggestion.suggestion.step_by_step && suggestion.suggestion.step_by_step.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Passo a passo:</h5>
                <div className="bg-white p-3 rounded border space-y-2">
                  {suggestion.suggestion.step_by_step.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comandos */}
            {suggestion.suggestion.commands && suggestion.suggestion.commands.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Comandos:</h5>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm space-y-1">
                  {suggestion.suggestion.commands.map((command, index) => (
                    <div key={index}>$ {command}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações adicionais */}
            {suggestion.suggestion.additional_notes && (
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Observações:</h5>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                  {suggestion.suggestion.additional_notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {!suggestion.feedback_rating && (
          <div className="flex items-center justify-between pt-4 border-t border-blue-200">
            <span className="text-xs text-blue-700">Esta sugestão foi útil?</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(5)}
                disabled={isSubmittingFeedback}
                className="h-7 px-2"
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Sim
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(1)}
                disabled={isSubmittingFeedback}
                className="h-7 px-2"
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Não
              </Button>
            </div>
          </div>
        )}

        {/* Feedback já dado */}
        {suggestion.feedback_rating && (
          <div className="pt-4 border-t border-blue-200">
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="h-3 w-3" />
              <span>
                Obrigado pelo feedback! 
                {suggestion.feedback_rating >= 4 ? ' Sua avaliação nos ajuda a melhorar.' : ' Vamos trabalhar para melhorar.'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
