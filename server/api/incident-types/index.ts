import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidentTypes } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/incident-types - Buscar todos os tipos de chamado
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros de query
    const url = new URL(request.url);
    const departmentId = url.searchParams.get('department_id') 
      ? parseInt(url.searchParams.get('department_id')!) 
      : undefined;
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const companyId = session.user.role === 'admin' 
      ? undefined 
      : session.user.companyId;

    // Filtros
    let filters = [];
    
    // Filtro por empresa
    if (companyId) {
      filters.push(eq(incidentTypes.company_id, companyId));
    }
    
    // Filtro por departamento
    if (departmentId && !isNaN(departmentId)) {
      filters.push(eq(incidentTypes.department_id, departmentId));
    }
    
    // Filtro por status ativo
    if (activeOnly) {
      // Adicionar filtro por is_active quando a coluna existir no banco
      // Como a coluna é adicionada via migração, verificamos se ela existe
      try {
        filters.push(eq(incidentTypes.is_active, true));
      } catch {
        console.log('Coluna is_active ainda não adicionada à tabela incident_types');
      }
    }
    
    // Executar a consulta
    const incidentTypesList = await db.query.incidentTypes.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: incidentTypes.name,
    });
    
    return NextResponse.json(incidentTypesList);
  } catch (error) {
    console.error('Erro ao buscar tipos de chamado:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tipos de chamado' },
      { status: 500 }
    );
  }
}

// POST /api/incident-types - Criar um novo tipo de chamado
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    // Verificar permissão (apenas admin ou company_admin)
    if (!['admin', 'company_admin'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para criar tipos de chamado' },
        { status: 403 }
      );
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
    
    // Adicionar company_id se não for admin
    const companyId = session.user.role === 'admin'
      ? data.company_id || null
      : session.user.companyId;
    
    // Verificar se já existe um tipo de chamado com o mesmo valor
    const existing = await db.query.incidentTypes.findFirst({
      where: and(
        eq(incidentTypes.value, data.value),
        companyId ? eq(incidentTypes.company_id, companyId) : undefined
      ),
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um tipo de chamado com este valor de referência' },
        { status: 400 }
      );
    }
    
    // Inserir no banco
    const insertData = {
      name: data.name,
      value: data.value,
      description: data.description || null,
      department_id: data.department_id || null,
      company_id: companyId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    // Adicionar is_active se a coluna existir
    try {
      // @ts-ignore - is_active pode ainda não existir no schema
      insertData.is_active = data.is_active !== undefined ? data.is_active : true;
    } catch {
      console.log('Coluna is_active ainda não adicionada à tabela incident_types');
    }
    
    const [newIncidentType] = await db.insert(incidentTypes)
      .values(insertData)
      .returning();
    
    return NextResponse.json(newIncidentType, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar tipo de chamado:', error);
    return NextResponse.json(
      { error: 'Erro ao criar tipo de chamado' },
      { status: 500 }
    );
  }
} 