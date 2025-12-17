import { Request, Response } from 'express';
import { db } from '../db';
import { inventoryWebhooks } from '@shared/schema';
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

export async function listInventoryWebhooks(req: Request, res: Response) {
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

    const hooks = await db
      .select()
      .from(inventoryWebhooks)
      .where(eq(inventoryWebhooks.company_id, companyId));
    res.json({ success: true, data: hooks });
  } catch (error) {
    console.error('Erro ao listar webhooks de inventário:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createInventoryWebhook(req: Request, res: Response) {
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

    const payload = {
      ...req.body,
      company_id: companyId,
    };
    const [hook] = await db.insert(inventoryWebhooks).values(payload).returning();
    res.status(201).json({ success: true, data: hook });
  } catch (error) {
    console.error('Erro ao criar webhook:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deleteInventoryWebhook(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const webhookId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const deleted = await db
      .delete(inventoryWebhooks)
      .where(and(eq(inventoryWebhooks.id, webhookId), eq(inventoryWebhooks.company_id, companyId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover webhook:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

