import { WebSocket } from 'ws';
import { db } from '../db';
import { tickets, users, ticketStatusHistory } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  ticketId?: number;
  ticketCode?: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

type WebSocketWithUser = WebSocket & { userId?: number; userRole?: string };

class NotificationService {
  private clients: Map<number, WebSocketWithUser[]> = new Map();
  private adminClients: WebSocketWithUser[] = [];
  private supportClients: WebSocketWithUser[] = [];
  
  constructor() {
    // Inicializar os ouvintes de eventos do banco de dados aqui
    this.setupEventListeners();
  }
  
  // Método para adicionar uma conexão WebSocket
  public addClient(ws: WebSocketWithUser, userId: number, userRole: string): void {
    ws.userId = userId;
    ws.userRole = userRole;
    
    // Adicionar ao grupo específico com base na função
    if (userRole === 'admin') {
      this.adminClients.push(ws);
    } else if (userRole === 'support') {
      this.supportClients.push(ws);
    }
    
    // Adicionar à lista de clientes por ID do usuário
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(ws);
    
    console.log(`Cliente WebSocket adicionado para usuário ID: ${userId}, Função: ${userRole}`);
    console.log(`Total de clientes WebSocket conectados: ${this.getTotalClients()}`);
    
    // Enviar uma notificação de boas-vindas
    this.sendNotificationToUser(userId, {
      type: 'welcome',
      title: 'Bem-vindo ao TICKET LEAD',
      message: 'Você está agora conectado ao sistema de notificações.',
      timestamp: new Date()
    });
  }
  
  // Método para remover uma conexão WebSocket
  public removeClient(ws: WebSocketWithUser): void {
    const userId = ws.userId;
    const userRole = ws.userRole;
    
    if (!userId) return;
    
    // Remover dos grupos específicos
    if (userRole === 'admin') {
      this.adminClients = this.adminClients.filter(client => client !== ws);
    } else if (userRole === 'support') {
      this.supportClients = this.supportClients.filter(client => client !== ws);
    }
    
    // Remover da lista por ID do usuário
    if (this.clients.has(userId)) {
      const userClients = this.clients.get(userId)!;
      this.clients.set(userId, userClients.filter(client => client !== ws));
      
      // Se não houver mais clientes para este usuário, remover o item do mapa
      if (this.clients.get(userId)!.length === 0) {
        this.clients.delete(userId);
      }
    }
    
    console.log(`Cliente WebSocket removido para usuário ID: ${userId}, Função: ${userRole}`);
    console.log(`Total de clientes WebSocket conectados: ${this.getTotalClients()}`);
  }
  
  // Enviar notificação para um usuário específico
  public sendNotificationToUser(userId: number, payload: NotificationPayload): void {
    if (!this.clients.has(userId)) return;
    
    const userClients = this.clients.get(userId)!;
    for (const client of userClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }
  }
  
  // Enviar notificação para todos os administradores
  public sendNotificationToAdmins(payload: NotificationPayload): void {
    for (const client of this.adminClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }
  }
  
  // Enviar notificação para todos os agentes de suporte
  public sendNotificationToSupport(payload: NotificationPayload): void {
    for (const client of this.supportClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }
  }
  
  // Enviar notificação para todos os usuários
  public sendNotificationToAll(payload: NotificationPayload): void {
    // Coletar todos os clientes em um único array
    const allClients: WebSocketWithUser[] = [];
    this.clients.forEach(clientArray => {
      allClients.push(...clientArray);
    });
    
    // Enviar para todos os clientes abertos
    for (const client of allClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }
  }
  
