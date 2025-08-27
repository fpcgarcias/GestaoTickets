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
  // Objeto bruto retornado pelo provedor de IA (será persistido como JSON em ai_response_raw)
  rawResponse?: any;
}

export interface AiProviderInterface {
  analyze(
    title: string, 
    description: string, 
    config: AiConfiguration,
    apiToken: string
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
   * Retorna a configuração de IA exatamente como está salva no banco de dados
   * SEM modificações automáticas nos prompts
   */


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
      const config = await this.getActiveAiConfiguration(request.companyId, departmentId, 'priority', db);
      
      if (!config) {
        const departmentPriorities = await this.getDepartmentPriorities(request.companyId, departmentId, db);
        return this.createFallbackResult(startTime, 'Nenhuma configuração de IA ativa', departmentPriorities);
      }

             // Buscar prioridades específicas do departamento
       const departmentPrioritiesList = await this.getDepartmentPriorities(request.companyId, departmentId, db);
       
       if (departmentPrioritiesList.length === 0) {
         return this.createFallbackResult(startTime, 'Nenhuma prioridade encontrada para o departamento', departmentPrioritiesList);
       }

      // DEBUG: Log do prompt original
      

      // Buscar token do system_settings
      const apiToken = await this.getApiToken(config.provider, request.companyId, db);
      
      if (!apiToken) {
        console.error(`[AI] Token não encontrado para provedor ${config.provider}`);
        return this.createFallbackResult(startTime, `Token não configurado para provedor ${config.provider}`, departmentPrioritiesList);
      }

      // Obter o provedor correto
      const provider = this.providers.get(config.provider);
      
      if (!provider) {
        return this.createFallbackResult(startTime, `Provedor ${config.provider} não implementado`, departmentPrioritiesList);
      }

      // Realizar análise com retry usando a configuração original e token
      const result = await this.executeWithRetry(
        () => provider.analyze(request.title, request.description, config, apiToken),
        config.max_retries
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
        const config = await this.getActiveAiConfiguration(request.companyId, departmentId, 'priority', db);
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
   * Analisa se o ticket deve ser reaberto com base na mensagem do cliente usando IA
   */
  async analyzeTicketReopen(
    ticketId: number,
    companyId: number,
    departmentId: number,
    message: string,
    dbInstance: any = null
  ): Promise<{ shouldReopen: boolean, aiResult: any, usedFallback: boolean }> {
    const database = dbInstance || require('../db').db;
    const startTime = Date.now();
    try {
      // Verificar se o ticket existe (sem buscar dados desnecessários)
      const [ticket] = await database
        .select({
          id: schema.tickets.id,
          status: schema.tickets.status
        })
        .from(schema.tickets)
        .where(eq(schema.tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        return { shouldReopen: false, aiResult: { justification: 'Ticket não encontrado' }, usedFallback: true };
      }

      // Buscar configuração de IA para reabertura
      const config = await this.getActiveAiConfiguration(companyId, departmentId, 'reopen', database);
      if (!config) {
        // Fallback: não reabrir
        await this.saveAnalysisHistory(
          {
            title: '',
            description: message,
            companyId,
            ticketId,
            departmentId
          },
          {
            analysis_type: 'reopen',
            id: 0,
            name: 'Fallback',
            provider: 'openai',
            model: '',
            api_endpoint: null,
            system_prompt: '',
            user_prompt_template: '',
            department_id: departmentId,
            company_id: companyId,
            temperature: '0.1',
            max_tokens: 100,
            timeout_seconds: 30,
            max_retries: 3,
            fallback_priority: '',
            is_active: false,
            is_default: false,
            created_at: new Date(),
            updated_at: new Date(),
            created_by_id: null,
            updated_by_id: null
          },
          {
            priority: '',
            justification: 'Fallback: Nenhuma configuração de IA para reabertura',
            usedFallback: true,
            processingTimeMs: Date.now() - startTime
          },
          'fallback',
          database,
          'Nenhuma configuração de IA para reabertura'
        );
        return { shouldReopen: false, aiResult: { justification: 'Fallback: Nenhuma configuração de IA para reabertura' }, usedFallback: true };
      }
      // Buscar token do system_settings
      const apiToken = await this.getApiToken(config.provider, companyId, database);
      
      if (!apiToken) {
        console.error(`[AI] Token não encontrado para provedor ${config.provider}`);
        return { shouldReopen: false, aiResult: { justification: `Token não configurado para provedor ${config.provider}` }, usedFallback: true };
      }

      // Preparar prompts
      const provider = this.providers.get(config.provider);
      if (!provider) {
        return { shouldReopen: false, aiResult: { justification: 'Provedor de IA não disponível' }, usedFallback: true };
      }
      
      // Para análise de reabertura, enviar APENAS a mensagem do cliente
      // Não precisamos do título nem descrição do ticket original
      
      // Chamar IA
      const aiResult = await provider.analyze('', message, config, apiToken);
      // Para análise de reabertura, a IA retorna ACAO no campo priority
      let shouldReopen = false;
      let aiDecision = (aiResult.priority || '').toLowerCase();
      
      // Verificar se deve reabrir baseado na ação retornada
      if (aiDecision.includes('reabrir') || aiDecision.includes('persists') || aiDecision.includes('persist')) {
        shouldReopen = true;
      } else if (aiDecision.includes('manter') || aiDecision.includes('resolved') || aiDecision.includes('resolve')) {
        shouldReopen = false;
      } else {
        // Se ambíguo, por segurança não reabrir
        shouldReopen = false;
      }
      // Salvar histórico
      await this.saveAnalysisHistory(
        {
          title: '',
          description: message,
          companyId,
          ticketId,
          departmentId
        },
        config,
        {
          ...aiResult,
          usedFallback: false,
          processingTimeMs: Date.now() - startTime
        },
        'success',
        db
      );
      return { shouldReopen, aiResult, usedFallback: false };
    } catch (error: any) {
      // Fallback em caso de erro
      await this.saveAnalysisHistory(
        {
          title: '',
          description: message,
          companyId,
          ticketId,
          departmentId
        },
        {
          analysis_type: 'reopen',
          id: 0,
          name: 'Erro',
          provider: 'openai',
          model: '',
          api_endpoint: null,
          system_prompt: '',
          user_prompt_template: '',
          department_id: departmentId,
          company_id: companyId,
          temperature: '0.1',
          max_tokens: 100,
          timeout_seconds: 30,
          max_retries: 3,
          fallback_priority: '',
          is_active: false,
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
          created_by_id: null,
          updated_by_id: null
        },
        {
          priority: '',
          justification: 'Erro na análise de reabertura: ' + (error?.message || error),
          usedFallback: true,
          processingTimeMs: Date.now() - startTime
        },
        'error',
        db,
        error?.message || String(error)
      );
      return { shouldReopen: false, aiResult: { justification: 'Erro na análise de reabertura' }, usedFallback: true };
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
  /**
   * Busca o token de API do system_settings baseado no provedor
   */
  private async getApiToken(
    provider: string,
    companyId: number | null,
    dbInstance: any = null
  ): Promise<string | null> {
    try {
      const database = dbInstance || db;
      
      // Se companyId é null (admin), buscar token global diretamente
      if (companyId === null) {
        const [globalToken] = await database
          .select({ value: schema.systemSettings.value })
          .from(schema.systemSettings)
          .where(
            and(
              eq(schema.systemSettings.key, `ai_${provider}_token`),
              isNull(schema.systemSettings.company_id)
            )
          )
          .limit(1);
        return globalToken?.value || null;
      }
      
      // Buscar token específico da empresa primeiro
      const [companyToken] = await database
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(
          and(
            eq(schema.systemSettings.key, `ai_${provider}_token_company_${companyId}`),
            eq(schema.systemSettings.company_id, companyId)
          )
        )
        .limit(1);

      if (companyToken?.value) {
        return companyToken.value;
      }

      // Fallback: buscar token global
      const [globalToken] = await database
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(
          and(
            eq(schema.systemSettings.key, `ai_${provider}_token`),
            isNull(schema.systemSettings.company_id)
          )
        )
        .limit(1);

      return globalToken?.value || null;
    } catch (error) {
      console.error(`[AI] Erro ao buscar token para provedor ${provider}:`, error);
      return null;
    }
  }

  private async getActiveAiConfiguration(
    companyId: number,
    departmentId: number, // Agora obrigatório
    analysisType: string, // Novo parâmetro obrigatório
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

      // 1. Buscar configuração específica da empresa + departamento + analysis_type (ativa e padrão)
      const [specificConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.analysis_type, analysisType),
            eq(schema.aiConfigurations.is_active, true),
            eq(schema.aiConfigurations.is_default, true)
          )
        )
        .limit(1);

      if (specificConfig) {
        console.log(`[AI] Usando configuração específica padrão: empresa ${companyId}, departamento ${departmentId}, analysis_type ${analysisType}`);
        return specificConfig;
      }

      // 2. Buscar qualquer configuração ativa da empresa + departamento + analysis_type
      const [anySpecificConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.analysis_type, analysisType),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .limit(1);

      if (anySpecificConfig) {
        console.log(`[AI] Usando configuração específica ativa: empresa ${companyId}, departamento ${departmentId}, analysis_type ${analysisType}`);
        return anySpecificConfig;
      }

      // 3. Buscar configuração geral da empresa (sem departamento específico) + analysis_type
      const [companyConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            eq(schema.aiConfigurations.company_id, companyId),
            isNull(schema.aiConfigurations.department_id),
            eq(schema.aiConfigurations.analysis_type, analysisType),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (companyConfig) {
        console.log(`[AI] Usando configuração geral da empresa: ${companyId}, analysis_type ${analysisType}`);
        return companyConfig;
      }

      // 4. Buscar configuração global específica por departamento (sem empresa, mas com departamento) + analysis_type
      const [globalDepartmentConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.company_id),
            eq(schema.aiConfigurations.department_id, departmentId),
            eq(schema.aiConfigurations.analysis_type, analysisType),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (globalDepartmentConfig) {
        console.log(`[AI] Usando configuração global específica por departamento: ${departmentId}, analysis_type ${analysisType}`);
        return globalDepartmentConfig;
      }

      // 5. Fallback: buscar configuração global (sem empresa e sem departamento) + analysis_type
      const [globalConfig] = await database
        .select()
        .from(schema.aiConfigurations)
        .where(
          and(
            isNull(schema.aiConfigurations.company_id),
            isNull(schema.aiConfigurations.department_id),
            eq(schema.aiConfigurations.analysis_type, analysisType),
            eq(schema.aiConfigurations.is_active, true)
          )
        )
        .orderBy(schema.aiConfigurations.is_default)
        .limit(1);

      if (globalConfig) {
        console.log(`[AI] Usando configuração global (fallback), analysis_type ${analysisType}`);
        return globalConfig;
      }

      console.log(`[AI] Nenhuma configuração de IA encontrada para empresa ${companyId}, departamento ${departmentId}, analysis_type ${analysisType}`);
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
        ai_response_raw: result.rawResponse ? JSON.stringify(result.rawResponse) : undefined,
        ai_justification: result.justification,
        provider: config.provider,
        model: config.model,
        request_tokens: result.tokensUsed?.request,
        response_tokens: result.tokensUsed?.response,
        processing_time_ms: result.processingTimeMs,
        status,
        error_message: errorMessage,
        company_id: config.company_id!,
        analysis_type: config.analysis_type, // Corrigido: sempre salvar analysis_type
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
    let fallbackPriority = 'Sem prioridade'; // Se não há prioridades configuradas
    
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
    testDescription: string = "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe.",
    forceCompanyId?: number | null
  ): Promise<AiAnalysisResult> {
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      throw new Error(`Provedor ${config.provider} não está disponível`);
    }

    // Buscar token do system_settings
    let companyId: number | null = null;
    
    if (forceCompanyId !== undefined) {
      // Se forceCompanyId foi explicitamente passado (mesmo que null), usar esse valor
      companyId = forceCompanyId;
    } else {
      // Caso contrário, tentar determinar a empresa
      if (config.company_id) {
        companyId = config.company_id;
      } else if (config.department_id) {
        // Buscar a empresa do departamento
        const [department] = await db
          .select({ company_id: schema.departments.company_id })
          .from(schema.departments)
          .where(eq(schema.departments.id, config.department_id))
          .limit(1);
        companyId = department?.company_id || null;
      }
    }

    // Para testes de admin, usar token global se não há empresa específica
    const apiToken = await this.getApiToken(config.provider, companyId, db);
    if (!apiToken) {
      throw new Error(`Token não configurado para provedor ${config.provider}`);
    }

    return provider.analyze(testTitle, testDescription, config, apiToken);
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
      const config = await this.getActiveAiConfiguration(companyId, departmentId, 'priority', db);

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

      console.log(`[AI] Usando configuração original do departamento ${departmentId}`);

      const provider = this.providers.get(config.provider);
      if (!provider) {
        console.log(`[AI] Provedor ${config.provider} não disponível`);
        return null;
      }

      // Buscar token do system_settings
      const apiToken = await this.getApiToken(config.provider, companyId, db);
      if (!apiToken) {
        console.log(`[AI] Token não configurado para provedor ${config.provider}`);
        return null;
      }

      console.log(`[AI] Analisando prioridade com ${config.provider}/${config.model} para departamento ${departmentId}`);
      const result = await this.executeWithRetry(
        () => provider.analyze(title, description, config, apiToken),
        config.max_retries
      );

             // Fazer match da prioridade retornada pela IA com o banco
       result.priority = this.matchPriorityFromBank(result.priority, departmentPrioritiesList);

      // Salvar histórico
      await this.saveAnalysisHistory({ title, description, companyId, departmentId }, config, result, 'success', db);

      console.log(`[AI] Resultado: ${result.priority} (confiança: ${result.confidence})`);
      return result;

    } catch (error: any) {
      console.error('[AI] Erro na análise de prioridade:', error);
      return null;
    }
  }
}