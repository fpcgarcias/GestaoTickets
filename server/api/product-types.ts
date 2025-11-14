import { Request, Response } from 'express';
import { db } from '../db';
import { productTypes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

function resolveCompanyId(req: Request): number {
  const userRole = req.session?.userRole;
  const sessionCompanyId = req.session?.companyId;
  if (userRole === 'admin' && req.query.company_id) {
    return parseInt(req.query.company_id as string, 10);
  }
  if (sessionCompanyId) {
    return sessionCompanyId;
  }
  throw new Error('Empresa não definida na sessão.');
}

export async function listProductTypes(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const includeInactive = req.query.include_inactive === 'true';

    const types = await db
      .select()
      .from(productTypes)
      .where(and(
        eq(productTypes.company_id, companyId),
        includeInactive ? eq(productTypes.company_id, companyId) : eq(productTypes.is_active, true)
      ))
      .orderBy(productTypes.name);

    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Erro ao listar tipos de produto:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createProductType(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const payload = {
      ...req.body,
      company_id: companyId,
      custom_fields: JSON.stringify(req.body.custom_fields ?? {}),
    };

    const [created] = await db.insert(productTypes).values(payload).returning();
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Erro ao criar tipo de produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function updateProductType(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const typeId = parseInt(req.params.id, 10);
    const updates = {
      ...req.body,
      custom_fields: req.body.custom_fields ? JSON.stringify(req.body.custom_fields) : undefined,
    };

    const [updated] = await db
      .update(productTypes)
      .set(updates)
      .where(and(eq(productTypes.id, typeId), eq(productTypes.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Tipo de produto não encontrado' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao atualizar tipo de produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deleteProductType(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const typeId = parseInt(req.params.id, 10);

    const [updated] = await db
      .update(productTypes)
      .set({ is_active: false })
      .where(and(eq(productTypes.id, typeId), eq(productTypes.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Tipo de produto não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover tipo de produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

