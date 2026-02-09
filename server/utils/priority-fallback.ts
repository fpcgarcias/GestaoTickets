/**
 * Funções utilitárias para testar a lógica de fallback do sistema de prioridades
 */

import { PriorityService } from '../services/priority-service';
import type { DepartmentPriority } from '@shared/schema';

/**
 * Testa se o sistema de fallback está funcionando corretamente
 */
export async function testPriorityFallback(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const priorityService = new PriorityService();
    
    // Testar empresa inexistente (deve retornar lista vazia)
    const nonExistentCompany = 99999;
    const nonExistentDepartment = 99999;
    
    const result = await priorityService.getDepartmentPriorities(
      nonExistentCompany, 
      nonExistentDepartment
    );
    
    // Verificar se retornou lista vazia com source: 'none'
    if (!result.isDefault || result.source !== 'none') {
      return {
        success: false,
        message: 'Fallback não funcionou para empresa inexistente - esperado source: "none"',
        details: result
      };
    }
    
    // Verificar se a lista está vazia
    if (result.priorities.length !== 0) {
      return {
        success: false,
        message: `Esperado lista vazia, recebido ${result.priorities.length} prioridades`,
        details: result
      };
    }
    
    return {
      success: true,
      message: 'Sistema de fallback funcionando corretamente',
      details: {
        prioritiesCount: result.priorities.length,
        isDefault: result.isDefault,
        source: result.source
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao testar fallback de prioridades',
      details: error instanceof Error ? error.message : error
    };
  }
}

/**
 * Simula validação de prioridades com dados inválidos
 */
export function testPriorityValidation(): {
  success: boolean;
  message: string;
  details: any;
} {
  try {
    // Importar função de validação
    const { validatePriorityWeights } = require('@shared/utils/priority-utils');
    
    // Teste 1: Prioridades com pesos duplicados
    const duplicateWeightPriorities: DepartmentPriority[] = [
      {
        id: 1,
        company_id: 1,
        department_id: 1,
        name: 'Baixa',
        weight: 1,
        color: '#6B7280',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        company_id: 1,
        department_id: 1,
        name: 'Média',
        weight: 1, // Peso duplicado
        color: '#3B82F6',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    const duplicateResult = validatePriorityWeights(duplicateWeightPriorities);
    if (duplicateResult.isValid) {
      return {
        success: false,
        message: 'Validação deveria ter falhado para pesos duplicados',
        details: duplicateResult
      };
    }
    
    // Teste 2: Prioridades válidas
    const validPriorities: DepartmentPriority[] = [
      {
        id: 1,
        company_id: 1,
        department_id: 1,
        name: 'Baixa',
        weight: 1,
        color: '#6B7280',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        company_id: 1,
        department_id: 1,
        name: 'Média',
        weight: 2,
        color: '#3B82F6',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    const validResult = validatePriorityWeights(validPriorities);
    if (!validResult.isValid) {
      return {
        success: false,
        message: 'Validação deveria ter passado para prioridades válidas',
        details: validResult
      };
    }
    
    return {
      success: true,
      message: 'Testes de validação passaram',
      details: {
        duplicateTest: duplicateResult,
        validTest: validResult
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao testar validação de prioridades',
      details: error instanceof Error ? error.message : error
    };
  }
}

/**
 * Executa todos os testes do sistema de prioridades
 */
export async function runAllPriorityTests(): Promise<{
  success: boolean;
  message: string;
  results: any[];
}> {
  const results = [];
  let allSuccessful = true;
  
  // Teste 1: Fallback
  console.log('🧪 Testando sistema de fallback...');
  const fallbackTest = await testPriorityFallback();
  results.push({ test: 'fallback', ...fallbackTest });
  if (!fallbackTest.success) allSuccessful = false;
  
  // Teste 2: Validação
  console.log('🧪 Testando validação de prioridades...');
  const validationTest = testPriorityValidation();
  results.push({ test: 'validation', ...validationTest });
  if (!validationTest.success) allSuccessful = false;
  
  return {
    success: allSuccessful,
    message: allSuccessful 
      ? 'Todos os testes passaram com sucesso' 
      : 'Alguns testes falharam',
    results
  };
} 