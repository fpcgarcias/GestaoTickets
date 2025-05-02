import { 
  User, 
  InsertUser, 
  Customer, 
  InsertCustomer,
  Official,
  InsertOfficial,
  Ticket,
  InsertTicket,
  TicketReply,
  InsertTicketReply,
  TicketStatusHistory,
  SLADefinition
} from "@shared/schema";
import { generateTicketId } from "../client/src/lib/utils";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  
  // Official operations
  getOfficials(): Promise<Official[]>;
  getOfficial(id: number): Promise<Official | undefined>;
  getOfficialByEmail(email: string): Promise<Official | undefined>;
  createOfficial(official: InsertOfficial): Promise<Official>;
  updateOfficial(id: number, officialData: Partial<Official>): Promise<Official | undefined>;
  deleteOfficial(id: number): Promise<boolean>;
  
  // Ticket operations
  getTickets(): Promise<Ticket[]>;
  getTicket(id: number): Promise<Ticket | undefined>;
  getTicketByTicketId(ticketId: string): Promise<Ticket | undefined>;
  getTicketsByStatus(status: string): Promise<Ticket[]>;
  getTicketsByCustomerId(customerId: number): Promise<Ticket[]>;
  getTicketsByOfficialId(officialId: number): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined>;
  deleteTicket(id: number): Promise<boolean>;
  
  // Ticket reply operations
  getTicketReplies(ticketId: number): Promise<TicketReply[]>;
  createTicketReply(reply: InsertTicketReply): Promise<TicketReply>;
  
  // Stats and dashboard operations
  getTicketStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }>;
  getRecentTickets(limit?: number): Promise<Ticket[]>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private customers: Map<number, Customer>;
  private officials: Map<number, Official>;
  private tickets: Map<number, Ticket>;
  private ticketReplies: Map<number, TicketReply>;
  private ticketStatusHistory: Map<number, TicketStatusHistory>;
  private slaDefinitions: Map<number, SLADefinition>;
  
  private userId: number;
  private customerId: number;
  private officialId: number;
  private ticketId: number;
  private replyId: number;
  private historyId: number;
  private slaId: number;

  constructor() {
    // Initialize maps
    this.users = new Map();
    this.customers = new Map();
    this.officials = new Map();
    this.tickets = new Map();
    this.ticketReplies = new Map();
    this.ticketStatusHistory = new Map();
    this.slaDefinitions = new Map();
    
    // Initialize auto-increment IDs
    this.userId = 1;
    this.customerId = 1;
    this.officialId = 1;
    this.ticketId = 1;
    this.replyId = 1;
    this.historyId = 1;
    this.slaId = 1;
    
    // Add some initial data
    this.initializeData();
  }

  private initializeData() {
    // Add a default admin user
    const adminUser: User = {
      id: this.userId++,
      username: 'admin',
      password: 'admin', // In a real app, this would be hashed
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);
    
    // Add a support user
    const supportUser: User = {
      id: this.userId++,
      username: 'support',
      password: 'support', // In a real app, this would be hashed
      email: 'support@example.com',
      name: 'Support User',
      role: 'support',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(supportUser.id, supportUser);
    
    // Add a customer user
    const customerUser: User = {
      id: this.userId++,
      username: 'customer',
      password: 'customer', // In a real app, this would be hashed
      email: 'customer@example.com',
      name: 'John Snow',
      role: 'customer',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(customerUser.id, customerUser);
    
    // Add a customer record
    const customer: Customer = {
      id: this.customerId++,
      name: 'John Snow',
      email: 'customer@example.com',
      phone: '123-456-7890',
      company: 'ABC Corp',
      userId: customerUser.id,
      avatarUrl: 'https://randomuser.me/api/portraits/men/85.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customers.set(customer.id, customer);
    
    // Add an official record
    const official: Official = {
      id: this.officialId++,
      name: 'Support User',
      email: 'support@example.com',
      department: 'technical',
      userId: supportUser.id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.officials.set(official.id, official);
    
    // Add some SLA definitions
    const slaLow: SLADefinition = {
      id: this.slaId++,
      priority: 'low',
      responseTimeHours: 48,
      resolutionTimeHours: 96,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.slaDefinitions.set(slaLow.id, slaLow);
    
    const slaMedium: SLADefinition = {
      id: this.slaId++,
      priority: 'medium',
      responseTimeHours: 24,
      resolutionTimeHours: 48,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.slaDefinitions.set(slaMedium.id, slaMedium);
    
    const slaHigh: SLADefinition = {
      id: this.slaId++,
      priority: 'high',
      responseTimeHours: 8,
      resolutionTimeHours: 24,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.slaDefinitions.set(slaHigh.id, slaHigh);
    
    const slaCritical: SLADefinition = {
      id: this.slaId++,
      priority: 'critical',
      responseTimeHours: 4,
      resolutionTimeHours: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.slaDefinitions.set(slaCritical.id, slaCritical);
    
    // Create sample tickets
    const ticket1: Ticket = {
      id: this.ticketId++,
      ticketId: '2023-CS123',
      title: 'How to deposit money to my portal?',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'ongoing',
      priority: 'medium',
      type: 'deposit',
      customerId: customer.id,
      customerEmail: customer.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add customer info
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        avatarUrl: customer.avatarUrl,
      }
    };
    this.tickets.set(ticket1.id, ticket1);
    
    const ticket2: Ticket = {
      id: this.ticketId++,
      ticketId: '2023-CS124',
      title: 'How to deposit money to my portal?',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'new',
      priority: 'high',
      type: 'deposit',
      customerId: customer.id,
      customerEmail: customer.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add customer info
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        avatarUrl: customer.avatarUrl,
      }
    };
    this.tickets.set(ticket2.id, ticket2);
    
    const ticket3: Ticket = {
      id: this.ticketId++,
      ticketId: '2023-CS125',
      title: 'How to deposit money to my portal?',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'resolved',
      priority: 'low',
      type: 'deposit',
      customerId: customer.id,
      customerEmail: customer.email,
      assignedToId: official.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: new Date(),
      // Add customer info
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        avatarUrl: customer.avatarUrl,
      },
      // Add official info
      official: {
        id: official.id,
        name: official.name,
        email: official.email,
      }
    };
    this.tickets.set(ticket3.id, ticket3);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...userData,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Customer operations
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(customer => customer.email === email);
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const id = this.customerId++;
    const now = new Date();
    const customer: Customer = {
      ...customerData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer: Customer = {
      ...customer,
      ...customerData,
      updatedAt: new Date(),
    };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }

  // Official operations
  async getOfficials(): Promise<Official[]> {
    return Array.from(this.officials.values());
  }

  async getOfficial(id: number): Promise<Official | undefined> {
    return this.officials.get(id);
  }

  async getOfficialByEmail(email: string): Promise<Official | undefined> {
    return Array.from(this.officials.values()).find(official => official.email === email);
  }

  async createOfficial(officialData: InsertOfficial): Promise<Official> {
    const id = this.officialId++;
    const now = new Date();
    const official: Official = {
      ...officialData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.officials.set(id, official);
    return official;
  }

  async updateOfficial(id: number, officialData: Partial<Official>): Promise<Official | undefined> {
    const official = this.officials.get(id);
    if (!official) return undefined;
    
    const updatedOfficial: Official = {
      ...official,
      ...officialData,
      updatedAt: new Date(),
    };
    this.officials.set(id, updatedOfficial);
    return updatedOfficial;
  }

  async deleteOfficial(id: number): Promise<boolean> {
    return this.officials.delete(id);
  }

  // Ticket operations
  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values());
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    
    // Get replies for this ticket
    const replies = await this.getTicketReplies(id);
    return {
      ...ticket,
      replies,
    };
  }

  async getTicketByTicketId(ticketId: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values()).find(ticket => ticket.ticketId === ticketId);
  }

  async getTicketsByStatus(status: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(ticket => ticket.status === status);
  }

  async getTicketsByCustomerId(customerId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(ticket => ticket.customerId === customerId);
  }

  async getTicketsByOfficialId(officialId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(ticket => ticket.assignedToId === officialId);
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    const id = this.ticketId++;
    const now = new Date();
    
    // Look up the customer by email
    let customer: Partial<Customer> = { name: 'Unknown', email: ticketData.customerEmail };
    const existingCustomer = await this.getCustomerByEmail(ticketData.customerEmail);
    
    if (existingCustomer) {
      customer = {
        id: existingCustomer.id,
        name: existingCustomer.name,
        email: existingCustomer.email,
        avatarUrl: existingCustomer.avatarUrl,
      };
    } else {
      // Create a new customer record if it doesn't exist
      const newCustomer = await this.createCustomer({
        name: ticketData.customerEmail.split('@')[0], // Use part of email as name
        email: ticketData.customerEmail,
        phone: '',
        company: '',
      });
      
      customer = {
        id: newCustomer.id,
        name: newCustomer.name,
        email: newCustomer.email,
      };
    }

    const ticket: Ticket = {
      id,
      ticketId: generateTicketId(), // Generate a human-readable ID
      title: ticketData.title,
      description: ticketData.description,
      status: 'new',
      priority: ticketData.priority,
      type: ticketData.type,
      customerId: customer.id || 0,
      customerEmail: ticketData.customerEmail,
      createdAt: now,
      updatedAt: now,
      customer,
    };
    
    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    
    const now = new Date();
    const updatedTicket: Ticket = {
      ...ticket,
      ...ticketData,
      updatedAt: now,
    };
    
    // If status changed to resolved, set resolvedAt
    if (ticketData.status === 'resolved' && ticket.status !== 'resolved') {
      updatedTicket.resolvedAt = now;
    }
    
    this.tickets.set(id, updatedTicket);
    
    // If status changed, add to history
    if (ticketData.status && ticketData.status !== ticket.status) {
      await this.addTicketStatusHistory(id, ticket.status, ticketData.status);
    }
    
    return updatedTicket;
  }

  async deleteTicket(id: number): Promise<boolean> {
    return this.tickets.delete(id);
  }

  // Ticket reply operations
  async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
    return Array.from(this.ticketReplies.values())
      .filter(reply => reply.ticketId === ticketId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createTicketReply(replyData: InsertTicketReply): Promise<TicketReply> {
    const id = this.replyId++;
    const now = new Date();
    const reply: TicketReply = {
      id,
      ticketId: replyData.ticketId,
      message: replyData.message,
      createdAt: now,
      isInternal: replyData.isInternal || false,
    };
    
    this.ticketReplies.set(id, reply);
    
    // Update the ticket status if provided
    if (replyData.status) {
      await this.updateTicket(replyData.ticketId, { 
        status: replyData.status,
        type: replyData.type
      });
    }
    
    // If this is the first response, update the firstResponseAt field
    const ticket = await this.getTicket(replyData.ticketId);
    if (ticket && !ticket.firstResponseAt) {
      await this.updateTicket(replyData.ticketId, { firstResponseAt: now });
    }
    
    return reply;
  }

  // Helper for ticket status history
  private async addTicketStatusHistory(
    ticketId: number, 
    oldStatus: string, 
    newStatus: string, 
    changedById?: number
  ): Promise<void> {
    const id = this.historyId++;
    const now = new Date();
    
    const history: TicketStatusHistory = {
      id,
      ticketId,
      oldStatus: oldStatus as any,
      newStatus: newStatus as any,
      changedById,
      createdAt: now,
    };
    
    this.ticketStatusHistory.set(id, history);
  }

  // Stats and dashboard operations
  async getTicketStats(): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    const tickets = Array.from(this.tickets.values());
    
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
    
    tickets.forEach(ticket => {
      byStatus[ticket.status as keyof typeof byStatus]++;
      byPriority[ticket.priority as keyof typeof byPriority]++;
    });
    
    return {
      total: tickets.length,
      byStatus,
      byPriority,
    };
  }

  async getRecentTickets(limit: number = 10): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
