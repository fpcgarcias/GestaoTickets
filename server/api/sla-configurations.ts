/**
 * Endpoints da API para configurações de SLA
 * CRUD completo com bulk operations e validações de negócio
 */

import { Request, Response } from 'express';
import { slaConfigurationService } from '../services/sla-configuration-service';

/**
 * GET /api/sla-configurations
 * Listar configurações SLA com filtros
 */
export async function getSLAConfigurations(req: Request, res: Response) {
  try {
    const { 
      companyId, 
      departmentId, 
      incidentTypeId, 
      priorityId, 
      isActive 
    } = req.query;

    const filters: any = {};
    
    if (companyId) filters.companyId = parseInt(companyId as string);
    if (departmentId) filters.departmentId = parseInt(departmentId as string);
    if (incidentTypeId) filters.incidentTypeId = parseInt(incidentTypeId as string);
    if (priorityId !== undefined) {
      filters.priorityId = priorityId === 'null' ? null : parseInt(priorityId as string);
    }
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const configurations = await slaConfigurationService.getSLAConfigurations(filters);

    // Desabilitar cache HTTP para garantir dados frescos
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: configurations,
      count: configurations.length
    });

  } catch (error) {
    console.error('Erro ao buscar configurações SLA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * GET /api/sla-configurations/:id
 * Buscar configuração SLA específica
 */
export async function getSLAConfigurationById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const configId = parseInt(id);

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }

    const configuration = await slaConfigurationService.getSLAConfigurationById(configId);

    if (!configuration) {
      return res.status(404).json({
        success: false,
        error: 'Configuração SLA não encontrada'
      });
    }

    res.json({
      success: true,
      data: configuration
    });

  } catch (error) {
    console.error('Erro ao buscar configuração SLA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * POST /api/sla-configurations
 * Criar nova configuração SLA
 */
export async function createSLAConfiguration(req: Request, res: Response) {
  try {
    const input = req.body;
    
    console.log('📋 [SLA CREATE] Dados recebidos:', JSON.stringify(input, null, 2));

    // Validar dados de entrada
    const validation = await slaConfigurationService.validateSLAConfiguration(input);
    
    console.log('🔍 [SLA CREATE] Resultado da validação:', {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const newConfiguration = await slaConfigurationService.createSLAConfiguration(input);

    // Desabilitar cache HTTP
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(201).json({
      success: true,
      data: newConfiguration,
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('Erro ao criar configuração SLA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * PUT /api/sla-configurations/:id
 * Atualizar configuração SLA existente
 */
export async function updateSLAConfiguration(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const configId = parseInt(id);

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }

    const updatedConfiguration = await slaConfigurationService.updateSLAConfiguration(configId, updates);

    // Desabilitar cache HTTP
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: updatedConfiguration
    });

  } catch (error) {
    console.error('❌ [SLA API] Erro ao atualizar configuração SLA:', error);
    
    if (error instanceof Error && error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * DELETE /api/sla-configurations/:id
 * Deletar configuração SLA
 */
export async function deleteSLAConfiguration(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const configId = parseInt(id);

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }

    const deleted = await slaConfigurationService.deleteSLAConfiguration(configId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Configuração SLA não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Configuração SLA deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar configuração SLA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * POST /api/sla-configurations/bulk
 * Criar múltiplas configurações SLA
 */
export async function bulkCreateSLAConfigurations(req: Request, res: Response) {
  try {
    const operation = req.body;

    if (!operation.companyId || !operation.departmentId || !operation.configurations) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: companyId, departmentId, configurations'
      });
    }

    const result = await slaConfigurationService.bulkCreateSLAConfigurations(operation);

    res.json({
      success: true,
      data: {
        created: result.created,
        createdCount: result.created.length,
        errors: result.errors,
        errorCount: result.errors.length
      }
    });

  } catch (error) {
    console.error('Erro na criação em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * PUT /api/sla-configurations/bulk
 * Atualizar múltiplas configurações SLA
 */
export async function bulkUpdateSLAConfigurations(req: Request, res: Response) {
  try {
    const { companyId, departmentId, updates } = req.body;

    if (!companyId || !departmentId || !updates) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: companyId, departmentId, updates'
      });
    }

    const updatedConfigurations = await slaConfigurationService.bulkUpdateSLAConfigurations(
      companyId, 
      departmentId, 
      updates
    );

    res.json({
      success: true,
      data: updatedConfigurations,
      count: updatedConfigurations.length
    });

  } catch (error) {
    console.error('Erro na atualização em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * DELETE /api/sla-configurations/bulk
 * Deletar múltiplas configurações SLA
 */
export async function bulkDeleteSLAConfigurations(req: Request, res: Response) {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de IDs é obrigatório'
      });
    }

    const deletedCount = await slaConfigurationService.bulkDeleteSLAConfigurations(ids);

    res.json({
      success: true,
      data: {
        deletedCount,
        requestedCount: ids.length
      }
    });

  } catch (error) {
    console.error('Erro na exclusão em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * PATCH /api/sla-configurations/bulk/toggle
 * Ativar/Desativar múltiplas configurações SLA
 */
export async function bulkToggleActiveSLAConfigurations(req: Request, res: Response) {
  try {
    const { ids, isActive } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de IDs é obrigatório'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campo isActive deve ser boolean'
      });
    }

    const updatedConfigurations = await slaConfigurationService.bulkToggleActive(ids, isActive);

    res.json({
      success: true,
      data: updatedConfigurations,
      count: updatedConfigurations.length
    });

  } catch (error) {
    console.error('Erro ao alterar status em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * POST /api/sla-configurations/copy
 * Copiar configurações de um departamento para outro
 */
export async function copySLAConfigurations(req: Request, res: Response) {
  try {
    const { 
      fromDepartmentId, 
      toDepartmentId, 
      companyId, 
      overwriteExisting = false 
    } = req.body;

    if (!fromDepartmentId || !toDepartmentId || !companyId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: fromDepartmentId, toDepartmentId, companyId'
      });
    }

    const result = await slaConfigurationService.copySLAConfigurations(
      fromDepartmentId,
      toDepartmentId,
      companyId,
      overwriteExisting
    );

    res.json({
      success: true,
      data: {
        copied: result.copied,
        copiedCount: result.copied.length,
        skippedCount: result.skipped,
        errors: result.errors,
        errorCount: result.errors.length
      }
    });

  } catch (error) {
    console.error('Erro ao copiar configurações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * POST /api/sla-configurations/validate
 * Validar configuração SLA sem criar
 */
export async function validateSLAConfiguration(req: Request, res: Response) {
  try {
    const input = req.body;

    const validation = await slaConfigurationService.validateSLAConfiguration(input);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
} 