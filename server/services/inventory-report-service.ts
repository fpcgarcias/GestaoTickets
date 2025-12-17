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
} from '@shared/schema';
import { and, eq, isNull, sql, lt, or } from 'drizzle-orm';

export type ReportFormat = 'json' | 'xlsx';
export type SupportedInventoryLocale = 'pt-BR' | 'en-US';

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
  locale?: SupportedInventoryLocale;
}

interface ColumnConfig {
  key: string;
  header: Record<SupportedInventoryLocale, string>;
}

type ReportColumnConfig = Record<InventoryReportType, ColumnConfig[]>;

const DEFAULT_LOCALE: SupportedInventoryLocale = 'pt-BR';

const INVENTORY_STATUS_LABELS: Record<
  string,
  Record<SupportedInventoryLocale, string>
> = {
  available: {
    'pt-BR': 'Disponível',
    'en-US': 'Available',
  },
  in_use: {
    'pt-BR': 'Em uso',
    'en-US': 'In use',
  },
  maintenance: {
    'pt-BR': 'Em manutenção',
    'en-US': 'Maintenance',
  },
  written_off: {
    'pt-BR': 'Baixado',
    'en-US': 'Written off',
  },
  reserved: {
    'pt-BR': 'Reservado',
    'en-US': 'Reserved',
  },
};

const MOVEMENT_TYPE_LABELS: Record<
  string,
  Record<SupportedInventoryLocale, string>
> = {
  entry: {
    'pt-BR': 'Entrada',
    'en-US': 'Entry',
  },
  withdrawal: {
    'pt-BR': 'Saída',
    'en-US': 'Withdrawal',
  },
  return: {
    'pt-BR': 'Devolução',
    'en-US': 'Return',
  },
  write_off: {
    'pt-BR': 'Baixa',
    'en-US': 'Write-off',
  },
  transfer: {
    'pt-BR': 'Transferência',
    'en-US': 'Transfer',
  },
  maintenance: {
    'pt-BR': 'Manutenção',
    'en-US': 'Maintenance',
  },
  reservation: {
    'pt-BR': 'Reserva',
    'en-US': 'Reservation',
  },
};

const APPROVAL_STATUS_LABELS: Record<
  string,
  Record<SupportedInventoryLocale, string>
> = {
  pending: {
    'pt-BR': 'Pendente',
    'en-US': 'Pending',
  },
  approved: {
    'pt-BR': 'Aprovado',
    'en-US': 'Approved',
  },
  rejected: {
    'pt-BR': 'Rejeitado',
    'en-US': 'Rejected',
  },
  not_required: {
    'pt-BR': 'Não requerido',
    'en-US': 'Not required',
  },
};

const TERM_STATUS_LABELS: Record<
  string,
  Record<SupportedInventoryLocale, string>
> = {
  pending: {
    'pt-BR': 'Pendente',
    'en-US': 'Pending',
  },
  sent: {
    'pt-BR': 'Enviado',
    'en-US': 'Sent',
  },
  signed: {
    'pt-BR': 'Assinado',
    'en-US': 'Signed',
  },
  expired: {
    'pt-BR': 'Expirado',
    'en-US': 'Expired',
  },
  cancelled: {
    'pt-BR': 'Cancelado',
    'en-US': 'Cancelled',
  },
};

