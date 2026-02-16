import { randomUUID } from 'crypto';
import { and, desc, eq, ilike, ne, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  inventoryProducts,
  inventoryProductHistory,
  productTypes,
  productCategories,
  type InventoryProduct,
  type InsertInventoryProduct,
} from '@shared/schema';
import s3Service from './s3-service';
import { getDepartmentFilter } from '../utils/department-filter';

export interface ProductPhoto {
  id: string;
  filename: string;
  originalFilename: string;
  s3Key: string;
  mimeType: string;
  size: number;
  uploadedBy: number;
  uploadedAt: string;
}

export interface CreateProductInput extends Omit<InsertInventoryProduct, 'specifications' | 'photos'> {
  specifications?: Record<string, unknown>;
  photos?: ProductPhoto[];
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface ProductFilters {
  companyId: number;
  userId?: number;
  userRole?: string;
  status?: string;
  departmentId?: number;
  locationId?: number;
  productTypeId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  data: HydratedInventoryProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HydratedInventoryProduct extends InventoryProduct {
  specificationData: Record<string, unknown>;
  photoList: ProductPhoto[];
}

export interface ProductPhotoUpload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  companyId: number;
  userId: number;
  productId: number;
}

const normalizeDateValue = (value: unknown): Date | undefined => {
  console.log('[normalizeDateValue] Input:', value, 'Type:', typeof value);
  
  if (!value || value === '') {
    console.log('[normalizeDateValue] Valor vazio ou nulo, retornando undefined');
    return undefined;
  }
  
  if (value instanceof Date) {
    const result = Number.isNaN(value.getTime()) ? undefined : value;
    console.log('[normalizeDateValue] É Date:', result);
    return result;
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      console.log('[normalizeDateValue] String/Number convertido para Date:', parsed);
      return parsed;
    } else {
      console.log('[normalizeDateValue] Conversão falhou, retornando undefined');
    }
  }
  
  console.log('[normalizeDateValue] Tipo não suportado, retornando undefined');
  return undefined;
};

const normalizeMoneyValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Se vem no padrão brasileiro "1.234,56"
  if (trimmed.includes(',') && !trimmed.includes('.')) {
    const numeric = trimmed.replace(/\./g, '').replace(',', '.');
    return numeric;
  }

  // Se vem com ponto e vírgula misturados, tentar tratar vírgula como decimal
  if (trimmed.includes(',') && trimmed.includes('.')) {
    const onlyDigitsAndComma = trimmed.replace(/[^\d,]/g, '');
    if (onlyDigitsAndComma.includes(',')) {
      return onlyDigitsAndComma.replace(',', '.');
    }
  }

  // Caso já pareça estar em formato "internacional", remover separador de milhar
  const normalized = trimmed.replace(/,/g, '');
  return normalized;
};

class InventoryProductService {
  async listProducts(filters: ProductFilters): Promise<PaginatedProducts> {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(inventoryProducts.company_id, filters.companyId),
      eq(inventoryProducts.is_deleted, false),
    ];

