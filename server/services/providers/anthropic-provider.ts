import { AiProviderInterface, AiAnalysisResult } from "../ai-service";
import { AiConfiguration } from "../../../shared/schema";

export class AnthropicProvider implements AiProviderInterface {
  async analyze(
    title: string,
    description: string,
    config: AiConfiguration,
    apiToken: string
  ): Promise<AiAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preparar o prompt
      const systemPrompt = config.system_prompt;
      let userPrompt = config.user_prompt_template
        .replace('{titulo}', title)
        .replace('{descricao}', description);
      
      // Para análise de reabertura, usar apenas a mensagem do solicitante
       if (config.analysis_type === 'reopen') {
         userPrompt = config.user_prompt_template
           .replace('{mensagem_cliente}', description);
       }

      // Configurar o endpoint
      const endpoint = config.api_endpoint || 'https://api.anthropic.com/v1/messages';
      
      // Fazer a requisição para a Anthropic Claude
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiToken,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.max_tokens,
          temperature: parseFloat(config.temperature || "0.7"),
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
        // Para análise de reabertura, não usar fallback de prioridade
        if (config.analysis_type === 'reopen') {
          return {
            priority: 'erro_resposta_vazia',
            confidence: 0,
            justification: 'Empty AI response for reopen analysis',
            usedFallback: true,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: {
              request: data.usage?.input_tokens || 0,
              response: data.usage?.output_tokens || 0,
            },
            rawResponse: data
          };
        }
        
