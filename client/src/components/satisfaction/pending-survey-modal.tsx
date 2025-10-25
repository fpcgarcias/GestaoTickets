import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { SATISFACTION_SURVEY_MODAL_SESSION_KEY } from '@/constants/satisfaction';

type PendingSurvey = {
  id: number;
  survey_token: string;
  ticket_id: number;
  ticket_number: string | null;
  ticket_title: string | null;
  sent_at: string;
  expires_at: string;
  company: {
    id: number;
    name: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
  } | null;
};

interface PendingSatisfactionSurveysProps {
  enabled: boolean;
}

function getRatingLabel(rating: number) {
  switch (rating) {
    case 1:
      return 'Muito insatisfeito';
    case 2:
      return 'Insatisfeito';
    case 3:
      return 'Neutro';
    case 4:
      return 'Satisfeito';
    case 5:
      return 'Muito satisfeito';
    default:
      return 'Clique nas estrelas para avaliar';
  }
}

export const PendingSatisfactionSurveys: React.FC<PendingSatisfactionSurveysProps> = ({ enabled }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch } = useQuery<PendingSurvey[]>({
    queryKey: ['/api/satisfaction-surveys/pending'],
    enabled,
  });

  const surveys = useMemo(() => data ?? [], [data]);
  const totalSurveys = surveys.length;
  const currentSurvey = surveys[currentIndex];
  const commentIsRequired = rating === 1 || rating === 2;

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    if (!surveys.length) {
      setOpen(false);
      setRating(0);
      setComments('');
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= surveys.length) {
      setCurrentIndex(0);
    }

    // Se há pesquisas pendentes e o modal não está aberto, sempre abrir
    // (o sessionStorage é limpo no login, então sempre vai abrir após login)
    if (!open) {
      if (typeof window !== 'undefined') {
        const alreadyShown = window.sessionStorage.getItem(SATISFACTION_SURVEY_MODAL_SESSION_KEY);
        if (!alreadyShown) {
          window.sessionStorage.setItem(SATISFACTION_SURVEY_MODAL_SESSION_KEY, 'shown');
          setOpen(true);
        }
      }
    }
  }, [enabled, surveys, open, currentIndex]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOpen(false);
      setRating(0);
      setComments('');
    } else if (surveys.length > 0) {
      setOpen(true);
    }
  };

  const handleSkip = () => {
    setOpen(false);
    setRating(0);
    setComments('');
    // NÃO marcar como "shown" quando pular - permitir que apareça novamente no próximo login
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SATISFACTION_SURVEY_MODAL_SESSION_KEY);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentSurvey) {
      return;
    }

    if (rating === 0) {
      toast({
        title: 'avaliação obrigatoria',
        description: 'Selecione uma nota de 1 a 5 estrelas para concluir.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedComments = comments.trim();

    if (commentIsRequired && !normalizedComments) {
      toast({
        title: 'Comentario obrigatorio',
        description: 'Para avaliacoes de 1 ou 2 estrelas, explique brevemente o que aconteceu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiRequest('POST', `/api/satisfaction-surveys/${currentSurvey.survey_token}`, {
        rating,
        comments: normalizedComments ? normalizedComments : null,
      });

      await response.json();

      toast({
        title: 'Obrigado pela avaliação!',
        description: 'Sua resposta foi registrada com sucesso.',
      });

      const result = await refetch();
      const nextSurveys = result.data ?? [];

      if (!nextSurveys.length) {
        setOpen(false);
        setRating(0);
        setComments('');
        setCurrentIndex(0);
        return;
      }

      setRating(0);
      setComments('');
      setCurrentIndex(0);
    } catch (error: any) {
      const fallbackMessage = error?.errors?.[0]?.message ?? error?.message ?? 'Erro ao enviar avaliação.';
      toast({
        title: 'Nao foi possivel enviar sua avaliação',
        description: fallbackMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled || isLoading || !currentSurvey) {
    return null;
  }

  const ticketLabel = currentSurvey.ticket_number
    ? `Ticket #${currentSurvey.ticket_number}`
    : `Ticket ${currentSurvey.ticket_id}`;
  const ticketTitle = currentSurvey.ticket_title?.trim() || '';

  const expiresLabel = currentSurvey.expires_at
    ? new Date(currentSurvey.expires_at).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Voce tem uma pesquisa de satisfação pendente</DialogTitle>
          <DialogDescription>
            Sua opinião é muito importante para melhorarmos nosso atendimento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Que tal avaliar o atendimento deste chamado?
              </p>
              <p className="text-sm font-medium text-foreground mt-1">
                {ticketTitle || ticketLabel}
              </p>
              {ticketTitle && (
                <p className="text-xs text-muted-foreground">
                  {ticketLabel}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {currentSurvey.company?.name
                  ? `Esta pesquisa foi enviada por ${currentSurvey.company.name}.`
                  : 'Sua opiniao nos ajuda a melhorar cada atendimento.'}
              </p>
            </div>
            {totalSurveys > 1 && (
              <span className="text-xs font-medium text-muted-foreground border border-muted-foreground/30 rounded-full px-2 py-0.5">
                {currentIndex + 1} de {totalSurveys}
              </span>
            )}
          </div>

          <div className="text-center space-y-2">
            <Label className="text-base font-medium text-foreground">Avalie o atendimento</Label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => {
                const isActive = rating >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={cn(
                      'h-11 w-11 rounded-full border flex items-center justify-center transition-colors',
                      isActive
                        ? 'bg-yellow-400 border-yellow-400 text-yellow-900'
                        : 'border-border text-muted-foreground hover:border-yellow-400 hover:text-yellow-500'
                    )}
                    aria-label={`${value} estrelas`}
                  >
                    <Star className="h-5 w-5" fill={isActive ? 'currentColor' : 'none'} />
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{getRatingLabel(rating)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="satisfaction-comments" className="text-sm font-medium text-foreground">
              Comentarios {commentIsRequired ? '(obrigatorio)' : '(opcional)'}
            </Label>
            <Textarea
              id="satisfaction-comments"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder={
                commentIsRequired
                  ? 'Conte para nos o que aconteceu para que possamos melhorar.'
                  : 'Compartilhe um pouco mais sobre a sua experiencia.'
              }
              maxLength={1000}
              disabled={submitting}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{comments.length}/1000 caracteres</p>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Esta pesquisa expira em {expiresLabel}</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 gap-2">
            <Button type="button" variant="outline" onClick={handleSkip} disabled={submitting}>
              Responder depois
            </Button>
            <Button type="submit" disabled={submitting || rating === 0}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                'Enviar avaliação'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
