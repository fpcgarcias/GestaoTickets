/**
 * API para Dashboard de SLA
 * Fornece estatísticas, métricas de cumprimento e alertas de configurações
 */

import { db } from '../db';
import { 
  slaConfigurations,
  departments,
  incidentTypes,
  tickets,
  companies,
  departmentPriorities,
  type SlaConfiguration,
  type Department,
  type IncidentType,
  ticketStatusHistory
} from '@shared/schema';
import { eq, and, count, sql, desc, asc, isNull, isNotNull, inArray } from 'drizzle-orm';
import { SLAService } from '../services/sla-service';
import { convertStatusHistoryToPeriods, calculateEffectiveBusinessTime, getBusinessHoursConfig } from '../../shared/utils/sla-calculator';

// Interfaces para responses
export interface SLADashboardStats {
  totalConfigurations: number;
  configurationsByDepartment: {
    departmentId: number;
    departmentName: string;
    configurationsCount: number;
    missingConfigurations: number;
    coverage: number; // percentual de cobertura
  }[];
  slaCompliance: {
    departmentId: number;
    departmentName: string;
    totalTickets: number;
    onTimeResponse: number;
    onTimeResolution: number;
    responseCompliance: number; // %
    resolutionCompliance: number; // %
    averageResponseTime: number; // horas
    averageResolutionTime: number; // horas
  }[];
  missingConfigurationAlerts: {
    departmentId: number;
    departmentName: string;
    incidentTypeId: number;
    incidentTypeName: string;
    priorityId?: number;
    priorityName?: string;
    ticketsAffected: number;
  }[];
}

export interface SLAConfigurationOverview {
  departmentId: number;
  departmentName: string;
  totalIncidentTypes: number;
  configuredIncidentTypes: number;
  totalPriorities: number;
  configuredPriorities: number;
  coverage: number;
  recentConfigurations: {
    id: number;
    incidentTypeName: string;
    priorityName?: string;
    responseTimeHours: number;
    resolutionTimeHours: number;
    createdAt: string;
  }[];
}

export class SLADashboardAPI {
  private slaService: SLAService;

  constructor() {
    this.slaService = SLAService.getInstance();
  }

  /**
   * Obter estatísticas gerais do dashboard de SLA
   */
  async getDashboardStats(companyId: number, departmentIds?: number[]): Promise<SLADashboardStats> {
    // Filtros base
    const companyFilter = eq(slaConfigurations.company_id, companyId);
    const baseFilters = [companyFilter];
    
    if (departmentIds && departmentIds.length > 0) {
      baseFilters.push(inArray(slaConfigurations.department_id, departmentIds));
    }

    // 1. Total de configurações
    const [totalConfigsResult] = await db
      .select({ count: count() })
      .from(slaConfigurations)
      .where(and(...baseFilters, eq(slaConfigurations.is_active, true)));

    const totalConfigurations = totalConfigsResult.count;

    // 2. Configurações por departamento
    const configsByDept = await db
      .select({
        departmentId: slaConfigurations.department_id,
        departmentName: departments.name,
        configurationsCount: count()
      })
      .from(slaConfigurations)
      .innerJoin(departments, eq(slaConfigurations.department_id, departments.id))
      .where(and(...baseFilters, eq(slaConfigurations.is_active, true)))
      .groupBy(slaConfigurations.department_id, departments.name);

    // 3. Calcular configurações faltantes e cobertura por departamento
    const configurationsByDepartment = await Promise.all(
      configsByDept.map(async (dept) => {
        const missingConfigs = await this.getMissingConfigurationsCount(companyId, dept.departmentId);
        const totalPossibleConfigs = dept.configurationsCount + missingConfigs;
        const coverage = totalPossibleConfigs > 0 ? (dept.configurationsCount / totalPossibleConfigs) * 100 : 0;

        return {
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          configurationsCount: dept.configurationsCount,
          missingConfigurations: missingConfigs,
          coverage: Math.round(coverage * 100) / 100
        };
      })
    );

    // 4. Métricas de cumprimento de SLA
    const slaCompliance = await this.getSLAComplianceMetrics(companyId, departmentIds);

    // 5. Alertas de configurações faltantes
    const missingConfigurationAlerts = await this.getMissingConfigurationAlerts(companyId, departmentIds);

    return {
      totalConfigurations,
      configurationsByDepartment,
      slaCompliance,
      missingConfigurationAlerts
    };
  }

