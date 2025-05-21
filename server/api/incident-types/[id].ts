import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidentTypes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/incident-types/[id] - Buscar tipo de chamado por ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    
    // Filtro por empresa (se não for admin)
    let filters = [eq(incidentTypes.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(incidentTypes.company_id, session.user.companyId));
    }
    
    const incidentType = await db.query.incidentTypes.findFirst({
      where: and(...filters),
    });
    
    if (!incidentType) {
      return NextResponse.json({ error: 'Tipo de chamado não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(incidentType);
  } catch (error) {
    console.error('Erro ao buscar tipo de chamado:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tipo de chamado' },
      { status: 500 }
    );
  }
}

// PUT /api/incident-types/[id] - Atualizar tipo de chamado
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar tipos de chamado' },
        { status: 403 }
      );
    }
    
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    
    const data = await request.json();
    
    // Validar dados
    if (!data.name) {
      return NextResponse.json(
        { error: 'Nome do tipo de chamado é obrigatório' },
        { status: 400 }
      );
    }
    
    if (!data.value) {
      return NextResponse.json(
        { error: 'Valor de referência é obrigatório' },
        { status: 400 }
      );
    }
    
    // Filtro por empresa (se não for admin)
    let filters = [eq(incidentTypes.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(incidentTypes.company_id, session.user.companyId));
    }
    
    // Verificar se o tipo de chamado existe
    const incidentType = await db.query.incidentTypes.findFirst({
      where: and(...filters),
    });
    
    if (!incidentType) {
      return NextResponse.json({ error: 'Tipo de chamado não encontrado' }, { status: 404 });
    }
    
    // Verificar se já existe outro tipo com o mesmo valor
    if (data.value !== incidentType.value) {
      const existing = await db.query.incidentTypes.findFirst({
        where: and(
          eq(incidentTypes.value, data.value),
          session.user.companyId ? eq(incidentTypes.company_id, session.user.companyId) : undefined,
          data.id ? eq(incidentTypes.id, data.id) : undefined,
        ),
      });
      
      if (existing) {
        return NextResponse.json(
          { error: 'Já existe um tipo de chamado com este valor de referência' },
          { status: 400 }
        );
      }
    }
    
    // Preparar dados para atualização
    const updateData = {
      name: data.name,
      value: data.value,
      description: data.description || null,
      department_id: data.department_id || incidentType.department_id,
      company_id: session.user.role === 'admin' && data.company_id !== undefined 
        ? data.company_id 
        : incidentType.company_id,
      updated_at: new Date(),
    };
    
    // Adicionar is_active se a coluna existir
    try {
      // @ts-ignore - is_active pode ainda não existir no schema
      updateData.is_active = data.is_active !== undefined ? data.is_active : incidentType.is_active;
    } catch {
      console.log('Coluna is_active ainda não adicionada à tabela incident_types');
    }
    
    // Atualizar no banco
    const [updatedIncidentType] = await db.update(incidentTypes)
      .set(updateData)
      .where(and(...filters))
      .returning();
    
    if (!updatedIncidentType) {
      return NextResponse.json(
        { error: 'Não foi possível atualizar o tipo de chamado' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedIncidentType);
  } catch (error) {
    console.error('Erro ao atualizar tipo de chamado:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar tipo de chamado' },
      { status: 500 }
    );
  }
}

// DELETE /api/incident-types/[id] - Excluir tipo de chamado
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para excluir tipos de chamado' },
        { status: 403 }
      );
    }
    
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    
    // Filtro por empresa (se não for admin)
    let filters = [eq(incidentTypes.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(incidentTypes.company_id, session.user.companyId));
    }
    
    // Excluir do banco
    const [deletedIncidentType] = await db.delete(incidentTypes)
      .where(and(...filters))
      .returning();
    
    if (!deletedIncidentType) {
      return NextResponse.json({ error: 'Tipo de chamado não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir tipo de chamado:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir tipo de chamado' },
      { status: 500 }
    );
  }
} 