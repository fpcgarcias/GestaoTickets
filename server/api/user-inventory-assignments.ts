import { Request, Response } from 'express';
import { db } from '../db';
import { userInventoryAssignments, inventoryProducts, users } from '@shared/schema';
import { and, eq, isNull } from 'drizzle-orm';

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
    const onlyOpen = req.query.open === 'true';

    const assignments = await db
      .select({
        assignment: userInventoryAssignments,
        product: inventoryProducts,
        user: users,
      })
      .from(userInventoryAssignments)
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .where(and(
        eq(userInventoryAssignments.company_id, companyId),
        onlyOpen ? isNull(userInventoryAssignments.actual_return_date) : eq(userInventoryAssignments.company_id, companyId)
      ));

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
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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
    const assignmentId = parseInt(req.params.id, 10);
    const userId = req.session?.userId ?? null;

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

