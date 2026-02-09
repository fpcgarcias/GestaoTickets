/**
 * Utilitários para o Sistema de Prioridades Flexíveis
 * Gerencia prioridades customizáveis por departamento com fallback para sistema legado
 */

import type { DepartmentPriority, Department, Company } from '@shared/schema';

// Prioridades padrão do sistema legado (fallback)
export const DEFAULT_PRIORITIES = [
  { name: 'Baixa', weight: 1, color: '#6B7280', legacy_value: 'low' },
  { name: 'Média', weight: 2, color: '#3B82F6', legacy_value: 'medium' },
  { name: 'Alta', weight: 3, color: '#F59E0B', legacy_value: 'high' },
  { name: 'Crítica', weight: 4, color: '#EF4444', legacy_value: 'critical' },
] as const;

// Mapeamento de prioridades legadas para novas
export const LEGACY_PRIORITY_MAP: Record<string, { name: string; weight: number; color: string }> = {
  'low': { name: 'Baixa', weight: 1, color: '#6B7280' },
  'medium': { name: 'Média', weight: 2, color: '#3B82F6' },
  'high': { name: 'Alta', weight: 3, color: '#F59E0B' },
  'critical': { name: 'Crítica', weight: 4, color: '#EF4444' },
};

// Interface para resultado de busca de prioridades
export interface PriorityResult {
  priorities: DepartmentPriority[];
  isDefault: boolean; // Se está usando prioridades padrão (fallback)
  source: 'custom' | 'default' | 'none'; // Fonte das prioridades
}

// Interface para configuração de prioridade com informações extras
export interface PriorityConfig extends DepartmentPriority {
  isDefault?: boolean;
  legacyValue?: string;
}

/**
 * Busca prioridades de um departamento específico com fallback
 * @param companyId ID da empresa
 * @param departmentId ID do departamento
 * @param allPriorities Lista de todas as prioridades do banco (opcional para performance)
 * @returns Resultado com prioridades e informação de fallback
 */
export function getDepartmentPriorities(
  companyId: number,
  departmentId: number,
  allPriorities?: DepartmentPriority[]
): PriorityResult {
  
  // Se não foi fornecida a lista, retorna estrutura para ser buscada no banco
  if (!allPriorities) {
    throw new Error('getDepartmentPriorities: allPriorities parameter is required');
  }

  // Buscar prioridades customizadas para este departamento
  const customPriorities = allPriorities.filter(p => 
    p.company_id === companyId && 
    p.department_id === departmentId && 
    p.is_active
  );

  // Se encontrou prioridades customizadas, retornar elas
  if (customPriorities.length > 0) {
    return {
      priorities: customPriorities.sort((a, b) => a.weight - b.weight),
      isDefault: false,
      source: 'custom'
    };
  }

  // NÃO criar prioridades padrão hardcoded - retornar lista vazia
  return {
    priorities: [],
    isDefault: true,
    source: 'none'
  };
}

/**
 * Verifica se uma empresa usa o sistema flexível de SLA
 * @param company Objeto da empresa
 * @returns true se usa sistema flexível, false se usa sistema legado
 */
export function usesFlexibleSLA(company?: Partial<Company>): boolean {
  return company?.uses_flexible_sla === true;
}

/**
 * Converte prioridade legada para nova estrutura
 * @param legacyPriority Prioridade no formato antigo ('low', 'medium', etc.)
 * @param companyId ID da empresa
 * @param departmentId ID do departamento
 * @returns Configuração de prioridade compatível
 */
export function convertLegacyPriority(
  legacyPriority: string,
  companyId: number,
  departmentId: number
): PriorityConfig {
  const mapping = LEGACY_PRIORITY_MAP[legacyPriority];
  
  if (!mapping) {
    // Fallback para medium se prioridade não reconhecida
    const fallback = LEGACY_PRIORITY_MAP['medium'];
    return {
      id: -2, // ID negativo para virtual
      company_id: companyId,
      department_id: departmentId,
      name: fallback.name,
      weight: fallback.weight,
      color: fallback.color,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      isDefault: true,
      legacyValue: 'medium'
    };
  }

  return {
    id: -mapping.weight, // ID negativo para virtual
    company_id: companyId,
    department_id: departmentId,
    name: mapping.name,
    weight: mapping.weight,
    color: mapping.color,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    isDefault: true,
    legacyValue: legacyPriority
  };
}

