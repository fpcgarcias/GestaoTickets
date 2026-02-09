import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, Loader2, MessageSquare, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FileUpload } from '@/components/tickets/file-upload';
import { useI18n } from '@/i18n';

type PendingWaitingTicket = {
  id: number;
  ticket_number: string;
  title: string;
  department_name: string | null;
  entered_waiting_at: string | null;
  auto_close_enabled: boolean;
  alert_sent_at: string | null;
  last_attendant_reply: {
    message: string;
    created_at: string;
    author_name: string | null;
  } | null;
};

interface PendingWaitingCustomerTicketsProps {
  enabled: boolean;
  onDone: () => void;
}

const MIN_MESSAGE_LENGTH = 10;

export const PendingWaitingCustomerTickets: React.FC<PendingWaitingCustomerTicketsProps> = ({ enabled, onDone }) => {
  const { toast } = useToast();
  const { formatMessage, locale } = useI18n();
  const [message, setMessage] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const onDoneCalledRef = useRef(false);

  const { data, isLoading, refetch } = useQuery<PendingWaitingTicket[]>({
    queryKey: ['/api/tickets/waiting-customer-pending'],
    enabled,
  });

  const tickets = data ?? [];
  const hasTickets = tickets.length > 0;
  const currentTicket = hasTickets ? tickets[Math.min(currentIndex, tickets.length - 1)] : null;

  // open é calculado, não um estado — elimina qualquer possibilidade de loop
  const isOpen = enabled && !isLoading && hasTickets && !dismissed;

  const fireOnDone = useCallback(() => {
    if (onDoneCalledRef.current) return;
    onDoneCalledRef.current = true;
    onDone();
  }, [onDone]);

  // Quando não tem tickets (ou terminou de carregar e veio vazio), avisa o dashboard
  useEffect(() => {
    if (!enabled) return;
    if (isLoading) return;
    if (!hasTickets) {
      fireOnDone();
    }
  }, [enabled, isLoading, hasTickets, fireOnDone]);

  // Quando o usuário fecha/dismisses, avisa o dashboard
  useEffect(() => {
    if (dismissed) {
      fireOnDone();
    }
  }, [dismissed, fireOnDone]);

  const handleDismiss = () => {
    setDismissed(true);
    setMessage('');
  };

  const handleSkip = () => {
    if (currentIndex < tickets.length - 1) {
      setCurrentIndex((i) => i + 1);
      setMessage('');
    } else {
      // Era o último, fecha tudo
      handleDismiss();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentTicket) return;

    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      toast({
        title: formatMessage('waiting_customer_modal.reply_too_short'),
        description: formatMessage('waiting_customer_modal.reply_min_chars', { min: MIN_MESSAGE_LENGTH }),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('POST', '/api/ticket-replies', {
        ticket_id: currentTicket.id,
        message: trimmed,
        status: 'waiting_customer',
      });
      toast({
        title: formatMessage('waiting_customer_modal.reply_sent'),
        description: formatMessage('waiting_customer_modal.reply_sent_desc'),
      });

      const result = await refetch();
      const nextList = result.data ?? [];

      if (nextList.length === 0) {
        handleDismiss();
        return;
      }
      setMessage('');
      setCurrentIndex(0);
    } catch (error: any) {
      const fallbackMessage = error?.errors?.[0]?.message ?? error?.message ?? 'Erro ao enviar resposta.';
      toast({
        title: formatMessage('waiting_customer_modal.reply_error'),
        description: fallbackMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !currentTicket) {
    return null;
  }

  const ticketLabel = currentTicket.ticket_number
    ? `Ticket #${currentTicket.ticket_number}`
    : `Ticket ${currentTicket.id}`;
  const ticketTitle = (currentTicket.title || '').trim();
  const totalTickets = tickets.length;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatMessage('waiting_customer_modal.title')}</DialogTitle>
          <DialogDescription>
            {formatMessage('waiting_customer_modal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {ticketTitle || ticketLabel}
              </p>
              {ticketTitle && (
                <p className="text-xs text-muted-foreground">{ticketLabel}</p>
              )}
              {currentTicket.department_name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatMessage('waiting_customer_modal.department')}: {currentTicket.department_name}
                </p>
              )}
            </div>
            {totalTickets > 1 && (
              <span className="text-xs font-medium text-muted-foreground border border-muted-foreground/30 rounded-full px-2 py-0.5 shrink-0">
                {formatMessage('waiting_customer_modal.counter', { current: currentIndex + 1, total: totalTickets })}
              </span>
            )}
          </div>

          {currentTicket.last_attendant_reply && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {formatMessage('waiting_customer_modal.last_attendant_message')}
                {currentTicket.last_attendant_reply.author_name && (
                  <span className="font-normal">
                    — {currentTicket.last_attendant_reply.author_name}
                    {currentTicket.last_attendant_reply.created_at &&
                      ` (${new Date(currentTicket.last_attendant_reply.created_at).toLocaleString(locale === 'en-US' ? 'en-US' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`}
                  </span>
                )}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-6">
                {currentTicket.last_attendant_reply.message}
              </p>
            </div>
          )}

          {currentTicket.auto_close_enabled && (
            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-sm">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formatMessage('waiting_customer_modal.auto_close_warning')}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waiting-customer-message" className="text-sm font-medium text-foreground">
                {formatMessage('waiting_customer_modal.reply_label')}
              </Label>
              <Textarea
                id="waiting-customer-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={formatMessage('waiting_customer_modal.reply_placeholder')}
                disabled={submitting}
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {formatMessage('waiting_customer_modal.reply_chars', { count: message.trim().length, min: MIN_MESSAGE_LENGTH })}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {formatMessage('waiting_customer_modal.attachments_label')}
              </Label>
              <FileUpload
                ticketId={currentTicket.id}
                onUploadSuccess={() => {
                  toast({
                    title: formatMessage('waiting_customer_modal.attachment_added'),
                    description: formatMessage('waiting_customer_modal.attachment_added_desc'),
                  });
                }}
                onUploadError={(err) => {
                  toast({ title: 'Erro ao anexar', description: err, variant: 'destructive' });
                }}
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleDismiss} disabled={submitting}>
                {formatMessage('waiting_customer_modal.respond_later')}
              </Button>
              <div className="flex gap-2">
                {totalTickets > 1 && (
                  <Button type="button" variant="outline" onClick={handleSkip} disabled={submitting}>
                    {formatMessage('waiting_customer_modal.skip')}
                  </Button>
                )}
                <Button type="submit" disabled={submitting || message.trim().length < MIN_MESSAGE_LENGTH}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {formatMessage('waiting_customer_modal.sending')}
                    </>
                  ) : (
                    formatMessage('waiting_customer_modal.send_reply')
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
