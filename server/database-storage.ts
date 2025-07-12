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
  ticketStatusEnum, userRoleEnum,
  systemSettings, type SystemSetting,
  incidentTypes, type IncidentType,
  categories, type Category,
  companies, departments } from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns, isNotNull, isNull, ilike, asc } from "drizzle-orm";
import { IStorage } from "./storage";
import { isSlaPaused } from "@shared/ticket-utils";
import { convertStatusHistoryToPeriods, calculateEffectiveBusinessTime, getBusinessHoursConfig } from "@shared/utils/sla-calculator";

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
    return db.select().from(customers).orderBy(asc(customers.name));
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
    const officialsData = await db.select().from(officials);
    
    const mappedOfficials = officialsData.map(official => {
      return {
        ...official,
        // Garantir que os campos tenham valores padrão
        avatar_url: official.avatar_url || null,
        manager_id: official.manager_id || null,
        supervisor_id: official.supervisor_id || null,
        is_active: official.is_active !== false, // Garantir boolean
        created_at: official.created_at || new Date(),
        updated_at: official.updated_at || new Date()
      };
    });
    
    // Para cada oficial, buscar seus departamentos e contagem de tickets
    const officialsWithDepartments = await Promise.all(
      mappedOfficials.map(async (official) => {
        // Buscar os registros de departamento da tabela de junção
        const departmentsData: OfficialDepartment[] = await this.getOfficialDepartments(official.id);
        
        // Buscar os nomes dos departamentos pelos IDs
        const departmentNames = await Promise.all(
          departmentsData.map(async (od) => {
            const [dept] = await db.select({ name: departments.name })
              .from(departments)
              .where(eq(departments.id, od.department_id));
            return dept?.name || `Dept-${od.department_id}`;
          })
        );
        
        // Buscar a contagem de tickets atribuídos
        const [ticketCount] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(tickets)
          .where(eq(tickets.assigned_to_id, official.id));
        
        const ticketCountNumber = parseInt(String(ticketCount?.count || 0), 10);
        
        // Buscar dados do usuário associado
        let userData = undefined;
        if (official.user_id) {
          const [user] = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              role: users.role
            })
            .from(users)
            .where(eq(users.id, official.user_id));
          userData = user;
        }
  
        
        // Anexar o array de nomes de departamentos, contagem de tickets e dados do usuário
        return { 
          ...official, 
          departments: departmentNames,
          assignedTicketsCount: ticketCountNumber,
          user: userData
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
  async getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]> {
    console.log(`Buscando tickets para usuário ID ${userId} com papel ${userRole}`);
    
    // Comportamento baseado no papel do usuário
    if (userRole === 'admin') {
      console.log('Papel: admin - retornando todos os tickets');
      return this.getTickets();
    } else if (userRole === 'company_admin') {
      console.log('Papel: company_admin - buscando tickets da empresa');
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.company_id) {
        console.log(`Company_admin sem empresa associada para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Buscando tickets da empresa ID ${user.company_id}`);
      
      try {
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
      const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
      if (!customer) {
        console.log(`Não foi encontrado nenhum cliente para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Cliente encontrado: ID ${customer.id}`);
      return this.getTicketsByCustomerId(customer.id);
    } else if (userRole === 'manager') {
      console.log('Papel: manager - buscando tickets do manager e subordinados');
      
      const [managerOfficial] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!managerOfficial) {
        console.log(`Não foi encontrado nenhum atendente para o usuário manager ID ${userId}`);
        return [];
      }
      
      console.log(`Manager encontrado: ID ${managerOfficial.id}`);
      
      try {
        // Buscar cliente associado ao usuário para determinar contexto
        const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
        
        // Tickets como atendente/manager
        const subordinates = await db.select().from(officials).where(eq(officials.manager_id, managerOfficial.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        console.log(`Subordinados do manager: ${JSON.stringify(subordinateIds)}`);
        
        // Buscar departamentos dos subordinados para tickets não atribuídos
        const allDepartmentIds = new Set<number>();
        for (const subordinate of subordinates) {
          const depts = await this.getOfficialDepartments(subordinate.id);
          depts.forEach(dept => allDepartmentIds.add(dept.department_id));
        }
        
        // Buscar seus próprios departamentos também
        const managerDepartments = await this.getOfficialDepartments(managerOfficial.id);
        managerDepartments.forEach(dept => allDepartmentIds.add(dept.department_id));
        
        const departmentIds = Array.from(allDepartmentIds);
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
        
        console.log(`Encontrados ${ticketsData.length} tickets para o manager (como atendente)`);
        
        // Tickets como cliente
        let customerTicketsData: any[] = [];
        
        if (customer) {
          console.log(`Manager também é cliente: ID ${customer.id}`);
          customerTicketsData = await db
            .select()
            .from(tickets)
            .where(eq(tickets.customer_id, customer.id));
          console.log(`Encontrados ${customerTicketsData.length} tickets para o manager (como cliente)`);
        }
        
        // Combinar tickets e remover duplicatas
        const allTicketsData = [...ticketsData, ...customerTicketsData];
        const uniqueTicketsData = allTicketsData.filter((ticket, index, self) => 
          index === self.findIndex(t => t.id === ticket.id)
        );
        
        console.log(`Total de tickets únicos para o manager: ${uniqueTicketsData.length}`);
        
        const enrichedTickets = await Promise.all(
          uniqueTicketsData.map(async (ticket) => {
            const enrichedTicket = await this.getTicketInternal(ticket.id);
            if (enrichedTicket) {
              // Determinar contexto do usuário para este ticket
              const isOfficial = ticketsData.some(t => t.id === ticket.id);
              const isCustomer = customer && customerTicketsData.some(t => t.id === ticket.id);
              
              if (isOfficial && isCustomer) {
                enrichedTicket.userContext = 'both';
              } else if (isCustomer) {
                enrichedTicket.userContext = 'customer';
              } else {
                enrichedTicket.userContext = 'official';
              }
            }
            return enrichedTicket;
          })
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para manager:', error);
        return [];
      }
    } else if (userRole === 'supervisor') {
      console.log('Papel: supervisor - buscando tickets do supervisor e subordinados');
      
      const [supervisorOfficial] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!supervisorOfficial) {
        console.log(`Não foi encontrado nenhum atendente para o usuário supervisor ID ${userId}`);
        return [];
      }
      
      console.log(`Supervisor encontrado: ID ${supervisorOfficial.id}`);
      
      try {
        // Buscar cliente associado ao usuário para determinar contexto
        const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
        
        // Tickets como supervisor
        // Buscar todos os atendentes que têm este supervisor
        const subordinates = await db.select().from(officials).where(eq(officials.supervisor_id, supervisorOfficial.id));
        const subordinateIds = subordinates.map(s => s.id);
        
        console.log(`Subordinados do supervisor: ${JSON.stringify(subordinateIds)}`);
        
        // Buscar departamentos dos subordinados para tickets não atribuídos
        const allDepartmentIds = new Set<number>();
        for (const subordinate of subordinates) {
          const depts = await this.getOfficialDepartments(subordinate.id);
          depts.forEach(dept => allDepartmentIds.add(dept.department_id));
        }
        
        // Buscar seus próprios departamentos também
        const supervisorDepartments = await this.getOfficialDepartments(supervisorOfficial.id);
        supervisorDepartments.forEach(dept => allDepartmentIds.add(dept.department_id));
        
        const departmentIds = Array.from(allDepartmentIds);
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
        
        console.log(`Encontrados ${ticketsData.length} tickets para o supervisor (como atendente)`);
        
        // Tickets como cliente
        let customerTicketsData: any[] = [];
        
        if (customer) {
          console.log(`Supervisor também é cliente: ID ${customer.id}`);
          customerTicketsData = await db
            .select()
            .from(tickets)
            .where(eq(tickets.customer_id, customer.id));
          console.log(`Encontrados ${customerTicketsData.length} tickets para o supervisor (como cliente)`);
        }
        
        // Combinar tickets e remover duplicatas
        const allTicketsData = [...ticketsData, ...customerTicketsData];
        const uniqueTicketsData = allTicketsData.filter((ticket, index, self) => 
          index === self.findIndex(t => t.id === ticket.id)
        );
        
        console.log(`Total de tickets únicos para o supervisor: ${uniqueTicketsData.length}`);
        
        const enrichedTickets = await Promise.all(
          uniqueTicketsData.map(async (ticket) => {
            const enrichedTicket = await this.getTicketInternal(ticket.id);
            if (enrichedTicket) {
              // Determinar contexto do usuário para este ticket
              const isOfficial = ticketsData.some(t => t.id === ticket.id);
              const isCustomer = customer && customerTicketsData.some(t => t.id === ticket.id);
              
              if (isOfficial && isCustomer) {
                enrichedTicket.userContext = 'both';
              } else if (isCustomer) {
                enrichedTicket.userContext = 'customer';
              } else {
                enrichedTicket.userContext = 'official';
              }
            }
            return enrichedTicket;
          })
        );
        
        return enrichedTickets.filter(Boolean) as Ticket[];
      } catch (error) {
        console.error('Erro ao buscar tickets para supervisor:', error);
        return [];
      }
    } else if (userRole === 'support') {
      console.log('Papel: support - buscando tickets do atendente');
      
      const [official] = await db.select().from(officials).where(eq(officials.user_id, userId));
      if (!official) {
        console.log(`Não foi encontrado nenhum atendente para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Atendente encontrado: ID ${official.id}`);
      
      // Obter os departamentos do atendente
      const officialDepts = await this.getOfficialDepartments(official.id);
      console.log(`Departamentos do atendente: ${JSON.stringify(officialDepts.map(d => d.department_id))}`);
      
      // Buscar tickets relacionados aos IDs dos departamentos do atendente OU atribuídos diretamente
      try {
        // Buscar cliente associado ao usuário para determinar contexto
        const [customer] = await db.select().from(customers).where(eq(customers.user_id, userId));
        
        const conditions = [];
        
        // Obter os IDs dos departamentos diretamente
        const departmentIds = officialDepts.map(dept => dept.department_id);
        console.log(`IDs dos departamentos do atendente: ${JSON.stringify(departmentIds)}`);
        
        if (departmentIds.length > 0) {
          conditions.push(inArray(tickets.department_id, departmentIds));
        }
        
        // Condição para tickets atribuídos diretamente ao oficial
        conditions.push(eq(tickets.assigned_to_id, official.id));
        
        let ticketsData: any[] = [];
        
        if (conditions.length > 0) {
          // Executamos a consulta com OR de todas as condições
          ticketsData = await db
            .select()
            .from(tickets)
            .where(or(...conditions));
        }
        
        console.log(`Encontrados ${ticketsData.length} tickets para o atendente (como atendente)`);
        
        // Tickets como cliente
        let customerTicketsData: any[] = [];
        
        if (customer) {
          console.log(`Atendente também é cliente: ID ${customer.id}`);
          customerTicketsData = await db
            .select()
            .from(tickets)
            .where(eq(tickets.customer_id, customer.id));
          console.log(`Encontrados ${customerTicketsData.length} tickets para o atendente (como cliente)`);
        }
        
        // Combinar tickets e remover duplicatas
        const allTicketsData = [...ticketsData, ...customerTicketsData];
        const uniqueTicketsData = allTicketsData.filter((ticket, index, self) => 
          index === self.findIndex(t => t.id === ticket.id)
        );
        
        console.log(`Total de tickets únicos para o atendente: ${uniqueTicketsData.length}`);
        
        const enrichedTickets = await Promise.all(
          uniqueTicketsData.map(async (ticket) => {
            const enrichedTicket = await this.getTicket(ticket.id);
            if (enrichedTicket) {
              // Determinar contexto do usuário para este ticket
              const isOfficial = ticketsData.some(t => t.id === ticket.id);
              const isCustomer = customer && customerTicketsData.some(t => t.id === ticket.id);
              
              if (isOfficial && isCustomer) {
                enrichedTicket.userContext = 'both';
              } else if (isCustomer) {
                enrichedTicket.userContext = 'customer';
              } else {
                enrichedTicket.userContext = 'official';
              }
            }
            return enrichedTicket;
          })
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
    

    
    // ADMIN SEMPRE VÊ TUDO - sem exceções!
    if (userRole === 'admin') {

    } else if (userRole && userCompanyId) {
      // Apenas para usuários não-admin verificar restrições de empresa
      const ticketCompanyId = ticket.company_id || customerData?.company_id;
      
      if (ticketCompanyId && ticketCompanyId !== userCompanyId) {

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
        priority: ticketData.priority || 'MÉDIA', // Definir prioridade padrão em português
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
      const allTickets = await this.getTickets();
      
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      
      allTickets.forEach(ticket => {
        // Processar status
        const status = ticket.status || 'new';
        byStatus[status] = (byStatus[status] || 0) + 1;
        
        // Processar prioridade - agrupar por nome usando case-insensitive
        const priority = ticket.priority || 'medium';
        // Normalizar para agrupamento (primeira letra maiúscula, resto minúsculo)
        const normalizedPriority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
        byPriority[normalizedPriority] = (byPriority[normalizedPriority] || 0) + 1;
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
        byStatus: {},
        byPriority: {}
      };
    }
  }
  
  // Obter estatísticas dos tickets filtrados pelo papel do usuário
  async getTicketStatsByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    try {
      // Obter tickets filtrados pelo papel do usuário
      let userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      // Filtrar por atendente se especificado
      if (officialId) {
        userTickets = userTickets.filter(ticket => ticket.assigned_to_id === officialId);
      }
      
      // Filtrar por período se especificado
      if (startDate && endDate) {
        userTickets = userTickets.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      
      userTickets.forEach(ticket => {
        // Processar status
        const status = ticket.status || 'new';
        byStatus[status] = (byStatus[status] || 0) + 1;
        
        // Processar prioridade - agrupar por nome usando case-insensitive
        const priority = ticket.priority || 'medium';
        // Normalizar para agrupamento (primeira letra maiúscula, resto minúsculo)
        const normalizedPriority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
        byPriority[normalizedPriority] = (byPriority[normalizedPriority] || 0) + 1;
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
      // Obter tickets filtrados pelo papel do usuário
      let userTickets = await this.getTicketsByUserRole(userId, userRole);
      
      // Filtrar por atendente se especificado
      if (officialId) {
        userTickets = userTickets.filter(ticket => ticket.assigned_to_id === officialId);
      }
      
      // Filtrar por período se especificado
      if (startDate && endDate) {
        userTickets = userTickets.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      
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
  async getAverageFirstResponseTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      let userTickets = await this.getTicketsByUserRole(userId, userRole);
      if (officialId) {
        userTickets = userTickets.filter(ticket => ticket.assigned_to_id === officialId);
      }
      if (startDate && endDate) {
        userTickets = userTickets.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      const ticketsWithFirstResponse = userTickets.filter(ticket => ticket.first_response_at && ticket.created_at);
      if (ticketsWithFirstResponse.length === 0) {
        return 0;
      }
      const businessHours = getBusinessHoursConfig();
      const totalResponseTime = await ticketsWithFirstResponse.reduce(async (sumPromise, ticket) => {
        const sum = await sumPromise;
        const createdAt = new Date(ticket.created_at);
        const firstResponseAt = new Date(ticket.first_response_at!);
        const statusHistory = await db
          .select()
          .from(ticketStatusHistory)
          .where(eq(ticketStatusHistory.ticket_id, ticket.id))
          .orderBy(asc(ticketStatusHistory.created_at));
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status, statusHistory);
        const effectiveTimeMs = calculateEffectiveBusinessTime(createdAt, firstResponseAt, statusPeriods, businessHours);
        return sum + (effectiveTimeMs / (1000 * 60 * 60)); // horas
      }, Promise.resolve(0));
      return Math.round((totalResponseTime / ticketsWithFirstResponse.length) * 100) / 100;
    } catch (error) {
      console.error('Erro ao calcular tempo médio de primeira resposta:', error);
      return 0;
    }
  }

  // Obter tempo médio de resolução filtrado pelo papel do usuário
  async getAverageResolutionTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      let userTickets = await this.getTicketsByUserRole(userId, userRole);
      if (officialId) {
        userTickets = userTickets.filter(ticket => ticket.assigned_to_id === officialId);
      }
      if (startDate && endDate) {
        userTickets = userTickets.filter(ticket => {
          const createdAt = new Date(ticket.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });
      }
      const resolvedTickets = userTickets.filter(ticket => ticket.status === 'resolved' && ticket.resolved_at && ticket.created_at);
      if (resolvedTickets.length === 0) {
        return 0;
      }
      const businessHours = getBusinessHoursConfig();
      const totalResolutionTime = await resolvedTickets.reduce(async (sumPromise, ticket) => {
        const sum = await sumPromise;
        const createdAt = new Date(ticket.created_at);
        const resolvedAt = new Date(ticket.resolved_at!);
        const statusHistory = await db
          .select()
          .from(ticketStatusHistory)
          .where(eq(ticketStatusHistory.ticket_id, ticket.id))
          .orderBy(asc(ticketStatusHistory.created_at));
        const statusPeriods = convertStatusHistoryToPeriods(createdAt, ticket.status, statusHistory);
        const effectiveTimeMs = calculateEffectiveBusinessTime(createdAt, resolvedAt, statusPeriods, businessHours);
        return sum + (effectiveTimeMs / (1000 * 60 * 60)); // horas
      }, Promise.resolve(0));
      return Math.round((totalResolutionTime / resolvedTickets.length) * 100) / 100;
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
      let query = db.select().from(categories);
      let whereConditions: any[] = [];

      // Filtros
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

      // Aplicar condições WHERE
      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }

      // Contar total de registros
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(categories);
      
      if (whereConditions.length > 0) {
        countQuery.where(and(...whereConditions));
      }

      const [{ count: total }] = await countQuery;

      // Aplicar paginação e ordenação
      const categoriesData = await query
        .orderBy(categories.name)
        .limit(limit)
        .offset((page - 1) * limit);

      // Enriquecer com dados relacionados
      const enrichedCategories = await Promise.all(
        categoriesData.map(async (category) => {
          let incidentType = null;
          let company = null;

          if (category.incident_type_id) {
            const [incident] = await db
              .select()
              .from(incidentTypes)
              .where(eq(incidentTypes.id, category.incident_type_id));
            incidentType = incident || null;
          }

          if (category.company_id) {
            const [comp] = await db
              .select()
              .from(companies)
              .where(eq(companies.id, category.company_id));
            company = comp || null;
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
      let incidentType = null;
      let company = null;

      if (category.incident_type_id) {
        const [incident] = await db
          .select()
          .from(incidentTypes)
          .where(eq(incidentTypes.id, category.incident_type_id));
        incidentType = incident || null;
      }

      if (category.company_id) {
        const [comp] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, category.company_id));
        company = comp || null;
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
            eq(categories.value, value),
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
          value: categoryData.value,
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

      return ticketsData;
    } catch (error) {
      console.error('Erro ao buscar tickets por categoria:', error);
      return [];
    }
  }


}
