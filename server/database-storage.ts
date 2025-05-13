// @ts-nocheck
import { 
  tickets, type Ticket, type InsertTicket,
  ticketReplies, type TicketReply, type InsertTicketReply,
  users, type User, type InsertUser,
  officials, type Official, type InsertOfficial,
  customers, type Customer, type InsertCustomer,
  officialDepartments, type OfficialDepartment, type InsertOfficialDepartment,
  ticketStatusHistory, type TicketStatusHistory,
  slaDefinitions, type SLADefinition,
  ticketStatusEnum, ticketPriorityEnum, userRoleEnum, departmentEnum,
  systemSettings, type SystemSetting,
  incidentTypes, type IncidentType,
  companies
} from "@shared/schema";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, inArray, getTableColumns, isNotNull, ilike } from "drizzle-orm";
import { IStorage, type Company } from "./storage";

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
      console.log('DatabaseStorage.createUser - Iniciando criação com dados:', JSON.stringify(userData, null, 2));
      
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
        avatarUrl: userData.avatarUrl || null,
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
      .set({ active: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async activateUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getActiveUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.active, true));
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
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
    // Buscar todos os oficiais
    const allOfficials = await db
      .select({
        official: officials,
        user: users,
      })
      .from(officials)
      .leftJoin(users, eq(officials.userId, users.id));
    
    // Transformar o resultado em um formato mais amigável
    const mappedOfficials = allOfficials.map(({ official, user }) => {
      return {
        ...official,
        user: user || undefined,
      };
    });
    
    // Para cada oficial, buscar seus departamentos (objetos OfficialDepartment)
    const officialsWithDepartments = await Promise.all(
      mappedOfficials.map(async (official) => {
        // Buscar os registros de departamento da tabela de junção
        const departmentsData: OfficialDepartment[] = await this.getOfficialDepartments(official.id);
        // Anexar o array de objetos OfficialDepartment ao oficial
        return { ...official, departments: departmentsData };
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
        isActive: officialData.isActive !== false, // default para true
        avatarUrl: officialData.avatarUrl || null
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
    await db.delete(officialDepartments).where(eq(officialDepartments.officialId, id));
    
    // Depois removemos o oficial
    await db.delete(officials).where(eq(officials.id, id));
    return true;
  }
  
  async inactivateOfficial(id: number): Promise<Official | undefined> {
    const [official] = await db
      .update(officials)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(officials.id, id))
      .returning();
    return official || undefined;
  }

  async activateOfficial(id: number): Promise<Official | undefined> {
    const [official] = await db
      .update(officials)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(officials.id, id))
      .returning();
    return official || undefined;
  }
  
  // Operações de departamentos dos oficiais
  async getOfficialDepartments(officialId: number): Promise<OfficialDepartment[]> {
    return db
      .select()
      .from(officialDepartments)
      .where(eq(officialDepartments.officialId, officialId));
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
          eq(officialDepartments.officialId, officialId),
          eq(officialDepartments.department, department as any)
        )
      );
    return true;
  }
  
  async getOfficialsByDepartment(department: string): Promise<Official[]> {
    const departmentOfficials = await db
      .select()
      .from(officialDepartments)
      .innerJoin(officials, eq(officialDepartments.officialId, officials.id))
      .where(eq(officialDepartments.department, department as any));
    
    return departmentOfficials.map(row => row.officials);
  }
  
  // Filtrar tickets baseado no perfil do usuário
  async getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]> {
    console.log(`Buscando tickets para usuário ID ${userId} com papel ${userRole}`);
    
    // Carregar o mapeamento de departamentos (string -> id)
    let departmentIdMap: Record<string, number> = {}; 
    try {
      // Buscar departamentos (da tabela de departamentos na forma de system_settings)
      const [deptsSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'departments'));
      
      if (deptsSetting) {
        const departments = JSON.parse(deptsSetting.value);
        // Criar um mapa de departamentos para facilitar o lookup
        departmentIdMap = departments.reduce((acc: Record<string, number>, dept: any) => {
          if ('id' in dept && 'name' in dept) {
            acc[dept.name.toLowerCase()] = dept.id;
          } else if ('value' in dept && 'label' in dept) {
            acc[dept.value.toLowerCase()] = parseInt(dept.value);
          }
          return acc;
        }, {} as Record<string, number>);
      }
      
      // Também pegar os tipos de incidentes para mapear seu departamento
      const incidentTypesList = await db
        .select()
        .from(incidentTypes);
      
      // Criar um mapa auxiliar para tipos de incidentes
      const incidentTypeMap: Record<string, number> = {};
      incidentTypesList.forEach(type => {
        // Associar o NOME do tipo ao departamento correspondente
        if (type.name && type.departmentId) {
          incidentTypeMap[type.name.toLowerCase()] = type.departmentId;
        }
      });
      
      console.log('[DEBUG] Mapa de tipos de incidentes (nome -> deptoId):', incidentTypeMap);
    } catch (e) {
        console.error("Erro ao buscar ou parsear mapeamento de departamentos:", e);
        // Continuar sem o mapeamento pode levar a resultados incorretos
    }
    
    // Comportamento baseado no papel do usuário
    if (userRole === 'admin') {
      console.log('Papel: admin - retornando todos os tickets');
      // Administradores veem todos os tickets
      return this.getTickets();
    } else if (userRole === 'customer') {
      console.log('Papel: customer - buscando tickets do cliente');
      // Clientes veem apenas seus próprios tickets
      const [customer] = await db.select().from(customers).where(eq(customers.userId, userId));
      if (!customer) {
        console.log(`Não foi encontrado nenhum cliente para o usuário ID ${userId}`);
        return [];
      }
      
      console.log(`Cliente encontrado: ID ${customer.id}`);
      return this.getTicketsByCustomerId(customer.id);
    } else if (userRole === 'support') {
      console.log('Papel: support - buscando tickets do atendente');
      // Atendentes veem tickets de seus departamentos
      const [official] = await db.select().from(officials).where(eq(officials.userId, userId));
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
        console.warn(`Nenhum ID encontrado para os departamentos: ${departmentNames.join(', ')}. Verifique o mapeamento.`);
        // Se nenhum ID foi encontrado, mas o oficial tem departamentos, talvez mostrar apenas os atribuídos?
        // Ou retornar vazio? Por segurança, retornamos apenas os atribuídos.
        return this.getTicketsByOfficialId(official.id);
      }
      
      // Buscar tickets relacionados aos IDs dos departamentos do atendente OU atribuídos diretamente
      try {
        const conditions = [];
        if (departmentIds.length > 0) {
            // Condição para tickets pertencentes a qualquer um dos IDs de departamento
            conditions.push(inArray(tickets.departmentId, departmentIds));
        }
        
        // Condição para tickets atribuídos diretamente ao oficial
        conditions.push(eq(tickets.assignedToId, official.id));
        
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
        if (ticket.customerId) { // Verificar se customerId não é null
          [customerData] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, ticket.customerId)); // Agora seguro
        }
        
        let officialData: Official | undefined = undefined;
        if (ticket.assignedToId) { // Verificar se assignedToId não é null
          [officialData] = await db
            .select()
            .from(officials)
            .where(eq(officials.id, ticket.assignedToId)); // Agora seguro
            
          if (officialData) {
            const officialDepartmentsData = await db
              .select()
              .from(officialDepartments)
              .where(eq(officialDepartments.officialId, officialData.id));
              
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

  async getTicket(id: number): Promise<Ticket | undefined> {
    const [result] = await db
      .select({ // Usar getTableColumns para selecionar explicitamente
        ticket: getTableColumns(tickets),
        customer: getTableColumns(customers)
      })
      .from(tickets)
      .leftJoin(customers, eq(customers.id, tickets.customerId))
      .where(eq(tickets.id, id));
    
    if (!result) return undefined;
    const ticket = result.ticket; // Separar dados do ticket
    const customerData = result.customer; // Separar dados do cliente (pode ser null)
    
    console.log(`[DEBUG getTicket] Ticket ID: ${id}, CustomerId: ${ticket.customerId}, Customer data:`, customerData);
    
    let officialData: Official | undefined = undefined;
    if (ticket.assignedToId) { // Verificar null
      [officialData] = await db
        .select()
        .from(officials)
        .where(eq(officials.id, ticket.assignedToId)); // Seguro
        
      if (officialData) {
        const officialDepartmentsData = await db
          .select()
          .from(officialDepartments)
          .where(eq(officialDepartments.officialId, officialData.id));
          
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
      .leftJoin(customers, eq(customers.id, tickets.customerId))
      .where(eq(tickets.ticketId, ticketId));
    
    if (!result) return undefined;
    
    // Como getTicket agora lida com o enriquecimento, podemos chamá-lo
    return this.getTicket(result.ticket.id); // result.ticket.id é number
  }

  async getTicketsByStatus(status: string): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, status as any));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicket(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async getTicketsByCustomerId(customerId: number): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.customerId, customerId));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicket(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async getTicketsByOfficialId(officialId: number): Promise<Ticket[]> {
    const ticketsData = await db
      .select()
      .from(tickets)
      .where(eq(tickets.assignedToId, officialId));
    
    const enrichedTickets = await Promise.all(
      ticketsData.map(ticket => this.getTicket(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    try {
      const ticketId = `${new Date().getFullYear()}-T${String(Date.now()).slice(-6)}`;
      
      const ticketInsertData = {
        ...ticketData,
        ticketId: ticketId,
        status: ticketStatusEnum.enumValues[0], // Definir status inicial explicitamente se necessário
        priority: ticketData.priority || ticketPriorityEnum.enumValues[1], // Definir prioridade padrão
        // Garantir que departmentId, incidentTypeId e customerId são números ou null
        departmentId: ticketData.departmentId ? Number(ticketData.departmentId) : null,
        incidentTypeId: ticketData.incidentTypeId ? Number(ticketData.incidentTypeId) : null,
        customerId: ticketData.customerId ? Number(ticketData.customerId) : null,
      };

      console.log("[DEBUG] Dados para inserção de ticket:", JSON.stringify(ticketInsertData));

      // @ts-ignore - Ignorar erro de tipo temporariamente se status não bater exatamente
      const [insertedTicket] = await db.insert(tickets).values(ticketInsertData).returning();
      return this.getTicket(insertedTicket.id) as Promise<Ticket>; // insertedTicket.id é number
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined> {
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
          // Na versão atual, o usuário que fez a atualização não é salvo
          // Seria necessário adicionar mais um campo no schema para isso
          undefined
        );
        console.log(`[DEBUG] Adicionado ao histórico a mudança de status de ${currentTicket.status} para ${ticketData.status}`);
      }
    }
    
    if (ticketData.assignedToId !== undefined) {
      console.log(`[DEBUG] Atualizando assignedToId do ticket ${id} para ${ticketData.assignedToId === null ? 'null' : ticketData.assignedToId}`);
    }
    
    try {
      const [ticket] = await db
        .update(tickets)
        .set({
          ...ticketData,
          updatedAt: new Date()
        })
        .where(eq(tickets.id, id))
        .returning();
      
      console.log(`[DEBUG] Resultado da atualização:`, JSON.stringify(ticket));
      
      if (!ticket) {
        console.log(`[DEBUG] Nenhum ticket retornado após a atualização. Ticket não encontrado?`);
        return undefined;
      }
      
      const updatedTicket = await this.getTicket(ticket.id);
      console.log(`[DEBUG] Ticket completo após atualização:`, JSON.stringify(updatedTicket));
      return updatedTicket;
    } catch (error) {
      console.error(`[ERROR] Erro ao atualizar ticket ${id}:`, error);
      throw error;
    }
  }

  async deleteTicket(id: number): Promise<boolean> {
    // Primeiro removemos as dependências (respostas e histórico)
    await db.delete(ticketReplies).where(eq(ticketReplies.ticketId, id));
    await db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, id));
    
    // Depois removemos o ticket
    await db.delete(tickets).where(eq(tickets.id, id));
    return true;
  }

  // Ticket reply operations
  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    const replies = await db
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(ticketReplies.createdAt);
    
    // Enriquecer com dados do usuário
    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        if (reply.userId) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, reply.userId));
          
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
    const [reply] = await db.insert(ticketReplies).values(replyData).returning();
    
    // Atualizações do ticket a serem feitas
    const ticketUpdates: Partial<Ticket> = {};
    
    // Se estamos atualizando o status do ticket junto com a resposta
    if (replyData.status) {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, reply.ticketId));
      
      if (ticket && ticket.status !== replyData.status) {
        ticketUpdates.status = replyData.status;
        
        // Se o status estiver sendo alterado para 'resolved', marcamos a data de resolução
        if (replyData.status === 'resolved') {
          ticketUpdates.resolvedAt = new Date();
        }
      }
    }
    
    // Se estamos atribuindo o ticket a um atendente
    if (replyData.assignedToId) {
      ticketUpdates.assignedToId = replyData.assignedToId;
    }
    
    // Aplicar as atualizações ao ticket se houver alguma
    if (Object.keys(ticketUpdates).length > 0) {
      await this.updateTicket(reply.ticketId, ticketUpdates);
    }
    
    // Se esta é a primeira resposta, atualizar firstResponseAt
    const ticketRepliesCount = await db
      .select({ count: sql`count(*)` })
      .from(ticketReplies)
      .where(eq(ticketReplies.ticketId, reply.ticketId));
    
    if (ticketRepliesCount[0]?.count === 1) {
      await this.updateTicket(reply.ticketId, { firstResponseAt: reply.createdAt });
    }
    
    // Incluímos dados do usuário
    if (reply.userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, reply.userId));
      
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
      ticketId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedById,
      createdAt: new Date()
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
        .orderBy(desc(tickets.createdAt))
        .limit(limit);
      
      const enrichedTickets = await Promise.all(
        recentTickets.map(ticket => this.getTicket(ticket.id))
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
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Erro ao obter tickets recentes por papel do usuário:', error);
      return [];
    }
  }

  // Company operations
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByDomain(domain: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.domain, domain));
    return company || undefined;
  }

  async createCompany(companyData: {
    name: string;
    email: string;
    domain?: string | null;
    active?: boolean;
  }): Promise<Company> {
    try {
      console.log('DatabaseStorage.createCompany - Iniciando criação com dados:', JSON.stringify(companyData, null, 2));
      
      // Verificar campos obrigatórios
      if (!companyData.name) {
        throw new Error('Nome da empresa é obrigatório');
      }
      if (!companyData.email) {
        throw new Error('Email da empresa é obrigatório');
      }
      
      // Garantir que campos opcionais tenham valores adequados
      const now = new Date();
      const dataWithDefaults = {
        name: companyData.name,
        email: companyData.email,
        domain: companyData.domain || null,
        active: companyData.active !== false, // default para true
        createdAt: now,
        updatedAt: now
      };
      
      console.log('DatabaseStorage.createCompany - Inserindo no banco com dados tratados:', JSON.stringify(dataWithDefaults, null, 2));
      const [company] = await db.insert(companies).values(dataWithDefaults).returning();
      
      if (!company) {
        throw new Error('Falha ao criar empresa - nenhum registro retornado');
      }
      
      console.log('DatabaseStorage.createCompany - Empresa criada com sucesso:', JSON.stringify(company, null, 2));
      return company;
    } catch (error) {
      console.error('DatabaseStorage.createCompany - Erro:', error);
      throw error;
    }
  }

  async updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({
        ...companyData,
        updatedAt: new Date()
      })
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: number): Promise<boolean> {
    await db.delete(companies).where(eq(companies.id, id));
    return true;
  }

  async toggleCompanyStatus(id: number): Promise<Company | undefined> {
    // Primeiro, buscar o status atual da empresa
    const [existingCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    
    if (!existingCompany) {
      throw new Error('Empresa não encontrada');
    }
    
    // Inverter o status atual
    const [company] = await db
      .update(companies)
      .set({ 
        active: !existingCompany.active,
        updatedAt: new Date() 
      })
      .where(eq(companies.id, id))
      .returning();
    
    return company || undefined;
  }

  async getActiveCompanies(): Promise<Company[]> {
    return db
      .select()
      .from(companies)
      .where(eq(companies.active, true));
  }
}
