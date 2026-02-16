/**
 * API para Dashboard de SLA
 * Fornece estatísticas, métricas de cumprimento e alertas de configurações
 */

import { db } from '../db';
import { 
  slaConfigurations,
  slaDefinitions,
  departments,
  incidentTypes,
  departmentPriorities,
  categories,
  tickets,
  type SlaConfiguration,
  ticketStatusHistory
} from '@shared/schema';
import { eq, and, count, sql, desc, asc, isNotNull, inArray } from 'drizzle-orm';
import { isNull } from 'drizzle-orm/sql';
import { type ResolvedSLA, type SLAResolutionParams } from '../services/sla-service';
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

// Interface para dados pré-carregados de SLA
interface PreloadedSLAData {
  // Configurações SLA ativas indexadas por chave
  slaConfigs: Map<string, SlaConfiguration>;
  // Modos dos departamentos (category | type)
  departmentModes: Map<number, 'category' | 'type'>;
  // Prioridades por departamento indexadas por nome (case-insensitive)
  prioritiesByDept: Map<number, Map<string, { id: number; name: string }>>;
  // SLA Definitions (fallback empresa) indexadas por priority
  companySlaDefinitions: Map<string, { responseTimeHours: number; resolutionTimeHours: number }>;
}

export class SLADashboardAPI {
  constructor() {
    // SLA Service removido - usando resolver em memória otimizado
  }

  /**
   * Pré-carrega todas as configurações SLA em batch para otimização
   */
  private async preloadSLAData(companyId: number, departmentIds?: number[]): Promise<PreloadedSLAData> {
    // Filtros base
    const companyFilter = eq(slaConfigurations.company_id, companyId);
    const baseFilters = [companyFilter];
    
    if (departmentIds && departmentIds.length > 0) {
      baseFilters.push(inArray(slaConfigurations.department_id, departmentIds));
    }

    // 1. Buscar todas as configurações SLA ativas de uma vez
    const allSlaConfigs = await db
      .select()
      .from(slaConfigurations)
      .where(and(...baseFilters, eq(slaConfigurations.is_active, true)));

    // 2. Buscar modos dos departamentos
    const deptFilter: any[] = [eq(departments.company_id, companyId)];
    if (departmentIds && departmentIds.length > 0) {
      deptFilter.push(inArray(departments.id, departmentIds));
    }
    const allDepartments = await db
      .select({ id: departments.id, sla_mode: departments.sla_mode })
      .from(departments)
      .where(and(...deptFilter));

    // 3. Buscar todas as prioridades por departamento
    const priorityFilter: any[] = [eq(departmentPriorities.company_id, companyId), eq(departmentPriorities.is_active, true)];
    if (departmentIds && departmentIds.length > 0) {
      priorityFilter.push(inArray(departmentPriorities.department_id, departmentIds));
    }
    const allPriorities = await db
      .select({
        id: departmentPriorities.id,
        name: departmentPriorities.name,
        departmentId: departmentPriorities.department_id
      })
      .from(departmentPriorities)
      .where(and(...priorityFilter));

    // 4. Buscar SLA Definitions (fallback empresa)
    const allSlaDefinitions = await db
      .select()
      .from(slaDefinitions)
      .where(eq(slaDefinitions.company_id, companyId));

    // Construir estruturas de dados indexadas
    const slaConfigsMap = new Map<string, SlaConfiguration>();
    for (const config of allSlaConfigs) {
      const key = this.buildSLAConfigKey(
        config.department_id,
        config.incident_type_id,
        config.category_id,
        config.priority_id
      );
      slaConfigsMap.set(key, config);
    }

    const departmentModesMap = new Map<number, 'category' | 'type'>();
    for (const dept of allDepartments) {
      departmentModesMap.set(dept.id, (dept.sla_mode || 'type') as 'category' | 'type');
    }

    const prioritiesByDeptMap = new Map<number, Map<string, { id: number; name: string }>>();
    for (const priority of allPriorities) {
      if (!prioritiesByDeptMap.has(priority.departmentId)) {
        prioritiesByDeptMap.set(priority.departmentId, new Map());
      }
      const deptPriorities = prioritiesByDeptMap.get(priority.departmentId)!;
      // Indexar por nome normalizado (case-insensitive)
      const normalizedName = this.normalizePriorityName(priority.name);
      deptPriorities.set(normalizedName, { id: priority.id, name: priority.name });
    }

    const companySlaDefinitionsMap = new Map<string, { responseTimeHours: number; resolutionTimeHours: number }>();
    for (const def of allSlaDefinitions) {
      const normalizedPriority = this.normalizePriorityName(def.priority);
      companySlaDefinitionsMap.set(normalizedPriority, {
        responseTimeHours: def.response_time_hours,
        resolutionTimeHours: def.resolution_time_hours
      });
    }

    return {
      slaConfigs: slaConfigsMap,
      departmentModes: departmentModesMap,
      prioritiesByDept: prioritiesByDeptMap,
      companySlaDefinitions: companySlaDefinitionsMap
    };
  }