const REPORT_COLUMNS: ReportColumnConfig = {
  inventory_full: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'name', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'status', header: { 'pt-BR': 'Status', 'en-US': 'Status' } },
    { key: 'department_id', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'location_id', header: { 'pt-BR': 'Local', 'en-US': 'Location' } },
    { key: 'serial_number', header: { 'pt-BR': 'Nº de série', 'en-US': 'Serial number' } },
    { key: 'asset_number', header: { 'pt-BR': 'Patrimônio', 'en-US': 'Asset tag' } },
    { key: 'purchase_date', header: { 'pt-BR': 'Data de compra', 'en-US': 'Purchase date' } },
    { key: 'warranty_expiry', header: { 'pt-BR': 'Vencimento garantia', 'en-US': 'Warranty expiry' } },
    { key: 'purchase_value', header: { 'pt-BR': 'Valor de compra', 'en-US': 'Purchase value' } },
    { key: 'depreciation_value', header: { 'pt-BR': 'Depreciação acumulada', 'en-US': 'Accumulated depreciation' } },
  ],
  products_by_user: [
    { key: 'assignmentId', header: { 'pt-BR': 'Alocação', 'en-US': 'Assignment' } },
    { key: 'userName', header: { 'pt-BR': 'Usuário', 'en-US': 'User' } },
    { key: 'userEmail', header: { 'pt-BR': 'E-mail', 'en-US': 'Email' } },
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'serial', header: { 'pt-BR': 'Nº de série', 'en-US': 'Serial number' } },
    { key: 'assignedDate', header: { 'pt-BR': 'Data de entrega', 'en-US': 'Assigned date' } },
    { key: 'expectedReturn', header: { 'pt-BR': 'Previsto devolução', 'en-US': 'Expected return' } },
  ],
  products_by_department: [
    { key: 'department', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'status', header: { 'pt-BR': 'Status', 'en-US': 'Status' } },
    { key: 'location', header: { 'pt-BR': 'Local', 'en-US': 'Location' } },
  ],
  movements_history: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'movement_type', header: { 'pt-BR': 'Tipo de movimento', 'en-US': 'Movement type' } },
    { key: 'product_id', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'quantity', header: { 'pt-BR': 'Quantidade', 'en-US': 'Quantity' } },
    { key: 'from_location_id', header: { 'pt-BR': 'Origem', 'en-US': 'From location' } },
    { key: 'to_location_id', header: { 'pt-BR': 'Destino', 'en-US': 'To location' } },
    { key: 'movement_date', header: { 'pt-BR': 'Data do movimento', 'en-US': 'Movement date' } },
    { key: 'approval_status', header: { 'pt-BR': 'Status de aprovação', 'en-US': 'Approval status' } },
  ],
  maintenance: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'name', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'serial_number', header: { 'pt-BR': 'Nº de série', 'en-US': 'Serial number' } },
    { key: 'department_id', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'location_id', header: { 'pt-BR': 'Local', 'en-US': 'Location' } },
    { key: 'status', header: { 'pt-BR': 'Status', 'en-US': 'Status' } },
  ],
  write_off: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'name', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'serial_number', header: { 'pt-BR': 'Nº de série', 'en-US': 'Serial number' } },
    { key: 'department_id', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'location_id', header: { 'pt-BR': 'Local', 'en-US': 'Location' } },
    { key: 'status', header: { 'pt-BR': 'Status', 'en-US': 'Status' } },
  ],
  cost_by_department: [
    { key: 'department', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'totalValue', header: { 'pt-BR': 'Valor total', 'en-US': 'Total value' } },
  ],
  depreciation: [
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'purchaseValue', header: { 'pt-BR': 'Valor de compra', 'en-US': 'Purchase value' } },
    { key: 'depreciationValue', header: { 'pt-BR': 'Depreciação acumulada', 'en-US': 'Accumulated depreciation' } },
    { key: 'netValue', header: { 'pt-BR': 'Valor contábil', 'en-US': 'Net book value' } },
  ],
  tco: [
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'totalCost', header: { 'pt-BR': 'Custo total', 'en-US': 'Total cost' } },
    { key: 'department', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'status', header: { 'pt-BR': 'Status', 'en-US': 'Status' } },
  ],
  supplier_analysis: [
    { key: 'supplier', header: { 'pt-BR': 'Fornecedor', 'en-US': 'Supplier' } },
    { key: 'totalItems', header: { 'pt-BR': 'Total de itens', 'en-US': 'Total items' } },
    { key: 'totalValue', header: { 'pt-BR': 'Valor total', 'en-US': 'Total value' } },
  ],
  compliance_docs: [
    { key: 'assignmentId', header: { 'pt-BR': 'Alocação', 'en-US': 'Assignment' } },
    { key: 'userName', header: { 'pt-BR': 'Usuário', 'en-US': 'User' } },
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'termStatus', header: { 'pt-BR': 'Status do termo', 'en-US': 'Term status' } },
  ],
  licenses_expiring: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'name', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'warranty_expiry', header: { 'pt-BR': 'Vencimento garantia', 'en-US': 'Warranty expiry' } },
    { key: 'department_id', header: { 'pt-BR': 'Departamento', 'en-US': 'Department' } },
    { key: 'location_id', header: { 'pt-BR': 'Local', 'en-US': 'Location' } },
  ],
  terms_pending: [
    { key: 'assignmentId', header: { 'pt-BR': 'Alocação', 'en-US': 'Assignment' } },
    { key: 'userName', header: { 'pt-BR': 'Usuário', 'en-US': 'User' } },
    { key: 'productName', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'termStatus', header: { 'pt-BR': 'Status do termo', 'en-US': 'Term status' } },
  ],
  audit_movements: [
    { key: 'id', header: { 'pt-BR': 'ID', 'en-US': 'ID' } },
    { key: 'movement_type', header: { 'pt-BR': 'Tipo de movimento', 'en-US': 'Movement type' } },
    { key: 'product_id', header: { 'pt-BR': 'Produto', 'en-US': 'Product' } },
    { key: 'quantity', header: { 'pt-BR': 'Quantidade', 'en-US': 'Quantity' } },
    { key: 'from_location_id', header: { 'pt-BR': 'Origem', 'en-US': 'From location' } },
    { key: 'to_location_id', header: { 'pt-BR': 'Destino', 'en-US': 'To location' } },
    { key: 'movement_date', header: { 'pt-BR': 'Data do movimento', 'en-US': 'Movement date' } },
    { key: 'approval_status', header: { 'pt-BR': 'Status de aprovação', 'en-US': 'Approval status' } },
  ],
};

