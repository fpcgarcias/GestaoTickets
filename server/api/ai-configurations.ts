import { Request, Response } from "express";
import { eq, desc, and, ne, sql, count } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { db } from "../db";
import { AiService } from "../services/ai-service";

// GET /api/ai-configurations - Listar todas as configurações de IA (globais)
export async function getAiConfigurations(req: Request, res: Response) {
  try {
    const configurations = await db
      .select({
        id: schema.aiConfigurations.id,
        name: schema.aiConfigurations.name,
        provider: schema.aiConfigurations.provider,
        model: schema.aiConfigurations.model,
        api_key: schema.aiConfigurations.api_key,
        api_endpoint: schema.aiConfigurations.api_endpoint,
        system_prompt: schema.aiConfigurations.system_prompt,
        user_prompt_template: schema.aiConfigurations.user_prompt_template,
        is_active: schema.aiConfigurations.is_active,
        is_default: schema.aiConfigurations.is_default,
        temperature: schema.aiConfigurations.temperature,
        max_tokens: schema.aiConfigurations.max_tokens,
        timeout_seconds: schema.aiConfigurations.timeout_seconds,
        max_retries: schema.aiConfigurations.max_retries,
        fallback_priority: schema.aiConfigurations.fallback_priority,
        created_at: schema.aiConfigurations.created_at,
        updated_at: schema.aiConfigurations.updated_at,
        created_by_name: schema.users.name,
      })
      .from(schema.aiConfigurations)
      .leftJoin(schema.users, eq(schema.aiConfigurations.created_by_id, schema.users.id))
      .orderBy(desc(schema.aiConfigurations.created_at));

    res.json(configurations);
  } catch (error) {
    console.error('Erro ao buscar configurações de IA:', error);
    res.status(500).json({ message: "Falha ao buscar configurações de IA", error: String(error) });
  }
}

// POST /api/ai-configurations - Criar nova configuração de IA (global)
export async function createAiConfiguration(req: Request, res: Response) {
  try {
    const userId = req.session.userId;

    const {
      name,
      provider,
      model,
      api_key,
      api_endpoint,
      system_prompt,
      user_prompt_template,
      temperature,
      max_tokens,
      timeout_seconds,
      max_retries,
      fallback_priority,
      is_active,
      is_default,
    } = req.body;

    if (!name || !provider || !model || !api_key || !system_prompt || !user_prompt_template) {
      return res.status(400).json({ 
        message: "Campos obrigatórios: name, provider, model, api_key, system_prompt, user_prompt_template" 
      });
    }

    // Se for definida como padrão, desativar outras configurações padrão globalmente
    if (is_default) {
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(eq(schema.aiConfigurations.is_default, true));
    }

    // Criar nova configuração
    const [newConfiguration] = await db
      .insert(schema.aiConfigurations)
      .values({
        name,
        provider,
        model,
        api_key,
        api_endpoint,
        system_prompt,
        user_prompt_template,
        temperature: temperature || '0.1',
        max_tokens: max_tokens || 100,
        timeout_seconds: timeout_seconds || 30,
        max_retries: max_retries || 3,
        fallback_priority: fallback_priority || 'medium',
        is_active: is_active !== undefined ? is_active : true,
        is_default: is_default || false,
        created_by_id: userId,
        updated_by_id: userId,
      })
      .returning();

    res.status(201).json(newConfiguration);
  } catch (error) {
    console.error('Erro ao criar configuração de IA:', error);
    res.status(500).json({ message: "Falha ao criar configuração de IA", error: String(error) });
  }
}

