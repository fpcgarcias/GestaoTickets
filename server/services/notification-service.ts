import { WebSocket } from 'ws';
import { db } from '../db';
import { tickets, users, ticketStatusHistory, userNotificationSettings } from '@shared/schema';
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
  
  // Verificar se o usuário deve receber notificação baseado nas configurações
  private async shouldNotifyUser(userId: number, notificationType: string): Promise<boolean> {
    try {
      // Buscar configurações do usuário
      const [settings] = await db
        .select()
        .from(userNotificationSettings)
        .where(eq(userNotificationSettings.user_id, userId))
        .limit(1);

      // Se não tem configurações, usar padrões (permitir tudo)
      if (!settings) {
        return true;
      }

      // Verificar se está no horário permitido
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay(); // 0 = domingo, 6 = sábado
      const isWeekend = currentDay === 0 || currentDay === 6;

      // Verificar fins de semana
      if (isWeekend && !settings.weekend_notifications) {
        console.log(`Notificação bloqueada para usuário ${userId}: fins de semana desabilitados`);
        return false;
      }

      // Verificar horário
      const startHour = settings.notification_hours_start || 9;
      const endHour = settings.notification_hours_end || 18;
      
      if (currentHour < startHour || currentHour >= endHour) {
        console.log(`Notificação bloqueada para usuário ${userId}: fora do horário (${currentHour}h, permitido: ${startHour}h-${endHour}h)`);
        return false;
      }

      // Verificar tipo de notificação
      switch (notificationType) {
        case 'new_ticket':
          return settings.new_ticket_assigned ?? true;
        case 'status_update':
          return settings.ticket_status_changed ?? true;
        case 'new_reply':
          return settings.new_reply_received ?? true;
        case 'ticket_escalated':
          return settings.ticket_escalated ?? true;
        case 'ticket_due_soon':
          return settings.ticket_due_soon ?? true;
        case 'new_customer':
          return settings.new_customer_registered ?? true;
        case 'new_user':
          return settings.new_user_created ?? true;
        case 'system_maintenance':
          return settings.system_maintenance ?? true;
        default:
          return true;
      }
    } catch (error) {
      console.error('Erro ao verificar configurações de notificação:', error);
      return true; // Em caso de erro, permitir notificação
    }
  }

  // Enviar notificação para um usuário específico (com verificação de configurações)
  public async sendNotificationToUser(userId: number, payload: NotificationPayload): Promise<void> {
    const shouldNotify = await this.shouldNotifyUser(userId, payload.type);
    
    if (!shouldNotify) {
      return;
    }

    if (!this.clients.has(userId)) return;
    
    const userClients = this.clients.get(userId)!;
    for (const client of userClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }

    // Se as notificações por email estão habilitadas, enviar também por email
    await this.sendEmailNotification(userId, payload);
  }

  // Enviar notificação por email (implementação básica)
  private async sendEmailNotification(userId: number, payload: NotificationPayload): Promise<void> {
    try {
      // Verificar se o usuário tem email habilitado
      const [settings] = await db
        .select()
        .from(userNotificationSettings)
        .where(eq(userNotificationSettings.user_id, userId))
        .limit(1);

      const emailEnabled = settings?.email_notifications ?? true;
      if (!emailEnabled) {
        return;
      }

      // Buscar dados do usuário
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.email) {
        return;
      }

      // TODO: Implementar envio real de email
      // Por enquanto, apenas log em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 Email seria enviado para ${user.email}:`);
        console.log(`   Título: ${payload.title}`);
        console.log(`   Mensagem: ${payload.message}`);
        console.log(`   Tipo: ${payload.type}`);
      }
      
      // Aqui você pode integrar com:
      // - Nodemailer
      // - SendGrid
      // - AWS SES
      // - Outro provedor de email
      
    } catch (error) {
      console.error('Erro ao enviar notificação por email:', error);
    }
  }
  
  // Enviar notificação para todos os administradores
  public async sendNotificationToAdmins(payload: NotificationPayload): Promise<void> {
    for (const client of this.adminClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // Verificar configurações individuais de cada admin
        const shouldNotify = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotify) {
          client.send(JSON.stringify(payload));
          // Enviar email também se habilitado
          await this.sendEmailNotification(client.userId, payload);
        }
      }
    }
  }
  
  // Enviar notificação para todos os agentes de suporte
  public async sendNotificationToSupport(payload: NotificationPayload): Promise<void> {
    for (const client of this.supportClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // Verificar configurações individuais de cada agente
        const shouldNotify = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotify) {
          client.send(JSON.stringify(payload));
          // Enviar email também se habilitado
          await this.sendEmailNotification(client.userId, payload);
        }
      }
    }
  }
  
  // Enviar notificação para todos os usuários
  public async sendNotificationToAll(payload: NotificationPayload): Promise<void> {
    // Coletar todos os clientes em um único array
    const allClients: WebSocketWithUser[] = [];
    this.clients.forEach(clientArray => {
      allClients.push(...clientArray);
    });
    
    // Enviar para todos os clientes abertos (verificando configurações individuais)
    for (const client of allClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        const shouldNotify = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotify) {
          client.send(JSON.stringify(payload));
          // Enviar email também se habilitado
          await this.sendEmailNotification(client.userId, payload);
        }
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
