import { Request, Response } from 'express';
import { db } from '../db';
import {
  inventoryProducts,
  inventoryAlerts,
  inventoryMovements,
  ticketInventoryItems,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

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
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(inventoryProducts)
      .where(and(eq(inventoryProducts.company_id, companyId), eq(inventoryProducts.is_deleted, false)));

    const statuses = await db
      .select({
        status: inventoryProducts.status,
        count: sql<number>`count(*)`,
      })
      .from(inventoryProducts)
      .where(and(eq(inventoryProducts.company_id, companyId), eq(inventoryProducts.is_deleted, false)))
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
    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.company_id, companyId))
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
    const data = await db
      .select({
        productId: ticketInventoryItems.product_id,
        uses: sql<number>`count(*)`,
      })
      .from(ticketInventoryItems)
      .leftJoin(inventoryProducts, eq(ticketInventoryItems.product_id, inventoryProducts.id))
      .where(eq(inventoryProducts.company_id, companyId))
      .groupBy(ticketInventoryItems.product_id)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao listar produtos mais requisitados:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

