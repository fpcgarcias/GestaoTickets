import { db } from '../db';
import { 
  aiSuggestions, 
  aiSuggestionLogs, 
  tickets, 
  ticketReplies, 
  users, 
  departments,
  aiConfigurations,
  companies,
  systemSettings,
  type InsertAiSuggestion,
  type InsertAiSuggestionLog,
  type AiSuggestion
} from '@shared/schema';
import * as schema from '@shared/schema';
import { eq, and, desc, sql, ilike, or, isNull } from 'drizzle-orm';
import { logger } from './logger';
import { AiService } from './ai-service';
import * as fs from 'fs';
import * as path from 'path';

interface SimilarTicket {
  id: number;
  title: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: Date;
}

interface AISuggestionResponse {
  summary: string;
  confidence: number;
  step_by_step: string[];
  commands?: string[];
  additional_notes?: string;
  estimated_time?: string;
}

interface AISuggestionResult {
  id: number;
  ticket_id: number;
  similar_tickets_count: number;
  success_rate: number;
  confidence: number;
  suggestion: AISuggestionResponse;
  feedback_rating?: number;
  created_at: string;
}

export class AISuggestionService {
  /**
   * Gera uma sugestão de IA para um ticket
   */
  async generateSuggestion(
    ticketId: number, 
    userId: number, 
    departmentId: number
  ): Promise<AISuggestionResult> {
    try {
      // 1. Verificar se o usuário pode usar IA
      await this.validateUserPermissions(userId, departmentId);

      // 2. Buscar o ticket atual primeiro para obter companyId
      const currentTicket = await this.getCurrentTicket(ticketId);
      if (!currentTicket) {
        throw new Error('Ticket não encontrado');
      }

      // 3. Buscar configuração de IA para o departamento
      const aiConfig = await this.getAIConfiguration(departmentId, currentTicket.company_id || 0);
      if (!aiConfig) {
        throw new Error('Configuração de IA não encontrada para este departamento');
      }

      // 4. Buscar tickets similares
      const similarTickets = await this.findSimilarTickets(currentTicket, departmentId);
      
      // 5. Calcular taxa de sucesso
      const successRate = this.calculateSuccessRate(similarTickets);

      // 6. Gerar sugestão com IA
      const aiResponse = await this.generateAIResponse(
        currentTicket, 
        similarTickets, 
        aiConfig
      );

      // 7. Salvar sugestão no banco
      const suggestion = await this.saveSuggestion({
        ticket_id: ticketId,
        user_id: userId,
        department_id: departmentId,
        similar_tickets_count: similarTickets.length,
        success_rate: successRate.toString(),
        confidence_score: aiResponse.confidence.toString(),
        suggestion_type: 'hybrid',
        prompt_used: this.buildPrompt(currentTicket, similarTickets),
        ai_response: JSON.stringify(aiResponse),
        structured_suggestion: JSON.stringify(aiResponse),
      });

      // 8. Log da ação
      await this.logAction(suggestion.id, 'generated', { 
        similar_tickets_count: similarTickets.length,
        success_rate: successRate,
        confidence: aiResponse.confidence
      }, userId);

      // 9. Retornar sugestão no formato esperado pelo frontend
      return {
        id: suggestion.id,
        ticket_id: suggestion.ticket_id,
        similar_tickets_count: suggestion.similar_tickets_count,
        success_rate: parseFloat(suggestion.success_rate || '0'),
        confidence: parseFloat(suggestion.confidence_score || '0'),
        suggestion: aiResponse,
        feedback_rating: suggestion.feedback_rating || undefined,
        created_at: suggestion.created_at instanceof Date ? suggestion.created_at.toISOString() : suggestion.created_at
      };

    } catch (error) {
      logger.error('Erro ao gerar sugestão de IA:', error);
      throw error;
    }
  }

