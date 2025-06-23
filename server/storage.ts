// @ts-nocheck
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
  SLADefinition,
  OfficialDepartment,
  InsertOfficialDepartment,
  ticketStatusEnum, ticketPriorityEnum, userRoleEnum
} from "@shared/schema";
import { generateTicketId } from "../client/src/lib/utils";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  inactivateUser(id: number): Promise<User | undefined>;
  activateUser(id: number): Promise<User | undefined>;
  getActiveUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customerData: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  
  // Official operations
  getOfficials(): Promise<Official[]>;
  getOfficial(id: number): Promise<Official | undefined>;
  getOfficialByEmail(email: string): Promise<Official | undefined>;
  createOfficial(officialData: InsertOfficial): Promise<Official>;
  updateOfficial(id: number, officialData: Partial<Official>): Promise<Official | undefined>;
  deleteOfficial(id: number): Promise<boolean>;
  inactivateOfficial(id: number): Promise<Official | undefined>;
  activateOfficial(id: number): Promise<Official | undefined>;
  
  // Official departments operations
  getOfficialDepartments(officialId: number): Promise<OfficialDepartment[]>;
  addOfficialDepartment(officialDepartment: InsertOfficialDepartment): Promise<OfficialDepartment>;
  removeOfficialDepartment(officialId: number, department: string): Promise<boolean>;
  getOfficialsByDepartment(department: string): Promise<Official[]>;
  
  // Ticket filtering by user role
  getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]>;
  
  // Ticket operations
  getTickets(): Promise<Ticket[]>;
  getTicket(id: number, userRole?: string, userCompanyId?: number): Promise<Ticket | undefined>;
  getTicketByTicketId(ticketId: string): Promise<Ticket | undefined>;
  getTicketsByStatus(status: string): Promise<Ticket[]>;
  getTicketsByCustomerId(customerId: number): Promise<Ticket[]>;
  getTicketsByOfficialId(officialId: number): Promise<Ticket[]>;
  createTicket(ticketData: InsertTicket): Promise<Ticket>;
  updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined>;
  deleteTicket(id: number): Promise<boolean>;
  
  // Ticket reply operations
  getTicketReplies(ticketId: number): Promise<TicketReply[]>;
  createTicketReply(replyData: InsertTicketReply): Promise<TicketReply>;
  
  // Stats and dashboard operations
  getTicketStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }>;
  getRecentTickets(limit?: number): Promise<Ticket[]>;
  getTicketStatsByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }>;
  getRecentTicketsByUserRole(userId: number, userRole: string, limit?: number, officialId?: number, startDate?: Date, endDate?: Date): Promise<Ticket[]>;
  
  // Time metrics operations
  getAverageFirstResponseTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number>;
  getAverageResolutionTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number>;

  // Company operations (adicionar se não existir)
  getCompany(id: number): Promise<any | undefined>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  // Implementação dos métodos da interface para a memória
  private users: Map<number, User>;
  private customers: Map<number, Customer>;
  private officials: Map<number, Official>;
  private tickets: Map<number, Ticket>;
  private ticketReplies: Map<number, TicketReply>;
  private ticketStatusHistory: Map<number, TicketStatusHistory>;
  private slaDefinitions: Map<number, SLADefinition>;
  private officialDepartments: Map<number, OfficialDepartment>;
  private companies: Map<number, any>;
  
  private userId: number;
  private customerId: number;
  private officialId: number;
  private ticketId: number;
  private replyId: number;
  private historyId: number;
  private slaId: number;
  private officialDepartmentId: number;

  constructor() {
    // Initialize maps
    this.users = new Map();
    this.customers = new Map();
    this.officials = new Map();
    this.tickets = new Map();
    this.ticketReplies = new Map();
    this.ticketStatusHistory = new Map();
    this.slaDefinitions = new Map();
    this.officialDepartments = new Map();
    this.companies = new Map();
    
    // Initialize auto-increment IDs
    this.userId = 1;
    this.customerId = 1;
    this.officialId = 1;
    this.ticketId = 1;
    this.replyId = 1;
    this.historyId = 1;
    this.slaId = 1;
    this.officialDepartmentId = 1;
    
    // Add some initial data
    this.initializeData();
  }

  private initializeData() {
    // Add a default admin user
    const adminUser: User = {
      id: this.userId++,
      username: 'admin',
      password: 'admin123', // In a real app, this would be hashed
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      avatarUrl: null,
      active: true,
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
      avatarUrl: null,
      active: true,
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
      avatarUrl: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Add a inactive user for testing
    const inactiveUser: User = {
      id: this.userId++,
      username: 'inactive',
      password: 'inactive',
      email: 'inactive@example.com',
      name: 'Inactive User',
      role: 'customer',
      avatarUrl: null,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(customerUser.id, customerUser);
    this.users.set(inactiveUser.id, inactiveUser);
    
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
      userId: supportUser.id,
      is_active: true,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      departments: []
    };
    this.officials.set(official.id, official);
    
    // Add an initial department for the official
    const initialDept: OfficialDepartment = {
      id: this.officialDepartmentId++,
      officialId: official.id,
      department: 'technical',
      createdAt: new Date(),
    };
    this.officialDepartments.set(initialDept.id, initialDept);
    // Update the departments array in the official object (optional but good for consistency)
    official.departments = [initialDept];
    
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
      ticketId: generateTicketId("TE"),
      title: "Problema de login",
      description: "Não consigo acessar minha conta.",
      status: "ongoing",
      priority: "medium",
      type: "technical",
      customerId: customer.id,
      customerEmail: customer.email,
      assignedToId: official.id,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      incidentTypeId: 1,
      departmentId: 1,
      firstResponseAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resolvedAt: null,
      slaBreached: false,
      customer: customer,
      official: official,
      replies: []
    };
    this.tickets.set(ticket1.id, ticket1);
    
    const ticket2: Ticket = {
      id: this.ticketId++,
      ticketId: generateTicketId("GE"),
      title: "Dúvida sobre fatura",
      description: "Preciso entender minha última fatura.",
      status: "new",
      priority: "low",
      type: "billing",
      customerId: customer.id,
      customerEmail: customer.email,
      assignedToId: null,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      incidentTypeId: null,
      departmentId: 2,
      firstResponseAt: null,
      resolvedAt: null,
      slaBreached: false,
      customer: customer,
      official: undefined,
      replies: []
    };
    this.tickets.set(ticket2.id, ticket2);
    
    const ticket3: Ticket = {
      id: this.ticketId++,
      ticketId: generateTicketId("SA"),
      title: "Solicitação de demonstração",
      description: "Gostaria de agendar uma demonstração.",
      status: "resolved",
      priority: "high",
      type: "sales",
      customerId: customer.id,
      customerEmail: customer.email,
      assignedToId: official.id,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      incidentTypeId: null,
      departmentId: 3,
      firstResponseAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      slaBreached: false,
      customer: customer,
      official: official,
      replies: []
    };
    this.tickets.set(ticket3.id, ticket3);

    // Add some ticket replies
    const reply1: TicketReply = {
      id: this.replyId++,
      ticketId: ticket1.id,
      userId: official.userId,
      message: "Olá! Estamos verificando seu problema de login.",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isInternal: false,
      user: supportUser
    };
    this.ticketReplies.set(reply1.id, reply1);
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
    const newId = this.userId++;
    const { createdAt, updatedAt, ...restUserData } = userData as any;
    const user: User = {
      id: newId,
      ...restUserData,
      password: userData.password,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newId, user);
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

  async inactivateUser(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      active: false,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async activateUser(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      active: true,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getActiveUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.active !== false);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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
    const newId = this.customerId++;
    const { createdAt, updatedAt, ...restCustomerData } = customerData as any;
    const customer: Customer = {
      id: newId,
      ...restCustomerData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customers.set(newId, customer);
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
    const newId = this.officialId++;
    const { departments: inputDepartments, createdAt, updatedAt, ...restOfficialData } = officialData as any;
    const official: Official = {
      id: newId, ...restOfficialData, departments: [],
      createdAt: new Date(), updatedAt: new Date()
    };
    this.officials.set(newId, official);

    if (inputDepartments && Array.isArray(inputDepartments)) {
      for (const dept of inputDepartments) {
        await this.addOfficialDepartment({ officialId: newId, department: dept });
      }
      official.departments = await this.getOfficialDepartments(newId);
    }
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

  async inactivateOfficial(id: number): Promise<Official | undefined> {
    const official = this.officials.get(id);
    if (!official) return undefined;
    
    const updatedOfficial: Official = {
      ...official,
      is_active: false,
      updatedAt: new Date()
    };
    this.officials.set(id, updatedOfficial);
    return updatedOfficial;
  }

  async activateOfficial(id: number): Promise<Official | undefined> {
    const official = this.officials.get(id);
    if (!official) return undefined;
    
    const updatedOfficial: Official = {
      ...official,
      is_active: true,
      updatedAt: new Date()
    };
    this.officials.set(id, updatedOfficial);
    return updatedOfficial;
  }

  // Ticket operations
  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values());
  }

  async getTicket(id: number, userRole?: string, userCompanyId?: number): Promise<Ticket | undefined> {
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
    const newId = this.ticketId++;
    const now = new Date();
    const ticketCustomer = Array.from(this.customers.values()).find(c => c.email === ticketData.customerEmail);
    const ticket: Ticket = {
      id: newId,
      ticketId: generateTicketId(ticketData.type?.substring(0, 2).toUpperCase() || "GE"),
      title: ticketData.title,
      description: ticketData.description,
      customerEmail: ticketData.customerEmail,
      type: ticketData.type,
      priority: ticketData.priority || 'medium',
      departmentId: ticketData.departmentId || null,
      incidentTypeId: ticketData.incidentTypeId || null,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      assignedToId: null,
      customerId: ticketCustomer?.id || null,
      firstResponseAt: null,
      resolvedAt: null,
      slaBreached: false,
      customer: ticketCustomer || { id: 0, name: 'Desconhecido', email: ticketData.customerEmail, createdAt: now, updatedAt: now, avatarUrl: null, company: null, phone: null, userId: null },
      official: undefined,
      replies: []
    };
    this.tickets.set(newId, ticket);
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
    const newId = this.replyId++;
    const now = new Date();
    const reply: TicketReply = {
      id: newId,
      ticketId: replyData.ticketId,
      message: replyData.message,
      status: replyData.status,
      isInternal: replyData.isInternal ?? false,
      assignedToId: replyData.assignedToId,
      userId: 1,
      createdAt: now,
      user: this.users.get(1) || undefined
    };
    
    this.ticketReplies.set(newId, reply);
    
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
    oldStatus: string | null,
    newStatus: string, 
    changedById?: number | null
  ): Promise<void> {
    const newId = this.historyId++;
    const history: TicketStatusHistory = {
      id: newId, ticketId, 
      oldStatus: oldStatus as typeof ticketStatusEnum.enumValues[number] | null,
      newStatus: newStatus as typeof ticketStatusEnum.enumValues[number],
      changedById: changedById || null,
      createdAt: new Date()
    };
    this.ticketStatusHistory.set(newId, history);
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

  // Implementação dos métodos de departamentos de atendentes
  async getOfficialDepartments(officialId: number): Promise<OfficialDepartment[]> {
    // Simulação: retorna departamentos para o atendente com ID 2 (usuário de suporte)
    if (officialId === 2) {
      return [
        { id: 1, officialId: 2, department: 'technical', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, officialId: 2, department: 'billing', createdAt: new Date(), updatedAt: new Date() }
      ];
    }
    return [];
  }
  
  async addOfficialDepartment(officialDepartment: InsertOfficialDepartment): Promise<OfficialDepartment> {
    const newId = this.officialDepartmentId++;
    const { createdAt, ...restData } = officialDepartment as any;
    const newDept: OfficialDepartment = {
      id: newId, ...restData, createdAt: new Date()
    };
    this.officialDepartments.set(newId, newDept);
    const official = this.officials.get(officialDepartment.officialId);
    if (official) {
      official.departments = [...(official.departments || []), newDept];
    }
    return newDept;
  }
  
  async removeOfficialDepartment(officialId: number, department: string): Promise<boolean> {
    // Simulação: sempre retorna true (sucesso)
    return true;
  }
  
  async getOfficialsByDepartment(department: string): Promise<Official[]> {
    // Simulação: retorna oficiais do departamento 'technical'
    if (department === 'technical') {
      const official = await this.getOfficial(2); // ID do usuário de suporte
      return official ? [official] : [];
    }
    return [];
  }
  
  // Implementação do método para filtrar tickets por papel do usuário
  async getTicketsByUserRole(userId: number, userRole: string): Promise<Ticket[]> {
    // Todos os tickets
    const allTickets = Array.from(this.tickets.values());
    
    // Filtrar com base no papel do usuário
    if (userRole === 'admin') {
      // Administradores veem todos os tickets
      return allTickets;
    } else if (userRole === 'support') {
      // Atendentes (support) veem tickets de seus departamentos
      // Para simplificar a implementação em memória, consideramos que o atendente é responsável
      // por todos os tickets que têm um assignedToId igual ao ID do atendente (official)
      const official = await this.getOfficialByEmail('support@example.com');
      if (!official) return [];
      
      // Em uma implementação completa, verificaríamos os departamentos do atendente
      // e retornaríamos todos os tickets desses departamentos + os atribuídos a ele
      return allTickets.filter(ticket => 
        ticket.assignedToId === official.id || // Atribuídos diretamente ao atendente
        !ticket.assignedToId // Ou não atribuídos a ninguém (para o atendente pegar)
      );
    } else if (userRole === 'customer') {
      // Clientes veem apenas seus próprios tickets
      const customer = await this.getCustomerByEmail('customer@example.com');
      if (!customer) return [];
      
      return allTickets.filter(ticket => ticket.customerId === customer.id);
    }
    
    // Se não for nenhum papel conhecido, retorna array vazio
    return [];
  }

  async getTicketStatsByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }> {
    // Simulação: Filtrar tickets pelo usuário/papel e depois calcular estatísticas
    let userTickets = await this.getTicketsByUserRole(userId, userRole);
    
    // Filtrar por atendente se especificado
    if (officialId) {
      userTickets = userTickets.filter(ticket => ticket.assignedToId === officialId);
    }
    
    // Filtrar por período se especificado
    if (startDate && endDate) {
      userTickets = userTickets.filter(ticket => {
        const createdAt = new Date(ticket.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }
    
    const stats = { total: userTickets.length, byStatus: {}, byPriority: {} };
    userTickets.forEach(ticket => {
      stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;
      stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;
    });
    return stats;
  }

  async getRecentTicketsByUserRole(userId: number, userRole: string, limit: number = 5, officialId?: number, startDate?: Date, endDate?: Date): Promise<Ticket[]> {
    let userTickets = await this.getTicketsByUserRole(userId, userRole);
    
    // Filtrar por atendente se especificado
    if (officialId) {
      userTickets = userTickets.filter(ticket => ticket.assignedToId === officialId);
    }
    
    // Filtrar por período se especificado
    if (startDate && endDate) {
      userTickets = userTickets.filter(ticket => {
        const createdAt = new Date(ticket.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }
    
    return userTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async getAverageFirstResponseTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    let userTickets = await this.getTicketsByUserRole(userId, userRole);
    
    // Filtrar por atendente se especificado
    if (officialId) {
      userTickets = userTickets.filter(ticket => ticket.assignedToId === officialId);
    }
    
    // Filtrar por período se especificado
    if (startDate && endDate) {
      userTickets = userTickets.filter(ticket => {
        const createdAt = new Date(ticket.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }
    
    const ticketsWithFirstResponse = Array.from(userTickets).filter(ticket => 
      ticket.firstResponseAt && ticket.createdAt
    );
    
    if (ticketsWithFirstResponse.length === 0) {
      return 0;
    }
    
    // Calcular tempo médio de primeira resposta em horas (implementação simples para MemStorage)
    // TODO: Implementar lógica de períodos suspensos quando necessário
    const totalResponseTime = ticketsWithFirstResponse.reduce((sum, ticket) => {
      const createdAt = new Date(ticket.createdAt);
      const firstResponseAt = new Date(ticket.firstResponseAt!);
      const responseTime = (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      return sum + responseTime;
    }, 0);
    
    return Math.round((totalResponseTime / ticketsWithFirstResponse.length) * 100) / 100;
  }

  async getAverageResolutionTimeByUserRole(userId: number, userRole: string, officialId?: number, startDate?: Date, endDate?: Date): Promise<number> {
    let userTickets = await this.getTicketsByUserRole(userId, userRole);
    
    // Filtrar por atendente se especificado
    if (officialId) {
      userTickets = userTickets.filter(ticket => ticket.assignedToId === officialId);
    }
    
    // Filtrar por período se especificado
    if (startDate && endDate) {
      userTickets = userTickets.filter(ticket => {
        const createdAt = new Date(ticket.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }
    
    const resolvedTickets = Array.from(userTickets).filter(ticket => 
      ticket.status === 'resolved' && ticket.resolvedAt && ticket.createdAt
    );
    
    if (resolvedTickets.length === 0) {
      return 0;
    }
    
    // Calcular tempo médio de resolução em horas (implementação simples para MemStorage)
    // TODO: Implementar lógica de períodos suspensos quando necessário
    const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
      const createdAt = new Date(ticket.createdAt);
      const resolvedAt = new Date(ticket.resolvedAt!);
      const resolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      return sum + resolutionTime;
    }, 0);
    
    return Math.round((totalResolutionTime / resolvedTickets.length) * 100) / 100;
  }

  async getCompany(id: number): Promise<any | undefined> {
    // Simulação para MemStorage - Em uma implementação real, buscaria de this.companies
    // Este método pode precisar ser implementado de forma mais completa se companies for uma Map
    console.warn(`[MemStorage] getCompany(${id}) não totalmente implementado para Map, retornando placeholder.`);
    // Adicionando uma simulação de mapa de empresas para MemStorage
    if (!this.companies) { // Se this.companies não existir, inicialize-o.
        this.companies = new Map<number, any>();
        this.companies.set(1, { id: 1, name: "Empresa Padrão", email: "padrao@empresa.com", domain: "empresa.com", active: true, cnpj: "00000000000100", phone: "123456789", createdAt: new Date(), updatedAt: new Date() });
    }
    for (const company of this.companies.values()) { // Assumindo que this.companies existe e é um Map
        if (company.id === id) return company;
    }
    return undefined;
  }
}

// Database storage implementation
import { DatabaseStorage } from "./database-storage";

// Export the storage instance to be used
// Decidir qual implementação usar com base em uma variável de ambiente ou configuração
const useDatabase = process.env.USE_DATABASE_STORAGE === 'true';

export const storage: IStorage = useDatabase ? new DatabaseStorage() : new MemStorage();
