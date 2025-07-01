/**
 * Utilitário para resolver SLA usando o novo sistema hierárquico
 * Integra com o sla-service.ts do servidor
 */

// Interface para compatibilidade com o sistema existente
export interface SLAConfig {
  responseTimeHours: number;
  resolutionTimeHours: number;
  source?: 'specific' | 'department_default' | 'company_default' | 'global_fallback';
  configId?: number;
}

// Cache local para requisições SLA (lado cliente)
class SLACache {
  private cache = new Map<string, { data: SLAConfig; timestamp: number }>();
  private readonly TTL = 10 * 60 * 1000; // 10 minutos

  set(key: string, data: SLAConfig): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): SLAConfig | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const slaCache = new SLACache();

/**
 * Resolve SLA para um ticket usando o novo sistema hierárquico
 */
export async function resolveSLA(
  companyId: number,
  departmentId: number,
  incidentTypeId: number,
  priority: string | number
): Promise<SLAConfig> {
  const cacheKey = `${companyId}:${departmentId}:${incidentTypeId}:${priority}`;
  
  // Verificar cache local primeiro
  const cached = slaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Chamar endpoint do servidor
    const response = await fetch('/api/sla/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companyId,
        departmentId,
        incidentTypeId,
        priority
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao resolver SLA: ${response.statusText}`);
    }

    const slaConfig: SLAConfig = await response.json();
    
    // Armazenar no cache
    slaCache.set(cacheKey, slaConfig);
    
    return slaConfig;
    
  } catch (error) {
    console.warn('Erro ao resolver SLA, usando fallback:', error);
    
    // Fallback local em caso de erro
    return getFallbackSLA(priority);
  }
}

/**
 * Fallback local para casos de erro
 */
function getFallbackSLA(priority: string | number): SLAConfig {
  let priorityName: string;
  
  if (typeof priority === 'number') {
    // Assumir que números correspondem a IDs e usar medium como padrão
    priorityName = 'medium';
  } else {
    priorityName = priority.toLowerCase();
  }

  const fallbackSLAs: Record<string, { response: number; resolution: number }> = {
    'low': { response: 24, resolution: 72 },
    'medium': { response: 8, resolution: 24 },
    'high': { response: 4, resolution: 12 },
    'critical': { response: 1, resolution: 4 }
  };

  const sla = fallbackSLAs[priorityName] || fallbackSLAs['medium'];

  return {
    responseTimeHours: sla.response,
    resolutionTimeHours: sla.resolution,
    source: 'global_fallback'
  };
}

/**
 * Função de conveniência para integração com componentes existentes
 */
export async function getTicketSLAConfig(
  companyId: number,
  departmentId: number,
  incidentTypeId: number,
  priority: string | number
): Promise<{ resolution_time_hours: number; response_time_hours: number; source?: string }> {
  const sla = await resolveSLA(companyId, departmentId, incidentTypeId, priority);
  
  return {
    resolution_time_hours: sla.resolutionTimeHours,
    response_time_hours: sla.responseTimeHours,
    source: sla.source
  };
}

/**
 * Limpa o cache local de SLA
 */
export function clearSLACache(): void {
  slaCache.clear();
}

/**
 * Pré-carrega SLA para configurações comuns
 */
export async function preloadCommonSLAs(
  companyId: number,
  departmentId: number,
  incidentTypeIds: number[],
  priorities: (string | number)[]
): Promise<void> {
  const promises: Promise<SLAConfig>[] = [];
  
  for (const incidentTypeId of incidentTypeIds) {
    for (const priority of priorities) {
      promises.push(resolveSLA(companyId, departmentId, incidentTypeId, priority));
    }
  }
  
  try {
    await Promise.all(promises);
    console.log('SLAs pré-carregados com sucesso');
  } catch (error) {
    console.warn('Erro ao pré-carregar SLAs:', error);
  }
} 