  /**
   * Valida se o usuário pode usar IA
   */
  private async validateUserPermissions(userId: number, departmentId: number): Promise<void> {
    const userResult = await db
      .select({
        id: users.id,
        role: users.role,
        company_id: users.company_id
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userResult[0];
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se o usuário tem role permitido
    const allowedRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
    if (!allowedRoles.includes(user.role)) {
      throw new Error('Usuário não tem permissão para usar IA');
    }

    // Para admin, não precisa verificar permissão da empresa
    if (user.role === 'admin') {
      return;
    }

    // Verificar se a empresa tem permissão de IA
    if (user.company_id) {
      const companyResult = await db
        .select({
          ai_permission: schema.companies.ai_permission
        })
        .from(schema.companies)
        .where(eq(schema.companies.id, user.company_id))
        .limit(1);

      const company = companyResult[0];
      if (!company?.ai_permission) {
        throw new Error('Empresa não tem permissão para usar IA');
      }
    }
  }

  /**
   * Busca configuração de IA para o departamento
   */
  private async getAIConfiguration(departmentId: number, companyId: number) {
    console.log('🔍 Buscando configuração de IA para departamento:', departmentId, 'empresa:', companyId);
    
    const aiService = new AiService();
    const config = await aiService['getActiveAiConfiguration'](companyId, departmentId, 'ticket_suggestions', db);
    
    console.log('🔍 Configuração encontrada:', config);
    return config;
  }

  /**
   * Busca o ticket atual
   */
  private async getCurrentTicket(ticketId: number) {
    const ticketResult = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        company_id: tickets.company_id,
        department_id: tickets.department_id,
        incident_type_id: tickets.incident_type_id,
        category_id: tickets.category_id,
        created_at: tickets.created_at
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    return ticketResult[0] || null;
  }

  /**
   * Busca tickets similares baseado em critérios
   */
  private async findSimilarTickets(currentTicket: any, departmentId: number): Promise<SimilarTicket[]> {
    // Extrair palavras-chave do título e descrição
    const keywords = this.extractKeywords(currentTicket.title + ' ' + currentTicket.description);
    
    console.log('🔍 Palavras-chave extraídas:', {
      technical: keywords.technical,
      general: keywords.general,
      ticketTitle: currentTicket.title
    });
    
    if (keywords.technical.length === 0 && keywords.general.length === 0) {
      return []; // Se não há palavras-chave, não há tickets similares
    }
    
    // PRIORIDADE 1: Buscar tickets com palavras técnicas EXATAS
    let similarTickets: any[] = [];
    
    if (keywords.technical.length > 0) {
      console.log('🎯 Buscando tickets com palavras técnicas:', keywords.technical);
      
      // Construir condições de busca seguras para palavras técnicas
      const technicalConditions = keywords.technical.map(keyword => 
        or(
          ilike(tickets.title, `%${keyword}%`),
          ilike(tickets.description, `%${keyword}%`)
        )
      );

      similarTickets = await db
        .select({
          id: tickets.id,
          title: tickets.title,
          description: tickets.description,
          status: tickets.status,
          created_at: tickets.created_at,
          company_id: tickets.company_id,
          incident_type_id: tickets.incident_type_id,
          category_id: tickets.category_id,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.department_id, departmentId),
            eq(tickets.company_id, currentTicket.company_id),
            eq(tickets.status, 'resolved'),
            sql`${tickets.id} <> ${currentTicket.id}`,
            // Buscar por palavras técnicas no título OU descrição
            or(...technicalConditions)
          )
        )
        .orderBy(desc(tickets.created_at))
        .limit(50);
    }
    
    // PRIORIDADE 2: Se não encontrou com palavras técnicas, buscar por tipo/categoria
    if (similarTickets.length === 0) {
      console.log('🔄 Buscando por tipo/categoria (fallback)');
      
      similarTickets = await db
        .select({
          id: tickets.id,
          title: tickets.title,
          description: tickets.description,
          status: tickets.status,
          created_at: tickets.created_at,
          company_id: tickets.company_id,
          incident_type_id: tickets.incident_type_id,
          category_id: tickets.category_id,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.department_id, departmentId),
            eq(tickets.company_id, currentTicket.company_id),
            eq(tickets.status, 'resolved'),
            sql`${tickets.id} <> ${currentTicket.id}`,
            // Critério mais rigoroso: mesmo tipo OU mesma categoria
            or(
              eq(tickets.incident_type_id, currentTicket.incident_type_id),
              eq(tickets.category_id, currentTicket.category_id)
            )
          )
        )
        .orderBy(desc(tickets.created_at))
        .limit(50);
    }

    // Calcular score de similaridade para cada ticket
    const ticketsWithScore = similarTickets.map(ticket => {
      let score = 0;
      
      // PONTUAÇÃO ALTA para palavras técnicas EXATAS no título (peso 100)
      const titleTechnicalMatches = keywords.technical.filter(keyword => 
        ticket.title.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += titleTechnicalMatches * 100;
      
      // PONTUAÇÃO ALTA para palavras técnicas EXATAS na descrição (peso 80)
      const descTechnicalMatches = keywords.technical.filter(keyword => 
        ticket.description?.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += descTechnicalMatches * 80;
      
      // Pontuação por tipo de incidente igual (peso 50)
      if (ticket.incident_type_id === currentTicket.incident_type_id) {
        score += 50;
      }
      
      // Pontuação por categoria igual (peso 30)
      if (ticket.category_id === currentTicket.category_id) {
        score += 30;
      }
      
      // Pontuação BAIXA para palavras gerais no título (peso 5)
      const titleGeneralMatches = keywords.general.filter(keyword => 
        ticket.title.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += titleGeneralMatches * 5;
      
      // Pontuação BAIXA para palavras gerais na descrição (peso 2)
      const descGeneralMatches = keywords.general.filter(keyword => 
        ticket.description?.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += descGeneralMatches * 2;
      
      console.log(`📊 Score para ticket ${ticket.id} (${ticket.title.substring(0, 30)}...):`, {
        titleTechnical: titleTechnicalMatches,
        descTechnical: descTechnicalMatches,
        titleGeneral: titleGeneralMatches,
        descGeneral: descGeneralMatches,
        totalScore: score
      });
      
      return { ...ticket, similarityScore: score };
    });

    // FILTRO RIGOROSO: Score mínimo de 80 para palavras técnicas, 50 para outros
    const minScore = keywords.technical.length > 0 ? 80 : 50;
    
    const relevantTickets = ticketsWithScore
      .filter(ticket => ticket.similarityScore >= minScore)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10); // Máximo 10 tickets realmente similares

    console.log('✅ Tickets filtrados por score mínimo:', {
      minScore,
      found: relevantTickets.length,
      scores: relevantTickets.map(t => ({ id: t.id, score: t.similarityScore }))
    });

    // Buscar resoluções dos tickets similares
    const ticketsWithResolutions = await Promise.all(
      relevantTickets.map(async (ticket) => {
        const lastReplyResult = await db
          .select({
            message: ticketReplies.message
          })
          .from(ticketReplies)
          .where(eq(ticketReplies.ticket_id, ticket.id))
          .orderBy(desc(ticketReplies.created_at))
          .limit(1);

        const lastReply = lastReplyResult[0];

        return {
          ...ticket,
          resolution: lastReply?.message || null
        };
      })
    );

    console.log('🔍 Tickets similares encontrados:', {
      count: ticketsWithResolutions.length,
      tickets: ticketsWithResolutions.map(t => ({
        id: t.id,
        title: t.title?.substring(0, 50) + '...',
        score: t.similarityScore,
        hasResolution: !!t.resolution,
        resolutionLength: t.resolution?.length || 0
      }))
    });

    return ticketsWithResolutions;
  }

  /**
   * Constrói o prompt para a IA (fallback quando não há template configurado)
   */
  private buildPrompt(currentTicket: any, similarTickets: SimilarTicket[]): string {
    const similarTicketsData = similarTickets.map(ticket => 
      `- Título: ${ticket.title}\n  Resolução: ${ticket.resolution || 'Não disponível'}`
    ).join('\n');

    return `
TICKET ATUAL:
- Título: ${currentTicket.title}
- Descrição: ${currentTicket.description}
- Tipo: N/A
- Categoria: N/A
- Departamento: N/A

CASOS SIMILARES ENCONTRADOS (${similarTickets.length}):
${similarTicketsData}

INSTRUÇÕES IMPORTANTES:
1. Analise PRIMEIRO o título e descrição do ticket atual para entender o problema específico
2. Compare com os casos similares para identificar padrões de resolução
3. Gere sugestões RELEVANTES e ESPECÍFICAS para o problema descrito
4. NÃO sugira soluções genéricas que não se aplicam ao problema específico
5. Se o problema é de hardware (teclado, mouse, etc.), foque em soluções de hardware
6. Se o problema é de software, foque em soluções de software
7. Se o problema é de rede, foque em soluções de rede
8. Seja ESPECÍFICO e RELEVANTE ao problema descrito

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "summary": "Resumo específico do problema e abordagem sugerida",
  "confidence": 85,
  "step_by_step": [
    "Passo 1: Solução específica para o problema",
    "Passo 2: Próximo passo relevante"
  ],
  "commands": ["comando específico se aplicável"],
  "additional_notes": "Observações relevantes ao problema",
  "estimated_time": "tempo realista"
}

CRÍTICO: Responda EXCLUSIVAMENTE com JSON válido. NÃO inclua texto antes ou depois do JSON.
`;
  }

  /**
   * Extrai palavras-chave do texto com priorização técnica
   */
  private extractKeywords(text: string): { technical: string[], general: string[] } {
    // Palavras técnicas de alta prioridade (devem ser preservadas)
    const technicalKeywords = [
      'vpn', 'rede', 'internet', 'wifi', 'conexão', 'ip', 'dns', 'firewall',
      'impressora', 'scanner', 'monitor', 'teclado', 'mouse', 'notebook', 'desktop',
      'windows', 'office', 'outlook', 'teams', 'excel', 'word', 'powerpoint',
      'email', 'senha', 'login', 'acesso', 'permissão', 'usuário', 'conta',
      'backup', 'arquivo', 'pasta', 'compartilhamento', 'servidor', 'banco',
      'software', 'programa', 'aplicativo', 'instalação', 'atualização',
      'licença', 'antivirus', 'segurança', 'certificado', 'ssl'
    ];

    // Lista de stopwords em português
    const stopwords = [
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos',
      'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem',
      'que', 'quando', 'onde', 'como', 'porque', 'então', 'mas', 'e', 'ou',
      'não', 'sim', 'também', 'ainda', 'já', 'sempre', 'nunca', 'muito',
      'pouco', 'mais', 'menos', 'bem', 'mal', 'hoje', 'ontem', 'amanhã',
      'ser', 'estar', 'ter', 'fazer', 'ir', 'vir', 'dar', 'ver', 'saber',
      'dizer', 'poder', 'querer', 'ficar', 'passar', 'vir', 'chegar',
      'favor', 'preciso', 'gostaria', 'obrigado', 'obrigada', 'bom', 'boa',
      'dia', 'tarde', 'noite', 'manhã', 'pessoal', 'galera', 'time'
    ];

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.includes(word));

    // Separar palavras técnicas das gerais
    const technical = words.filter(word => technicalKeywords.includes(word));
    const general = words.filter(word => 
      !technicalKeywords.includes(word) && 
      !['sistema', 'problema', 'erro', 'ticket', 'solicitação', 'chamado'].includes(word)
    );

    return {
      technical: [...new Set(technical)], // Remove duplicatas
      general: [...new Set(general)].slice(0, 5) // Máximo 5 palavras gerais
    };
  }

  /**
   * Calcula taxa de sucesso dos tickets similares
   */
  private calculateSuccessRate(similarTickets: SimilarTicket[]): number {
    if (similarTickets.length === 0) return 0;
    
    const resolvedCount = similarTickets.filter(t => t.status === 'resolved').length;
    return Math.round((resolvedCount / similarTickets.length) * 100);
  }

  /**
   * Gera resposta da IA
   */
  private async generateAIResponse(
    currentTicket: any, 
    similarTickets: SimilarTicket[], 
    aiConfig: any
  ): Promise<AISuggestionResponse> {
    const prompt = this.buildPrompt(currentTicket, similarTickets);
    
    // Usar o AiService existente para chamar a IA real
    const { AiService } = await import('./ai-service');
    const aiService = new AiService();
    
    try {
      // Buscar token da configuração
      const token = await this.getApiToken(aiConfig.provider, currentTicket.company_id);
      if (!token) {
        throw new Error(`Token não encontrado para provedor ${aiConfig.provider}`);
      }

      // Chamar a IA real usando o provider
      const provider = aiService['providers'].get(aiConfig.provider);
      if (!provider) {
        throw new Error(`Provedor ${aiConfig.provider} não disponível`);
      }

      // Ajustar max_tokens se for muito alto para o modelo
      // GPT-5-mini tem limitações, reduzir tokens para evitar timeout
      const maxTokensForModel = aiConfig.model.includes('gpt-5') ? 4000 : 32768;
      const adjustedConfig = {
        ...aiConfig,
        max_tokens: Math.min(aiConfig.max_tokens || 1000, maxTokensForModel),
        // Aumentar timeout para GPT-5 que é mais lento
        timeout_seconds: aiConfig.model.includes('gpt-5') ? 60 : (aiConfig.timeout_seconds || 30)
      };

      // Fazer requisição direta para a API da OpenAI (não usar provider de prioridade!)
      const response = await this.callOpenAI(
        aiConfig,
        similarTickets,
        currentTicket,
        token
      );
      
      console.log('🔍 Resultado da IA (Sugestão):', {
        response: typeof response,
        responseContent: response?.substring(0, 200) + '...' // Mostrar apenas início para debug
      });

      // Converter a resposta para o formato esperado
      let aiResponse: AISuggestionResponse;
      
      try {
        // Limpar a resposta removendo possíveis caracteres extras
        let responseText = response.trim();
        
        // Tentar extrair JSON da resposta (pode ter texto antes/depois)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseText = jsonMatch[0];
        }
        
        // Tentar fazer parse do JSON
        const parsedResponse = JSON.parse(responseText);
        
        // Validar se a resposta tem a estrutura esperada
        if (parsedResponse && typeof parsedResponse === 'object') {
          aiResponse = {
            summary: parsedResponse.summary || `Análise baseada em ${similarTickets.length} casos similares`,
            confidence: typeof parsedResponse.confidence === 'number' ? parsedResponse.confidence : 75,
            step_by_step: Array.isArray(parsedResponse.step_by_step) ? parsedResponse.step_by_step : [
              "1. Analise o problema específico descrito",
              "2. Aplique as soluções baseadas nos casos similares", 
              "3. Teste a solução antes de finalizar"
            ],
            commands: Array.isArray(parsedResponse.commands) ? parsedResponse.commands : [],
            additional_notes: parsedResponse.additional_notes || "Sugestão baseada em análise de casos similares",
            estimated_time: parsedResponse.estimated_time || "Varia conforme complexidade"
          };
          
          console.log('✅ JSON parseado com sucesso:', {
            hasSummary: !!aiResponse.summary,
            confidence: aiResponse.confidence,
            stepsCount: aiResponse.step_by_step.length
          });
        } else {
          throw new Error('Resposta não é um objeto válido');
        }
        
      } catch (parseError) {
        console.warn('⚠️ Erro ao fazer parse do JSON, usando resposta padrão:', parseError);
        
        // Tentar extrair informações úteis da resposta mesmo sem JSON válido
        const responseText = response.toLowerCase();
        let extractedSummary = `Análise baseada em ${similarTickets.length} casos similares`;
        let extractedSteps: string[] = [
          "1. Analise o problema específico descrito",
          "2. Aplique as soluções baseadas nos casos similares",
          "3. Teste a solução antes de finalizar"
        ];
        
        // Tentar extrair passos se houver numeração na resposta
        const stepMatches = response.match(/\d+\.\s*[^\n]+/g);
        if (stepMatches && stepMatches.length > 0) {
          extractedSteps = stepMatches.slice(0, 5); // Máximo 5 passos
        }
        
        aiResponse = {
          summary: extractedSummary,
          confidence: 60, // Confiança menor por não ter JSON válido
          step_by_step: extractedSteps,
          commands: [],
          additional_notes: "Resposta processada com parsing alternativo devido a formato inválido",
          estimated_time: "Varia conforme complexidade"
        };
      }

      return aiResponse;

    } catch (error) {
      console.error('Erro ao chamar IA:', error);
      
      // Fallback: resposta baseada nos casos similares
      return {
        summary: `Baseado em ${similarTickets.length} tickets similares, este é um problema relacionado a ${currentTicket.title}.`,
        confidence: Math.min(75, 50 + (similarTickets.length * 3)),
        step_by_step: [
          "1. Analise o problema específico descrito no ticket",
          "2. Consulte os casos similares para referência",
          "3. Aplique a solução mais adequada"
        ],
        commands: [],
        additional_notes: "Sugestão baseada em análise de casos similares. Consulte os tickets relacionados para mais detalhes.",
        estimated_time: "Varia conforme complexidade"
      };
    }
  }

  /**
   * Busca o token de API do system_settings
   */
  private async getApiToken(provider: string, companyId: number): Promise<string | null> {
    try {
      // Buscar token específico da empresa primeiro
      const [companyToken] = await db
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
      const [globalToken] = await db
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
      console.error(`Erro ao buscar token para provedor ${provider}:`, error);
      return null;
    }
  }

  /**
   * Processa o template do prompt substituindo as variáveis pelos dados reais
   */
  private processPromptTemplate(template: string, currentTicket: any, similarTickets: SimilarTicket[]): string {
    if (!template) {
      return this.buildPrompt(currentTicket, similarTickets); // Fallback para o prompt hardcoded
    }

    // Preparar dados dos tickets similares
    const similarTicketsData = similarTickets.map((ticket, index) => 
      `${index + 1}. Título: ${ticket.title}\n   Descrição: ${ticket.description}\n   Resolução: ${ticket.resolution || 'Não disponível'}`
    ).join('\n\n');

    // Buscar informações adicionais do ticket
    const ticketType = currentTicket.incident_type_name || 'N/A';
    const ticketCategory = currentTicket.category_name || 'N/A';
    const departmentName = currentTicket.department_name || 'N/A';

    // Substituir as variáveis no template
    let processedTemplate = template
      .replace(/{ticket_title}/g, currentTicket.title || '')
      .replace(/{ticket_description}/g, currentTicket.description || '')
      .replace(/{ticket_type}/g, ticketType)
      .replace(/{ticket_category}/g, ticketCategory)
      .replace(/{department_name}/g, departmentName)
      .replace(/{similar_count}/g, similarTickets.length.toString())
      .replace(/{similar_tickets_data}/g, similarTicketsData);

    console.log('🔍 Template processado:', {
      originalLength: template.length,
      processedLength: processedTemplate.length,
      similarTicketsCount: similarTickets.length,
      hasTicketData: !!currentTicket.title,
      hasSimilarData: similarTicketsData.length > 0
    });

    // DEBUG: Salvar o prompt completo em arquivo para debug
    const debugDir = path.join(process.cwd(), 'server', 'debug');
    
    // Criar diretório de debug se não existir
    try {
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
        console.log(`🔍 DEBUG: Diretório criado em ${debugDir}`);
      }
    } catch (error) {
      console.error('❌ Erro ao criar diretório de debug:', error);
      console.log(`🔍 Tentando criar em: ${debugDir}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugFile = path.join(debugDir, `prompt-debug-${timestamp}.json`);
    
    const debugData = {
      timestamp: new Date().toISOString(),
      ticketId: currentTicket.id,
      ticketTitle: currentTicket.title,
      similarTicketsCount: similarTickets.length,
      similarTickets: similarTickets.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        resolution: t.resolution,
        hasResolution: !!t.resolution
      })),
      template: template,
      processedPrompt: processedTemplate,
      promptLength: processedTemplate.length
    };
    
    try {
      fs.writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
      console.log(`🔍 DEBUG: Prompt salvo em ${debugFile}`);
    } catch (error) {
      console.error('❌ Erro ao salvar arquivo de debug:', error);
      console.log(`🔍 Tentando salvar em: ${debugFile}`);
    }

    // DEBUG: Mostrar dados dos tickets similares
    console.log('🔍 DADOS DOS TICKETS SIMILARES:');
    similarTickets.forEach((ticket, index) => {
      console.log(`   ${index + 1}. ${ticket.title} | Resolução: ${ticket.resolution ? 'SIM' : 'NÃO'}`);
    });

    // DEBUG: Mostrar parte do prompt final
    console.log('🔍 PROMPT FINAL (primeiros 500 chars):');
    console.log(processedTemplate.substring(0, 500));
    console.log('🔍 PROMPT FINAL (últimos 500 chars):');
    console.log(processedTemplate.substring(processedTemplate.length - 500));

    return processedTemplate;
  }

  /**
   * Salva sugestão no banco
   */
  private async saveSuggestion(data: InsertAiSuggestion): Promise<AiSuggestion> {
    const [suggestion] = await db.insert(aiSuggestions).values(data).returning();
    return suggestion;
  }

  /**
   * Registra log de ação
   */
  private async logAction(
    suggestionId: number, 
    action: string, 
    details: any, 
    userId?: number
  ): Promise<void> {
    await db.insert(aiSuggestionLogs).values({
      suggestion_id: suggestionId,
      action,
      details: JSON.stringify(details),
      user_id: userId
    });
  }

  /**
   * Registra feedback do usuário
   */
  async recordFeedback(
    suggestionId: number, 
    rating: number, 
    comment?: string, 
    userId?: number
  ): Promise<void> {
    try {
      // Atualizar sugestão com feedback
      await db
        .update(aiSuggestions)
        .set({
          feedback_rating: rating,
          feedback_comment: comment,
          updated_at: new Date()
        })
        .where(eq(aiSuggestions.id, suggestionId));

      // Log da ação
      await this.logAction(suggestionId, 'rated', { 
        rating, 
        comment 
      }, userId);

    } catch (error) {
      logger.error('Erro ao registrar feedback:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de sugestões para um ticket
   */
  async getSuggestionHistory(ticketId: number): Promise<any[]> {
    const suggestions = await db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.ticket_id, ticketId))
      .orderBy(desc(aiSuggestions.created_at));

    // Transformar os dados para o formato esperado pelo frontend
    return suggestions.map(suggestion => {
      let structuredSuggestion;
      try {
        // Se structured_suggestion é string, fazer parse
        if (typeof suggestion.structured_suggestion === 'string') {
          structuredSuggestion = JSON.parse(suggestion.structured_suggestion);
        } 
        // Se já é objeto, usar diretamente
        else if (typeof suggestion.structured_suggestion === 'object' && suggestion.structured_suggestion !== null) {
          structuredSuggestion = suggestion.structured_suggestion;
        }
        // Se é null/undefined, usar null
        else {
          structuredSuggestion = null;
        }
      } catch (error) {
        console.error('Erro ao fazer parse do structured_suggestion:', error);
        structuredSuggestion = null;
      }

      return {
        id: suggestion.id,
        ticket_id: suggestion.ticket_id,
        similar_tickets_count: suggestion.similar_tickets_count,
        success_rate: parseFloat(suggestion.success_rate || '0'),
        confidence: parseFloat(suggestion.confidence_score || '0'),
        suggestion: structuredSuggestion || {
          summary: 'Sugestão não disponível',
          confidence: 0,
          step_by_step: [],
          commands: [],
          additional_notes: '',
          estimated_time: 'N/A'
        },
        feedback_rating: suggestion.feedback_rating,
        created_at: suggestion.created_at.toISOString()
      };
    });
  }

  /**
   * Busca configuração de IA para um departamento (método público)
   */
  async getAIConfigForDepartment(departmentId: number, companyId: number): Promise<any> {
    return await this.getAIConfiguration(departmentId, companyId);
  }

  /**
   * Faz requisição para a API da OpenAI usando o OpenAiProvider (mesma arquitetura do ai-service.ts)
   */
  private async callOpenAI(
    aiConfig: any,
    similarTickets: any[],
    currentTicket: any,
    apiToken: string
  ): Promise<string> {
    const { OpenAiProvider } = await import('./providers/openai-provider');
    const provider = new OpenAiProvider();

    // Usar o template configurado e substituir as variáveis
    const processedPrompt = this.processPromptTemplate(aiConfig.user_prompt_template, currentTicket, similarTickets);

    // Criar configuração temporária para o provider
    const tempConfig = {
      ...aiConfig,
      system_prompt: aiConfig.system_prompt || 'Você é um assistente especializado em suporte técnico. Analise o ticket e casos similares fornecidos e responda EXCLUSIVAMENTE com JSON válido no formato solicitado.',
      user_prompt_template: processedPrompt,
      max_tokens: aiConfig.max_tokens || 1500,
      temperature: aiConfig.temperature || '0.3',
      timeout_seconds: aiConfig.timeout_seconds || 30, // Usar timeout configurável como no ai-service
      analysis_type: 'ticket_suggestions'
    };

    console.log('🔍 Enviando para OpenAI via Provider:', {
      model: aiConfig.model,
      promptLength: processedPrompt.length,
      maxTokens: tempConfig.max_tokens,
      timeout: tempConfig.timeout_seconds
    });

    try {
      // Usar o provider oficial em vez de chamada direta
      const result = await provider.analyze('', '', tempConfig, apiToken);
      
      console.log('✅ Resposta da OpenAI via Provider:', {
        hasResult: !!result,
        processingTime: result.processingTimeMs,
        usedFallback: result.usedFallback,
        tokensUsed: result.tokensUsed
      });

      // O provider retorna um objeto, mas precisamos do conteúdo bruto
      // Vamos usar o rawResponse se disponível
      if (result.rawResponse?.choices?.[0]?.message?.content) {
        return result.rawResponse.choices[0].message.content;
      }
      
      // Fallback: construir resposta baseada no resultado do provider
      return JSON.stringify({
        summary: result.justification || 'Sugestão gerada automaticamente',
        confidence: result.confidence || 0.7,
        step_by_step: ['Análise realizada com sucesso'],
        commands: [],
        additional_notes: 'Resposta processada via OpenAI Provider',
        estimated_time: '15-30 minutos'
      });
      
    } catch (error: any) {
      console.error('❌ Erro no OpenAI Provider:', error);
      
      // Se for timeout, relançar com mensagem clara
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        throw new Error('Timeout na análise da OpenAI - verifique a configuração de timeout_seconds');
      }
      
      throw error;
    }
  }
}
