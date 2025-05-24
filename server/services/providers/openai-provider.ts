import { AiProviderInterface, AiAnalysisResult } from "../ai-service";
import { AiConfiguration } from "../../../shared/schema";

export class OpenAiProvider implements AiProviderInterface {
  async analyze(
    title: string,
    description: string,
    config: AiConfiguration
  ): Promise<AiAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preparar o prompt
      const systemPrompt = config.system_prompt;
      const userPrompt = config.user_prompt_template
        .replace('{titulo}', title)
        .replace('{descricao}', description);

      // Configurar o endpoint
      const endpoint = config.api_endpoint || 'https://api.openai.com/v1/chat/completions';
      
      // Fazer a requisição para a OpenAI
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: parseFloat(config.temperature || '0.1'),
          max_tokens: config.max_tokens || 100,
        }),
        signal: AbortSignal.timeout((config.timeout_seconds || 30) * 1000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      
      // Extrair a resposta
      const aiResponse = data.choices[0]?.message?.content?.trim() || '';
      
      if (!aiResponse) {
        return {
          priority: config.fallback_priority || 'medium',
          confidence: 0,
          justification: 'Resposta vazia da IA',
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.prompt_tokens || 0,
            response: data.usage?.completion_tokens || 0,
          }
        };
      }

      // Tentar extrair a prioridade usando regex
      const priorityMatch = aiResponse.match(/prioridade:\s*(critical|high|medium|low)/i) ||
                           aiResponse.match(/(critical|high|medium|low)/i);
      
      if (!priorityMatch) {
        return {
          priority: config.fallback_priority || 'medium',
          confidence: 0.2,
          justification: 'Não foi possível extrair prioridade da resposta da IA',
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.prompt_tokens || 0,
            response: data.usage?.completion_tokens || 0,
          }
        };
      }

      const extractedPriority = priorityMatch[1].toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
      
      // Extrair justificativa (texto após "justificativa:" ou similar)
      const justificationMatch = aiResponse.match(/justificativa[:\s]+(.*?)(?:\n|$)/i) ||
                                aiResponse.match(/razão[:\s]+(.*?)(?:\n|$)/i) ||
                                aiResponse.match(/porque[:\s]+(.*?)(?:\n|$)/i);
      
      const justification = justificationMatch?.[1]?.trim() || 'Análise baseada no conteúdo do ticket';
      
      // Calcular confiança baseada na clareza da resposta
      let confidence = 0.8;
      if (aiResponse.includes('incerto') || aiResponse.includes('talvez')) {
        confidence = 0.6;
      }

      return {
        priority: extractedPriority,
        confidence,
        justification,
        usedFallback: false,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: {
          request: data.usage?.prompt_tokens || 0,
          response: data.usage?.completion_tokens || 0,
        }
      };

    } catch (error: any) {
      console.error('Erro no provedor OpenAI:', error);
      
      // Se for timeout, marcar como tal
      if (error.name === 'TimeoutError') {
        throw new Error('Timeout na análise da OpenAI');
      }
      
      throw error;
    }
  }

  /**
   * Extrai a prioridade da resposta da IA
   */
  private extractPriority(response: string): 'low' | 'medium' | 'high' | 'critical' {
    const normalizedResponse = response.toLowerCase().trim();
    
    // Priorizar palavras exatas primeiro
    if (normalizedResponse.includes('critica') || normalizedResponse.includes('critical')) {
      return 'critical';
    }
    if (normalizedResponse.includes('alta') || normalizedResponse.includes('high')) {
      return 'high';
    }
    if (normalizedResponse.includes('media') || normalizedResponse.includes('medium') || normalizedResponse.includes('média')) {
      return 'medium';
    }
    if (normalizedResponse.includes('baixa') || normalizedResponse.includes('low')) {
      return 'low';
    }

    // Se não encontrou nada específico, tentar extrair apenas a primeira palavra
    const firstWord = normalizedResponse.split(/\s+/)[0];
    
    switch (firstWord) {
      case 'critica':
      case 'critical':
        return 'critical';
      case 'alta':
      case 'high':
        return 'high';
      case 'media':
      case 'medium':
      case 'média':
        return 'medium';
      case 'baixa':
      case 'low':
        return 'low';
      default:
        // Fallback para medium se não conseguir identificar
        return 'medium';
    }
  }

  /**
   * Extrai justificativa da resposta (tudo após a prioridade)
   */
  private extractJustification(response: string): string | undefined {
    // Se a resposta tem mais de uma linha ou mais de uma palavra, extrair justificativa
    const lines = response.trim().split('\n');
    
    if (lines.length > 1) {
      // Pegar tudo após a primeira linha
      return lines.slice(1).join('\n').trim();
    }
    
    // Se é uma linha só, verificar se tem mais informação após a prioridade
    const words = response.trim().split(/\s+/);
    if (words.length > 1) {
      // Pegar tudo após a primeira palavra
      return words.slice(1).join(' ').trim();
    }
    
    return undefined;
  }

  /**
   * Calcula confiança baseada na clareza da resposta
   */
  private calculateConfidence(response: string): number {
    const normalizedResponse = response.toLowerCase().trim();
    
    // Palavras que indicam alta confiança
    const highConfidenceWords = ['critica', 'critical', 'alta', 'high', 'baixa', 'low'];
    const mediumConfidenceWords = ['media', 'medium', 'média'];
    
    // Se encontrou palavra de alta confiança
    if (highConfidenceWords.some(word => normalizedResponse.includes(word))) {
      return 0.9;
    }
    
    // Se encontrou palavra de média confiança
    if (mediumConfidenceWords.some(word => normalizedResponse.includes(word))) {
      return 0.7;
    }
    
    // Se a resposta é muito curta, baixa confiança
    if (response.trim().length < 5) {
      return 0.3;
    }
    
    // Confiança padrão
    return 0.6;
  }
} 