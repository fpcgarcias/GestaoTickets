/** Série temporal para o gráfico de tendência */
export interface TrendSeries {
  name: string; // ex: "new", "ongoing", "total"
  data: { date: string; count: number }[];
}

/** Célula do heatmap (dia da semana x hora) */
export interface HeatmapCell {
  day_of_week: number; // 0=dom, 1=seg, ..., 6=sáb
  hour: number;        // 0-23
  count: number;
}

/** Entrada do ranking de atendentes */
export interface AgentRankingEntry {
  official_id: number;
  official_name: string;
  resolved_count: number;
  avg_first_response_hours: number;
  avg_resolution_hours: number;
}

/** Métricas de SLA */
export interface SlaComplianceData {
  total_resolved: number;
  within_sla: number;
  compliance_rate: number;
  has_sla_config: boolean;
}

/** Métricas de backlog */
export interface BacklogMetrics {
  open_over_7_days: number;
  unassigned: number;
  stale_over_3_days: number;
}

/** Ticket no drill-down */
export interface DrillDownTicket {
  id: number;
  ticket_id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  official_name: string | null;
}

/** Resposta paginada do drill-down */
export interface DrillDownResponse {
  tickets: DrillDownTicket[];
  total: number;
  page: number;
  page_size: number;
}

/** Métricas de um período (para comparativo) */
export interface PeriodMetrics {
  total: number;
  resolved: number;
  avg_first_response_hours: number;
  avg_resolution_hours: number;
}

/** Filtros do dashboard */
export interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  officialId?: string;
  departmentId?: string;
  incidentTypeId?: string;
  categoryId?: string;
  companyId?: string;
}

/** Tipo de agregação dinâmica */
export type AggregationType = 'status' | 'priority' | 'department' | 'official' | 'incident_type' | 'category';

/** Dados para exportação */
export interface DashboardExportData {
  kpis: Record<string, number>;
  statusData: { name: string; value: number }[];
  priorityData: { name: string; value: number }[];
  trendData: TrendSeries[];
  rankingData: AgentRankingEntry[];
  slaData: SlaComplianceData | null;
  backlogData: BacklogMetrics | null;
  recentTickets: DrillDownTicket[];
}
