import { AiProviderInterface, AiAnalysisResult } from "../ai-service";
import { AiConfiguration } from "../../../shared/schema";

export class GoogleProvider implements AiProviderInterface {
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

      // Combinar system e user prompt para Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // Configurar o endpoint
      const endpoint = config.api_endpoint || 
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
      
      // Fazer a requisição para o Google Gemini
      const response = await fetch(`${endpoint}?key=${config.api_key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: parseFloat(config.temperature || '0.1'),
            maxOutputTokens: config.max_tokens || 100,
            topK: 1,
            topP: 0.8,
          }
        }),
        signal: AbortSignal.timeout((config.timeout_seconds || 30) * 1000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      
      // Extrair a resposta
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!aiResponse) {
        throw new Error('Resposta vazia do Google Gemini');
      }

      console.log(`[Gemini] Resposta bruta: "${aiResponse}"`);

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
          console.log(`[Gemini] ⚠️  Não foi possível extrair prioridade de: "${aiResponse}". Usando fallback: medium`);
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

      console.log(`[Gemini] ✅ Prioridade extraída: ${extractedPriority} (confiança: ${confidence}) - Justificativa: "${justification || 'N/A'}"`);

      return {
        priority: extractedPriority,
        justification: justification || `Classificação automática baseada em: "${aiResponse}"`,
        confidence,
        usedFallback: false,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: {
          request: 0, // Google Gemini não retorna contagem de tokens de entrada
          response: data.usageMetadata?.candidatesTokenCount || 0,
        },
      };

    } catch (error: any) {
      console.error('Erro no provedor Google Gemini:', error);
      
      // Se for timeout, marcar como tal
      if (error.name === 'TimeoutError') {
        throw new Error('Timeout na análise do Google Gemini');
      }
      
      throw error;
    }
  }
} 