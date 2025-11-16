import { Request, Response } from 'express';
import { productCategoryService } from '../services/product-category-service';

function resolveCompanyId(req: Request): number | undefined {
  const userRole = req.session?.userRole;
  const sessionCompanyId = req.session?.companyId;
  
  if (userRole === 'admin' && req.query.company_id) {
    return parseInt(req.query.company_id as string, 10);
  }
  
  return sessionCompanyId;
}

export async function listProductCategories(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const includeInactive = req.query.include_inactive === 'true';
    const search = req.query.search as string | undefined;

    const categories = await productCategoryService.listCategories({
      companyId,
      userId,
      userRole,
      includeInactive,
      search,
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Erro ao listar categorias de produtos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao listar categorias', 
      error: String(error) 
    });
  }
}

export async function getProductCategory(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const categoryId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const category = await productCategoryService.getCategoryById(categoryId, companyId);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Categoria não encontrada' 
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar categoria', 
      error: String(error) 
    });
  }
}

export async function createProductCategory(req: Request, res: Response) {
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
    
    const category = await productCategoryService.createCategory({
      ...req.body,
      company_id: companyId ?? null,
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(400).json({ 
      success: false, 
      message: String(error) 
    });
  }
}

export async function updateProductCategory(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const categoryId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const category = await productCategoryService.updateCategory(
      categoryId,
      req.body,
      companyId
    );

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(400).json({ 
      success: false, 
      message: String(error) 
    });
  }
}

export async function deleteProductCategory(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const categoryId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    await productCategoryService.deleteCategory(categoryId, companyId);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao inativar categoria:', error);
    res.status(400).json({ 
      success: false, 
      message: String(error) 
    });
  }
}

