import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { departments, serviceProviders } from '@shared/schema';
import { storage } from '../storage';
import { authRequired } from '../middleware/authorization';
import { z } from 'zod';

const router = Router();

// Schema de validação para vincular prestador
const linkServiceProviderSchema = z.object({
  service_provider_id: z.number().int().positive(),
});

// GET /api/departments/:id/service-providers - Listar prestadores do departamento
router.get('/:id/service-providers', authRequired, async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.id);
    
    if (isNaN(departmentId)) {
      return res.status(400).json({ error: 'ID do departamento inválido' });
    }

    const userRole = req.session?.userRole as string;
    const userCompanyId = req.session?.companyId as number | undefined;

    // Verificar se o departamento existe e tem acesso
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Verificar acesso
    if (userRole !== 'admin' && department.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const providers = await storage.getDepartmentServiceProviders(departmentId);
    
    return res.json(providers);
  } catch (error) {
    console.error('Erro ao listar prestadores do departamento:', error);
    return res.status(500).json({ error: 'Erro ao listar prestadores do departamento' });
  }
});

// POST /api/departments/:id/service-providers - Vincular prestador ao departamento
router.post('/:id/service-providers', authRequired, async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.id);
    
    if (isNaN(departmentId)) {
      return res.status(400).json({ error: 'ID do departamento inválido' });
    }

    const userRole = req.session?.userRole as string;
    const userCompanyId = req.session?.companyId as number | undefined;

    // Verificar se o departamento existe e tem acesso
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Verificar acesso
    if (userRole !== 'admin' && department.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o departamento tem use_service_providers habilitado
    if (!department.use_service_providers) {
      return res.status(400).json({ 
        error: 'Este departamento não utiliza prestadores de serviços. Habilite a opção no cadastro do departamento.' 
      });
    }

    const validatedData = linkServiceProviderSchema.parse(req.body);
    const providerId = validatedData.service_provider_id;

    // Verificar se o prestador existe e tem acesso
    const provider = await storage.getServiceProvider(providerId);
    
    if (!provider) {
      return res.status(404).json({ error: 'Prestador de serviço não encontrado' });
    }

    // Verificar acesso ao prestador
    if (userRole !== 'admin' && provider.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado ao prestador' });
    }

    // Verificar se são da mesma empresa
    if (department.company_id && provider.company_id && department.company_id !== provider.company_id) {
      return res.status(400).json({ 
        error: 'Departamento e prestador devem ser da mesma empresa' 
      });
    }

    await storage.addDepartmentServiceProvider(departmentId, providerId);
    
    return res.status(201).json({ message: 'Prestador vinculado ao departamento com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao vincular prestador ao departamento:', error);
    return res.status(500).json({ error: 'Erro ao vincular prestador ao departamento' });
  }
});

// DELETE /api/departments/:id/service-providers/:providerId - Desvincular prestador
router.delete('/:id/service-providers/:providerId', authRequired, async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.id);
    const providerId = parseInt(req.params.providerId);
    
    if (isNaN(departmentId) || isNaN(providerId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const userRole = req.session?.userRole as string;
    const userCompanyId = req.session?.companyId as number | undefined;

    // Verificar se o departamento existe e tem acesso
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Verificar acesso
    if (userRole !== 'admin' && department.company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await storage.removeDepartmentServiceProvider(departmentId, providerId);
    
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao desvincular prestador do departamento:', error);
    return res.status(500).json({ error: 'Erro ao desvincular prestador do departamento' });
  }
});

export default router;

