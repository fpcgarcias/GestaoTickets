import React, { useState, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Activity, AlertTriangle, Bug, Search, RefreshCw, Loader2,
  Clock, XCircle, Skull, Info, ChevronRight, ArrowLeft, X
} from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemLog {
  id: number;
  level: string;
  message: string;
  server_identifier: string;
  trace_id: string | null;
  span_id: string | null;
  context_data: Record<string, unknown> | null;
  company_id: number | null;
  user_id: number | null;
  request_method: string | null;
  request_url: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  created_at: string;
  company_name: string | null;
  user_name: string | null;
}

interface LogsResponse {
  data: SystemLog[];
  pagination: { nextCursor: number | null; hasMore: boolean; total: number };
}

interface LogStats {
  totalLogs: number;
  totalErrors: number;
  avgResponseTime: number;
  slowRequests: number;
  byLevel: Record<string, number>;
  byServer: Record<string, number>;
}

interface Company {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Level helpers
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; className: string }> = {
  debug: { icon: Bug, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  info:  { icon: Info, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  warn:  { icon: AlertTriangle, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  error: { icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  fatal: { icon: Skull, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

function LevelBadge({ level }: { level: string }) {
  const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.info;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-mono text-[11px]', config.className)}>
      <Icon className="h-3 w-3" />
      {level.toUpperCase()}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// StatsCards
// ---------------------------------------------------------------------------

function StatsCards({ stats, isLoading, formatMessage, onSlowRequestsClick }: {
  stats: LogStats | undefined;
  isLoading: boolean;
  formatMessage: (id: string, values?: Record<string, any>) => string;
  onSlowRequestsClick?: () => void;
}) {
  const cards = [
    { label: formatMessage('logs.stats.total_logs'), value: stats?.totalLogs ?? 0, icon: Activity, color: 'text-blue-500' },
    { label: formatMessage('logs.stats.total_errors'), value: stats?.totalErrors ?? 0, icon: XCircle, color: 'text-red-500' },
    { label: formatMessage('logs.stats.avg_response_time'), value: `${stats?.avgResponseTime ?? 0}${formatMessage('logs.stats.ms')}`, icon: Clock, color: 'text-yellow-500' },
    { label: formatMessage('logs.stats.slow_requests'), value: stats?.slowRequests ?? 0, icon: AlertTriangle, color: 'text-orange-500', sub: formatMessage('logs.stats.above_1s'), onClick: onSlowRequestsClick },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={c.onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all' : ''}
          onClick={c.onClick}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={cn('h-8 w-8', c.color)} />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground truncate">{c.label}</p>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mt-1" />
              ) : (
                <p className="text-2xl font-bold">{c.value}</p>
              )}
              {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

function FilterBar({ filters, setFilters, servers, formatMessage, isAdmin, companies, companyId }: {
  filters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  servers: string[];
  formatMessage: (id: string, values?: Record<string, any>) => string;
  isAdmin: boolean;
  companies: Company[];
  companyId: string;
}) {
  const set = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Level */}
      <Select value={filters.level || 'all'} onValueChange={v => set('level', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={formatMessage('logs.filters.level')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{formatMessage('logs.filters.all_levels')}</SelectItem>
          {['debug', 'info', 'warn', 'error', 'fatal'].map(l => (
            <SelectItem key={l} value={l}>{formatMessage(`logs.levels.${l}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Server */}
      <Select value={filters.server_identifier || 'all'} onValueChange={v => set('server_identifier', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={formatMessage('logs.filters.server')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{formatMessage('logs.filters.all_servers')}</SelectItem>
          {servers.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Company (super_admin only) */}
      {isAdmin && (
        <Select value={companyId || 'all'} onValueChange={v => set('company_id', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={formatMessage('logs.filters.company')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage('logs.filters.all_companies')}</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={formatMessage('logs.filters.search')}
          value={filters.search || ''}
          onChange={e => set('search', e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Date from */}
      <Input
        type="date"
        value={filters.date_from || ''}
        onChange={e => set('date_from', e.target.value)}
        className="w-[160px]"
        aria-label={formatMessage('logs.filters.date_from')}
      />

      {/* Date to */}
      <Input
        type="date"
        value={filters.date_to || ''}
        onChange={e => set('date_to', e.target.value)}
        className="w-[160px]"
        aria-label={formatMessage('logs.filters.date_to')}
      />

      {/* Min response time */}
      <Input
        type="number"
        min={0}
        placeholder={formatMessage('logs.filters.min_response_time')}
        value={filters.min_response_time || ''}
        onChange={e => set('min_response_time', e.target.value)}
        className="w-[140px]"
        aria-label={formatMessage('logs.filters.min_response_time')}
      />

      {/* Clear */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setFilters({})}
        className="gap-1"
      >
        <X className="h-4 w-4" />
        {formatMessage('logs.filters.clear_filters')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPanel (Task 9.3)
// ---------------------------------------------------------------------------

function DetailPanel({ log, open, onClose, formatMessage, locale, onViewTrace, isAdmin }: {
  log: SystemLog | null;
  open: boolean;
  onClose: () => void;
  formatMessage: (id: string, values?: Record<string, any>) => string;
  locale: string;
  onViewTrace: (traceId: string) => void;
  isAdmin: boolean;
}) {
  if (!log) return null;

  const dateFmt = locale === 'en-US' ? 'MM/dd/yyyy HH:mm:ss.SSS' : 'dd/MM/yyyy HH:mm:ss.SSS';
  const dateLocale = locale === 'en-US' ? enUS : ptBR;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: formatMessage('logs.detail.id'), value: log.id },
    { label: formatMessage('logs.detail.level'), value: <LevelBadge level={log.level} /> },
    { label: formatMessage('logs.detail.message'), value: <span className="break-all">{log.message}</span> },
    { label: formatMessage('logs.detail.server'), value: log.server_identifier },
    {
      label: formatMessage('logs.detail.trace_id'),
      value: log.trace_id ? (
        <button
          className="text-blue-500 hover:underline font-mono text-xs break-all text-left"
          onClick={() => { onClose(); onViewTrace(log.trace_id!); }}
        >
          {log.trace_id}
        </button>
      ) : '—',
    },
    { label: formatMessage('logs.detail.span_id'), value: log.span_id ? <span className="font-mono text-xs break-all">{log.span_id}</span> : '—' },
    ...(isAdmin ? [{ label: formatMessage('logs.detail.company_id'), value: log.company_name ?? formatMessage('logs.detail.system_log') }] : []),
    { label: formatMessage('logs.detail.user_id'), value: log.user_name ?? '—' },
    { label: formatMessage('logs.detail.request_method'), value: log.request_method ?? '—' },
    { label: formatMessage('logs.detail.request_url'), value: log.request_url ? <span className="font-mono text-xs break-all">{log.request_url}</span> : '—' },
    { label: formatMessage('logs.detail.response_status'), value: log.response_status ?? '—' },
    { label: formatMessage('logs.detail.response_time'), value: log.response_time_ms != null ? `${log.response_time_ms}ms` : '—' },
    { label: formatMessage('logs.detail.created_at'), value: format(new Date(log.created_at), dateFmt, { locale: dateLocale }) },
  ];

  const hasContext = log.context_data && Object.keys(log.context_data).length > 0;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{formatMessage('logs.detail.title')}</SheetTitle>
          <SheetDescription className="sr-only">{formatMessage('logs.detail.title')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {fields.map(f => (
            <div key={f.label} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground font-medium">{f.label}</span>
              <span>{f.value}</span>
            </div>
          ))}
          <div className="pt-2">
            <p className="text-sm font-medium text-muted-foreground mb-1">{formatMessage('logs.detail.context_data')}</p>
            {hasContext ? (
              <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                {JSON.stringify(log.context_data, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">{formatMessage('logs.detail.no_context')}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// TraceView (Task 9.4)
// ---------------------------------------------------------------------------

function TraceView({ traceId, onBack, formatMessage, locale }: {
  traceId: string;
  onBack: () => void;
  formatMessage: (id: string, values?: Record<string, any>) => string;
  locale: string;
}) {
  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['/api/system-logs', 'trace', traceId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/system-logs?trace_id=${encodeURIComponent(traceId)}&sort_order=asc&limit=200`);
      return res.json();
    },
  });

  const dateFmt = locale === 'en-US' ? 'HH:mm:ss.SSS' : 'HH:mm:ss.SSS';
  const entries = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          {formatMessage('logs.trace.back_to_logs')}
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{formatMessage('logs.trace.title')}</h2>
          <p className="text-sm text-muted-foreground font-mono">{traceId}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{formatMessage('logs.trace.no_entries')}</p>
      ) : (
        <div className="space-y-0">
          <p className="text-sm text-muted-foreground mb-3">
            {formatMessage('logs.trace.description')} — {formatMessage('logs.trace.entries', { count: entries.length })}
          </p>
          <div className="relative border-l-2 border-muted-foreground/20 ml-4 space-y-0">
            {entries.map((entry, idx) => (
              <div key={entry.id} className="relative pl-6 pb-4">
                {/* Timeline dot */}
                <div className={cn(
                  'absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background',
                  entry.level === 'error' || entry.level === 'fatal' ? 'bg-red-500' :
                  entry.level === 'warn' ? 'bg-yellow-500' : 'bg-blue-500'
                )} />
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap mt-0.5">
                    {format(new Date(entry.created_at), dateFmt)}
                  </span>
                  <LevelBadge level={entry.level} />
                  <span className="text-sm flex-1 break-all">{entry.message}</span>
                  {entry.response_time_ms != null && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{entry.response_time_ms}ms</span>
                  )}
                </div>
                {entry.request_url && (
                  <p className="text-xs font-mono text-muted-foreground mt-1 ml-[72px] break-all">
                    {entry.request_method} {entry.request_url} → {entry.response_status}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SystemLogsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage, locale } = useI18n();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  // Build query params from filters
  const buildParams = useCallback((cursor?: number | null) => {
    const params = new URLSearchParams();
    if (filters.level) params.set('level', filters.level);
    if (filters.server_identifier) params.set('server_identifier', filters.server_identifier);
    if (filters.company_id) params.set('company_id', filters.company_id);
    if (filters.search) params.set('search', filters.search);
    if (filters.date_from) {
      const d = new Date(filters.date_from + 'T00:00:00');
      params.set('date_from', d.toISOString());
    }
    if (filters.date_to) {
      const d = new Date(filters.date_to + 'T23:59:59.999');
      params.set('date_to', d.toISOString());
    }
    if (filters.min_response_time) params.set('min_response_time', filters.min_response_time);
    if (cursor) params.set('cursor', String(cursor));
    params.set('limit', '50');
    return params.toString();
  }, [filters]);

  // Stats query
  const statsParams = new URLSearchParams();
  if (filters.company_id) statsParams.set('company_id', filters.company_id);
  if (filters.date_from) statsParams.set('date_from', new Date(filters.date_from + 'T00:00:00').toISOString());
  if (filters.date_to) statsParams.set('date_to', new Date(filters.date_to + 'T23:59:59.999').toISOString());

  const { data: stats, isLoading: statsLoading } = useQuery<LogStats>({
    queryKey: ['/api/system-logs/stats', filters.company_id, filters.date_from, filters.date_to],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/system-logs/stats?${statsParams.toString()}`);
      return res.json();
    },
  });

  // Infinite query for logs
  const {
    data: logsData,
    isLoading: logsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<LogsResponse>({
    queryKey: ['/api/system-logs', filters],
    queryFn: async ({ pageParam }) => {
      const res = await apiRequest('GET', `/api/system-logs?${buildParams(pageParam as number | null)}`);
      return res.json();
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  });

  // Companies for super_admin
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Error loading companies');
      return res.json();
    },
    enabled: isAdmin,
  });

  // Extract unique servers from stats
  const servers = stats?.byServer ? Object.keys(stats.byServer) : [];

  // Flatten pages
  const allLogs = logsData?.pages.flatMap(p => p.data) ?? [];

  const dateFmt = locale === 'en-US' ? 'MM/dd/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm:ss';
  const dateLocale = locale === 'en-US' ? enUS : ptBR;

  // If viewing a trace
  if (traceId) {
    return (
      <TraceView
        traceId={traceId}
        onBack={() => setTraceId(null)}
        formatMessage={formatMessage}
        locale={locale}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{formatMessage('logs.title')}</h1>
          <p className="text-sm text-muted-foreground">{formatMessage('logs.description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="h-4 w-4" />
          {formatMessage('logs.refresh')}
        </Button>
      </div>

      {/* Stats */}
      <StatsCards
        stats={stats}
        isLoading={statsLoading}
        formatMessage={formatMessage}
        onSlowRequestsClick={() => setFilters(prev => ({ ...prev, min_response_time: '1001' }))}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            servers={servers}
            formatMessage={formatMessage}
            isAdmin={isAdmin}
            companies={companies}
            companyId={filters.company_id || ''}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">{formatMessage('logs.loading')}</span>
            </div>
          ) : allLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{formatMessage('logs.no_logs')}</p>
              <p className="text-sm text-muted-foreground">{formatMessage('logs.no_logs_description')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">{formatMessage('logs.table.timestamp')}</TableHead>
                    <TableHead className="w-[90px]">{formatMessage('logs.table.level')}</TableHead>
                    <TableHead className="w-[110px]">{formatMessage('logs.table.server')}</TableHead>
                    <TableHead>{formatMessage('logs.table.message')}</TableHead>
                    <TableHead className="w-[200px]">{formatMessage('logs.table.url')}</TableHead>
                    <TableHead className="w-[90px] text-right">{formatMessage('logs.table.response_time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLogs.map(log => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), dateFmt, { locale: dateLocale })}
                      </TableCell>
                      <TableCell><LevelBadge level={log.level} /></TableCell>
                      <TableCell className="text-xs font-mono">{log.server_identifier}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">{log.message}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">
                        {log.request_url ? (
                          <span>{log.request_method} {log.request_url.split('?')[0]}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {log.response_time_ms != null ? (
                          <span className={cn(log.response_time_ms > 1000 && 'text-red-500 font-semibold')}>
                            {log.response_time_ms}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Load more */}
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-1"
                  >
                    {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                    {formatMessage('logs.load_more')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <DetailPanel
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        formatMessage={formatMessage}
        locale={locale}
        onViewTrace={setTraceId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
