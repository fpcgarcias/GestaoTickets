import { Request, Response } from 'express';
import { db } from '../db';
import {
  inventoryProducts,
  inventoryAlerts,
  inventoryMovements,
  ticketInventoryItems,
  users,
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

    // Condições base: sempre filtrar por empresa e não deletados
    const baseConditions = [
      eq(inventoryProducts.company_id, companyId),
      eq(inventoryProducts.is_deleted, false)
    ];

    // Aplicar filtro de departamento apenas se necessário
    const conditions = [...baseConditions];
    
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, total: 0, statuses: [] });
      }

      // Se for 'DEPARTMENTS', adiciona filtro de departamento
      if (deptFilter.type === 'DEPARTMENTS') {
        conditions.push(
          or(
            inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
            sql`${inventoryProducts.department_id} IS NULL`
          )
        );
      }
      // Se for 'ALL', não adiciona filtro (admin/company_admin vê tudo)
    }

    // Contar total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryProducts)
      .where(and(...conditions));

    const total = Number(count);

    // Buscar statuses
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
      .select({
        id: inventoryMovements.id,
        product_id: inventoryMovements.product_id,
        movement_type: inventoryMovements.movement_type,
        quantity: inventoryMovements.quantity,
        approval_status: inventoryMovements.approval_status,
        movement_date: inventoryMovements.movement_date,
        ticket_id: inventoryMovements.ticket_id,
        responsible_id: inventoryMovements.responsible_id,
        product_name: inventoryProducts.name,
        responsible_name: sql<string | null>`${users.name}`,
      })
      .from(inventoryMovements)
      .innerJoin(inventoryProducts, eq(inventoryMovements.product_id, inventoryProducts.id))
      .leftJoin(users, eq(inventoryMovements.responsible_id, users.id))
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

    // Condições base para produtos
    const productConditions = [
      eq(inventoryProducts.company_id, companyId),
      eq(inventoryProducts.is_deleted, false)
    ];

    // Aplicar filtro de departamento apenas se necessário
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, data: [] });
      }

      // Se for 'DEPARTMENTS', adiciona filtro de departamento
      if (deptFilter.type === 'DEPARTMENTS') {
        productConditions.push(
          or(
            inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
            sql`${inventoryProducts.department_id} IS NULL`
          )
        );
      }
      // Se for 'ALL', não adiciona filtro (admin/company_admin vê tudo)
    }

    // Buscar top products diretamente com join
    const data = await db
      .select({
        productId: ticketInventoryItems.product_id,
        name: inventoryProducts.name,
        uses: sql<number>`count(*)::int`,
      })
      .from(ticketInventoryItems)
      .innerJoin(inventoryProducts, eq(ticketInventoryItems.product_id, inventoryProducts.id))
      .where(and(...productConditions))
      .groupBy(ticketInventoryItems.product_id, inventoryProducts.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao listar produtos mais requisitados:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

