import { AiProviderInterface, AiAnalysisResult } from "../ai-service";
import { AiConfiguration } from "../../../shared/schema";

export class OpenAiProvider implements AiProviderInterface {
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
      
      // Para análise de reabertura, usar apenas a mensagem do cliente
      if (config.analysis_type === 'reopen') {
        userPrompt = config.user_prompt_template
          .replace('{mensagem_cliente}', description);
      }

      // Configurar o endpoint
      const endpoint = config.api_endpoint || 'https://api.openai.com/v1/chat/completions';
      
      // Configurar parâmetros para GPT-5 (estrutura unificada)
      const requestBody: any = {
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
        // GPT-5 usa max_completion_tokens ao invés de max_tokens
        max_completion_tokens: config.max_completion_tokens || config.max_tokens || 1500,
        // Parâmetros obrigatórios do GPT-5
        reasoning_effort: config.reasoning_effort || 'medium',
        verbosity: config.verbosity || 'medium',
        // GPT-5 força temperatura = 1 (não configurável)
        temperature: 1
      };

      console.log(`[OpenAI] Fazendo requisição para ${config.model}:`, {
        endpoint: config.api_endpoint,
        model: config.model,
        max_completion_tokens: requestBody.max_completion_tokens,
        temperature: requestBody.temperature,
        reasoning_effort: requestBody.reasoning_effort,
        verbosity: requestBody.verbosity
      });

      // Fazer a requisição para a OpenAI
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout((config.timeout_seconds || 60) * 1000)
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
        // Para análise de reabertura, não usar fallback de prioridade
        if (config.analysis_type === 'reopen') {
          return {
            priority: 'erro_resposta_vazia',
            confidence: 0,
            justification: 'Resposta vazia da IA para análise de reabertura',
            usedFallback: true,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: {
              request: data.usage?.prompt_tokens || 0,
              response: data.usage?.completion_tokens || 0,
            },
            rawResponse: data
          };
        }
        
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0,
          justification: 'Resposta vazia da IA',
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.prompt_tokens || 0,
            response: data.usage?.completion_tokens || 0,
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
            justification: `Não foi possível extrair ACAO da resposta: "${aiResponse}"`,
            usedFallback: true,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: {
              request: data.usage?.prompt_tokens || 0,
              response: data.usage?.completion_tokens || 0,
            },
            rawResponse: data
          };
        }
        
        return {
          priority: config.fallback_priority || 'MÉDIA',
          confidence: 0.2,
          justification: `Não foi possível extrair prioridade da resposta: "${aiResponse}"`,
          usedFallback: true,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: {
            request: data.usage?.prompt_tokens || 0,
            response: data.usage?.completion_tokens || 0,
          },
          rawResponse: data
        };
      }
      
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
        },
        rawResponse: data
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
    const acaoMatch = response.match(/<ACAO>(.*?)<\/ACAO>/i);
    const justificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*?)<\/JUSTIFICATIVA>/i);
    
    if (acaoMatch && justificationMatch) {
      return {
        priority: acaoMatch[1].trim(), // Usar ACAO como "priority" para compatibilidade
        justification: justificationMatch[1].trim()
      };
    }
    
    // Se não encontrou as tags, retornar erro
    return {
      priority: null,
      justification: `Não foi possível extrair ACAO e JUSTIFICATIVA da resposta: "${response}"`
    };
  }

  /**
   * Extrai PRIORIDADE e JUSTIFICATIVA para análise de prioridade
   */
  private extractPriorityAnalysis(response: string): { priority: string | null; justification: string } {
    // Tentar extrair usando tags estruturadas primeiro
    const priorityMatch = response.match(/<PRIORIDADE>(.*?)<\/PRIORIDADE>/i);
    const justificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*?)<\/JUSTIFICATIVA>/i);
    
    if (priorityMatch) {
      const extractedPriority = priorityMatch[1].trim();
      let justification: string;
      
      if (justificationMatch?.[1]?.trim()) {
        // Se encontrou a tag JUSTIFICATIVA completa, usar o conteúdo dela
        justification = justificationMatch[1].trim();
      } else {
        // Tentar extrair justificativa mesmo sem tag de fechamento
        const openJustificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*)/i);
        if (openJustificationMatch?.[1]?.trim()) {
          justification = openJustificationMatch[1].trim();
        } else {
          // Se não encontrou nenhuma justificativa, usar mensagem padrão
          justification = 'Análise baseada no conteúdo do ticket';
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
        const openJustificationMatch = response.match(/<JUSTIFICATIVA>([\s\S]*)/i);
        if (openJustificationMatch?.[1]?.trim()) {
          justification = openJustificationMatch[1].trim();
        } else {
          // Se não encontrou nenhuma justificativa, usar mensagem padrão
          justification = 'Análise baseada no conteúdo do ticket';
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
      // Tentar extrair justificativa usando métodos antigos
      const justificationMatch = response.match(/justificativa[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/razão[:\s]+(.*?)(?:\n|$)/i) ||
                                response.match(/porque[:\s]+(.*?)(?:\n|$)/i);
      
      const justification = justificationMatch?.[1]?.trim() || 'Análise baseada no conteúdo do ticket';
      
      return {
        priority: extractedPriority,
        justification: justification
      };
    }
    
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