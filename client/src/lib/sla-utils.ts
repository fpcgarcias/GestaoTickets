import { useI18n } from '@/i18n';

/**
 * Utilitários para formatação de SLA com suporte a tradução
 */
export const useSLAFormatting = () => {
  const { formatMessage } = useI18n();

  const formatTimeRemaining = (hours: number): string => {
    if (hours < 0) {
      const overdue = Math.abs(hours);
      if (overdue < 1) {
        return `${Math.round(overdue * 60)}min ${formatMessage('tickets.sla.overdue')}`;
      }
      return `${Math.round(overdue)}h ${formatMessage('tickets.sla.overdue')}`;
    }

    if (hours < 1) {
      return `${Math.round(hours * 60)}min ${formatMessage('tickets.sla.remaining')}`;
    }

    if (hours < 24) {
      return `${Math.round(hours)}h ${formatMessage('tickets.sla.remaining')}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h ${formatMessage('tickets.sla.remaining')}`;
  };

  return {
    formatTimeRemaining
  };
};