  /**
   * Obter visão geral das configurações de um departamento
   */
  async getDepartmentOverview(companyId: number, departmentId: number): Promise<SLAConfigurationOverview> {
    // Total de tipos de incidente disponíveis
    const [totalIncidentTypesResult] = await db
      .select({ count: count() })
      .from(incidentTypes)
      .where(eq(incidentTypes.company_id, companyId));

    // Total de prioridades disponíveis para o departamento
    const [totalPrioritiesResult] = await db
      .select({ count: count() })
      .from(departmentPriorities)
      .where(and(
        eq(departmentPriorities.company_id, companyId),
        eq(departmentPriorities.department_id, departmentId),
        eq(departmentPriorities.is_active, true)
      ));

    // Configurações existentes
    const existingConfigs = await db
      .select({
        incidentTypeId: slaConfigurations.incident_type_id,
        priorityId: slaConfigurations.priority_id
      })
      .from(slaConfigurations)
      .where(and(
        eq(slaConfigurations.company_id, companyId),
        eq(slaConfigurations.department_id, departmentId),
        eq(slaConfigurations.is_active, true)
      ));

    // Contar tipos de incidente e prioridades configuradas
    const configuredIncidentTypes = new Set(existingConfigs.map(c => c.incidentTypeId)).size;
    const configuredPriorities = new Set(
      existingConfigs.filter(c => c.priorityId !== null).map(c => c.priorityId)
    ).size;

    // Calcular cobertura
    const totalIncidentTypes = totalIncidentTypesResult.count;
    const totalPriorities = totalPrioritiesResult.count || 1; // Mínimo 1 para evitar divisão por zero
    
    const coverage = ((configuredIncidentTypes + configuredPriorities) / (totalIncidentTypes + totalPriorities)) * 100;

    // Configurações recentes
    const recentConfigurations = await db
      .select({
        id: slaConfigurations.id,
        incidentTypeName: incidentTypes.name,
        priorityName: departmentPriorities.name,
        responseTimeHours: slaConfigurations.response_time_hours,
        resolutionTimeHours: slaConfigurations.resolution_time_hours,
        createdAt: slaConfigurations.created_at
      })
      .from(slaConfigurations)
      .innerJoin(incidentTypes, eq(slaConfigurations.incident_type_id, incidentTypes.id))
      .leftJoin(departmentPriorities, eq(slaConfigurations.priority_id, departmentPriorities.id))
      .where(and(
        eq(slaConfigurations.company_id, companyId),
        eq(slaConfigurations.department_id, departmentId),
        eq(slaConfigurations.is_active, true)
      ))
      .orderBy(desc(slaConfigurations.created_at))
      .limit(5);

    return {
      departmentId,
      departmentName: '', // Será preenchido pela consulta principal
      totalIncidentTypes,
      configuredIncidentTypes,
      totalPriorities,
      configuredPriorities,
      coverage: Math.round(coverage * 100) / 100,
      recentConfigurations: recentConfigurations.map(config => ({
        id: config.id,
        incidentTypeName: config.incidentTypeName,
        priorityName: config.priorityName || undefined,
        responseTimeHours: config.responseTimeHours,
        resolutionTimeHours: config.resolutionTimeHours,
        createdAt: config.createdAt.toISOString()
      }))
    };
  }

