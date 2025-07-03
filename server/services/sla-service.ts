/**
 * Serviço para resolução de SLA com hierarquia/fallback
 * Implementa cache e funções para determinar SLA de tickets
 */

import { db } from '../db';
import { 
  slaConfigurations,
  slaDefinitions,
  departmentPriorities,
  departments,
  companies,
  incidentTypes,
  type SlaConfiguration,
  type SLADefinition,
  type DepartmentPriority
} from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

// Interface para resultado de SLA resolvido
export interface ResolvedSLA {
  responseTimeHours: number;
  resolutionTimeHours: number;
  source: 'specific' | 'department_default' | 'company_default' | 'global_fallback';
  configId?: number;
  fallbackReason?: string;
}

// Interface para cache de configurações SLA
interface SLACacheEntry {
  data: ResolvedSLA;
  timestamp: number;
  ttl: number;
}

// Interface para parâmetros de resolução SLA
export interface SLAResolutionParams {
  companyId: number;
  departmentId: number;
  incidentTypeId: number;
  priorityId?: number;
  priorityName?: string; // Para fallback legacy
}

export class SLAService {
  private static instance: SLAService;
  private cache = new Map<string, SLACacheEntry>();
  
  // TTL do cache em milissegundos (15 minutos para configurações mais usadas)
  private readonly CACHE_TTL = 15 * 60 * 1000;
  private readonly POPULAR_CACHE_TTL = 30 * 60 * 1000; // 30 min para configs populares
  
  // Contador de uso para identificar configurações mais populares
  private usageCounter = new Map<string, number>();

  private constructor() {}

  public static getInstance(): SLAService {
    if (!SLAService.instance) {
      SLAService.instance = new SLAService();
    }
    return SLAService.instance;
  }

  /**
   * Resolve SLA para um ticket seguindo hierarquia de fallback
   * Hierarquia: Específico > Departamento Padrão > Empresa Padrão > Global Fallback
   */
  async resolveSLA(params: SLAResolutionParams): Promise<ResolvedSLA | null> {
    const cacheKey = this.generateCacheKey(params);
    
    // Verificar cache primeiro
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.incrementUsage(cacheKey);
      return cached;
    }

    let resolved: ResolvedSLA;
    
