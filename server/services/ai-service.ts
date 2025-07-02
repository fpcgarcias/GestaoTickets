import { 
  AiConfiguration, 
  AiAnalysisHistory, 
  InsertAiAnalysisHistory,
  ticketPriorityEnum,
  departmentPriorities,
  type DepartmentPriority
} from "../../shared/schema";
import { OpenAiProvider } from "./providers/openai-provider";
import { GoogleProvider } from "./providers/google-provider";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { PriorityService } from "./priority-service";
import { db } from "../db";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../shared/schema";

export interface AiAnalysisRequest {
  title: string;
  description: string;
  companyId: number;
  ticketId?: number;
}

export interface AiAnalysisResult {
  priority: string; // Agora aceita qualquer string (prioridades dinâmicas em português)
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
  private priorityService: PriorityService;

  constructor() {
    // Registrar provedores disponíveis
    this.registerProviders();
    this.priorityService = new PriorityService();
  }

  private registerProviders() {
    // Registrar provedores implementados
    this.providers.set('openai', new OpenAiProvider());
    this.providers.set('google', new GoogleProvider());
    this.providers.set('anthropic', new AnthropicProvider());
  }

  /**
   * Busca as prioridades ativas do departamento para usar na análise de IA
   */
  private async getDepartmentPriorities(
    companyId: number, 
    departmentId: number,
    dbInstance: any = null
  ): Promise<DepartmentPriority[]> {
    try {
      const database = dbInstance || db;

      // Buscar prioridades específicas do departamento
      const priorities = await database
        .select()
        .from(departmentPriorities)
        .where(
          and(
            eq(departmentPriorities.company_id, companyId),
            eq(departmentPriorities.department_id, departmentId),
            eq(departmentPriorities.is_active, true)
          )
        )
        .orderBy(departmentPriorities.weight);

      if (priorities.length > 0) {
        return priorities;
      }

      // Fallback: usar prioridades padrão virtuais
      return [
        { id: -1, company_id: companyId, department_id: departmentId, name: 'BAIXA', weight: 1, color: '#6B7280', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -2, company_id: companyId, department_id: departmentId, name: 'MÉDIA', weight: 2, color: '#3B82F6', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -3, company_id: companyId, department_id: departmentId, name: 'ALTA', weight: 3, color: '#F59E0B', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -4, company_id: companyId, department_id: departmentId, name: 'CRÍTICA', weight: 4, color: '#EF4444', is_active: true, created_at: new Date(), updated_at: new Date() }
      ];

    } catch (error) {
      console.error('Erro ao buscar prioridades do departamento:', error);
      // Fallback em caso de erro
      return [
        { id: -1, company_id: companyId, department_id: departmentId, name: 'BAIXA', weight: 1, color: '#6B7280', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -2, company_id: companyId, department_id: departmentId, name: 'MÉDIA', weight: 2, color: '#3B82F6', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -3, company_id: companyId, department_id: departmentId, name: 'ALTA', weight: 3, color: '#F59E0B', is_active: true, created_at: new Date(), updated_at: new Date() },
        { id: -4, company_id: companyId, department_id: departmentId, name: 'CRÍTICA', weight: 4, color: '#EF4444', is_active: true, created_at: new Date(), updated_at: new Date() }
      ];
    }
  }

  /**
   * Ajusta os prompts da configuração de IA para usar as prioridades específicas do departamento
   */
  private adjustPromptsForDepartment(
    config: AiConfiguration,
    priorities: DepartmentPriority[]
  ): AiConfiguration {
    // Criar lista das prioridades ordenadas por peso (em maiúsculas)
    const priorityList = priorities
      .sort((a, b) => a.weight - b.weight)
      .map(p => `${p.name.toUpperCase()}: ${this.getPriorityDescription(p.name, p.weight)}`)
      .join('\n\n');

    // Criar lista apenas dos nomes para a resposta (em maiúsculas)
    const priorityNames = priorities
      .sort((a, b) => a.weight - b.weight)
      .map(p => p.name.toUpperCase())
      .join(', ');

    // Ajustar system prompt para usar as prioridades específicas
    const adjustedSystemPrompt = `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios específicos deste departamento:

${priorityList}

IMPORTANTE: Responda APENAS com o nome exato de uma das prioridades (${priorityNames}) em MAIÚSCULAS, sem pontuação adicional.`;

    // Ajustar user prompt template se não estiver personalizado
    const adjustedUserPrompt = config.user_prompt_template.includes('{titulo}') 
      ? config.user_prompt_template 
      : `Título: {titulo}

Descrição: {descricao}

Analise este ticket e determine sua prioridade considerando as diretrizes específicas do departamento. Responda APENAS com uma das seguintes opções: ${priorityNames}

Prioridade:`;

    return {
      ...config,
      system_prompt: adjustedSystemPrompt,
      user_prompt_template: adjustedUserPrompt
    };
  }

