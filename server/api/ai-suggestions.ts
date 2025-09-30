import { Request, Response } from 'express';
import { z } from 'zod';
import { AISuggestionService } from '../services/ai-suggestion-service';
import { logger } from '../services/logger';

const aiSuggestionService = new AISuggestionService();

// Schema de validação para gerar sugestão
const generateSuggestionSchema = z.object({
  ticket_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  department_id: z.number().int().positive()
});

// Schema de validação para feedback
const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5)
});

/**
 * @route POST /api/ai-suggestions
 * @description Gera uma sugestão de IA para um ticket.
 * @access Private (Atendentes)
 */
export async function generateSuggestion(req: Request, res: Response) {
  try {
    const validatedData = generateSuggestionSchema.parse(req.body);

    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Usuário não está logado'
      });
    }

    const suggestion = await aiSuggestionService.generateSuggestion(
      validatedData.ticket_id,
      validatedData.user_id,
      validatedData.department_id
    );

    res.json({
      success: true,
      data: suggestion
    });

  } catch (error: any) {
    logger.error('Erro ao gerar sugestão de IA:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados enviados',
        details: error.errors
      });
    }
    
    res.status(400).json({
      error: error.message || 'Falha ao gerar sugestão de IA',
      details: error.details || null
    });
  }
}

/**
 * @route POST /api/ai-suggestions/:id/feedback
 * @description Registra feedback do usuário sobre uma sugestão de IA.
 * @access Private (Atendentes)
 */
export async function recordFeedback(req: Request, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const validatedData = feedbackSchema.parse(req.body);

    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Usuário não está logado'
      });
    }

    await aiSuggestionService.recordFeedback(
      suggestionId,
      validatedData.rating,
      req.session.userId
    );

    res.json({
      success: true,
      message: 'Feedback registrado com sucesso'
    });

  } catch (error: any) {
    logger.error('Erro ao registrar feedback:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados enviados',
        details: error.errors
      });
    }
    
    res.status(400).json({
      error: error.message || 'Falha ao registrar feedback',
      details: error.details || null
    });
  }
}

/**
 * @route GET /api/ai-suggestions/ticket/:ticketId
 * @description Retorna o histórico de sugestões de IA para um ticket.
 * @access Private (Atendentes)
 */
export async function getSuggestionHistory(req: Request, res: Response) {
  try {
    const ticketId = parseInt(req.params.ticketId);

    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Usuário não está logado'
      });
    }

    const suggestions = await aiSuggestionService.getSuggestionHistory(ticketId);

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error: any) {
    logger.error('Erro ao buscar histórico de sugestões:', error);
    
    res.status(400).json({
      error: error.message || 'Falha ao buscar histórico de sugestões',
      details: error.details || null
    });
  }
}
