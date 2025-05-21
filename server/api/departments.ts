import { db } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { departments } from "@shared/schema";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { insertDepartmentSchema } from "@shared/schema";

// GET /api/departments - Listar departamentos da empresa do usuário
export async function GET(req: Request) {
  try {
    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para acessar departamentos
    if (session.user.role !== "admin" && session.user.role !== "support" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Filtrar por empresa se não for admin geral
    const url = new URL(req.url);
    const companyId = session.user.role === "admin" 
      ? (url.searchParams.get("company_id") ? parseInt(url.searchParams.get("company_id") as string) : undefined)
      : session.user.companyId;

    // Filtrar apenas departamentos ativos?
    const activeOnly = url.searchParams.get("active_only") === "true";

    // Construir a query
    let query = db.select().from(departments);
    
    // Filtrar por empresa se necessário
    if (companyId) {
      query = query.where(eq(departments.company_id, companyId));
    }
    
    // Filtrar apenas ativos se solicitado
    if (activeOnly) {
      query = query.where(eq(departments.is_active, true));
    }
    
    // Ordenar por nome
    query = query.orderBy(departments.name);
    
    // Executar a consulta
    const departmentsList = await query;

    return Response.json(departmentsList);
  } catch (error) {
    console.error("Erro ao listar departamentos:", error);
    return Response.json(
      { error: "Erro ao buscar departamentos" },
      { status: 500 }
    );
  }
}

// POST /api/departments - Criar um novo departamento
export async function POST(req: Request) {
  try {
    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para criar departamentos
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Validar os dados recebidos
    const data = await req.json();
    const validatedData = insertDepartmentSchema.parse(data);

    // Definir a empresa corretamente
    let companyId = validatedData.company_id;
    
    // Se não for admin global, forçar a empresa do usuário
    if (session.user.role !== "admin") {
      companyId = session.user.companyId;
    }

    // Verificar se já existe um departamento com o mesmo nome na mesma empresa
    const existingDepartment = await db.query.departments.findFirst({
      where: and(
        eq(departments.name, validatedData.name),
        eq(departments.company_id, companyId)
      ),
    });

    if (existingDepartment) {
      return Response.json(
        { error: "Já existe um departamento com este nome" },
        { status: 400 }
      );
    }

    // Criar o departamento
    const [createdDepartment] = await db
      .insert(departments)
      .values({
        ...validatedData,
        company_id: companyId,
      })
      .returning();

    return Response.json(createdDepartment, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar departamento:", error);
    return Response.json(
      { error: "Erro ao criar departamento" },
      { status: 500 }
    );
  }
}

// PUT /api/departments/:id - Atualizar um departamento existente
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const departmentId = parseInt(params.id);
    if (isNaN(departmentId)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para editar departamentos
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Verificar se o departamento existe
    const existingDepartment = await db.query.departments.findFirst({
      where: eq(departments.id, departmentId),
    });

    if (!existingDepartment) {
      return Response.json({ error: "Departamento não encontrado" }, { status: 404 });
    }

    // Se não for admin global, verificar se o departamento pertence à empresa do usuário
    if (session.user.role !== "admin" && existingDepartment.company_id !== session.user.companyId) {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Validar dados de atualização
    const data = await req.json();
    
    // Não permitir alteração da empresa
    delete data.company_id;
    
    // Atualizar o departamento
    const [updatedDepartment] = await db
      .update(departments)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(departments.id, departmentId))
      .returning();

    return Response.json(updatedDepartment);
  } catch (error) {
    console.error("Erro ao atualizar departamento:", error);
    return Response.json(
      { error: "Erro ao atualizar departamento" },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/:id - Desativar um departamento
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const departmentId = parseInt(params.id);
    if (isNaN(departmentId)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para remover departamentos
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Verificar se o departamento existe
    const existingDepartment = await db.query.departments.findFirst({
      where: eq(departments.id, departmentId),
    });

    if (!existingDepartment) {
      return Response.json({ error: "Departamento não encontrado" }, { status: 404 });
    }

    // Se não for admin global, verificar se o departamento pertence à empresa do usuário
    if (session.user.role !== "admin" && existingDepartment.company_id !== session.user.companyId) {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Em vez de excluir, apenas desativar o departamento
    const [updatedDepartment] = await db
      .update(departments)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(departments.id, departmentId))
      .returning();

    return Response.json(updatedDepartment);
  } catch (error) {
    console.error("Erro ao remover departamento:", error);
    return Response.json(
      { error: "Erro ao remover departamento" },
      { status: 500 }
    );
  }
} 