  /**
   * Calcular métricas de cumprimento de SLA
   */
  private async getSLAComplianceMetrics(companyId: number, departmentIds?: number[]): Promise<SLADashboardStats['slaCompliance']> {
    // Construir filtros base
    const baseFilters = [
      eq(tickets.company_id, companyId),
      sql`${tickets.created_at} >= NOW() - INTERVAL '30 days'`,
      isNotNull(tickets.department_id),
      isNotNull(tickets.incident_type_id)
    ];

    if (departmentIds && departmentIds.length > 0) {
      baseFilters.push(inArray(tickets.department_id, departmentIds));
    }

    // Buscar tickets com informações de SLA dos últimos 30 dias
    const ticketsWithSLA = await db
      .select({
        departmentId: tickets.department_id,
        departmentName: departments.name,
        ticketId: tickets.id,
        createdAt: tickets.created_at,
        firstResponseAt: tickets.first_response_at,
        resolvedAt: tickets.resolved_at,
        incidentTypeId: tickets.incident_type_id,
        priority: tickets.priority,
        status: tickets.status
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .where(and(...baseFilters))
      .orderBy(desc(tickets.created_at));

    // Buscar status history de todos os tickets em lote
    const ticketIds = ticketsWithSLA.map(t => t.ticketId);
    let allStatusHistory: any[] = [];
    if (ticketIds.length > 0) {
      allStatusHistory = await db
        .select({
          ticket_id: ticketStatusHistory.ticket_id,
          old_status: ticketStatusHistory.old_status,
          new_status: ticketStatusHistory.new_status,
          change_type: ticketStatusHistory.change_type,
          created_at: ticketStatusHistory.created_at
        })
        .from(ticketStatusHistory)
        .where(inArray(ticketStatusHistory.ticket_id, ticketIds))
        .orderBy(asc(ticketStatusHistory.created_at));
    }
    // Agrupar status history por ticket_id
    const statusMap = new Map<number, any[]>();
    for (const status of allStatusHistory) {
      if (!statusMap.has(status.ticket_id)) statusMap.set(status.ticket_id, []);
      statusMap.get(status.ticket_id)!.push(status);
    }

    const businessHours = getBusinessHoursConfig();

    // Agrupar por departamento e calcular métricas
    const departmentMetrics = new Map<number, {
      departmentName: string;
      totalTickets: number;
      onTimeResponse: number;
      onTimeResolution: number;
      totalResponseTime: number;
      totalResolutionTime: number;
      resolvedTickets: number;
    }>();

    for (const ticket of ticketsWithSLA) {
      if (!ticket.departmentId) continue;
      if (!departmentMetrics.has(ticket.departmentId)) {
        departmentMetrics.set(ticket.departmentId, {
          departmentName: ticket.departmentName || 'Departamento Desconhecido',
          totalTickets: 0,
          onTimeResponse: 0,
          onTimeResolution: 0,
          totalResponseTime: 0,
          totalResolutionTime: 0,
          resolvedTickets: 0
        });
      }
      const metrics = departmentMetrics.get(ticket.departmentId)!;
      metrics.totalTickets++;
      try {
        const sla = await this.slaService.resolveSLA({
          companyId,
          departmentId: ticket.departmentId,
          incidentTypeId: ticket.incidentTypeId!,
          priorityName: ticket.priority
        });
        if (!sla) continue; // Se não encontrou SLA, ignora o ticket
        // Calcular tempos de resposta e resolução usando tempo útil
        const statusHistory = statusMap.get(ticket.ticketId) || [];
        // Resposta
        if (ticket.firstResponseAt && sla) {
          const statusPeriods = convertStatusHistoryToPeriods(ticket.createdAt, ticket.status, statusHistory);
          const responseTimeMs = calculateEffectiveBusinessTime(ticket.createdAt, ticket.firstResponseAt, statusPeriods, businessHours);
          const responseTime = responseTimeMs / (1000 * 60 * 60); // horas
          metrics.totalResponseTime += responseTime;
          if (responseTime <= sla.responseTimeHours) {
            metrics.onTimeResponse++;
          }
        }
        // Resolução
        if (ticket.resolvedAt && sla) {
          const statusPeriods = convertStatusHistoryToPeriods(ticket.createdAt, ticket.status, statusHistory);
          const resolutionTimeMs = calculateEffectiveBusinessTime(ticket.createdAt, ticket.resolvedAt, statusPeriods, businessHours);
          const resolutionTime = resolutionTimeMs / (1000 * 60 * 60); // horas
          metrics.totalResolutionTime += resolutionTime;
          metrics.resolvedTickets++;
          if (resolutionTime <= sla.resolutionTimeHours) {
            metrics.onTimeResolution++;
          }
        }
      } catch (error) {
        console.error('Erro ao calcular SLA para ticket:', ticket.ticketId, error);
      }
    }
    return Array.from(departmentMetrics.entries()).map(([departmentId, metrics]) => ({
      departmentId,
      departmentName: metrics.departmentName,
      totalTickets: metrics.totalTickets,
      onTimeResponse: metrics.onTimeResponse,
      onTimeResolution: metrics.onTimeResolution,
      responseCompliance: metrics.totalTickets > 0 ? (metrics.onTimeResponse / metrics.totalTickets) * 100 : 0,
      resolutionCompliance: metrics.resolvedTickets > 0 ? (metrics.onTimeResolution / metrics.resolvedTickets) * 100 : 0,
      averageResponseTime: metrics.totalTickets > 0 ? metrics.totalResponseTime / metrics.totalTickets : 0,
      averageResolutionTime: metrics.resolvedTickets > 0 ? metrics.totalResolutionTime / metrics.resolvedTickets : 0
    }));
  }

  /**
   * Obter alertas de configurações faltantes
   */
  private async getMissingConfigurationAlerts(companyId: number, departmentIds?: number[]): Promise<SLADashboardStats['missingConfigurationAlerts']> {
    // Buscar todos os departamentos ativos da empresa
    let deptFilter: any[] = [eq(departments.company_id, companyId), eq(departments.is_active, true)];
    if (departmentIds && departmentIds.length > 0) {
      deptFilter.push(inArray(departments.id, departmentIds));
    }
    const allDepartments = await db.select({ id: departments.id, name: departments.name }).from(departments).where(and(...deptFilter));

    // Buscar todos os tipos de incidente ativos da empresa
    const allIncidentTypes = await db.select({ id: incidentTypes.id, name: incidentTypes.name }).from(incidentTypes).where(and(eq(incidentTypes.company_id, companyId)));

    // Buscar todas as prioridades ativas por departamento da empresa
    const allDeptPriorities = await db.select({
      id: departmentPriorities.id,
      name: departmentPriorities.name,
      departmentId: departmentPriorities.department_id
    }).from(departmentPriorities).where(and(eq(departmentPriorities.company_id, companyId), eq(departmentPriorities.is_active, true)));

    // Buscar todas as configurações de SLA ativas
    const allConfigs = await db.select({
      departmentId: slaConfigurations.department_id,
      incidentTypeId: slaConfigurations.incident_type_id,
      priorityId: slaConfigurations.priority_id
    }).from(slaConfigurations).where(and(eq(slaConfigurations.company_id, companyId), eq(slaConfigurations.is_active, true)));

    // Buscar todas as combinações realmente usadas em tickets reais
    const ticketCombos = await db
      .select({
        departmentId: tickets.department_id,
        incidentTypeId: tickets.incident_type_id,
        priority: tickets.priority
      })
      .from(tickets)
      .where(and(
        eq(tickets.company_id, companyId),
        isNotNull(tickets.department_id),
        isNotNull(tickets.incident_type_id),
        isNotNull(tickets.priority)
      ));
    // Montar set de combinações realmente usadas
    const usedCombos = new Set(ticketCombos.map(c => `${c.departmentId}_${c.incidentTypeId}_${c.priority}`));

    // Montar set de configs existentes
    const configSet = new Set(
      allConfigs.map(c => `${c.departmentId}_${c.incidentTypeId}_${c.priorityId ?? 'null'}`)
    );

    // Gerar apenas as combinações realmente usadas em tickets reais
    const missingAlerts: SLADashboardStats['missingConfigurationAlerts'] = [];
    for (const comboStr of Array.from(usedCombos)) {
      const [deptId, incidentId, priorityName] = comboStr.split('_');
      const dept = allDepartments.find(d => d.id.toString() === deptId);
      const incident = allIncidentTypes.find(i => i.id.toString() === incidentId);
      // Comparação de prioridade case insensitive
      const priority = allDeptPriorities.find(p => p.name.toLowerCase() === priorityName.toLowerCase() && p.departmentId.toString() === deptId);
      // Se não existe configuração para essa combinação
      const configKey = priority ? `${deptId}_${incidentId}_${priority.id}` : `${deptId}_${incidentId}_null`;
      if (!configSet.has(configKey)) {
        missingAlerts.push({
          departmentId: dept ? dept.id : Number(deptId),
          departmentName: dept ? dept.name : '',
          incidentTypeId: incident ? incident.id : Number(incidentId),
          incidentTypeName: incident ? incident.name : '',
          priorityId: priority ? priority.id : undefined,
          priorityName: priority ? priority.name : priorityName,
          ticketsAffected: 0
        });
      }
    }
    return missingAlerts;
  }

  /**
   * Contar configurações faltantes para um departamento
   */
  private async getMissingConfigurationsCount(companyId: number, departmentId: number): Promise<number> {
    // Esta é uma estimativa simples - na prática seria mais complexo
    // Consideramos o número de tipos de incidente sem configuração padrão
    const incidentTypesWithoutConfig = await db
      .select({ count: count() })
      .from(incidentTypes)
      .leftJoin(slaConfigurations, and(
        eq(slaConfigurations.incident_type_id, incidentTypes.id),
        eq(slaConfigurations.department_id, departmentId),
        eq(slaConfigurations.is_active, true)
      ))
      .where(and(
        eq(incidentTypes.company_id, companyId),
        isNull(slaConfigurations.id)
      ));

    return incidentTypesWithoutConfig[0].count;
  }
}

export const slaApi = new SLADashboardAPI(); 