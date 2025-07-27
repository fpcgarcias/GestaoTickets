import { Request, Response } from "express";
import { eq, desc, and, ne, sql, count, isNull, or, like } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { db } from "../db";
import { AiService } from "../services/ai-service";

// GET /api/ai-configurations - Listar todas as configurações de IA (globais e por departamento)
export async function getAiConfigurations(req: Request, res: Response) {
  try {
    const { department_id, analysis_type, company_id } = req.query;
    const userRole = req.session?.userRole;
    const userCompanyId = req.session?.companyId;

    // Verificar se a empresa tem permissão para usar IA (exceto para admin)
    if (userRole !== 'admin' && userCompanyId) {
      const [company] = await db
        .select({ ai_permission: schema.companies.ai_permission })
        .from(schema.companies)
        .where(eq(schema.companies.id, userCompanyId))
        .limit(1);

      if (!company?.ai_permission) {
        return res.status(403).json({ 
          message: "Sua empresa não tem permissão para usar recursos de IA",
          ai_permission: false
        });
      }
    }
    let baseQuery = db
      .select({
            id: schema.aiConfigurations.id,
    name: schema.aiConfigurations.name,
    provider: schema.aiConfigurations.provider,
    model: schema.aiConfigurations.model,
    api_endpoint: schema.aiConfigurations.api_endpoint,
        system_prompt: schema.aiConfigurations.system_prompt,
        user_prompt_template: schema.aiConfigurations.user_prompt_template,
        department_id: schema.aiConfigurations.department_id,
        company_id: schema.aiConfigurations.company_id,
        is_active: schema.aiConfigurations.is_active,
        is_default: schema.aiConfigurations.is_default,
        temperature: schema.aiConfigurations.temperature,
        max_tokens: schema.aiConfigurations.max_tokens,
        timeout_seconds: schema.aiConfigurations.timeout_seconds,
        max_retries: schema.aiConfigurations.max_retries,
        fallback_priority: schema.aiConfigurations.fallback_priority,
        analysis_type: schema.aiConfigurations.analysis_type,
        created_at: schema.aiConfigurations.created_at,
        updated_at: schema.aiConfigurations.updated_at,
        created_by_name: schema.users.name,
        department_name: schema.departments.name,
      })
      .from(schema.aiConfigurations)
      .leftJoin(schema.users, eq(schema.aiConfigurations.created_by_id, schema.users.id))
      .leftJoin(schema.departments, eq(schema.aiConfigurations.department_id, schema.departments.id));
    // Construir condições de filtro
    let whereConditions: any[] = [];
    
    // Filtro por empresa
    if (userRole === 'admin' && company_id) {
      // Admin pode filtrar por qualquer empresa
      whereConditions.push(eq(schema.aiConfigurations.company_id, parseInt(company_id as string)));
    } else if (userRole !== 'admin' && userCompanyId) {
      // Usuários não-admin só veem configurações da própria empresa
      whereConditions.push(eq(schema.aiConfigurations.company_id, userCompanyId));
    }
    if (department_id) {
      if (department_id === 'global') {
        whereConditions.push(isNull(schema.aiConfigurations.department_id));
      } else {
        whereConditions.push(eq(schema.aiConfigurations.department_id, parseInt(department_id as string)));
      }
    }
    if (analysis_type) {
      whereConditions.push(eq(schema.aiConfigurations.analysis_type, String(analysis_type)));
    }
    let configurations;
    if (whereConditions.length > 0) {
      configurations = await baseQuery
        .where(and(...whereConditions))
        .orderBy(desc(schema.aiConfigurations.created_at));
    } else {
      configurations = await baseQuery
        .orderBy(desc(schema.aiConfigurations.created_at));
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
    const userRole = req.session?.userRole;
    const userCompanyId = req.session?.companyId;
    const {
      name,
      provider,
      model,
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
      analysis_type,
    } = req.body;
    if (!name || !provider || !model || !system_prompt || !user_prompt_template || !analysis_type) {
      return res.status(400).json({ 
        message: "Campos obrigatórios: name, provider, model, system_prompt, user_prompt_template, analysis_type" 
      });
    }

    // Verificar se o provedor e modelo estão disponíveis no system_settings
    const [providerSetting] = await db
      .select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, `ai_${provider}_provider`))
      .limit(1);

    if (!providerSetting) {
      return res.status(400).json({ 
        message: `Provedor ${provider} não está configurado no sistema. Entre em contato com o administrador.` 
      });
    }

    const [modelSetting] = await db
      .select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, `ai_${provider}_model`))
      .limit(1);

    if (!modelSetting || modelSetting.value !== model) {
      return res.status(400).json({ 
        message: `Modelo ${model} não está disponível para o provedor ${provider}. Entre em contato com o administrador.` 
      });
    }
    if (!department_id) {
      return res.status(400).json({ 
        message: "Campo obrigatório: department_id. Cada configuração deve ser específica de um departamento." 
      });
    }
    let targetCompanyId: number | null = null;
    if (userRole === 'admin') {
      targetCompanyId = req.body.company_id || null;
    } else {
      if (!userCompanyId) {
        return res.status(400).json({ 
          message: "Usuário deve estar associado a uma empresa para criar configurações de IA" 
        });
      }
      targetCompanyId = userCompanyId;
    }
    if (is_default) {
      // Desativar configurações padrão existentes para o mesmo departamento e tipo de análise
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(
          and(
            eq(schema.aiConfigurations.department_id, department_id),
            eq(schema.aiConfigurations.analysis_type, analysis_type),
            targetCompanyId ? eq(schema.aiConfigurations.company_id, targetCompanyId) : isNull(schema.aiConfigurations.company_id),
            eq(schema.aiConfigurations.is_default, true)
          )
        );
    }

    const [newConfiguration] = await db
      .insert(schema.aiConfigurations)
      .values({
        name,
        provider,
        model,
        api_endpoint,
        system_prompt,
        user_prompt_template,
        department_id,
        company_id: targetCompanyId,
        temperature: temperature,
      max_tokens: max_tokens,
      timeout_seconds: timeout_seconds,
      max_retries: max_retries,
      fallback_priority: fallback_priority,
        is_active: is_active !== undefined ? is_active : true,
        is_default: is_default || false,
        created_by_id: userId,
        updated_by_id: userId,
        analysis_type,
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
      system_prompt,
      user_prompt_template,
      department_id,
      analysis_type = 'priority',
      test_title = "Sistema de email não está funcionando",
      test_description = "Não consigo enviar nem receber emails desde esta manhã. Isso está afetando todo o trabalho da equipe."
    } = req.body;
    
    const userRole = req.session?.userRole;
    const userCompanyId = req.session?.companyId;
    
    if (!analysis_type) {
      return res.status(400).json({ 
        message: "Campo obrigatório: analysis_type" 
      });
    }
    let testCompanyId: number | null = null;
    
    if (department_id) {
      try {
        const [department] = await db
          .select({ company_id: schema.departments.company_id })
          .from(schema.departments)
          .where(eq(schema.departments.id, department_id))
          .limit(1);
        if (department?.company_id) {
          testCompanyId = department.company_id;
        }
      } catch (error) {
        console.warn('Erro ao buscar departamento para teste:', error);
      }
    }
    
    const finalSystemPrompt = system_prompt;
    const finalUserPrompt = user_prompt_template;
    const testConfig: schema.AiConfiguration = {
      id: 0,
      name: "Teste",
      provider: provider as any,
      model,
      api_endpoint: null,
      system_prompt: finalSystemPrompt,
      user_prompt_template: finalUserPrompt,
      department_id: department_id || null,
      company_id: null,
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
      analysis_type,
    };
    
    const aiService = new AiService();
    // Para admin, usar o companyId da sessão ou null para token global
    const forceCompanyId = userRole === 'admin' ? (testCompanyId || userCompanyId || null) : testCompanyId;
    
    // Para análise de reabertura, usar apenas a descrição como mensagem do cliente
    if (analysis_type === 'reopen') {
      const result = await aiService.testConfiguration(testConfig, '', test_description, forceCompanyId);
      res.json({
        success: true,
        result,
        message: "Teste executado com sucesso",
        used_prompts: {
          system_prompt: finalSystemPrompt,
          user_prompt: finalUserPrompt
        }
      });
    } else {
      // Para análise de prioridade, usar título e descrição
      const result = await aiService.testConfiguration(testConfig, test_title, test_description, forceCompanyId);
      res.json({
        success: true,
        result,
        message: "Teste executado com sucesso",
        used_prompts: {
          system_prompt: finalSystemPrompt,
          user_prompt: finalUserPrompt
        }
      });
    }
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
    const userRole = req.session?.userRole;
    const userCompanyId = req.session?.companyId;
    if (isNaN(configurationId)) {
      return res.status(400).json({ message: "ID de configuração inválido" });
    }
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
      analysis_type,
    } = req.body;
    const targetDepartmentId = department_id !== undefined ? department_id : existingConfig.department_id;
    const targetAnalysisType = analysis_type !== undefined ? analysis_type : existingConfig.analysis_type;
    if (!targetDepartmentId || !targetAnalysisType) {
      return res.status(400).json({ 
        message: "Campos obrigatórios: department_id, analysis_type. Cada configuração deve ser específica de um departamento e tipo de análise." 
      });
    }

    // Verificar se o provedor e modelo estão disponíveis no system_settings
    if (provider && model) {
      const [providerSetting] = await db
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, `ai_${provider}_provider`))
        .limit(1);

      if (!providerSetting) {
        return res.status(400).json({ 
          message: `Provedor ${provider} não está configurado no sistema. Entre em contato com o administrador.` 
        });
      }

      const [modelSetting] = await db
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, `ai_${provider}_model`))
        .limit(1);

      if (!modelSetting || modelSetting.value !== model) {
        return res.status(400).json({ 
          message: `Modelo ${model} não está disponível para o provedor ${provider}. Entre em contato com o administrador.` 
        });
      }
    }
    let targetCompanyId: number | null = existingConfig.company_id;
    if (userRole === 'admin') {
      if (req.body.company_id !== undefined) {
        targetCompanyId = req.body.company_id;
      }
    } else {
      if (existingConfig.company_id !== userCompanyId) {
        return res.status(403).json({ 
          message: "Você não pode editar configurações de outras empresas" 
        });
      }
      targetCompanyId = userCompanyId;
    }
    if (is_default && !existingConfig.is_default) {
      await db
        .update(schema.aiConfigurations)
        .set({ is_default: false, updated_at: new Date() })
        .where(
          and(
            eq(schema.aiConfigurations.department_id, targetDepartmentId),
            eq(schema.aiConfigurations.analysis_type, targetAnalysisType),
            targetCompanyId ? eq(schema.aiConfigurations.company_id, targetCompanyId) : isNull(schema.aiConfigurations.company_id),
            eq(schema.aiConfigurations.is_default, true),
            ne(schema.aiConfigurations.id, configurationId)
          )
        );
    }
    const [updatedConfiguration] = await db
      .update(schema.aiConfigurations)
      .set({
        name,
        provider,
        model,
        api_endpoint,
        system_prompt,
        user_prompt_template,
        department_id: targetDepartmentId,
        company_id: targetCompanyId,
        temperature,
        max_tokens,
        timeout_seconds,
        max_retries,
        fallback_priority,
        is_active,
        is_default,
        updated_at: new Date(),
        updated_by_id: userId,
        analysis_type: targetAnalysisType,
      })
      .where(eq(schema.aiConfigurations.id, configurationId))
      .returning();
    res.json(updatedConfiguration);
  } catch (error) {
    console.error('Erro ao atualizar configuração de IA:', error);
    res.status(500).json({ message: "Falha ao atualizar configuração de IA", error: String(error) });
  }
}

