import { Request, Response } from 'express';
import { db } from '../db';
import { inventoryLocations } from '@shared/schema';
import { and, eq, or, inArray, sql } from 'drizzle-orm';
import qrcodeService from '../services/qrcode-service';
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

export async function listLocations(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const conditions = [
      eq(inventoryLocations.company_id, companyId),
      eq(inventoryLocations.is_active, true)
    ];

    // Filtro por departamento
    if (userId && userRole) {
      const deptFilter = await getDepartmentFilter(userId, userRole);

      if (deptFilter.type === 'NONE') {
        return res.json({ success: true, data: [] });
      }

      if (deptFilter.type === 'DEPARTMENTS') {
        conditions.push(
          or(
            inArray(inventoryLocations.department_id, deptFilter.departmentIds!),
            sql`${inventoryLocations.department_id} IS NULL`
          )
        );
      }
    }

    const locations = await db
      .select()
      .from(inventoryLocations)
      .where(and(...conditions));

    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Erro ao listar localizações:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createLocation(req: Request, res: Response) {
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
    const [location] = await db.insert(inventoryLocations).values(payload).returning();
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    console.error('Erro ao criar localização:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function updateLocation(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const locationId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(inventoryLocations)
      .set(req.body)
      .where(and(eq(inventoryLocations.id, locationId), eq(inventoryLocations.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Localização não encontrada' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao atualizar localização:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deleteLocation(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const locationId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const [updated] = await db
      .update(inventoryLocations)
      .set({ is_active: false })
      .where(and(eq(inventoryLocations.id, locationId), eq(inventoryLocations.company_id, companyId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Localização não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover localização:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function generateLocationQrCode(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const locationId = parseInt(req.params.id, 10);
    const format = (req.query.format as 'png' | 'svg') || 'png';

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const qr = await qrcodeService.generateLocationCode(locationId, companyId, {
      format,
      store: req.query.store === 'true',
      userId: req.session?.userId,
    });

    res.json({
      success: true,
      mimeType: qr.mimeType,
      dataUrl: qr.dataUrl,
      storageKey: qr.storageKey,
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code de localização:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

