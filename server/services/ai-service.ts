import { 
  AiConfiguration, 
  AiAnalysisHistory, 
  InsertAiAnalysisHistory,
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
  departmentId?: number; // Adicionado para garantir que sempre temos o departamento
}

export interface AiAnalysisResult {
  priority: string;
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
   * Faz matching entre a resposta da IA e as prioridades do banco
   * AGORA PRIORIZA manter o formato exato retornado pela IA se existe no banco
   */
  private matchPriorityFromBank(aiPriority: string, departmentPriorities: DepartmentPriority[]): string {
    // 1. Buscar match exato primeiro - SE EXISTE, usar EXATAMENTE como a IA retornou
    for (const priority of departmentPriorities) {
      if (priority.name === aiPriority) {
        console.log(`[AI] ✅ Match exato encontrado: IA retornou "${aiPriority}" e existe no banco. Mantendo formato da IA.`);
        return aiPriority; // RETORNA EXATAMENTE como a IA enviou
      }
    }
    
    // 2. Buscar match case-insensitive - retorna o formato do banco
    const lowercaseAI = aiPriority.toLowerCase();
    for (const priority of departmentPriorities) {
      if (priority.name.toLowerCase() === lowercaseAI) {
        console.log(`[AI] ⚠️ Match case-insensitive: IA retornou "${aiPriority}" → usando formato do banco "${priority.name}"`);
        return priority.name; // Retorna como está no banco
      }
    }
    
    // 3. Fallback: usar a prioridade de menor peso (mais baixa)
    const fallbackPriority = departmentPriorities.sort((a, b) => a.weight - b.weight)[0];
    console.warn(`[AI] ❌ Prioridade "${aiPriority}" não encontrada. Usando fallback: "${fallbackPriority.name}"`);
    return fallbackPriority.name;
  }

  /**
   * Busca as prioridades ativas do departamento para usar na análise de IA
   * NUNCA retorna prioridades hardcoded - sempre busca do banco
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

      console.log(`[AI] Encontradas ${priorities.length} prioridades reais para dept ${departmentId}:`, 
        priorities.map((p: DepartmentPriority) => `${p.name}(ID:${p.id})`));

      return priorities;

    } catch (error) {
      console.error('Erro ao buscar prioridades do departamento:', error);
      // Em caso de erro, retornar lista vazia
      return [];
    }
  }

  /**
   * Busca prioridade no banco pelo nome e retorna o ID correto
   */
  private async findPriorityIdByName(
    priorityName: string,
    companyId: number,
    departmentId: number,
    dbInstance: any = null
  ): Promise<{ id: number; name: string } | null> {
    try {
      const database = dbInstance || db;
      
      // Buscar prioridade exata primeiro
      let [priority] = await database
        .select({ id: departmentPriorities.id, name: departmentPriorities.name })
        .from(departmentPriorities)
        .where(
          and(
            eq(departmentPriorities.company_id, companyId),
            eq(departmentPriorities.department_id, departmentId),
            eq(departmentPriorities.name, priorityName),
            eq(departmentPriorities.is_active, true)
          )
        )
        .limit(1);

      if (priority) {
        console.log(`[AI] Prioridade encontrada: ${priority.name} (ID: ${priority.id})`);
        return priority;
      }

      // Buscar case-insensitive
      const allPriorities = await database
        .select({ id: departmentPriorities.id, name: departmentPriorities.name })
        .from(departmentPriorities)
        .where(
          and(
            eq(departmentPriorities.company_id, companyId),
            eq(departmentPriorities.department_id, departmentId),
            eq(departmentPriorities.is_active, true)
          )
        );

      for (const p of allPriorities) {
        if (p.name.toLowerCase() === priorityName.toLowerCase()) {
          console.log(`[AI] Prioridade encontrada (case-insensitive): ${p.name} (ID: ${p.id})`);
          return { id: p.id, name: p.name };
        }
      }

      console.warn(`[AI] Prioridade "${priorityName}" não encontrada no departamento ${departmentId}`);
      return null;

    } catch (error) {
      console.error('Erro ao buscar ID da prioridade:', error);
      return null;
    }
  }

