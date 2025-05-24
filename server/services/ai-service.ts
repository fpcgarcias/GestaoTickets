import { 
  AiConfiguration, 
  AiAnalysisHistory, 
  InsertAiAnalysisHistory,
  ticketPriorityEnum 
} from "../../shared/schema";
import { OpenAiProvider } from "./providers/openai-provider";
import { GoogleProvider } from "./providers/google-provider";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import * as schema from "../../shared/schema";

export interface AiAnalysisRequest {
  title: string;
  description: string;
  companyId: number;
  ticketId?: number;
}

export interface AiAnalysisResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  justification?: string;
  confidence?: number;
  usedFallback: boolean;
  processingTimeMs: number;
  tokensUsed?: {
    request: number;
    response: number;
  };
}

export interface AiProviderInterface {
  analyze(
    title: string, 
    description: string, 
    config: AiConfiguration
  ): Promise<AiAnalysisResult>;
}

export class AiService {
  private providers: Map<string, AiProviderInterface> = new Map();

  constructor() {
    // Registrar provedores disponíveis
    this.registerProviders();
  }

  private registerProviders() {
    // Registrar provedores implementados
    this.providers.set('openai', new OpenAiProvider());
    this.providers.set('google', new GoogleProvider());
    this.providers.set('anthropic', new AnthropicProvider());
  }

  /**
   * Analisa a prioridade de um ticket usando IA
   */
  async analyzeTicketPriority(
    request: AiAnalysisRequest,
    db: any // Tipo do banco de dados
  ): Promise<AiAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Buscar configuração de IA ativa para a empresa
      const config = await this.getActiveAiConfiguration(request.companyId, db);
      
      if (!config) {
        return this.createFallbackResult(startTime, 'Nenhuma configuração de IA ativa');
      }

      // Obter o provedor correto
      const provider = this.providers.get(config.provider);
      
      if (!provider) {
        return this.createFallbackResult(startTime, `Provedor ${config.provider} não implementado`);
      }

      // Realizar análise com retry
      const result = await this.executeWithRetry(
        () => provider.analyze(request.title, request.description, config),
        config.max_retries || 3
      );

      // Salvar histórico da análise
      if (request.ticketId) {
        await this.saveAnalysisHistory(
          request,
          config,
          result,
          'success',
          db
        );
      }

      return result;

    } catch (error: any) {
      console.error('Erro na análise de IA:', error);
      
      // Salvar erro no histórico
      if (request.ticketId) {
        const config = await this.getActiveAiConfiguration(request.companyId, db);
        if (config) {
          await this.saveAnalysisHistory(
            request,
            config,
            this.createFallbackResult(startTime, error?.message || 'Erro desconhecido'),
            'error',
            db,
            error?.message || 'Erro desconhecido'
          );
        }
      }

      return this.createFallbackResult(startTime, error?.message || 'Erro desconhecido');
    }
  }

  /**
   * Executa uma função com retry automático
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    currentRetry: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (currentRetry < maxRetries) {
        console.log(`Tentativa ${currentRetry + 1}/${maxRetries + 1} falhou. Tentando novamente...`);
        await this.sleep(Math.pow(2, currentRetry) * 1000); // Backoff exponencial
        return this.executeWithRetry(fn, maxRetries, currentRetry + 1);
      }
      throw error;
    }
  }

  /**
   * Busca a configuração de IA ativa para uma empresa
   */
  private async getActiveAiConfiguration(
    companyId: number,
    dbInstance: any
  ): Promise<AiConfiguration | null> {
    try {
      const configs = await db
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.is_active, true),
            eq(schema.aiConfigurations.is_default, true)
          )
        )
        .limit(1);

      return configs[0] || null;
    } catch (error) {
      console.error('Erro ao buscar configuração de IA:', error);
      return null;
    }
  }

  /**
   * Salva o histórico da análise no banco
   */
  private async saveAnalysisHistory(
    request: AiAnalysisRequest,
    config: AiConfiguration,
    result: AiAnalysisResult,
    status: 'success' | 'error' | 'timeout' | 'fallback',
    dbInstance: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      const historyData: InsertAiAnalysisHistory = {
        ticket_id: request.ticketId!,
        ai_configuration_id: config.id,
        input_title: request.title,
        input_description: request.description,
        suggested_priority: result.priority,
        ai_justification: result.justification,
        provider: config.provider,
        model: config.model,
        request_tokens: result.tokensUsed?.request,
        response_tokens: result.tokensUsed?.response,
        processing_time_ms: result.processingTimeMs,
        status,
        error_message: errorMessage,
        company_id: request.companyId,
      };

      await db
        .insert(schema.aiAnalysisHistory)
        .values(historyData);

    } catch (error) {
      console.error('Erro ao salvar histórico de análise:', error);
      // Não falhar a operação principal por causa disso
    }
  }

  /**
   * Cria um resultado de fallback quando a IA falha
   */
  private createFallbackResult(
    startTime: number, 
    reason: string
  ): AiAnalysisResult {
    return {
      priority: 'medium', // Prioridade padrão
      justification: `Prioridade definida automaticamente (fallback): ${reason}`,
      confidence: 0,
      usedFallback: true,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Utilitário para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Testa uma configuração de IA
   */
  async testConfiguration(
    config: AiConfiguration,
    testTitle: string = "Sistema de email não está funcionando",
    testDescription: string = "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
  ): Promise<AiAnalysisResult> {
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      throw new Error(`Provedor ${config.provider} não está disponível`);
    }

    return provider.analyze(testTitle, testDescription, config);
  }

  /**
   * Método simplificado para análise de prioridade (usado na criação de tickets)
   */
  async analyzePriority(
    title: string,
    description: string,
    companyId: number
  ): Promise<AiAnalysisResult | null> {
    try {
      // Buscar configuração ativa da empresa
      const [config] = await db
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.is_active, true),
            eq(schema.aiConfigurations.is_default, true)
          )
        )
        .limit(1);

      if (!config) {
        console.log(`[AI] Nenhuma configuração ativa encontrada para empresa ${companyId}`);
        return null;
      }

      const provider = this.providers.get(config.provider);
      if (!provider) {
        console.log(`[AI] Provedor ${config.provider} não disponível`);
        return null;
      }

      console.log(`[AI] Analisando prioridade com ${config.provider}/${config.model}`);
      const result = await this.executeWithRetry(
        () => provider.analyze(title, description, config),
        config.max_retries || 3
      );

      console.log(`[AI] Resultado: ${result.priority} (confiança: ${result.confidence})`);
      return result;

    } catch (error: any) {
      console.error('[AI] Erro na análise de prioridade:', error);
      return null;
    }
  }
} 