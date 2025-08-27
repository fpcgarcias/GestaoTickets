import { WebSocket } from 'ws';
import { db } from '../db';
import { tickets, users, ticketStatusHistory, userNotificationSettings, ticketParticipants } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { emailNotificationService } from './email-notification-service';

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
      title: 'Bem-vindo ao Sistema de Chamados',
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
  
  // Verificar apenas se o tipo de notificação está habilitado (sem verificar horário)
  private async shouldNotifyWebSocketByType(userId: number, notificationType: string): Promise<boolean> {
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

      // Verificar tipo de notificação
      switch (notificationType) {
        case 'new_ticket':
          return settings.new_ticket_assigned ?? true;
        case 'status_update':
        case 'status_changed': // Suportar ambos os nomes
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

  // Verificar se o usuário deve receber notificação baseado nas configurações (incluindo horário)
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
        case 'status_changed': // Suportar ambos os nomes
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
    // Verificar apenas se o tipo de notificação está habilitado (sem verificar horário para WebSocket)
    const shouldNotifyWebSocket = await this.shouldNotifyWebSocketByType(userId, payload.type);
    
    if (shouldNotifyWebSocket && this.clients.has(userId)) {
      const userClients = this.clients.get(userId)!;
      for (const client of userClients) {
        if (client.readyState === WebSocket.OPEN) {
          // Enviar no formato esperado pelo cliente
          const message = {
            type: 'notification',
            notification: payload
          };
          client.send(JSON.stringify(message));
        }
      }
    }

    // Se as notificações por email estão habilitadas, enviar também por email (COM verificação de horário)
    const shouldNotifyEmail = await this.shouldNotifyUser(userId, payload.type);
    if (shouldNotifyEmail) {
      await this.sendEmailNotification(userId, payload);
    }
  }

  // Enviar notificação por email (usando o serviço real de email)
  private async sendEmailNotification(userId: number, payload: NotificationPayload): Promise<void> {
    try {
      // DESABILITADO: E-mails são enviados diretamente pelos endpoints em routes.ts
      // para evitar duplicação. Este método agora é um no-op.
      return;
      
      // Código original comentado para referência:
      /*
      // Tipos de notificação que não devem gerar email
      const skipEmailTypes = ['welcome', 'ticket_updated'];
      if (skipEmailTypes.includes(payload.type)) {
        return;
      }

      // Verificar se o usuário tem email habilitado
      const shouldSend = await emailNotificationService.shouldSendEmailToUser(userId, payload.type);
      if (!shouldSend) {
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

      // Para notificações específicas de ticket, chamar os métodos apropriados
      if (payload.ticketId) {
        switch (payload.type) {
          case 'new_ticket':
            await emailNotificationService.notifyNewTicket(payload.ticketId);
            break;
          case 'status_update':
            // Precisa dos status antigo e novo, por hora pular
            break;
          case 'new_reply':
            // Precisa do ID do usuário que respondeu, por hora pular
            break;
          case 'ticket_escalated':
            await emailNotificationService.notifyTicketEscalated(payload.ticketId);
            break;
          default:
            // Para outros tipos, enviar email genérico se houver template
            await emailNotificationService.sendEmailNotification(
              payload.type,
              user.email,
              {
                user,
                system: {
                  message: payload.message,
                  base_url: process.env.BASE_URL || 'http://localhost:5000'
                }
              },
              user.company_id || undefined
            );
            break;
        }
      } else {
        // Para notificações sem ticket específico
        await emailNotificationService.sendEmailNotification(
          payload.type,
          user.email,
          {
            user,
            system: {
              message: payload.message,
              base_url: process.env.BASE_URL || 'http://localhost:5000'
            }
          },
          user.company_id || undefined
        );
      }
      */
      
    } catch (error) {
      console.error('Erro ao enviar notificação por email:', error);
    }
  }
  
  // Enviar notificação para todos os administradores
  public async sendNotificationToAdmins(payload: NotificationPayload): Promise<void> {
    for (const client of this.adminClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // Verificar configurações individuais de cada admin (sem verificar horário para WebSocket)
        const shouldNotifyWebSocket = await this.shouldNotifyWebSocketByType(client.userId, payload.type);
        if (shouldNotifyWebSocket) {
          // Enviar no formato esperado pelo cliente
          const message = {
            type: 'notification',
            notification: payload
          };
          client.send(JSON.stringify(message));
        }
        
        // Verificar separadamente para email (com verificação de horário)
        const shouldNotifyEmail = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotifyEmail) {
          await this.sendEmailNotification(client.userId, payload);
        }
      }
    }
  }
  
  // Enviar notificação para todos os agentes de suporte
  public async sendNotificationToSupport(payload: NotificationPayload): Promise<void> {
    for (const client of this.supportClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // Verificar configurações individuais de cada agente (sem verificar horário para WebSocket)
        const shouldNotifyWebSocket = await this.shouldNotifyWebSocketByType(client.userId, payload.type);
        if (shouldNotifyWebSocket) {
          // Enviar no formato esperado pelo cliente
          const message = {
            type: 'notification',
            notification: payload
          };
          client.send(JSON.stringify(message));
        }
        
        // Verificar separadamente para email (com verificação de horário)
        const shouldNotifyEmail = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotifyEmail) {
          await this.sendEmailNotification(client.userId, payload);
        }
      }
    }
  }
  
  // Enviar notificação para todos os usuários
  public async sendNotificationToAll(payload: NotificationPayload, excludeUserIds: number[] = []): Promise<void> {
    // Coletar todos os clientes em um único array
    const allClients: WebSocketWithUser[] = [];
    this.clients.forEach(clientArray => {
      allClients.push(...clientArray);
    });
    
    // Enviar para todos os clientes abertos (verificando configurações individuais)
    for (const client of allClients) {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        // Pular usuários que devem ser excluídos
        if (excludeUserIds.includes(client.userId)) {
          continue;
        }
        
        // Verificar configurações para WebSocket (sem verificar horário)
        const shouldNotifyWebSocket = await this.shouldNotifyWebSocketByType(client.userId, payload.type);
        if (shouldNotifyWebSocket) {
          // Enviar no formato esperado pelo cliente
          const message = {
            type: 'notification',
            notification: payload
          };
          client.send(JSON.stringify(message));
        }
        
        // Verificar separadamente para email (com verificação de horário)
        const shouldNotifyEmail = await this.shouldNotifyUser(client.userId, payload.type);
        if (shouldNotifyEmail) {
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
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };
      
      this.sendNotificationToAdmins(payload);
      this.sendNotificationToSupport(payload);
      
      console.log(`Notificação enviada para novo ticket #${ticket.ticket_id}`);
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
      if (ticket.customer_id) {
        const payload: NotificationPayload = {
          type: 'status_update',
          title: 'Status do Ticket Atualizado',
          message: `O status do seu ticket "${ticket.title}" foi alterado de ${oldStatusName} para ${newStatusName}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };
        
        // Obter o ID do usuário associado ao cliente
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, ticket.customer_id));
          
        if (user) {
          this.sendNotificationToUser(user.id, payload);
        }
      }
      
      // Notificar administradores e agentes de suporte
      const adminPayload: NotificationPayload = {
        type: 'status_update',
        title: 'Status do Ticket Atualizado',
        message: `O status do ticket #${ticket.ticket_id} "${ticket.title}" foi alterado de ${oldStatusName} para ${newStatusName}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };
      
      this.sendNotificationToAdmins(adminPayload);
      this.sendNotificationToSupport(adminPayload);
      
      console.log(`Notificação enviada para atualização de status do ticket #${ticket.ticket_id}`);
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
      
      // 🔥 FASE 4.1: Buscar participantes do ticket
      const participants = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          company_id: users.company_id
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, replyUserId) // Excluir quem respondeu
        ));

      console.log(`[🔔 NOTIFICAÇÃO] Encontrados ${participants.length} participantes para notificar sobre nova resposta`);
      
      // Determinar para quem enviar a notificação
      const notifyUserIds: number[] = [];
      
      // Se a resposta foi do cliente, notificar suporte/admin + participantes
      if (replyUser.role === 'customer') {
        // Notificar administradores e suporte
        const payload: NotificationPayload = {
          type: 'new_reply',
          title: 'Nova Resposta de Cliente',
          message: `O cliente respondeu ao ticket #${ticket.ticket_id}: "${ticket.title}".`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };
        
        this.sendNotificationToAdmins(payload);
        this.sendNotificationToSupport(payload);
        
        // 🔥 FASE 4.1: Notificar participantes
        for (const participant of participants) {
          const participantPayload: NotificationPayload = {
            type: 'new_reply',
            title: 'Nova Resposta de Cliente',
            message: `O cliente respondeu ao ticket #${ticket.ticket_id}: "${ticket.title}".`,
            ticketId: ticket.id,
            ticketCode: ticket.ticket_id,
            timestamp: new Date(),
            priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
          };
          
          this.sendNotificationToUser(participant.id, participantPayload);
          console.log(`[🔔 NOTIFICAÇÃO] Notificação enviada para participante: ${participant.name}`);
        }
      } 
      // Se a resposta foi do suporte/admin, notificar o cliente + participantes
      else if (replyUser.role === 'admin' || replyUser.role === 'support' || replyUser.role === 'manager' || replyUser.role === 'supervisor') {
        // Notificar o cliente
        if (ticket.customer_id) {
          const [customerUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, ticket.customer_id));
            
          if (customerUser) {
            const payload: NotificationPayload = {
              type: 'new_reply',
              title: 'Nova Resposta no Seu Ticket',
              message: `Há uma nova resposta no seu ticket "${ticket.title}".`,
              ticketId: ticket.id,
              ticketCode: ticket.ticket_id,
              timestamp: new Date(),
              priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
            };
            
            this.sendNotificationToUser(customerUser.id, payload);
          }
        }
        
        // 🔥 FASE 4.1: Notificar participantes
        for (const participant of participants) {
          const participantPayload: NotificationPayload = {
            type: 'new_reply',
            title: 'Nova Resposta de Atendente',
            message: `Há uma nova resposta no ticket #${ticket.ticket_id}: "${ticket.title}".`,
            ticketId: ticket.id,
            ticketCode: ticket.ticket_id,
            timestamp: new Date(),
            priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
          };
          
          this.sendNotificationToUser(participant.id, participantPayload);
          console.log(`[🔔 NOTIFICAÇÃO] Notificação enviada para participante: ${participant.name}`);
        }
      }
      
      console.log(`Notificação enviada para nova resposta no ticket #${ticket.ticket_id}`);
    } catch (error) {
      console.error('Erro ao notificar sobre nova resposta no ticket:', error);
    }
  }
  
  // 🔥 FASE 4.2: Notificar quando um participante é adicionado a um ticket
  public async notifyParticipantAdded(ticketId: number, participantUserId: number, addedByUserId: number): Promise<void> {
    try {
      console.log(`[🔔 WEBSOCKET] 👥 Iniciando notificação de participante adicionado`);
      console.log(`[🔔 WEBSOCKET] Ticket ID: ${ticketId}, Participante: ${participantUserId}, Adicionado por: ${addedByUserId}`);

      // Buscar dados do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) {
        console.log(`[🔔 WEBSOCKET] ❌ Ticket ${ticketId} não encontrado`);
        return;
      }

      // Buscar dados do participante adicionado
      const [participant] = await db.select().from(users).where(eq(users.id, participantUserId));
      if (!participant) {
        console.log(`[🔔 WEBSOCKET] ❌ Participante ${participantUserId} não encontrado`);
        return;
      }

      // Buscar dados de quem adicionou
      const [addedBy] = await db.select().from(users).where(eq(users.id, addedByUserId));
      if (!addedBy) {
        console.log(`[🔔 WEBSOCKET] ❌ Usuário ${addedByUserId} não encontrado`);
        return;
      }

      // Notificar o participante adicionado
      const participantPayload: NotificationPayload = {
        type: 'participant_added',
        title: 'Você foi adicionado como participante',
        message: `Você foi adicionado como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${addedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };

      await this.sendNotificationToUser(participantUserId, participantPayload);
      console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para participante adicionado: ${participant.name}`);

      // Notificar outros participantes do ticket
      const otherParticipants = await db
        .select({
          id: users.id,
          name: users.name
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, participantUserId),
          ne(users.id, addedByUserId) // Excluir quem adicionou
        ));

      for (const otherParticipant of otherParticipants) {
        const otherParticipantPayload: NotificationPayload = {
          type: 'participant_added',
          title: 'Novo participante adicionado',
          message: `${participant.name} foi adicionado como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${addedBy.name}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        await this.sendNotificationToUser(otherParticipant.id, otherParticipantPayload);
        console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para outro participante: ${otherParticipant.name}`);
      }

      // Notificar atendentes do departamento (se aplicável)
      if (ticket.department_id) {
        const departmentPayload: NotificationPayload = {
          type: 'participant_added',
          title: 'Participante adicionado ao ticket',
          message: `${participant.name} foi adicionado como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${addedBy.name}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        // Notificar suporte e admin
        await this.sendNotificationToSupport(departmentPayload);
        await this.sendNotificationToAdmins(departmentPayload);
      }

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participante adicionado concluída`);

    } catch (error) {
      console.error('[🔔 WEBSOCKET] ❌ Erro ao notificar participante adicionado:', error);
    }
  }

  // 🔥 FASE 4.2: Notificar quando um participante é removido de um ticket
  public async notifyParticipantRemoved(ticketId: number, participantUserId: number, removedByUserId: number): Promise<void> {
    try {
      console.log(`[🔔 WEBSOCKET] 👥 Iniciando notificação de participante removido`);
      console.log(`[🔔 WEBSOCKET] Ticket ID: ${ticketId}, Participante: ${participantUserId}, Removido por: ${removedByUserId}`);

      // Buscar dados do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) {
        console.log(`[🔔 WEBSOCKET] ❌ Ticket ${ticketId} não encontrado`);
        return;
      }

      // Buscar dados do participante removido
      const [participant] = await db.select().from(users).where(eq(users.id, participantUserId));
      if (!participant) {
        console.log(`[🔔 WEBSOCKET] ❌ Participante ${participantUserId} não encontrado`);
        return;
      }

      // Buscar dados de quem removeu
      const [removedBy] = await db.select().from(users).where(eq(users.id, removedByUserId));
      if (!removedBy) {
        console.log(`[🔔 WEBSOCKET] ❌ Usuário ${removedByUserId} não encontrado`);
        return;
      }

      // Notificar o participante removido
      const participantPayload: NotificationPayload = {
        type: 'participant_removed',
        title: 'Você foi removido como participante',
        message: `Você foi removido como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${removedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };

      await this.sendNotificationToUser(participantUserId, participantPayload);
      console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para participante removido: ${participant.name}`);

      // Notificar outros participantes do ticket
      const otherParticipants = await db
        .select({
          id: users.id,
          name: users.name
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, removedByUserId) // Excluir quem removeu
        ));

      for (const otherParticipant of otherParticipants) {
        const otherParticipantPayload: NotificationPayload = {
          type: 'participant_removed',
          title: 'Participante removido do ticket',
          message: `${participant.name} foi removido como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${removedBy.name}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        await this.sendNotificationToUser(otherParticipant.id, otherParticipantPayload);
        console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para outro participante: ${otherParticipant.name}`);
      }

      // Notificar atendentes do departamento (se aplicável)
      if (ticket.department_id) {
        const departmentPayload: NotificationPayload = {
          type: 'participant_removed',
          title: 'Participante removido do ticket',
          message: `${participant.name} foi removido como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${removedBy.name}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        // Notificar suporte e admin
        await this.sendNotificationToSupport(departmentPayload);
        await this.sendNotificationToAdmins(departmentPayload);
      }

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participante removido concluída`);

    } catch (error) {
      console.error('[🔔 WEBSOCKET] ❌ Erro ao notificar participante removido:', error);
    }
  }

  // 🔥 FASE 4.2: Notificar participantes sobre mudanças no ticket
  public async notifyTicketParticipants(ticketId: number, excludeUserId: number, payload: NotificationPayload): Promise<void> {
    try {
      console.log(`[🔔 WEBSOCKET] 👥 Notificando participantes do ticket ${ticketId}`);

      // Buscar todos os participantes do ticket (exceto o excluído)
      const participants = await db
        .select({
          id: users.id,
          name: users.name
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, excludeUserId)
        ));

      console.log(`[🔔 WEBSOCKET] 👥 Encontrados ${participants.length} participantes para notificar`);

      for (const participant of participants) {
        await this.sendNotificationToUser(participant.id, payload);
        console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para participante: ${participant.name}`);
      }

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participantes concluída`);

    } catch (error) {
      console.error('[🔔 WEBSOCKET] ❌ Erro ao notificar participantes:', error);
    }
  }
  
  // Notificar sobre mudança de status de um ticket
  public async notifyStatusChange(ticketId: number, oldStatus: string, newStatus: string, changedByUserId: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;
      
      // Obter detalhes do usuário que mudou o status
      const [changedBy] = await db.select().from(users).where(eq(users.id, changedByUserId));
      if (!changedBy) return;
      
      // 🔥 FASE 4.2: Buscar participantes do ticket
      const participants = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          company_id: users.company_id
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true),
          ne(users.id, changedByUserId) // Excluir quem mudou o status
        ));

      console.log(`[🔔 NOTIFICAÇÃO] Encontrados ${participants.length} participantes para notificar sobre mudança de status`);
      
      // Determinar prioridade baseada no novo status
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (newStatus === 'resolved') priority = 'low';
      else if (newStatus === 'in_progress') priority = 'high';
      else if (newStatus === 'pending') priority = 'medium';
      
      // Criar payload de notificação
      const payload: NotificationPayload = {
        type: 'status_change',
        title: 'Status do Ticket Alterado',
        message: `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatus}" para "${newStatus}" por ${changedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority
      };
      
      // Notificar o cliente (se aplicável)
      if (ticket.customer_id && ticket.customer_id !== changedByUserId) {
        this.sendNotificationToUser(ticket.customer_id, payload);
      }
      
      // 🔥 FASE 4.2: Notificar participantes
      for (const participant of participants) {
        const participantPayload: NotificationPayload = {
          type: 'status_change',
          title: 'Status do Ticket Alterado',
          message: `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatus}" para "${newStatus}" por ${changedBy.name}.`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority
        };
        
        this.sendNotificationToUser(participant.id, participantPayload);
        console.log(`[🔔 NOTIFICAÇÃO] Notificação de mudança de status enviada para participante: ${participant.name}`);
      }
      
      // Notificar administradores e suporte (se não for quem mudou)
      if (changedBy.role !== 'admin' && changedBy.role !== 'support' && changedBy.role !== 'manager' && changedBy.role !== 'supervisor') {
        this.sendNotificationToAdmins(payload);
        this.sendNotificationToSupport(payload);
      }
      
      console.log(`Notificação enviada para mudança de status no ticket #${ticket.ticket_id}`);
    } catch (error) {
      console.error('Erro ao notificar mudança de status:', error);
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
