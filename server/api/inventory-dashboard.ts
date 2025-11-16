import { Request, Response } from 'express';
import { db } from '../db';
import {
  inventoryProducts,
  inventoryAlerts,
  inventoryMovements,
  ticketInventoryItems,
} from '@shared/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
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

export async function getInventoryDashboardStats(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [
      eq(inventoryProducts.company_id, companyId),
      eq(inventoryProducts.is_deleted, false)
    ];

    // Filtro por departamento
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, total: 0, statuses: [] });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        conditions.push(
          or(
            inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
            sql`${inventoryProducts.department_id} IS NULL`
          )
        );
      }
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(inventoryProducts)
      .where(and(...conditions));

    const statuses = await db
      .select({
        status: inventoryProducts.status,
        count: sql<number>`count(*)`,
      })
      .from(inventoryProducts)
      .where(and(...conditions))
      .groupBy(inventoryProducts.status);

    res.json({ success: true, total, statuses });
  } catch (error) {
    console.error('Erro ao obter estatísticas do dashboard:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function getInventoryDashboardAlerts(req: Request, res: Response) {
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

    // TODO: Filtrar alerts por departamento quando tiver product_id vinculado
    const alerts = await db
      .select()
      .from(inventoryAlerts)
      .where(and(eq(inventoryAlerts.company_id, companyId), eq(inventoryAlerts.is_resolved, false)))
      .orderBy(desc(inventoryAlerts.created_at))
      .limit(20);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Erro ao listar alertas do dashboard:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function getInventoryDashboardMovements(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [eq(inventoryMovements.company_id, companyId)];

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

        conditions.push(inArray(inventoryMovements.product_id, productIds));
      }
    }

    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.movement_date))
      .limit(20);

    res.json({ success: true, data: movements });
  } catch (error) {
    console.error('Erro ao listar movimentações recentes:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function getInventoryDashboardTopProducts(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [eq(inventoryProducts.company_id, companyId)];

    // Filtro por departamento
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, data: [] });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        conditions.push(
          or(
            inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
            sql`${inventoryProducts.department_id} IS NULL`
          )
        );
      }
    }

    const data = await db
      .select({
        productId: ticketInventoryItems.product_id,
        uses: sql<number>`count(*)`,
      })
      .from(ticketInventoryItems)
      .leftJoin(inventoryProducts, eq(ticketInventoryItems.product_id, inventoryProducts.id))
      .where(and(...conditions))
      .groupBy(ticketInventoryItems.product_id)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao listar produtos mais requisitados:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

