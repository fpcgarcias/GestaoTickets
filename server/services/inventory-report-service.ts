import * as XLSX from 'xlsx';
import { db } from '../db';
import {
  inventoryProducts,
  inventoryMovements,
  userInventoryAssignments,
  inventoryResponsibilityTerms,
  inventorySuppliers,
  departments,
  users,
  type InventoryProduct,
} from '@shared/schema';
import { and, eq, isNull, sql, lt, or } from 'drizzle-orm';

export type ReportFormat = 'json' | 'xlsx';

export type InventoryReportType =
  | 'inventory_full'
  | 'products_by_user'
  | 'products_by_department'
  | 'movements_history'
  | 'maintenance'
  | 'write_off'
  | 'cost_by_department'
  | 'depreciation'
  | 'tco'
  | 'supplier_analysis'
  | 'compliance_docs'
  | 'licenses_expiring'
  | 'terms_pending'
  | 'audit_movements';

export interface ReportRequest {
  companyId: number;
  type: InventoryReportType;
  format?: ReportFormat;
  filters?: Record<string, unknown>;
}

class InventoryReportService {
  async generateReport(request: ReportRequest) {
    const data = await this.fetchData(request);

    if ((request.format ?? 'json') === 'xlsx') {
      return this.toExcelBuffer(request.type, data);
    }

    return data;
  }

  private async fetchData(request: ReportRequest) {
    switch (request.type) {
      case 'inventory_full':
        return this.getFullInventory(request.companyId);
      case 'products_by_user':
        return this.getProductsByUser(request.companyId);
      case 'products_by_department':
        return this.getProductsByDepartment(request.companyId);
      case 'movements_history':
      case 'audit_movements':
        return this.getMovementsHistory(request.companyId);
      case 'maintenance':
        return this.getMaintenanceList(request.companyId);
      case 'write_off':
        return this.getWriteOffList(request.companyId);
      case 'cost_by_department':
        return this.getCostByDepartment(request.companyId);
      case 'depreciation':
        return this.getDepreciationAnalysis(request.companyId);
      case 'tco':
        return this.getTcoAnalysis(request.companyId);
      case 'supplier_analysis':
        return this.getSupplierAnalysis(request.companyId);
      case 'compliance_docs':
      case 'terms_pending':
        return this.getCompliancePending(request.companyId);
      case 'licenses_expiring':
        return this.getWarrantyExpiring(request.companyId);
      default:
        throw new Error(`Relatório ${request.type} não implementado.`);
    }
  }

  private async getFullInventory(companyId: number) {
    return db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.is_deleted, false)
      ));
  }

  private async getProductsByUser(companyId: number) {
    return db
      .select({
        assignmentId: userInventoryAssignments.id,
        userName: users.name,
        userEmail: users.email,
        productName: inventoryProducts.name,
        serial: inventoryProducts.serial_number,
        assignedDate: userInventoryAssignments.assigned_date,
        expectedReturn: userInventoryAssignments.expected_return_date,
      })
      .from(userInventoryAssignments)
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .where(eq(userInventoryAssignments.company_id, companyId));
  }

  private async getProductsByDepartment(companyId: number) {
    return db
      .select({
        department: departments.name,
        productName: inventoryProducts.name,
        status: inventoryProducts.status,
        location: inventoryProducts.location_id,
      })
      .from(inventoryProducts)
      .leftJoin(departments, eq(inventoryProducts.department_id, departments.id))
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.is_deleted, false)
      ));
  }

  private async getMovementsHistory(companyId: number) {
    return db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.company_id, companyId))
      .orderBy(inventoryMovements.movement_date);
  }

  private async getMaintenanceList(companyId: number) {
    return db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.status, 'maintenance')
      ));
  }

  private async getWriteOffList(companyId: number) {
    return db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.status, 'written_off')
      ));
  }

  private async getCostByDepartment(companyId: number) {
    return db
      .select({
        department: departments.name,
        totalValue: sql<number>`sum(COALESCE(NULLIF(${inventoryProducts.purchase_value}, ''), '0')::numeric)`,
      })
      .from(inventoryProducts)
      .leftJoin(departments, eq(inventoryProducts.department_id, departments.id))
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.is_deleted, false)
      ))
      .groupBy(departments.name);
  }

  private async getDepreciationAnalysis(companyId: number) {
    const products = await this.getFullInventory(companyId);
    return products.map((product) => ({
      productName: product.name,
      purchaseValue: this.toNumber(product.purchase_value),
      depreciationValue: this.toNumber(product.depreciation_value),
      netValue: this.toNumber(product.purchase_value) - this.toNumber(product.depreciation_value),
    }));
  }

  private async getTcoAnalysis(companyId: number) {
    const products = await this.getFullInventory(companyId);
    return products.map((product) => ({
      productName: product.name,
      totalCost: this.toNumber(product.purchase_value) + this.toNumber(product.depreciation_value),
      department: product.department_id,
      status: product.status,
    }));
  }

  private async getSupplierAnalysis(companyId: number) {
    return db
      .select({
        supplier: inventorySuppliers.name,
        totalItems: sql<number>`count(${inventoryProducts.id})`,
        totalValue: sql<number>`sum(COALESCE(NULLIF(${inventoryProducts.purchase_value}, ''), '0')::numeric)`,
      })
      .from(inventoryProducts)
      .leftJoin(inventorySuppliers, eq(inventoryProducts.supplier_id, inventorySuppliers.id))
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        eq(inventoryProducts.is_deleted, false)
      ))
      .groupBy(inventorySuppliers.name);
  }

  private async getCompliancePending(companyId: number) {
    return db
      .select({
        assignmentId: userInventoryAssignments.id,
        userName: users.name,
        productName: inventoryProducts.name,
        termStatus: inventoryResponsibilityTerms.status,
      })
      .from(userInventoryAssignments)
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(
        inventoryResponsibilityTerms,
        eq(inventoryResponsibilityTerms.assignment_id, userInventoryAssignments.id)
      )
      .where(and(
        eq(userInventoryAssignments.company_id, companyId),
        or(
          isNull(inventoryResponsibilityTerms.status),
          eq(inventoryResponsibilityTerms.status, 'pending'),
          eq(inventoryResponsibilityTerms.status, 'sent')
        )
      ));
  }

  private async getWarrantyExpiring(companyId: number) {
    return db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.company_id, companyId),
        lt(inventoryProducts.warranty_expiry, addDaysSql(30)),
        eq(inventoryProducts.is_deleted, false)
      ));
  }

  private toExcelBuffer(reportName: string, data: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = {
      SheetNames: ['Relatório'],
      Sheets: { Relatório: worksheet },
    };
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private toNumber(value?: string | number | null): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    return Number(value.replace(',', '.')) || 0;
  }
}

function addDaysSql(days: number) {
  return sql`NOW() + interval '${days} days'`;
}

export const inventoryReportService = new InventoryReportService();
export default inventoryReportService;

