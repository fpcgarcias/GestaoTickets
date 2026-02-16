import { 
  users, customers, officials, tickets, ticketReplies, ticketStatusHistory,
  type User, type InsertUser, 
  type Customer, type InsertCustomer, 
  type Official, type InsertOfficial,
  type Ticket, type InsertTicket,
  type TicketReply, type InsertTicketReply,
  type TicketStatusHistory,
  officialDepartments, type OfficialDepartment, type InsertOfficialDepartment,
  ticketStatusEnum,
  incidentTypes, type IncidentType,
  categories, type Category,
  companies, departments,
  ticketParticipants, type TicketParticipant,
  type Company,
  serviceProviders, departmentServiceProviders, ticketServiceProviders,
  type ServiceProvider
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns, isNull, ilike, asc, gte, lte, ne, exists } from "drizzle-orm";
import { IStorage } from "./storage";
import { isSlaPaused } from "@shared/ticket-utils";
import { convertStatusHistoryToPeriods, calculateEffectiveBusinessTime, getBusinessHoursConfig } from "@shared/utils/sla-calculator";

// Definir tipo TicketStatus globalmente para uso nos casts
type TicketStatus = typeof ticketStatusEnum.enumValues[number];

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      console.log('DatabaseStorage.createUser - Iniciando criaÃ§Ã£o com dados:', JSON.stringify(userData, null, 2));
      
      // Verificar campos obrigatÃ³rios
      if (!userData.username) {
        throw new Error('Nome de usuÃ¡rio Ã© obrigatÃ³rio');
      }
      if (!userData.email) {
        throw new Error('Email Ã© obrigatÃ³rio');
      }
      if (!userData.password) {
        throw new Error('Senha Ã© obrigatÃ³ria');
      }
      
      // Garantir que isActive tem um valor padrÃ£o verdadeiro
      const dataWithDefaults = {
        ...userData,
        active: userData.active !== false, // default para true
        avatar_url: userData.avatar_url || null,
        must_change_password: userData.must_change_password || false
      };
      
      console.log('DatabaseStorage.createUser - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
      const [user] = await db.insert(users).values(dataWithDefaults).returning();
      
      if (!user) {
        throw new Error('Falha ao criar usuÃ¡rio - nenhum registro retornado');
      }
      
      console.log('DatabaseStorage.createUser - UsuÃ¡rio criado com sucesso:', JSON.stringify(user, null, 2));
      return user;
    } catch (error) {
      console.error('DatabaseStorage.createUser - Erro:', error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async inactivateUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ active: false, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async activateUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ active: true, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getActiveUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.name);
  }
  
  async getAllUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .orderBy(users.name);
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .select(getTableColumns(companies))
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return company || undefined;
  }
  
  // Customer operations
  async getCustomers(): Promise<Customer[]> {
    // Busca clientes jÃ¡ com nome da empresa e status do usuÃ¡rio associado, eliminando N+1 queries
    return db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        company: customers.company, // campo original
        company_id: customers.company_id,
        user_id: customers.user_id,
        avatar_url: customers.avatar_url,
        created_at: customers.created_at,
        updated_at: customers.updated_at,
        company_name: companies.name, // nome da empresa (auxiliar)
        user_active: users.active, // status do usuÃ¡rio (auxiliar)
        user_username: users.username,
        user_role: users.role
      })
      .from(customers)
      .leftJoin(companies, eq(customers.company_id, companies.id))
      .leftJoin(users, eq(customers.user_id, users.id))
      .orderBy(asc(customers.name));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer || undefined;
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(customerData).returning();
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    await db.delete(customers).where(eq(customers.id, id));
    return true;
  }

  // Official operations
  async getOfficials(): Promise<Official[]> {
    // 1Âª Query: Busca oficiais, dados do usuÃ¡rio, empresa e contagem de tickets em uma query agregada
    const officialsWithUserAndTicketCount = await db
      .select({
        id: officials.id,
        name: officials.name,
        email: officials.email,
        department_id: officials.department_id,
        user_id: officials.user_id,
        is_active: officials.is_active,
        avatar_url: officials.avatar_url,
        company_id: officials.company_id,
        supervisor_id: officials.supervisor_id,
        manager_id: officials.manager_id,
        created_at: officials.created_at,
        updated_at: officials.updated_at,
        user_username: users.username,
        user_email: users.email,
        user_role: users.role,
        company_name: companies.name,
        assignedTicketsCount: sql<number>`COUNT(tickets.id)`
      })
      .from(officials)
      .leftJoin(users, eq(officials.user_id, users.id))
      .leftJoin(companies, eq(officials.company_id, companies.id))
      .leftJoin(tickets, eq(tickets.assigned_to_id, officials.id))
      .groupBy(officials.id, users.id, companies.id);

    // 2Âª Query: Busca todos os departamentos de todos os oficiais de uma vez
    const officialDepartmentsData = await db
      .select({
        official_id: officialDepartments.official_id,
        department_name: departments.name
      })
      .from(officialDepartments)
      .leftJoin(departments, eq(officialDepartments.department_id, departments.id));

    // Monta um mapa de official_id para array de nomes de departamentos
    const departmentsMap = new Map<number, string[]>();
    for (const row of officialDepartmentsData) {
      if (!departmentsMap.has(row.official_id)) {
        departmentsMap.set(row.official_id, []);
      }
      if (row.department_name) {
        departmentsMap.get(row.official_id)!.push(row.department_name);
      }
    }

    // Monta um mapa de id para dados do official (para lookup rÃ¡pido do manager)
    const officialIdMap = new Map<number, { id: number, name: string, email: string }>();
    for (const row of officialsWithUserAndTicketCount) {
      officialIdMap.set(row.id, { id: row.id, name: row.name, email: row.email });
    }

    // Monta o array final de oficiais, agregando departamentos, dados do usuÃ¡rio, empresa e manager
    const officialsResult: Official[] = officialsWithUserAndTicketCount.map((row) => {
      let manager: Partial<Official> | undefined = undefined;
      if (row.manager_id && officialIdMap.has(row.manager_id)) {
        manager = officialIdMap.get(row.manager_id);
      }
      return {
        ...row,
        departments: departmentsMap.get(row.id) || [],
        assignedTicketsCount: Number(row.assignedTicketsCount) || 0,
        company: row.company_name ? { name: row.company_name } : null,
        user: row.user_id
          ? {
              id: row.user_id,
              username: row.user_username,
              email: row.user_email,
              role: row.user_role
            }
          : undefined,
        manager // agora retorna objeto {id, name, email} ou null
      };
    });

    // // melhoria de performance: eliminadas N+1 queries usando JOINs e agregaÃ§Ã£o
    // // agora apenas 2 queries fixas, independente do nÃºmero de oficiais
    return officialsResult;
  }

  async getOfficial(id: number): Promise<Official | undefined> {
    const [official] = await db.select().from(officials).where(eq(officials.id, id));
    return official || undefined;
  }

  async getOfficialByEmail(email: string): Promise<Official | undefined> {
    const [official] = await db.select().from(officials).where(eq(officials.email, email));
    return official || undefined;
  }

  async createOfficial(officialData: InsertOfficial): Promise<Official> {
    try {
      console.log('DatabaseStorage.createOfficial - Iniciando criaÃ§Ã£o com dados:', JSON.stringify(officialData, null, 2));
      
      // Verificar campos obrigatÃ³rios
      if (!officialData.email) {
        throw new Error('Email do atendente Ã© obrigatÃ³rio');
      }
      if (!officialData.name) {
        throw new Error('Nome do atendente Ã© obrigatÃ³rio');
      }
      
      // Garantir que isActive tem um valor padrÃ£o verdadeiro
      const dataWithDefaults = {
        ...officialData,
        is_active: officialData.is_active !== false, // default para true
        avatar_url: officialData.avatar_url || null
      };
      
      console.log('DatabaseStorage.createOfficial - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
      const [official] = await db.insert(officials).values(dataWithDefaults).returning();
      
      if (!official) {
        throw new Error('Falha ao criar atendente - nenhum registro retornado');
      }
      
      console.log('DatabaseStorage.createOfficial - Atendente criado com sucesso:', JSON.stringify(official, null, 2));
      return official;
    } catch (error) {
      console.error('DatabaseStorage.createOfficial - Erro:', error);
      throw error;
    }
  }

  async updateOfficial(id: number, officialData: Partial<Official>): Promise<Official | undefined> {
    const [official] = await db
      .update(officials)
      .set(officialData)
      .where(eq(officials.id, id))
      .returning();
    return official || undefined;
  }

  async deleteOfficial(id: number): Promise<boolean> {
    // Primeiro removemos os departamentos relacionados
    await db.delete(officialDepartments).where(eq(officialDepartments.official_id, id));
    
    // Depois removemos o oficial
    await db.delete(officials).where(eq(officials.id, id));
    return true;
  }
  
  async inactivateOfficial(id: number): Promise<Official | undefined> {
    const [official] = await db
      .update(officials)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(officials.id, id))
      .returning();
    return official || undefined;
  }

  async activateOfficial(id: number): Promise<Official | undefined> {
    const [official] = await db
      .update(officials)
      .set({ is_active: true, updated_at: new Date() })
      .where(eq(officials.id, id))
      .returning();
    return official || undefined;
  }
  
  // OperaÃ§Ãµes de departamentos dos oficiais
  async getOfficialDepartments(officialId: number): Promise<OfficialDepartment[]> {
    return db
      .select()
      .from(officialDepartments)
      .where(eq(officialDepartments.official_id, officialId));
  }
  
  async addOfficialDepartment(officialDepartment: InsertOfficialDepartment): Promise<OfficialDepartment> {
    const [department] = await db
      .insert(officialDepartments)
      .values(officialDepartment)
      .returning();
    return department;
  }
  
  async removeOfficialDepartment(officialId: number, departmentName: string): Promise<boolean> {
    // Garantir que resolvemos o departamento na MESMA empresa do atendente
    const [official] = await db
      .select({ id: officials.id, company_id: officials.company_id })
      .from(officials)
      .where(eq(officials.id, officialId))
      .limit(1);

    if (!official || !official.company_id) {
      console.warn(`NÃ£o foi possÃ­vel determinar a empresa do atendente ${officialId} para remover departamento '${departmentName}'`);
      return false;
    }

    // Buscar o department_id pelo nome E pela empresa do atendente
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(
        eq(departments.name, departmentName),
        eq(departments.company_id, official.company_id)
      ))
      .limit(1);
    
    if (!dept) {
      console.warn(`Departamento nÃ£o encontrado para a empresa ${official.company_id}: ${departmentName}`);
      return false;
    }
    
    await db
      .delete(officialDepartments)
      .where(
        and(
          eq(officialDepartments.official_id, officialId),
          eq(officialDepartments.department_id, dept.id)
        )
      );
    return true;
  }
  
  async getOfficialsByDepartment(departmentName: string): Promise<Official[]> {
    // Buscar o department_id pelo nome
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, departmentName));
    
    if (!dept) {
      console.warn(`Departamento nÃ£o encontrado: ${departmentName}`);
      return [];
    }
    
    const departmentOfficials = await db
      .select()
      .from(officialDepartments)
      .innerJoin(officials, eq(officialDepartments.official_id, officials.id))
      .where(eq(officialDepartments.department_id, dept.id));
    
    return departmentOfficials.map(row => row.officials);
  }
  
  // Filtrar tickets baseado no perfil do usuÃ¡rio
  // MÃ©todo paginado principal
  async getTicketsByUserRolePaginated(
    userId: number,
    userRole: string,
    filters: {
      search?: string;
      status?: string;
      priority?: string;
      department_id?: number;
      incident_type_id?: number;
      category_id?: number;
      assigned_to_id?: number;
      unassigned?: boolean;
      hide_resolved?: boolean;
      time_filter?: string;
      date_from?: string;
      date_to?: string;
      start_date?: string;
      end_date?: string;
      include_open_outside_period?: boolean;
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Ticket[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }> {
    // Montar filtros SQL conforme papel do usuário (MESMA LÓGICA DO DASHBOARD)
    let whereClauses: any[] = [];
    let companyId: number | null;
    
    if (userRole === 'admin') {
      // Admin vê tudo
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.company_id) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      companyId = user.company_id;
      whereClauses.push(eq(tickets.company_id, companyId));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
      if (!customer) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Cliente pode ver tickets que ele criou OU tickets onde ele foi marcado como participante
      const customerCondition = or(
        eq(tickets.customer_id, customer.id), // Tickets que ele criou
        exists( // Tickets onde ele Ã© participante
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, tickets.id),
              eq(ticketParticipants.user_id, userId)
            ))
        )
      );
      whereClauses.push(customerCondition);
      // Garantir filtro por empresa para nÃ£o-admins
      if (customer.company_id) {
        whereClauses.push(eq(tickets.company_id, customer.company_id));
      }
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      // Buscar subordinados
      const subordinates = await db.select().from(officials).where(eq(officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      if (!filters.assigned_to_id) {
      const assignmentFilter = or(
        eq(tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(tickets.assigned_to_id)
      );
      whereClauses.push(assignmentFilter);
      } else {
        if (subordinateIds.includes(Number(filters.assigned_to_id))) {
          whereClauses.push(eq(tickets.assigned_to_id, Number(filters.assigned_to_id)));
        } else if (Number(filters.assigned_to_id) === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // NÃ£o tem permissÃ£o
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
        }
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO (mas uniÃ£o com tickets que criou/participa abaixo)
      const deptConstraint = inArray(tickets.department_id, departmentIds);
      whereClauses.push(deptConstraint);
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      // Buscar subordinados
      const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      if (!filters.assigned_to_id) {
      const assignmentFilter = or(
        eq(tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(tickets.assigned_to_id)
      );
      whereClauses.push(assignmentFilter);
      } else {
        if (subordinateIds.includes(Number(filters.assigned_to_id))) {
          whereClauses.push(eq(tickets.assigned_to_id, Number(filters.assigned_to_id)));
        } else if (Number(filters.assigned_to_id) === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // NÃ£o tem permissÃ£o
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
        }
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO (mas uniÃ£o com tickets que criou/participa abaixo)
      const deptConstraint = inArray(tickets.department_id, departmentIds);
      whereClauses.push(deptConstraint);
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      if (!filters.assigned_to_id) {
      const assignmentFilter = or(
        eq(tickets.assigned_to_id, official.id),
        isNull(tickets.assigned_to_id)
      );
      whereClauses.push(assignmentFilter);
      } else if (Number(filters.assigned_to_id) === official.id) {
        whereClauses.push(eq(tickets.assigned_to_id, official.id));
    } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO (mas uniÃ£o com tickets que criou/participa abaixo)
      const deptConstraint = inArray(tickets.department_id, departmentIds);
      whereClauses.push(deptConstraint);
    }

    // OR adicional: Todos os papÃ©is (exceto admin) tambÃ©m enxergam tickets que criaram (customer) OU onde sÃ£o participantes,
    // independentemente do departamento
    if (userRole !== 'admin') {
      // Obter customer_id do usuÃ¡rio, se existir
      const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
      const participantSubquery = exists(
        db.select().from(ticketParticipants)
          .where(and(
            eq(ticketParticipants.ticket_id, tickets.id),
            eq(ticketParticipants.user_id, userId)
          ))
      );

      const createdByBranch = customer && customer.id
        ? eq(tickets.customer_id, customer.id)
        : sql`false`;

      // Se jÃ¡ hÃ¡ clÃ¡usulas, OR com o branch de criador/participante; senÃ£o, usar apenas criador/participante
      if (whereClauses.length > 0) {
        const existingAnd = and(...whereClauses);
        const visibilityUnion = or(existingAnd, createdByBranch, participantSubquery);
        whereClauses = [visibilityUnion];
      } else {
        whereClauses = [or(createdByBranch, participantSubquery)];
      }
    }

    // Aplicar filtros adicionais
    if (filters.status && filters.status !== 'all') {
        whereClauses.push(eq(tickets.status, filters.status as any));
    }
    if (filters.priority && filters.priority !== 'all') {
      whereClauses.push(eq(tickets.priority, filters.priority));
    }
    if (filters.department_id && filters.department_id !== 0) {
      whereClauses.push(eq(tickets.department_id, filters.department_id));
    }
    if (filters.incident_type_id && filters.incident_type_id !== 0) {
      whereClauses.push(eq(tickets.incident_type_id, filters.incident_type_id));
    }
    if (filters.category_id && filters.category_id !== 0) {
      whereClauses.push(eq(tickets.category_id, filters.category_id));
    }
    if (filters.assigned_to_id && filters.assigned_to_id !== 0) {
      if (filters.assigned_to_id === -1) {
      whereClauses.push(isNull(tickets.assigned_to_id));
      } else {
        whereClauses.push(eq(tickets.assigned_to_id, Number(filters.assigned_to_id)));
      }
    }
    // Tratamento especial: incluir abertos fora do perÃ­odo (OR lÃ³gico)
    const includeOpenOutsidePeriod = !!(filters as any).include_open_outside_period;
    if (includeOpenOutsidePeriod) {
      // Determinar janela do perÃ­odo (preferÃªncia: start/end_date, depois date_from/date_to, depois this-month)
      let periodStart: Date | undefined;
      let periodEnd: Date | undefined;
      if (filters.start_date || filters.end_date) {
        if (filters.start_date) {
          periodStart = new Date(filters.start_date);
        }
        if (filters.end_date) {
          periodEnd = new Date(filters.end_date);
        }
      } else if (filters.date_from || filters.date_to) {
        if (filters.date_from) {
          periodStart = new Date(filters.date_from);
        }
        if (filters.date_to) {
          const endDate = new Date(filters.date_to);
          endDate.setHours(23, 59, 59, 999);
          periodEnd = endDate;
        }
      } else if (filters.time_filter === 'this-month') {
        const now = new Date();
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
      }

      if (periodStart || periodEnd) {
        // Montar ramo do perÃ­odo do mÃªs atual
        const monthBranch: any[] = [];
        if (periodStart) monthBranch.push(gte(tickets.created_at, periodStart));
        if (periodEnd) monthBranch.push(lte(tickets.created_at, periodEnd));
        // Toggle hide_resolved deve atuar apenas no mÃªs atual
        if (filters.hide_resolved) {
          monthBranch.push(and(ne(tickets.status, 'resolved'), ne(tickets.status, 'closed')));
        }

        const monthBranchCondition = monthBranch.length > 0 ? and(...monthBranch) : undefined;
        // CondiÃ§Ã£o para tickets abertos fora do perÃ­odo (se includeOpenOutsidePeriod estiver ativo)
        // Se hide_resolved estiver ativo, tambÃ©m excluir 'closed' aqui
        const openOutsideCondition = filters.hide_resolved 
          ? and(ne(tickets.status, 'resolved'), ne(tickets.status, 'closed'))
          : ne(tickets.status, 'resolved');
        const orCondition = monthBranchCondition ? or(monthBranchCondition, openOutsideCondition) : openOutsideCondition;

        whereClauses.push(orCondition);
      } else {
        // Se nÃ£o conseguimos determinar perÃ­odo, cair no comportamento padrÃ£o abaixo
        if (filters.hide_resolved) {
          whereClauses.push(and(ne(tickets.status, 'resolved'), ne(tickets.status, 'closed')));
        }
      }
    } else {
      // Comportamento padrÃ£o existente para filtros de data e hide_resolved (ocultar resolvidos e encerrados)
      if (filters.hide_resolved) {
        whereClauses.push(and(ne(tickets.status, 'resolved'), ne(tickets.status, 'closed')));
      }
      // USAR MESMA LÃ“GICA DO DASHBOARD - start_date e end_date tÃªm prioridade
      if (filters.start_date || filters.end_date) {
        if (filters.start_date) {
          whereClauses.push(gte(tickets.created_at, new Date(filters.start_date)));
        }
        if (filters.end_date) {
          whereClauses.push(lte(tickets.created_at, new Date(filters.end_date)));
        }
      } else if (filters.date_from) {
        whereClauses.push(gte(tickets.created_at, new Date(filters.date_from)));
      }
      if (filters.date_to && !filters.start_date && !filters.end_date) {
        const endDate = new Date(filters.date_to);
        endDate.setHours(23, 59, 59, 999);
        whereClauses.push(lte(tickets.created_at, endDate));
      }
      if (filters.time_filter && !filters.start_date && !filters.end_date && !filters.date_from && !filters.date_to) {
        // Usar a mesma lÃ³gica do dashboard para calcular datas
        const now = new Date();
        let startDate: Date;
        let endDate: Date;
        
        if (filters.time_filter === 'this-week') {
          // Segunda-feira da semana atual
          const today = new Date(now);
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = domingo, 1 = segunda
          startDate = new Date(today);
          startDate.setDate(today.getDate() - daysToMonday);
          startDate.setHours(0, 0, 0, 0);
          
          // Domingo da semana atual
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          
          whereClauses.push(gte(tickets.created_at, startDate));
          whereClauses.push(lte(tickets.created_at, endDate));
        } else if (filters.time_filter === 'last-week') {
          // Segunda-feira da semana passada
          const today = new Date(now);
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisWeekMonday = new Date(today);
          thisWeekMonday.setDate(today.getDate() - daysToMonday);
          
          startDate = new Date(thisWeekMonday);
          startDate.setDate(thisWeekMonday.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          
          // Domingo da semana passada
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          
          whereClauses.push(gte(tickets.created_at, startDate));
          whereClauses.push(lte(tickets.created_at, endDate));
        } else if (filters.time_filter === 'this-month') {
          // Primeiro dia do mÃªs atual
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          
          // Ãšltimo dia do mÃªs atual
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          
          whereClauses.push(gte(tickets.created_at, startDate));
          whereClauses.push(lte(tickets.created_at, endDate));
        }
      }
    }
    // Filtro de busca textual livre (em mÃºltiplos campos)
    let searchClause: any = undefined;
    if (filters.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      searchClause = or(
        ilike(tickets.title, search),
        ilike(tickets.description, search),
        ilike(tickets.ticket_id, search),
        ilike(customers.name, search),
        ilike(customers.email, search)
      );
    }
    // Montar query principal com JOINs
    const query = db
      .select({
        ...getTableColumns(tickets),
        customer_name: customers.name,
        customer_email: customers.email,
        official_name: officials.name,
        official_email: officials.email
      })
      .from(tickets)
      .leftJoin(customers, eq(tickets.customer_id, customers.id))
      .leftJoin(officials, eq(tickets.assigned_to_id, officials.id));
    let whereFinal;
    if (whereClauses.length > 0 && searchClause) {
      whereFinal = and(...whereClauses, searchClause);
    } else if (whereClauses.length > 0) {
      whereFinal = and(...whereClauses);
    } else if (searchClause) {
      whereFinal = searchClause;
    }
    // Query de total
    let total: number;
    if (whereFinal) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tickets)
        .leftJoin(customers, eq(tickets.customer_id, customers.id))
        .leftJoin(officials, eq(tickets.assigned_to_id, officials.id))
        .where(whereFinal);
      total = Number(count);
    } else {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tickets)
        .leftJoin(customers, eq(tickets.customer_id, customers.id))
        .leftJoin(officials, eq(tickets.assigned_to_id, officials.id));
      total = Number(count);
    }
    // Query paginada
    const offset = (page - 1) * limit;
    const ticketsData = whereFinal
      ? await query.where(whereFinal).orderBy(desc(tickets.created_at)).limit(limit).offset(offset)
      : await query.orderBy(desc(tickets.created_at)).limit(limit).offset(offset);
    
    // Mapear para o formato esperado pelo frontend
    const mappedTickets = ticketsData.map(row => ({
      ...row,
      customer: row.customer_name || row.customer_email ? {
        name: row.customer_name,
        email: row.customer_email
      } : {},
      official: row.official_name || row.official_email ? {
        name: row.official_name,
        email: row.official_email
      } : undefined
    }));
    
    const totalPages = Math.ceil(total / limit);
    return {
      data: mappedTickets as Ticket[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Wrapper para compatibilidade com interface antiga (array)
  async getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]> {
    const result = await this.getTicketsByUserRolePaginated(userId, userRole, {}, 1, 1000);
    return result.data;
  }

  // Ticket operations
  async getTickets(): Promise<Ticket[]> {
    const ticketsData = await db.select().from(tickets);
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(async (ticket) => {
        let customerData: Customer | undefined = undefined;
        if (ticket.customer_id) { // Verificar se customer_id nÃ£o Ã© null
          [customerData] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, ticket.customer_id)); // Agora seguro
        }
        
        let officialData: Official | undefined = undefined;
        if (ticket.assigned_to_id) { // Verificar se assigned_to_id nÃ£o Ã© null
          [officialData] = await db
            .select()
            .from(officials)
            .where(eq(officials.id, ticket.assigned_to_id)); // Agora seguro
            
          if (officialData) {
            const officialDepartmentsData = await db
              .select()
              .from(officialDepartments)
              .where(eq(officialDepartments.official_id, officialData.id));
              
            // Buscar nomes dos departamentos pelos IDs
            const departmentIds = officialDepartmentsData.map((od) => od.department_id);
            const departmentNames = await Promise.all(
              departmentIds.map(async (deptId) => {
                const [dept] = await db.select({ name: departments.name })
                  .from(departments)
                  .where(eq(departments.id, deptId));
                return dept?.name || `Dept-${deptId}`;
              })
            );
            officialData = { ...officialData, departments: departmentNames };
          }
        }
        
        const replies = await this.getTicketReplies(ticket.id); // Assumindo que ticket.id Ã© sempre number
        
        return {
          ...ticket,
          customer: customerData || {}, // Retorna objeto vazio se customerData for nulo/undefined
          official: officialData, 
          replies: replies || []
        };
      })
    );
    
    // Cast explÃ­cito para Ticket[] para resolver a incompatibilidade estrutural percebida pelo TS
    return enrichedTickets as Ticket[];
  }

  async getTicket(id: number, userRole?: string, userCompanyId?: number): Promise<Ticket | undefined> {
    const ticket = await this.getTicketInternal(id);
    if (!ticket) return undefined;

    // Verificar permissÃµes de acesso apenas para usuÃ¡rios nÃ£o-admin
    if (userRole && userCompanyId && userRole !== 'admin') {
      if (ticket.company_id && ticket.company_id !== userCompanyId) {
        return undefined;
      }
    }

    // Buscar participantes
    const participants = await this.getTicketParticipants(id);
    ticket.participants = participants;

    return ticket;
  }

  async getTicketByTicketId(ticketId: string): Promise<Ticket | undefined> {
    const [result] = await db
      .select({ // Usar getTableColumns
        ticket: getTableColumns(tickets),
        customer: getTableColumns(customers)
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customer_id))
      .where(eq(tickets.ticket_id, ticketId));
    
    if (!result) return undefined;
    
    // Chamada interna - nÃ£o precisa de controle de acesso de empresa
    return this.getTicketInternal(result.ticket.id);
  }

  // MÃ©todo interno sem controle de empresa para uso em outras funÃ§Ãµes
  private async getTicketInternal(id: number): Promise<Ticket | undefined> {
    // ðŸ”¥ OTIMIZAÃ‡ÃƒO CRÃTICA: Buscar tudo em uma Ãºnica query com JOINs
    const [result] = await db
      .select({
        // Ticket
        ticket_id: tickets.id,
        ticket_ticket_id: tickets.ticket_id,
        ticket_title: tickets.title,
        ticket_description: tickets.description,
        ticket_status: tickets.status,
        ticket_type: tickets.type,
        ticket_priority: tickets.priority,
        ticket_customer_id: tickets.customer_id,
        ticket_customer_email: tickets.customer_email,
        ticket_assigned_to_id: tickets.assigned_to_id,
        ticket_created_at: tickets.created_at,
        ticket_updated_at: tickets.updated_at,
        ticket_first_response_at: tickets.first_response_at,
        ticket_resolved_at: tickets.resolved_at,
        ticket_sla_breached: tickets.sla_breached,
        ticket_department_id: tickets.department_id,
        ticket_incident_type_id: tickets.incident_type_id,
        ticket_company_id: tickets.company_id,
        ticket_category_id: tickets.category_id,
        
        // Customer
        customer_id: customers.id,
        customer_name: customers.name,
        customer_email: customers.email,
        customer_phone: customers.phone,
        customer_company: customers.company,
        customer_user_id: customers.user_id,
        customer_avatar_url: customers.avatar_url,
        customer_created_at: customers.created_at,
        customer_updated_at: customers.updated_at,
        customer_company_id: customers.company_id,
        
        // Official
        official_id: officials.id,
        official_name: officials.name,
        official_email: officials.email,
        official_user_id: officials.user_id,
        official_is_active: officials.is_active,
        official_avatar_url: officials.avatar_url,
        official_created_at: officials.created_at,
        official_updated_at: officials.updated_at,
        official_company_id: officials.company_id,
        official_supervisor_id: officials.supervisor_id,
        official_manager_id: officials.manager_id,
        official_department_id: officials.department_id,
        // Nomes relacionados
        dept_name: departments.name,
        incident_type_name: incidentTypes.name,
        category_name: categories.name,
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customer_id))
      .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
      .leftJoin(departments, eq(departments.id, tickets.department_id))
      .leftJoin(incidentTypes, eq(incidentTypes.id, tickets.incident_type_id))
      .leftJoin(categories, eq(categories.id, tickets.category_id))
      .where(eq(tickets.id, id))
      .limit(1);
    
    if (!result) return undefined;
    
    // Construir o objeto ticket
    const ticket = {
      id: result.ticket_id,
      ticket_id: result.ticket_ticket_id,
      title: result.ticket_title,
      description: result.ticket_description,
      status: result.ticket_status,
      type: result.ticket_type,
      priority: result.ticket_priority,
      customer_id: result.ticket_customer_id,
      customer_email: result.ticket_customer_email,
      assigned_to_id: result.ticket_assigned_to_id,
      created_at: result.ticket_created_at,
      updated_at: result.ticket_updated_at,
      first_response_at: result.ticket_first_response_at,
      resolved_at: result.ticket_resolved_at,
      sla_breached: result.ticket_sla_breached,
      department_id: result.ticket_department_id,
      incident_type_id: result.ticket_incident_type_id,
      company_id: result.ticket_company_id,
      category_id: result.ticket_category_id,
    };

    // Construir o objeto customer se existir
    const customerData = result.customer_id ? {
      id: result.customer_id,
      name: result.customer_name,
      email: result.customer_email,
      phone: result.customer_phone,
      company: result.customer_company,
      user_id: result.customer_user_id,
      avatar_url: result.customer_avatar_url,
      created_at: result.customer_created_at,
      updated_at: result.customer_updated_at,
      company_id: result.customer_company_id,
    } : undefined;

    // Construir o objeto official se existir
    const officialData = result.official_id ? {
      id: result.official_id,
      name: result.official_name,
      email: result.official_email,
      user_id: result.official_user_id,
      is_active: result.official_is_active,
      avatar_url: result.official_avatar_url,
      created_at: result.official_created_at,
      updated_at: result.official_updated_at,
      company_id: result.official_company_id,
      supervisor_id: result.official_supervisor_id,
      manager_id: result.official_manager_id,
      department_id: result.official_department_id,
      departments: [], // NÃ£o buscar departamentos aqui para nÃ£o atrasar - sÃ³ se realmente precisar
    } : undefined;

    // ðŸ”¥ OTIMIZAÃ‡ÃƒO: NÃƒO buscar replies automaticamente - sÃ³ quando realmente precisar
    // Isso evita uma query pesada desnecessÃ¡ria na maioria dos casos
    const replies: TicketReply[] = [];
    
    return {
      ...ticket,
      customer: customerData || {},
      official: officialData, 
      replies: replies,
      department_name: result.dept_name || undefined,
      incident_type_name: result.incident_type_name || undefined,
      category_name: result.category_name || undefined
    } as Ticket;
  }

  async getTicketsByStatus(status: string): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, status as any));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicketInternal(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async getTicketsByCustomerId(customerId: number): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.customer_id, customerId));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicketInternal(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async getTicketsByOfficialId(officialId: number): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.assigned_to_id, officialId));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicketInternal(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    try {
      const ticketId = `${new Date().getFullYear()}-T${String(Date.now()).slice(-6)}`;
      
      const ticketInsertData = {
        ...ticketData,
        ticket_id: ticketId,
        status: ticketStatusEnum.enumValues[0], // Definir status inicial explicitamente se necessÃ¡rio
        priority: ticketData.priority || null, // NÃ£o definir prioridade padrÃ£o - deixar a IA definir
        // Garantir que department_id, incident_type_id, customer_id e company_id sÃ£o nÃºmeros ou null
        department_id: ticketData.department_id ? Number(ticketData.department_id) : null,
        incident_type_id: ticketData.incident_type_id ? Number(ticketData.incident_type_id) : null,
        customer_id: ticketData.customer_id ? Number(ticketData.customer_id) : null,
        company_id: ticketData.company_id ? Number(ticketData.company_id) : null, // âœ… Incluir company_id
      };

  

      // @ts-expect-error - Ignorar erro de tipo temporariamente se status não bater exatamente
      const [insertedTicket] = await db.insert(tickets).values(ticketInsertData).returning();
      return this.getTicketInternal(insertedTicket.id) as Promise<Ticket>; // Usar mÃ©todo interno
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>, changedById?: number): Promise<Ticket | undefined> {

    
    // Se estamos atualizando o status, primeiro adicionamos ao histÃ³rico
    if (ticketData.status) {
      const [currentTicket] = await db.select().from(tickets).where(eq(tickets.id, id));
      
      
      if (currentTicket && currentTicket.status !== ticketData.status) {
        await this.addTicketStatusHistory(
          id,
          currentTicket.status,
          ticketData.status,
          changedById
        );
        
        // ðŸ”¥ CRÃTICO: Qualquer mudanÃ§a de status DEVE PARAR o timer de primeira resposta
        // Se o status estÃ¡ mudando de "new" para qualquer outro E ainda nÃ£o hÃ¡ first_response_at
        if (currentTicket.status === 'new' && !currentTicket.first_response_at) {
          console.log(`[SLA] â° STATUS ALTERADO: Definindo first_response_at para ticket ${id} (${currentTicket.status} â†’ ${ticketData.status})`);
          ticketData.first_response_at = new Date();
        }
        
        // Se o status estÃ¡ sendo alterado para 'resolved' ou 'closed', marcamos a data de resoluÃ§Ã£o
        if ((ticketData.status === 'resolved' || ticketData.status === 'closed') && 
            (currentTicket.status !== 'resolved' && currentTicket.status !== 'closed')) {
          console.log(`[SLA] âœ… TICKET FINALIZADO: Definindo resolved_at para ticket ${id} (status: ${ticketData.status})`);
          ticketData.resolved_at = new Date();
        }
        
        // Se o status estÃ¡ saindo de 'resolved' ou 'closed' para outro status, limpamos resolved_at
        if ((currentTicket.status === 'resolved' || currentTicket.status === 'closed') &&
            (ticketData.status !== 'resolved' && ticketData.status !== 'closed')) {
          console.log(`[SLA] ðŸ”„ TICKET REABERTO: Limpando resolved_at para ticket ${id} (${currentTicket.status} â†’ ${ticketData.status})`);
          ticketData.resolved_at = null;
        }
      }
    }
    
    if (ticketData.assigned_to_id !== undefined) {
      // Lógica futura para assigned_to_id se necessário
    }
    
    try {
      const [ticket] = await db
        .update(tickets)
        .set({
          ...ticketData,
          updated_at: new Date()
        })
        .where(eq(tickets.id, id))
        .returning();
      

      
      if (!ticket) {

        return undefined;
      }
      
      const updatedTicket = await this.getTicketInternal(ticket.id); // Usar mÃ©todo interno

      return updatedTicket;
    } catch (error) {
      console.error(`[ERROR] Erro ao atualizar ticket ${id}:`, error);
      throw error;
    }
  }

  async deleteTicket(id: number): Promise<boolean> {
    // Primeiro removemos as dependÃªncias (respostas e histÃ³rico)
    await db.delete(ticketReplies).where(eq(ticketReplies.ticket_id, id));
    await db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticket_id, id));
    
    // Depois removemos o ticket
    await db.delete(tickets).where(eq(tickets.id, id));
    return true;
  }

  // Ticket reply operations
  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    const replies = await db
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, ticketId))
      .orderBy(ticketReplies.created_at);
    
    // Enriquecer com dados do usuÃ¡rio
    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        if (reply.user_id) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, reply.user_id));
          
          return {
            ...reply,
            user: user || undefined
          };
        }
        return reply;
      })
    );
    
    return enrichedReplies;
  }

  async createTicketReply(replyData: InsertTicketReply): Promise<TicketReply> {

    
    // ðŸŽ¯ SEPARAR campos da REPLY dos campos do TICKET
    const { status, assigned_to_id, type: _type, ...replyOnlyData } = replyData;
    

    
    // âœ… INSERIR APENAS OS CAMPOS QUE PERTENCEM Ã€ TABELA ticket_replies
    const [reply] = await db.insert(ticketReplies).values(replyOnlyData).returning();
    

    
    // AtualizaÃ§Ãµes do ticket a serem feitas
    const ticketUpdates: Partial<Ticket> = {};
    
    // Se estamos atualizando o status do ticket junto com a resposta
    if (status) {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, reply.ticket_id));
      
      if (ticket && ticket.status !== status) {
        ticketUpdates.status = status;
        
        // Nota: A lÃ³gica de resolved_at Ã© tratada no updateTicket
        // NÃ£o precisamos duplicar aqui pois updateTicket jÃ¡ cuida disso
      }
    }
    
    // Se estamos atribuindo o ticket a um atendente
    if (assigned_to_id) {
      ticketUpdates.assigned_to_id = assigned_to_id;
    }
    
    // âœ… APLICAR AS ATUALIZAÃ‡Ã•ES PASSANDO O USER_ID PARA O HISTÃ“RICO
    if (Object.keys(ticketUpdates).length > 0) {
      await this.updateTicket(reply.ticket_id, ticketUpdates, reply.user_id || undefined);
    }
    
    // Se esta Ã© a primeira resposta, atualizar first_response_at
    const ticketRepliesCount = await db
      .select({ count: sql`count(*)` })
      .from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, reply.ticket_id));
    
    if (ticketRepliesCount[0]?.count === 1) {
      await this.updateTicket(reply.ticket_id, { first_response_at: reply.created_at }, reply.user_id || undefined);
    }
    
    // IncluÃ­mos dados do usuÃ¡rio
    if (reply.user_id) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, reply.user_id));
      
      return {
        ...reply,
        user: user || undefined
      };
    }
    
    return reply;
  }

  // Helper para histÃ³rico de status
  private async addTicketStatusHistory(
    ticketId: number, 
    oldStatus: string, 
    newStatus: string, 
    changedById?: number
  ): Promise<void> {
    await db.insert(ticketStatusHistory).values({
      ticket_id: ticketId,
      change_type: 'status', // Especificar que Ã© mudanÃ§a de status
      old_status: oldStatus as any,
      new_status: newStatus as any,
      changed_by_id: changedById,
      created_at: new Date()
    });
  }

  // Stats and dashboard operations
  async getTicketStats(): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    try {
      // Total de tickets
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tickets);
      const total = totalResult[0]?.count || 0;

      // Agrupamento por status
      const statusRows = await db
        .select({ status: tickets.status, count: sql<number>`COUNT(*)` })
        .from(tickets)
        .groupBy(tickets.status);
      const byStatus: Record<string, number> = {};
      for (const row of statusRows) {
        byStatus[row.status || 'new'] = Number(row.count);
      }

      // Agrupamento por prioridade (case-insensitive, normalizando)
      const priorityRows = await db
        .select({ priority: tickets.priority, count: sql<number>`COUNT(*)` })
        .from(tickets)
        .groupBy(tickets.priority);
      const byPriority: Record<string, number> = {};
      for (const row of priorityRows) {
        // Normalizar prioridade: primeira letra maiÃºscula, resto minÃºsculo
        const priority = row.priority
          ? row.priority.charAt(0).toUpperCase() + row.priority.slice(1).toLowerCase()
          : 'Medium';
        byPriority[priority] = Number(row.count);
      }

      return {
        total,
        byStatus,
        byPriority,
      };
    } catch (error) {
      console.error('Erro ao obter estatÃ­sticas de tickets:', error);
      return {
        total: 0,
        byStatus: {},
        byPriority: {}
      };
    }
  }
  
  // Obter estatÃ­sticas dos tickets filtrados pelo papel do usuÃ¡rio
  async getTicketStatsByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date, _departmentId?: number): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    try {
      // Montar filtros SQL conforme papel do usuário
      const whereClauses: any[] = [];
      let companyId: number | null;
      if (userRole === 'admin') {
        // Admin vê tudo
      } else if (userRole === 'company_admin') {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user || !user.company_id) return { total: 0, byStatus: {}, byPriority: {} };
        companyId = user.company_id;
        whereClauses.push(eq(tickets.company_id, companyId));
      } else if (userRole === 'customer') {
        const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
        if (!customer) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Cliente pode ver tickets que ele criou OU tickets onde ele foi marcado como participante
        const customerCondition = or(
          eq(tickets.customer_id, customer.id), // Tickets que ele criou
          exists( // Tickets onde ele Ã© participante
            db.select().from(ticketParticipants)
              .where(and(
                eq(ticketParticipants.ticket_id, tickets.id),
                eq(ticketParticipants.user_id, userId)
              ))
          )
        );
        whereClauses.push(customerCondition);
        // Filtrar por empresa SEMPRE para nÃ£o-admins
        if (customer.company_id) {
          whereClauses.push(eq(tickets.company_id, customer.company_id));
        }
      } else if (userRole === 'manager') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        // Filtrar por empresa do atendente
        if (official.company_id) {
          whereClauses.push(eq(tickets.company_id, official.company_id));
        }
        
        // Buscar subordinados
        const subordinates = await db.select().from(officials).where(eq(officials.manager_id, official.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        // Se nÃ£o filtrar por officialId, mostrar tickets do prÃ³prio, subordinados e nÃ£o atribuÃ­dos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else {
          // Se filtrar por officialId, sÃ³ permitir se for subordinado ou ele mesmo
          if (subordinateIds.includes(officialId)) {
            whereClauses.push(eq(tickets.assigned_to_id, officialId));
          } else if (officialId === official.id) {
            whereClauses.push(eq(tickets.assigned_to_id, official.id));
          } else {
            // NÃ£o tem permissÃ£o
            return { total: 0, byStatus: {}, byPriority: {} };
          }
        }
        
        // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
        whereClauses.push(inArray(tickets.department_id, departmentIds));
        
      } else if (userRole === 'supervisor') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        // Filtrar por empresa do atendente
        if (official.company_id) {
          whereClauses.push(eq(tickets.company_id, official.company_id));
        }
        
        // Buscar subordinados
        const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, official.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        // Se nÃ£o filtrar por officialId, mostrar tickets do prÃ³prio, subordinados e nÃ£o atribuÃ­dos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else {
          // Se filtrar por officialId, sÃ³ permitir se for subordinado ou ele mesmo
          if (subordinateIds.includes(officialId)) {
            whereClauses.push(eq(tickets.assigned_to_id, officialId));
          } else if (officialId === official.id) {
            whereClauses.push(eq(tickets.assigned_to_id, official.id));
          } else {
            // NÃ£o tem permissÃ£o
            return { total: 0, byStatus: {}, byPriority: {} };
          }
        }
        
        // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
        whereClauses.push(inArray(tickets.department_id, departmentIds));
        
      } else if (userRole === 'support') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        // Filtrar por empresa do atendente
        if (official.company_id) {
          whereClauses.push(eq(tickets.company_id, official.company_id));
        }
        
        // Support vÃª tickets atribuÃ­dos a ele ou nÃ£o atribuÃ­dos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else if (officialId === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // NÃ£o pode ver de outros
          return { total: 0, byStatus: {}, byPriority: {} };
        }
        
        // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
        whereClauses.push(inArray(tickets.department_id, departmentIds));
      } else if (officialId) {
        whereClauses.push(eq(tickets.assigned_to_id, officialId));
      }
      if (startDate && endDate) {
        whereClauses.push(
          and(
            gte(tickets.created_at, startDate),
            lte(tickets.created_at, endDate)
          )
        );
      }
      // Total de tickets filtrados
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tickets)
        .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
      const total = totalResult[0]?.count || 0;
      // Agrupamento por status
      const statusRows = await db
        .select({ status: tickets.status, count: sql<number>`COUNT(*)` })
        .from(tickets)
        .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
        .groupBy(tickets.status);
      const byStatus: Record<string, number> = {};
      for (const row of statusRows) {
        byStatus[row.status || 'new'] = Number(row.count);
      }
      // Agrupamento por prioridade (case-insensitive, normalizando)
      const priorityRows = await db
        .select({ priority: tickets.priority, count: sql<number>`COUNT(*)` })
        .from(tickets)
        .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
        .groupBy(tickets.priority);
      const byPriority: Record<string, number> = {};
      for (const row of priorityRows) {
        const priority = row.priority
          ? row.priority.charAt(0).toUpperCase() + row.priority.slice(1).toLowerCase()
          : 'Medium';
        byPriority[priority] = Number(row.count);
      }
      return {
        total,
        byStatus,
        byPriority,
      };
    } catch (error) {
      console.error('Erro ao obter estatÃ­sticas de tickets por papel do usuÃ¡rio:', error);
      return {
        total: 0,
        byStatus: {},
        byPriority: {}
      };
    }
  }

  async getRecentTickets(limit: number = 10): Promise<Ticket[]> {
    try {
      const recentTickets = await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.created_at))
        .limit(limit);
      
      const enrichedTickets = await Promise.all(
        recentTickets.map(ticket => this.getTicketInternal(ticket.id)) // Usar mÃ©todo interno
      );
      
      return enrichedTickets.filter(Boolean) as Ticket[];
    } catch (error) {
      console.error('Erro ao obter tickets recentes:', error);
      return [];
    }
  }
  
  // Obter tickets recentes filtrados pelo papel do usuÃ¡rio
  async getRecentTicketsByUserRole(userId: number, userRole: string, limit: number = 10, officialId?: number, startDate?: Date, endDate?: Date, _departmentId?: number): Promise<Ticket[]> {
    try {
      const userTicketsArr = await this.getTicketsByUserRole(userId, userRole);

      let filtered = userTicketsArr;
      // Filtrar por atendente se especificado
      if (officialId) {
        filtered = filtered.filter(ticket => ticket.assigned_to_id === officialId);
      }
      // Filtrar por perÃ­odo se especificado
      if (startDate && endDate) {
        filtered = filtered.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      // Ordenar tickets por data de criaÃ§Ã£o (mais recentes primeiro) e limitar
      return filtered
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Erro ao obter tickets recentes por papel do usuÃ¡rio:', error);
      return [];
    }
  }

  async getAverageFirstResponseTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date, departmentId?: number, incidentTypeId?: number, categoryId?: number): Promise<number> {
    try {
      // Buscar tickets filtrados via SQL (otimizado)
      const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId, categoryId);
      
      // Filtrar tickets que tÃªm created_at e (first_response_at OU resolved_at)
      // Se nÃ£o tem first_response_at mas tem resolved_at, usar resolved_at como primeira resposta
      const ticketsWithFirstResponse = tickets.filter(ticket => 
        ticket.created_at && (ticket.first_response_at || ticket.resolved_at)
      );
      if (ticketsWithFirstResponse.length === 0) {
        return 0;
      }

      // Buscar status history de todos os tickets em uma Ãºnica query (otimizado)
      const ticketIds = ticketsWithFirstResponse.map(t => t.id);
      const allStatusHistory = await db
        .select()
        .from(ticketStatusHistory)
        .where(inArray(ticketStatusHistory.ticket_id, ticketIds))
        .orderBy(asc(ticketStatusHistory.created_at));

      // Agrupar status history por ticket_id
      const statusMap = new Map<number, TicketStatusHistory[]>();
      for (const status of allStatusHistory) {
        if (!statusMap.has(status.ticket_id)) statusMap.set(status.ticket_id, []);
        statusMap.get(status.ticket_id)!.push(status);
      }

      const businessHours = getBusinessHoursConfig();
      
      // Calcular tempo Ãºtil (horÃ¡rio comercial, dias Ãºteis, descontando pausas) para cada ticket
      const totalResponseTime = ticketsWithFirstResponse.map((ticket) => {
        const createdAt = new Date(ticket.created_at);
        // LÃ“GICA CORRETA: Se tem first_response_at, usa ele. Se nÃ£o tem, usa resolved_at
        let firstResponseAt: Date;
        if (ticket.first_response_at) {
          firstResponseAt = new Date(ticket.first_response_at);
        } else {
          firstResponseAt = new Date(ticket.resolved_at!);
        }
        
        // Buscar status history do ticket
        const statusHistory = statusMap.get(ticket.id) || [];
        
        // CORREÃ‡ÃƒO: Para primeira resposta, criar perÃ­odos apenas atÃ© firstResponseAt
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status as TicketStatus, statusHistory);
        
        // Limitar o cÃ¡lculo apenas atÃ© firstResponseAt (nÃ£o atÃ© resolved_at)
        const limitedPeriods = statusPeriods.map(period => ({
          ...period,
          endTime: new Date(Math.min(new Date(period.endTime).getTime(), firstResponseAt.getTime()))
        })).filter(period => new Date(period.startTime) < firstResponseAt);
        
        const effectiveTimeMs = calculateEffectiveBusinessTime(createdAt, firstResponseAt, limitedPeriods, businessHours);
        
        return effectiveTimeMs / (1000 * 60 * 60); // converter para horas
      });

      const soma = totalResponseTime.reduce((a, b) => a + b, 0);
      return Math.round((soma / ticketsWithFirstResponse.length) * 100) / 100;
    } catch (error) {
      console.error('Erro ao calcular tempo mÃ©dio de primeira resposta:', error);
      return 0;
    }
  }

  async getAverageResolutionTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date, departmentId?: number, incidentTypeId?: number, categoryId?: number): Promise<number> {
    try {
      // Buscar tickets filtrados via SQL (otimizado)
      const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId, categoryId);
      
      // Filtrar apenas tickets realmente resolvidos
      const resolvedTickets = tickets.filter(ticket => ticket.status === 'resolved' && ticket.resolved_at && ticket.created_at);
      if (resolvedTickets.length === 0) {
        return 0;
      }

      // Buscar status history de todos os tickets em uma Ãºnica query (otimizado)
      const ticketIds = resolvedTickets.map(t => t.id);
      const allStatusHistory = await db
        .select()
        .from(ticketStatusHistory)
        .where(inArray(ticketStatusHistory.ticket_id, ticketIds))
        .orderBy(asc(ticketStatusHistory.created_at));

      // Agrupar status history por ticket_id
      const statusMap = new Map<number, TicketStatusHistory[]>();
      for (const status of allStatusHistory) {
        if (!statusMap.has(status.ticket_id)) statusMap.set(status.ticket_id, []);
        statusMap.get(status.ticket_id)!.push(status);
      }

      const businessHours = getBusinessHoursConfig();
      
      // Calcular tempo Ãºtil (horÃ¡rio comercial, dias Ãºteis, descontando pausas) para cada ticket
      const times = resolvedTickets.map(ticket => {
        const createdAt = new Date(ticket.created_at);
        const resolvedAt = new Date(ticket.resolved_at!);
        
        // Buscar status history do ticket
        const statusHistory = statusMap.get(ticket.id) || [];
        
        // Definir tipo TicketStatus localmente se necessÃ¡rio
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status as TicketStatus, statusHistory);
        const effectiveTimeMs = calculateEffectiveBusinessTime(createdAt, resolvedAt, statusPeriods, businessHours);
        
        return effectiveTimeMs / (1000 * 60 * 60); // converter para horas
      });

      const total = times.reduce((a, b) => a + b, 0);
      const avg = times.length ? Math.round((total / times.length) * 100) / 100 : 0;
      return avg;
    } catch (error) {
      console.error('Erro ao calcular tempo mÃ©dio de resoluÃ§Ã£o:', error);
      return 0;
    }
  }

  /**
   * Calcula o tempo efetivo excluindo perÃ­odos de suspensÃ£o
   * Baseado na lÃ³gica do SLA calculator
   */
  private calculateEffectiveTime(
    startTime: Date,
    endTime: Date,
    statusHistory: TicketStatusHistory[],
    initialStatus: string
  ): number {
    let totalEffectiveTime = 0;
    let currentPeriodStart = startTime;
    let currentStatus = initialStatus;
    
    // Se nÃ£o hÃ¡ histÃ³rico, considerar perÃ­odo inteiro como ativo
    if (statusHistory.length === 0) {
      return !isSlaPaused(currentStatus as any) ? (endTime.getTime() - startTime.getTime()) : 0;
    }
    
    // Processar cada mudanÃ§a de status
    for (const change of statusHistory) {
      const changeTime = new Date(change.created_at);
      
      // Se o perÃ­odo atual nÃ£o estÃ¡ pausado, contar o tempo
      if (!isSlaPaused(currentStatus as any) && currentPeriodStart < changeTime) {
        const periodEnd = changeTime > endTime ? endTime : changeTime;
        if (currentPeriodStart < periodEnd) {
          totalEffectiveTime += periodEnd.getTime() - currentPeriodStart.getTime();
        }
      }
      
      // Atualizar para o prÃ³ximo perÃ­odo
      currentPeriodStart = changeTime;
      currentStatus = change.new_status || currentStatus;
      
      // Se ultrapassou o tempo final, parar
      if (changeTime >= endTime) {
        break;
      }
    }
    
    // PerÃ­odo final (do Ãºltimo status atÃ© o fim)
    if (currentPeriodStart < endTime && !isSlaPaused(currentStatus as any)) {
      totalEffectiveTime += endTime.getTime() - currentPeriodStart.getTime();
    }
    
    return totalEffectiveTime;
  }

  // Categories operations
  async getCategories(filters: any = {}, page: number = 1, limit: number = 50): Promise<{ categories: Category[], total: number }> {
    try {
      const whereConditions: any[] = [];
      if (filters.incident_type_id) {
        whereConditions.push(eq(categories.incident_type_id, filters.incident_type_id));
      }
      if (filters.company_id) {
        whereConditions.push(eq(categories.company_id, filters.company_id));
      }
      if (filters.is_active !== undefined) {
        whereConditions.push(eq(categories.is_active, filters.is_active));
      }
      if (filters.search) {
        whereConditions.push(
          or(
            ilike(categories.name, `%${filters.search}%`),
            ilike(categories.description, `%${filters.search}%`)
          )
        );
      }
      // Query principal
      const queryBuilder = db.select().from(categories);
      const query = whereConditions.length > 0 ? queryBuilder.where(and(...whereConditions)) : queryBuilder;
      // Contar total de registros
      const countQueryBuilder = db.select({ count: sql<number>`count(*)` }).from(categories);
      const countQuery = whereConditions.length > 0 ? countQueryBuilder.where(and(...whereConditions)) : countQueryBuilder;
      const [{ count: total }] = await countQuery;
      // Aplicar paginaÃ§Ã£o e ordenaÃ§Ã£o
      const categoriesData = await query
        .orderBy(categories.name)
        .limit(limit)
        .offset((page - 1) * limit);

      // Enriquecer com dados relacionados
      const enrichedCategories = await Promise.all(
        categoriesData.map(async (category) => {
          let incidentType: Partial<IncidentType> | undefined = undefined;
          let company: Partial<{ id: number; name: string; email: string; domain: string | null; active: boolean; created_at: Date; updated_at: Date; cnpj: string | null; phone: string | null; ai_permission: boolean; uses_flexible_sla: boolean; }> | undefined = undefined;

          if (category.incident_type_id) {
            const [incident] = await db
              .select()
              .from(incidentTypes)
              .where(eq(incidentTypes.id, category.incident_type_id));
            incidentType = incident || undefined;
          }

          if (category.company_id) {
            const [comp] = await db
              .select()
              .from(companies)
              .where(eq(companies.id, category.company_id));
            company = comp ? ({ ...comp } as Partial<{ id: number; name: string; email: string; domain: string | null; active: boolean; created_at: Date; updated_at: Date; cnpj: string | null; phone: string | null; ai_permission: boolean; uses_flexible_sla: boolean; }>) : undefined;
          }

          return {
            ...category,
            incident_type: incidentType,
            company: company
          };
        })
      );

      return {
        categories: enrichedCategories,
        total: Number(total)
      };
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      throw error;
    }
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    try {
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id));

      if (!category) {
        return undefined;
      }

      // Enriquecer com dados relacionados
      let incidentType: Partial<IncidentType> | undefined = undefined;
      let company: Partial<{ id: number; name: string; email: string; domain: string | null; active: boolean; created_at: Date; updated_at: Date; cnpj: string | null; phone: string | null; ai_permission: boolean; uses_flexible_sla: boolean; }> | undefined = undefined;

      if (category.incident_type_id) {
        const [incident] = await db
          .select()
          .from(incidentTypes)
          .where(eq(incidentTypes.id, category.incident_type_id));
        incidentType = incident || undefined;
      }

      if (category.company_id) {
        const [comp] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, category.company_id));
        company = comp ? ({ ...comp } as Partial<{ id: number; name: string; email: string; domain: string | null; active: boolean; created_at: Date; updated_at: Date; cnpj: string | null; phone: string | null; ai_permission: boolean; uses_flexible_sla: boolean; }>) : undefined;
      }

      return {
        ...category,
        incident_type: incidentType,
        company: company
      };
    } catch (error) {
      console.error('Erro ao buscar categoria por ID:', error);
      throw error;
    }
  }

  async getCategoryByValue(value: string, incidentTypeId: number, companyId: number): Promise<Category | undefined> {
    try {
      const [category] = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.name, value), // garantir que o campo existe
            eq(categories.incident_type_id, incidentTypeId),
            eq(categories.company_id, companyId)
          )
        );

      return category || undefined;
    } catch (error) {
      console.error('Erro ao buscar categoria por value:', error);
      throw error;
    }
  }

  async createCategory(categoryData: any): Promise<Category> {
    try {
      const [category] = await db
        .insert(categories)
        .values({
          name: categoryData.name,
          description: categoryData.description || null,
          incident_type_id: categoryData.incident_type_id,
          company_id: categoryData.company_id,
          is_active: categoryData.is_active !== false,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      return category;
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      throw error;
    }
  }

  async updateCategory(id: number, categoryData: any): Promise<Category | undefined> {
    try {
      const updateData: any = {
        updated_at: new Date()
      };

      if (categoryData.name !== undefined) updateData.name = categoryData.name;
      if (categoryData.value !== undefined) updateData.value = categoryData.value;
      if (categoryData.description !== undefined) updateData.description = categoryData.description;
      if (categoryData.is_active !== undefined) updateData.is_active = categoryData.is_active;

      const [category] = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning();

      return category || undefined;
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      throw error;
    }
  }

  async getTicketsByCategory(categoryId: number): Promise<Ticket[]> {
    try {
      // Buscar tickets que usam esta categoria
      const ticketsData = await db
        .select()
        .from(tickets)
        .where(eq(tickets.category_id, categoryId));

      // Enriquecer com customer
      const enriched = await Promise.all(
        ticketsData.map(async (ticket) => {
          let customerData = {};
          if (ticket.customer_id) {
            [customerData] = await db.select().from(customers).where(eq(customers.id, ticket.customer_id));
          }
          return {
            ...ticket,
            customer: customerData || {}
          };
        })
      );
      return enriched as Ticket[];
    } catch (error) {
      console.error('Erro ao buscar tickets por categoria:', error);
      return [];
    }
  }

  /**
   * Busca otimizada para dashboards de performance: retorna apenas os campos essenciais,
   * aplica todos os filtros no SQL e nÃ£o faz enrichments.
   * NÃƒO IMPACTA OUTRAS TELAS.
   */
  async getTicketsForDashboardByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date, departmentId?: number, incidentTypeId?: number, categoryId?: number): Promise<{
    id: number;
    title: string;
    created_at: Date;
    first_response_at: Date | null;
    resolved_at: Date | null;
    status: string;
    assigned_to_id: number | null;
    company_id: number | null;
    department_id: number | null;
    priority: string | null;
  }[]> {
    // Montar filtros SQL conforme papel do usuário
    const whereClauses: any[] = [];
    let companyId: number | null;
    if (userRole === 'admin') {
      // Admin vê tudo
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.company_id) return [];
      companyId = user.company_id;
      whereClauses.push(eq(tickets.company_id, companyId));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
      if (!customer) return [];
      
      // Cliente pode ver tickets que ele criou OU tickets onde ele foi marcado como participante
      const customerCondition = or(
        eq(tickets.customer_id, customer.id), // Tickets que ele criou
        exists( // Tickets onde ele Ã© participante
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, tickets.id),
              eq(ticketParticipants.user_id, userId)
            ))
        )
      );
      whereClauses.push(customerCondition);
      // Filtrar por empresa SEMPRE para nÃ£o-admins
      if (customer.company_id) {
        whereClauses.push(eq(tickets.company_id, customer.company_id));
      }
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      // Buscar subordinados
      const subordinates = await db.select().from(officials).where(eq(officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      if (!officialId) {
        const assignmentFilter = or(
          eq(tickets.assigned_to_id, official.id),
          subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
          isNull(tickets.assigned_to_id)
        );
        whereClauses.push(assignmentFilter);
      } else {
        if (subordinateIds.includes(officialId)) {
          whereClauses.push(eq(tickets.assigned_to_id, officialId));
        } else if (officialId === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // NÃ£o tem permissÃ£o
          return [];
        }
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      // Buscar subordinados
      const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      if (!officialId) {
        const assignmentFilter = or(
          eq(tickets.assigned_to_id, official.id),
          subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
          isNull(tickets.assigned_to_id)
        );
        whereClauses.push(assignmentFilter);
      } else {
        if (subordinateIds.includes(officialId)) {
          whereClauses.push(eq(tickets.assigned_to_id, officialId));
        } else if (officialId === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // NÃ£o tem permissÃ£o
          return [];
        }
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      // Filtrar por empresa do atendente
      if (official.company_id) {
        whereClauses.push(eq(tickets.company_id, official.company_id));
      }
      
      if (!officialId) {
        const assignmentFilter = or(
          eq(tickets.assigned_to_id, official.id),
          isNull(tickets.assigned_to_id)
        );
        whereClauses.push(assignmentFilter);
      } else if (officialId === official.id) {
        whereClauses.push(eq(tickets.assigned_to_id, official.id));
      } else {
        return { 
          data: [] as Ticket[], 
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false } 
        } as any;
      }
      
      // FILTRO OBRIGATÃ“RIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
    }
    
    // APLICAR FILTRO DE ATENDENTE SE ESPECIFICADO (para todas as roles)
    if (officialId) {
      whereClauses.push(eq(tickets.assigned_to_id, officialId));
    }
    if (startDate && endDate) {
      whereClauses.push(
        and(
          gte(tickets.created_at, startDate),
          lte(tickets.created_at, endDate)
        )
      );
    }
    
    // APLICAR FILTRO DE DEPARTAMENTO SE ESPECIFICADO (adicional aos filtros por role)
    if (departmentId) {
      whereClauses.push(eq(tickets.department_id, _departmentId));
    }
    if (incidentTypeId) {
      whereClauses.push(eq(tickets.incident_type_id, incidentTypeId));
    }
    if (categoryId) {
      whereClauses.push(eq(tickets.category_id, categoryId));
    }
    
    // Buscar apenas os campos essenciais
    const result = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        created_at: tickets.created_at,
        first_response_at: tickets.first_response_at,
        resolved_at: tickets.resolved_at,
        status: tickets.status,
        assigned_to_id: tickets.assigned_to_id,
        company_id: tickets.company_id,
        department_id: tickets.department_id,
        priority: tickets.priority
      })
      .from(tickets)
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
    return result;
  }

  /**
   * Retorna estatÃ­sticas de tickets para o dashboard (total, byStatus, byPriority),
   * aplicando filtros no SQL e sem enrichments.
   */
  async getTicketStatsForDashboardByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date, departmentId?: number, incidentTypeId?: number, categoryId?: number): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId, categoryId);
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    tickets.forEach(ticket => {
      const status = ticket.status || 'new';
      byStatus[status] = (byStatus[status] || 0) + 1;
      const priority = ticket.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });
    return {
      total: tickets.length,
      byStatus,
      byPriority
    };
  }

  /**
   * Retorna tickets recentes para o dashboard, apenas campos essenciais, sem enrichments.
   */
  async getRecentTicketsForDashboardByUserRole(userId: number, userRole: string, limit: number = 10, officialId?: number, startDate?: Date, endDate?: Date, departmentId?: number, incidentTypeId?: number, categoryId?: number): Promise<Array<{ id: number; title: string; status: string; priority: string | null; created_at: Date; company_id: number | null; assigned_to_id: number | null; department_id: number | null; }>> {
    // Reaproveita a query otimizada, mas sÃ³ pega os campos necessÃ¡rios
    const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate, departmentId, incidentTypeId, categoryId);
    return tickets
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(ticket => ({
        id: ticket.id,
        title: ticket.title || '',
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        company_id: ticket.company_id,
        assigned_to_id: ticket.assigned_to_id,
        department_id: ticket.department_id
      }));
  }

  /**
   * Retorna lista de officials para o dashboard, apenas campos essenciais, sem enrichments.
   */
  async getOfficialsForDashboard(companyId?: number, onlyActive: boolean = true): Promise<Array<{ id: number; name: string; email: string; is_active: boolean; company_id: number | null; supervisor_id: number | null; manager_id: number | null; department_id: number | null; }>> {
    const whereClauses: any[] = [];
    if (companyId) {
      whereClauses.push(eq(officials.company_id, companyId));
    }
    if (onlyActive) {
      whereClauses.push(eq(officials.is_active, true));
    }
    const result = await db
      .select({
        id: officials.id,
        name: officials.name,
        email: officials.email,
        is_active: officials.is_active,
        company_id: officials.company_id,
        supervisor_id: officials.supervisor_id,
        manager_id: officials.manager_id,
        department_id: officials.department_id,
        // role removido pois nÃ£o existe na tabela
      })
      .from(officials)
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
    return result;
  }

  // === MÃ‰TODOS DE PARTICIPANTES DE TICKETS ===

  /**
   * Adiciona um participante a um ticket
   */
  async addTicketParticipant(ticketId: number, userId: number, addedById: number): Promise<TicketParticipant> {
    // Verificar se o participante jÃ¡ existe
    const existingParticipant = await this.isUserTicketParticipant(ticketId, userId);
    if (existingParticipant) {
      throw new Error('UsuÃ¡rio jÃ¡ Ã© participante deste ticket');
    }

    const [participant] = await db
      .insert(ticketParticipants)
      .values({
        ticket_id: ticketId,
        user_id: userId,
        added_by_id: addedById,
        added_at: new Date()
      })
      .returning();

    if (!participant) {
      throw new Error('Falha ao adicionar participante');
    }

    return participant;
  }

  /**
   * Remove um participante de um ticket
   */
  async removeTicketParticipant(ticketId: number, userId: number): Promise<boolean> {
    const _result = await db
      .delete(ticketParticipants)
      .where(
        and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(ticketParticipants.user_id, userId)
        )
      );

    return true;
  }

  /**
   * ObtÃ©m todos os participantes de um ticket
   */
  async getTicketParticipants(ticketId: number): Promise<TicketParticipant[]> {
    const participants = await db
      .select()
      .from(ticketParticipants)
      .where(eq(ticketParticipants.ticket_id, ticketId))
      .orderBy(asc(ticketParticipants.added_at));

    // Enriquecer com dados dos usuÃ¡rios
    const enrichedParticipants: TicketParticipant[] = [];
    
    for (const participant of participants) {
      const user = participant.user_id ? await this.getUser(participant.user_id) : undefined;
      const addedBy = participant.added_by_id ? await this.getUser(participant.added_by_id) : undefined;
      
      enrichedParticipants.push({
        ...participant,
        user: user ? {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar_url: user.avatar_url,
          active: user.active
        } : undefined,
        added_by: addedBy ? {
          id: addedBy.id,
          username: addedBy.username,
          email: addedBy.email,
          name: addedBy.name,
          role: addedBy.role,
          avatar_url: addedBy.avatar_url,
          active: addedBy.active
        } : undefined
      });
    }

    return enrichedParticipants;
  }

  /**
   * Verifica se um usuÃ¡rio Ã© participante de um ticket
   */
  async isUserTicketParticipant(ticketId: number, userId: number): Promise<boolean> {
    // ðŸ”¥ OTIMIZAÃ‡ÃƒO: Buscar apenas o ID para verificar existÃªncia (mais eficiente)
    const [participant] = await db
      .select({ id: ticketParticipants.id })
      .from(ticketParticipants)
      .where(
        and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(ticketParticipants.user_id, userId)
        )
      )
      .limit(1);

    return !!participant;
  }

  /**
   * ObtÃ©m o histÃ³rico de participantes de um ticket
   */
  async getTicketParticipantsHistory(ticketId: number): Promise<any[]> {
    try {
      // Por enquanto, retornar apenas os participantes atuais como histÃ³rico
      // Em uma implementaÃ§Ã£o futura, isso pode ser expandido para incluir
      // um log de adiÃ§Ãµes/remoÃ§Ãµes de participantes
      const participants = await this.getTicketParticipants(ticketId);
      
      return participants.map(p => ({
        id: p.id,
        ticket_id: p.ticket_id,
        user_id: p.user_id,
        action: 'added' as const,
        performed_by_id: p.added_by_id,
        performed_at: p.added_at,
        user: p.user,
        performed_by: p.added_by
      }));
    } catch (error) {
      console.error('Erro ao buscar histórico de participantes:', error);
      throw new Error('Falha ao buscar histórico de participantes', { cause: error });
    }
  }

  // ========================================
  // MÃ‰TODOS PARA PRESTADORES DE SERVIÃ‡OS
  // ========================================

  /**
   * ObtÃ©m prestadores de serviÃ§os com filtros opcionais
   */
  async getServiceProviders(filters?: {
    companyId?: number;
    isActive?: boolean;
    isExternal?: boolean;
    departmentId?: number;
  }): Promise<ServiceProvider[]> {
    let query = db.select().from(serviceProviders);

    const conditions = [];
    
    if (filters?.companyId !== undefined) {
      conditions.push(eq(serviceProviders.company_id, filters.companyId));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(serviceProviders.is_active, filters.isActive));
    }
    
    if (filters?.isExternal !== undefined) {
      conditions.push(eq(serviceProviders.is_external, filters.isExternal));
    }

    if (filters?.departmentId) {
      // Se filtro por departamento, fazer join com department_service_providers
      query = db
        .select({
          id: serviceProviders.id,
          name: serviceProviders.name,
          is_external: serviceProviders.is_external,
          company_id: serviceProviders.company_id,
          company_name: serviceProviders.company_name,
          cnpj: serviceProviders.cnpj,
          address: serviceProviders.address,
          phone: serviceProviders.phone,
          email: serviceProviders.email,
          notes: serviceProviders.notes,
          is_active: serviceProviders.is_active,
          created_at: serviceProviders.created_at,
          updated_at: serviceProviders.updated_at,
        })
        .from(serviceProviders)
        .innerJoin(
          departmentServiceProviders,
          eq(serviceProviders.id, departmentServiceProviders.service_provider_id)
        )
        .where(and(
          eq(departmentServiceProviders.department_id, filters.departmentId),
          ...conditions
        ));
    } else if (conditions.length > 0) {
      query = db.select().from(serviceProviders).where(and(...conditions));
    }

    return await query;
  }

  /**
   * ObtÃ©m um prestador de serviÃ§o por ID
   */
  async getServiceProvider(id: number): Promise<ServiceProvider | undefined> {
    const [provider] = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.id, id))
      .limit(1);
    
    return provider || undefined;
  }

  /**
   * Cria um novo prestador de serviÃ§o
   */
  async createServiceProvider(data: {
    name: string;
    is_external: boolean;
    company_id?: number | null;
    company_name?: string | null;
    cnpj?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }): Promise<ServiceProvider> {
    const [provider] = await db
      .insert(serviceProviders)
      .values({
        ...data,
        is_active: data.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();
    
    return provider;
  }

  /**
   * Atualiza um prestador de serviÃ§o
   */
  async updateServiceProvider(id: number, data: Partial<{
    name: string;
    is_external: boolean;
    company_id: number | null;
    company_name: string | null;
    cnpj: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    is_active: boolean;
  }>): Promise<ServiceProvider> {
    const [provider] = await db
      .update(serviceProviders)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(serviceProviders.id, id))
      .returning();
    
    if (!provider) {
      throw new Error('Prestador de serviÃ§o nÃ£o encontrado');
    }
    
    return provider;
  }

  /**
   * Desativa um prestador de serviÃ§o (soft delete)
   */
  async deleteServiceProvider(id: number): Promise<boolean> {
    await db
      .update(serviceProviders)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(serviceProviders.id, id));
    
    return true;
  }

  /**
   * ObtÃ©m prestadores vinculados a um departamento
   */
  async getDepartmentServiceProviders(_departmentId: number): Promise<ServiceProvider[]> {
    const providers = await db
      .select({
        id: serviceProviders.id,
        name: serviceProviders.name,
        is_external: serviceProviders.is_external,
        company_id: serviceProviders.company_id,
        company_name: serviceProviders.company_name,
        cnpj: serviceProviders.cnpj,
        address: serviceProviders.address,
        phone: serviceProviders.phone,
        email: serviceProviders.email,
        notes: serviceProviders.notes,
        is_active: serviceProviders.is_active,
        created_at: serviceProviders.created_at,
        updated_at: serviceProviders.updated_at,
      })
      .from(serviceProviders)
      .innerJoin(
        departmentServiceProviders,
        eq(serviceProviders.id, departmentServiceProviders.service_provider_id)
      )
      .where(eq(departmentServiceProviders.department_id, _departmentId));
    
    return providers;
  }

  /**
   * Vincula um prestador a um departamento
   */
  async addDepartmentServiceProvider(departmentId: number, providerId: number): Promise<boolean> {
    try {
      await db
        .insert(departmentServiceProviders)
        .values({
          department_id: departmentId,
          service_provider_id: providerId,
          created_at: new Date(),
        });
      
      return true;
    } catch (error: any) {
      // Se jÃ¡ existe, retornar true sem erro
      if (error?.code === '23505') { // Unique violation
        return true;
      }
      throw error;
    }
  }

  /**
   * Remove vinculaÃ§Ã£o de prestador a um departamento
   */
  async removeDepartmentServiceProvider(departmentId: number, providerId: number): Promise<boolean> {
    await db
      .delete(departmentServiceProviders)
      .where(
        and(
          eq(departmentServiceProviders.department_id, _departmentId),
          eq(departmentServiceProviders.service_provider_id, providerId)
        )
      );
    
    return true;
  }

  /**
   * ObtÃ©m prestadores vinculados a um ticket
   */
  async getTicketServiceProviders(ticketId: number): Promise<Array<ServiceProvider & { added_by_id?: number | null; added_at?: Date }>> {
    const providers = await db
      .select({
        id: serviceProviders.id,
        name: serviceProviders.name,
        is_external: serviceProviders.is_external,
        company_id: serviceProviders.company_id,
        company_name: serviceProviders.company_name,
        cnpj: serviceProviders.cnpj,
        address: serviceProviders.address,
        phone: serviceProviders.phone,
        email: serviceProviders.email,
        notes: serviceProviders.notes,
        is_active: serviceProviders.is_active,
        created_at: serviceProviders.created_at,
        updated_at: serviceProviders.updated_at,
        added_by_id: ticketServiceProviders.added_by_id,
        added_at: ticketServiceProviders.added_at,
      })
      .from(serviceProviders)
      .innerJoin(
        ticketServiceProviders,
        eq(serviceProviders.id, ticketServiceProviders.service_provider_id)
      )
      .where(eq(ticketServiceProviders.ticket_id, ticketId))
      .orderBy(asc(ticketServiceProviders.added_at));
    
    return providers;
  }

  /**
   * Vincula um prestador a um ticket
   */
  async addTicketServiceProvider(ticketId: number, providerId: number, userId: number): Promise<boolean> {
    try {
      await db
        .insert(ticketServiceProviders)
        .values({
          ticket_id: ticketId,
          service_provider_id: providerId,
          added_by_id: userId,
          added_at: new Date(),
        });
      
      return true;
    } catch (error: any) {
      // Se jÃ¡ existe, retornar true sem erro
      if (error?.code === '23505') { // Unique violation
        return true;
      }
      throw error;
    }
  }

  /**
   * Remove vinculaÃ§Ã£o de prestador a um ticket
   */
  async removeTicketServiceProvider(ticketId: number, providerId: number): Promise<boolean> {
    await db
      .delete(ticketServiceProviders)
      .where(
        and(
          eq(ticketServiceProviders.ticket_id, ticketId),
          eq(ticketServiceProviders.service_provider_id, providerId)
        )
      );
    
    return true;
  }

}