  /**
   * Ajusta os prompts da configuração de IA para usar as prioridades específicas do departamento
   */
  private adjustPromptsForDepartment(
    config: AiConfiguration,
    priorities: DepartmentPriority[]
  ): AiConfiguration {
    // Criar lista das prioridades ordenadas por peso
    const priorityList = priorities
      .sort((a, b) => a.weight - b.weight)
      .map(p => `${p.name}: ${this.generatePriorityDescription(p.name, p.weight)}`)
      .join('\n\n');

    // Criar lista apenas dos nomes para a resposta
    const priorityNames = priorities
      .sort((a, b) => a.weight - b.weight)
      .map(p => p.name)
      .join(', ');

    // Ajustar system prompt para usar as prioridades específicas
    const adjustedSystemPrompt = `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios específicos deste departamento:

${priorityList}

IMPORTANTE: Responda APENAS com o nome exato de uma das prioridades (${priorityNames}), sem pontuação adicional.`;

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
   * Gera descrição dinâmica baseada no nome e peso da prioridade
   * Remove todas as descrições hardcoded
   */
  private generatePriorityDescription(name: string, weight: number): string {
    // Criar descrição baseada no peso da prioridade
    const intensityLevels = [
      "Questões simples, dúvidas básicas, solicitações de baixo impacto que não afetam operações críticas",
      "Problemas que causam inconveniência mas têm soluções alternativas disponíveis",
      "Funcionalidades importantes não funcionando, problemas que impedem trabalho de usuários específicos",
      "Sistemas críticos fora do ar, falhas que afetam múltiplos usuários e operações importantes",
      "Situações de emergência extrema, falhas críticas que comprometem toda a operação"
    ];

    // Mapear peso para índice (limitado aos níveis disponíveis)
    const levelIndex = Math.min(Math.max(weight - 1, 0), intensityLevels.length - 1);
    
    return `${intensityLevels[levelIndex]} (Peso: ${weight})`;
  }

  /**
   * Analisa a prioridade de um ticket usando IA
   */
  async analyzeTicketPriority(
    request: AiAnalysisRequest,
    db: any
  ): Promise<AiAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Buscar departamento do ticket se ticketId existir
      let departmentId: number | undefined = request.departmentId;
      
      if (!departmentId && request.ticketId) {
        const [ticket] = await db
          .select({ department_id: schema.tickets.department_id })
          .from(schema.tickets)
          .where(eq(schema.tickets.id, request.ticketId))
          .limit(1);
        departmentId = ticket?.department_id || undefined;
      }

      // OBRIGATÓRIO: Ter departmentId para análise de IA
      if (!departmentId) {
        const departmentPriorities = await this.getDepartmentPriorities(request.companyId, 1, db); // fallback dept
        return this.createFallbackResult(startTime, 'Departamento não especificado', departmentPriorities);
      }

      // Buscar configuração de IA ativa para a empresa e departamento
      const config = await this.getActiveAiConfiguration(request.companyId, departmentId, db);
      
      if (!config) {
        const departmentPriorities = await this.getDepartmentPriorities(request.companyId, departmentId, db);
        return this.createFallbackResult(startTime, 'Nenhuma configuração de IA ativa', departmentPriorities);
      }

             // Buscar prioridades específicas do departamento
       const departmentPrioritiesList = await this.getDepartmentPriorities(request.companyId, departmentId, db);
       
       if (departmentPrioritiesList.length === 0) {
         return this.createFallbackResult(startTime, 'Nenhuma prioridade encontrada para o departamento', departmentPrioritiesList);
       }

      // Ajustar configuração com as prioridades do departamento
      const adjustedConfig = this.adjustPromptsForDepartment(config, departmentPrioritiesList);
      
      // DEBUG: Log do prompt ajustado
      console.log('[AI DEBUG] System Prompt:', adjustedConfig.system_prompt);
      console.log('[AI DEBUG] User Prompt:', adjustedConfig.user_prompt_template);

      // Obter o provedor correto
      const provider = this.providers.get(config.provider);
      
              if (!provider) {
          return this.createFallbackResult(startTime, `Provedor ${config.provider} não implementado`, departmentPrioritiesList);
        }

      // Realizar análise com retry usando a configuração ajustada
      const result = await this.executeWithRetry(
        () => provider.analyze(request.title, request.description, adjustedConfig),
        config.max_retries || 3
      );

             // Fazer match da prioridade retornada pela IA com o banco
       result.priority = this.matchPriorityFromBank(result.priority, departmentPrioritiesList);
       console.log(`[AI] Prioridade vinculada: ${result.priority}`);

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
      
      // Buscar prioridades para fallback
      let departmentId: number | undefined = request.departmentId;
      
      if (!departmentId && request.ticketId) {
        const [ticket] = await db
          .select({ department_id: schema.tickets.department_id })
          .from(schema.tickets)
          .where(eq(schema.tickets.id, request.ticketId))
          .limit(1);
        departmentId = ticket?.department_id || undefined;
      }

      const departmentPriorities = departmentId 
        ? await this.getDepartmentPriorities(request.companyId, departmentId, db)
        : [];

      // Salvar erro no histórico
      if (request.ticketId && departmentId) {
        const config = await this.getActiveAiConfiguration(request.companyId, departmentId, db);
        if (config) {
          await this.saveAnalysisHistory(
            request,
            config,
            this.createFallbackResult(startTime, error?.message || 'Erro desconhecido', departmentPriorities),
            'error',
            db,
            error?.message || 'Erro desconhecido'
          );
        }
      }

      return this.createFallbackResult(startTime, error?.message || 'Erro desconhecido', departmentPriorities);
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
   * Busca a configuração de IA ativa para uma empresa e departamento específico
   * OBRIGATÓRIO: Deve existir uma configuração por departamento
   */
  private async getActiveAiConfiguration(
    companyId: number,
    departmentId: number, // Agora obrigatório
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

      // 1. Buscar configuração específica da empresa + departamento (ativa e padrão)
      const [specificConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.is_active, true),
            eq(schema.aiConfigurations.is_default, true)
          )
        )
        .limit(1);

