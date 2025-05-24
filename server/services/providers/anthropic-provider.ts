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
      const aiResponse = data.content?.[0]?.text?.trim();
      
      if (!aiResponse) {
        throw new Error('Resposta vazia da Anthropic Claude');
      }

      console.log(`[Claude] Resposta bruta: "${aiResponse}"`);

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
          console.log(`[Claude] ⚠️  Não foi possível extrair prioridade de: "${aiResponse}". Usando fallback: medium`);
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

      console.log(`[Claude] ✅ Prioridade extraída: ${extractedPriority} (confiança: ${confidence}) - Justificativa: "${justification || 'N/A'}"`);

      return {
        priority: extractedPriority,
        justification: justification || `Classificação automática baseada em: "${aiResponse}"`,
        confidence,
        usedFallback: false,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: {
          request: data.usage?.input_tokens || 0,
          response: data.usage?.output_tokens || 0,
        },
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