// GET /api/ai-configurations/providers - Buscar provedores e modelos disponíveis
export async function getAiProviders(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;
    const userCompanyId = req.session?.companyId;

    // Verificar se a empresa tem permissão para usar IA (exceto para admin)
    if (userRole !== 'admin' && userCompanyId) {
      const [company] = await db
        .select({ ai_permission: schema.companies.ai_permission })
        .from(schema.companies)
        .where(eq(schema.companies.id, userCompanyId))
        .limit(1);

      if (!company?.ai_permission) {
        return res.status(403).json({ 
          message: "Sua empresa não tem permissão para usar recursos de IA",
          ai_permission: false
        });
      }
    }

    // Buscar provedores e modelos disponíveis no system_settings
    const providers = await db
      .select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(
        or(
          like(schema.systemSettings.key, 'ai_%_provider'),
          like(schema.systemSettings.key, 'ai_%_model'),
          like(schema.systemSettings.key, 'ai_%_endpoint')
        )
      );

    // Organizar os dados por provedor
    const providersData: Record<string, any> = {};
    
    providers.forEach(provider => {
      const key = provider.key;
      if (key.startsWith('ai_') && key.endsWith('_provider')) {
        const providerName = key.replace('ai_', '').replace('_provider', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].name = provider.value;
        providersData[providerName].key = providerName; // Chave para usar no frontend
      } else if (key.startsWith('ai_') && key.endsWith('_model')) {
        const providerName = key.replace('ai_', '').replace('_model', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].model = provider.value;
      } else if (key.startsWith('ai_') && key.endsWith('_endpoint')) {
        const providerName = key.replace('ai_', '').replace('_endpoint', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].endpoint = provider.value;
      }
    });

    // Retornar apenas provedores que têm nome e modelo configurados
    const availableProviders = Object.values(providersData).filter(
      (provider: any) => provider.name && provider.model
    );

    res.json(availableProviders);
  } catch (error) {
    console.error('Erro ao buscar provedores de IA:', error);
    res.status(500).json({ message: "Falha ao buscar provedores de IA", error: String(error) });
  }
}

