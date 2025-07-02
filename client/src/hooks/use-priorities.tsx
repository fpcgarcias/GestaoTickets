import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { PRIORITY_LEVELS } from '@/lib/utils';
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
export function usePriorities(departmentId?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['priorities', departmentId, user?.companyId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const response = await fetch(`/api/departments/${departmentId}/priorities`);
      if (!response.ok) {
        // Se não conseguir carregar prioridades customizadas, retorna prioridades padrão para customers
        if (user?.role === 'customer') {
          return DEFAULT_LEGACY_PRIORITIES;
        }
        throw new Error('Erro ao carregar prioridades');
      }
      
      const result = await response.json();
      
      // Se usar prioridades padrão do sistema, mapear para formato normalizado
      if (result.data?.isDefault || !result.data?.priorities?.length) {
        return DEFAULT_LEGACY_PRIORITIES;
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
      // Por enquanto, retornar prioridades padrão
      // TODO: Implementar endpoint para buscar todas as prioridades da empresa
      return DEFAULT_LEGACY_PRIORITIES;
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

import React from 'react'; 