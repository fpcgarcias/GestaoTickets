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
          priority: config.fallback_priority || 'medium',
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
            request: data.usage?.input_tokens || 0,
            response: data.usage?.output_tokens || 0,
          }
        };
      }

      const extractedPriority = priorityMatch[1].toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
      
      // Extrair justificativa
      const justificationMatch = aiResponse.match(/justificativa[:\s]+(.*?)(?:\n|$)/i) ||
                                aiResponse.match(/razão[:\s]+(.*?)(?:\n|$)/i) ||
                                aiResponse.match(/porque[:\s]+(.*?)(?:\n|$)/i);
      
      const justification = justificationMatch?.[1]?.trim() || 'Análise baseada no conteúdo do ticket';
      
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
} 