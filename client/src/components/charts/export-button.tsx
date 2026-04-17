import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { DashboardExportData, DashboardFilters } from '@shared/types/dashboard';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
  dashboardData: DashboardExportData;
  filters: DashboardFilters;
  locale: string;
}

function getHeaders(formatMessage: (key: string) => string) {
  return {
    kpi: {
      metric: formatMessage('dashboard.export.header_metric'),
      value: formatMessage('dashboard.export.header_value'),
    },
    status: {
      name: formatMessage('dashboard.export.header_status'),
      value: formatMessage('dashboard.export.header_count'),
    },
    priority: {
      name: formatMessage('dashboard.export.header_priority'),
      value: formatMessage('dashboard.export.header_count'),
    },
    ranking: {
      name: formatMessage('dashboard.export.header_agent'),
      resolved: formatMessage('dashboard.export.header_resolved'),
      avgResponse: formatMessage('dashboard.export.header_avg_response_time'),
      avgResolution: formatMessage('dashboard.export.header_avg_resolution_time'),
    },
    sla: {
      metric: formatMessage('dashboard.export.header_metric'),
      value: formatMessage('dashboard.export.header_value'),
      totalResolved: formatMessage('dashboard.export.header_total_resolved'),
      withinSla: formatMessage('dashboard.export.header_within_sla'),
      complianceRate: formatMessage('dashboard.export.header_compliance_rate'),
    },
    backlog: {
      metric: formatMessage('dashboard.export.header_metric'),
      value: formatMessage('dashboard.export.header_value'),
      openOver7: formatMessage('dashboard.export.header_open_over_7'),
      unassigned: formatMessage('dashboard.export.header_unassigned'),
      stale: formatMessage('dashboard.export.header_stale'),
    },
    tickets: {
      id: formatMessage('dashboard.export.header_ticket_id'),
      title: formatMessage('dashboard.export.header_ticket_title'),
      status: formatMessage('dashboard.export.header_status'),
      priority: formatMessage('dashboard.export.header_priority'),
      createdAt: formatMessage('dashboard.export.header_ticket_created_at'),
      agent: formatMessage('dashboard.export.header_agent'),
    },
    sheetNames: {
      kpis: formatMessage('dashboard.export.sheet_kpis'),
      status: formatMessage('dashboard.export.sheet_by_status'),
      priority: formatMessage('dashboard.export.sheet_by_priority'),
      ranking: formatMessage('dashboard.export.sheet_ranking'),
      sla: formatMessage('dashboard.export.sheet_sla'),
      backlog: formatMessage('dashboard.export.sheet_backlog'),
      tickets: formatMessage('dashboard.export.sheet_tickets'),
    },
  };
}

function buildWorkbook(data: DashboardExportData, formatMessage: (key: string) => string): XLSX.WorkBook {
  const h = getHeaders(formatMessage);
  const wb = XLSX.utils.book_new();

  // KPIs sheet
  const kpiRows = Object.entries(data.kpis).map(([key, val]) => ({
    [h.kpi.metric]: key,
    [h.kpi.value]: val,
  }));
  if (kpiRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), h.sheetNames.kpis);
  }

  // Status sheet
  if (data.statusData.length > 0) {
    const statusRows = data.statusData.map((d) => ({
      [h.status.name]: d.name,
      [h.status.value]: d.value,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusRows), h.sheetNames.status);
  }

  // Priority sheet
  if (data.priorityData.length > 0) {
    const priorityRows = data.priorityData.map((d) => ({
      [h.priority.name]: d.name,
      [h.priority.value]: d.value,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priorityRows), h.sheetNames.priority);
  }

  // Ranking sheet
  if (data.rankingData.length > 0) {
    const rankingRows = data.rankingData.map((r) => ({
      [h.ranking.name]: r.official_name,
      [h.ranking.resolved]: r.resolved_count,
      [h.ranking.avgResponse]: Number(r.avg_first_response_hours.toFixed(1)),
      [h.ranking.avgResolution]: Number(r.avg_resolution_hours.toFixed(1)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankingRows), h.sheetNames.ranking);
  }

  // SLA sheet
  if (data.slaData) {
    const slaRows = [
      { [h.sla.metric]: h.sla.totalResolved, [h.sla.value]: data.slaData.total_resolved },
      { [h.sla.metric]: h.sla.withinSla, [h.sla.value]: data.slaData.within_sla },
      { [h.sla.metric]: h.sla.complianceRate, [h.sla.value]: Number(data.slaData.compliance_rate.toFixed(1)) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slaRows), h.sheetNames.sla);
  }

  // Backlog sheet
  if (data.backlogData) {
    const backlogRows = [
      { [h.backlog.metric]: h.backlog.openOver7, [h.backlog.value]: data.backlogData.open_over_7_days },
      { [h.backlog.metric]: h.backlog.unassigned, [h.backlog.value]: data.backlogData.unassigned },
      { [h.backlog.metric]: h.backlog.stale, [h.backlog.value]: data.backlogData.stale_over_3_days },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backlogRows), h.sheetNames.backlog);
  }

  // Recent tickets sheet
  if (data.recentTickets.length > 0) {
    const ticketRows = data.recentTickets.map((t) => ({
      [h.tickets.id]: t.ticket_id,
      [h.tickets.title]: t.title,
      [h.tickets.status]: t.status,
      [h.tickets.priority]: t.priority,
      [h.tickets.createdAt]: t.created_at,
      [h.tickets.agent]: t.official_name || '-',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ticketRows), h.sheetNames.tickets);
  }

  return wb;
}

function downloadFile(wb: XLSX.WorkBook, format: 'csv' | 'xlsx') {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  if (format === 'csv') {
    // Export first sheet as CSV
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) return;
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet]);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    XLSX.writeFile(wb, `dashboard_${timestamp}.xlsx`);
  }
}

export function ExportButton({ dashboardData, filters, locale }: ExportButtonProps) {
  const { formatMessage } = useI18n();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const wb = buildWorkbook(dashboardData, formatMessage);
      downloadFile(wb, format);
      toast({
        title: formatMessage('dashboard.export.success_title'),
        description: formatMessage('dashboard.export.success_description'),
      });
    } catch (err) {
      console.error('Export error:', err);
      toast({
        title: formatMessage('dashboard.export.error_title'),
        description: formatMessage('dashboard.export.error_description'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {formatMessage('dashboard.export.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          {formatMessage('dashboard.export.csv')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {formatMessage('dashboard.export.xlsx')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
