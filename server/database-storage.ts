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
  ticketStatusEnum, ticketPriorityEnum, userRoleEnum,
  systemSettings, type SystemSetting,
  incidentTypes, type IncidentType,
  companies, departments } from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns, isNotNull, isNull, ilike } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(ilike(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      // console.log('DatabaseStorage.createUser - Iniciando criação com dados:', JSON.stringify(userData, null, 2)); // REMOVIDO - dados sensíveis
      
      // Verificar campos obrigatórios
      if (!userData.username) {
        throw new Error('Nome de usuário é obrigatório');
      }
      if (!userData.email) {
        throw new Error('Email do usuário é obrigatório');
      }
      if (!userData.name) {
        throw new Error('Nome do usuário é obrigatório');
      }
      if (!userData.password) {
        throw new Error('Senha do usuário é obrigatória');
      }
      if (!userData.role) {
        throw new Error('Papel do usuário é obrigatório');
      }
      
      // Garantir que campos opcionais tenham valores adequados
      const dataWithDefaults = {
        ...userData,
        active: userData.active !== false,
        avatar_url: userData.avatar_url || null,
      };
      
      // console.log('DatabaseStorage.createUser - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2)); // REMOVIDO - dados sensíveis
      const [user] = await db.insert(users).values(dataWithDefaults).returning();
      
      if (!user) {
        throw new Error('Falha ao criar usuário - nenhum registro retornado');
      }
      
      console.log('DatabaseStorage.createUser - Usuário criado com sucesso:', user.username); // Apenas username, não dados completos
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
    const activeUsersWithCompanies = await db
      .select({
        user: users,
        company: {
          id: companies.id,
          name: companies.name,
        }
      })
      .from(users)
      .leftJoin(companies, eq(users.company_id, companies.id))
      .where(eq(users.active, true));
    
    return activeUsersWithCompanies.map(({ user, company }) => ({
      ...user,
      company: company && company.id ? company : null
    }));
  }
  
  async getAllUsers(): Promise<User[]> {
    const usersWithCompanies = await db
      .select({
        user: users,
        company: {
          id: companies.id,
          name: companies.name,
        }
      })
      .from(users)
      .leftJoin(companies, eq(users.company_id, companies.id));
    
    return usersWithCompanies.map(({ user, company }) => ({
      ...user,
      company: company && company.id ? company : null
    }));
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
    return db.select().from(customers);
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
    // Buscar todos os oficiais com informações de usuário, supervisor, manager e empresa
    const allOfficials = await db
      .select({
        official: officials,
        user: users,
        company: {
          id: companies.id,
          name: companies.name,
        },
        supervisor: {
          id: sql<number>`supervisor.id`,
          name: sql<string>`supervisor.name`,
          email: sql<string>`supervisor.email`,
        },
        manager: {
          id: sql<number>`manager.id`, 
          name: sql<string>`manager.name`,
          email: sql<string>`manager.email`,
        },
      })
      .from(officials)
      .leftJoin(users, eq(officials.user_id, users.id))
      .leftJoin(companies, eq(officials.company_id, companies.id))
      .leftJoin(sql`officials supervisor`, eq(officials.supervisor_id, sql`supervisor.id`))
      .leftJoin(sql`officials manager`, eq(officials.manager_id, sql`manager.id`));
    
    // Transformar o resultado em um formato mais amigável
    const mappedOfficials = allOfficials.map(({ official, user, company, supervisor, manager }) => {
      return {
        ...official,
        user: user || undefined,
        company: company && company.id ? company : null,
        supervisor: supervisor.id ? supervisor : undefined,
        manager: manager.id ? manager : undefined,
      };
    });
    
    // Para cada oficial, buscar seus departamentos e contagem de tickets
    const officialsWithDepartments = await Promise.all(
      mappedOfficials.map(async (official) => {
        // Buscar os registros de departamento da tabela de junção
        const departmentsData: OfficialDepartment[] = await this.getOfficialDepartments(official.id);
        
        // Buscar a contagem de tickets atribuídos
        const [ticketCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(tickets)
          .where(eq(tickets.assigned_to_id, official.id));
        
        const ticketCountNumber = parseInt(String(ticketCount?.count || 0), 10);
        console.log(`[DEBUG] Oficial ${official.name} (ID: ${official.id}) - Contagem de tickets:`, ticketCountNumber);
        
        // Anexar o array de objetos OfficialDepartment e a contagem de tickets
        return { 
          ...official, 
          departments: departmentsData,
          assignedTicketsCount: ticketCountNumber
        };
      })
    );
    
    return officialsWithDepartments;
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
  
  async removeOfficialDepartment(officialId: number, department: string): Promise<boolean> {
    await db
      .delete(officialDepartments)
      .where(
        and(
          eq(officialDepartments.official_id, officialId),
          eq(officialDepartments.department, department)
        )
      );
    return true;
  }
  
  async getOfficialsByDepartment(department: string): Promise<Official[]> {
    const departmentOfficials = await db
      .select()
      .from(officialDepartments)
      .innerJoin(officials, eq(officialDepartments.official_id, officials.id))
      .where(eq(officialDepartments.department, department));
    
    return departmentOfficials.map(row => row.officials);
  }
  
  // Filtrar tickets baseado no perfil do usuário
  async getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]> {
    console.log(`Buscando tickets para usuário ID ${userId} com papel ${userRole}`);
    
    // Carregar o mapeamento de departamentos (string -> id) da tabela departments real
    let departmentIdMap: Record<string, number> = {}; 
    try {
      // Primeiro, determinar qual empresa usar para filtrar departamentos
      let companyIdToFilter: number | null = null;
      
      if (userRole === 'support') {
        // Para support, pegar a empresa do oficial
        const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
        if (official?.company_id) {
          companyIdToFilter = official.company_id;
        }
      } else if (userRole === 'company_admin') {
        // Para company_admin, pegar a empresa do usuário
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user?.company_id) {
          companyIdToFilter = user.company_id;
        }
      }
      
      console.log(`[DEBUG] Filtrando departamentos para empresa ID: ${companyIdToFilter}`);
      
      // Buscar departamentos da tabela departments real, filtrados por empresa
      const departmentsList = await db
        .select()
        .from(departments)
        .where(
          companyIdToFilter 
            ? eq(departments.company_id, companyIdToFilter)
            : undefined // Admin vê todos
        );
      
      console.log(`[DEBUG] Departamentos encontrados: ${JSON.stringify(departmentsList.map(d => ({id: d.id, name: d.name, company_id: d.company_id})))}`);
      
      if (departmentsList.length > 0) {
        // Criar um mapa simples de departamentos (nome exato -> id)
        departmentIdMap = departmentsList.reduce((acc: Record<string, number>, dept: any) => {
          if (dept.name && dept.id) {
            const nameLower = dept.name.toLowerCase();
            acc[nameLower] = dept.id;
          }
          return acc;
        }, {} as Record<string, number>);
        
        console.log('[DEBUG] Mapa de departamentos criado:', departmentIdMap);
      } else {
        console.warn('Nenhum departamento encontrado na tabela departments para a empresa');
      }
      
    } catch (e) {
        console.error("Erro ao buscar mapeamento de departamentos:", e);
        // Continuar sem o mapeamento pode levar a resultados incorretos
    }
    
    // Comportamento baseado no papel do usuário
    if (userRole === 'admin') {
      console.log('Papel: admin - retornando todos os tickets');
      // Administradores veem todos os tickets
      return this.getTickets();
    } else if (userRole === 'company_admin') {
      console.log('Papel: company_admin - buscando tickets da empresa');
      // Company admins veem todos os tickets da sua empresa
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.company_id) {
        console.log(`Company_admin sem empresa associada para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Buscando tickets da empresa ID ${user.company_id}`);
      
      try {
        // Buscar todos os tickets da empresa
        const ticketsData = await db
          .select()
          .from(tickets)
          .where(eq(tickets.company_id, user.company_id));
        
        console.log(`Encontrados ${ticketsData.length} tickets para a empresa`);
        
        const enrichedTickets = await Promise.all(
          ticketsData.map(ticket => this.getTicketInternal(ticket.id))
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para company_admin:', error);
        return [];
      }
    } else if (userRole === 'customer') {
      console.log('Papel: customer - buscando tickets do cliente');
      // Clientes veem apenas seus próprios tickets
      const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
      if (!customer) {
        console.log(`Não foi encontrado nenhum cliente para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Cliente encontrado: ID ${customer.id}`);
      return this.getTicketsByCustomerId(customer.id);
    } else if (userRole === 'manager') {
      console.log('Papel: manager - buscando tickets do manager e subordinados');
      // Manager pode ver tickets de:
      // 1. Seus próprios tickets
      // 2. Tickets de todos os atendentes que têm ele como manager
      // 3. Tickets não atribuídos dos departamentos dos subordinados
      
      const [managerOfficial] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!managerOfficial) {
        console.log(`Não foi encontrado nenhum atendente para o usuário manager ID ${userId}`);
        return [];
      }
      
      console.log(`Manager encontrado: ID ${managerOfficial.id}`);
      
      try {
        // Buscar todos os atendentes que têm este manager
        const subordinates = await db.select().from(officials).where(eq(officials.manager_id, managerOfficial.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        console.log(`Subordinados do manager: ${JSON.stringify(subordinateIds)}`);
        
        // Buscar departamentos dos subordinados para tickets não atribuídos
        const allDepartments = new Set<string>();
        for (const subordinate of subordinates) {
          const departments = await this.getOfficialDepartments(subordinate.id);
          departments.forEach(dept => allDepartments.add(dept.department));
        }
        
        // Buscar seus próprios departamentos também
        const managerDepartments = await this.getOfficialDepartments(managerOfficial.id);
        managerDepartments.forEach(dept => allDepartments.add(dept.department));
        
        const departmentNames = Array.from(allDepartments);
        console.log(`Departamentos relevantes: ${JSON.stringify(departmentNames)}`);
        
        // Mapear nomes para IDs usando o mapa carregado
        const departmentIds = departmentNames
          .map(name => departmentIdMap[name.toLowerCase()])
          .filter(id => id !== undefined);
        
        console.log(`IDs dos departamentos: ${JSON.stringify(departmentIds)}`);
        
        const conditions = [];
        
        // Tickets do próprio manager
        conditions.push(eq(tickets.assigned_to_id, managerOfficial.id));
        
        // Tickets dos subordinados
        if (subordinateIds.length > 0) {
          conditions.push(inArray(tickets.assigned_to_id, subordinateIds));
        }
        
        // Tickets não atribuídos dos departamentos relevantes
        if (departmentIds.length > 0) {
          conditions.push(
            and(
              isNull(tickets.assigned_to_id),
              inArray(tickets.department_id, departmentIds)
            )
          );
        }
        
        const ticketsData = await db
          .select()
          .from(tickets)
          .where(and(
            eq(tickets.company_id, managerOfficial.company_id || 0),
            or(...conditions)
          ));
        
        console.log(`Encontrados ${ticketsData.length} tickets para o manager`);
        
        const enrichedTickets = await Promise.all(
          ticketsData.map(ticket => this.getTicketInternal(ticket.id))
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para manager:', error);
        return [];
      }
    } else if (userRole === 'supervisor') {
      console.log('Papel: supervisor - buscando tickets do supervisor e subordinados');
      // Supervisor pode ver tickets de:
      // 1. Seus próprios tickets
      // 2. Tickets dos atendentes que têm ele como supervisor
      // 3. Tickets não atribuídos dos departamentos dos subordinados
      
      const [supervisorOfficial] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!supervisorOfficial) {
        console.log(`Não foi encontrado nenhum atendente para o usuário supervisor ID ${userId}`);
        return [];
      }
      
      console.log(`Supervisor encontrado: ID ${supervisorOfficial.id}`);
      
      try {
        // Buscar todos os atendentes que têm este supervisor
        const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, supervisorOfficial.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        console.log(`Subordinados do supervisor: ${JSON.stringify(subordinateIds)}`);
        
        // Buscar departamentos dos subordinados para tickets não atribuídos
        const allDepartments = new Set<string>();
        for (const subordinate of subordinates) {
          const departments = await this.getOfficialDepartments(subordinate.id);
          departments.forEach(dept => allDepartments.add(dept.department));
        }
        
        // Buscar seus próprios departamentos também
        const supervisorDepartments = await this.getOfficialDepartments(supervisorOfficial.id);
        supervisorDepartments.forEach(dept => allDepartments.add(dept.department));
        
        const departmentNames = Array.from(allDepartments);
        console.log(`Departamentos relevantes: ${JSON.stringify(departmentNames)}`);
        
        // Mapear nomes para IDs usando o mapa carregado
        const departmentIds = departmentNames
          .map(name => departmentIdMap[name.toLowerCase()])
          .filter(id => id !== undefined);
        
        console.log(`IDs dos departamentos: ${JSON.stringify(departmentIds)}`);
        
        const conditions = [];
        
        // Tickets do próprio supervisor
        conditions.push(eq(tickets.assigned_to_id, supervisorOfficial.id));
        
        // Tickets dos subordinados
        if (subordinateIds.length > 0) {
          conditions.push(inArray(tickets.assigned_to_id, subordinateIds));
        }
        
        // Tickets não atribuídos dos departamentos relevantes
        if (departmentIds.length > 0) {
          conditions.push(
            and(
              isNull(tickets.assigned_to_id),
              inArray(tickets.department_id, departmentIds)
            )
          );
        }
        
        const ticketsData = await db
          .select()
          .from(tickets)
          .where(and(
            eq(tickets.company_id, supervisorOfficial.company_id || 0),
            or(...conditions)
          ));
        
        console.log(`Encontrados ${ticketsData.length} tickets para o supervisor`);
        
        const enrichedTickets = await Promise.all(
          ticketsData.map(ticket => this.getTicketInternal(ticket.id))
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para supervisor:', error);
        return [];
      }
    } else if (userRole === 'support') {
      console.log('Papel: support - buscando tickets do atendente');
      // Atendentes veem tickets de seus departamentos
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) {
        console.log(`Não foi encontrado nenhum atendente para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Atendente encontrado: ID ${official.id}`);
      // Obter os departamentos do atendente
      const officialDepts = await this.getOfficialDepartments(official.id);
      console.log(`Departamentos do atendente: ${JSON.stringify(officialDepts.map(d => d.department))}`);
      
      if (officialDepts.length === 0) {
        console.log('Atendente sem departamentos, mostrando apenas tickets atribuídos diretamente');
        // Se não estiver associado a nenhum departamento, mostrar apenas tickets atribuídos diretamente
        return this.getTicketsByOfficialId(official.id);
      }
      
      // Obter os nomes dos departamentos
      const departmentNames = officialDepts.map(dept => dept.department);
      
      // Mapear nomes para IDs usando o mapa carregado
      const departmentIds = departmentNames
        .map(name => departmentIdMap[name.toLowerCase()])
        .filter(id => id !== undefined); // Filtrar departamentos não encontrados no mapa

      console.log(`IDs dos departamentos do atendente: ${JSON.stringify(departmentIds)}`);

      if (departmentIds.length === 0 && officialDepts.length > 0) {
        console.warn(`Nenhum ID encontrado para os departamentos: ${departmentNames.join(', ')}. Tentando busca por similaridade...`);
        
        // Tentar busca por similaridade (case insensitive e sem acentos)
        const normalizeString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const fuzzyDepartmentIds = departmentNames
          .map(name => {
            const normalized = normalizeString(name);
            // Buscar por nome exato normalizado
            const exactMatch = Object.keys(departmentIdMap).find(key => 
              normalizeString(key) === normalized
            );
            if (exactMatch) {
              console.log(`Encontrou match exato: '${name}' -> '${exactMatch}' (ID: ${departmentIdMap[exactMatch]})`);
              return departmentIdMap[exactMatch];
            }
            
            // Buscar por inclusão parcial
            const partialMatch = Object.keys(departmentIdMap).find(key => 
              normalizeString(key).includes(normalized) || normalized.includes(normalizeString(key))
            );
            if (partialMatch) {
              console.log(`Encontrou match parcial: '${name}' -> '${partialMatch}' (ID: ${departmentIdMap[partialMatch]})`);
              return departmentIdMap[partialMatch];
            }
            
            console.warn(`Nenhum match encontrado para departamento: '${name}'`);
            return undefined;
          })
          .filter(id => id !== undefined);
        
                 if (fuzzyDepartmentIds.length > 0) {
           console.log(`Encontrados ${fuzzyDepartmentIds.length} departamentos por similaridade: ${fuzzyDepartmentIds}`);
           // Buscar tickets usando os IDs encontrados
           const conditions = [];
           conditions.push(inArray(tickets.department_id, fuzzyDepartmentIds));
           conditions.push(eq(tickets.assigned_to_id, official.id));
           
           const ticketsData = await db
             .select()
             .from(tickets)
             .where(or(...conditions));
           
           const enrichedTickets = await Promise.all(
             ticketsData.map(ticket => this.getTicket(ticket.id))
           );
           
           return enrichedTickets.filter(Boolean) as Ticket[];
         }
        
        // Se ainda não encontrou nada, retornar apenas os atribuídos
        console.log('Nenhum departamento encontrado, retornando apenas tickets atribuídos diretamente');
        return this.getTicketsByOfficialId(official.id);
      }
      
      // Buscar tickets relacionados aos IDs dos departamentos do atendente OU atribuídos diretamente
      try {
        const conditions = [];
        if (departmentIds.length > 0) {
            // Condição para tickets pertencentes a qualquer um dos IDs de departamento
            conditions.push(inArray(tickets.department_id, departmentIds));
        }
        
        // Condição para tickets atribuídos diretamente ao oficial
        conditions.push(eq(tickets.assigned_to_id, official.id));
        
        // Executamos a consulta com OR de todas as condições
        const ticketsData = await db
          .select()
          .from(tickets)
          .where(or(...conditions));
        
        console.log(`Encontrados ${ticketsData.length} tickets para o atendente`);
        
        const enrichedTickets = await Promise.all(
          ticketsData.map(ticket => this.getTicket(ticket.id))
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para atendente:', error);
        return [];
      }
    }
    
    // Se o papel do usuário não for reconhecido, retorna array vazio
    console.log(`Papel desconhecido: ${userRole}`);
    return [];
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
              
            const departments = officialDepartmentsData.map((od) => od.department);
            officialData = { ...officialData, departments };
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
    const [result] = await db
      .select({ // Usar getTableColumns para selecionar explicitamente
        ticket: getTableColumns(tickets),
        customer: getTableColumns(customers)
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customer_id))
      .where(eq(tickets.id, id));
    
    if (!result) return undefined;
    const ticket = result.ticket; // Separar dados do ticket
    const customerData = result.customer; // Separar dados do cliente (pode ser null)
    
    console.log(`[DEBUG getTicket] Ticket ID: ${id}, CustomerId: ${ticket.customer_id}, Customer data:`, customerData);
    console.log(`[DEBUG getTicket] UserRole: ${userRole}, UserCompanyId: ${userCompanyId}, TicketCompanyId: ${ticket.company_id}, CustomerCompanyId: ${customerData?.company_id}`);
    
    // ADMIN SEMPRE VÊ TUDO - sem exceções!
    if (userRole === 'admin') {
      console.log(`[DEBUG getTicket] Admin detectado - acesso liberado para todos os dados`);
    } else if (userRole && userCompanyId) {
      // Apenas para usuários não-admin verificar restrições de empresa
      const ticketCompanyId = ticket.company_id || customerData?.company_id;
      
      if (ticketCompanyId && ticketCompanyId !== userCompanyId) {
        console.log(`[DEBUG getTicket] Acesso negado: Ticket pertence à empresa ${ticketCompanyId}, usuário pertence à empresa ${userCompanyId}`);
        return undefined; // Usuário não pode ver este ticket
      }
    }
    
    let officialData: Official | undefined = undefined;
    if (ticket.assigned_to_id) { // Verificar null
      [officialData] = await db
        .select()
        .from(officials)
        .where(eq(officials.id, ticket.assigned_to_id)); // Seguro
        
      if (officialData) {
        const officialDepartmentsData = await db
          .select()
          .from(officialDepartments)
          .where(eq(officialDepartments.official_id, officialData.id));
          
        const departments = officialDepartmentsData.map((od) => od.department);
        officialData = { ...officialData, departments };
      }
    }
    
    const replies = await this.getTicketReplies(ticket.id); // ticket.id é number aqui
    
    return {
      ...ticket,
      customer: customerData || {}, // Retorna objeto vazio se customerData for nulo/undefined
      official: officialData, 
      replies: replies || []
    } as Ticket; // Cast explícito para Ticket
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
    const [result] = await db
      .select({
        ticket: getTableColumns(tickets),
        customer: getTableColumns(customers)
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customer_id))
      .where(eq(tickets.id, id));
    
    if (!result) return undefined;
    const ticket = result.ticket;
    const customerData = result.customer;
    
    let officialData: Official | undefined = undefined;
    if (ticket.assigned_to_id) {
      [officialData] = await db
        .select()
        .from(officials)
        .where(eq(officials.id, ticket.assigned_to_id));
        
      if (officialData) {
        const officialDepartmentsData = await db
          .select()
          .from(officialDepartments)
          .where(eq(officialDepartments.official_id, officialData.id));
          
        const departments = officialDepartmentsData.map((od) => od.department);
        officialData = { ...officialData, departments };
      }
    }

    const replies = await this.getTicketReplies(ticket.id);
    
    return {
      ...ticket,
      customer: customerData || {},
      official: officialData, 
      replies: replies || []
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
        priority: ticketData.priority || ticketPriorityEnum.enumValues[1], // Definir prioridade padrão
        // Garantir que department_id, incident_type_id, customer_id e company_id são números ou null
        department_id: ticketData.department_id ? Number(ticketData.department_id) : null,
        incident_type_id: ticketData.incident_type_id ? Number(ticketData.incident_type_id) : null,
        customer_id: ticketData.customer_id ? Number(ticketData.customer_id) : null,
        company_id: ticketData.company_id ? Number(ticketData.company_id) : null, // ✅ Incluir company_id
      };

      console.log("[DEBUG] Dados para inserção de ticket:", JSON.stringify(ticketInsertData));

      // @ts-ignore - Ignorar erro de tipo temporariamente se status não bater exatamente
      const [insertedTicket] = await db.insert(tickets).values(ticketInsertData).returning();
      return this.getTicketInternal(insertedTicket.id) as Promise<Ticket>; // Usar método interno
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>, changedById?: number): Promise<Ticket | undefined> {
    console.log(`[DEBUG] Iniciando updateTicket para ticket ID ${id}. Dados recebidos:`, JSON.stringify(ticketData));
    
    // Se estamos atualizando o status, primeiro adicionamos ao histórico
    if (ticketData.status) {
      const [currentTicket] = await db.select().from(tickets).where(eq(tickets.id, id));
      console.log(`[DEBUG] Status fornecido: ${ticketData.status}. Status atual:`, currentTicket?.status);
      
      if (currentTicket && currentTicket.status !== ticketData.status) {
        await this.addTicketStatusHistory(
          id,
          currentTicket.status,
          ticketData.status,
          changedById
        );
        console.log(`[DEBUG] Adicionado ao histórico a mudança de status de ${currentTicket.status} para ${ticketData.status} pelo usuário ${changedById}`);
      }
    }
    
    if (ticketData.assigned_to_id !== undefined) {
      console.log(`[DEBUG] Atualizando assigned_to_id do ticket ${id} para ${ticketData.assigned_to_id === null ? 'null' : ticketData.assigned_to_id}`);
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
      
      console.log(`[DEBUG] Resultado da atualização:`, JSON.stringify(ticket));
      
      if (!ticket) {
        console.log(`[DEBUG] Nenhum ticket retornado após a atualização. Ticket não encontrado?`);
        return undefined;
      }
      
      const updatedTicket = await this.getTicketInternal(ticket.id); // Usar método interno
      console.log(`[DEBUG] Ticket completo após atualização:`, JSON.stringify(updatedTicket));
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
    console.log("[DEBUG createTicketReply] Dados recebidos:", JSON.stringify(replyData, null, 2));
    
    // 🎯 SEPARAR campos da REPLY dos campos do TICKET
    const { status, assigned_to_id, type, ...replyOnlyData } = replyData;
    
    console.log("[DEBUG createTicketReply] Dados APENAS da reply:", JSON.stringify(replyOnlyData, null, 2));
    console.log("[DEBUG createTicketReply] Dados do ticket:", { status, assigned_to_id, type });
    
    // ✅ INSERIR APENAS OS CAMPOS QUE PERTENCEM À TABELA ticket_replies
    const [reply] = await db.insert(ticketReplies).values(replyOnlyData).returning();
    
    console.log("[DEBUG createTicketReply] Reply salva no banco:", JSON.stringify(reply, null, 2));
    
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
      const allTickets = await db.select().from(tickets);
      
      const byStatus = {
        new: 0,
        ongoing: 0,
        resolved: 0,
      };
      
      const byPriority = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      
      allTickets.forEach(ticket => {
        byStatus[ticket.status as keyof typeof byStatus] += 1;
        byPriority[ticket.priority as keyof typeof byPriority] += 1;
      });
      
      return {
        total: allTickets.length,
        byStatus,
        byPriority,
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de tickets:', error);
      return {
        total: 0,
        byStatus: { new: 0, ongoing: 0, resolved: 0 },
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 }
      };
    }
  }
  
  // Obter estatísticas dos tickets filtrados pelo papel do usuário
  async getTicketStatsByUserRole(userId: number, userRole: string): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    try {
      // Obter tickets filtrados pelo papel do usuário
      const userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      const byStatus = {
        new: 0,
        ongoing: 0,
        resolved: 0,
      };
      
      const byPriority = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      
      userTickets.forEach(ticket => {
        byStatus[ticket.status as keyof typeof byStatus] += 1;
        byPriority[ticket.priority as keyof typeof byPriority] += 1;
      });
      
      return {
        total: userTickets.length,
        byStatus,
        byPriority,
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de tickets por papel do usuário:', error);
      return {
        total: 0,
        byStatus: { new: 0, ongoing: 0, resolved: 0 },
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 }
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
  async getRecentTicketsByUserRole(userId: number, userRole: string, limit: number = 10): Promise<Ticket[]> {
    try {
      // Obter tickets filtrados pelo papel do usuário
      const userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      // Ordenar tickets por data de criação (mais recentes primeiro) e limitar
      return userTickets
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Erro ao obter tickets recentes por papel do usuário:', error);
      return [];
    }
  }

  // Obter tempo médio de primeira resposta filtrado pelo papel do usuário
  async getAverageFirstResponseTimeByUserRole(userId: number, userRole: string): Promise<number> {
    try {
      // Obter tickets filtrados pelo papel do usuário
      const userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      // Filtrar apenas tickets que têm primeira resposta
      const ticketsWithFirstResponse = userTickets.filter(ticket => 
        ticket.first_response_at && ticket.created_at
      );
      
      if (ticketsWithFirstResponse.length === 0) {
        return 0;
      }
      
      // Calcular tempo médio de primeira resposta em horas
      const totalResponseTime = ticketsWithFirstResponse.reduce((sum, ticket) => {
        const createdAt = new Date(ticket.created_at);
        const firstResponseAt = new Date(ticket.first_response_at!);
        const responseTime = (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // em horas
        return sum + responseTime;
      }, 0);
      
      return Math.round((totalResponseTime / ticketsWithFirstResponse.length) * 100) / 100;
    } catch (error) {
      console.error('Erro ao calcular tempo médio de primeira resposta:', error);
      return 0;
    }
  }

  // Obter tempo médio de resolução filtrado pelo papel do usuário
  async getAverageResolutionTimeByUserRole(userId: number, userRole: string): Promise<number> {
    try {
      // Obter tickets filtrados pelo papel do usuário
      const userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      // Filtrar apenas tickets resolvidos
      const resolvedTickets = userTickets.filter(ticket => 
        ticket.status === 'resolved' && ticket.resolved_at && ticket.created_at
      );
      
      if (resolvedTickets.length === 0) {
        return 0;
      }
      
      // Calcular tempo médio de resolução em horas
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        const createdAt = new Date(ticket.created_at);
        const resolvedAt = new Date(ticket.resolved_at!);
        const resolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // em horas
        return sum + resolutionTime;
      }, 0);
      
      return Math.round((totalResolutionTime / resolvedTickets.length) * 100) / 100;
    } catch (error) {
      console.error('Erro ao calcular tempo médio de resolução:', error);
      return 0;
    }
  }


}
