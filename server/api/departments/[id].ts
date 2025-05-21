import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { departments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/departments/[id] - Buscar departamento por ID
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
    let filters = [eq(departments.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(departments.company_id, session.user.companyId));
    }
    
    const department = await db.query.departments.findFirst({
      where: and(...filters),
    });
    
    if (!department) {
      return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(department);
  } catch (error) {
    console.error('Erro ao buscar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar departamento' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Atualizar departamento
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar departamentos' },
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
        { error: 'Nome do departamento é obrigatório' },
        { status: 400 }
      );
    }
    
    // Filtro por empresa (se não for admin)
    let filters = [eq(departments.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(departments.company_id, session.user.companyId));
    }
    
    // Verificar se o departamento existe
    const department = await db.query.departments.findFirst({
      where: and(...filters),
    });
    
    if (!department) {
      return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 });
    }
    
    // Atualizar no banco
    const [updatedDepartment] = await db.update(departments)
      .set({
        name: data.name,
        description: data.description || null,
        is_active: data.is_active !== undefined ? data.is_active : department.is_active,
        company_id: session.user.role === 'admin' && data.company_id !== undefined 
          ? data.company_id 
          : department.company_id,
        updated_at: new Date(),
      })
      .where(and(...filters))
      .returning();
    
    if (!updatedDepartment) {
      return NextResponse.json(
        { error: 'Não foi possível atualizar o departamento' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedDepartment);
  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar departamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Excluir departamento
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para excluir departamentos' },
        { status: 403 }
      );
    }
    
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    
    // Filtro por empresa (se não for admin)
    let filters = [eq(departments.id, id)];
    
    if (session.user.role !== 'admin' && session.user.companyId) {
      filters.push(eq(departments.company_id, session.user.companyId));
    }
    
    // Excluir do banco
    const [deletedDepartment] = await db.delete(departments)
      .where(and(...filters))
      .returning();
    
    if (!deletedDepartment) {
      return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir departamento' },
      { status: 500 }
    );
  }
} 