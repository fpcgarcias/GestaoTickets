import { Request, Response } from 'express';
import { db } from '../db';
import { inventorySuppliers } from '@shared/schema';
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

export async function listSuppliers(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const includeInactive = req.query.include_inactive === 'true';

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const suppliers = await db
      .select()
      .from(inventorySuppliers)
      .where(and(
        eq(inventorySuppliers.company_id, companyId),
        includeInactive ? eq(inventorySuppliers.company_id, companyId) : eq(inventorySuppliers.is_active, true)
      ))
      .orderBy(inventorySuppliers.name);

    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Erro ao listar fornecedores:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const payload = {
      ...req.body,
      company_id: companyId,
    };

    const [supplier] = await db.insert(inventorySuppliers).values(payload).returning();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function updateSupplier(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const supplierId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(inventorySuppliers)
      .set(req.body)
      .where(and(eq(inventorySuppliers.id, supplierId), eq(inventorySuppliers.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao atualizar fornecedor:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deactivateSupplier(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const supplierId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(inventorySuppliers)
      .set({ is_active: false })
      .where(and(eq(inventorySuppliers.id, supplierId), eq(inventorySuppliers.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao desativar fornecedor:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