  /**
   * Constrói chave para índice de configurações SLA
   */
  private buildSLAConfigKey(
    departmentId: number,
    incidentTypeId: number,
    categoryId: number | null,
    priorityId: number | null
  ): string {
    return `${departmentId}:${incidentTypeId}:${categoryId ?? 'null'}:${priorityId ?? 'null'}`;
  }

  /**
   * Normaliza nome de prioridade para comparação case-insensitive
   */
  private normalizePriorityName(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }

  /**
   * Resolve SLA em memória usando dados pré-carregados
   * Replica exatamente a lógica do SLAService.resolveSLA
   */
  private resolveSLAInMemory(
    params: SLAResolutionParams,
    data: PreloadedSLAData
  ): ResolvedSLA {
    const departmentMode = data.departmentModes.get(params.departmentId);
    const isCategoryMode = departmentMode === 'category';

    if (isCategoryMode) {
      // Modo categoria: procurar apenas configs com category_id
      return this.tryCategoryModeInMemory(params, data) || this.getNoSLAResult();
    } else {
      // Modo tipo: hierarquia completa
      // Nível 1: Configuração específica
      const specific = this.trySpecificConfigurationInMemory(params, data);
      if (specific && specific.source === 'specific') {
        return specific;
      }

      // Nível 2: Configuração padrão do departamento
      const deptDefault = this.tryDepartmentDefaultInMemory(params, data);
      if (deptDefault && deptDefault.source === 'department_default') {
        return deptDefault;
      }

      // Nível 3: Configuração padrão da empresa
      const companyDefault = this.tryCompanyDefaultInMemory(params, data);
      if (companyDefault && companyDefault.source === 'company_default') {
        return companyDefault;
      }

      // Nível 4: Sem configuração
      return this.getNoSLAResult();
    }
  }

  /**
   * Tenta encontrar configuração específica (com prioridade)
   */
  private trySpecificConfigurationInMemory(
    params: SLAResolutionParams,
    data: PreloadedSLAData
  ): ResolvedSLA | null {
    const priorityName = params.priorityName || 'Média';
    const normalizedPriority = this.normalizePriorityName(priorityName);
    
    // Buscar prioridade no departamento
    const deptPriorities = data.prioritiesByDept.get(params.departmentId);
    if (!deptPriorities) {
      return null;
    }

    // Tentar encontrar prioridade com diferentes variações
    const priorityVariants = [
      normalizedPriority,
      priorityName,
      priorityName.toLowerCase(),
      priorityName.toUpperCase(),
      priorityName.charAt(0).toUpperCase() + priorityName.slice(1).toLowerCase()
    ];

    // Mapeamento legado
    const legacyMap: Record<string, string> = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'critical': 'Crítica',
      'baixa': 'Baixa',
      'média': 'Média',
      'media': 'Média',
      'alta': 'Alta',
      'crítica': 'Crítica',
      'critica': 'Crítica'
    };

    if (legacyMap[priorityName.toLowerCase()]) {
      priorityVariants.push(legacyMap[priorityName.toLowerCase()]);
    }

    let priorityId: number | null = null;
    for (const variant of priorityVariants) {
      const normalizedVariant = this.normalizePriorityName(variant);
      const priority = deptPriorities.get(normalizedVariant);
      if (priority) {
        priorityId = priority.id;
        break;
      }
    }

    // Se encontrou priorityId, buscar configuração
    if (priorityId) {
      const key = this.buildSLAConfigKey(
        params.departmentId,
        params.incidentTypeId,
        params.categoryId ?? null,
        priorityId
      );
      const config = data.slaConfigs.get(key);
      if (config) {
        return {
          responseTimeHours: config.response_time_hours,
          resolutionTimeHours: config.resolution_time_hours,
          source: 'specific',
          configId: config.id
        };
      }
    }

