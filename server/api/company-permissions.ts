import { Request, Response } from 'express';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

// GET /api/company-permissions/:companyId - Buscar permissões de uma empresa
export async function getCompanyPermissions(req: Request, res: Response) {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      return res.status(400).json({ message: "ID de empresa inválido" });
    }

    // Buscar empresa com suas permissões
    const [company] = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        ai_permission: schema.companies.ai_permission,
      })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    res.json({
      company_id: company.id,
      company_name: company.name,
      permissions: {
        ai_enabled: company.ai_permission,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar permissões da empresa:', error);
    res.status(500).json({ message: "Falha ao buscar permissões da empresa", error: String(error) });
  }
}

// PUT /api/company-permissions/:companyId - Atualizar permissões de uma empresa
export async function updateCompanyPermissions(req: Request, res: Response) {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      return res.status(400).json({ message: "ID de empresa inválido" });
    }

    const { ai_enabled } = req.body;

    if (typeof ai_enabled !== 'boolean') {
      return res.status(400).json({ message: "ai_enabled deve ser um boolean" });
    }

    // Verificar se empresa existe
    const [existingCompany] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId))
      .limit(1);

    if (!existingCompany) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    // Atualizar permissões
    const [updatedCompany] = await db
      .update(schema.companies)
      .set({ 
        ai_permission: ai_enabled,
        updated_at: new Date() 
      })
      .where(eq(schema.companies.id, companyId))
      .returning({
        id: schema.companies.id,
        name: schema.companies.name,
        ai_permission: schema.companies.ai_permission,
      });

    res.json({
      company_id: updatedCompany.id,
      company_name: updatedCompany.name,
      permissions: {
        ai_enabled: updatedCompany.ai_permission,
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar permissões da empresa:', error);
    res.status(500).json({ message: "Falha ao atualizar permissões da empresa", error: String(error) });
  }
}

// GET /api/companies-permissions - Listar todas as empresas com suas permissões
export async function getAllCompaniesPermissions(req: Request, res: Response) {
  try {
    const companies = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        active: schema.companies.active,
        ai_permission: schema.companies.ai_permission,
      })
      .from(schema.companies)
      .orderBy(schema.companies.name);

    const companiesWithPermissions = companies.map((company: any) => ({
      company_id: company.id,
      company_name: company.name,
      active: company.active,
      permissions: {
        ai_enabled: company.ai_permission,
      }
    }));

    res.json(companiesWithPermissions);
  } catch (error) {
    console.error('Erro ao buscar empresas e permissões:', error);
    res.status(500).json({ message: "Falha ao buscar empresas e permissões", error: String(error) });
  }
}

// GET/PUT /api/settings/ai-usage - Para company_admin gerenciar o toggle de uso de IA
export async function getAiUsageSettings(req: Request, res: Response) {
  try {
    const companyId = req.session.companyId;
    
    if (!companyId) {
      return res.status(400).json({ message: "Empresa não identificada" });
    }

    // Verificar se a empresa tem permissão para usar IA
    const [company] = await db
      .select({ ai_permission: schema.companies.ai_permission })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    if (!company.ai_permission) {
      return res.status(403).json({ 
        message: "Empresa não tem permissão para usar IA",
        ai_permission_granted: false 
      });
    }

    // Buscar configuração de uso da IA (system_settings)
    const [setting] = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, `ai_usage_company_${companyId}`))
      .limit(1);

    const aiUsageEnabled = setting ? setting.value === 'true' : true; // Default true

    res.json({
      ai_permission_granted: true,
      ai_usage_enabled: aiUsageEnabled,
    });
  } catch (error) {
    console.error('Erro ao buscar configurações de uso de IA:', error);
    res.status(500).json({ message: "Falha ao buscar configurações de uso de IA", error: String(error) });
  }
}

export async function updateAiUsageSettings(req: Request, res: Response) {
  try {
    const companyId = req.session.companyId;
    const { ai_usage_enabled } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Empresa não identificada" });
    }

    if (typeof ai_usage_enabled !== 'boolean') {
      return res.status(400).json({ message: "ai_usage_enabled deve ser um boolean" });
    }

    // Verificar se a empresa tem permissão para usar IA
    const [company] = await db
      .select({ ai_permission: schema.companies.ai_permission })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    if (!company.ai_permission) {
      return res.status(403).json({ 
        message: "Empresa não tem permissão para usar IA",
        ai_permission_granted: false 
      });
    }

    // Salvar configuração de uso da IA
    const settingKey = `ai_usage_company_${companyId}`;
    const settingValue = ai_usage_enabled.toString();

    // Verificar se já existe a configuração
    const [existingSetting] = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, settingKey))
      .limit(1);

    if (existingSetting) {
      // Atualizar
      await db
        .update(schema.systemSettings)
        .set({ 
          value: settingValue,
          updated_at: new Date() 
        })
        .where(eq(schema.systemSettings.key, settingKey));
    } else {
      // Criar nova
      await db
        .insert(schema.systemSettings)
        .values({
          key: settingKey,
          value: settingValue,
          company_id: companyId,
        });
    }

    res.json({
      ai_permission_granted: true,
      ai_usage_enabled: ai_usage_enabled,
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações de uso de IA:', error);
    res.status(500).json({ message: "Falha ao atualizar configurações de uso de IA", error: String(error) });
  }
} 