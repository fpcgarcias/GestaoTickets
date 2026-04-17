import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FunnelChartProps {
  data: { status: string; count: number }[];
  isLoading: boolean;
  onStageClick?: (status: string) => void;
}

const STATUS_ORDER = ['new', 'ongoing', 'resolved', 'closed'];

const STATUS_COLORS: Record<string, string> = {
  new: '#F59E0B',
  ongoing: '#3B82F6',
  resolved: '#10B981',
  closed: '#6B7280',
};

const STATUS_I18N_KEYS: Record<string, string> = {
  new: 'dashboard.funnel.status_new',
  ongoing: 'dashboard.funnel.status_ongoing',
  resolved: 'dashboard.funnel.status_resolved',
  closed: 'dashboard.funnel.status_closed',
};

/** Limiar de largura (%) abaixo do qual o label sai pra fora da barra */
const LABEL_OUTSIDE_THRESHOLD = 30;

function FunnelSkeleton() {
  return (
    <div className="w-full space-y-3 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" style={{ maxWidth: `${100 - i * 15}%` }} />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function FunnelEmpty({ message }: { message: string }) {
  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <p className="text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, isLoading, onStageClick }) => {
  const { formatMessage } = useI18n();

  const stages = useMemo(() => {
    const countMap: Record<string, number> = {};
    if (data) {
      data.forEach(d => { countMap[d.status] = d.count; });
    }

    return STATUS_ORDER.map((status, index) => {
      const count = countMap[status] ?? 0;
      const prevCount = index > 0 ? (countMap[STATUS_ORDER[index - 1]] ?? 0) : 0;
      const conversionRate = index === 0 ? 100 : (prevCount > 0 ? (count / prevCount) * 100 : 0);
      return { status, count, conversionRate };
    });
  }, [data]);

  if (isLoading) return <FunnelSkeleton />;

  const hasData = data && data.length > 0 && data.some(d => d.count > 0);
  if (!hasData) {
    return <FunnelEmpty message={formatMessage('dashboard.funnel.no_data')} />;
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="w-full space-y-2 py-1">
      {stages.map((stage, index) => {
        const widthPercent = Math.max(10, (stage.count / maxCount) * 100);
        const color = STATUS_COLORS[stage.status] ?? '#6B7280';
        const labelOutside = widthPercent < LABEL_OUTSIDE_THRESHOLD;
        const label = formatMessage(STATUS_I18N_KEYS[stage.status]);

        return (
          <div key={stage.status}>
            {/* Conversion arrow between stages */}
            {index > 0 && (
              <div className="flex items-center gap-2 py-1 pl-4">
                <svg className="w-4 h-4 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stage.conversionRate.toFixed(1)}%
                </span>
              </div>
            )}

            {/* Stage bar */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="h-10 rounded-md flex items-center px-3 transition-all duration-500 flex-shrink-0"
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: color,
                          opacity: 0.85,
                          cursor: onStageClick ? 'pointer' : 'default',
                        }}
                        onClick={() => onStageClick?.(stage.status)}
                        role={onStageClick ? 'button' : undefined}
                        tabIndex={onStageClick ? 0 : undefined}
                        onKeyDown={onStageClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(stage.status); } } : undefined}
                        aria-label={`${label}: ${stage.count}`}
                      >
                        {/* Label dentro da barra — só se couber */}
                        {!labelOutside && (
                          <span className="text-white text-sm font-medium truncate">
                            {label}
                          </span>
                        )}
                      </div>
                      {/* Label fora da barra — quando a barra é estreita */}
                      {labelOutside && (
                        <span
                          className="text-sm font-medium whitespace-nowrap"
                          style={{ color }}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className={cn('text-sm font-bold tabular-nums')} style={{ color }}>
                        {stage.count}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {stage.count} {stage.count === 1 ? 'chamado' : 'chamados'}
                    {index > 0 && ` · ${stage.conversionRate.toFixed(1)}%`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}
    </div>
  );
};