const SHEET_NAMES: Record<InventoryReportType, Record<SupportedInventoryLocale, string>> = {
  inventory_full: {
    'pt-BR': 'Inventário completo',
    'en-US': 'Full inventory',
  },
  products_by_user: {
    'pt-BR': 'Produtos por usuário',
    'en-US': 'Products by user',
  },
  products_by_department: {
    'pt-BR': 'Produtos por departamento',
    'en-US': 'Products by department',
  },
  movements_history: {
    'pt-BR': 'Movimentações',
    'en-US': 'Movements',
  },
  maintenance: {
    'pt-BR': 'Manutenção',
    'en-US': 'Maintenance',
  },
  write_off: {
    'pt-BR': 'Baixas',
    'en-US': 'Write-off',
  },
  cost_by_department: {
    'pt-BR': 'Custo por departamento',
    'en-US': 'Cost by department',
  },
  depreciation: {
    'pt-BR': 'Depreciação',
    'en-US': 'Depreciation',
  },
  tco: {
    'pt-BR': 'Custo total',
    'en-US': 'Total cost',
  },
  supplier_analysis: {
    'pt-BR': 'Fornecedores',
    'en-US': 'Suppliers',
  },
  compliance_docs: {
    'pt-BR': 'Termos de responsabilidade',
    'en-US': 'Responsibility terms',
  },
  licenses_expiring: {
    'pt-BR': 'Garantias vencendo',
    'en-US': 'Expiring warranties',
  },
  terms_pending: {
    'pt-BR': 'Termos pendentes',
    'en-US': 'Pending terms',
  },
  audit_movements: {
    'pt-BR': 'Auditoria de movimentos',
    'en-US': 'Movement audit',
  },
};

class InventoryReportService {
  async generateReport(request: ReportRequest) {
    const locale: SupportedInventoryLocale = request.locale || DEFAULT_LOCALE;
    const data = await this.fetchData(request);

    if ((request.format ?? 'json') === 'xlsx') {
      return this.toExcelBuffer(request.type, data, locale);
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

  private translateCellValue(
    columnKey: string,
    rawValue: unknown,
    locale: SupportedInventoryLocale,
  ) {
    if (rawValue == null) return rawValue;

    if (columnKey === 'status' && typeof rawValue === 'string') {
      const map = INVENTORY_STATUS_LABELS[rawValue];
      if (map) return map[locale] ?? map[DEFAULT_LOCALE];
      return rawValue;
    }

    if (columnKey === 'movement_type' && typeof rawValue === 'string') {
      const map = MOVEMENT_TYPE_LABELS[rawValue];
      if (map) return map[locale] ?? map[DEFAULT_LOCALE];
      return rawValue;
    }

    if (columnKey === 'approval_status' && typeof rawValue === 'string') {
      const map = APPROVAL_STATUS_LABELS[rawValue];
      if (map) return map[locale] ?? map[DEFAULT_LOCALE];
      return rawValue;
    }

    if (columnKey === 'termStatus' && typeof rawValue === 'string') {
      const map = TERM_STATUS_LABELS[rawValue];
      if (map) return map[locale] ?? map[DEFAULT_LOCALE];
      return rawValue;
    }

    return rawValue;
  }

  private buildLocalizedRows(type: InventoryReportType, data: any[], locale: SupportedInventoryLocale) {
    const columns = REPORT_COLUMNS[type];

    return data.map((row) => {
      const localizedRow: Record<string, any> = {};

      for (const column of columns) {
        const header = column.header[locale] ?? column.header[DEFAULT_LOCALE];
        const rawValue = (row as any)[column.key];
        localizedRow[header] = this.translateCellValue(column.key, rawValue, locale);
      }

      return localizedRow;
    });
  }

  private toExcelBuffer(reportName: InventoryReportType, data: any[], locale: SupportedInventoryLocale) {
    const normalizedLocale: SupportedInventoryLocale =
      locale === 'en-US' || locale === 'pt-BR' ? locale : DEFAULT_LOCALE;

    const rows = this.buildLocalizedRows(reportName, data, normalizedLocale);
    const worksheet = XLSX.utils.json_to_sheet(rows);

    const sheetName =
      SHEET_NAMES[reportName]?.[normalizedLocale] ?? SHEET_NAMES[reportName]?.[DEFAULT_LOCALE] ?? 'Relatório';

    const workbook = {
      SheetNames: [sheetName],
      Sheets: { [sheetName]: worksheet },
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
  return sql`NOW() + make_interval(days => ${days})`;
}

export const inventoryReportService = new InventoryReportService();
export default inventoryReportService;