      if (specificConfig) {
        console.log(`[AI] Usando configuração específica padrão: empresa ${companyId}, departamento ${departmentId}`);
        return specificConfig;
      }

      // 2. Buscar qualquer configuração ativa da empresa + departamento
      const [anySpecificConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .limit(1);

      if (anySpecificConfig) {
        console.log(`[AI] Usando configuração específica ativa: empresa ${companyId}, departamento ${departmentId}`);
        return anySpecificConfig;
      }

      // 3. Buscar configuração geral da empresa (sem departamento específico)
      const [companyConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            isNull(schema.aiConfigurations.department_id),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (companyConfig) {
        console.log(`[AI] Usando configuração geral da empresa: ${companyId}`);
        return companyConfig;
      }

      // 4. Buscar configuração global específica por departamento (sem empresa, mas com departamento)
      const [globalDepartmentConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.company_id),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (globalDepartmentConfig) {
        console.log(`[AI] Usando configuração global específica por departamento: ${departmentId}`);
        return globalDepartmentConfig;
      }

      // 5. Fallback: buscar configuração global (sem empresa e sem departamento)
      const [globalConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.company_id),
            isNull(schema.aiConfigurations.department_id),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (globalConfig) {
        console.log(`[AI] Usando configuração global (fallback)`);
        return globalConfig;
      }

      console.log(`[AI] Nenhuma configuração de IA encontrada para empresa ${companyId}, departamento ${departmentId}`);
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
    }
  }

  /**
   * Cria um resultado de fallback usando as prioridades específicas do departamento
   */
  private createFallbackResult(
    startTime: number, 
    reason: string,
    departmentPriorities: DepartmentPriority[]
  ): AiAnalysisResult {
    // Usar a prioridade de menor peso como fallback (mais baixa prioridade)
    let fallbackPriority = 'Baixa'; // Fallback padrão se não houver prioridades
    
    if (departmentPriorities.length > 0) {
      const lowestPriority = departmentPriorities.sort((a, b) => a.weight - b.weight)[0];
      fallbackPriority = lowestPriority.name;
    }

    return {
      priority: fallbackPriority,
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

        if (department && department.company_id) {
          const departmentPriorities = await this.getDepartmentPriorities(department.company_id, deptId, db);
          if (departmentPriorities.length > 0) {
            adjustedConfig = this.adjustPromptsForDepartment(config, departmentPriorities);
          }
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
    departmentId: number // Agora obrigatório
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

      // Buscar configuração de IA específica do departamento
      const config = await this.getActiveAiConfiguration(companyId, departmentId, db);

      if (!config) {
        console.log(`[AI] Nenhuma configuração de IA encontrada para departamento ${departmentId}`);
        return null;
      }

      // Buscar prioridades específicas do departamento
      const departmentPrioritiesList = await this.getDepartmentPriorities(companyId, departmentId, db);
      
      if (departmentPrioritiesList.length === 0) {
        console.log(`[AI] Nenhuma prioridade encontrada para departamento ${departmentId}`);
        return null;
      }

      // Ajustar configuração com as prioridades do departamento
      const adjustedConfig = this.adjustPromptsForDepartment(config, departmentPrioritiesList);
      console.log(`[AI] Usando prioridades específicas do departamento ${departmentId}: ${departmentPrioritiesList.map(p => p.name).join(', ')}`);

      const provider = this.providers.get(config.provider);
      if (!provider) {
        console.log(`[AI] Provedor ${config.provider} não disponível`);
        return null;
      }

      console.log(`[AI] Analisando prioridade com ${config.provider}/${config.model} para departamento ${departmentId}`);
      const result = await this.executeWithRetry(
        () => provider.analyze(title, description, adjustedConfig),
        config.max_retries || 3
      );

             // Fazer match da prioridade retornada pela IA com o banco
       result.priority = this.matchPriorityFromBank(result.priority, departmentPrioritiesList);

      console.log(`[AI] Resultado: ${result.priority} (confiança: ${result.confidence})`);
      return result;

    } catch (error: any) {
      console.error('[AI] Erro na análise de prioridade:', error);
      return null;
    }
  }
} 