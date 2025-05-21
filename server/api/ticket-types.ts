import { db } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { ticketTypes, departments } from "@shared/schema";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { insertTicketTypeSchema } from "@shared/schema";

// GET /api/ticket-types - Listar tipos de chamado
export async function GET(req: Request) {
  try {
    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para acessar tipos de chamado
    if (session.user.role !== "admin" && session.user.role !== "support" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Parâmetros de filtro
    const url = new URL(req.url);
    
    // Filtrar por empresa
    const companyId = session.user.role === "admin" 
      ? (url.searchParams.get("company_id") ? parseInt(url.searchParams.get("company_id") as string) : undefined)
      : session.user.companyId;
    
    // Filtrar por departamento
    const departmentId = url.searchParams.get("department_id") 
      ? parseInt(url.searchParams.get("department_id") as string) 
      : undefined;
    
    // Filtrar apenas ativos
    const activeOnly = url.searchParams.get("active_only") === "true";

    // Consulta base
    let query = db.select({
      id: ticketTypes.id,
      name: ticketTypes.name,
      value: ticketTypes.value,
      description: ticketTypes.description,
      department_id: ticketTypes.department_id,
      company_id: ticketTypes.company_id,
      created_at: ticketTypes.created_at,
      updated_at: ticketTypes.updated_at,
      is_active: ticketTypes.is_active,
      department_name: departments.name,
    })
    .from(ticketTypes)
    .leftJoin(departments, eq(ticketTypes.department_id, departments.id));
    
    // Adicionar filtros
    if (companyId) {
      query = query.where(eq(ticketTypes.company_id, companyId));
    }
    
    if (departmentId) {
      query = query.where(eq(ticketTypes.department_id, departmentId));
    }
    
    if (activeOnly) {
      query = query.where(eq(ticketTypes.is_active, true));
    }
    
    // Ordenar por departamento e nome
    query = query.orderBy(departments.name, ticketTypes.name);
    
    // Executar a consulta
    const ticketTypesList = await query;

    return Response.json(ticketTypesList);
  } catch (error) {
    console.error("Erro ao listar tipos de chamado:", error);
    return Response.json(
      { error: "Erro ao buscar tipos de chamado" },
      { status: 500 }
    );
  }
}

// POST /api/ticket-types - Criar um novo tipo de chamado
export async function POST(req: Request) {
  try {
    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para criar tipos de chamado
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Validar os dados recebidos
    const data = await req.json();
    const validatedData = insertTicketTypeSchema.parse(data);

    // Definir a empresa
    let companyId = validatedData.company_id;
    
    // Se não for admin global, forçar a empresa do usuário
    if (session.user.role !== "admin") {
      companyId = session.user.companyId;
    }

    // Gerar valor de referência único baseado no nome se não estiver presente
    if (!validatedData.value) {
      // Converter nome para um formato adequado (minúsculo, sem espaços, sem caracteres especiais)
      let baseValue = validatedData.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      // Verificar se já existe um tipo com o mesmo valor
      let valueExists = true;
      let counter = 0;
      let uniqueValue = baseValue;
      
      while (valueExists && counter < 100) {
        const existingType = await db.query.ticketTypes.findFirst({
          where: eq(ticketTypes.value, uniqueValue),
        });
        
        if (!existingType) {
          valueExists = false;
        } else {
          counter++;
          uniqueValue = `${baseValue}_${counter}`;
        }
      }
      
      validatedData.value = uniqueValue;
    }

    // Verificar se o departamento existe e pertence à empresa correta
    if (validatedData.department_id) {
      const department = await db.query.departments.findFirst({
        where: eq(departments.id, validatedData.department_id),
      });

      if (!department) {
        return Response.json({ error: "Departamento não encontrado" }, { status: 404 });
      }

      // Verificar se o departamento pertence à empresa correta
      if (department.company_id !== companyId) {
        return Response.json(
          { error: "O departamento não pertence à empresa especificada" },
          { status: 400 }
        );
      }
    }

    // Criar o tipo de chamado
    const [createdType] = await db
      .insert(ticketTypes)
      .values({
        ...validatedData,
        company_id: companyId,
      })
      .returning();

    return Response.json(createdType, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar tipo de chamado:", error);
    return Response.json(
      { error: "Erro ao criar tipo de chamado" },
      { status: 500 }
    );
  }
}

// PUT /api/ticket-types/:id - Atualizar um tipo de chamado
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const typeId = parseInt(params.id);
    if (isNaN(typeId)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para editar tipos de chamado
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Verificar se o tipo existe
    const existingType = await db.query.ticketTypes.findFirst({
      where: eq(ticketTypes.id, typeId),
    });

    if (!existingType) {
      return Response.json({ error: "Tipo de chamado não encontrado" }, { status: 404 });
    }

    // Se não for admin global, verificar se o tipo pertence à empresa do usuário
    if (session.user.role !== "admin" && existingType.company_id !== session.user.companyId) {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Obter dados da requisição
    const data = await req.json();
    
    // Não permitir alteração da empresa
    delete data.company_id;
    
    // Se o nome foi alterado, regenerar o value
    if (data.name && data.name !== existingType.name) {
      // Converter nome para um formato adequado (minúsculo, sem espaços, sem caracteres especiais)
      let baseValue = data.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      // Verificar se já existe um tipo com o mesmo valor
      let valueExists = true;
      let counter = 0;
      let uniqueValue = baseValue;
      
      while (valueExists && counter < 100) {
        const existingType = await db.query.ticketTypes.findFirst({
          where: and(
            eq(ticketTypes.value, uniqueValue),
            db.sql`${ticketTypes.id} != ${typeId}`
          ),
        });
        
        if (!existingType) {
          valueExists = false;
        } else {
          counter++;
          uniqueValue = `${baseValue}_${counter}`;
        }
      }
      
      data.value = uniqueValue;
    }
    
    // Verificar departamento se estiver sendo alterado
    if (data.department_id && data.department_id !== existingType.department_id) {
      const department = await db.query.departments.findFirst({
        where: eq(departments.id, data.department_id),
      });

      if (!department) {
        return Response.json({ error: "Departamento não encontrado" }, { status: 404 });
      }

      // Verificar se o departamento pertence à empresa correta
      if (department.company_id !== existingType.company_id) {
        return Response.json(
          { error: "O departamento não pertence à empresa especificada" },
          { status: 400 }
        );
      }
    }

    

    // Atualizar o tipo de chamado
    const [updatedType] = await db
      .update(ticketTypes)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(ticketTypes.id, typeId))
      .returning();

    return Response.json(updatedType);
  } catch (error) {
    console.error("Erro ao atualizar tipo de chamado:", error);
    return Response.json(
      { error: "Erro ao atualizar tipo de chamado" },
      { status: 500 }
    );
  }
}

// DELETE /api/ticket-types/:id - Desativar um tipo de chamado
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const typeId = parseInt(params.id);
    if (isNaN(typeId)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obter a sessão para verificar permissões
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o usuário tem permissão para remover tipos de chamado
    if (session.user.role !== "admin" && session.user.role !== "company_admin") {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Verificar se o tipo existe
    const existingType = await db.query.ticketTypes.findFirst({
      where: eq(ticketTypes.id, typeId),
    });

    if (!existingType) {
      return Response.json({ error: "Tipo de chamado não encontrado" }, { status: 404 });
    }

    // Se não for admin global, verificar se o tipo pertence à empresa do usuário
    if (session.user.role !== "admin" && existingType.company_id !== session.user.companyId) {
      return Response.json({ error: "Permissão negada" }, { status: 403 });
    }

    // Em vez de excluir, apenas desativar o tipo de chamado
    const [updatedType] = await db
      .update(ticketTypes)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(ticketTypes.id, typeId))
      .returning();

    return Response.json(updatedType);
  } catch (error) {
    console.error("Erro ao remover tipo de chamado:", error);
    return Response.json(
      { error: "Erro ao remover tipo de chamado" },
      { status: 500 }
    );
  }
} 