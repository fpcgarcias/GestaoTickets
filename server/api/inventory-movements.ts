import { Request, Response } from 'express';
import inventoryMovementService from '../services/inventory-movement-service';

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

export async function listInventoryMovements(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const result = await inventoryMovementService.listMovements({
      companyId,
      productId: req.query.product_id ? parseInt(req.query.product_id as string, 10) : undefined,
      movementType: req.query.movement_type as any,
      approvalStatus: req.query.approval_status as string,
      ticketId: req.query.ticket_id ? parseInt(req.query.ticket_id as string, 10) : undefined,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createInventoryMovement(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const movement = await inventoryMovementService.registerMovement({
      ...req.body,
      company_id: companyId,
      created_by_id: userId,
    });

    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    console.error('Erro ao criar movimentação:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function approveInventoryMovement(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const movementId = parseInt(req.params.id, 10);
    const movement = await inventoryMovementService.approveMovement(movementId, companyId, userId, req.body?.notes);
    res.json({ success: true, data: movement });
  } catch (error) {
    console.error('Erro ao aprovar movimentação:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function rejectInventoryMovement(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const movementId = parseInt(req.params.id, 10);
    const movement = await inventoryMovementService.rejectMovement(movementId, companyId, userId, req.body?.notes);
    res.json({ success: true, data: movement });
  } catch (error) {
    console.error('Erro ao rejeitar movimentação:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

