import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { queryConfigs } from '@/lib/query-client';
import type { DepartmentPriority } from '@shared/schema';

// Interface para prioridade normalizada (compatível com sistema legado e novo)
export interface NormalizedPriority {
  id: number | string;
  name: string;
  value: string; // Para compatibilidade com formulários
  weight: number;
  color: string;
  legacyValue?: string;
  isDefault?: boolean;
}

/**
 * Converte peso de prioridade para valor legado
 */
function convertWeightToLegacy(weight: number): string {
  const mapping: Record<number, string> = {
    1: 'low',
    2: 'medium', 
    3: 'high',
    4: 'critical'
  };
  
  return mapping[weight] || 'medium';
}

/**
 * Hook para buscar prioridades de um departamento específico
 */
export function usePriorities(departmentId?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['priorities', departmentId, user?.companyId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const response = await fetch(`/api/departments/${departmentId}/priorities`);
      if (!response.ok) {
        // NÃO usar fallback hardcoded - se não consegue carregar, retornar lista vazia
        return [];
      }
      
      const result = await response.json();
      
      // Se não há prioridades configuradas, retornar lista vazia
      if (result.data?.isDefault || !result.data?.priorities?.length) {
        return [];
      }
      
      // Converter prioridades customizadas para formato normalizado
      return result.data.priorities.map((p: DepartmentPriority) => ({
        id: p.id,
        name: p.name,
        value: p.name.toLowerCase(),
        weight: p.weight,
        color: p.color,
        legacyValue: convertWeightToLegacy(p.weight),
        isDefault: false
      }));
    },
    enabled: !!departmentId,
    staleTime: queryConfigs.static.staleTime,
    gcTime: queryConfigs.static.gcTime,
  });
}

/**
 * Hook para buscar todas as prioridades disponíveis (para filtros globais)
 */
export function useAllPriorities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-priorities', user?.companyId],
    queryFn: async () => {
      // NÃO usar prioridades hardcoded - retornar lista vazia até implementar endpoint
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Converte valor legado para peso
 */
export function convertLegacyToWeight(legacyValue: string): number {
  const mapping: Record<string, number> = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };
  
  return mapping[legacyValue] || 2;
}

/**
 * Encontra prioridade por valor legado
 */
export function findPriorityByLegacyValue(
  priorities: NormalizedPriority[], 
  legacyValue: string
): NormalizedPriority | undefined {
  return priorities.find(p => p.legacyValue === legacyValue || p.value === legacyValue);
}

/**
 * Retorna a cor CSS para uma prioridade baseada no peso
 */
export function getPriorityColorByWeight(weight: number): string {
  const colorMapping: Record<number, string> = {
    1: '#6B7280', // Baixa - Cinza
    2: '#3B82F6', // Média - Azul  
    3: '#F59E0B', // Alta - Laranja
    4: '#EF4444', // Crítica - Vermelho
  };
  
  return colorMapping[weight] || '#3B82F6';
}