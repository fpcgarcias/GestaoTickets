import { Request, Response } from 'express';
import { inventoryProductService } from '../services/inventory-product-service';
import nfeParserService from '../services/nfe-parser-service';
import { db } from '../db';
import { inventorySuppliers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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

export async function listInventoryProducts(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const { status, department_id, location_id, product_type_id, search, page, limit } = req.query;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const filters = {
      companyId,
      userId,
      userRole,
      status: status as string | undefined,
      departmentId: department_id ? parseInt(department_id as string, 10) : undefined,
      locationId: location_id ? parseInt(location_id as string, 10) : undefined,
      productTypeId: product_type_id ? parseInt(product_type_id as string, 10) : undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    const result = await inventoryProductService.listProducts(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro ao listar produtos de inventário:', error);
    res.status(500).json({ success: false, message: 'Erro ao listar produtos', error: String(error) });
  }
}

export async function getInventoryProduct(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const productId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const product = await inventoryProductService.getProductById(productId, companyId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produto', error: String(error) });
  }
}

export async function createInventoryProduct(req: Request, res: Response) {
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

    console.log('====== CREATE PRODUCT - PAYLOAD RECEBIDO ======');
    console.log('purchase_date:', req.body.purchase_date);
    console.log('warranty_expiry:', req.body.warranty_expiry);
    console.log('invoice_date:', req.body.invoice_date);
    console.log('Body completo:', JSON.stringify(req.body, null, 2));

    const product = await inventoryProductService.createProduct(
      {
        ...req.body,
        company_id: companyId,
      },
      userId
    );

    console.log('====== PRODUTO CRIADO ======');
    console.log('purchase_date salvo:', product.purchase_date);
    console.log('warranty_expiry salvo:', product.warranty_expiry);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function updateInventoryProduct(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const productId = parseInt(req.params.id, 10);
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

    console.log('====== UPDATE PRODUCT - PAYLOAD RECEBIDO ======');
    console.log('Product ID:', productId);
    console.log('purchase_date:', req.body.purchase_date);
    console.log('warranty_expiry:', req.body.warranty_expiry);
    console.log('invoice_date:', req.body.invoice_date);
    console.log('Body completo:', JSON.stringify(req.body, null, 2));

    const product = await inventoryProductService.updateProduct(productId, companyId, req.body, userId);
    
    console.log('====== PRODUTO ATUALIZADO ======');
    console.log('purchase_date salvo:', product.purchase_date);
    console.log('warranty_expiry salvo:', product.warranty_expiry);

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deleteInventoryProduct(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const productId = parseInt(req.params.id, 10);
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

    await inventoryProductService.softDeleteProduct(productId, companyId, userId, req.body?.reason);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function uploadInventoryProductPhoto(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const productId = parseInt(req.params.id, 10);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const file = req.file;

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

    if (!file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }

    const photos = await inventoryProductService.uploadProductPhoto({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      companyId,
      userId,
      productId,
    });

    res.json({ success: true, photos });
  } catch (error) {
    console.error('Erro ao enviar foto do produto:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function importProductsFromNFe(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const file = req.file;

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

    if (!file) {
      return res.status(400).json({ success: false, message: 'Arquivo XML não enviado' });
    }

    const parsed = nfeParserService.parseXml(file.buffer);
    await nfeParserService.storeOriginalXml({
      xml: file.buffer,
      companyId,
      userId,
      invoiceNumber: parsed.invoiceNumber ?? undefined,
      supplierCnpj: parsed.supplier?.cnpj ?? undefined,
    });

    // Verificar/cadastrar fornecedor automaticamente
    let supplierId: number | undefined = undefined;
    if (parsed.supplier?.cnpj) {
      const normalizedCnpj = parsed.supplier.cnpj.replace(/\D/g, '');
      
      // Buscar fornecedor existente pelo CNPJ
      const existingSuppliers = await db
        .select()
        .from(inventorySuppliers)
        .where(
          and(
            eq(inventorySuppliers.company_id, companyId),
            eq(inventorySuppliers.cnpj, normalizedCnpj)
          )
        )
        .limit(1);

      if (existingSuppliers.length > 0) {
        supplierId = existingSuppliers[0].id;
      } else {
        // Criar fornecedor automaticamente
        const supplierAddress = parsed.supplier.address;
        const addressParts: string[] = [];
        if (supplierAddress?.street) addressParts.push(supplierAddress.street);
        if (supplierAddress?.number) addressParts.push(supplierAddress.number);
        if (supplierAddress?.complement) addressParts.push(supplierAddress.complement);
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

        const [newSupplier] = await db
          .insert(inventorySuppliers)
          .values({
            name: parsed.supplier.name || 'Fornecedor sem nome',
            cnpj: normalizedCnpj,
            contact_name: parsed.supplier.tradeName || undefined,
            phone: parsed.supplier.phone || undefined,
            email: parsed.supplier.email || undefined,
            address: fullAddress,
            city: supplierAddress?.city || undefined,
            state: supplierAddress?.state || parsed.supplier.state || undefined,
            company_id: companyId,
            is_active: true,
          })
          .returning();

        supplierId = newSupplier.id;
      }
    }

    // Retornar dados parseados com o ID do fornecedor
    res.json({ 
      success: true, 
      data: {
        ...parsed,
        supplierId,
      }
    });
  } catch (error) {
    console.error('Erro ao importar NF-e:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function importProductsBatch(req: Request, res: Response) {
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

    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lista de produtos é obrigatória e deve conter pelo menos um produto' 
      });
    }

    const results = {
      success: [] as any[],
      errors: [] as Array<{ index: number; product: any; error: string }>,
    };

    // Criar produtos em lote
    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      
      try {
        // Validar dados básicos
        if (!productData.name) {
          throw new Error('Nome do produto é obrigatório');
        }
        if (!productData.product_type_id) {
          throw new Error('Tipo de produto é obrigatório');
        }
        if (!productData.supplier_id) {
          throw new Error('Fornecedor é obrigatório');
        }

        const product = await inventoryProductService.createProduct(
          {
            ...productData,
            company_id: companyId,
          },
          userId
        );

        results.success.push({
          index: i,
          id: product.id,
          name: product.name,
        });
      } catch (error) {
        results.errors.push({
          index: i,
          product: productData,
          error: String(error),
        });
      }
    }

    // Se todos falharam, retornar erro
    if (results.success.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum produto foi importado com sucesso',
        results,
      });
    }

    // Retornar resultado parcial se houver sucessos e falhas
    if (results.errors.length > 0) {
      return res.status(207).json({
        success: true,
        message: `${results.success.length} produto(s) importado(s) com sucesso, ${results.errors.length} falha(s)`,
        results,
      });
    }

    // Todos foram importados com sucesso
    res.json({
      success: true,
      message: `${results.success.length} produto(s) importado(s) com sucesso`,
      results,
    });
  } catch (error) {
    console.error('Erro no importador em lote:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

