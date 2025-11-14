import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  inventoryMovements,
  inventoryProducts,
  userInventoryAssignments,
  ticketInventoryItems,
  type InventoryMovement,
  type InventoryProduct,
  type InsertInventoryMovement,
  type InsertUserInventoryAssignment,
} from '@shared/schema';
import { inventoryProductService, type HydratedInventoryProduct } from './inventory-product-service';

export type MovementType =
  | 'entry'
  | 'withdrawal'
  | 'return'
  | 'write_off'
  | 'transfer'
  | 'maintenance'
  | 'reservation';

export interface MovementAssignmentOptions {
  expectedReturnDate?: string;
  notes?: string;
}

export interface RegisterMovementInput extends Omit<InsertInventoryMovement, 'notes' | 'approval_status'> {
  movement_type: MovementType;
  notes?: string | null;
  requireApproval?: boolean;
  assignment?: MovementAssignmentOptions;
  company_id: number;
}

export interface MovementFilters {
  companyId: number;
  productId?: number;
  movementType?: MovementType;
  approvalStatus?: string;
  ticketId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface HydratedMovement extends InventoryMovement {
  product?: HydratedInventoryProduct | null;
  userNotes?: string | null;
  assignment?: MovementAssignmentOptions;
}

interface MovementMetadata {
  structured: boolean;
  userNotes?: string | null;
  assignment?: MovementAssignmentOptions;
}

class InventoryMovementService {
  async listMovements(filters: MovementFilters) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(inventoryMovements.company_id, filters.companyId)];
    if (filters.productId) {
      conditions.push(eq(inventoryMovements.product_id, filters.productId));
    }
    if (filters.movementType) {
      conditions.push(eq(inventoryMovements.movement_type, filters.movementType));
    }
    if (filters.approvalStatus) {
      conditions.push(eq(inventoryMovements.approval_status, filters.approvalStatus));
    }
    if (filters.ticketId) {
      conditions.push(eq(inventoryMovements.ticket_id, filters.ticketId));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(inventoryMovements.reason, term),
          ilike(inventoryMovements.notes, term)
        )
      );
    }

    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(inventoryMovements)
      .where(whereClause)
      .orderBy(desc(inventoryMovements.movement_date))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovements)
      .where(whereClause);

    const hydrated = await Promise.all(
      data.map(async (movement) => this.hydrateMovement(movement))
    );

    const total = Number(count);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: hydrated,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async registerMovement(input: RegisterMovementInput): Promise<HydratedMovement> {
    const product = await this.ensureProduct(input.product_id, input.company_id);

    const approvalStatus = this.shouldRequireApproval(input)
      ? 'pending'
      : 'approved';

    const serializedNotes = this.serializeMetadata(input.notes ?? null, input.assignment);

    const payload: InsertInventoryMovement = {
      ...input,
      quantity: input.quantity ?? 1,
      movement_date: input.movement_date ?? new Date(),
      approval_status: approvalStatus,
      notes: serializedNotes,
    };

    const [movement] = await db
      .insert(inventoryMovements)
      .values(payload)
      .returning();

    if (approvalStatus === 'approved') {
      await this.applyMovementEffects(movement, product, input.assignment);
    }

    if (movement.ticket_id) {
      await this.linkMovementToTicket(movement);
    }

    return this.hydrateMovement(movement);
  }

  async approveMovement(id: number, companyId: number, approverId: number, notes?: string) {
    const movement = await this.getMovement(id, companyId);
    if (!movement) {
      throw new Error('Movimentação não encontrada.');
    }
    if (movement.approval_status !== 'pending') {
      throw new Error('Movimentação já avaliada.');
    }

    const metadata = this.parseMetadata(movement.notes);
    const product = await this.ensureProduct(movement.product_id, companyId);

    const [updated] = await db
      .update(inventoryMovements)
      .set({
        approval_status: 'approved',
        approved_by_id: approverId,
        approval_date: new Date(),
        approval_notes: notes ?? null,
      })
      .where(eq(inventoryMovements.id, id))
      .returning();

    await this.applyMovementEffects(updated, product, metadata.assignment);

    if (updated.ticket_id) {
      await this.linkMovementToTicket(updated);
    }

    return this.hydrateMovement(updated);
  }

  async rejectMovement(id: number, companyId: number, approverId: number, notes?: string) {
    const movement = await this.getMovement(id, companyId);
    if (!movement) {
      throw new Error('Movimentação não encontrada.');
    }
    if (movement.approval_status !== 'pending') {
      throw new Error('Movimentação já avaliada.');
    }

    const [updated] = await db
      .update(inventoryMovements)
      .set({
        approval_status: 'rejected',
        approved_by_id: approverId,
        approval_date: new Date(),
        approval_notes: notes ?? null,
      })
      .where(eq(inventoryMovements.id, id))
      .returning();

    return this.hydrateMovement(updated);
  }

  private async applyMovementEffects(
    movement: InventoryMovement,
    product: HydratedInventoryProduct,
    assignmentOptions?: MovementAssignmentOptions
  ) {
    switch (movement.movement_type as MovementType) {
      case 'entry':
        await this.updateProductState(product.id, {
          status: 'available',
          location_id: movement.to_location_id ?? product.location_id,
        }, movement.created_by_id);
        break;
      case 'withdrawal':
        await this.updateProductState(product.id, {
          status: 'in_use',
          location_id: movement.to_location_id ?? product.location_id,
        }, movement.created_by_id);
        if (movement.responsible_id) {
          await this.createAssignment(product, movement, assignmentOptions);
        }
        break;
      case 'return':
        await this.updateProductState(product.id, {
          status: 'available',
          location_id: movement.to_location_id ?? product.location_id,
        }, movement.created_by_id);
        await this.closeOpenAssignment(product.id, movement.responsible_id, movement.created_by_id);
        break;
      case 'transfer':
        await this.updateProductState(product.id, {
          status: product.status,
          location_id: movement.to_location_id ?? product.location_id,
        }, movement.created_by_id);
        break;
      case 'maintenance':
        await this.updateProductState(product.id, { status: 'maintenance' }, movement.created_by_id);
        break;
      case 'reservation':
        await this.updateProductState(product.id, { status: 'reserved' }, movement.created_by_id);
        break;
      case 'write_off':
        await this.updateProductState(product.id, { status: 'written_off' }, movement.created_by_id);
        break;
      default:
        break;
    }
  }

  private async createAssignment(
    product: HydratedInventoryProduct,
    movement: InventoryMovement,
    assignment?: MovementAssignmentOptions
  ) {
    const payload: InsertUserInventoryAssignment = {
      user_id: movement.responsible_id!,
      product_id: product.id,
      company_id: movement.company_id,
      assigned_by_id: movement.created_by_id ?? null,
      assigned_date: new Date(),
      expected_return_date: assignment?.expectedReturnDate
        ? new Date(assignment.expectedReturnDate)
        : undefined,
      notes: assignment?.notes ?? undefined,
    };

    await db.insert(userInventoryAssignments).values(payload);
  }

  private async closeOpenAssignment(productId: number, responsibleId?: number | null, userId?: number | null) {
    const conditions = [
      eq(userInventoryAssignments.product_id, productId),
      isNull(userInventoryAssignments.actual_return_date),
    ];
    if (responsibleId) {
      conditions.push(eq(userInventoryAssignments.user_id, responsibleId));
    }

    const assignment = await db
      .select()
      .from(userInventoryAssignments)
      .where(and(...conditions))
      .orderBy(desc(userInventoryAssignments.assigned_date))
      .limit(1);

    if (assignment.length === 0) {
      return;
    }

    await db
      .update(userInventoryAssignments)
      .set({
        actual_return_date: new Date(),
        returned_by_id: userId ?? null,
      })
      .where(eq(userInventoryAssignments.id, assignment[0].id));
  }

  private async updateProductState(
    productId: number,
    changes: Partial<InventoryProduct>,
    userId?: number | null
  ) {
    await db
      .update(inventoryProducts)
      .set({
        ...changes,
        updated_at: new Date(),
        updated_by_id: userId ?? null,
      })
      .where(eq(inventoryProducts.id, productId));
  }

  private async ensureProduct(productId: number, companyId: number): Promise<HydratedInventoryProduct> {
    const product = await inventoryProductService.getProductById(productId, companyId);
    if (!product) {
      throw new Error('Produto não encontrado para movimentação.');
    }
    return product;
  }

  private shouldRequireApproval(input: RegisterMovementInput): boolean {
    if (typeof input.requireApproval === 'boolean') {
      return input.requireApproval;
    }
    const sensitiveMovements: MovementType[] = ['withdrawal', 'transfer', 'write_off'];
    return sensitiveMovements.includes(input.movement_type);
  }

  private async getMovement(id: number, companyId: number) {
    const [movement] = await db
      .select()
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.id, id), eq(inventoryMovements.company_id, companyId)))
      .limit(1);
    return movement ?? null;
  }

  private async hydrateMovement(movement: InventoryMovement): Promise<HydratedMovement> {
    const metadata = this.parseMetadata(movement.notes);
    const product = await inventoryProductService.getProductById(movement.product_id, movement.company_id);

    return {
      ...movement,
      userNotes: metadata.userNotes ?? (metadata.structured ? null : movement.notes),
      assignment: metadata.assignment,
      product: product ?? null,
    };
  }

  private serializeMetadata(note: string | null, assignment?: MovementAssignmentOptions): string | null {
    if (!assignment) {
      return note;
    }
    const metadata: MovementMetadata = {
      structured: true,
      userNotes: note,
      assignment,
    };
    return JSON.stringify(metadata);
  }

  private parseMetadata(notes: string | null): MovementMetadata {
    if (!notes) {
      return { structured: false };
    }
    try {
      const parsed = JSON.parse(notes);
      if (parsed?.structured) {
        return {
          structured: true,
          userNotes: parsed.userNotes ?? null,
          assignment: parsed.assignment,
        };
      }
    } catch {
      // not JSON
    }
    return {
      structured: false,
      userNotes: notes,
    };
  }

  private mapMovementToTicketAction(type: MovementType): string {
    switch (type) {
      case 'withdrawal':
        return 'delivery';
      case 'return':
        return 'return';
      case 'transfer':
        return 'replacement';
      case 'reservation':
        return 'reservation';
      case 'write_off':
        return 'consumption';
      default:
        return 'delivery';
    }
  }

  private async linkMovementToTicket(movement: InventoryMovement) {
    if (!movement.ticket_id) return;

    // evitar duplicidade
    const existing = await db
      .select({ id: ticketInventoryItems.id })
      .from(ticketInventoryItems)
      .where(and(
        eq(ticketInventoryItems.ticket_id, movement.ticket_id),
        eq(ticketInventoryItems.product_id, movement.product_id),
        eq(ticketInventoryItems.movement_id, movement.id)
      ))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    const metadata = this.parseMetadata(movement.notes);

    await db.insert(ticketInventoryItems).values({
      ticket_id: movement.ticket_id,
      product_id: movement.product_id,
      movement_id: movement.id,
      action_type: this.mapMovementToTicketAction(movement.movement_type as MovementType),
      quantity: movement.quantity ?? 1,
      notes: metadata.userNotes ?? movement.reason ?? null,
      created_by_id: movement.created_by_id ?? movement.user_id ?? null,
      condition: null,
    });
  }
}

export const inventoryMovementService = new InventoryMovementService();
export default inventoryMovementService;
