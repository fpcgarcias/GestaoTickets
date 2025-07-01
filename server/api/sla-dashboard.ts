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
  type IncidentType
} from '@shared/schema';
import { eq, and, count, sql, desc, asc, isNull, isNotNull, inArray } from 'drizzle-orm';
import { SLAService } from '../services/sla-service';

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

    // Adicionar filtro de departamentos se fornecido
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
        priority: tickets.priority
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .where(and(...baseFilters))
      .orderBy(desc(tickets.created_at));

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

      // Obter SLA para este ticket
      try {
        const sla = await this.slaService.resolveSLA({
          companyId,
          departmentId: ticket.departmentId,
          incidentTypeId: ticket.incidentTypeId!,
          priorityName: ticket.priority
        });

        // Calcular tempos de resposta e resolução
        if (ticket.firstResponseAt) {
          const responseTime = (ticket.firstResponseAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60); // horas
          metrics.totalResponseTime += responseTime;
          
          if (responseTime <= sla.responseTimeHours) {
            metrics.onTimeResponse++;
          }
        }

        if (ticket.resolvedAt) {
          const resolutionTime = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60); // horas
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

    // Converter para formato de resposta
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
    // Construir filtros base
    const baseFilters = [
      eq(tickets.company_id, companyId),
      sql`${tickets.created_at} >= NOW() - INTERVAL '7 days'`,
      isNotNull(tickets.department_id),
      isNotNull(tickets.incident_type_id)
    ];

    // Adicionar filtro de departamentos se fornecido
    if (departmentIds && departmentIds.length > 0) {
      baseFilters.push(inArray(tickets.department_id, departmentIds));
    }

    // Buscar combinações únicas de departamento/tipo/prioridade nos tickets dos últimos 7 dias
    const ticketCombinations = await db
      .select({
        departmentId: tickets.department_id,
        departmentName: departments.name,
        incidentTypeId: tickets.incident_type_id,
        incidentTypeName: incidentTypes.name,
        priority: tickets.priority,
        ticketCount: count()
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .leftJoin(incidentTypes, eq(tickets.incident_type_id, incidentTypes.id))
      .where(and(...baseFilters))
      .groupBy(
        tickets.department_id,
        departments.name,
        tickets.incident_type_id,
        incidentTypes.name,
        tickets.priority
      );

    // Verificar quais combinações não têm configuração SLA
    const missingAlerts: SLADashboardStats['missingConfigurationAlerts'] = [];

    for (const combo of ticketCombinations) {
      if (!combo.departmentId || !combo.incidentTypeId) continue;

      // Verificar se existe configuração SLA para esta combinação
      const existingConfig = await db
        .select({ id: slaConfigurations.id })
        .from(slaConfigurations)
        .where(and(
          eq(slaConfigurations.company_id, companyId),
          eq(slaConfigurations.department_id, combo.departmentId),
          eq(slaConfigurations.incident_type_id, combo.incidentTypeId),
          eq(slaConfigurations.is_active, true)
        ))
        .limit(1);

      if (existingConfig.length === 0) {
        missingAlerts.push({
          departmentId: combo.departmentId,
          departmentName: combo.departmentName || 'Departamento Desconhecido',
          incidentTypeId: combo.incidentTypeId,
          incidentTypeName: combo.incidentTypeName || 'Tipo Desconhecido',
          priorityName: combo.priority,
          ticketsAffected: combo.ticketCount
        });
      }
    }

    return missingAlerts.sort((a, b) => b.ticketsAffected - a.ticketsAffected);
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