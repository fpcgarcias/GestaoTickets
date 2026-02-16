import { Request, Response } from 'express';
import { db } from '../db';
import { departmentInventorySettings, departments } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function getDepartmentInventorySettings(req: Request, res: Response) {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    const companyId = req.session?.companyId;
    const userRole = req.session?.userRole;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Departamento inválido' });
    }

    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ success: false, message: 'Departamento não encontrado' });
    }

    if (userRole !== 'admin' && companyId && department.company_id !== companyId) {
      return res.status(403).json({ success: false, message: 'Sem permissão para este departamento' });
    }

    const [settings] = await db
      .select()
      .from(departmentInventorySettings)
      .where(eq(departmentInventorySettings.department_id, departmentId))
      .limit(1);

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Erro ao buscar configurações de inventário do departamento:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function updateDepartmentInventorySettings(req: Request, res: Response) {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    const companyId = req.session?.companyId;
    const userRole = req.session?.userRole;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Departamento inválido' });
    }

    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ success: false, message: 'Departamento não encontrado' });
    }

    if (userRole !== 'admin' && companyId && department.company_id !== companyId) {
      return res.status(403).json({ success: false, message: 'Sem permissão para este departamento' });
    }

    const payload = {
      ...req.body,
      department_id: departmentId,
      company_id: department.company_id,
    };

    const [existing] = await db
      .select()
      .from(departmentInventorySettings)
      .where(eq(departmentInventorySettings.department_id, departmentId))
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(departmentInventorySettings)
        .set(payload)
        .where(eq(departmentInventorySettings.department_id, departmentId))
        .returning();
    } else {
      [result] = await db
        .insert(departmentInventorySettings)
        .values(payload)
        .returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao atualizar configurações do departamento:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

