import { addDays, differenceInDays } from 'date-fns';
import { db } from '../db';
import {
  inventoryAlerts,
  inventoryProducts,
  productTypes,
  productCategories,
  userInventoryAssignments,
  departmentInventorySettings,
  type InventoryProduct,
} from '@shared/schema';
import { eq, and, lt, isNull, sql } from 'drizzle-orm';

export type AlertType =
  | 'low_stock'
  | 'warranty_expiring'
  | 'overdue_return'
  | 'maintenance_due'
  | 'obsolete_item';

interface AlertContext {
  productId?: number;
  assignmentId?: number;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

class InventoryAlertService {
  async runFullScan(companyId: number): Promise<void> {
    const products = await db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.is_deleted, false)
      ));

    for (const product of products) {
      await this.evaluateProduct(product);
    }

    await this.checkOverdueAssignments(companyId);
  }

  async evaluateProduct(product: InventoryProduct): Promise<void> {
    await Promise.all([
      this.checkLowStock(product),
      this.checkWarranty(product),
      this.checkMaintenance(product),
      this.checkObsolete(product),
    ]);
  }

  async resolveAlert(alertId: number, userId?: number): Promise<void> {
    await db
      .update(inventoryAlerts)
      .set({
        is_resolved: true,
        resolved_at: new Date(),
        resolved_by_id: userId ?? null,
      })
      .where(eq(inventoryAlerts.id, alertId));
  }

  private async checkLowStock(product: InventoryProduct) {
    if (!product.product_type_id) return;

    const [typeAndCategory] = await db
      .select({
        type_id: productTypes.id,
        name: productTypes.name,
        category_min_stock_alert: productCategories.min_stock_alert,
      })
      .from(productTypes)
      .leftJoin(productCategories, eq(productCategories.id, productTypes.category_id))
      .where(eq(productTypes.id, product.product_type_id))
      .limit(1);

    if (!typeAndCategory || !typeAndCategory.category_min_stock_alert) return;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, product.company_id),
        eq(inventoryProducts.product_type_id, product.product_type_id),
        eq(inventoryProducts.status, 'available'),
        eq(inventoryProducts.is_deleted, false)
      ));

    if (Number(count) <= (typeAndCategory.category_min_stock_alert as number)) {
      await this.createAlert(product.company_id, 'low_stock', {
        productId: product.id,
        message: `Estoque crítico para o tipo ${typeAndCategory.name}. Disponíveis: ${count}`,
        severity: Number(count) === 0 ? 'critical' : 'high',
      });
    }
  }

  private async checkWarranty(product: InventoryProduct) {
    if (!product.warranty_expiry) return;
    const expiry = new Date(product.warranty_expiry);
    const daysLeft = differenceInDays(expiry, new Date());
    if (daysLeft > 30) return;

    await this.createAlert(product.company_id, 'warranty_expiring', {
      productId: product.id,
      message: `Garantia expira em ${daysLeft} dias (${expiry.toLocaleDateString('pt-BR')})`,
      severity: daysLeft <= 7 ? 'high' : 'medium',
    });
  }

  private async checkMaintenance(product: InventoryProduct) {
    if (!product.department_id) return;

    const [settings] = await db
      .select()
      .from(departmentInventorySettings)
      .where(eq(departmentInventorySettings.department_id, product.department_id))
      .limit(1);

    if (!settings?.maintenance_interval_days) return;

    const nextMaintenance = addDays(
      product.updated_at ?? product.created_at ?? new Date(),
      settings.maintenance_interval_days
    );

    if (nextMaintenance < new Date()) {
      await this.createAlert(product.company_id, 'maintenance_due', {
        productId: product.id,
        message: `Manutenção preventiva vencida. Última atualização em ${product.updated_at?.toLocaleDateString('pt-BR')}`,
        severity: 'medium',
      });
    }
  }

  private async checkObsolete(product: InventoryProduct) {
    const referenceDate = product.updated_at ?? product.created_at;
    if (!referenceDate) return;

    const daysInactive = differenceInDays(new Date(), referenceDate);
    if (daysInactive < 365) return;

    await this.createAlert(product.company_id, 'obsolete_item', {
      productId: product.id,
      message: `Produto sem movimentação há ${daysInactive} dias.`,
      severity: 'low',
    });
  }

  private async checkOverdueAssignments(companyId: number) {
    const assignments = await db
      .select()
      .from(userInventoryAssignments)
      .where(and(
        eq(userInventoryAssignments.company_id, companyId),
        isNull(userInventoryAssignments.actual_return_date),
        lt(userInventoryAssignments.expected_return_date, new Date())
      ));

    for (const assignment of assignments) {
      await this.createAlert(companyId, 'overdue_return', {
        assignmentId: assignment.id,
        productId: assignment.product_id,
        message: `Devolução em atraso desde ${assignment.expected_return_date?.toLocaleDateString('pt-BR')}`,
        severity: 'high',
      });
    }
  }

  private async createAlert(companyId: number, type: AlertType, context: AlertContext): Promise<void> {
    const conditions = [
      eq(inventoryAlerts.company_id, companyId),
      eq(inventoryAlerts.alert_type, type),
      eq(inventoryAlerts.is_resolved, false),
    ];

    if (context.productId) {
      conditions.push(eq(inventoryAlerts.product_id, context.productId));
    } else {
      conditions.push(isNull(inventoryAlerts.product_id));
    }

    if (context.assignmentId) {
      conditions.push(eq(inventoryAlerts.assignment_id, context.assignmentId));
    } else {
      conditions.push(isNull(inventoryAlerts.assignment_id));
    }

    const existing = await db
      .select()
      .from(inventoryAlerts)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(inventoryAlerts).values({
      company_id: companyId,
      alert_type: type,
      product_id: context.productId ?? null,
      assignment_id: context.assignmentId ?? null,
      severity: context.severity ?? 'medium',
      message: context.message,
    });
  }
}

export const inventoryAlertService = new InventoryAlertService();
export default inventoryAlertService;

