import { Request, Response } from 'express';
import { db } from '../db';
import { ticketInventoryItems, inventoryProducts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import inventoryMovementService, { MovementType } from '../services/inventory-movement-service';
import { storage } from '../storage';

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

export async function listTicketInventoryItems(req: Request, res: Response) {
  try {
    const _userRole = req.session?.userRole;
    const ticketId = parseInt(req.params.ticketId, 10);

    // Customers podem ver itens do próprio ticket (não bloqueia aqui)
    // A validação de acesso ao ticket já é feita em outro middleware

    const items = await db
      .select({
        item: ticketInventoryItems,
        product: inventoryProducts,
      })
      .from(ticketInventoryItems)
      .leftJoin(inventoryProducts, eq(ticketInventoryItems.product_id, inventoryProducts.id))
      .where(eq(ticketInventoryItems.ticket_id, ticketId))
      .orderBy(ticketInventoryItems.created_at);

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Erro ao listar ativos do ticket:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function addTicketInventoryItem(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    // Bloquear customers de adicionar itens manualmente (podem visualizar via ticket)
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Apenas atendentes podem gerenciar itens de inventário' 
      });
    }

    const { product_id, product_ids, action_type, quantity, notes, movement_type, to_location_id, responsible_id, assignment } = req.body;

    // Se tem product_ids, é movimentação em lote
    if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      return addTicketInventoryBatch(req, res);
    }

    // Movimentação única (compatibilidade)
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id é obrigatório para movimentação única' });
    }

    // Buscar ticket para pegar o user_id do customer (padrão para responsible_id)
    const ticket = await storage.getTicket(ticketId, userRole, companyId);
    const defaultResponsibleId = ticket?.customer?.user_id || null;
    
    // Se responsible_id não foi informado, usar o user_id do ticket
    const finalResponsibleId = responsible_id || defaultResponsibleId;

    let linkedMovementId: number | null = null;
    if (movement_type) {
      const movement = await inventoryMovementService.registerMovement({
        product_id,
        company_id: companyId,
        movement_type: movement_type as MovementType,
        quantity: quantity ?? 1,
        ticket_id: ticketId,
        created_by_id: userId,
        requireApproval: false,
        to_location_id: to_location_id || undefined,
        responsible_id: finalResponsibleId || undefined,
        is_stock_transfer: false, // Tickets não podem ter movimentação entre estoques
        assignment: assignment || undefined,
      });
      linkedMovementId = movement.id;
    }

    const [item] = await db.insert(ticketInventoryItems).values({
      ticket_id: ticketId,
      product_id,
      movement_id: linkedMovementId,
      action_type,
      quantity: quantity ?? 1,
      notes,
      created_by_id: userId,
    }).returning();

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Erro ao vincular ativo ao ticket:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

async function addTicketInventoryBatch(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Apenas atendentes podem gerenciar itens de inventário' 
      });
    }

    const { product_ids, action_type, quantity, notes, movement_type, to_location_id, responsible_id, assignment } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'product_ids é obrigatório e deve ser um array não vazio' });
    }

    // Buscar ticket para pegar o user_id do customer (padrão para responsible_id)
    const ticket = await storage.getTicket(ticketId, userRole, companyId);
    const defaultResponsibleId = ticket?.customer?.user_id || null;
    const finalResponsibleId = responsible_id || defaultResponsibleId;

    let linkedMovementId: number | null = null;
    if (movement_type) {
      const movement = await inventoryMovementService.registerMovement({
        product_ids,
        company_id: companyId,
        movement_type: movement_type as MovementType,
        quantity: quantity ?? 1,
        ticket_id: ticketId,
        created_by_id: userId,
        requireApproval: false,
        to_location_id: to_location_id || undefined,
        responsible_id: finalResponsibleId || undefined,
        is_stock_transfer: false,
        assignment: assignment || undefined,
        notes: notes || undefined,
      });
      linkedMovementId = movement.id;
    }

    // Criar itens de ticket para cada produto
    const ticketItems = product_ids.map(productId => ({
      ticket_id: ticketId,
      product_id: productId,
      movement_id: linkedMovementId,
      action_type,
      quantity: quantity ?? 1,
      notes,
      created_by_id: userId,
    }));

    const items = await db.insert(ticketInventoryItems).values(ticketItems).returning();

    res.status(201).json({ success: true, data: items });
  } catch (error) {
    console.error('Erro ao vincular ativos em lote ao ticket:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function removeTicketInventoryItem(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;
    const ticketId = parseInt(req.params.ticketId, 10);
    const itemId = parseInt(req.params.itemId, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Apenas atendentes podem gerenciar itens de inventário' 
      });
    }

    const deleted = await db
      .delete(ticketInventoryItems)
      .where(and(eq(ticketInventoryItems.id, itemId), eq(ticketInventoryItems.ticket_id, ticketId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover ativo do ticket:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

