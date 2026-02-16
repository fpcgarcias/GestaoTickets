import { Request, Response } from 'express';
import responsibilityTermService from '../services/responsibility-term-service';
import digitalSignatureService from '../services/digital-signature-service';
import { db } from '../db';
import { inventoryResponsibilityTerms, userInventoryAssignments, inventoryTermTemplates, users, responsibilityTermAssignments, inventoryProducts } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

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

    // Buscar todos os termos
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

    // Identificar termos em lote
    const batchTermIds = terms
      .filter(t => t.term.is_batch_term)
      .map(t => t.term.id);

    // Buscar assignments relacionados para termos em lote
    const batchAssignmentsMap: Map<number, any[]> = new Map();
    if (batchTermIds.length > 0) {
      const termAssignments = await db
        .select({
          term_id: responsibilityTermAssignments.term_id,
          assignment_id: responsibilityTermAssignments.assignment_id,
          assignment: userInventoryAssignments,
          product: inventoryProducts,
          user: users,
        })
        .from(responsibilityTermAssignments)
        .innerJoin(userInventoryAssignments, eq(responsibilityTermAssignments.assignment_id, userInventoryAssignments.id))
        .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
        .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
        .where(inArray(responsibilityTermAssignments.term_id, batchTermIds));

      // Agrupar por term_id
      termAssignments.forEach(ta => {
        if (!batchAssignmentsMap.has(ta.term_id)) {
          batchAssignmentsMap.set(ta.term_id, []);
        }
        batchAssignmentsMap.get(ta.term_id)!.push({
          assignment: ta.assignment,
          product: ta.product,
          user: ta.user,
        });
      });
    }

    // Montar resposta com informações de lote
    const enrichedTerms = terms.map(t => {
      const baseData: any = {
        term: t.term,
        assignment: t.assignment,
        template: t.template,
        is_batch_term: t.term.is_batch_term,
      };

      if (t.term.is_batch_term) {
        const assignments = batchAssignmentsMap.get(t.term.id) || [];
        baseData.assignments = assignments;
        baseData.productsCount = assignments.length;
      } else {
        baseData.assignments = t.assignment ? [t.assignment] : [];
        baseData.productsCount = t.assignment ? 1 : 0;
      }

      return baseData;
    });

    res.json({ success: true, data: enrichedTerms });
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

    // Verificar se tem PDF assinado ANTES de tentar regenerar (mesmo em dev)
    const [term] = await db
      .select({ 
          signed_pdf_s3_key: inventoryResponsibilityTerms.signed_pdf_s3_key,
          status: inventoryResponsibilityTerms.status,
          id: inventoryResponsibilityTerms.id
      })
      .from(inventoryResponsibilityTerms)
      .where(eq(inventoryResponsibilityTerms.id, termId))
      .limit(1);

    console.log(`[downloadResponsibilityTerm] Term ID: ${termId}, Status: ${term?.status}, SignedKey: ${term?.signed_pdf_s3_key}`);

    // Se já tem PDF assinado, retornar ele DIRETAMENTE via URL assinada
    if (term?.signed_pdf_s3_key) {
      console.log(`[downloadResponsibilityTerm] Retornando PDF assinado: ${term.signed_pdf_s3_key}`);
      const url = await responsibilityTermService.getTermPdfUrl(termId, companyId);
      return res.redirect(url);
    }

    // Em desenvolvimento, se NÃO estiver assinado, regenerar o PDF rascunho
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      console.log(`[downloadResponsibilityTerm] Regenerating PDF for term ${termId} (Company: ${companyId})`);
      const pdfBuffer = await responsibilityTermService.regenerateTermPdf(termId, companyId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=termo-${termId}.pdf`);
      res.send(pdfBuffer);
      return;
    }

    // Em produção, retornar URL do S3
    const url = await responsibilityTermService.getTermPdfUrl(termId, companyId);
    res.redirect(url);
  } catch (error) {
    console.error(`[downloadResponsibilityTerm] Erro ao obter PDF do termo ${req.params.termId}:`, error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function getResponsibilityTermDetails(req: Request, res: Response) {
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

    // Buscar termo
    const [term] = await db
      .select({
        term: inventoryResponsibilityTerms,
        template: inventoryTermTemplates,
      })
      .from(inventoryResponsibilityTerms)
      .leftJoin(inventoryTermTemplates, eq(inventoryResponsibilityTerms.template_id, inventoryTermTemplates.id))
      .where(and(
        eq(inventoryResponsibilityTerms.id, termId),
        eq(inventoryResponsibilityTerms.company_id, companyId)
      ))
      .limit(1);

    if (!term) {
      return res.status(404).json({ success: false, message: 'Termo não encontrado' });
    }

    // Buscar assignments relacionados
    let assignments: any[] = [];
    if (term.term.is_batch_term) {
      // Termo em lote: buscar via responsibility_term_assignments
      const termAssignments = await db
        .select({
          assignment_id: responsibilityTermAssignments.assignment_id,
          assignment: userInventoryAssignments,
          product: inventoryProducts,
          user: users,
        })
        .from(responsibilityTermAssignments)
        .innerJoin(userInventoryAssignments, eq(responsibilityTermAssignments.assignment_id, userInventoryAssignments.id))
        .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
        .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
        .where(eq(responsibilityTermAssignments.term_id, termId));

      assignments = termAssignments.map(ta => ({
        id: ta.assignment.id,
        assignment: ta.assignment,
        product: ta.product,
        user: ta.user,
      }));
    } else if (term.term.assignment_id) {
      // Termo único: buscar assignment direto
      const [assignmentData] = await db
        .select({
          assignment: userInventoryAssignments,
          product: inventoryProducts,
          user: users,
        })
        .from(userInventoryAssignments)
        .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
        .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
        .where(eq(userInventoryAssignments.id, term.term.assignment_id))
        .limit(1);

      if (assignmentData) {
        assignments = [{
          id: assignmentData.assignment.id,
          assignment: assignmentData.assignment,
          product: assignmentData.product,
          user: assignmentData.user,
        }];
      }
    }

    res.json({
      success: true,
      data: {
        term: term.term,
        template: term.template,
        is_batch_term: term.term.is_batch_term,
        assignments,
        productsCount: assignments.length,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do termo:', error);
    res.status(500).json({ success: false, message: String(error) });
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

