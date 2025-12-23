import { Request, Response } from 'express';
import { db } from '../db';
import { userInventoryAssignments, inventoryProducts, users, inventoryResponsibilityTerms } from '@shared/schema';
import { and, eq, isNull, or, inArray, sql, getTableColumns, desc, ilike } from 'drizzle-orm';
import { getDepartmentFilter } from '../utils/department-filter';

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

export async function listAssignments(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    const onlyOpen = req.query.open === 'true';
    const search = req.query.search as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 20;
    const offset = (page - 1) * limit;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [eq(userInventoryAssignments.company_id, companyId)];

    if (onlyOpen) {
      conditions.push(isNull(userInventoryAssignments.actual_return_date));
    }

    // Filtro de status
    // Frontend espera: "pending", "active", "completed"
    if (statusFilter && statusFilter.trim()) {
      if (statusFilter === 'completed') {
        // completed = tem actual_return_date
        conditions.push(sql`${userInventoryAssignments.actual_return_date} IS NOT NULL`);
      } else if (statusFilter === 'active') {
        // active = não tem actual_return_date E signature_status === 'signed'
        conditions.push(
          and(
            isNull(userInventoryAssignments.actual_return_date),
            eq(userInventoryAssignments.signature_status, 'signed')
          )
        );
      } else if (statusFilter === 'pending') {
        // pending = não tem actual_return_date E signature_status != 'signed'
        conditions.push(
          and(
            isNull(userInventoryAssignments.actual_return_date),
            sql`${userInventoryAssignments.signature_status} IS DISTINCT FROM 'signed'`
          )
        );
      }
    }

    // Filtro de busca
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(inventoryProducts.service_tag, searchTerm),
          ilike(inventoryProducts.asset_number, searchTerm),
          ilike(inventoryProducts.serial_number, searchTerm),
          ilike(inventoryProducts.name, searchTerm),
          ilike(users.name, searchTerm)
        )
      );
    }

    // Filtro por departamento (via produtos)
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ 
          success: true, 
          data: [], 
          pagination: { 
            page, 
            limit, 
            total: 0, 
            totalPages: 0, 
            hasNext: false, 
            hasPrev: false 
          } 
        });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        const allowedProducts = await db
          .select({ id: inventoryProducts.id })
          .from(inventoryProducts)
          .where(
            and(
              eq(inventoryProducts.company_id, companyId),
              or(
                inArray(inventoryProducts.department_id, deptFilter.departmentIds!),
                sql`${inventoryProducts.department_id} IS NULL`
              )
            )
          );

        const productIds = allowedProducts.map(p => p.id);

        if (productIds.length === 0) {
          return res.json({ 
            success: true, 
            data: [], 
            pagination: { 
              page, 
              limit, 
              total: 0, 
              totalPages: 0, 
              hasNext: false, 
              hasPrev: false 
            } 
          });
        }

        conditions.push(inArray(userInventoryAssignments.product_id, productIds));
      }
    }

    // Buscar total de registros (antes da paginação)
    const totalRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(userInventoryAssignments)
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryResponsibilityTerms, eq(userInventoryAssignments.responsibility_term_id, inventoryResponsibilityTerms.id))
      .where(and(...conditions));

    const total = Number(totalRows[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Buscar dados paginados
    const rows = await db
      .select({
        ...getTableColumns(userInventoryAssignments),
        product_id: inventoryProducts.id,
        product_name: inventoryProducts.name,
        product_service_tag: inventoryProducts.service_tag,
        product_asset_number: inventoryProducts.asset_number,
        product_serial_number: inventoryProducts.serial_number,
        user_name: users.name,
        term_signature_method: inventoryResponsibilityTerms.signature_method,
        term_status: inventoryResponsibilityTerms.status,
      })
      .from(userInventoryAssignments)
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryResponsibilityTerms, eq(userInventoryAssignments.responsibility_term_id, inventoryResponsibilityTerms.id))
      .where(and(...conditions))
      .orderBy(desc(userInventoryAssignments.assigned_date))
      .limit(limit)
      .offset(offset);

    // Formatar resposta para o frontend
    const assignments = rows.map(row => {
      // Calcular status baseado em actual_return_date e signature_status
      // Frontend espera: "pending", "active", "completed"
      let status: 'pending' | 'active' | 'completed' = 'pending';
      if (row.actual_return_date) {
        status = 'completed';
      } else if (row.signature_status === 'signed') {
        status = 'active';
      } else {
        status = 'pending';
      }

      // Calcular term_status baseado no termo real
      let term_status = null;
      if (row.responsibility_term_id) {
        // Se tem signature_method, significa que foi enviado para assinatura digital
        if (row.term_signature_method) {
          if (row.term_status === 'signed') {
            term_status = 'signed';
          } else {
            term_status = 'sent'; // Enviado mas ainda não assinado
          }
        } else {
          // Se não tem signature_method, apenas foi gerado
          term_status = 'generated';
        }
      }

      return {
        ...row,
        product: row.product_id ? {
          id: row.product_id,
          name: row.product_name,
        } : null,
        user_name: row.user_name ?? null,
        status,
        term_status,
        term_id: row.responsibility_term_id,
        assignment_group_id: row.assignment_group_id ?? null,
      };
    });

    res.json({ 
      success: true, 
      data: assignments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });
  } catch (error) {
    console.error('Erro ao listar alocações:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createAssignment(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

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
      assigned_by_id: userId,
    };

    const [assignment] = await db.insert(userInventoryAssignments).values(payload).returning();
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Erro ao criar alocação:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function registerAssignmentReturn(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const assignmentId = parseInt(req.params.id, 10);
    const userId = req.session?.userId ?? null;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(userInventoryAssignments)
      .set({
        actual_return_date: new Date(),
        condition_on_return: req.body?.condition,
        returned_by_id: userId,
      })
      .where(and(
        eq(userInventoryAssignments.id, assignmentId),
        eq(userInventoryAssignments.company_id, companyId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Alocação não encontrada' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao registrar devolução:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

