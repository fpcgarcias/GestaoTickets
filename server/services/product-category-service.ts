import { and, desc, eq, ilike, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  productCategories,
  type ProductCategory,
  type InsertProductCategory,
} from '@shared/schema';
import { getDepartmentFilter } from '../utils/department-filter';

export interface ProductCategoryFilters {
  companyId?: number;
  userId?: number;
  userRole?: string;
  search?: string;
  includeInactive?: boolean;
}

class ProductCategoryService {
  async listCategories(filters: ProductCategoryFilters = {}): Promise<ProductCategory[]> {
    const conditions = [];

    // Filtrar por empresa
    if (filters.companyId) {
      conditions.push(eq(productCategories.company_id, filters.companyId));
    }

    // Filtrar por status ativo
    if (!filters.includeInactive) {
      conditions.push(eq(productCategories.is_active, true));
    }

    // Busca por nome ou código
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(productCategories.name, term),
          ilike(productCategories.code, term),
          ilike(productCategories.description, term)
        )
      );
    }

    // FILTRO POR DEPARTAMENTO
    if (filters.userId && filters.userRole) {
      const deptFilter = await getDepartmentFilter(filters.userId, filters.userRole);

      if (deptFilter.type === 'NONE') {
        // Sem acesso (customer ou sem departamento)
        return [];
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        // Usuários normais: apenas categorias dos seus departamentos OU categorias globais
        conditions.push(
          or(
            inArray(productCategories.department_id, deptFilter.departmentIds!),
            sql`${productCategories.department_id} IS NULL`
          )
        );
      }

      // Se deptFilter.type === 'ALL' (admin/company_admin), não adiciona filtro de departamento
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const categories = await db
      .select()
      .from(productCategories)
      .where(whereClause)
      .orderBy(productCategories.name);

    return categories;
  }

  async getCategoryById(id: number, companyId?: number): Promise<ProductCategory | null> {
    const conditions = [eq(productCategories.id, id)];

    if (companyId) {
      conditions.push(eq(productCategories.company_id, companyId));
    }

    const [category] = await db
      .select()
      .from(productCategories)
      .where(and(...conditions))
      .limit(1);

    return category ?? null;
  }

  async createCategory(input: InsertProductCategory): Promise<ProductCategory> {
    // Validar código único
    await this.ensureUniqueCode(input.code, input.company_id ?? null);

    const [category] = await db
      .insert(productCategories)
      .values({
        ...input,
        updated_at: new Date(),
      })
      .returning();

    return category;
  }

  async updateCategory(
    id: number,
    input: Partial<InsertProductCategory>,
    companyId?: number
  ): Promise<ProductCategory> {
    const existing = await this.getCategoryById(id, companyId);
    if (!existing) {
      throw new Error('Categoria não encontrada.');
    }

    // Se está alterando o código, validar unicidade
    if (input.code && input.code !== existing.code) {
      await this.ensureUniqueCode(input.code, existing.company_id, id);
    }

    const [updated] = await db
      .update(productCategories)
      .set({
        ...input,
        updated_at: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    return updated;
  }

  async deleteCategory(id: number, companyId?: number): Promise<void> {
    const category = await this.getCategoryById(id, companyId);
    if (!category) {
      throw new Error('Categoria não encontrada.');
    }

    // Soft delete - apenas inativar
    await db
      .update(productCategories)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(productCategories.id, id));
  }

  private async ensureUniqueCode(
    code: string,
    companyId: number | null,
    excludeId?: number
  ): Promise<void> {
    const conditions = [eq(productCategories.code, code)];

    if (companyId) {
      conditions.push(eq(productCategories.company_id, companyId));
    } else {
      conditions.push(sql`${productCategories.company_id} IS NULL`);
    }

    if (excludeId) {
      conditions.push(sql`${productCategories.id} != ${excludeId}`);
    }

    const existing = await db
      .select()
      .from(productCategories)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Já existe uma categoria com o código "${code}".`);
    }
  }
}

export const productCategoryService = new ProductCategoryService();
export default productCategoryService;