  // Notificar sobre a criação de um novo ticket
  public async notifyNewTicket(ticketId: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;
      
      // Notificar administradores e agentes de suporte
      const payload: NotificationPayload = {
        type: 'new_ticket',
        title: 'Novo Ticket Criado',
        message: `Um novo ticket foi criado: ${ticket.title}`,
        ticketId: ticket.id,
        ticketCode: ticket.ticketId,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };
      
      this.sendNotificationToAdmins(payload);
      this.sendNotificationToSupport(payload);
      
      console.log(`Notificação enviada para novo ticket #${ticket.ticketId}`);
    } catch (error) {
      console.error('Erro ao notificar sobre novo ticket:', error);
    }
  }
  
  // Notificar sobre uma atualização de status de ticket
  public async notifyTicketStatusUpdate(ticketId: number, oldStatus: string, newStatus: string): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;
      
      // Obter o nome dos status (em português)
      const statusNames: Record<string, string> = {
        'new': 'Novo',
        'ongoing': 'Em Andamento',
        'resolved': 'Resolvido'
      };
      
      const oldStatusName = statusNames[oldStatus as keyof typeof statusNames] || oldStatus;
      const newStatusName = statusNames[newStatus as keyof typeof statusNames] || newStatus;
      
      // Notificar o cliente que abriu o ticket
      if (ticket.customerId) {
        const payload: NotificationPayload = {
          type: 'status_update',
          title: 'Status do Ticket Atualizado',
          message: `O status do seu ticket "${ticket.title}" foi alterado de ${oldStatusName} para ${newStatusName}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticketId,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };
        
        // Obter o ID do usuário associado ao cliente
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, ticket.customerId));
          
        if (user) {
          this.sendNotificationToUser(user.id, payload);
        }
      }
      
      // Notificar administradores e agentes de suporte
      const adminPayload: NotificationPayload = {
        type: 'status_update',
        title: 'Status do Ticket Atualizado',
        message: `O status do ticket #${ticket.ticketId} "${ticket.title}" foi alterado de ${oldStatusName} para ${newStatusName}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticketId,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };
      
      this.sendNotificationToAdmins(adminPayload);
      this.sendNotificationToSupport(adminPayload);
      
      console.log(`Notificação enviada para atualização de status do ticket #${ticket.ticketId}`);
    } catch (error) {
      console.error('Erro ao notificar sobre atualização de status do ticket:', error);
    }
  }
  
  // Notificar sobre uma nova resposta em um ticket
  public async notifyNewReply(ticketId: number, replyUserId: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;
      
      // Obter detalhes do usuário que respondeu
      const [replyUser] = await db.select().from(users).where(eq(users.id, replyUserId));
      if (!replyUser) return;
      
      // Determinar para quem enviar a notificação
      const notifyUserIds: number[] = [];
      
      // Se a resposta foi do cliente, notificar suporte/admin
      if (replyUser.role === 'customer') {
        // Notificar administradores e suporte
        const payload: NotificationPayload = {
          type: 'new_reply',
          title: 'Nova Resposta de Cliente',
          message: `O cliente respondeu ao ticket #${ticket.ticketId}: "${ticket.title}".`,
          ticketId: ticket.id,
          ticketCode: ticket.ticketId,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };
        
        this.sendNotificationToAdmins(payload);
        this.sendNotificationToSupport(payload);
      } 
      // Se a resposta foi do suporte/admin, notificar o cliente
      else if (replyUser.role === 'admin' || replyUser.role === 'support') {
        // Notificar o cliente
        if (ticket.customerId) {
          const [customerUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, ticket.customerId));
            
          if (customerUser) {
            const payload: NotificationPayload = {
              type: 'new_reply',
              title: 'Nova Resposta no Seu Ticket',
              message: `Há uma nova resposta no seu ticket "${ticket.title}".`,
              ticketId: ticket.id,
              ticketCode: ticket.ticketId,
              timestamp: new Date(),
              priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
            };
            
            this.sendNotificationToUser(customerUser.id, payload);
          }
        }
      }
      
      console.log(`Notificação enviada para nova resposta no ticket #${ticket.ticketId}`);
    } catch (error) {
      console.error('Erro ao notificar sobre nova resposta no ticket:', error);
    }
  }
  
  // Configurar ouvintes de eventos para mudanças no banco de dados
  private setupEventListeners(): void {
    // Nesta implementação inicial, os eventos serão acionados explicitamente pelas rotas
    // Em uma implementação mais avançada, poderíamos usar triggers de banco de dados
    // ou um sistema de eventos para acionar estas notificações automaticamente
    console.log('Serviço de notificações inicializado');
  }
  
  // Obter contagem total de clientes conectados
  private getTotalClients(): number {
    let count = 0;
    this.clients.forEach(clientArray => {
      count += clientArray.length;
    });
    return count;
  }
}

// Criar uma instância singleton do serviço
export const notificationService = new NotificationService();
