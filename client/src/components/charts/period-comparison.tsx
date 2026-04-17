import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonArrow } from '@/components/ui/comparison-arrow';
import { cn } from '@/lib/utils';
import { TicketCheck, Clock, CheckCircle2, FileText } from 'lucide-react';
import type { PeriodMetrics } from '@shared/types/dashboard';

interface PeriodComparisonProps {
  current: PeriodMetrics;
  previous: PeriodMetrics | null;
  isLoading: boolean;
}

/**
 * Calcula o período anterior automaticamente com a mesma duração.
 * Ex: se o período atual é 01/01 a 31/01, o anterior é 01/12 a 31/12.
 */
export function computePreviousPeriod(startDate: Date, endDate: Date): { prevStartDate: Date; prevEndDate: Date } {
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1); // 1ms antes do início do período atual
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
  return { prevStartDate, prevEndDate };
}

function formatHours(hours: number): string {
  if (hours === 0 || isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return remaining > 0 ? `${days}d ${remaining.toFixed(0)}h` : `${days}d`;
}

function ComparisonSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 p-3 rounded-lg border bg-card">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  currentValue: number;
  previousValue: number | null;
  format: 'number' | 'time';
  displayValue: string;
}

function MetricItem({ icon, label, currentValue, previousValue, format, displayValue }: MetricItemProps) {
  return (
    <div className="p-3 rounded-lg border bg-card space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{displayValue}</span>
        {previousValue !== null && previousValue !== undefined && (
          <ComparisonArrow
            currentValue={currentValue}
            previousValue={previousValue}
            format={format}
          />
        )}
      </div>
    </div>
  );
}

export const PeriodComparison: React.FC<PeriodComparisonProps> = ({
  current,
  previous,
  isLoading,
}) => {
  const { formatMessage } = useI18n();

  if (isLoading) return <ComparisonSkeleton />;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MetricItem
        icon={<FileText className="h-3.5 w-3.5" />}
        label={formatMessage('dashboard.comparison.total_tickets')}
        currentValue={current.total}
        previousValue={previous?.total ?? null}
        format="number"
        displayValue={current.total.toLocaleString()}
      />
      <MetricItem
        icon={<TicketCheck className="h-3.5 w-3.5" />}
        label={formatMessage('dashboard.comparison.resolved')}
        currentValue={current.resolved}
        previousValue={previous?.resolved ?? null}
        format="number"
        displayValue={current.resolved.toLocaleString()}
      />
      <MetricItem
        icon={<Clock className="h-3.5 w-3.5" />}
        label={formatMessage('dashboard.comparison.avg_first_response')}
        currentValue={current.avg_first_response_hours}
        previousValue={previous?.avg_first_response_hours ?? null}
        format="time"
        displayValue={formatHours(current.avg_first_response_hours)}
      />
      <MetricItem
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label={formatMessage('dashboard.comparison.avg_resolution')}
        currentValue={current.avg_resolution_hours}
        previousValue={previous?.avg_resolution_hours ?? null}
        format="time"
        displayValue={formatHours(current.avg_resolution_hours)}
      />
    </div>
  );
};
