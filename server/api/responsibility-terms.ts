import { Request, Response } from 'express';
import responsibilityTermService from '../services/responsibility-term-service';
import digitalSignatureService from '../services/digital-signature-service';
import { db } from '../db';
import { inventoryResponsibilityTerms, userInventoryAssignments, inventoryTermTemplates, users, responsibilityTermAssignments } from '@shared/schema';
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
    const templateId = req.body?.template_id ? parseInt(req.body.template_id, 10) : undefined;
    const userId = req.session?.userId ?? null;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    // Suportar tanto assignmentId (rota antiga) quanto assignmentGroupId/assignmentIds (batch)
    const assignmentId = req.params.assignmentId ? parseInt(req.params.assignmentId, 10) : undefined;
    const assignmentGroupId = req.body?.assignment_group_id as string | undefined;
    const assignmentIds = req.body?.assignment_ids as number[] | undefined;

    const result = await responsibilityTermService.generateTerm({
      assignmentId,
      assignmentIds,
      assignmentGroupId,
      companyId,
      templateId,
      createdById: userId,
    });

    res.status(201).json({ 
      success: true, 
      data: result
    });
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

export async function sendToClicksign(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const termId = parseInt(req.params.termId, 10);
    const { provider = 'clicksign' } = req.body;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    // Buscar termo e dados relacionados
    const [term] = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(and(
        eq(inventoryResponsibilityTerms.id, termId),
        eq(inventoryResponsibilityTerms.company_id, companyId)
      ))
      .limit(1);

    if (!term) {
      return res.status(404).json({ success: false, message: 'Termo não encontrado' });
    }

    // Buscar assignment(s) relacionado(s)
    let assignmentIds: number[] = [];
    if (term.assignment_id) {
      assignmentIds = [term.assignment_id];
    } else if (term.is_batch_term) {
      const termAssignments = await db
        .select({ assignment_id: responsibilityTermAssignments.assignment_id })
        .from(responsibilityTermAssignments)
        .where(eq(responsibilityTermAssignments.term_id, termId));
      assignmentIds = termAssignments.map(a => a.assignment_id);
    }

    if (assignmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum assignment encontrado para este termo' });
    }

    // Buscar dados do primeiro assignment (usuário que recebe o equipamento)
    const [firstAssignment] = await db
      .select({
        assignment: userInventoryAssignments,
        user: users,
      })
      .from(userInventoryAssignments)
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .where(eq(userInventoryAssignments.id, assignmentIds[0]))
      .limit(1);

    if (!firstAssignment?.user) {
      return res.status(400).json({ success: false, message: 'Usuário não encontrado' });
    }

    // Buscar responsável da entrega (assigned_by_id)
    let deliveryResponsibleName: string | undefined;
    let deliveryResponsibleEmail: string | undefined;
    if (firstAssignment.assignment.assigned_by_id) {
      const [responsible] = await db
        .select()
        .from(users)
        .where(eq(users.id, firstAssignment.assignment.assigned_by_id))
        .limit(1);
      
      if (responsible) {
        deliveryResponsibleName = responsible.name;
        deliveryResponsibleEmail = responsible.email;
      }
    }

    // Enviar para Clicksign
    const result = await digitalSignatureService.requestSignature({
      termId,
      signerName: firstAssignment.user.name,
      signerEmail: firstAssignment.user.email,
      provider: provider as any,
      companyId,
      deliveryResponsibleName,
      deliveryResponsibleEmail,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao enviar termo para Clicksign:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

