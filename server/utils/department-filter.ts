/**
 * Helper para filtrar dados por departamento baseado no usuário autenticado
 * 
 * Regras:
 * - admin: Acesso a TUDO (todas empresas, todos departamentos)
 * - company_admin: Acesso a TUDO da empresa (todos departamentos da empresa)
 * - Outros roles: Apenas dados dos departamentos aos quais pertencem
 * - customer: SEM acesso ao inventário
 */

import { db } from '../db';
import { eq } from 'drizzle-orm';
import { officials, officialDepartments } from '@shared/schema';

export interface DepartmentFilterResult {
  // 'ALL' = admin/company_admin (sem filtro de departamento)
  // number[] = IDs dos departamentos do usuário
  // [] = sem acesso (customer ou sem departamento)
  type: 'ALL' | 'DEPARTMENTS' | 'NONE';
  departmentIds?: number[];
}

/**
 * Retorna os departamentos que o usuário pode acessar
 * Uso: passar userId e userRole da sessão (req.session.userId e req.session.userRole)
 */
export async function getDepartmentFilter(
  userId: number,
  userRole: string
): Promise<DepartmentFilterResult> {
  // Customers não têm acesso ao inventário
  if (userRole === 'customer') {
    return { type: 'NONE' };
  }

  // Admin e Company Admin têm acesso total
  if (userRole === 'admin' || userRole === 'company_admin') {
    return { type: 'ALL' };
  }

  // Buscar departamentos do official
  const [official] = await db
    .select({ id: officials.id })
    .from(officials)
    .where(eq(officials.user_id, userId))
    .limit(1);

  if (!official) {
    // Não é official = sem acesso
    return { type: 'NONE' };
  }

  // Buscar departamentos vinculados
  const userDepts = await db
    .select({ department_id: officialDepartments.department_id })
    .from(officialDepartments)
    .where(eq(officialDepartments.official_id, official.id));

  const departmentIds = userDepts
    .map(d => d.department_id)
    .filter((id): id is number => id !== null && id !== undefined);

  if (departmentIds.length === 0) {
    return { type: 'NONE' };
  }

  return { type: 'DEPARTMENTS', departmentIds };
}

