import { Request, Response } from 'express';
import { db } from '../db';
import { productTypes, productCategories } from '@shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { getDepartmentFilter } from '../utils/department-filter';

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
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const includeInactive = req.query.include_inactive === 'true';

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [eq(productTypes.company_id, companyId)];

    if (!includeInactive) {
      conditions.push(eq(productTypes.is_active, true));
    }

    // Filtro por departamento via CATEGORIA
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, data: [] });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        conditions.push(
          or(
            inArray(productTypes.category_id, sql`(
              SELECT id FROM product_categories 
              WHERE ${productCategories.department_id} = ANY(${sql.array(deptFilter.departmentIds!, 'int4')})
                 OR ${productCategories.department_id} IS NULL
            )` as any),
            sql`EXISTS (
              SELECT 1 FROM product_categories pc
              WHERE pc.id = ${productTypes.category_id}
                AND (pc.department_id = ANY(${sql.array(deptFilter.departmentIds!, 'int4')}) OR pc.department_id IS NULL)
            )`
          )
        );
      }
    }

    const types = await db
      .select()
      .from(productTypes)
      .where(and(...conditions))
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
    const userRole = req.session?.userRole;
    const typeId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const updates = {
      ...req.body,
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
    const userRole = req.session?.userRole;
    const typeId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

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

