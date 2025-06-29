import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { PRIORITY_LEVELS } from '@/lib/utils';
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

// Prioridades padrão do sistema legado
const DEFAULT_LEGACY_PRIORITIES: NormalizedPriority[] = [
  {
    id: 'low',
    name: 'Baixa',
    value: 'low',
    weight: 1,
    color: '#6B7280',
    legacyValue: 'low',
    isDefault: true
  },
  {
    id: 'medium', 
    name: 'Média',
    value: 'medium',
    weight: 2,
    color: '#3B82F6',
    legacyValue: 'medium',
    isDefault: true
  },
  {
    id: 'high',
    name: 'Alta', 
    value: 'high',
    weight: 3,
    color: '#F59E0B',
    legacyValue: 'high',
    isDefault: true
  },
  {
    id: 'critical',
    name: 'Crítica',
    value: 'critical', 
    weight: 4,
    color: '#EF4444',
    legacyValue: 'critical',
    isDefault: true
  }
];

/**
 * Hook para buscar prioridades de um departamento específico
 */
export function useDepartmentPriorities(departmentId?: number) {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['department-priorities', departmentId, user?.companyId],
    queryFn: async () => {
      if (!departmentId) {
        // Retorna prioridades padrão quando nenhum departamento selecionado
        return {
          success: true,
          data: {
            priorities: DEFAULT_LEGACY_PRIORITIES,
            isDefault: true,
            source: 'default'
          }
        };
      }

      const response = await fetch(`/api/departments/${departmentId}/priorities`);
      if (!response.ok) {
        // Se erro ao buscar, usar prioridades padrão como fallback
        return {
          success: true,
          data: {
            priorities: DEFAULT_LEGACY_PRIORITIES,
            isDefault: true,
            source: 'fallback'
          }
        };
      }
      return response.json();
    },
    enabled: true, // Sempre habilitado
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Normalizar prioridades para formato consistente
  const normalizedPriorities: NormalizedPriority[] = React.useMemo(() => {
    if (!data?.success) {
      return DEFAULT_LEGACY_PRIORITIES;
    }

    const priorities = data.data.priorities as DepartmentPriority[];
    const isDefault = data.data.isDefault;

    if (isDefault || priorities.length === 0) {
      return DEFAULT_LEGACY_PRIORITIES;
    }

    // Converter prioridades customizadas
    return priorities.map(priority => ({
      id: priority.id,
      name: priority.name,
      value: priority.id.toString(), // Usar ID como valor para evitar conflitos
      weight: priority.weight,
      color: priority.color || getPriorityColorByWeight(priority.weight), // Fallback se color for null
      legacyValue: convertWeightToLegacy(priority.weight),
      isDefault: false
    }));
  }, [data]);

  return {
    priorities: normalizedPriorities,
    isLoading,
    error,
    isDefault: data?.data?.isDefault ?? true,
    source: data?.data?.source ?? 'default'
  };
}

/**
 * Hook para buscar todas as prioridades disponíveis (para filtros globais)
 */
export function useAllPriorities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-priorities', user?.companyId],
    queryFn: async () => {
      // Por enquanto, retornar prioridades padrão
      // TODO: Implementar endpoint para buscar todas as prioridades da empresa
      return DEFAULT_LEGACY_PRIORITIES;
    },
    staleTime: 5 * 60 * 1000,
  });
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

import React from 'react'; 