/**
 * Converte prioridade nova para legada (para compatibilidade)
 * @param priority Prioridade do novo sistema
 * @returns String da prioridade legada ou 'medium' como fallback
 */
export function convertToLegacyPriority(priority: DepartmentPriority): string {
  // Buscar na tabela de mapeamento pelo weight
  const legacyEntry = Object.entries(LEGACY_PRIORITY_MAP).find(
    ([_, config]) => config.weight === priority.weight
  );
  
  return legacyEntry ? legacyEntry[0] : 'medium';
}

/**
 * Ordena prioridades por peso (menor peso = menor prioridade)
 * @param priorities Array de prioridades
 * @returns Array ordenado por peso crescente
 */
export function sortPrioritiesByWeight(priorities: DepartmentPriority[]): DepartmentPriority[] {
  return [...priorities].sort((a, b) => a.weight - b.weight);
}

/**
 * Encontra prioridade por peso
 * @param priorities Array de prioridades
 * @param weight Peso da prioridade
 * @returns Prioridade encontrada ou undefined
 */
export function findPriorityByWeight(priorities: DepartmentPriority[], weight: number): DepartmentPriority | undefined {
  return priorities.find(p => p.weight === weight);
}

/**
 * Encontra prioridade por nome
 * @param priorities Array de prioridades
 * @param name Nome da prioridade
 * @returns Prioridade encontrada ou undefined
 */
export function findPriorityByName(priorities: DepartmentPriority[], name: string): DepartmentPriority | undefined {
  return priorities.find(p => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Valida se os pesos das prioridades são únicos e sequenciais
 * @param priorities Array de prioridades
 * @returns Objeto com status de validação e erros
 */
export function validatePriorityWeights(priorities: DepartmentPriority[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (priorities.length === 0) {
    errors.push('Nenhuma prioridade fornecida');
    return { isValid: false, errors, warnings };
  }

  // Verificar pesos únicos
  const weights = priorities.map(p => p.weight);
  const uniqueWeights = new Set(weights);
  if (weights.length !== uniqueWeights.size) {
    errors.push('Pesos duplicados encontrados');
  }

  // Verificar se pesos começam em 1
  const minWeight = Math.min(...weights);
  if (minWeight !== 1) {
    warnings.push(`Peso mínimo é ${minWeight}, recomendado começar em 1`);
  }

  // Verificar sequência
  const sortedWeights = weights.sort((a, b) => a - b);
  let expectedWeight = sortedWeights[0];
  for (const weight of sortedWeights) {
    if (weight !== expectedWeight) {
      warnings.push(`Sequência de pesos não contínua: esperado ${expectedWeight}, encontrado ${weight}`);
      break;
    }
    expectedWeight++;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Cria prioridades padrão para um departamento
 * @param companyId ID da empresa
 * @param departmentId ID do departamento
 * @returns Array de prioridades padrão para inserção
 */
export function createDefaultPriorities(companyId: number, departmentId: number): Omit<DepartmentPriority, 'id' | 'created_at' | 'updated_at'>[] {
  return DEFAULT_PRIORITIES.map(priority => ({
    company_id: companyId,
    department_id: departmentId,
    name: priority.name,
    weight: priority.weight,
    color: priority.color,
    is_active: true,
  }));
}

/**
 * Calcula a próxima posição de peso disponível
 * @param existingPriorities Array de prioridades existentes
 * @returns Próximo peso disponível
 */
export function getNextAvailableWeight(existingPriorities: DepartmentPriority[]): number {
  if (existingPriorities.length === 0) return 1;
  
  const maxWeight = Math.max(...existingPriorities.map(p => p.weight));
  return maxWeight + 1;
}

/**
 * Verifica se um nome de prioridade já existe no departamento
 * @param priorities Array de prioridades existentes
 * @param name Nome a verificar
 * @param excludeId ID a excluir da verificação (para edição)
 * @returns true se nome já existe
 */
export function priorityNameExists(priorities: DepartmentPriority[], name: string, excludeId?: number): boolean {
  return priorities.some(p => 
    p.name.toLowerCase() === name.toLowerCase() && 
    (excludeId === undefined || p.id !== excludeId)
  );
} 