// POST /api/ai-configurations/test - Testar configuração de IA
export async function testAiConfiguration(req: Request, res: Response) {
  try {
    const {
      provider = "openai",
      model = "gpt-4o",
      api_key,
      system_prompt = "Você é um assistente que analisa tickets de suporte e determina a prioridade. Responda apenas com: BAIXA, MEDIA, ALTA ou CRITICA",
      user_prompt_template = "Título: {titulo}\nDescrição: {descricao}\n\nQual a prioridade deste ticket?",
      test_title = "Sistema de email não está funcionando",
      test_description = "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
    } = req.body;

    if (!api_key) {
      return res.status(400).json({ 
        message: "Campo obrigatório: api_key" 
      });
    }

    // Criar configuração temporária para teste
    const testConfig: schema.AiConfiguration = {
      id: 0,
      name: "Teste",
      provider: provider as any,
      model,
      api_key,
      api_endpoint: null,
      system_prompt,
      user_prompt_template,
      temperature: '0.1',
      max_tokens: 100,
      timeout_seconds: 30,
      max_retries: 3,
      fallback_priority: 'medium',
      is_active: true,
      is_default: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by_id: null,
      updated_by_id: null,
    };

    // Testar configuração
    const aiService = new AiService();
    const result = await aiService.testConfiguration(testConfig, test_title, test_description);

    res.json({
      success: true,
      result,
      message: "Teste executado com sucesso"
    });
  } catch (error: any) {
    console.error('Erro ao testar configuração de IA:', error);
    res.status(500).json({ 
      success: false, 
      message: "Falha ao testar configuração de IA", 
      error: error?.message || String(error) 
    });
  }
}

// PUT /api/ai-configurations/:id - Atualizar configuração de IA
export async function updateAiConfiguration(req: Request, res: Response) {
  try {
    const configurationId = parseInt(req.params.id);
    const userId = req.session.userId;

    if (isNaN(configurationId)) {
      return res.status(400).json({ message: "ID de configuração inválido" });
    }

    // Verificar se a configuração existe
    const [existingConfig] = await db
      .select()
      .from(schema.aiConfigurations)
      .where(eq(schema.aiConfigurations.id, configurationId))
      .limit(1);

    if (!existingConfig) {
      return res.status(404).json({ message: "Configuração não encontrada" });
    }

    const {
      name,
      provider,
      model,
      api_key,
      api_endpoint,
      system_prompt,
      user_prompt_template,
      temperature,
      max_tokens,
      timeout_seconds,
      max_retries,
      fallback_priority,
      is_active,
      is_default,
    } = req.body;

    // Se for definida como padrão, desativar outras configurações padrão
    if (is_default && !existingConfig.is_default) {
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(eq(schema.aiConfigurations.is_default, true));
    }

    // Atualizar configuração
    const [updatedConfiguration] = await db
      .update(schema.aiConfigurations)
      .set({
        name,
        provider,
        model,
        api_key,
        api_endpoint,
        system_prompt,
        user_prompt_template,
        temperature,
        max_tokens,
        timeout_seconds,
        max_retries,
        fallback_priority,
        is_active,
        is_default,
        updated_at: new Date(),
        updated_by_id: userId,
      })
      .where(eq(schema.aiConfigurations.id, configurationId))
      .returning();

    res.json(updatedConfiguration);
  } catch (error) {
    console.error('Erro ao atualizar configuração de IA:', error);
    res.status(500).json({ message: "Falha ao atualizar configuração de IA", error: String(error) });
  }
}

// DELETE /api/ai-configurations/:id - Deletar configuração de IA
export async function deleteAiConfiguration(req: Request, res: Response) {
  try {
    const configurationId = parseInt(req.params.id);

    if (isNaN(configurationId)) {
      return res.status(400).json({ message: "ID de configuração inválido" });
    }

    // Verificar se a configuração existe
    const [existingConfig] = await db
      .select()
      .from(schema.aiConfigurations)
      .where(eq(schema.aiConfigurations.id, configurationId))
      .limit(1);

    if (!existingConfig) {
      return res.status(404).json({ message: "Configuração não encontrada" });
    }

    // Deletar configuração
    await db
      .delete(schema.aiConfigurations)
      .where(eq(schema.aiConfigurations.id, configurationId));

    res.json({ message: "Configuração deletada com sucesso" });
  } catch (error) {
    console.error('Erro ao deletar configuração de IA:', error);
    res.status(500).json({ message: "Falha ao deletar configuração de IA", error: String(error) });
  }
} 