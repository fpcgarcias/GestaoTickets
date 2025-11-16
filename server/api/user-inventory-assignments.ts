import { Request, Response } from 'express';
import { db } from '../db';
import { userInventoryAssignments, inventoryProducts, users } from '@shared/schema';
import { and, eq, isNull, or, inArray, sql } from 'drizzle-orm';
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

export async function listAssignments(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const onlyOpen = req.query.open === 'true';

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [eq(userInventoryAssignments.company_id, companyId)];

    if (onlyOpen) {
      conditions.push(isNull(userInventoryAssignments.actual_return_date));
    }

    // Filtro por departamento (via produtos)
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, data: [] });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        const allowedProducts = await db
          .select({ id: inventoryProducts.id })
          .from(inventoryProducts)
          .where(
            and(
              eq(inventoryProducts.company_id, companyId),
              or(
                inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
                sql`${inventoryProducts.department_id} IS NULL`
              )
            )
          );

        const productIds = allowedProducts.map(p => p.id);

        if (productIds.length === 0) {
          return res.json({ success: true, data: [] });
        }

        conditions.push(inArray(userInventoryAssignments.product_id, productIds));
      }
    }

    const assignments = await db
      .select({
        assignment: userInventoryAssignments,
        product: inventoryProducts,
        user: users,
      })
      .from(userInventoryAssignments)
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .where(and(...conditions));

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Erro ao listar alocações:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createAssignment(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

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
      assigned_by_id: userId,
    };

    const [assignment] = await db.insert(userInventoryAssignments).values(payload).returning();
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Erro ao criar alocação:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function registerAssignmentReturn(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const assignmentId = parseInt(req.params.id, 10);
    const userId = req.session?.userId ?? null;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(userInventoryAssignments)
      .set({
        actual_return_date: new Date(),
        condition_on_return: req.body?.condition,
        returned_by_id: userId,
      })
      .where(and(
        eq(userInventoryAssignments.id, assignmentId),
        eq(userInventoryAssignments.company_id, companyId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Alocação não encontrada' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao registrar devolução:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