    try {
      // Nível 1: Configuração específica (empresa + dept + tipo + prioridade)
      resolved = await this.trySpecificConfiguration(params);
      if (resolved.source === 'specific') {
        this.setCache(cacheKey, resolved);
        this.incrementUsage(cacheKey);
        return resolved;
      }

      // Nível 2: Configuração padrão do departamento (sem prioridade específica)
      resolved = await this.tryDepartmentDefault(params);
      if (resolved.source === 'department_default') {
        this.setCache(cacheKey, resolved);
        return resolved;
      }

      // Nível 3: Configuração padrão da empresa (SLA definitions)
      resolved = await this.tryCompanyDefault(params);
      if (resolved.source === 'company_default') {
        this.setCache(cacheKey, resolved);
        return resolved;
      }

      // Nível 4: Sem configuração - NUNCA usar fallback hardcoded
      resolved = this.getNoSLAResult();
      if (resolved) {
        this.setCache(cacheKey, resolved);
      }
      return resolved;

    } catch (error) {
      console.error('Erro ao resolver SLA:', error);
      // Em caso de erro, retornar fallback global
      resolved = this.getNoSLAResult();
      resolved.fallbackReason = 'error_fallback';
      return resolved;
    }
  }

  /**
   * Normaliza uma prioridade para encontrar correspondência nas configurações
   */
  private normalizePriorityForSLA(priority: string | number, departmentPriorities?: DepartmentPriority[]): string {
    // Se é um número, tentar converter para nome
    if (typeof priority === 'number') {
      if (departmentPriorities) {
        const foundPriority = departmentPriorities.find(p => p.id === priority);
        if (foundPriority) return foundPriority.name;
      }
      
      // Fallback para números: assumir peso e mapear
      const weightMap: Record<number, string> = {
        1: 'Baixa',
        2: 'Média', 
        3: 'Alta',
        4: 'Crítica'
      };
      return weightMap[priority] || 'Média';
    }

    // Se é string, normalizar
    const normalized = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
    
    // Mapeamento de prioridades legadas
    const legacyMap: Record<string, string> = {
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta', 
      'critical': 'Crítica'
    };

    // Se é prioridade legada, traduzir
    if (legacyMap[priority.toLowerCase()]) {
      return legacyMap[priority.toLowerCase()];
    }

    // Retornar normalizada
    return normalized;
  }

  /**
   * Busca configuração de SLA com fallback inteligente de prioridade
   */
  private async findSLAConfigWithPriorityFallback(
    companyId: number,
    departmentId: number,
    incidentTypeId: number,
    originalPriority: string,
    dbInstance: any = null
  ): Promise<{ config: any; priorityUsed: string } | null> {
    const database = dbInstance || db;
    
    // Lista de prioridades para tentar em ordem de preferência
    const prioritiesToTry = [
      originalPriority,
      originalPriority.charAt(0).toUpperCase() + originalPriority.slice(1).toLowerCase(),
      originalPriority.toLowerCase(),
      originalPriority.toUpperCase()
    ];

    // Adicionar mapeamentos legados se aplicável
    const legacyMap: Record<string, string> = {
      'baixa': 'low',
      'média': 'medium',
      'alta': 'high',
      'crítica': 'critical',
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'critical': 'Crítica'
    };

    if (legacyMap[originalPriority.toLowerCase()]) {
      prioritiesToTry.push(legacyMap[originalPriority.toLowerCase()]);
    }

    // Tentar encontrar configuração para cada variação da prioridade
    for (const priorityVariant of prioritiesToTry) {
      // Primeiro, buscar por ID se a prioridade é um nome conhecido
      let priorityId: number | null = null;
      
      try {
        const [priority] = await database
          .select({ id: departmentPriorities.id })
          .from(departmentPriorities)
          .where(and(
            eq(departmentPriorities.company_id, companyId),
            eq(departmentPriorities.department_id, departmentId),
            eq(departmentPriorities.name, priorityVariant),
            eq(departmentPriorities.is_active, true)
          ))
          .limit(1);

        if (priority) {
          priorityId = priority.id;
        }
      } catch (error) {
        console.warn(`Erro ao buscar prioridade ${priorityVariant}:`, error);
      }

      // Tentar com priority_id se encontrou
      if (priorityId) {
        const config = await database
          .select()
          .from(slaConfigurations)
          .where(and(
            eq(slaConfigurations.company_id, companyId),
            eq(slaConfigurations.department_id, departmentId),
            eq(slaConfigurations.incident_type_id, incidentTypeId),
            eq(slaConfigurations.priority_id, priorityId),
            eq(slaConfigurations.is_active, true)
          ))
          .limit(1);

        if (config.length > 0) {
          console.log(`[SLA] Encontrou configuração para prioridade ID ${priorityId} (${priorityVariant})`);
          return { config: config[0], priorityUsed: priorityVariant };
        }
      }
    }

    return null;
  }

  /**
   * Nível 1: Tentar configuração específica com fallback de prioridade
   */
  private async trySpecificConfiguration(params: SLAResolutionParams): Promise<ResolvedSLA> {
    let priorityForQuery = this.normalizePriorityForSLA(params.priorityName || params.priorityId || 'Média');
    
    // Tentar encontrar configuração com fallback de prioridade
    const result = await this.findSLAConfigWithPriorityFallback(
      params.companyId,
      params.departmentId,
      params.incidentTypeId,
      priorityForQuery
    );

    if (result) {
      console.log(`[SLA] Configuração específica encontrada com prioridade: ${result.priorityUsed}`);
      return {
        responseTimeHours: result.config.response_time_hours,
        resolutionTimeHours: result.config.resolution_time_hours,
        source: 'specific',
        configId: result.config.id
      };
    }

    return { responseTimeHours: 0, resolutionTimeHours: 0, source: 'department_default' };
  }

  /**
   * Nível 2: Tentar configuração padrão do departamento
   */
  private async tryDepartmentDefault(params: SLAResolutionParams): Promise<ResolvedSLA> {
    // Buscar configuração sem prioridade específica (NULL priority_id)
    const config = await db
      .select()
      .from(slaConfigurations)
      .where(and(
        eq(slaConfigurations.company_id, params.companyId),
        eq(slaConfigurations.department_id, params.departmentId),
        eq(slaConfigurations.incident_type_id, params.incidentTypeId),
        isNull(slaConfigurations.priority_id),
        eq(slaConfigurations.is_active, true)
      ))
      .limit(1);

    if (config.length > 0) {
      const slaConfig = config[0];
      return {
        responseTimeHours: slaConfig.response_time_hours,
        resolutionTimeHours: slaConfig.resolution_time_hours,
        source: 'department_default',
        configId: slaConfig.id
      };
    }

    return { responseTimeHours: 0, resolutionTimeHours: 0, source: 'company_default' };
  }

  /**
   * Nível 3: Tentar configuração padrão da empresa
   */
  private async tryCompanyDefault(params: SLAResolutionParams): Promise<ResolvedSLA> {
    let priorityForQuery = params.priorityName || 'medium';
    
    // Se temos priorityId, buscar o nome da prioridade
    if (params.priorityId) {
      const priority = await db
        .select({ name: departmentPriorities.name })
        .from(departmentPriorities)
        .where(eq(departmentPriorities.id, params.priorityId))
        .limit(1);
      
      if (priority.length > 0) {
        priorityForQuery = priority[0].name;
      }
    }

    const config = await db
      .select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.company_id, params.companyId),
        eq(slaDefinitions.priority, priorityForQuery as any)
      ))
      .limit(1);

    if (config.length > 0) {
      const slaConfig = config[0];
      return {
        responseTimeHours: slaConfig.response_time_hours,
        resolutionTimeHours: slaConfig.resolution_time_hours,
        source: 'company_default',
        configId: slaConfig.id
      };
    }

    return { responseTimeHours: 0, resolutionTimeHours: 0, source: 'global_fallback' };
  }

  /**
   * Nível 4: Sem configuração - NUNCA usar fallback hardcoded
   */
  private getNoSLAResult(): ResolvedSLA | null {
    console.log(`[SLA] NENHUMA configuração de SLA encontrada - Sem SLA configurado`);
    
    // NUNCA retornar valores hardcoded - sempre null se não encontrar configuração real
    return null;
  }

  /**
   * Função específica para determinar SLA de um ticket
   */
  async getTicketSLA(
    companyId: number,
    departmentId: number,
    incidentTypeId: number,
    priority: string | number
  ): Promise<ResolvedSLA> {
    const params: SLAResolutionParams = {
      companyId,
      departmentId,
      incidentTypeId
    };

    // Se priority é número, assumir que é ID da prioridade
    if (typeof priority === 'number') {
      params.priorityId = priority;
    } else {
      params.priorityName = priority;
    }

    return this.resolveSLA(params);
  }

  /**
   * Pré-carrega configurações mais usadas no cache
   */
  async preloadPopularConfigurations(): Promise<void> {
    // Buscar as 50 configurações mais populares pelos contadores de uso
    const popularKeys = Array.from(this.usageCounter.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([key]) => key);

    for (const key of popularKeys) {
      // Se não está em cache, recarregar
      if (!this.cache.has(key)) {
        try {
          const params = this.parseCacheKey(key);
          const resolved = await this.resolveSLA(params);
          this.setCache(key, resolved, this.POPULAR_CACHE_TTL);
        } catch (error) {
          console.warn(`Erro ao pré-carregar configuração ${key}:`, error);
        }
      }
    }
  }

  /**
   * Limpa cache expirado
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats(): { size: number; hitRate: number; popularConfigs: string[] } {
    const totalUsage = Array.from(this.usageCounter.values()).reduce((a, b) => a + b, 0);
    const cacheHits = Array.from(this.usageCounter.values()).filter(count => count > 1).length;
    const hitRate = totalUsage > 0 ? (cacheHits / totalUsage) * 100 : 0;
    
    const popularConfigs = Array.from(this.usageCounter.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([key]) => key);

    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      popularConfigs
    };
  }

  // Métodos auxiliares para cache
  private generateCacheKey(params: SLAResolutionParams): string {
    return `sla:${params.companyId}:${params.departmentId}:${params.incidentTypeId}:${params.priorityId || params.priorityName || 'default'}`;
  }

  private parseCacheKey(key: string): SLAResolutionParams {
    const [, companyId, departmentId, incidentTypeId, priority] = key.split(':');
    
    const params: SLAResolutionParams = {
      companyId: parseInt(companyId),
      departmentId: parseInt(departmentId),
      incidentTypeId: parseInt(incidentTypeId)
    };

    // Se priority é número, é priorityId, senão é priorityName
    if (/^\d+$/.test(priority)) {
      params.priorityId = parseInt(priority);
    } else if (priority !== 'default') {
      params.priorityName = priority;
    }

    return params;
  }

  private getFromCache(key: string): ResolvedSLA | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: ResolvedSLA, ttl = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private incrementUsage(key: string): void {
    const current = this.usageCounter.get(key) || 0;
    this.usageCounter.set(key, current + 1);
  }
}

// Exportar instância singleton
export const slaService = SLAService.getInstance(); 