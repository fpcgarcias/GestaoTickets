import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { departments, companies } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/departments - Buscar todos os departamentos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros de query
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const companyId = session.user.role === 'admin' 
      ? undefined 
      : session.user.companyId;

    // Filtros
    let filters = [];
    
    // Filtro por empresa
    if (companyId) {
      filters.push(eq(departments.company_id, companyId));
    }
    
    // Filtro por status ativo
    if (activeOnly) {
      filters.push(eq(departments.is_active, true));
    }
    
    // Se for admin, incluir informações da empresa
    if (session.user.role === 'admin') {
      const departmentsList = await db.query.departments.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        orderBy: departments.name,
        with: {
          company: {
            columns: {
              id: true,
              name: true,
            }
          }
        }
      });
      
      return NextResponse.json(departmentsList);
    } else {
      // Para outros usuários, buscar sem informações da empresa
      const departmentsList = await db.query.departments.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        orderBy: departments.name,
      });
      
      return NextResponse.json(departmentsList);
    }
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar departamentos' },
      { status: 500 }
    );
  }
}

// POST /api/departments - Criar um novo departamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para criar departamentos' },
        { status: 403 }
      );
    }
    
    const data = await request.json();
    
    // Validar dados
    if (!data.name) {
      return NextResponse.json(
        { error: 'Nome do departamento é obrigatório' },
        { status: 400 }
      );
    }
    
    // Adicionar company_id se não for admin
    const companyId = session.user.role === 'admin'
      ? data.company_id || null
      : session.user.companyId;
    
    // Inserir no banco
    const [newDepartment] = await db.insert(departments)
      .values({
        name: data.name,
        description: data.description || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        company_id: companyId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();
    
    return NextResponse.json(newDepartment, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar departamento' },
      { status: 500 }
    );
  }
} 