    return null;
  }

  /**
   * Tenta encontrar configuração padrão do departamento (sem prioridade)
   */
  private tryDepartmentDefaultInMemory(
    params: SLAResolutionParams,
    data: PreloadedSLAData
  ): ResolvedSLA | null {
    const key = this.buildSLAConfigKey(
      params.departmentId,
      params.incidentTypeId,
      params.categoryId ?? null,
      null // priority_id NULL = padrão do departamento
    );
    const config = data.slaConfigs.get(key);
    if (config) {
      return {
        responseTimeHours: config.response_time_hours,
        resolutionTimeHours: config.resolution_time_hours,
        source: 'department_default',
        configId: config.id
      };
    }
    return null;
  }

  /**
   * Tenta encontrar configuração padrão da empresa (SLA Definitions)
   */
  private tryCompanyDefaultInMemory(
    params: SLAResolutionParams,
    data: PreloadedSLAData
  ): ResolvedSLA | null {
    let priorityName = params.priorityName || 'Média';
    
    // Se temos priorityId, tentar buscar o nome
    if (params.priorityId) {
      const deptPriorities = data.prioritiesByDept.get(params.departmentId);
      if (deptPriorities) {
        for (const [_normalized, priority] of deptPriorities.entries()) {
          if (priority.id === params.priorityId) {
            priorityName = priority.name;
            break;
          }
        }
      }
    }

    const normalizedPriority = this.normalizePriorityName(priorityName);
    const def = data.companySlaDefinitions.get(normalizedPriority);
    
    if (def) {
      return {
        responseTimeHours: def.responseTimeHours,
        resolutionTimeHours: def.resolutionTimeHours,
        source: 'company_default'
      };
    }

    return null;
  }

  /**
   * Tenta encontrar configuração em modo categoria
   */
  private tryCategoryModeInMemory(
    params: SLAResolutionParams,
    data: PreloadedSLAData
  ): ResolvedSLA | null {
    if (!params.categoryId) {
      return null;
    }

    const priorityName = params.priorityName || 'Média';
    const normalizedPriority = this.normalizePriorityName(priorityName);
    
    // Buscar prioridade no departamento
    const deptPriorities = data.prioritiesByDept.get(params.departmentId);
    if (!deptPriorities) {
      return null;
    }

    // Tentar encontrar prioridade
    const priorityVariants = [
      normalizedPriority,
      priorityName,
      priorityName.toLowerCase(),
      priorityName.toUpperCase()
    ];

    const legacyMap: Record<string, string> = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'critical': 'Crítica',
      'baixa': 'Baixa',
      'média': 'Média',
      'media': 'Média',
      'alta': 'Alta',
      'crítica': 'Crítica',
      'critica': 'Crítica'
    };

    if (legacyMap[priorityName.toLowerCase()]) {
      priorityVariants.push(legacyMap[priorityName.toLowerCase()]);
    }

    let priorityId: number | null = null;
    for (const variant of priorityVariants) {
      const normalizedVariant = this.normalizePriorityName(variant);
      const priority = deptPriorities.get(normalizedVariant);
      if (priority) {
        priorityId = priority.id;
        break;
      }
    }

    // 1) Tentar com priority_id
    if (priorityId) {
      const key = this.buildSLAConfigKey(
        params.departmentId,
        params.incidentTypeId,
        params.categoryId,
        priorityId
      );
      const config = data.slaConfigs.get(key);
      if (config) {
        return {
          responseTimeHours: config.response_time_hours,
          resolutionTimeHours: config.resolution_time_hours,
          source: 'specific',
          configId: config.id
        };
      }
    }

    // 2) Tentar padrão de categoria (priority_id NULL)
    const defaultKey = this.buildSLAConfigKey(
      params.departmentId,
      params.incidentTypeId,
      params.categoryId,
      null
    );
    const defaultConfig = data.slaConfigs.get(defaultKey);
    if (defaultConfig) {
      return {
        responseTimeHours: defaultConfig.response_time_hours,
        resolutionTimeHours: defaultConfig.resolution_time_hours,
        source: 'department_default',
        configId: defaultConfig.id
      };
    }

    return null;
  }

  /**
   * Retorna resultado quando não há configuração SLA
   */
  private getNoSLAResult(): ResolvedSLA {
    return {
      responseTimeHours: 24,
      resolutionTimeHours: 72,
      source: 'no_config',
      configId: undefined,
      fallbackReason: 'no_configuration'
    };
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
      .where(and(...baseFilters, eq(slaConfigurations.is_active, true), eq(departments.is_active, true))) // Filtrar apenas departamentos ativos
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
   * OTIMIZADO: Usa resolver em memória ao invés de N queries
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

    // OTIMIZAÇÃO: Pré-carregar todas as configurações SLA em batch
    const preloadedData = await this.preloadSLAData(companyId, departmentIds);

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
        categoryId: tickets.category_id,
        priority: tickets.priority,
        status: tickets.status
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.department_id, departments.id))
      .where(and(...baseFilters, eq(departments.is_active, true))) // Filtrar apenas departamentos ativos
      .orderBy(desc(tickets.created_at));

    // Se não há tickets, retornar array vazio
    if (ticketsWithSLA.length === 0) {
      return [];
    }

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

    // OTIMIZAÇÃO: Loop sem await - resolver SLA em memória
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
      try {
        // OTIMIZAÇÃO: Resolver SLA em memória (sem query ao banco)
        const sla = this.resolveSLAInMemory({
          companyId,
          departmentId: ticket.departmentId,
          incidentTypeId: ticket.incidentTypeId!,
          priorityName: ticket.priority,
          categoryId: ticket.categoryId ?? undefined
        }, preloadedData);

        if (!sla) continue; // Sem SLA: não conta em cumprimento
        metrics.totalTickets++;
        // Calcular tempos de resposta e resolução usando tempo útil
        // MANTÉM A MESMA LÓGICA DE CÁLCULO
        const statusHistory = statusMap.get(ticket.ticketId) || [];
        // Resposta - Se não tem firstResponseAt mas tem resolvedAt, usar resolvedAt
        if ((ticket.firstResponseAt || ticket.resolvedAt) && sla) {
          const statusPeriods = convertStatusHistoryToPeriods(ticket.createdAt, ticket.status, statusHistory);
          const firstResponseTime = ticket.firstResponseAt || ticket.resolvedAt!; // Garantir que não é null
          const responseTimeMs = calculateEffectiveBusinessTime(ticket.createdAt, firstResponseTime, statusPeriods, businessHours);
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

    // Retornar apenas departamentos que têm tickets válidos (com SLA configurado)
    return Array.from(departmentMetrics.entries())
      .filter(([_, metrics]) => metrics.totalTickets > 0) // Filtrar apenas departamentos com tickets
      .map(([departmentId, metrics]) => ({
        departmentId,
        departmentName: metrics.departmentName,
        totalTickets: metrics.totalTickets,
        onTimeResponse: metrics.onTimeResponse,
        onTimeResolution: metrics.onTimeResolution,
        responseCompliance: (metrics.onTimeResponse / metrics.totalTickets) * 100,
        resolutionCompliance: metrics.resolvedTickets > 0 ? (metrics.onTimeResolution / metrics.resolvedTickets) * 100 : 0,
        averageResponseTime: metrics.totalResponseTime / metrics.totalTickets,
        averageResolutionTime: metrics.resolvedTickets > 0 ? metrics.totalResolutionTime / metrics.resolvedTickets : 0
      }));
  }

  /**
   * Obter alertas de configurações faltantes
   */
  private async getMissingConfigurationAlerts(companyId: number, departmentIds?: number[]): Promise<SLADashboardStats['missingConfigurationAlerts']> {
    // Buscar todos os departamentos ativos da empresa
    const deptFilter: any[] = [eq(departments.company_id, companyId), eq(departments.is_active, true)];
    if (departmentIds && departmentIds.length > 0) {
      deptFilter.push(inArray(departments.id, departmentIds));
    }
    const allDepartments = await db.select({ id: departments.id, name: departments.name, sla_mode: departments.sla_mode }).from(departments).where(and(...deptFilter));

    // Buscar todos os tipos de incidente ativos da empresa
    const incidentTypeFilter = [eq(incidentTypes.company_id, companyId)];
    if (departmentIds && departmentIds.length > 0) {
      incidentTypeFilter.push(inArray(incidentTypes.department_id, departmentIds));
    }
    const allIncidentTypes = await db.select({ id: incidentTypes.id, name: incidentTypes.name }).from(incidentTypes).where(and(...incidentTypeFilter));

    // Buscar todas as prioridades ativas por departamento da empresa
    const priorityFilter = [eq(departmentPriorities.company_id, companyId), eq(departmentPriorities.is_active, true)];
    if (departmentIds && departmentIds.length > 0) {
      priorityFilter.push(inArray(departmentPriorities.department_id, departmentIds));
    }
    const allDeptPriorities = await db.select({
      id: departmentPriorities.id,
      name: departmentPriorities.name,
      departmentId: departmentPriorities.department_id
    }).from(departmentPriorities).where(and(...priorityFilter));

    // Buscar todas as configurações de SLA ativas
    const configFilter = [eq(slaConfigurations.company_id, companyId), eq(slaConfigurations.is_active, true)];
    if (departmentIds && departmentIds.length > 0) {
      configFilter.push(inArray(slaConfigurations.department_id, departmentIds));
    }
    const allConfigs = await db.select({
      departmentId: slaConfigurations.department_id,
      incidentTypeId: slaConfigurations.incident_type_id,
      categoryId: slaConfigurations.category_id,
      priorityId: slaConfigurations.priority_id
    }).from(slaConfigurations).where(and(...configFilter));

    // Buscar todas as combinações realmente usadas em tickets reais
    const ticketFilter = [
      eq(tickets.company_id, companyId),
      isNotNull(tickets.department_id),
      isNotNull(tickets.incident_type_id),
      isNotNull(tickets.priority)
    ];
    
    if (departmentIds && departmentIds.length > 0) {
      ticketFilter.push(inArray(tickets.department_id, departmentIds));
    }
    
    const ticketCombos = await db
      .select({
        departmentId: tickets.department_id,
        incidentTypeId: tickets.incident_type_id,
        categoryId: tickets.category_id,
        priority: tickets.priority
      })
      .from(tickets)
      .where(and(...ticketFilter));
    // Montar set de combinações realmente usadas
    const deptModeMap = new Map(allDepartments.map(d => [d.id, d.sla_mode] as const));
    const usedCombos = new Set(
      ticketCombos.map(c => {
        const mode = deptModeMap.get(c.departmentId || 0);
        if (mode === 'category') {
          return `${c.departmentId}_${c.incidentTypeId}_${c.categoryId ?? 'null'}_${c.priority}`;
        }
        return `${c.departmentId}_${c.incidentTypeId}_${c.priority}`;
      })
    );

    // Montar set de configs existentes
    const configSet = new Set(
      allConfigs.map(c => `${c.departmentId}_${c.incidentTypeId}_${c.categoryId ?? 'null'}_${c.priorityId ?? 'null'}`)
    );

    // Gerar apenas as combinações realmente usadas em tickets reais
    const missingAlerts: SLADashboardStats['missingConfigurationAlerts'] = [];
    for (const comboStr of Array.from(usedCombos)) {
      const parts = comboStr.split('_');
      const deptId = parts[0];
      const incidentId = parts[1];
      const mode = deptModeMap.get(parseInt(deptId, 10));
      const categoryIdStr = mode === 'category' ? parts[2] : 'null';
      const priorityName = mode === 'category' ? parts[3] : parts[2];
      const dept = allDepartments.find(d => d.id.toString() === deptId);
      const incident = allIncidentTypes.find(i => i.id.toString() === incidentId);
      // Comparação de prioridade case insensitive
      const priority = allDeptPriorities.find(p => p.name.toLowerCase() === priorityName.toLowerCase() && p.departmentId.toString() === deptId);
      // Se não existe configuração para essa combinação
      const configKey = priority 
        ? `${deptId}_${incidentId}_${categoryIdStr}_${priority.id}` 
        : `${deptId}_${incidentId}_${categoryIdStr}_null`;
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
    // Cobertura depende do modo do departamento
    const [dept] = await db
      .select({ sla_mode: departments.sla_mode })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    const isCategoryMode = dept?.sla_mode === 'category';

    if (isCategoryMode) {
      // Contar categorias ativas (por tipo) sem nenhuma configuração SLA ativa
      const result = await db
        .select({ count: count() })
        .from(incidentTypes)
        .innerJoin(categories, eq(categories.incident_type_id, incidentTypes.id))
        .leftJoin(slaConfigurations, and(
          eq(slaConfigurations.company_id, companyId),
          eq(slaConfigurations.department_id, departmentId),
          eq(slaConfigurations.incident_type_id, incidentTypes.id),
          eq(slaConfigurations.category_id, categories.id),
          eq(slaConfigurations.is_active, true)
        ))
        .where(and(
          eq(incidentTypes.company_id, companyId),
          eq(incidentTypes.department_id, departmentId),
          eq(incidentTypes.is_active, true),
          eq(categories.is_active, true),
          isNull(slaConfigurations.id)
        ));
      return result[0]?.count || 0;
    }

    // Modo por tipo (antigo): incident types sem nenhuma configuração ativa
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
        eq(incidentTypes.department_id, departmentId),
        eq(incidentTypes.is_active, true),
        isNull(slaConfigurations.id)
      ));

    return incidentTypesWithoutConfig[0]?.count || 0;
  }
}

export const slaApi = new SLADashboardAPI(); 