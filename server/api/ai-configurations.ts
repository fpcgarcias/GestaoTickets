import { Request, Response } from "express";
import { eq, desc, and, ne, sql, count, isNull, or } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { db } from "../db";
import { AiService } from "../services/ai-service";

// GET /api/ai-configurations - Listar todas as configurações de IA (globais e por departamento)
export async function getAiConfigurations(req: Request, res: Response) {
  try {
    const { department_id } = req.query;

    let baseQuery = db
      .select({
        id: schema.aiConfigurations.id,
        name: schema.aiConfigurations.name,
        provider: schema.aiConfigurations.provider,
        model: schema.aiConfigurations.model,
        api_key: schema.aiConfigurations.api_key,
        api_endpoint: schema.aiConfigurations.api_endpoint,
        system_prompt: schema.aiConfigurations.system_prompt,
        user_prompt_template: schema.aiConfigurations.user_prompt_template,
        department_id: schema.aiConfigurations.department_id,
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
        department_name: schema.departments.name,
      })
      .from(schema.aiConfigurations)
      .leftJoin(schema.users, eq(schema.aiConfigurations.created_by_id, schema.users.id))
      .leftJoin(schema.departments, eq(schema.aiConfigurations.department_id, schema.departments.id));

    // Aplicar filtros se especificados
    let configurations;
    if (department_id) {
      if (department_id === 'global') {
        configurations = await baseQuery.where(isNull(schema.aiConfigurations.department_id))
          .orderBy(desc(schema.aiConfigurations.created_at));
      } else {
        configurations = await baseQuery.where(eq(schema.aiConfigurations.department_id, parseInt(department_id as string)))
          .orderBy(desc(schema.aiConfigurations.created_at));
      }
    } else {
      configurations = await baseQuery.orderBy(desc(schema.aiConfigurations.created_at));
    }

    res.json(configurations);
  } catch (error) {
    console.error('Erro ao buscar configurações de IA:', error);
    res.status(500).json({ message: "Falha ao buscar configurações de IA", error: String(error) });
  }
}

// POST /api/ai-configurations - Criar nova configuração de IA
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
      department_id,
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

    // OBRIGATÓRIO: Configuração deve ter department_id
    if (!department_id) {
      return res.status(400).json({ 
        message: "Campo obrigatório: department_id. Cada configuração deve ser específica de um departamento." 
      });
    }

    // Se for definida como padrão, desativar outras configurações padrão do mesmo departamento
    if (is_default) {
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(
          and(
            eq(schema.aiConfigurations.department_id, department_id),
            eq(schema.aiConfigurations.is_default, true)
          )
        );
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
        department_id,
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
      system_prompt,
      user_prompt_template,
      department_id,
      test_title = "Sistema de email não está funcionando",
      test_description = "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
    } = req.body;

    if (!api_key) {
      return res.status(400).json({ 
        message: "Campo obrigatório: api_key" 
      });
    }

    // Se department_id for fornecido, buscar as prioridades específicas do departamento
    let adjustedSystemPrompt = system_prompt;
    let adjustedUserPrompt = user_prompt_template;

    if (department_id) {
      try {
        // Buscar empresa do departamento
        const [department] = await db
          .select({ company_id: schema.departments.company_id })
          .from(schema.departments)
          .where(eq(schema.departments.id, department_id))
          .limit(1);

        if (department?.company_id) {
          // Buscar prioridades específicas do departamento
          const priorities = await db
            .select()
            .from(schema.departmentPriorities)
            .where(
              and(
                eq(schema.departmentPriorities.company_id, department.company_id),
                eq(schema.departmentPriorities.department_id, department_id),
                eq(schema.departmentPriorities.is_active, true)
              )
            )
            .orderBy(schema.departmentPriorities.weight);

          if (priorities.length > 0) {
            // Ajustar prompts para usar as prioridades específicas do departamento
            const priorityList = priorities
              .map(p => `${p.name}: Peso ${p.weight}`)
              .join(', ');

            const priorityNames = priorities.map(p => p.name).join(', ');

            adjustedSystemPrompt = `Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nas prioridades específicas deste departamento:

Prioridades disponíveis: ${priorityList}

IMPORTANTE: Responda APENAS com o nome exato de uma das prioridades (${priorityNames}), sem pontuação adicional.`;

            adjustedUserPrompt = `Título: {titulo}

Descrição: {descricao}

Analise este ticket e determine sua prioridade considerando as diretrizes específicas do departamento. Responda APENAS com uma das seguintes opções: ${priorityNames}

Prioridade:`;
          }
        }
      } catch (error) {
        console.warn('Erro ao buscar prioridades do departamento para teste:', error);
      }
    }

    // Usar prompts padrão se não foram ajustados
    const finalSystemPrompt = adjustedSystemPrompt || "Você é um assistente que analisa tickets de suporte e determina a prioridade. Responda apenas com: BAIXA, MEDIA, ALTA ou CRITICA";
    const finalUserPrompt = adjustedUserPrompt || "Título: {titulo}\nDescrição: {descricao}\n\nQual a prioridade deste ticket?";

    // Criar configuração temporária para teste
    const testConfig: schema.AiConfiguration = {
      id: 0,
      name: "Teste",
      provider: provider as any,
      model,
      api_key,
      api_endpoint: null,
      system_prompt: finalSystemPrompt,
      user_prompt_template: finalUserPrompt,
      department_id: department_id || null,
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
      message: "Teste executado com sucesso",
      used_prompts: {
        system_prompt: finalSystemPrompt,
        user_prompt: finalUserPrompt
      }
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
      department_id,
      temperature,
      max_tokens,
      timeout_seconds,
      max_retries,
      fallback_priority,
      is_active,
      is_default,
    } = req.body;

    // OBRIGATÓRIO: Configuração deve ter department_id
    const targetDepartmentId = department_id !== undefined ? department_id : existingConfig.department_id;
    if (!targetDepartmentId) {
      return res.status(400).json({ 
        message: "Campo obrigatório: department_id. Cada configuração deve ser específica de um departamento." 
      });
    }

    // Se for definida como padrão, desativar outras configurações padrão do mesmo departamento
    if (is_default && !existingConfig.is_default) {
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(
          and(
            eq(schema.aiConfigurations.department_id, targetDepartmentId),
            eq(schema.aiConfigurations.is_default, true),
            ne(schema.aiConfigurations.id, configurationId)
          )
        );
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
        department_id: targetDepartmentId,
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