        return {
          priority: config.fallback_priority || "medium",
          confidence: 0,
          justification: 'Empty AI response',
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.input_tokens || 0,
            response: data.usage?.output_tokens || 0,
          },
          rawResponse: data
        };
      }

      // Extrair prioridade e justificativa da resposta usando tags
      const { priority: extractedPriority, justification } = this.extractPriorityAndJustification(aiResponse, config);
      
      if (!extractedPriority) {
        // Para análise de reabertura, não usar fallback de prioridade
        if (config.analysis_type === 'reopen') {
          return {
            priority: 'erro_extracao',
            confidence: 0,
            justification: `Could not extract ACTION from response: "${aiResponse}"`,
            usedFallback: true,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: {
              request: data.usage?.input_tokens || 0,
              response: data.usage?.output_tokens || 0,
            },
            rawResponse: data
          };
        }
        
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0.2,
          justification: `Could not extract priority from response: "${aiResponse}"`,
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.input_tokens || 0,
            response: data.usage?.output_tokens || 0,
          },
          rawResponse: data
        };
      }
      
      // Calcular confiança
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
          request: data.usage?.input_tokens || 0,
          response: data.usage?.output_tokens || 0,
        },
        rawResponse: data
      };

    } catch (error: unknown) {
      console.error('Erro no provedor Anthropic Claude:', error);
      
      // Se for timeout, marcar como tal
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Anthropic Claude analysis timeout', { cause: error });
      }
      
      throw error;
    }
  }

  /**
   * Extrai a prioridade e justificativa da resposta da IA usando tags estruturadas
   */
  private extractPriorityAndJustification(response: string, config?: any): { priority: string | null; justification: string } {
    
    // Para análise de reabertura, usar função específica
    if (config?.analysis_type === 'reopen') {
      return this.extractReopenActionAndJustification(response);
    }
    
    // Para análise de prioridade, usar função específica
    return this.extractPriorityAnalysis(response);
  }

  /**
   * Extrai AÇÃO e JUSTIFICATIVA para análise de reabertura
   */
  private extractReopenActionAndJustification(response: string): { priority: string | null; justification: string } {
    const acaoMatch = response.match(/<ACAO>(.*?)<\/ACAO>/i) || 
                     response.match(/<ACTION>(.*?)<\/ACTION>/i);
    const justificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*?)<\/JUSTIFICATIVA>/i) ||
                              response.match(/<JUSTIFICATION>([\s\S]*?)<\/JUSTIFICATION>/i);
    
    if (acaoMatch && justificationMatch) {
      return {
        priority: acaoMatch[1].trim(), // Usar ACAO como "priority" para compatibilidade
        justification: justificationMatch[1].trim()
      };
    }
    
    // Se não encontrou as tags, retornar erro
    return {
      priority: null,
      justification: `Could not extract ACTION and JUSTIFICATION from response: "${response}"`
    };
  }

  /**
   * Extrai PRIORIDADE e JUSTIFICATIVA para análise de prioridade
   */
  private extractPriorityAnalysis(response: string): { priority: string | null; justification: string } {
    
    // Para análise de prioridade, usar o comportamento original
    // Tentar extrair usando tags estruturadas primeiro (português e inglês)
    const priorityMatch = response.match(/<PRIORIDADE>(.*?)<\/PRIORIDADE>/i) || 
                         response.match(/<PRIORITY>(.*?)<\/PRIORITY>/i);
    const justificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*?)<\/JUSTIFICATIVA>/i) ||
                              response.match(/<JUSTIFICATION>([\s\S]*?)<\/JUSTIFICATION>/i);
    
    if (priorityMatch) {
      const extractedPriority = priorityMatch[1].trim();
      let justification: string;
      
      if (justificationMatch?.[1]?.trim()) {
        // Se encontrou a tag JUSTIFICATIVA completa, usar o conteúdo dela
        justification = justificationMatch[1].trim();
      } else {
        // Tentar extrair justificativa mesmo sem tag de fechamento
        const openJustificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*)/i) ||
                                     response.match(/<JUSTIFICATION>([\s\S]*)/i);
        if (openJustificationMatch?.[1]?.trim()) {
          justification = openJustificationMatch[1].trim();
        } else {
          // Se não encontrou nenhuma justificativa, usar mensagem padrão
          justification = 'Analysis based on ticket content';
        }
      }
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }

    // Tentar extrair usando tags de prioridade específicas (Média, Alta, etc.)
    const specificPriorityMatch = response.match(/<(MÉDIA|MEDIA|ALTA|BAIXA|CRÍTICA|CRITICA)>(.*?)<\/(MÉDIA|MEDIA|ALTA|BAIXA|CRÍTICA|CRITICA)>/i);
    
    if (specificPriorityMatch) {
      const extractedPriority = specificPriorityMatch[1].trim();
      let justification: string;
      
      if (justificationMatch?.[1]?.trim()) {
        // Se encontrou a tag JUSTIFICATIVA completa, usar o conteúdo dela
        justification = justificationMatch[1].trim();
      } else {
        // Tentar extrair justificativa mesmo sem tag de fechamento
        const openJustificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*)/i) ||
                                     response.match(/<JUSTIFICATION>([\s\S]*)/i);
        if (openJustificationMatch?.[1]?.trim()) {
          justification = openJustificationMatch[1].trim();
        } else {
          // Se não encontrou nenhuma justificativa, usar mensagem padrão
          justification = 'Analysis based on ticket content';
        }
      }
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }
    
    // Fallback: tentar extrair apenas prioridade (método antigo) - APENAS se não encontrou tags
    const extractedPriority = this.extractPriority(response);

    
    if (extractedPriority) {
      // Tentar extrair justificativa usando métodos antigos (português e inglês)
      const justificationMatch = response.match(/justificativa[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/razão[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/porque[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/justification[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/reason[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/because[:\s]+(.*?)(?:\n|$)/i);
      
      const justification = justificationMatch?.[1]?.trim() || 'Analysis based on ticket content';
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }
    
    return {
      priority: null,
      justification: 'Analysis based on ticket content'
    };
  }

  /**
   * Extrai a prioridade da resposta da IA (suporta português e inglês)
   */
  private extractPriority(response: string): string | null {
    const normalizedResponse = response.toLowerCase().trim();
    
    // Priorizar palavras exatas em português (MAIÚSCULAS) - formato preferido
    if (response.includes('CRÍTICA') || response.includes('CRITICA')) {
      return 'CRÍTICA';
    }
    if (response.includes('ALTA')) {
      return 'ALTA';
    }
    if (response.includes('MÉDIA') || response.includes('MEDIA')) {
      return 'MÉDIA';
    }
    if (response.includes('BAIXA')) {
      return 'BAIXA';
    }

    // Fallback: procurar em minúsculas (português)
    if (normalizedResponse.includes('crítica') || normalizedResponse.includes('critica')) {
      return 'CRÍTICA';
    }
    if (normalizedResponse.includes('alta')) {
      return 'ALTA';
    }
    if (normalizedResponse.includes('média') || normalizedResponse.includes('media')) {
      return 'MÉDIA';
    }
    if (normalizedResponse.includes('baixa')) {
      return 'BAIXA';
    }

    // Fallback: inglês (para compatibilidade)
    if (normalizedResponse.includes('critical')) {
      return 'CRÍTICA';
    }
    if (normalizedResponse.includes('high')) {
      return 'ALTA';
    }
    if (normalizedResponse.includes('medium')) {
      return 'MÉDIA';
    }
    if (normalizedResponse.includes('low')) {
      return 'BAIXA';
    }

    // Se não encontrou nada específico, tentar extrair apenas a primeira palavra
    const firstWord = normalizedResponse.split(/\s+/)[0];
    
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
        return null;
    }
  }
}