  /**
   * Gera descrição automática baseada no nome e peso da prioridade
   */
  private getPriorityDescription(name: string, weight: number): string {
    const descriptions: Record<string, string> = {
      'BAIXA': 'Dúvidas simples, solicitações de treinamento, melhorias estéticas, configurações pessoais, problemas que não impedem o trabalho.',
      'MÉDIA': 'Problemas que causam inconveniência mas têm soluções alternativas, funcionalidades secundárias não funcionando, solicitações importantes mas não urgentes.',
      'ALTA': 'Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados.',
      'CRÍTICA': 'Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente.',
      'IMEDIATA': 'Situações de emergência extrema, falhas críticas de segurança, perda de dados em massa, sistemas essenciais completamente inoperantes.'
    };

    // Tentar encontrar descrição específica
    if (descriptions[name.toUpperCase()]) {
      return descriptions[name.toUpperCase()];
    }

    // Fallback baseado no peso
    if (weight <= 1) return descriptions['BAIXA'];
    if (weight <= 2) return descriptions['MÉDIA'];
    if (weight <= 3) return descriptions['ALTA'];
    if (weight <= 4) return descriptions['CRÍTICA'];
    return descriptions['IMEDIATA'];
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
        // Buscar departamento do ticket se ticketId existir
        let departmentId: number | undefined = undefined;
        if (request.ticketId) {
          const [ticket] = await db
            .select({ department_id: schema.tickets.department_id })
            .from(schema.tickets)
            .where(eq(schema.tickets.id, request.ticketId))
            .limit(1);
          departmentId = ticket?.department_id || undefined;
        }

        // Buscar configuração de IA ativa para a empresa e departamento
        const config = await this.getActiveAiConfiguration(request.companyId, departmentId, db);
      
      if (!config) {
        return this.createFallbackResult(startTime, 'Nenhuma configuração de IA ativa');
      }

      // Buscar prioridades específicas do departamento (se tiver departmentId)
      let adjustedConfig = config;
      if (departmentId) {
        const departmentPriorities = await this.getDepartmentPriorities(request.companyId, departmentId, db);
        adjustedConfig = this.adjustPromptsForDepartment(config, departmentPriorities);
        
        // DEBUG: Log do prompt ajustado
        console.log('[AI DEBUG] System Prompt:', adjustedConfig.system_prompt);
        console.log('[AI DEBUG] User Prompt:', adjustedConfig.user_prompt_template);
      }

      // Obter o provedor correto
      const provider = this.providers.get(config.provider);
      
      if (!provider) {
        return this.createFallbackResult(startTime, `Provedor ${config.provider} não implementado`);
      }

      // Realizar análise com retry usando a configuração ajustada
      const result = await this.executeWithRetry(
        () => provider.analyze(request.title, request.description, adjustedConfig),
        config.max_retries || 3
      );

      // Salvar histórico da análise
      if (request.ticketId) {
        await this.saveAnalysisHistory(
          request,
          config, // Usar config original para o histórico
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
          // Buscar departamento do ticket
          let departmentId: number | undefined = undefined;
          const [ticket] = await db
            .select({ department_id: schema.tickets.department_id })
            .from(schema.tickets)
            .where(eq(schema.tickets.id, request.ticketId))
            .limit(1);
          departmentId = ticket?.department_id || undefined;

          const config = await this.getActiveAiConfiguration(request.companyId, departmentId, db);
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
   * Busca a configuração de IA ativa para uma empresa e departamento
   */
  private async getActiveAiConfiguration(
    companyId: number,
    departmentId?: number,
    dbInstance: any = null
  ): Promise<AiConfiguration | null> {
    try {
      const database = dbInstance || db;
      
      // Verificar se a empresa tem permissão para usar IA
      const [company] = await database
        .select({ ai_permission: schema.companies.ai_permission })
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId))
        .limit(1);

      if (!company?.ai_permission) {
        console.log(`[AI] Empresa ${companyId} não tem permissão para usar IA`);
        return null;
      }

      // 1. Tentar buscar configuração específica do departamento (ativa e padrão)
      if (departmentId) {
        const departmentConfigs = await database
          .select()
          .from(schema.aiConfigurations)
          .where(
            and(
              eq(schema.aiConfigurations.department_id, departmentId),
              eq(schema.aiConfigurations.is_active, true),
              eq(schema.aiConfigurations.is_default, true)
            )
          )
          .limit(1);

        if (departmentConfigs[0]) {
          console.log(`[AI] Usando configuração específica do departamento ${departmentId}`);
          return departmentConfigs[0];
        }

        // 2. Se não tem configuração padrão específica, buscar qualquer configuração ativa do departamento
        const anyDepartmentConfig = await database
          .select()
          .from(schema.aiConfigurations)
          .where(
            and(
              eq(schema.aiConfigurations.department_id, departmentId),
              eq(schema.aiConfigurations.is_active, true)
            )
          )
          .limit(1);

        if (anyDepartmentConfig[0]) {
          console.log(`[AI] Usando configuração ativa do departamento ${departmentId}`);
          return anyDepartmentConfig[0];
        }
      }

      // 3. Fallback: buscar configuração global ativa e padrão
      const globalConfigs = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.department_id), // Configuração global
            eq(schema.aiConfigurations.is_active, true),
            eq(schema.aiConfigurations.is_default, true)
          )
        )
        .limit(1);

