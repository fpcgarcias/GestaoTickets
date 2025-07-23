import { AiProviderInterface, AiAnalysisResult } from "../ai-service";
import { AiConfiguration } from "../../../shared/schema";

export class AnthropicProvider implements AiProviderInterface {
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
      const endpoint = config.api_endpoint || 'https://api.anthropic.com/v1/messages';
      
      // Fazer a requisição para a Anthropic Claude
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.max_tokens || 100,
          temperature: parseFloat(config.temperature || '0.1'),
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ]
        }),
        signal: AbortSignal.timeout((config.timeout_seconds || 30) * 1000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic Claude API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      
      // Extrair a resposta
      const aiResponse = data.content?.[0]?.text?.trim() || '';
      
      if (!aiResponse) {
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0,
          justification: 'Resposta vazia da IA',
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.input_tokens || 0,
            response: data.usage?.output_tokens || 0,
          }
        };
      }

      // Extrair prioridade e justificativa da resposta usando tags
      const { priority: extractedPriority, justification } = this.extractPriorityAndJustification(aiResponse);
      
      if (!extractedPriority) {
        console.log(`[AI DEBUG] Resposta da IA não reconhecida: "${aiResponse}"`);
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0.2,
          justification: `Não foi possível extrair prioridade da resposta: "${aiResponse}"`,
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.input_tokens || 0,
            response: data.usage?.output_tokens || 0,
          }
        };
      }
      
      // Calcular confiança
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
          request: data.usage?.input_tokens || 0,
          response: data.usage?.output_tokens || 0,
        }
      };

    } catch (error: any) {
      console.error('Erro no provedor Anthropic Claude:', error);
      
      // Se for timeout, marcar como tal
      if (error.name === 'TimeoutError') {
        throw new Error('Timeout na análise da Anthropic Claude');
      }
      
      throw error;
    }
  }

  /**
   * Extrai a prioridade e justificativa da resposta da IA usando tags estruturadas
   */
  private extractPriorityAndJustification(response: string): { priority: string | null; justification: string } {
    console.log(`[AI DEBUG] Tentando extrair prioridade e justificativa de: "${response}"`);
    
    // Tentar extrair usando tags estruturadas primeiro
    const priorityMatch = response.match(/<PRIORIDADE>(.*?)<\/PRIORIDADE>/i);
    const justificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*?)<\/JUSTIFICATIVA>/i);
    
    if (priorityMatch) {
      const extractedPriority = priorityMatch[1].trim();
      const justification = justificationMatch?.[1]?.trim() || 'Análise baseada no conteúdo do ticket';
      
      console.log(`[AI DEBUG] Extraído via tags - Prioridade: "${extractedPriority}", Justificativa: "${justification}"`);
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }
    
    // Fallback: tentar extrair apenas prioridade (método antigo) - APENAS se não encontrou tags
    const extractedPriority = this.extractPriority(response);
    
    if (extractedPriority) {
      // Tentar extrair justificativa usando métodos antigos
      const justificationMatch = response.match(/justificativa[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/razão[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/porque[:\s]+(.*?)(?:\n|$)/i);
      
      const justification = justificationMatch?.[1]?.trim() || 'Análise baseada no conteúdo do ticket';
      
      console.log(`[AI DEBUG] Extraído via fallback - Prioridade: "${extractedPriority}", Justificativa: "${justification}"`);
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }
    
    console.log('[AI DEBUG] Nenhuma prioridade reconhecida');
    return {
      priority: null,
      justification: 'Análise baseada no conteúdo do ticket'
    };
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
} 