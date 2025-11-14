import { Request, Response } from 'express';
import { db } from '../db';
import { inventoryLocations } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import qrcodeService from '../services/qrcode-service';

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
    const locations = await db
      .select()
      .from(inventoryLocations)
      .where(and(eq(inventoryLocations.company_id, companyId), eq(inventoryLocations.is_active, true)));
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Erro ao listar localizações:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createLocation(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
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
    const locationId = parseInt(req.params.id, 10);

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
    const locationId = parseInt(req.params.id, 10);

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
    const locationId = parseInt(req.params.id, 10);
    const format = (req.query.format as 'png' | 'svg') || 'png';

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

