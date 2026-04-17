import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, PriorityBadge } from '@/components/tickets/status-badge';
import { formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ExternalLink, Inbox } from 'lucide-react';
import type { DashboardFilters, DrillDownResponse } from '@shared/types/dashboard';
import type { TicketStatus } from '@shared/ticket-utils';

const PAGE_SIZE = 20;

interface DrillDownModalProps {
  open: boolean;
  onClose: () => void;
  type: string;
  value: string;
  title: string;
  filters: DashboardFilters;
}

function DrillDownSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function DrillDownEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-14 h-14 mb-4 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
}

export function DrillDownModal({ open, onClose, type, value, title, filters }: DrillDownModalProps) {
  const { formatMessage, locale } = useI18n();
  const [page, setPage] = useState(1);

  // Reset page when modal opens with new data
  React.useEffect(() => {
    if (open) setPage(1);
  }, [open, type, value]);

  const queryParams = new URLSearchParams();
  queryParams.set('type', type);
  queryParams.set('value', value);
  queryParams.set('page', String(page));
  queryParams.set('page_size', String(PAGE_SIZE));

  if (filters.startDate) queryParams.set('start_date', filters.startDate.toISOString());
  if (filters.endDate) queryParams.set('end_date', filters.endDate.toISOString());
  if (filters.officialId) queryParams.set('official_id', filters.officialId);
  if (filters.departmentId) queryParams.set('department_id', filters.departmentId);
  if (filters.incidentTypeId) queryParams.set('incident_type_id', filters.incidentTypeId);
  if (filters.categoryId) queryParams.set('category_id', filters.categoryId);
  if (filters.companyId) queryParams.set('company_id', filters.companyId);

  const { data, isLoading, isError } = useQuery<DrillDownResponse>({
    queryKey: [`/api/tickets/dashboard-drilldown?${queryParams.toString()}`],
    enabled: open && !!type && !!value,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {data && !isLoading
              ? formatMessage('dashboard.drilldown.showing_results', { total: data.total })
              : formatMessage('dashboard.drilldown.loading')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <DrillDownSkeleton />
          ) : isError ? (
            <DrillDownEmpty message={formatMessage('dashboard.drilldown.error')} />
          ) : !data || data.tickets.length === 0 ? (
            <DrillDownEmpty message={formatMessage('dashboard.drilldown.no_data')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{formatMessage('dashboard.drilldown.col_id')}</TableHead>
                  <TableHead>{formatMessage('dashboard.drilldown.col_title')}</TableHead>
                  <TableHead>{formatMessage('dashboard.drilldown.col_status')}</TableHead>
                  <TableHead>{formatMessage('dashboard.drilldown.col_priority')}</TableHead>
                  <TableHead>{formatMessage('dashboard.drilldown.col_created_at')}</TableHead>
                  <TableHead>{formatMessage('dashboard.drilldown.col_agent')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs">{ticket.ticket_id}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{ticket.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status as TicketStatus} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(ticket.created_at, locale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ticket.official_name || (
                        <span className="text-muted-foreground italic">
                          {formatMessage('dashboard.drilldown.unassigned')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/tickets/${ticket.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={formatMessage('dashboard.drilldown.view_ticket')}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3 mt-2">
            <span className="text-xs text-muted-foreground">
              {formatMessage('dashboard.drilldown.page_info', { page, totalPages })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={formatMessage('dashboard.drilldown.prev_page')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label={formatMessage('dashboard.drilldown.next_page')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
