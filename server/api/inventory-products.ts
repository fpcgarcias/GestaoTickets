import { Request, Response } from 'express';
import { inventoryProductService } from '../services/inventory-product-service';
import nfeParserService from '../services/nfe-parser-service';

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
    const { status, department_id, location_id, product_type_id, search, page, limit } = req.query;

    const filters = {
      companyId,
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
    const productId = parseInt(req.params.id, 10);
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
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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
    const file = req.file;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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
    const file = req.file;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
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

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Erro ao importar NF-e:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function importProductsBatch(req: Request, res: Response) {
  try {
    // Placeholder para implementação futura
    res.json({
      success: true,
      message: 'Endpoint em construção. Utilize o importador de NF-e enquanto isso.',
    });
  } catch (error) {
    console.error('Erro no importador em lote:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

