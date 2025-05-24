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
      const aiResponse = data.choices?.[0]?.message?.content?.trim();
      
      if (!aiResponse) {
        throw new Error('Resposta vazia da OpenAI');
      }

      console.log(`[OpenAI] Resposta bruta: "${aiResponse}"`);

      // Extrair prioridade da resposta (buscar por palavras-chave)
      const normalizedResponse = aiResponse.toLowerCase().trim();
      let extractedPriority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let confidence = 0.5;

      // Procurar pelas palavras-chave de prioridade
      if (normalizedResponse.includes('critical') || normalizedResponse.includes('crítica')) {
        extractedPriority = 'critical';
        confidence = 0.9;
      } else if (normalizedResponse.includes('high') || normalizedResponse.includes('alta')) {
        extractedPriority = 'high';
        confidence = 0.8;
      } else if (normalizedResponse.includes('low') || normalizedResponse.includes('baixa')) {
        extractedPriority = 'low';
        confidence = 0.8;
      } else if (normalizedResponse.includes('medium') || normalizedResponse.includes('média')) {
        extractedPriority = 'medium';
        confidence = 0.8;
      } else {
        // Se não encontrar nenhuma palavra-chave, tentar primeira palavra
        const firstWord = normalizedResponse.split(/\s+/)[0];
        if (['critical', 'high', 'medium', 'low'].includes(firstWord)) {
          extractedPriority = firstWord as any;
          confidence = 0.7;
        } else {
          console.log(`[OpenAI] ⚠️  Não foi possível extrair prioridade de: "${aiResponse}". Usando fallback: medium`);
          confidence = 0.1;
        }
      }

      // Extrair justificativa (texto após a prioridade)
      const lines = aiResponse.split('\n').filter((line: string) => line.trim());
      let justification = lines.length > 1 ? lines.slice(1).join(' ').trim() : undefined;
      
      // Se não há justificativa nas linhas seguintes, usar o texto após a prioridade na mesma linha
      if (!justification) {
        const priorityWords = ['critical', 'high', 'medium', 'low', 'crítica', 'alta', 'média', 'baixa'];
        for (const word of priorityWords) {
          const index = normalizedResponse.indexOf(word);
          if (index !== -1) {
            const afterPriority = aiResponse.substring(index + word.length).trim();
            if (afterPriority.length > 0) {
              justification = afterPriority;
              break;
            }
          }
        }
      }

      console.log(`[OpenAI] ✅ Prioridade extraída: ${extractedPriority} (confiança: ${confidence}) - Justificativa: "${justification || 'N/A'}"`);

      return {
        priority: extractedPriority,
        justification: justification || `Classificação automática baseada em: "${aiResponse}"`,
        confidence,
        usedFallback: false,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: {
          request: data.usage?.prompt_tokens || 0,
          response: data.usage?.completion_tokens || 0,
        },
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