    if (filters.status) {
      conditions.push(eq(inventoryProducts.status, filters.status));
    }
    if (filters.departmentId) {
      conditions.push(eq(inventoryProducts.department_id, filters.departmentId));
    }
    if (filters.locationId) {
      conditions.push(eq(inventoryProducts.location_id, filters.locationId));
    }
    if (filters.productTypeId) {
      conditions.push(eq(inventoryProducts.product_type_id, filters.productTypeId));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(inventoryProducts.name, term),
          ilike(inventoryProducts.serial_number, term),
          ilike(inventoryProducts.asset_number, term),
          ilike(inventoryProducts.service_tag, term)
        )
      );
    }

    // Filtro por departamento
    if (filters.userId && filters.userRole) {
      const deptFilter = await getDepartmentFilter(filters.userId, filters.userRole);

      if (deptFilter.type === 'NONE') {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        };
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

    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(inventoryProducts)
      .where(whereClause)
      .orderBy(desc(inventoryProducts.updated_at))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryProducts)
      .where(whereClause);

    const total = Number(count);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: data.map((record) => this.hydrateProduct(record)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getProductById(id: number, companyId: number): Promise<HydratedInventoryProduct | null> {
    const [product] = await db
      .select()
      .from(inventoryProducts)
      .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.company_id, companyId)))
      .limit(1);

    if (!product) {
      return null;
    }

    return this.hydrateProduct(product);
  }

  async createProduct(input: CreateProductInput, userId: number): Promise<HydratedInventoryProduct> {
    this.validateProductInput(input);
    await this.ensureUniqueIdentifiers(input);

    const payload = this.preparePayload(input, userId);

    console.log('====== SALVANDO NO BANCO (INSERT) ======');
    console.log('Payload completo para insert:', JSON.stringify(payload, null, 2));

    const [product] = await db
      .insert(inventoryProducts)
      .values(payload)
      .returning();

    console.log('====== PRODUTO RETORNADO DO BANCO ======');
    console.log('purchase_date do banco:', product.purchase_date, typeof product.purchase_date);
    console.log('warranty_expiry do banco:', product.warranty_expiry, typeof product.warranty_expiry);

    await this.logHistory(product.id, userId, 'created', null, product, 'Produto criado');

    return this.hydrateProduct(product);
  }

  async updateProduct(
    id: number,
    companyId: number,
    input: UpdateProductInput,
    userId: number
  ): Promise<HydratedInventoryProduct> {
    const existing = await this.getProductById(id, companyId);
    if (!existing) {
      throw new Error('Produto não encontrado.');
    }

    const merged: CreateProductInput = {
      ...existing,
      ...input,
      specifications: input.specifications ?? existing.specificationData,
      photos: input.photos ?? existing.photoList,
    };

    this.validateProductInput(merged, true);
    await this.ensureUniqueIdentifiers(merged, id);

    const payload = this.preparePayload(merged, userId, true);
    payload.updated_at = new Date();

    console.log('====== SALVANDO NO BANCO (UPDATE) ======');
    console.log('Product ID:', id);
    console.log('Payload completo para update:', JSON.stringify(payload, null, 2));

    const [updated] = await db
      .update(inventoryProducts)
      .set(payload)
      .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.company_id, companyId)))
      .returning();

    console.log('====== PRODUTO RETORNADO DO BANCO (UPDATE) ======');
    console.log('purchase_date do banco:', updated.purchase_date, typeof updated.purchase_date);
    console.log('warranty_expiry do banco:', updated.warranty_expiry, typeof updated.warranty_expiry);

    const changes = this.extractChanges(existing, updated);
    if (changes) {
      await this.logHistory(id, userId, 'updated', changes.oldValues, changes.newValues, changes.description);
    }

    return this.hydrateProduct(updated);
  }

  async softDeleteProduct(id: number, companyId: number, userId: number, reason?: string): Promise<void> {
    const product = await this.getProductById(id, companyId);
    if (!product) {
      throw new Error('Produto não encontrado.');
    }

    await db
      .update(inventoryProducts)
      .set({
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by_id: userId,
        status: 'written_off',
      })
      .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.company_id, companyId)));

    await this.logHistory(
      id,
      userId,
      'deleted',
      product,
      null,
      reason ? `Produto removido: ${reason}` : 'Produto removido'
    );
  }

  async uploadProductPhoto(params: ProductPhotoUpload): Promise<ProductPhoto[]> {
    const product = await this.getProductById(params.productId, params.companyId);
    if (!product) {
      throw new Error('Produto não encontrado.');
    }

    const uploadResult = await s3Service.uploadInventoryFile({
      buffer: params.buffer,
      originalName: params.originalName,
      companyId: params.companyId,
      folder: `products/${params.productId}/photos`,
      mimeType: params.mimeType,
      metadata: {
        productId: params.productId,
        uploadedBy: params.userId,
        kind: 'product-photo',
      },
    });

    const photo: ProductPhoto = {
      id: randomUUID(),
      filename: uploadResult.filename,
      originalFilename: uploadResult.originalFilename,
      s3Key: uploadResult.s3Key,
      mimeType: uploadResult.mimeType,
      size: uploadResult.fileSize,
      uploadedBy: params.userId,
      uploadedAt: new Date().toISOString(),
    };

    const updatedPhotos = [...product.photoList, photo];

    await db
      .update(inventoryProducts)
      .set({
        photos: JSON.stringify(updatedPhotos),
        updated_at: new Date(),
        updated_by_id: params.userId,
      })
      .where(and(eq(inventoryProducts.id, params.productId), eq(inventoryProducts.company_id, params.companyId)));

    await this.logHistory(
      params.productId,
      params.userId,
      'updated',
      { photos: product.photoList },
      { photos: updatedPhotos },
      'Nova foto adicionada ao produto'
    );

    return updatedPhotos;
  }

  private hydrateProduct(record: InventoryProduct): HydratedInventoryProduct {
    const specificationData = this.parseJson<Record<string, unknown>>(record.specifications, {});
    const photoList = this.parseJson<ProductPhoto[]>(record.photos, []);

    return {
      ...record,
      specificationData,
      photoList,
    };
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (!value || typeof value !== 'string') {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private validateProductInput(input: CreateProductInput, isUpdate = false): void {
    if (!isUpdate && !input.name) {
      throw new Error('Nome do produto é obrigatório.');
    }
    if (!isUpdate && !input.product_type_id) {
      throw new Error('Tipo de produto é obrigatório.');
    }
    if (!input.company_id) {
      throw new Error('company_id é obrigatório.');
    }
    if (input.specifications && typeof input.specifications !== 'object') {
      throw new Error('Especificações devem ser um objeto JSON.');
    }
    if (input.photos && !Array.isArray(input.photos)) {
      throw new Error('Fotos devem ser um array.');
    }
  }

  private async ensureUniqueIdentifiers(input: CreateProductInput, excludeId?: number): Promise<void> {
    // Se não possui nenhum identificador único, permitir (pode ser consumível)
    const identifierClauses = [];
    if (input.serial_number) {
      identifierClauses.push(eq(inventoryProducts.serial_number, input.serial_number));
    }
    if (input.service_tag) {
      identifierClauses.push(eq(inventoryProducts.service_tag, input.service_tag));
    }
    if (input.asset_number) {
      identifierClauses.push(eq(inventoryProducts.asset_number, input.asset_number));
    }

    // Se não há identificadores únicos, não precisa validar
    if (identifierClauses.length === 0) {
      return;
    }

    // Verificar se o produto é consumível via CATEGORIA do tipo
    const [typeAndCategory] = await db
      .select({
        category_id: productTypes.category_id,
        is_consumable: productCategories.is_consumable,
      })
      .from(productTypes)
      .leftJoin(productCategories, eq(productCategories.id, productTypes.category_id))
      .where(eq(productTypes.id, input.product_type_id))
      .limit(1);

    // Se é consumível, permitir múltiplos produtos mesmo com identificadores
    // (útil para lâmpadas, peças, etc que podem ter lotes)
    if (typeAndCategory?.is_consumable) {
      return;
    }

    // Para produtos não-consumíveis, garantir unicidade dos identificadores
    const conditions = [
      eq(inventoryProducts.company_id, input.company_id),
      eq(inventoryProducts.is_deleted, false), // Ignorar produtos deletados
    ];

    if (excludeId) {
      conditions.push(ne(inventoryProducts.id, excludeId));
    }

    const whereClause = and(...conditions, or(...identifierClauses));

    const existing = await db.select().from(inventoryProducts).where(whereClause).limit(1);
    if (existing.length > 0) {
      const existingProduct = existing[0];
      const duplicateField = 
        input.serial_number && existingProduct.serial_number === input.serial_number ? 'Número de Série' :
        input.service_tag && existingProduct.service_tag === input.service_tag ? 'Service Tag' :
        input.asset_number && existingProduct.asset_number === input.asset_number ? 'Número de Patrimônio' :
        'identificador';
      
      throw new Error(
        `Já existe um equipamento cadastrado com o mesmo ${duplicateField}. ` +
        `Equipamentos não-consumíveis devem ter identificadores únicos.`
      );
    }
  }

  private preparePayload(
    input: CreateProductInput,
    userId: number,
    isUpdate = false
  ): InsertInventoryProduct {
    console.log('====== PREPARE PAYLOAD - INPUT ======');
    console.log('purchase_date (input):', input.purchase_date, typeof input.purchase_date);
    console.log('warranty_expiry (input):', input.warranty_expiry, typeof input.warranty_expiry);
    console.log('invoice_date (input):', input.invoice_date, typeof input.invoice_date);

    const payload: any = {
      ...input,
      specifications: JSON.stringify(input.specifications || {}),
      photos: JSON.stringify(input.photos || []),
      created_by_id: isUpdate ? input.created_by_id || undefined : userId,
      updated_by_id: userId,
    };

    // Normalizar campos monetários (texto no banco, mas usado como numeric em relatórios)
    if (input.purchase_value !== undefined) {
      payload.purchase_value = normalizeMoneyValue(input.purchase_value) ?? null;
    }
    if (input.depreciation_value !== undefined) {
      payload.depreciation_value = normalizeMoneyValue(input.depreciation_value) ?? null;
    }

    // Converter datas para string ISO (drizzle mode: 'string' espera string ISO)
    if (input.purchase_date !== undefined) {
      const converted = normalizeDateValue(input.purchase_date);
      console.log('purchase_date CONVERTIDO:', converted, converted instanceof Date);
      payload.purchase_date = converted ? converted.toISOString() : null;
    }
    if (input.invoice_date !== undefined) {
      const converted = normalizeDateValue(input.invoice_date);
      console.log('invoice_date CONVERTIDO:', converted, converted instanceof Date);
      payload.invoice_date = converted ? converted.toISOString() : null;
    }
    if (input.warranty_expiry !== undefined) {
      const converted = normalizeDateValue(input.warranty_expiry);
      console.log('warranty_expiry CONVERTIDO:', converted, converted instanceof Date);
      payload.warranty_expiry = converted ? converted.toISOString() : null;
    }

    console.log('====== PAYLOAD FINAL ======');
    console.log('purchase_date:', payload.purchase_date);
    console.log('warranty_expiry:', payload.warranty_expiry);

    return payload;
  }

  private extractChanges(oldRecord: HydratedInventoryProduct, newRecord: InventoryProduct) {
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    let hasChanges = false;

    const fieldsToCompare: Array<keyof InventoryProduct> = [
      'name',
      'description',
      'brand',
      'model',
      'serial_number',
      'service_tag',
      'asset_number',
      'status',
      'location_id',
      'department_id',
      'purchase_value',
      'depreciation_value',
      'notes',
    ];

    for (const field of fieldsToCompare) {
      if (oldRecord[field] !== newRecord[field]) {
        oldValues[field as string] = oldRecord[field];
        newValues[field as string] = newRecord[field];
        hasChanges = true;
      }
    }

    if (oldRecord.specifications !== newRecord.specifications) {
      oldValues.specifications = oldRecord.specificationData;
      newValues.specifications = this.parseJson<Record<string, unknown>>(newRecord.specifications, {});
      hasChanges = true;
    }

    if (oldRecord.photos !== newRecord.photos) {
      oldValues.photos = oldRecord.photoList;
      newValues.photos = this.parseJson<ProductPhoto[]>(newRecord.photos, []);
      hasChanges = true;
    }

    if (!hasChanges) {
      return null;
    }

    return {
      oldValues,
      newValues,
      description: 'Produto atualizado',
    };
  }

  private async logHistory(
    productId: number,
    userId: number | null,
    changeType: string,
    oldValues: unknown,
    newValues: unknown,
    description?: string
  ): Promise<void> {
    await db.insert(inventoryProductHistory).values({
      product_id: productId,
      changed_by_id: userId,
      change_type: changeType,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      change_description: description ?? null,
    });
  }
}

export const inventoryProductService = new InventoryProductService();
export default inventoryProductService;

