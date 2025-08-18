/**
 * Endpoint para resolução de SLA usando o novo sistema hierárquico
 */

import { Request, Response } from 'express';
import { slaService } from '../services/sla-service';

/**
 * POST /api/sla/resolve
 * Resolve SLA para um ticket usando hierarquia/fallback
 */
export async function resolveSLA(req: Request, res: Response) {
  try {
    const { companyId, departmentId, incidentTypeId, categoryId, priority } = req.body;

    // Validar parâmetros obrigatórios
    if (!companyId || !departmentId || !incidentTypeId) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: companyId, departmentId, incidentTypeId'
      });
    }

    // Resolver SLA usando o serviço
    const resolvedSLA = await slaService.getTicketSLA(
      companyId,
      departmentId, 
      incidentTypeId,
      priority,
      categoryId
    );
    if (!resolvedSLA) {
      return res.status(404).json({ error: 'no_sla' });
    }

    res.json({
      responseTimeHours: resolvedSLA.responseTimeHours,
      resolutionTimeHours: resolvedSLA.resolutionTimeHours,
      source: resolvedSLA.source,
      configId: resolvedSLA.configId,
      fallbackReason: resolvedSLA.fallbackReason
    });

  } catch (error) {
    console.error('Erro ao resolver SLA:', error);
    res.status(500).json({
      error: 'Erro interno ao resolver SLA',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * GET /api/sla/cache/stats
 * Estatísticas do cache de SLA (apenas para admins)
 */
export async function getCacheStats(req: Request, res: Response) {
  try {
    // Verificar se usuário é admin (se necessário)
    // const { user } = req.session;
    // if (!user || user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Acesso negado' });
    // }

    const stats = slaService.getCacheStats();
    
    res.json({
      success: true,
      stats: {
        cacheSize: stats.size,
        hitRate: `${stats.hitRate}%`,
        popularConfigurations: stats.popularConfigs
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({
      error: 'Erro ao obter estatísticas do cache'
    });
  }
}

/**
 * POST /api/sla/cache/preload
 * Pré-carregar configurações populares no cache
 */
export async function preloadCache(req: Request, res: Response) {
  try {
    await slaService.preloadPopularConfigurations();
    
    res.json({
      success: true,
      message: 'Configurações populares pré-carregadas no cache'
    });

  } catch (error) {
    console.error('Erro ao pré-carregar cache:', error);
    res.status(500).json({
      error: 'Erro ao pré-carregar cache'
    });
  }
}

/**
 * DELETE /api/sla/cache
 * Limpar cache expirado
 */
export async function cleanCache(req: Request, res: Response) {
  try {
    slaService.cleanExpiredCache();
    
    const stats = slaService.getCacheStats();
    
    res.json({
      success: true,
      message: 'Cache expirado limpo',
      newCacheSize: stats.size
    });

  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({
      error: 'Erro ao limpar cache'
    });
  }
} 