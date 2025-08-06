import { 
  users, customers, officials, tickets, ticketReplies, ticketStatusHistory, slaDefinitions, 
  type User, type InsertUser, 
  type Customer, type InsertCustomer, 
  type Official, type InsertOfficial,
  type Ticket, type InsertTicket,
  type TicketReply, type InsertTicketReply,
  type TicketStatusHistory,
  type SLADefinition,
  officialDepartments, type OfficialDepartment, type InsertOfficialDepartment,
  ticketStatusEnum,
  userRoleEnum,
  systemSettings, type SystemSetting,
  incidentTypes, type IncidentType,
  categories, type Category,
  companies, departments,
  ticketParticipants, type TicketParticipant,
  type InsertTicketParticipant
} from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns, isNotNull, isNull, ilike, asc, gte, lte, ne, exists } from "drizzle-orm";
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
      console.log('DatabaseStorage.createUser - Iniciando criação com dados:', JSON.stringify(userData, null, 2));
      
      // Verificar campos obrigatórios
      if (!userData.username) {
        throw new Error('Nome de usuário é obrigatório');
      }
      if (!userData.email) {
        throw new Error('Email é obrigatório');
      }
      if (!userData.password) {
        throw new Error('Senha é obrigatória');
      }
      
      // Garantir que isActive tem um valor padrão verdadeiro
      const dataWithDefaults = {
        ...userData,
        active: userData.active !== false, // default para true
        avatar_url: userData.avatar_url || null,
        must_change_password: userData.must_change_password || false
      };
      
      console.log('DatabaseStorage.createUser - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
      const [user] = await db.insert(users).values(dataWithDefaults).returning();
      
      if (!user) {
        throw new Error('Falha ao criar usuário - nenhum registro retornado');
      }
      
      console.log('DatabaseStorage.createUser - Usuário criado com sucesso:', JSON.stringify(user, null, 2));
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
  async getCompany(id: number): Promise<{id: number, name: string} | undefined> {
    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name
      })
      .from(companies)
      .where(eq(companies.id, id));
    return company || undefined;
  }
  
  // Customer operations
  async getCustomers(): Promise<Customer[]> {
    // Busca clientes já com nome da empresa e status do usuário associado, eliminando N+1 queries
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
        user_active: users.active, // status do usuário (auxiliar)
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
    // 1ª Query: Busca oficiais, dados do usuário, empresa e contagem de tickets em uma query agregada
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

    // 2ª Query: Busca todos os departamentos de todos os oficiais de uma vez
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

    // Monta um mapa de id para dados do official (para lookup rápido do manager)
    const officialIdMap = new Map<number, { id: number, name: string, email: string }>();
    for (const row of officialsWithUserAndTicketCount) {
      officialIdMap.set(row.id, { id: row.id, name: row.name, email: row.email });
    }

    // Monta o array final de oficiais, agregando departamentos, dados do usuário, empresa e manager
    const officialsResult: Official[] = officialsWithUserAndTicketCount.map((row) => {
      let manager = null;
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

    // // melhoria de performance: eliminadas N+1 queries usando JOINs e agregação
    // // agora apenas 2 queries fixas, independente do número de oficiais
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
      console.log('DatabaseStorage.createOfficial - Iniciando criação com dados:', JSON.stringify(officialData, null, 2));
      
      // Verificar campos obrigatórios
      if (!officialData.email) {
        throw new Error('Email do atendente é obrigatório');
      }
      if (!officialData.name) {
        throw new Error('Nome do atendente é obrigatório');
      }
      
      // Garantir que isActive tem um valor padrão verdadeiro
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
  
  // Operações de departamentos dos oficiais
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
    // Buscar o department_id pelo nome
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, departmentName));
    
    if (!dept) {
      console.warn(`Departamento não encontrado: ${departmentName}`);
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
      console.warn(`Departamento não encontrado: ${departmentName}`);
      return [];
    }
    
    const departmentOfficials = await db
      .select()
      .from(officialDepartments)
      .innerJoin(officials, eq(officialDepartments.official_id, officials.id))
      .where(eq(officialDepartments.department_id, dept.id));
    
    return departmentOfficials.map(row => row.officials);
  }
  
  // Filtrar tickets baseado no perfil do usuário
  // Método paginado principal
  async getTicketsByUserRolePaginated(
    userId: number,
    userRole: string,
    filters: {
      search?: string;
      status?: string;
      priority?: string;
      department_id?: number;
      assigned_to_id?: number;
      unassigned?: boolean;
      hide_resolved?: boolean;
      time_filter?: string;
      date_from?: string;
      date_to?: string;
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Ticket[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }> {
    // Montar filtros SQL conforme papel do usuário (MESMA LÓGICA DO DASHBOARD)
    let whereClauses: any[] = [];
    let companyId: number | null = null;
    
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
        exists( // Tickets onde ele é participante
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, tickets.id),
              eq(ticketParticipants.user_id, userId)
            ))
        )
      );
      whereClauses.push(customerCondition);
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      
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
          // Não tem permissão
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
        }
      }
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      
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
          // Não tem permissão
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
        }
      }
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      const departmentIds = officialDepts.map(od => od.department_id);
      
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
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
    }

    // Aplicar filtros adicionais
    if (filters.status && filters.status !== 'all') {
        whereClauses.push(eq(tickets.status, filters.status as any));
    }
    if (filters.priority && filters.priority !== 'all') {
      whereClauses.push(eq(tickets.priority, filters.priority));
    }
    if (filters.department_id && filters.department_id !== 'all') {
      whereClauses.push(eq(tickets.department_id, filters.department_id));
    }
    if (filters.assigned_to_id && filters.assigned_to_id !== 'all') {
      if (filters.assigned_to_id === 'unassigned') {
      whereClauses.push(isNull(tickets.assigned_to_id));
      } else {
        whereClauses.push(eq(tickets.assigned_to_id, Number(filters.assigned_to_id)));
      }
    }
    if (filters.hide_resolved) {
      whereClauses.push(ne(tickets.status, 'resolved'));
    }
    // USAR MESMA LÓGICA DO DASHBOARD - start_date e end_date têm prioridade
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
      // Usar a mesma lógica do dashboard para calcular datas
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
        // Primeiro dia do mês atual
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        
        // Último dia do mês atual
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        
        whereClauses.push(gte(tickets.created_at, startDate));
        whereClauses.push(lte(tickets.created_at, endDate));
      }
    }
    // Filtro de busca textual livre (em múltiplos campos)
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
    let query = db
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
    let total = 0;
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
        if (ticket.customer_id) { // Verificar se customer_id não é null
          [customerData] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, ticket.customer_id)); // Agora seguro
        }
        
        let officialData: Official | undefined = undefined;
        if (ticket.assigned_to_id) { // Verificar se assigned_to_id não é null
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
        
        const replies = await this.getTicketReplies(ticket.id); // Assumindo que ticket.id é sempre number
        
        return {
          ...ticket,
          customer: customerData || {}, // Retorna objeto vazio se customerData for nulo/undefined
          official: officialData, 
          replies: replies || []
        };
      })
    );
    
    // Cast explícito para Ticket[] para resolver a incompatibilidade estrutural percebida pelo TS
    return enrichedTickets as Ticket[];
  }

  async getTicket(id: number, userRole?: string, userCompanyId?: number): Promise<Ticket | undefined> {
    const ticket = await this.getTicketInternal(id);
    if (!ticket) return undefined;

    // Verificar permissões de acesso apenas para usuários não-admin
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
    
    // Chamada interna - não precisa de controle de acesso de empresa
    return this.getTicketInternal(result.ticket.id);
  }

  // Método interno sem controle de empresa para uso em outras funções
  private async getTicketInternal(id: number): Promise<Ticket | undefined> {
    // 🔥 OTIMIZAÇÃO CRÍTICA: Buscar tudo em uma única query com JOINs
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
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customer_id))
      .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
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
      departments: [], // Não buscar departamentos aqui para não atrasar - só se realmente precisar
    } : undefined;

    // 🔥 OTIMIZAÇÃO: NÃO buscar replies automaticamente - só quando realmente precisar
    // Isso evita uma query pesada desnecessária na maioria dos casos
    const replies: TicketReply[] = [];
    
    return {
      ...ticket,
      customer: customerData || {},
      official: officialData, 
      replies: replies
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
        status: ticketStatusEnum.enumValues[0], // Definir status inicial explicitamente se necessário
        priority: ticketData.priority || null, // Não definir prioridade padrão - deixar a IA definir
        // Garantir que department_id, incident_type_id, customer_id e company_id são números ou null
        department_id: ticketData.department_id ? Number(ticketData.department_id) : null,
        incident_type_id: ticketData.incident_type_id ? Number(ticketData.incident_type_id) : null,
        customer_id: ticketData.customer_id ? Number(ticketData.customer_id) : null,
        company_id: ticketData.company_id ? Number(ticketData.company_id) : null, // ✅ Incluir company_id
      };

  

      // @ts-ignore - Ignorar erro de tipo temporariamente se status não bater exatamente
      const [insertedTicket] = await db.insert(tickets).values(ticketInsertData).returning();
      return this.getTicketInternal(insertedTicket.id) as Promise<Ticket>; // Usar método interno
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>, changedById?: number): Promise<Ticket | undefined> {

    
    // Se estamos atualizando o status, primeiro adicionamos ao histórico
    if (ticketData.status) {
      const [currentTicket] = await db.select().from(tickets).where(eq(tickets.id, id));
      
      
      if (currentTicket && currentTicket.status !== ticketData.status) {
        await this.addTicketStatusHistory(
          id,
          currentTicket.status,
          ticketData.status,
          changedById
        );
        
        // 🔥 CRÍTICO: Qualquer mudança de status DEVE PARAR o timer de primeira resposta
        // Se o status está mudando de "new" para qualquer outro E ainda não há first_response_at
        if (currentTicket.status === 'new' && !currentTicket.first_response_at) {
          console.log(`[SLA] ⏰ STATUS ALTERADO: Definindo first_response_at para ticket ${id} (${currentTicket.status} → ${ticketData.status})`);
          ticketData.first_response_at = new Date();
        }
        
        // Se o status está sendo alterado para 'resolved', marcamos a data de resolução
        if (ticketData.status === 'resolved' && currentTicket.status !== 'resolved') {
          console.log(`[SLA] ✅ TICKET RESOLVIDO: Definindo resolved_at para ticket ${id}`);
          ticketData.resolved_at = new Date();
        }
      }
    }
    
    if (ticketData.assigned_to_id !== undefined) {

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
      
      const updatedTicket = await this.getTicketInternal(ticket.id); // Usar método interno

      return updatedTicket;
    } catch (error) {
      console.error(`[ERROR] Erro ao atualizar ticket ${id}:`, error);
      throw error;
    }
  }

  async deleteTicket(id: number): Promise<boolean> {
    // Primeiro removemos as dependências (respostas e histórico)
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
    
    // Enriquecer com dados do usuário
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

    
    // 🎯 SEPARAR campos da REPLY dos campos do TICKET
    const { status, assigned_to_id, type, ...replyOnlyData } = replyData;
    

    
    // ✅ INSERIR APENAS OS CAMPOS QUE PERTENCEM À TABELA ticket_replies
    const [reply] = await db.insert(ticketReplies).values(replyOnlyData).returning();
    

    
    // Atualizações do ticket a serem feitas
    const ticketUpdates: Partial<Ticket> = {};
    
    // Se estamos atualizando o status do ticket junto com a resposta
    if (status) {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, reply.ticket_id));
      
      if (ticket && ticket.status !== status) {
        ticketUpdates.status = status;
        
        // Se o status estiver sendo alterado para 'resolved', marcamos a data de resolução
        if (status === 'resolved') {
          ticketUpdates.resolved_at = new Date();
        }
      }
    }
    
    // Se estamos atribuindo o ticket a um atendente
    if (assigned_to_id) {
      ticketUpdates.assigned_to_id = assigned_to_id;
    }
    
    // ✅ APLICAR AS ATUALIZAÇÕES PASSANDO O USER_ID PARA O HISTÓRICO
    if (Object.keys(ticketUpdates).length > 0) {
      await this.updateTicket(reply.ticket_id, ticketUpdates, reply.user_id || undefined);
    }
    
    // Se esta é a primeira resposta, atualizar first_response_at
    const ticketRepliesCount = await db
      .select({ count: sql`count(*)` })
      .from(ticketReplies)
      .where(eq(ticketReplies.ticket_id, reply.ticket_id));
    
    if (ticketRepliesCount[0]?.count === 1) {
      await this.updateTicket(reply.ticket_id, { first_response_at: reply.created_at }, reply.user_id || undefined);
    }
    
    // Incluímos dados do usuário
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

  // Helper para histórico de status
  private async addTicketStatusHistory(
    ticketId: number, 
    oldStatus: string, 
    newStatus: string, 
    changedById?: number
  ): Promise<void> {
    await db.insert(ticketStatusHistory).values({
      ticket_id: ticketId,
      change_type: 'status', // Especificar que é mudança de status
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
        // Normalizar prioridade: primeira letra maiúscula, resto minúsculo
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
      console.error('Erro ao obter estatísticas de tickets:', error);
      return {
        total: 0,
        byStatus: {},
        byPriority: {}
      };
    }
  }
  
  // Obter estatísticas dos tickets filtrados pelo papel do usuário
  async getTicketStatsByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    try {
      // Montar filtros SQL conforme papel do usuário
      let whereClauses: any[] = [];
      let companyId: number | null = null;
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
          exists( // Tickets onde ele é participante
            db.select().from(ticketParticipants)
              .where(and(
                eq(ticketParticipants.ticket_id, tickets.id),
                eq(ticketParticipants.user_id, userId)
              ))
          )
        );
        whereClauses.push(customerCondition);
      } else if (userRole === 'manager') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        
        // Buscar subordinados
        const subordinates = await db.select().from(officials).where(eq(officials.manager_id, official.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        // Se não filtrar por officialId, mostrar tickets do próprio, subordinados e não atribuídos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else {
          // Se filtrar por officialId, só permitir se for subordinado ou ele mesmo
          if (subordinateIds.includes(officialId)) {
            whereClauses.push(eq(tickets.assigned_to_id, officialId));
          } else if (officialId === official.id) {
            whereClauses.push(eq(tickets.assigned_to_id, official.id));
          } else {
            // Não tem permissão
            return { total: 0, byStatus: {}, byPriority: {} };
          }
        }
        
        // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
        whereClauses.push(inArray(tickets.department_id, departmentIds));
        
      } else if (userRole === 'supervisor') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        
        // Buscar subordinados
        const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, official.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        // Se não filtrar por officialId, mostrar tickets do próprio, subordinados e não atribuídos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            subordinateIds.length > 0 ? inArray(tickets.assigned_to_id, subordinateIds) : sql`false`,
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else {
          // Se filtrar por officialId, só permitir se for subordinado ou ele mesmo
          if (subordinateIds.includes(officialId)) {
            whereClauses.push(eq(tickets.assigned_to_id, officialId));
          } else if (officialId === official.id) {
            whereClauses.push(eq(tickets.assigned_to_id, official.id));
          } else {
            // Não tem permissão
            return { total: 0, byStatus: {}, byPriority: {} };
          }
        }
        
        // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
        whereClauses.push(inArray(tickets.department_id, departmentIds));
        
      } else if (userRole === 'support') {
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (!official) return { total: 0, byStatus: {}, byPriority: {} };
        
        // Buscar departamentos do official
        const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
        if (officialDepts.length === 0) return { total: 0, byStatus: {}, byPriority: {} };
        const departmentIds = officialDepts.map(od => od.department_id);
        
        // Support vê tickets atribuídos a ele ou não atribuídos
        if (!officialId) {
          const assignmentFilter = or(
            eq(tickets.assigned_to_id, official.id),
            isNull(tickets.assigned_to_id)
          );
          whereClauses.push(assignmentFilter);
        } else if (officialId === official.id) {
          whereClauses.push(eq(tickets.assigned_to_id, official.id));
        } else {
          // Não pode ver de outros
          return { total: 0, byStatus: {}, byPriority: {} };
        }
        
        // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
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
      console.error('Erro ao obter estatísticas de tickets por papel do usuário:', error);
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
        recentTickets.map(ticket => this.getTicketInternal(ticket.id)) // Usar método interno
      );
      
      return enrichedTickets.filter(Boolean) as Ticket[];
    } catch (error) {
      console.error('Erro ao obter tickets recentes:', error);
      return [];
    }
  }
  
  // Obter tickets recentes filtrados pelo papel do usuário
  async getRecentTicketsByUserRole(userId: number, userRole: string, limit: number = 10, officialId?: number, startDate?: Date, endDate?: Date): Promise<Ticket[]> {
    try {
      const userTicketsArr = await this.getTicketsByUserRole(userId, userRole);

      let filtered = userTicketsArr;
      // Filtrar por atendente se especificado
      if (officialId) {
        filtered = filtered.filter(ticket => ticket.assigned_to_id === officialId);
      }
      // Filtrar por período se especificado
      if (startDate && endDate) {
        filtered = filtered.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      // Ordenar tickets por data de criação (mais recentes primeiro) e limitar
      return filtered
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Erro ao obter tickets recentes por papel do usuário:', error);
      return [];
    }
  }

  async getAverageFirstResponseTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      // Buscar tickets filtrados via SQL (otimizado)
      const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate);
      
      // Filtrar tickets que têm created_at e (first_response_at OU resolved_at)
      // Se não tem first_response_at mas tem resolved_at, usar resolved_at como primeira resposta
      const ticketsWithFirstResponse = tickets.filter(ticket => 
        ticket.created_at && (ticket.first_response_at || ticket.resolved_at)
      );
      if (ticketsWithFirstResponse.length === 0) {
        return 0;
      }

      // Buscar status history de todos os tickets em uma única query (otimizado)
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
      
      // Calcular tempo útil (horário comercial, dias úteis, descontando pausas) para cada ticket
      const totalResponseTime = ticketsWithFirstResponse.map((ticket) => {
        const createdAt = new Date(ticket.created_at);
        // LÓGICA CORRETA: Se tem first_response_at, usa ele. Se não tem, usa resolved_at
        let firstResponseAt: Date;
        if (ticket.first_response_at) {
          firstResponseAt = new Date(ticket.first_response_at);
        } else {
          firstResponseAt = new Date(ticket.resolved_at!);
        }
        
        // Buscar status history do ticket
        const statusHistory = statusMap.get(ticket.id) || [];
        
        // CORREÇÃO: Para primeira resposta, criar períodos apenas até firstResponseAt
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status as TicketStatus, statusHistory);
        
        // Limitar o cálculo apenas até firstResponseAt (não até resolved_at)
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
      console.error('Erro ao calcular tempo médio de primeira resposta:', error);
      return 0;
    }
  }

  async getAverageResolutionTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      // Buscar tickets filtrados via SQL (otimizado)
      const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate);
      
      // Filtrar apenas tickets realmente resolvidos
      const resolvedTickets = tickets.filter(ticket => ticket.status === 'resolved' && ticket.resolved_at && ticket.created_at);
      if (resolvedTickets.length === 0) {
        return 0;
      }

      // Buscar status history de todos os tickets em uma única query (otimizado)
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
      
      // Calcular tempo útil (horário comercial, dias úteis, descontando pausas) para cada ticket
      const times = resolvedTickets.map(ticket => {
        const createdAt = new Date(ticket.created_at);
        const resolvedAt = new Date(ticket.resolved_at!);
        
        // Buscar status history do ticket
        const statusHistory = statusMap.get(ticket.id) || [];
        
        // Definir tipo TicketStatus localmente se necessário
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status as TicketStatus, statusHistory);
        const effectiveTimeMs = calculateEffectiveBusinessTime(createdAt, resolvedAt, statusPeriods, businessHours);
        
        return effectiveTimeMs / (1000 * 60 * 60); // converter para horas
      });

      const total = times.reduce((a, b) => a + b, 0);
      const avg = times.length ? Math.round((total / times.length) * 100) / 100 : 0;
      return avg;
    } catch (error) {
      console.error('Erro ao calcular tempo médio de resolução:', error);
      return 0;
    }
  }

  /**
   * Calcula o tempo efetivo excluindo períodos de suspensão
   * Baseado na lógica do SLA calculator
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
    
    // Se não há histórico, considerar período inteiro como ativo
    if (statusHistory.length === 0) {
      return !isSlaPaused(currentStatus as any) ? (endTime.getTime() - startTime.getTime()) : 0;
    }
    
    // Processar cada mudança de status
    for (const change of statusHistory) {
      const changeTime = new Date(change.created_at);
      
      // Se o período atual não está pausado, contar o tempo
      if (!isSlaPaused(currentStatus as any) && currentPeriodStart < changeTime) {
        const periodEnd = changeTime > endTime ? endTime : changeTime;
        if (currentPeriodStart < periodEnd) {
          totalEffectiveTime += periodEnd.getTime() - currentPeriodStart.getTime();
        }
      }
      
      // Atualizar para o próximo período
      currentPeriodStart = changeTime;
      currentStatus = change.new_status || currentStatus;
      
      // Se ultrapassou o tempo final, parar
      if (changeTime >= endTime) {
        break;
      }
    }
    
    // Período final (do último status até o fim)
    if (currentPeriodStart < endTime && !isSlaPaused(currentStatus as any)) {
      totalEffectiveTime += endTime.getTime() - currentPeriodStart.getTime();
    }
    
    return totalEffectiveTime;
  }

  // Categories operations
  async getCategories(filters: any = {}, page: number = 1, limit: number = 50): Promise<{ categories: Category[], total: number }> {
    try {
      let whereConditions: any[] = [];
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
      // Aplicar paginação e ordenação
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
   * aplica todos os filtros no SQL e não faz enrichments.
   * NÃO IMPACTA OUTRAS TELAS.
   */
  async getTicketsForDashboardByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{
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
    let whereClauses: any[] = [];
    let companyId: number | null = null;
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
        exists( // Tickets onde ele é participante
          db.select().from(ticketParticipants)
            .where(and(
              eq(ticketParticipants.ticket_id, tickets.id),
              eq(ticketParticipants.user_id, userId)
            ))
        )
      );
      whereClauses.push(customerCondition);
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      
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
          // Não tem permissão
          return [];
        }
      }
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      
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
          // Não tem permissão
          return [];
        }
      }
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
      whereClauses.push(inArray(tickets.department_id, departmentIds));
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) return [];
      
      // Buscar departamentos do official
      const officialDepts = await db.select().from(officialDepartments).where(eq(officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) return [];
      const departmentIds = officialDepts.map(od => od.department_id);
      
      if (!officialId) {
        const assignmentFilter = or(
          eq(tickets.assigned_to_id, official.id),
          isNull(tickets.assigned_to_id)
        );
        whereClauses.push(assignmentFilter);
      } else if (officialId === official.id) {
        whereClauses.push(eq(tickets.assigned_to_id, official.id));
      } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
      }
      
      // FILTRO OBRIGATÓRIO POR DEPARTAMENTO
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
   * Retorna estatísticas de tickets para o dashboard (total, byStatus, byPriority),
   * aplicando filtros no SQL e sem enrichments.
   */
  async getTicketStatsForDashboardByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate);
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
  async getRecentTicketsForDashboardByUserRole(userId: number, userRole: string, limit: number = 10, officialId?: number, startDate?: Date, endDate?: Date): Promise<Array<{ id: number; title: string; status: string; priority: string | null; created_at: Date; company_id: number | null; assigned_to_id: number | null; department_id: number | null; }>> {
    // Reaproveita a query otimizada, mas só pega os campos necessários
    const tickets = await this.getTicketsForDashboardByUserRole(userId, userRole, officialId, startDate, endDate);
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
    let whereClauses: any[] = [];
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
        // role removido pois não existe na tabela
      })
      .from(officials)
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
    return result;
  }

  // === MÉTODOS DE PARTICIPANTES DE TICKETS ===

  /**
   * Adiciona um participante a um ticket
   */
  async addTicketParticipant(ticketId: number, userId: number, addedById: number): Promise<TicketParticipant> {
    // Verificar se o participante já existe
    const existingParticipant = await this.isUserTicketParticipant(ticketId, userId);
    if (existingParticipant) {
      throw new Error('Usuário já é participante deste ticket');
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
    const result = await db
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
   * Obtém todos os participantes de um ticket
   */
  async getTicketParticipants(ticketId: number): Promise<TicketParticipant[]> {
    const participants = await db
      .select()
      .from(ticketParticipants)
      .where(eq(ticketParticipants.ticket_id, ticketId))
      .orderBy(asc(ticketParticipants.added_at));

    // Enriquecer com dados dos usuários
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
   * Verifica se um usuário é participante de um ticket
   */
  async isUserTicketParticipant(ticketId: number, userId: number): Promise<boolean> {
    // 🔥 OTIMIZAÇÃO: Buscar apenas o ID para verificar existência (mais eficiente)
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
   * Obtém o histórico de participantes de um ticket
   */
  async getTicketParticipantsHistory(ticketId: number): Promise<any[]> {
    try {
      // Por enquanto, retornar apenas os participantes atuais como histórico
      // Em uma implementação futura, isso pode ser expandido para incluir
      // um log de adições/remoções de participantes
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
      throw new Error('Falha ao buscar histórico de participantes');
    }
  }

}
