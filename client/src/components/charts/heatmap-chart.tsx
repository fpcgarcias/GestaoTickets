import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { HeatmapCell } from '@shared/types/dashboard';

interface HeatmapChartProps {
  data: HeatmapCell[];
  isLoading: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
// PostgreSQL EXTRACT(DOW): 0=Sunday, 1=Monday, ..., 6=Saturday
// Display order: Monday(1) to Sunday(0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DAY_I18N_KEYS: Record<number, string> = {
  0: 'dashboard.heatmap.sunday',
  1: 'dashboard.heatmap.monday',
  2: 'dashboard.heatmap.tuesday',
  3: 'dashboard.heatmap.wednesday',
  4: 'dashboard.heatmap.thursday',
  5: 'dashboard.heatmap.friday',
  6: 'dashboard.heatmap.saturday',
};

function getHeatColor(value: number, maxValue: number): string {
  if (maxValue === 0 || value === 0) return 'var(--heatmap-empty, hsl(var(--muted)))';
  const intensity = value / maxValue;
  // Gradient from light blue to deep blue
  if (intensity <= 0.25) return '#BFDBFE';
  if (intensity <= 0.5) return '#60A5FA';
  if (intensity <= 0.75) return '#3B82F6';
  return '#1D4ED8';
}

function HeatmapSkeleton() {
  return (
    <div className="w-full space-y-3">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-1">
            <Skeleton className="h-5 w-12 flex-shrink-0" />
            {Array.from({ length: 24 }).map((_, j) => (
              <Skeleton key={j} className="h-5 flex-1 min-w-[14px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapEmpty({ message }: { message: string }) {
  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>
        <p className="text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, isLoading }) => {
  const { formatMessage } = useI18n();

  const { grid, maxValue } = useMemo(() => {
    const g: Record<string, number> = {};
    let max = 0;
    if (data) {
      data.forEach(cell => {
        const key = `${cell.day_of_week}-${cell.hour}`;
        g[key] = (g[key] || 0) + cell.count;
        if (g[key] > max) max = g[key];
      });
    }
    return { grid: g, maxValue: max };
  }, [data]);

  if (isLoading) return <HeatmapSkeleton />;

  const hasData = data && data.length > 0;
  if (!hasData) {
    return <HeatmapEmpty message={formatMessage('dashboard.heatmap.no_data')} />;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full space-y-3">
        {/* Hour labels */}
        <div className="flex gap-[2px]">
          <div className="w-16 flex-shrink-0" />
          {HOURS.map(h => (
            <div
              key={h}
              className="flex-1 min-w-[14px] text-center text-[10px] text-muted-foreground font-medium"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAY_ORDER.map(day => (
          <div key={day} className="flex gap-[2px] items-center">
            <div className="w-16 flex-shrink-0 text-xs text-muted-foreground font-medium text-right pr-2 truncate">
              {formatMessage(DAY_I18N_KEYS[day])}
            </div>
            {HOURS.map(hour => {
              const count = grid[`${day}-${hour}`] || 0;
              return (
                <Tooltip key={`${day}-${hour}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 min-w-[14px] h-7 rounded-sm transition-colors cursor-default"
                      style={{ backgroundColor: getHeatColor(count, maxValue) }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">
                      {formatMessage(DAY_I18N_KEYS[day])} — {hour}h
                    </p>
                    <p className="text-muted-foreground">
                      {formatMessage('dashboard.heatmap.tooltip_count', { count: String(count) })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}

        {/* Color legend */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <span className="text-xs text-muted-foreground">{formatMessage('dashboard.heatmap.less')}</span>
          <div className="flex gap-[2px]">
            {['hsl(var(--muted))', '#BFDBFE', '#60A5FA', '#3B82F6', '#1D4ED8'].map((color, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{formatMessage('dashboard.heatmap.more')}</span>
        </div>
      </div>
    </TooltipProvider>
  );
};
