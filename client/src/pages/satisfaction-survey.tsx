import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Star, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface SurveyData {
  survey: {
    id: number;
    ticket_id: number;
    customer_email: string;
    sent_at: string;
    expires_at: string;
    status: string;
  };
  company: {
    name: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    domain?: string;
  } | null;
}

interface AlreadyRespondedData {
  message: string;
  already_responded: boolean;
  response: {
    rating: number;
    comments: string | null;
    responded_at: string;
  };
}

const SatisfactionSurvey: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyResponded, setAlreadyResponded] = useState<AlreadyRespondedData | null>(null);

  // Carregar dados da pesquisa
  useEffect(() => {
    const loadSurveyData = async () => {
      if (!token) {
        setError('Token de pesquisa não fornecido');
        setLoading(false);
        return;
      }

      try {
        console.log(`[🎯 SATISFACTION] Carregando dados da pesquisa: ${token}`);
        
        const response = await fetch(`/api/satisfaction-surveys/${token}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setError('Pesquisa de satisfação não encontrada');
          } else if (response.status === 410) {
            setError('Esta pesquisa de satisfação expirou');
          } else if (response.status === 409 && data.already_responded) {
            setAlreadyResponded(data);
          } else {
            setError(data.message || 'Erro ao carregar pesquisa');
          }
          setLoading(false);
          return;
        }

        setSurveyData(data);
        
        // Aplicar cores da empresa se disponível
        if (data.company?.colors) {
          const colors = data.company.colors;
          document.documentElement.style.setProperty('--survey-primary', colors.primary);
          document.documentElement.style.setProperty('--survey-secondary', colors.secondary);
          document.documentElement.style.setProperty('--survey-accent', colors.accent);
          document.documentElement.style.setProperty('--survey-background', colors.background);
          document.documentElement.style.setProperty('--survey-text', colors.text);
        }

        console.log(`[🎯 SATISFACTION] Dados carregados com sucesso`);
        
      } catch (error) {
        console.error('[🎯 SATISFACTION] Erro ao carregar pesquisa:', error);
        setError('Erro ao conectar com o servidor');
      } finally {
        setLoading(false);
      }
    };

    loadSurveyData();
  }, [token]);

  // Enviar resposta da pesquisa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast({
        title: 'Avaliação obrigatória',
        description: 'Por favor, selecione uma avaliação de 1 a 5 estrelas.',
        variant: 'destructive',
      });
      return;
    }

    // Validar comentário obrigatório para avaliações baixas (1 ou 2 estrelas)
    if ((rating === 1 || rating === 2) && (!comments || comments.trim() === '')) {
      toast({
        title: 'Comentário obrigatório',
        description: 'Para avaliações de 1 ou 2 estrelas, é necessário deixar um comentário explicando o motivo.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log(`[🎯 SATISFACTION] Enviando resposta: ${rating} estrelas`);
      
      const response = await fetch(`/api/satisfaction-surveys/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          comments: comments.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.already_responded) {
          setAlreadyResponded(data);
        } else {
          throw new Error(data.message || 'Erro ao enviar resposta');
        }
        return;
      }

      console.log(`[🎯 SATISFACTION] Resposta enviada com sucesso`);
      setSubmitted(true);
      
      toast({
        title: 'Obrigado pela sua avaliação!',
        description: 'Sua opinião é muito importante para nós.',
      });

    } catch (error) {
      console.error('[🎯 SATISFACTION] Erro ao enviar resposta:', error);
      toast({
        title: 'Erro ao enviar avaliação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Renderizar estrelas para avaliação
  const renderStars = () => {
    return (
      <div className="flex gap-2 justify-center my-6">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
              star <= rating
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 hover:text-gray-400'
            }`}
            disabled={submitting}
          >
            <Star
              size={32}
              fill={star <= rating ? 'currentColor' : 'none'}
              className="drop-shadow-sm"
            />
          </button>
        ))}
      </div>
    );
  };

  // Texto da avaliação baseado na nota
  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Muito insatisfeito';
      case 2: return 'Insatisfeito';
      case 3: return 'Neutro';
      case 4: return 'Satisfeito';
      case 5: return 'Muito satisfeito';
      default: return 'Clique nas estrelas para avaliar';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Carregando pesquisa...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Ops!</h2>
            <p className="text-gray-600 text-center mb-6">{error}</p>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline"
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already responded state
  if (alreadyResponded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-blue-200">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <CardTitle className="text-xl text-gray-900">
              {surveyData?.company?.name || 'Sistema de Tickets'}
            </CardTitle>
            <CardDescription>Pesquisa já respondida</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Você já respondeu esta pesquisa em{' '}
                {new Date(alreadyResponded.response.responded_at).toLocaleDateString('pt-BR')}
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-2">Sua avaliação:</p>
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={20}
                      fill={star <= alreadyResponded.response.rating ? '#FCD34D' : 'none'}
                      className={star <= alreadyResponded.response.rating ? 'text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {getRatingText(alreadyResponded.response.rating)}
                </p>
                {alreadyResponded.response.comments && (
                  <p className="text-xs text-gray-600 mt-2 italic">
                    "{alreadyResponded.response.comments}"
                  </p>
                )}
              </div>
            </div>
            
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline" 
              className="w-full"
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Obrigado pela sua avaliação!
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Sua opinião é muito importante para {surveyData?.company?.name || 'nós'}.
              Ela nos ajuda a melhorar continuamente nossos serviços.
            </p>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline"
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main survey form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-gray-900">
            {surveyData?.company?.name || 'Sistema de Tickets'}
          </CardTitle>
          <CardDescription className="text-lg">
            Como foi seu atendimento?
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating Section */}
            <div className="text-center">
              <Label className="text-lg font-medium text-gray-900 mb-4 block">
                Avalie nosso atendimento
              </Label>
              
              {renderStars()}
              
              <p className="text-sm text-gray-600 mt-2">
                {getRatingText(rating)}
              </p>
            </div>

            {/* Comments Section */}
            <div className="space-y-2">
              <Label htmlFor="comments" className="text-base font-medium text-gray-900">
                Comentários {(rating === 1 || rating === 2) ? '(obrigatório)' : '(opcional)'}
              </Label>
              <Textarea
                id="comments"
                placeholder={
                  (rating === 1 || rating === 2) 
                    ? "Por favor, explique o motivo da sua avaliação para que possamos melhorar..." 
                    : "Conte-nos mais sobre sua experiência..."
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={1000}
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 text-right">
                {comments.length}/1000 caracteres
              </p>
            </div>

            {/* Survey Info */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Clock size={16} />
                <span>
                  Esta pesquisa expira em{' '}
                  {surveyData?.survey.expires_at && 
                    new Date(surveyData.survey.expires_at).toLocaleDateString('pt-BR')
                  }
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={submitting || rating === 0}
              style={{ 
                backgroundColor: surveyData?.company?.colors.primary || '#3B82F6',
                borderColor: surveyData?.company?.colors.primary || '#3B82F6'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                'Enviar Avaliação'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SatisfactionSurvey;
