import { 
  users, type User, type InsertUser,
  customers, type Customer, type InsertCustomer,
  officials, type Official, type InsertOfficial,
  tickets, type Ticket, type InsertTicket,
  ticketReplies, type TicketReply, type InsertTicketReply,
  ticketStatusHistory, type TicketStatusHistory,
  slaDefinitions, type SLADefinition,
  ticketStatusEnum, ticketPriorityEnum, userRoleEnum, departmentEnum
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or } from "drizzle-orm";
import { IStorage } from "./storage";

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
    const [user] = await db.insert(users).values(userData).returning();
    return user;
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
    return db.select().from(officials);
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
    const [official] = await db.insert(officials).values(officialData).returning();
    return official;
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
    await db.delete(officials).where(eq(officials.id, id));
    return true;
  }

  // Ticket operations
  async getTickets(): Promise<Ticket[]> {
    const ticketsData = await db.select().from(tickets);
    
    // Precisamos enriquecer com dados do cliente e oficial para cada ticket
    const enrichedTickets = await Promise.all(
      ticketsData.map(async (ticket) => {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, ticket.customerId));
        
        let official = undefined;
        if (ticket.assignedToId) {
          [official] = await db
            .select()
            .from(officials)
            .where(eq(officials.id, ticket.assignedToId));
        }
        
        const replies = await this.getTicketReplies(ticket.id);
        
        return {
          ...ticket,
          customer: customer || undefined,
          official: official || undefined,
          replies: replies || []
        };
      })
    );
    
    return enrichedTickets;
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!ticket) return undefined;
    
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, ticket.customerId));
    
    let official = undefined;
    if (ticket.assignedToId) {
      [official] = await db
        .select()
        .from(officials)
        .where(eq(officials.id, ticket.assignedToId));
    }
    
    const replies = await this.getTicketReplies(ticket.id);
    
    return {
      ...ticket,
      customer: customer || undefined,
      official: official || undefined,
      replies: replies || []
    };
  }

  async getTicketByTicketId(ticketId: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
    if (!ticket) return undefined;
    
    return this.getTicket(ticket.id);
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
    // Buscamos o cliente pelo email primeiro
    let customerId: number | null = null;
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, ticketData.customerEmail));

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Se não encontrar, usar um cliente padrão (ID 1) para evitar erro
      customerId = 1;
    }
    
    // Gerar um ID de ticket legível (2025-CSxxxx)
    const ticketIdString = `2025-CS${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Preparar os dados para inserção
    const ticketInsertData = {
      title: ticketData.title,
      description: ticketData.description,
      customerEmail: ticketData.customerEmail,
      customerId,
      status: 'new',
      priority: ticketData.priority || 'medium',
      type: ticketData.type,
      departmentId: ticketData.departmentId,
      ticketId: ticketIdString
    };
    
    // Inserir o ticket
    const [ticket] = await db.insert(tickets).values(ticketInsertData).returning();
    
    return this.getTicket(ticket.id) as Promise<Ticket>;
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined> {
    // Se estamos atualizando o status, primeiro adicionamos ao histórico
    if (ticketData.status) {
      const [currentTicket] = await db.select().from(tickets).where(eq(tickets.id, id));
      if (currentTicket && currentTicket.status !== ticketData.status) {
        await this.addTicketStatusHistory(
          id,
          currentTicket.status,
          ticketData.status,
          // Na versão atual, o usuário que fez a atualização não é salvo
          // Seria necessário adicionar mais um campo no schema para isso
          undefined
        );
      }
    }
    
    const [ticket] = await db
      .update(tickets)
      .set({
        ...ticketData,
        updatedAt: new Date()
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!ticket) return undefined;
    return this.getTicket(ticket.id);
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
    
    // Se estamos atualizando o status do ticket junto com a resposta
    if (replyData.status) {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, reply.ticketId));
      
      if (ticket && ticket.status !== replyData.status) {
        await this.updateTicket(ticket.id, { 
          status: replyData.status,
          updatedById: reply.userId
        });
      }
    }
    
    // Se esta é a primeira resposta, atualizar firstResponseAt
    const ticketRepliesCount = await db
      .select({ count: db.fn.count() })
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
  }

  async getRecentTickets(limit: number = 10): Promise<Ticket[]> {
    const recentTickets = await db
      .select()
      .from(tickets)
      .orderBy(desc(tickets.createdAt))
      .limit(limit);
    
    const enrichedTickets = await Promise.all(
      recentTickets.map(ticket => this.getTicket(ticket.id))
    );
    
    return enrichedTickets.filter(Boolean) as Ticket[];
  }
}
