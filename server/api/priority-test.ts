/**
 * Endpoint para testar o sistema de prioridades flexíveis
 * Usado apenas em desenvolvimento para validar a lógica de fallback
 */

import { Request, Response } from 'express';
import { PriorityService } from '../services/priority-service';
import { runAllPriorityTests } from '../utils/priority-fallback';

/**
 * GET /api/priority-test
 * Executa testes do sistema de prioridades
 */
export async function testPriorities(req: Request, res: Response) {
  try {
    console.log('🔧 Iniciando testes do sistema de prioridades...');
    
    const testResults = await runAllPriorityTests();
    
    console.log('✅ Testes concluídos:', testResults.message);
    
    res.json({
      success: testResults.success,
      message: testResults.message,
      results: testResults.results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro nos testes de prioridades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao executar testes',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * GET /api/priority-test/department/:companyId/:departmentId
 * Testa busca de prioridades de um departamento específico
 */
export async function testDepartmentPriorities(req: Request, res: Response) {
  try {
    const { companyId, departmentId } = req.params;
    
    const priorityService = new PriorityService();
    const result = await priorityService.getDepartmentPriorities(
      parseInt(companyId),
      parseInt(departmentId)
    );
    
    res.json({
      success: true,
      message: 'Prioridades obtidas com sucesso',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar prioridades do departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prioridades do departamento',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
} 