// GET /api/ai-configurations/admin/providers - Buscar todos os provedores e tokens (apenas admin)
export async function getAiProvidersAdmin(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;

    if (userRole !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
    }

    // Buscar todos os provedores, modelos, endpoints e tokens
    const settings = await db
      .select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(
        or(
          like(schema.systemSettings.key, 'ai_%_provider'),
          like(schema.systemSettings.key, 'ai_%_model'),
          like(schema.systemSettings.key, 'ai_%_endpoint'),
          like(schema.systemSettings.key, 'ai_%_token')
        )
      );

    // Organizar os dados por provedor
    const providersData: Record<string, any> = {};
    
    settings.forEach(setting => {
      const key = setting.key;
      if (key.startsWith('ai_') && key.endsWith('_provider')) {
        const providerName = key.replace('ai_', '').replace('_provider', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].name = setting.value;
      } else if (key.startsWith('ai_') && key.endsWith('_model')) {
        const providerName = key.replace('ai_', '').replace('_model', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].model = setting.value;
      } else if (key.startsWith('ai_') && key.endsWith('_endpoint')) {
        const providerName = key.replace('ai_', '').replace('_endpoint', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].endpoint = setting.value;
      } else if (key.startsWith('ai_') && key.endsWith('_token')) {
        const providerName = key.replace('ai_', '').replace('_token', '');
        if (!providersData[providerName]) {
          providersData[providerName] = {};
        }
        providersData[providerName].token = setting.value;
      }
    });

    res.json(Object.values(providersData));
  } catch (error) {
    console.error('Erro ao buscar provedores de IA (admin):', error);
    res.status(500).json({ message: "Falha ao buscar provedores de IA", error: String(error) });
  }
}

