import { Request, Response } from 'express';
import responsibilityTermService from '../services/responsibility-term-service';
import { db } from '../db';
import { inventoryResponsibilityTerms, userInventoryAssignments, inventoryTermTemplates } from '@shared/schema';
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

export async function listResponsibilityTerms(req: Request, res: Response) {
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

    const terms = await db
      .select({
        term: inventoryResponsibilityTerms,
        assignment: userInventoryAssignments,
        template: inventoryTermTemplates,
      })
      .from(inventoryResponsibilityTerms)
      .leftJoin(userInventoryAssignments, eq(inventoryResponsibilityTerms.assignment_id, userInventoryAssignments.id))
      .leftJoin(inventoryTermTemplates, eq(inventoryResponsibilityTerms.template_id, inventoryTermTemplates.id))
      .where(eq(inventoryResponsibilityTerms.company_id, companyId));

    res.json({ success: true, data: terms });
  } catch (error) {
    console.error('Erro ao listar termos:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function generateResponsibilityTerm(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const assignmentId = parseInt(req.params.assignmentId, 10);
    const templateId = req.body?.template_id ? parseInt(req.body.template_id, 10) : undefined;
    const userId = req.session?.userId ?? null;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const term = await responsibilityTermService.generateTerm({
      assignmentId,
      companyId,
      templateId,
      createdById: userId,
    });

    res.status(201).json({ success: true, data: term });
  } catch (error) {
    console.error('Erro ao gerar termo de responsabilidade:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function sendResponsibilityTerm(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const termId = parseInt(req.params.termId, 10);
    const { recipient_email, recipient_name, message } = req.body;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    if (!recipient_email) {
      return res.status(400).json({ success: false, message: 'E-mail do destinatário é obrigatório' });
    }

    await responsibilityTermService.sendTerm({
      termId,
      companyId,
      recipientEmail: recipient_email,
      recipientName: recipient_name,
      message,
      requesterRole: req.session?.userRole,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar termo de responsabilidade:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function downloadResponsibilityTerm(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const termId = parseInt(req.params.termId, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const url = await responsibilityTermService.getTermPdfUrl(termId, companyId);
    res.json({ success: true, url });
  } catch (error) {
    console.error('Erro ao obter PDF do termo:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

