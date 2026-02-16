import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authRequired } from '../middleware/authorization';
import { z } from 'zod';

const router = Router();

// Schema de validação para criar prestador
const createServiceProviderSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  is_external: z.boolean(),
  company_id: z.number().int().positive().nullable().optional(),
  company_name: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal(''), z.null(), z.undefined()]).optional().transform(val => val === '' ? null : val),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

// Schema de validação para atualizar prestador
const updateServiceProviderSchema = z.object({
  name: z.string().min(1).optional(),
  is_external: z.boolean().optional(),
  company_id: z.number().int().positive().nullable().optional(),
  company_name: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal(''), z.null(), z.undefined()]).optional().transform(val => val === '' ? null : val),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/service-providers - Listar prestadores
router.get('/', authRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    const userCompanyId = req.session?.companyId as number | undefined;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Parâmetros de filtro
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const isExternal = req.query.is_external !== undefined ? req.query.is_external === 'true' : undefined;
    const departmentId = req.query.department_id ? parseInt(req.query.department_id as string) : undefined;

    // Company admin e admin têm acesso total
    // Outros roles filtram por empresa
    const filters: any = {};
    
    if (userRole !== 'admin') {
      filters.companyId = userCompanyId;
    } else if (req.query.company_id) {
      filters.companyId = parseInt(req.query.company_id as string);
    }
    
    if (isActive !== undefined) {
      filters.isActive = isActive;
    }
    
    if (isExternal !== undefined) {
      filters.isExternal = isExternal;
    }
    
    if (departmentId) {
      filters.departmentId = departmentId;
    }

    const providers = await storage.getServiceProviders(filters);
    
    return res.json(providers);
  } catch (error) {
    console.error('Erro ao listar prestadores:', error);
    return res.status(500).json({ error: 'Erro ao listar prestadores de serviços' });
  }
});

// GET /api/service-providers/:id - Buscar prestador específico
router.get('/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const userCompanyId = req.session?.companyId as number | undefined;

    const provider = await storage.getServiceProvider(id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Prestador de serviço não encontrado' });
    }

    // Verificar acesso: company admin e admin têm acesso total
    if (userRole !== 'admin' && provider.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    return res.json(provider);
  } catch (error) {
    console.error('Erro ao buscar prestador:', error);
    return res.status(500).json({ error: 'Erro ao buscar prestador de serviço' });
  }
});

// POST /api/service-providers - Criar prestador
router.post('/', authRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const userCompanyId = req.session?.companyId as number | undefined;

    const validatedData = createServiceProviderSchema.parse(req.body);

    // Se não for admin, forçar company_id do usuário
    if (userRole !== 'admin') {
      validatedData.company_id = userCompanyId || null;
    }

    // Se não forneceu company_id e não é admin, usar a do usuário
    if (!validatedData.company_id && userRole !== 'admin') {
      validatedData.company_id = userCompanyId || null;
    }

    const provider = await storage.createServiceProvider(validatedData);
    
    return res.status(201).json(provider);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar prestador:', error);
    return res.status(500).json({ error: 'Erro ao criar prestador de serviço' });
  }
});

// PATCH /api/service-providers/:id - Atualizar prestador
router.patch('/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const userCompanyId = req.session?.companyId as number | undefined;

    // Verificar se o prestador existe e tem acesso
    const existingProvider = await storage.getServiceProvider(id);
    
    if (!existingProvider) {
      return res.status(404).json({ error: 'Prestador de serviço não encontrado' });
    }

    // Verificar acesso
    if (userRole !== 'admin' && existingProvider.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const validatedData = updateServiceProviderSchema.parse(req.body);

    // Se não for admin, não permitir alterar company_id
    if (userRole !== 'admin' && validatedData.company_id !== undefined) {
      delete validatedData.company_id;
    }

    const provider = await storage.updateServiceProvider(id, validatedData);
    
    return res.json(provider);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar prestador:', error);
    return res.status(500).json({ error: 'Erro ao atualizar prestador de serviço' });
  }
});

// DELETE /api/service-providers/:id - Desativar prestador (soft delete)
router.delete('/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const userCompanyId = req.session?.companyId as number | undefined;

    // Verificar se o prestador existe e tem acesso
    const existingProvider = await storage.getServiceProvider(id);
    
    if (!existingProvider) {
      return res.status(404).json({ error: 'Prestador de serviço não encontrado' });
    }

    // Verificar acesso
    if (userRole !== 'admin' && existingProvider.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await storage.deleteServiceProvider(id);
    
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao desativar prestador:', error);
    return res.status(500).json({ error: 'Erro ao desativar prestador de serviço' });
  }
});

export default router;