// PUT /api/ai-configurations/admin/providers - Atualizar provedores e tokens (apenas admin)
export async function updateAiProvidersAdmin(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;

    if (userRole !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
    }

    const { providers } = req.body;

    if (!providers || !Array.isArray(providers)) {
      return res.status(400).json({ message: "Dados inválidos. Esperado array de provedores." });
    }

    // Atualizar cada provedor
    for (const provider of providers) {
      const { name, model, endpoint, token } = provider;
      
      if (name) {
        await saveSystemSetting(`ai_${name}_provider`, name);
      }
      if (model) {
        await saveSystemSetting(`ai_${name}_model`, model);
      }
      if (endpoint) {
        await saveSystemSetting(`ai_${name}_endpoint`, endpoint);
      }
      if (token) {
        await saveSystemSetting(`ai_${name}_token`, token);
      }
    }

    res.json({ message: "Provedores atualizados com sucesso" });
  } catch (error) {
    console.error('Erro ao atualizar provedores de IA:', error);
    res.status(500).json({ message: "Falha ao atualizar provedores de IA", error: String(error) });
  }
}

// GET /api/ai-configurations/admin/companies - Listar empresas com permissões de IA (apenas admin)
export async function getAiCompanies(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;

    if (userRole !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
    }

    // Buscar todas as empresas com suas permissões de IA
    const companies = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        email: schema.companies.email,
        ai_permission: schema.companies.ai_permission,
        created_at: schema.companies.created_at
      })
      .from(schema.companies)
      .orderBy(schema.companies.name);

    res.json(companies);
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({ message: "Falha ao buscar empresas", error: String(error) });
  }
}

// PUT /api/ai-configurations/admin/companies/:id/permission - Atualizar permissão de IA de uma empresa
export async function updateAiCompanyPermission(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;
    const companyId = parseInt(req.params.id);
    const { ai_permission } = req.body;

    if (userRole !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
    }

    if (isNaN(companyId)) {
      return res.status(400).json({ message: "ID da empresa inválido" });
    }

    if (typeof ai_permission !== 'boolean') {
      return res.status(400).json({ message: "Campo ai_permission deve ser um boolean" });
    }

    // Atualizar permissão da empresa
    await db
      .update(schema.companies)
      .set({ ai_permission, updated_at: new Date() })
      .where(eq(schema.companies.id, companyId));

    res.json({ message: "Permissão de IA atualizada com sucesso" });
  } catch (error) {
    console.error('Erro ao atualizar permissão de IA da empresa:', error);
    res.status(500).json({ message: "Falha ao atualizar permissão de IA", error: String(error) });
  }
}

// Função auxiliar para salvar configurações do sistema
async function saveSystemSetting(key: string, value: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(schema.systemSettings)
      .set({ value, updated_at: new Date() })
      .where(eq(schema.systemSettings.key, key));
  } else {
    await db
      .insert(schema.systemSettings)
      .values({ key, value });
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