import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { TrendSeries } from '@shared/types/dashboard';

type Granularity = 'day' | 'week' | 'month';
type GroupBy = 'none' | 'status' | 'priority';

interface TrendChartProps {
  data: TrendSeries[];
  isLoading: boolean;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  onPointClick?: (seriesName: string, date: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#F59E0B',
  ongoing: '#3B82F6',
  resolved: '#10B981',
  closed: '#6B7280',
  total: '#8B5CF6',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
  total: '#8B5CF6',
};

const FALLBACK_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#84CC16',
];

function getSeriesColor(name: string, groupBy: GroupBy, index: number): string {
  if (groupBy === 'status') return STATUS_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  if (groupBy === 'priority') return PRIORITY_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function formatDateLabel(dateStr: string, granularity: Granularity, locale: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  if (granularity === 'day') {
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  }
  if (granularity === 'week') {
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  }
  // month
  return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

// Mapas de normalização: valores do banco (pt-BR, en-US, variantes) → chave i18n
const PRIORITY_NORMALIZE: Record<string, string> = {
  low: 'low', baixa: 'low', 'Baixa': 'low',
  medium: 'medium', média: 'medium', 'Média': 'medium', media: 'medium', 'Media': 'medium',
  high: 'high', alta: 'high', 'Alta': 'high',
  critical: 'critical', crítica: 'critical', 'Crítica': 'critical', critica: 'critical', 'Critica': 'critical',
  immediate: 'critical', imediata: 'critical', 'Imediata': 'critical',
  urgent: 'critical', urgente: 'critical', 'Urgente': 'critical',
};

const STATUS_NORMALIZE: Record<string, string> = {
  new: 'new', ongoing: 'ongoing', resolved: 'resolved', closed: 'closed',
  suspended: 'suspended', waiting_customer: 'waiting_customer',
  escalated: 'escalated', reopened: 'reopened', in_analysis: 'in_analysis',
};

function normalizeAndTranslate(name: string, groupBy: string, formatMessage: (key: string) => string): string {
  if (groupBy === 'status') {
    const normalized = STATUS_NORMALIZE[name] || name;
    const key = `dashboard.trend.status_${normalized}`;
    const translated = formatMessage(key);
    return translated === key ? name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ') : translated;
  }
  if (groupBy === 'priority') {
    const normalized = PRIORITY_NORMALIZE[name] || name.toLowerCase();
    const key = `dashboard.trend.priority_${normalized}`;
    const translated = formatMessage(key);
    return translated === key ? name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ') : translated;
  }
  return formatMessage('dashboard.trend.total');
}

const CustomTooltip = ({ active, payload, label, locale, granularity, formatMessage, groupBy }: any) => {
  if (!active || !payload?.length) return null;

  const date = new Date(label);
  const formattedDate = isNaN(date.getTime())
    ? label
    : date.toLocaleDateString(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

  const translateName = (name: string): string => {
    return normalizeAndTranslate(name, groupBy, formatMessage);
  };

  return (
    <div className="bg-card text-card-foreground p-3 rounded-lg shadow-lg border border-border">
      <p className="font-medium text-foreground text-sm mb-2">{formattedDate}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{translateName(entry.name)}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

function TrendChartSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-[320px] w-full" />
    </div>
  );
}

function TrendChartEmpty({ message }: { message: string }) {
  return (
    <div className="w-full h-[320px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <p className="text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  isLoading,
  granularity,
  onGranularityChange,
  groupBy,
  onGroupByChange,
  onPointClick,
}) => {
  const { formatMessage, locale } = useI18n();

  if (isLoading) return <TrendChartSkeleton />;

  const hasData = data && data.length > 0 && data.some(s => s.data.length > 0);
  if (!hasData) {
    return <TrendChartEmpty message={formatMessage('dashboard.trend.no_data')} />;
  }

  // Merge all dates across series for the X axis
  const allDates = Array.from(
    new Set(data.flatMap(s => s.data.map(d => d.date)))
  ).sort();

  // Build chart data: each row = { date, [seriesName]: count }
  const chartData = allDates.map(date => {
    const row: Record<string, any> = { date };
    data.forEach(series => {
      const point = series.data.find(d => d.date === date);
      row[series.name] = point?.count ?? 0;
    });
    return row;
  });

  const granularityOptions: { value: Granularity; labelKey: string }[] = [
    { value: 'day', labelKey: 'dashboard.trend.granularity_day' },
    { value: 'week', labelKey: 'dashboard.trend.granularity_week' },
    { value: 'month', labelKey: 'dashboard.trend.granularity_month' },
  ];

  const groupByOptions: { value: GroupBy; labelKey: string }[] = [
    { value: 'none', labelKey: 'dashboard.trend.group_none' },
    { value: 'status', labelKey: 'dashboard.trend.group_status' },
    { value: 'priority', labelKey: 'dashboard.trend.group_priority' },
  ];

  const getSeriesLabel = (name: string): string => {
    return normalizeAndTranslate(name, groupBy, formatMessage);
  };

  return (
    <div className="w-full space-y-4">
      {/* Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Granularity */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          {granularityOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onGranularityChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                granularity === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {formatMessage(opt.labelKey)}
            </button>
          ))}
        </div>

        {/* Group by */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          {groupByOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onGroupByChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                groupBy === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {formatMessage(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          onClick={(e) => {
            if (onPointClick && e?.activeLabel) {
              // When clicking, use the first series name as context
              const seriesName = data.length === 1 ? data[0].name : 'total';
              onPointClick(seriesName, e.activeLabel);
            }
          }}
        >
          <defs>
            {data.map((series, i) => (
              <linearGradient key={series.name} id={`trend-gradient-${series.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={getSeriesColor(series.name, groupBy, i)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={getSeriesColor(series.name, groupBy, i)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            tickFormatter={(value) => formatDateLabel(value, granularity, locale)}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dx={-10}
            allowDecimals={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                locale={locale}
                granularity={granularity}
                formatMessage={formatMessage}
                groupBy={groupBy}
              />
            }
          />
          <Legend
            formatter={(value: string) => getSeriesLabel(value)}
            wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }}
          />
          {data.map((series, i) => (
            <Line
              key={series.name}
              type="monotone"
              dataKey={series.name}
              name={series.name}
              stroke={getSeriesColor(series.name, groupBy, i)}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
