import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { tickets, departments, serviceProviders } from '@shared/schema';
import { storage } from '../storage';
import { authRequired, ticketAccessRequired } from '../middleware/authorization';
import { z } from 'zod';

const router = Router();

// Schema de validação para vincular prestador
const linkServiceProviderSchema = z.object({
  service_provider_id: z.number().int().positive(),
});

// GET /api/tickets/:id/service-providers - Listar prestadores do ticket
router.get('/:id/service-providers', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const ticketId = parseInt(req.params.id);
    
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'ID do ticket inválido' });
    }

    const providers = await storage.getTicketServiceProviders(ticketId);
    
    return res.json(providers);
  } catch (error) {
    console.error('Erro ao listar prestadores do ticket:', error);
    return res.status(500).json({ error: 'Erro ao listar prestadores do ticket' });
  }
});

// POST /api/tickets/:id/service-providers - Vincular prestador ao ticket
router.post('/:id/service-providers', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const ticketId = parseInt(req.params.id);
    
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'ID do ticket inválido' });
    }

    const userId = req.session?.userId as number;

    // Apenas atendentes, supervisores, managers, company_admin e admin podem vincular prestadores
    if (!['admin', 'company_admin', 'support', 'supervisor', 'manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas atendentes podem vincular prestadores de serviços' });
    }

    // Buscar ticket para verificar departamento
    const ticket = await storage.getTicket(ticketId, userRole, req.session?.companyId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (!ticket.department_id) {
      return res.status(400).json({ error: 'Ticket não possui departamento definido' });
    }

    // Verificar se o departamento usa prestadores
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, ticket.department_id))
      .limit(1);

    if (!department) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    if (!department.use_service_providers) {
      return res.status(400).json({ 
        error: 'Este departamento não utiliza prestadores de serviços' 
      });
    }

    const validatedData = linkServiceProviderSchema.parse(req.body);
    const providerId = validatedData.service_provider_id;

    // Verificar se o prestador existe e está vinculado ao departamento
    const provider = await storage.getServiceProvider(providerId);
    
    if (!provider) {
      return res.status(404).json({ error: 'Prestador de serviço não encontrado' });
    }

    if (!provider.is_active) {
      return res.status(400).json({ error: 'Prestador de serviço está inativo' });
    }

    // Verificar se o prestador está vinculado ao departamento do ticket
    const departmentProviders = await storage.getDepartmentServiceProviders(ticket.department_id);
    const isProviderLinked = departmentProviders.some(p => p.id === providerId);

    if (!isProviderLinked) {
      return res.status(400).json({ 
        error: 'Este prestador não está vinculado ao departamento do ticket' 
      });
    }

    await storage.addTicketServiceProvider(ticketId, providerId, userId);
    
    return res.status(201).json({ message: 'Prestador vinculado ao ticket com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao vincular prestador ao ticket:', error);
    return res.status(500).json({ error: 'Erro ao vincular prestador ao ticket' });
  }
});

// DELETE /api/tickets/:id/service-providers/:providerId - Desvincular prestador do ticket
router.delete('/:id/service-providers/:providerId', authRequired, ticketAccessRequired, async (req: Request, res: Response) => {
  try {
    const userRole = req.session?.userRole as string;
    
    // Bloquear customer
    if (userRole === 'customer') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const ticketId = parseInt(req.params.id);
    const providerId = parseInt(req.params.providerId);
    
    if (isNaN(ticketId) || isNaN(providerId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Apenas atendentes, supervisores, managers, company_admin e admin podem remover prestadores
    if (!['admin', 'company_admin', 'support', 'supervisor', 'manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Apenas atendentes podem remover prestadores de serviços' });
    }

    await storage.removeTicketServiceProvider(ticketId, providerId);
    
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao desvincular prestador do ticket:', error);
    return res.status(500).json({ error: 'Erro ao desvincular prestador do ticket' });
  }
});

export default router;