      if (globalConfigs[0]) {
        console.log(`[AI] Usando configuração global padrão`);
        return globalConfigs[0];
      }

      // 4. Último fallback: qualquer configuração global ativa
      const anyGlobalConfig = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.department_id),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .limit(1);

      if (anyGlobalConfig[0]) {
        console.log(`[AI] Usando configuração global ativa`);
        return anyGlobalConfig[0];
      }

      console.log(`[AI] Nenhuma configuração de IA encontrada`);
      return null;
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

      await dbInstance
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
      priority: 'MÉDIA', // Prioridade padrão em português
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

    // Se a configuração é específica de um departamento, buscar as prioridades e ajustar os prompts
    let adjustedConfig = config;
    if (config.department_id) {
      const deptId = config.department_id as number;
      try {
        // Buscar a empresa do departamento
        const [department] = await db
          .select({ company_id: schema.departments.company_id })
          .from(schema.departments)
          .where(eq(schema.departments.id, deptId))
          .limit(1);

        if (department) {
          const departmentPriorities = await this.getDepartmentPriorities(department.company_id, deptId, db);
          adjustedConfig = this.adjustPromptsForDepartment(config, departmentPriorities);
        }
      } catch (error) {
        console.warn('Erro ao buscar prioridades para teste, usando configuração original:', error);
      }
    }

    return provider.analyze(testTitle, testDescription, adjustedConfig);
  }

  /**
   * Método simplificado para análise de prioridade (usado na criação de tickets)
   */
  async analyzePriority(
    title: string,
    description: string,
    companyId: number,
    departmentId?: number
  ): Promise<AiAnalysisResult | null> {
    try {
      // Verificar se a empresa tem permissão para usar IA
      const [company] = await db
        .select({ ai_permission: schema.companies.ai_permission })
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId))
        .limit(1);

      if (!company?.ai_permission) {
        console.log(`[AI] Empresa ${companyId} não tem permissão para usar IA`);
        return null;
      }

      // Buscar configuração de IA baseada no departamento
      const config = await this.getActiveAiConfiguration(companyId, departmentId, db);

      if (!config) {
        console.log(`[AI] Nenhuma configuração de IA encontrada para empresa ${companyId}, departamento ${departmentId}`);
        return null;
      }

      // Buscar prioridades específicas do departamento (se tiver departmentId)
      let adjustedConfig = config;
      if (departmentId) {
        const departmentPriorities = await this.getDepartmentPriorities(companyId, departmentId, db);
        adjustedConfig = this.adjustPromptsForDepartment(config, departmentPriorities);
        console.log(`[AI] Usando prioridades específicas do departamento ${departmentId}: ${departmentPriorities.map(p => p.name.toUpperCase()).join(', ')}`);
        
        // DEBUG: Log do prompt ajustado
        console.log('[AI DEBUG] System Prompt usado:', adjustedConfig.system_prompt);
      }

      const provider = this.providers.get(config.provider);
      if (!provider) {
        console.log(`[AI] Provedor ${config.provider} não disponível`);
        return null;
      }

      console.log(`[AI] Analisando prioridade com ${config.provider}/${config.model} para empresa ${companyId}, departamento ${departmentId || 'global'}`);
      const result = await this.executeWithRetry(
        () => provider.analyze(title, description, adjustedConfig),
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