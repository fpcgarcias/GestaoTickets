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

      // Extrair prioridade da resposta (suporta português e inglês)
      const extractedPriority = this.extractPriority(aiResponse);
      
      if (!extractedPriority) {
        console.log(`[AI DEBUG] Resposta da IA não reconhecida: "${aiResponse}"`);
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0.2,
          justification: `Não foi possível extrair prioridade da resposta: "${aiResponse}"`,
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.prompt_tokens || 0,
            response: data.usage?.completion_tokens || 0,
          }
        };
      }
      
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

      console.log(`[AI DEBUG] Prioridade extraída: "${extractedPriority}"`);
      
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
   * Extrai a prioridade da resposta da IA (suporta português e inglês)
   */
  private extractPriority(response: string): string | null {
    const normalizedResponse = response.toLowerCase().trim();
    
    console.log(`[AI DEBUG] Tentando extrair prioridade de: "${response}"`);
    
    // Priorizar palavras exatas em português (MAIÚSCULAS) - formato preferido
    if (response.includes('CRÍTICA') || response.includes('CRITICA')) {
      console.log('[AI DEBUG] Encontrou: CRÍTICA');
      return 'CRÍTICA';
    }
    if (response.includes('ALTA')) {
      console.log('[AI DEBUG] Encontrou: ALTA');
      return 'ALTA';
    }
    if (response.includes('MÉDIA') || response.includes('MEDIA')) {
      console.log('[AI DEBUG] Encontrou: MÉDIA');
      return 'MÉDIA';
    }
    if (response.includes('BAIXA')) {
      console.log('[AI DEBUG] Encontrou: BAIXA');
      return 'BAIXA';
    }

    // Fallback: procurar em minúsculas (português)
    if (normalizedResponse.includes('crítica') || normalizedResponse.includes('critica')) {
      console.log('[AI DEBUG] Encontrou: crítica (convertendo para CRÍTICA)');
      return 'CRÍTICA';
    }
    if (normalizedResponse.includes('alta')) {
      console.log('[AI DEBUG] Encontrou: alta (convertendo para ALTA)');
      return 'ALTA';
    }
    if (normalizedResponse.includes('média') || normalizedResponse.includes('media')) {
      console.log('[AI DEBUG] Encontrou: média (convertendo para MÉDIA)');
      return 'MÉDIA';
    }
    if (normalizedResponse.includes('baixa')) {
      console.log('[AI DEBUG] Encontrou: baixa (convertendo para BAIXA)');
      return 'BAIXA';
    }

    // Fallback: inglês (para compatibilidade)
    if (normalizedResponse.includes('critical')) {
      console.log('[AI DEBUG] Encontrou: critical (convertendo para CRÍTICA)');
      return 'CRÍTICA';
    }
    if (normalizedResponse.includes('high')) {
      console.log('[AI DEBUG] Encontrou: high (convertendo para ALTA)');
      return 'ALTA';
    }
    if (normalizedResponse.includes('medium')) {
      console.log('[AI DEBUG] Encontrou: medium (convertendo para MÉDIA)');
      return 'MÉDIA';
    }
    if (normalizedResponse.includes('low')) {
      console.log('[AI DEBUG] Encontrou: low (convertendo para BAIXA)');
      return 'BAIXA';
    }

    // Se não encontrou nada específico, tentar extrair apenas a primeira palavra
    const firstWord = normalizedResponse.split(/\s+/)[0];
    console.log(`[AI DEBUG] Primeira palavra: "${firstWord}"`);
    
    switch (firstWord) {
      case 'crítica':
      case 'critica':
      case 'critical':
        return 'CRÍTICA';
      case 'alta':
      case 'high':
        return 'ALTA';
      case 'média':
      case 'media':
      case 'medium':
        return 'MÉDIA';
      case 'baixa':
      case 'low':
        return 'BAIXA';
      default:
        console.log(`[AI DEBUG] Não conseguiu extrair prioridade de: "${response}"`);
        return null;
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