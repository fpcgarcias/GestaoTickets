/**
 * Endpoints para gestão de setores (vinculados a solicitantes/customers).
 */

import { Request, Response } from 'express';
import { IStorage } from '../storage';
import { sectors } from '@shared/schema';
import { db } from '../db';
import { eq, and, or, ilike, sql, asc } from 'drizzle-orm';

export async function getSectorsEndpoint(req: Request, res: Response, storage: IStorage) {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
    const search = (req.query.search as string) || '';
    const activeOnly = req.query.active_only === 'true';
    const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;

    const userRole = req.session?.userRole as string;
    const sessionCompanyId = req.session?.companyId;

    let effectiveCompanyId: number | null = null;
    if (userRole === 'admin') {
      effectiveCompanyId = filterCompanyId ?? null;
    } else {
      effectiveCompanyId = sessionCompanyId ?? null;
    }

    const conditions: ReturnType<typeof eq>[] = [];
    if (effectiveCompanyId != null) {
      conditions.push(eq(sectors.company_id, effectiveCompanyId));
    }
    if (activeOnly) {
      conditions.push(eq(sectors.is_active, true));
    }
    if (search) {
      conditions.push(
        or(
          ilike(sectors.name, `%${search}%`),
          ilike(sectors.description, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * limit;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sectors)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const data = await db
      .select()
      .from(sectors)
      .where(whereClause)
      .orderBy(asc(sectors.name))
      .limit(limit)
      .offset(offset);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar setores:', error);
    res.status(500).json({ message: 'Falha ao listar setores', error: error.message || String(error) });
  }
}

export async function createSectorEndpoint(req: Request, res: Response, storage: IStorage) {
  try {
    const { name, description, company_id: companyIdBody } = req.body;

    const userRole = req.session?.userRole as string;
    const sessionCompanyId = req.session?.companyId;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Nome é obrigatório' });
    }

    let effectiveCompanyId: number | null = null;
    if (userRole === 'admin') {
      effectiveCompanyId = companyIdBody ?? null;
    } else {
      effectiveCompanyId = sessionCompanyId ?? null;
    }

    const sector = await storage.createSector({
      name: name.trim(),
      description: description?.trim() || null,
      company_id: effectiveCompanyId ?? undefined,
      is_active: true,
    });

    res.status(201).json(sector);
  } catch (error: any) {
    console.error('Erro ao criar setor:', error);
    res.status(500).json({ message: 'Falha ao criar setor', error: error.message || String(error) });
  }
}

export async function updateSectorEndpoint(req: Request, res: Response, storage: IStorage) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const existing = await storage.getSector(id);
    if (!existing) {
      return res.status(404).json({ message: 'Setor não encontrado' });
    }

    const { name, description, is_active } = req.body;
    const updates: Partial<{ name: string; description: string | null; is_active: boolean }> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Nome inválido' });
      }
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }
    if (is_active !== undefined) {
      updates.is_active = !!is_active;
    }

    const sector = await storage.updateSector(id, updates);
    res.json(sector);
  } catch (error: any) {
    console.error('Erro ao atualizar setor:', error);
    res.status(500).json({ message: 'Falha ao atualizar setor', error: error.message || String(error) });
  }
}

export async function deleteSectorEndpoint(req: Request, res: Response, storage: IStorage) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const existing = await storage.getSector(id);
    if (!existing) {
      return res.status(404).json({ message: 'Setor não encontrado' });
    }

    await storage.deleteSector(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Erro ao excluir setor:', error);
    res.status(500).json({ message: 'Falha ao excluir setor', error: error.message || String(error) });
  }
}
