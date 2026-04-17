import React from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { AgentRankingEntry } from '@shared/types/dashboard';

type SortBy = 'resolved_count' | 'avg_first_response' | 'avg_resolution';

interface AgentRankingTableProps {
  data: AgentRankingEntry[];
  isLoading: boolean;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
}

function formatHours(hours: number): string {
  if (hours === 0 || isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return remaining > 0 ? `${days}d ${remaining.toFixed(0)}h` : `${days}d`;
}

function RankingSkeleton() {
  return (
    <div className="w-full space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function RankingEmpty({ message }: { message: string }) {
  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}

function SortIcon({ column, currentSort }: { column: SortBy; currentSort: SortBy }) {
  if (column !== currentSort) {
    return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
  }
  // resolved_count: desc (higher is better), times: asc (lower is better)
  if (column === 'resolved_count') {
    return <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  }
  return <ArrowUp className="h-3.5 w-3.5 ml-1" />;
}

export const AgentRankingTable: React.FC<AgentRankingTableProps> = ({
  data,
  isLoading,
  sortBy,
  onSortChange,
}) => {
  const { formatMessage } = useI18n();

  if (isLoading) return <RankingSkeleton />;

  if (!data || data.length === 0) {
    return <RankingEmpty message={formatMessage('dashboard.ranking.no_data')} />;
  }

  const columns: { key: SortBy; labelKey: string }[] = [
    { key: 'resolved_count', labelKey: 'dashboard.ranking.resolved_count' },
    { key: 'avg_first_response', labelKey: 'dashboard.ranking.avg_first_response' },
    { key: 'avg_resolution', labelKey: 'dashboard.ranking.avg_resolution' },
  ];

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>{formatMessage('dashboard.ranking.agent_name')}</TableHead>
            {columns.map(col => (
              <TableHead key={col.key} className="text-right">
                <button
                  onClick={() => onSortChange(col.key)}
                  className={cn(
                    'inline-flex items-center gap-0.5 hover:text-foreground transition-colors',
                    sortBy === col.key ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {formatMessage(col.labelKey)}
                  <SortIcon column={col.key} currentSort={sortBy} />
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry, index) => (
            <TableRow key={entry.official_id}>
              <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">{entry.official_name}</TableCell>
              <TableCell className="text-right tabular-nums">
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm font-semibold',
                  sortBy === 'resolved_count' ? 'bg-primary/10 text-primary' : ''
                )}>
                  {entry.resolved_count}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className={cn(
                  'text-sm',
                  sortBy === 'avg_first_response' ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}>
                  {formatHours(entry.avg_first_response_hours)}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className={cn(
                  'text-sm',
                  sortBy === 'avg_resolution' ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}>
                  {formatHours(entry.avg_resolution_hours)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
