import { WebSocket } from 'ws';
import { db } from '../db';
import { tickets, users, ticketStatusHistory, userNotificationSettings, ticketParticipants, notifications, customers, officials, officialDepartments } from '@shared/schema';
import * as schema from '@shared/schema';
import { eq, and, ne, isNull, sql, inArray } from 'drizzle-orm';
import { emailNotificationService } from './email-notification-service';
import { webPushService } from './web-push-service';
import { logNotificationError } from './logger';
import { STATUS_CONFIG } from '@shared/ticket-utils';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  ticketId?: number;
  ticketCode?: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

// Função para validar e normalizar prioridade (Requirements 9.1, 9.5)
function validatePriority(priority?: string): 'low' | 'medium' | 'high' | 'critical' {
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (priority && validPriorities.includes(priority)) {
    return priority as 'low' | 'medium' | 'high' | 'critical';
  }
  return 'medium'; // Prioridade padrão (Requirement 9.5)
}

interface PersistentNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  ticketId?: number | null;
  ticketCode?: string | null;
  metadata?: any;
  readAt?: Date | null;
  createdAt: Date;
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

  /**
   * Persiste uma notificação no banco de dados e envia via Web Push se usuário estiver offline
   * @private
   * @param userId - ID do usuário destinatário
   * @param payload - Dados da notificação
   * @returns Notificação persistida ou null em caso de erro
   */
  private async persistNotification(userId: number, payload: NotificationPayload): Promise<PersistentNotification | null> {
    try {
      console.log(`[💾 PERSISTÊNCIA] Salvando notificação para usuário ${userId}, tipo: ${payload.type}`);

      // Validar e normalizar prioridade (Requirements 9.1, 9.5)
      const validatedPriority = validatePriority(payload.priority);

      const [notification] = await db
        .insert(notifications)
        .values({
          user_id: userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          priority: validatedPriority,
          ticket_id: payload.ticketId || null,
          ticket_code: payload.ticketCode || null,
          metadata: payload.metadata || null,
          read_at: null,
          // Remover created_at para usar o DEFAULT do banco
        })
        .returning();

      console.log(`[💾 PERSISTÊNCIA] ✅ Notificação ${notification.id} salva com sucesso`);

      const persistedNotification: PersistentNotification = {
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        ticketId: notification.ticket_id ?? undefined,
        ticketCode: notification.ticket_code ?? undefined,
        metadata: notification.metadata,
        readAt: notification.read_at ?? undefined,
        createdAt: notification.created_at,
      };

      // 🔥 INTEGRAÇÃO WEB PUSH (Requirements 3.4, 7.2, 9.2)
      // Verificar se usuário está offline e enviar Web Push
      const isOnline = this.isUserOnline(userId);

      if (!isOnline) {
        console.log(`[📱 WEB PUSH] Usuário ${userId} offline, verificando push subscriptions`);

        try {
          // Buscar push subscriptions do banco
          const subscriptions = await webPushService.getSubscriptions(userId);

          if (subscriptions.length > 0) {
            console.log(`[📱 WEB PUSH] Encontradas ${subscriptions.length} subscriptions para usuário ${userId}`);

            // Enviar notificação via Web Push
            // Converter para o formato esperado pelo WebPushService (null -> undefined)
            await webPushService.sendPushNotification(userId, {
              id: persistedNotification.id,
              userId: persistedNotification.userId,
              type: persistedNotification.type,
              title: persistedNotification.title,
              message: persistedNotification.message,
              priority: persistedNotification.priority,
              ticketId: persistedNotification.ticketId ?? undefined,
              ticketCode: persistedNotification.ticketCode ?? undefined,
              metadata: persistedNotification.metadata,
              readAt: persistedNotification.readAt ?? undefined,
              createdAt: persistedNotification.createdAt,
            });

            console.log(`[📱 WEB PUSH] ✅ Web Push enviado para usuário ${userId}`);
          } else {
            console.log(`[📱 WEB PUSH] Nenhuma subscription encontrada para usuário ${userId}`);
          }
        } catch (webPushError) {
          // Requirement 7.2: Se Web Push falhar, registrar mas manter notificação no banco
          logNotificationError(
            'Web Push delivery failed',
            webPushError,
            'error',
            { userId, notificationId: persistedNotification.id, ticketId: payload.ticketId }
          );
          console.error('[📱 WEB PUSH] Detalhes:', {
            userId,
            notificationId: notification.id,
            error: webPushError instanceof Error ? webPushError.message : String(webPushError),
            stack: webPushError instanceof Error ? webPushError.stack : undefined,
          });
          // Continuar normalmente - notificação já está persistida
        }
      } else {
        console.log(`[📱 WEB PUSH] Usuário ${userId} online, Web Push não necessário`);
      }

      return persistedNotification;
    } catch (error) {
      // Requirement 7.3: Se persistência falhar, registrar erro crítico
      logNotificationError(
        'Notification persistence failed',
        error,
        'critical',
        { userId, notificationType: payload.type, title: payload.title, ticketId: payload.ticketId }
      );
      return null;
    }
  }

  /**
   * Verifica se um usuário está online (conectado via WebSocket)
   * @private
   * @param userId - ID do usuário
   * @returns true se o usuário está online, false caso contrário
   */
  private isUserOnline(userId: number): boolean {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) {
      console.log(`[🔔 ONLINE CHECK] Usuário ${userId} OFFLINE - sem clientes WebSocket`);
      return false;
    }

    // Verificar se pelo menos um cliente está com conexão ativa
    const activeClients = userClients.filter(client => client.readyState === WebSocket.OPEN);
    const isOnline = activeClients.length > 0;

    console.log(`[🔔 ONLINE CHECK] Usuário ${userId} ${isOnline ? 'ONLINE' : 'OFFLINE'} - ${activeClients.length}/${userClients.length} clientes ativos`);
    return isOnline;
  }

  /**
   * Envia atualização de contador de notificações não lidas via WebSocket
   * Requirements: 6.5 - Sincronização de contador via WebSocket
   * @param userId - ID do usuário
   */
  public async sendUnreadCountUpdate(userId: number): Promise<void> {
    try {
      // Verificar se usuário está online
      if (!this.isUserOnline(userId)) {
        return;
      }

      // Calcular contador de não lidas
      const [{ count: unreadCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.user_id, userId),
          isNull(notifications.read_at)
        ));

      // Enviar atualização via WebSocket
      const userClients = this.clients.get(userId)!;
      for (const client of userClients) {
        if (client.readyState === WebSocket.OPEN) {
          const message = {
            type: 'unread_count_update',
            unreadCount
          };
          client.send(JSON.stringify(message));
          console.log(`[🔔 CONTADOR] ✅ Contador atualizado via WebSocket para usuário ${userId}: ${unreadCount}`);
        }
      }
    } catch (error) {
      logNotificationError(
        'Counter update via WebSocket failed',
        error,
        'warning',
        { userId }
      );
    }
  }

  /**
   * 🔥 OTIMIZAÇÃO: Envia contador para múltiplos usuários em uma única query
   * Resolve N+1 issue em sendNotificationToUsers
   */
  private async sendUnreadCountUpdateBatch(userIds: number[]): Promise<void> {
    if (!userIds.length) return;

    try {
      // Buscar contadores de todos os usuários em UMA query
      const counts = await db
        .select({
          user_id: notifications.user_id,
          count: sql<number>`count(*)::int`
        })
        .from(notifications)
        .where(and(
          inArray(notifications.user_id, userIds),
          isNull(notifications.read_at)
        ))
        .groupBy(notifications.user_id);

      // Criar mapa de user_id -> count
      const countMap = new Map<number, number>();
      counts.forEach(c => countMap.set(c.user_id, c.count));

      // Enviar para cada usuário via WebSocket
      for (const userId of userIds) {
        if (!this.isUserOnline(userId)) continue;

        const unreadCount = countMap.get(userId) || 0;
        const userClients = this.clients.get(userId)!;
        
        for (const client of userClients) {
          if (client.readyState === WebSocket.OPEN) {
            const message = {
              type: 'unread_count_update',
              unreadCount
            };
            client.send(JSON.stringify(message));
            console.log(`[🔔 CONTADOR BATCH] ✅ Contador atualizado para usuário ${userId}: ${unreadCount}`);
          }
        }
      }
    } catch (error) {
      logNotificationError(
        'Batch counter update via WebSocket failed',
        error,
        'warning',
        { userIds }
      );
    }
  }

  /**
   * Persiste notificações para múltiplos usuários de uma vez
   * Resolve N+1 query issue em broadcast
   */
  private async persistNotificationsBatch(userIds: number[], payload: NotificationPayload): Promise<PersistentNotification[]> {
    if (!userIds.length) return [];

    try {
      console.log(`[💾 PERSISTÊNCIA BULK] Salvando notificações para ${userIds.length} usuários`);

      const validatedPriority = validatePriority(payload.priority);

      const values = userIds.map(userId => ({
        user_id: userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: validatedPriority,
        ticket_id: payload.ticketId || null,
        ticket_code: payload.ticketCode || null,
        metadata: payload.metadata || null,
        read_at: null
      }));

      const insertedNotifications = await db
        .insert(notifications)
        .values(values)
        .returning();

      console.log(`[💾 PERSISTÊNCIA BULK] ✅ ${insertedNotifications.length} notificações salvas`);

      return insertedNotifications.map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        ticketId: n.ticket_id ?? undefined,
        ticketCode: n.ticket_code ?? undefined,
        metadata: n.metadata,
        readAt: n.read_at ?? undefined,
        createdAt: n.created_at,
      }));

    } catch (error) {
      logNotificationError(
        'Batch notification persistence failed',
        error,
        'critical',
        { userCount: userIds.length, type: payload.type }
      );
      return [];
    }
  }

  /**
   * Envia notificação para múltiplos usuários de uma vez
   * Resolve N+1 query performance issues
   */
  public async sendNotificationToUsers(userIds: number[], payload: NotificationPayload): Promise<void> {
    if (!userIds.length) return;

    // Remover duplicados
    const uniqueUserIds = [...new Set(userIds)];
    console.log(`[🔔 NOTIFICAÇÃO BULK] 🚀 INICIANDO notificação para ${uniqueUserIds.length} usuários, tipo: ${payload.type}`);

    // 1. Persistir notificações em lote
    const persistedNotifications = await this.persistNotificationsBatch(uniqueUserIds, payload);

    // Mapa para acesso rápido à notificação persistida por userId
    const notificationMap = new Map<number, PersistentNotification>();
    persistedNotifications.forEach(n => notificationMap.set(n.userId, n));

    // 2. Websocket e coleta de offline users
    const offlineUserIds: number[] = [];
    const onlineUserIds: number[] = [];

    for (const userId of uniqueUserIds) {
      try {
        if (this.clients.has(userId)) {
          const userClients = this.clients.get(userId)!;
          let sent = false;

          for (const client of userClients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'notification',
                notification: payload
              }));
              sent = true;
            }
          }

          if (sent) {
            onlineUserIds.push(userId);
          }
        } else {
          offlineUserIds.push(userId);
        }
      } catch (wsError) {
        console.error(`[🔔 WEBSOCKET] Erro ao enviar para usuário ${userId}`, wsError);
      }
    }

    // 🔥 OTIMIZAÇÃO: Atualizar contadores em BATCH ao invés de N queries
    if (onlineUserIds.length > 0) {
      await this.sendUnreadCountUpdateBatch(onlineUserIds);
    }

    // 3. Web Push para usuários offline (em lote)
    // 🔥 OTIMIZAÇÃO N+1: Buscar subscriptions em batch e enviar usando método otimizado
    if (offlineUserIds.length > 0) {
      console.log(`[📱 WEB PUSH BULK] Processando ${offlineUserIds.length} usuários offline`);
      try {
        const subscriptionsMap = await webPushService.getSubscriptionsBatch(offlineUserIds);

        // Enviar usando subscriptions já buscadas (evita N+1)
        for (const userId of offlineUserIds) {
          const subs = subscriptionsMap.get(userId);
          const notification = notificationMap.get(userId);

          if (subs && subs.length > 0 && notification) {
            // ✅ Usar método otimizado que aceita subscriptions já buscadas
            await webPushService.sendPushNotificationWithSubscriptions(userId, notification, subs);
          }
        }
      } catch (wpError) {
        console.error('Erro no processamento batch de Web Push', wpError);
      }
    }
  }

  // Método para adicionar uma conexão WebSocket
  public addClient(ws: WebSocketWithUser, userId: number, userRole: string): void {
    ws.userId = userId;
    ws.userRole = userRole;

    console.log(`[🔔 WEBSOCKET] 🔌 ADICIONANDO cliente WebSocket para usuário ID: ${userId}, Função: ${userRole}`);

    // Adicionar ao grupo específico com base na função
    if (userRole === 'admin') {
      this.adminClients.push(ws);
      console.log(`[🔔 WEBSOCKET] 👑 Usuário ${userId} adicionado aos ADMINS`);
    } else if (userRole === 'support') {
      this.supportClients.push(ws);
      console.log(`[🔔 WEBSOCKET] 🛠️ Usuário ${userId} adicionado ao SUPORTE`);
    }

    // Adicionar à lista de clientes por ID do usuário
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(ws);

    console.log(`[🔔 WEBSOCKET] ✅ Cliente WebSocket REGISTRADO para usuário ID: ${userId}`);
    console.log(`[🔔 WEBSOCKET] 📊 Total de clientes WebSocket conectados: ${this.getTotalClients()}`);
    console.log(`[🔔 WEBSOCKET] 📊 Usuário ${userId} agora tem ${this.clients.get(userId)!.length} conexões`);
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
      logNotificationError(
        'Failed to check notification settings by type',
        error,
        'warning',
        { userId, notificationType }
      );
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
      logNotificationError(
        'Failed to check user notification settings',
        error,
        'warning',
        { userId, notificationType }
      );
      return true; // Em caso de erro, permitir notificação
    }
  }

  // Enviar notificação para um usuário específico (com verificação de configurações)
  public async sendNotificationToUser(userId: number, payload: NotificationPayload): Promise<void> {
    console.log(`[🔔 NOTIFICAÇÃO] 🚀 INICIANDO notificação para usuário ${userId}, tipo: ${payload.type}`);

    // 🔥 VALIDAÇÃO: Verificar se userId existe na tabela users
    try {
      const [userExists] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userExists) {
        console.error(`[🔔 NOTIFICAÇÃO] ❌ Usuário ${userId} não encontrado na tabela users. Verifique se está passando user_id e não customer_id ou official_id.`);
        logNotificationError(
          'User ID validation failed',
          new Error(`User ${userId} not found in users table`),
          'error',
          { userId, notificationType: payload.type, ticketId: payload.ticketId }
        );
        return;
      }
    } catch (validationError) {
      console.error(`[🔔 NOTIFICAÇÃO] ❌ Erro ao validar userId ${userId}:`, validationError);
      logNotificationError(
        'User ID validation error',
        validationError,
        'error',
        { userId, notificationType: payload.type }
      );
      return;
    }

    // 1. PERSISTIR NOTIFICAÇÃO PRIMEIRO (Requirements 1.1, 1.2, 1.3)
    console.log(`[🔔 NOTIFICAÇÃO] 💾 Tentando persistir notificação no banco de dados...`);
    const persistedNotification = await this.persistNotification(userId, payload);

    if (!persistedNotification) {
      console.error(`[🔔 NOTIFICAÇÃO] ⚠️ Falha na persistência, mas continuando com WebSocket (Requirement 7.3)`);
      console.error(`[🔔 NOTIFICAÇÃO] ⚠️ Detalhes: userId=${userId}, type=${payload.type}, ticketId=${payload.ticketId || 'N/A'}`);
    } else {
      console.log(`[🔔 NOTIFICAÇÃO] ✅ Notificação persistida com sucesso: ID=${persistedNotification.id}`);
    }

    // 2. ENTREGAR VIA WEBSOCKET - SEMPRE TENTAR PRIMEIRO! (Requirement 1.2)
    try {
      console.log(`[🔔 WEBSOCKET] 🔍 Verificando se usuário ${userId} está online...`);

      if (this.clients.has(userId)) {
        const userClients = this.clients.get(userId)!;
        console.log(`[🔔 WEBSOCKET] 📱 Usuário ${userId} tem ${userClients.length} clientes WebSocket`);

        let notificationSent = false;
        for (const client of userClients) {
          if (client.readyState === WebSocket.OPEN) {
            // Enviar no formato esperado pelo cliente
            const message = {
              type: 'notification',
              notification: payload
            };
            client.send(JSON.stringify(message));
            console.log(`[🔔 WEBSOCKET] ✅ Notificação ENVIADA via WebSocket para usuário ${userId}`);
            notificationSent = true;
          } else {
            console.log(`[🔔 WEBSOCKET] ⚠️ Cliente WebSocket não está aberto (readyState: ${client.readyState})`);
          }
        }

        if (notificationSent) {
          // 🔥 SINCRONIZAÇÃO DE CONTADOR VIA WEBSOCKET (Requirement 6.5)
          // Após criar notificação, enviar contador atualizado via WebSocket
          await this.sendUnreadCountUpdate(userId);
        }
      } else {
        console.log(`[🔔 WEBSOCKET] 📴 Usuário ${userId} NÃO TEM clientes WebSocket registrados (usuário offline)`);
        console.log(`[🔔 WEBSOCKET] 📴 Notificação foi persistida no banco e aparecerá quando o usuário acessar o sistema`);
      }
    } catch (error) {
      console.error(`[🔔 WEBSOCKET] ❌ ERRO ao enviar via WebSocket:`, error);
      // Requirement 7.1: Se WebSocket falhar, registrar mas continuar com persistência
      logNotificationError(
        'WebSocket delivery failed',
        error,
        'error',
        { userId, notificationType: payload.type, ticketId: payload.ticketId }
      );
      // Continuar mesmo se WebSocket falhar (Requirement 7.1)
    }

    // 3. ENVIAR EMAIL SE HABILITADO (COM verificação de horário)
    try {
      const shouldNotifyEmail = await this.shouldNotifyUser(userId, payload.type);
      if (shouldNotifyEmail) {
        await this.sendEmailNotification(userId, payload);
      }
    } catch (error) {
      logNotificationError(
        'Email notification failed',
        error,
        'warning',
        { userId, notificationType: payload.type, ticketId: payload.ticketId }
      );
      // Continuar mesmo se email falhar
    }

    console.log(`[🔔 NOTIFICAÇÃO] 🏁 FINALIZADA notificação para usuário ${userId}, tipo: ${payload.type}`);
    console.log(`[🔔 NOTIFICAÇÃO] 📊 Resumo: Persistida=${persistedNotification ? 'SIM' : 'NÃO'}, WebSocket=${this.clients.has(userId) ? 'ONLINE' : 'OFFLINE'}`);
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
      logNotificationError(
        'Email notification service failed',
        error,
        'error',
        { userId, notificationType: payload.type }
      );
    }
  }

  // Enviar notificação para todos os administradores
  public async sendNotificationToAdmins(payload: NotificationPayload, companyId?: number | null): Promise<void> {
    // 🔥 CORREÇÃO MULTI-TENANT: Filtrar por company_id
    const conditions: any[] = [
      inArray(users.role, ['admin', 'company_admin']),
      eq(users.active, true)
    ];

    // Se company_id for fornecido, filtrar apenas usuários dessa empresa
    if (companyId !== undefined && companyId !== null) {
      conditions.push(eq(users.company_id, companyId));
      console.log(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] Filtrando admins por company_id=${companyId}`);
    } else {
      console.warn(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] ⚠️ AVISO: sendNotificationToAdmins chamado sem company_id!`);
    }

    // Buscar todos os usuários admin da empresa
    const admins = await db
      .select({ id: users.id, company_id: users.company_id })
      .from(users)
      .where(and(...conditions));

    console.log(`[🔔 NOTIFICAÇÃO] Enviando para ${admins.length} administradores${companyId ? ` da empresa ${companyId}` : ''}`);

    // Enviar notificação em lote
    const adminIds = admins.map(a => a.id);
    await this.sendNotificationToUsers(adminIds, payload);
  }

  // Enviar notificação para todos os agentes de suporte
  public async sendNotificationToSupport(payload: NotificationPayload, companyId?: number | null): Promise<void> {
    // 🔥 CORREÇÃO MULTI-TENANT: Filtrar por company_id
    const supportRoles = ['support', 'manager', 'supervisor'];
    const conditions: any[] = [
      eq(users.active, true),
      inArray(users.role, supportRoles as any[])
    ];

    // Se company_id for fornecido, filtrar apenas usuários dessa empresa
    if (companyId !== undefined && companyId !== null) {
      conditions.push(eq(users.company_id, companyId));
      console.log(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] Filtrando suporte por company_id=${companyId}`);
    } else {
      console.warn(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] ⚠️ AVISO: sendNotificationToSupport chamado sem company_id!`);
    }

    // Buscar todos os usuários de suporte no banco (support, manager, supervisor)
    const supportUsers = await db
      .select({ id: users.id, role: users.role, company_id: users.company_id })
      .from(users)
      .where(and(...conditions));

    console.log(`[🔔 NOTIFICAÇÃO] Enviando para ${supportUsers.length} agentes de suporte${companyId ? ` da empresa ${companyId}` : ''}`);

    // Enviar notificação em lote
    const supportIds = supportUsers.map(s => s.id);
    await this.sendNotificationToUsers(supportIds, payload);
  }

  // Notificar todos do departamento específico (Support, Manager, Supervisor)
  public async sendNotificationToDepartment(departmentId: number, payload: NotificationPayload, companyId?: number | null): Promise<void> {
    const roles = ['support', 'manager', 'supervisor'];

    // 🔥 CORREÇÃO MULTI-TENANT: Adicionar filtro por company_id
    const conditions: any[] = [
      eq(officialDepartments.department_id, departmentId),
      eq(users.active, true),
      eq(officials.is_active, true),
      inArray(users.role, roles as any[])
    ];

    // Se company_id for fornecido, filtrar apenas usuários dessa empresa
    if (companyId !== undefined && companyId !== null) {
      conditions.push(eq(users.company_id, companyId));
      console.log(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] Filtrando departamento ${departmentId} por company_id=${companyId}`);
    } else {
      console.warn(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] ⚠️ AVISO: sendNotificationToDepartment chamado sem company_id para departamento ${departmentId}!`);
    }

    // Buscar usuários do departamento com as roles corretas
    const departmentUsers = await db
      .select({ id: users.id, company_id: users.company_id })
      .from(users)
      .innerJoin(officials, eq(users.id, officials.user_id))
      .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
      .where(and(...conditions));

    console.log(`[🔔 NOTIFICAÇÃO] Buscando usuários do departamento ${departmentId}${companyId ? ` da empresa ${companyId}` : ''} com roles: ${roles.join(', ')}`);
    console.log(`[🔔 NOTIFICAÇÃO] Encontrados ${departmentUsers.length} usuários do departamento ${departmentId}`);

    if (departmentUsers.length > 0) {
      const userIds = departmentUsers.map(u => u.id);
      console.log(`[🔔 NOTIFICAÇÃO] IDs alvo departamento: ${userIds.join(', ')}`);
      await this.sendNotificationToUsers(userIds, payload);
    } else {
      console.warn(`[🔔 NOTIFICAÇÃO] ⚠️ NENHUM usuário encontrado para departamento ${departmentId}${companyId ? ` da empresa ${companyId}` : ''} com roles appropriados`);
    }
  }

  // Método sendNotificationToAll removido - todas as notificações agora usam o sistema persistente
  // Use sendNotificationToUser, sendNotificationToSupport ou sendNotificationToAdmins

  // Notificar sobre a criação de um novo ticket
  public async notifyNewTicket(ticketId: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;

      console.log(`[🔔 NEW TICKET] 🎫 Iniciando notificação para novo ticket #${ticket.ticket_id}`);
      console.log(`[🔔 NEW TICKET] [MULTI-TENANT] Ticket da empresa company_id=${ticket.company_id}`);

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

      // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
      console.log(`[🔔 NEW TICKET] 📢 Enviando para administradores da empresa ${ticket.company_id}...`);
      await this.sendNotificationToAdmins(payload, ticket.company_id);

      // Se o ticket tem departamento, notificar apenas os atendentes daquele departamento
      if (ticket.department_id) {
        console.log(`[🔔 NEW TICKET] 📢 Enviando para departamento ${ticket.department_id} da empresa ${ticket.company_id}...`);
        await this.sendNotificationToDepartment(ticket.department_id, payload, ticket.company_id);
      } else {
        // Fallback: Se não tem departamento, notificar todos (comportamento antigo)
        console.log(`[🔔 NEW TICKET] 📢 Enviando para agentes de suporte da empresa ${ticket.company_id} (sem departamento)...`);
        await this.sendNotificationToSupport(payload, ticket.company_id);
      }

      console.log(`[🔔 NEW TICKET] ✅ Notificação enviada para novo ticket #${ticket.ticket_id}`);
    } catch (error) {
      console.error(`[🔔 NEW TICKET] ❌ Erro ao notificar novo ticket:`, error);
      logNotificationError(
        'New ticket notification failed',
        error,
        'error',
        { ticketId }
      );
    }
  }

  // 🔥 HELPER: Traduzir status para português
  private translateStatus(status: string): string {
    const statusKey = status as keyof typeof STATUS_CONFIG;
    return STATUS_CONFIG[statusKey]?.label || status;
  }

  // Notificar sobre uma atualização de status de ticket
  public async notifyTicketStatusUpdate(ticketId: number, oldStatus: string, newStatus: string): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;

      console.log(`[🔔 STATUS UPDATE] [MULTI-TENANT] Ticket da empresa company_id=${ticket.company_id}`);

      // 🔥 CORREÇÃO: Usar STATUS_CONFIG para traduzir status
      const oldStatusName = this.translateStatus(oldStatus);
      const newStatusName = this.translateStatus(newStatus);

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
        const [customer] = await db
          .select({ user_id: customers.user_id })
          .from(customers)
          .where(eq(customers.id, ticket.customer_id));

        if (customer && customer.user_id) {
          this.sendNotificationToUser(customer.user_id, payload);
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

      // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
      this.sendNotificationToAdmins(adminPayload, ticket.company_id);
      this.sendNotificationToSupport(adminPayload, ticket.company_id);

      console.log(`Notificação enviada para atualização de status do ticket #${ticket.ticket_id}`);
    } catch (error) {
      logNotificationError(
        'Ticket status update notification failed',
        error,
        'error',
        { ticketId, newStatus }
      );
    }
  }

  // Notificar sobre uma nova resposta em um ticket
  public async notifyNewReply(ticketId: number, replyUserId: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;

      console.log(`[🔔 NEW REPLY] [MULTI-TENANT] Ticket da empresa company_id=${ticket.company_id}`);

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

        // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
        this.sendNotificationToAdmins(payload, ticket.company_id);
        this.sendNotificationToSupport(payload, ticket.company_id);

        // 🔥 FASE 4.1: Notificar participantes
        const participantIds = participants.map(p => p.id);
        const participantPayload: NotificationPayload = {
          type: 'new_reply',
          title: 'Nova Resposta de Cliente',
          message: `O cliente respondeu ao ticket #${ticket.ticket_id}: "${ticket.title}".`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        await this.sendNotificationToUsers(participantIds, participantPayload);
        console.log(`[🔔 NOTIFICAÇÃO] Notificação enviada para ${participants.length} participantes`);
      }
      // Se a resposta foi do suporte/admin, notificar o cliente + participantes
      else if (replyUser.role === 'admin' || replyUser.role === 'support' || replyUser.role === 'manager' || replyUser.role === 'supervisor') {
        // Notificar o cliente
        if (ticket.customer_id) {
          const [customer] = await db
            .select({ user_id: customers.user_id })
            .from(customers)
            .where(eq(customers.id, ticket.customer_id));

          if (customer && customer.user_id) {
            const payload: NotificationPayload = {
              type: 'new_reply',
              title: 'Nova Resposta no Seu Ticket',
              message: `Há uma nova resposta no seu ticket "${ticket.title}".`,
              ticketId: ticket.id,
              ticketCode: ticket.ticket_id,
              timestamp: new Date(),
              priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
            };

            this.sendNotificationToUser(customer.user_id, payload);
          }
        }

        // 🔥 FASE 4.1: Notificar participantes
        const participantIds = participants.map(p => p.id);
        const participantPayload: NotificationPayload = {
          type: 'new_reply',
          title: 'Nova Resposta de Atendente',
          message: `Há uma nova resposta no ticket #${ticket.ticket_id}: "${ticket.title}".`,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id,
          timestamp: new Date(),
          priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
        };

        await this.sendNotificationToUsers(participantIds, participantPayload);
        console.log(`[🔔 NOTIFICAÇÃO] Notificação enviada para ${participants.length} participantes`);
      }

      console.log(`Notificação enviada para nova resposta no ticket #${ticket.ticket_id}`);
    } catch (error) {
      logNotificationError(
        'New ticket reply notification failed',
        error,
        'error',
        { ticketId }
      );
    }
  }

  // Notificar administradores sobre novo usuário
  public async notifyNewUserCreated(userId: number, createdByUserId?: number): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return;

      console.log(`[🔔 NEW USER] [MULTI-TENANT] Novo usuário da empresa company_id=${user.company_id}`);

      let createdByName = 'Sistema';
      if (createdByUserId) {
        const [admin] = await db.select().from(users).where(eq(users.id, createdByUserId));
        if (admin) createdByName = admin.name;
      }

      const payload: NotificationPayload = {
        type: 'new_user',
        title: 'Novo Usuário Criado',
        message: `O usuário ${user.name} (${user.email}) foi criado por ${createdByName}.`,
        timestamp: new Date(),
        priority: 'medium'
      };

      // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do usuário
      await this.sendNotificationToAdmins(payload, user.company_id);
      console.log(`[🔔 NOTIFICAÇÃO] Notificação de novo usuário enviada para admins da empresa ${user.company_id}`);
    } catch (error) {
      logNotificationError(
        'New user notification failed',
        error,
        'error',
        { userId }
      );
    }
  }

  // Notificar todos os usuários sobre manutenção
  public async notifySystemMaintenance(message: string, scheduledFor: Date, companyId?: number | null): Promise<void> {
    try {
      const payload: NotificationPayload = {
        type: 'system_maintenance',
        title: 'Manutenção do Sistema',
        message: message,
        timestamp: new Date(),
        priority: 'high',
        metadata: { scheduledFor }
      };

      // 🔥 CORREÇÃO MULTI-TENANT: Filtrar por company_id se fornecido
      const conditions: any[] = [eq(users.active, true)];
      
      if (companyId !== undefined && companyId !== null) {
        conditions.push(eq(users.company_id, companyId));
        console.log(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] Filtrando manutenção por company_id=${companyId}`);
      } else {
        console.log(`[🔔 NOTIFICAÇÃO] [MULTI-TENANT] Manutenção GLOBAL - notificando todas as empresas`);
      }

      // Notificar todos os usuários ativos (com filtro de empresa se fornecido)
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(...conditions));

      console.log(`[🔔 NOTIFICAÇÃO] Enviando aviso de manutenção para ${allUsers.length} usuários${companyId ? ` da empresa ${companyId}` : ' (todas as empresas)'}`);

      const allUserIds = allUsers.map(u => u.id);
      await this.sendNotificationToUsers(allUserIds, payload);
    } catch (error) {
      logNotificationError(
        'System maintenance notification failed',
        error,
        'error',
        { message }
      );
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

      const otherParticipantIds = otherParticipants.map(p => p.id);
      const otherParticipantPayload: NotificationPayload = {
        type: 'participant_added',
        title: 'Novo participante adicionado',
        message: `${participant.name} foi adicionado como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${addedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };

      await this.sendNotificationToUsers(otherParticipantIds, otherParticipantPayload);
      console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para ${otherParticipants.length} outros participantes`);

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

        // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
        await this.sendNotificationToSupport(departmentPayload, ticket.company_id);
        await this.sendNotificationToAdmins(departmentPayload, ticket.company_id);
      }

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participante adicionado concluída`);

    } catch (error) {
      logNotificationError(
        'Participant added notification failed',
        error,
        'error',
        { ticketId, participantUserId }
      );
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

      const otherParticipantIds = otherParticipants.map(p => p.id);
      const otherParticipantPayload: NotificationPayload = {
        type: 'participant_removed',
        title: 'Participante removido do ticket',
        message: `${participant.name} foi removido como participante do ticket #${ticket.ticket_id}: "${ticket.title}" por ${removedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: ticket.priority as 'low' | 'medium' | 'high' | 'critical'
      };

      await this.sendNotificationToUsers(otherParticipantIds, otherParticipantPayload);
      console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para ${otherParticipants.length} outros participantes`);

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

        // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
        await this.sendNotificationToSupport(departmentPayload, ticket.company_id);
        await this.sendNotificationToAdmins(departmentPayload, ticket.company_id);
      }

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participante removido concluída`);

    } catch (error) {
      logNotificationError(
        'Participant removed notification failed',
        error,
        'error',
        { ticketId, participantUserId }
      );
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

      const participantIds = participants.map(p => p.id);
      await this.sendNotificationToUsers(participantIds, payload);
      console.log(`[🔔 WEBSOCKET] ✅ Notificação enviada para ${participants.length} participantes`);

      console.log(`[🔔 WEBSOCKET] ✅ Notificação de participantes concluída`);

    } catch (error) {
      logNotificationError(
        'Participants notification failed',
        error,
        'error',
        { ticketId }
      );
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

      // 🔥 CORREÇÃO: Traduzir status antes de usar na mensagem
      const oldStatusTranslated = this.translateStatus(oldStatus);
      const newStatusTranslated = this.translateStatus(newStatus);

      // Determinar prioridade baseada no novo status
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let title = 'Status do Ticket Alterado';
      let message = `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatusTranslated}" para "${newStatusTranslated}" por ${changedBy.name}.`;

      // 🔥 MELHORIA: Mensagem específica para ticket resolvido
      if (newStatus === 'resolved') {
        priority = 'low';
        title = 'Ticket Resolvido';
        message = `O ticket #${ticket.ticket_id}: "${ticket.title}" foi resolvido por ${changedBy.name}.`;
      } else if (newStatus === 'in_progress') {
        priority = 'high';
      } else if (newStatus === 'pending') {
        priority = 'medium';
      }

      // Criar payload de notificação
      const payload: NotificationPayload = {
        type: 'status_change',
        title: title,
        message: message,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority
      };

      // Notificar o cliente (se aplicável)
      if (ticket.customer_id) {
        // 🔥 CORREÇÃO: Converter customer_id para user_id
        const [customer] = await db
          .select({ user_id: customers.user_id })
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);

        if (customer?.user_id && customer.user_id !== changedByUserId) {
          this.sendNotificationToUser(customer.user_id, payload);
        }
      }

      // 🔥 FASE 4.2: Notificar participantes
      const participantIds = participants.map(p => p.id);
      const participantPayload: NotificationPayload = {
        type: 'status_change',
        title: 'Status do Ticket Alterado',
        message: `O status do ticket #${ticket.ticket_id}: "${ticket.title}" foi alterado de "${oldStatusTranslated}" para "${newStatusTranslated}" por ${changedBy.name}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority
      };

      await this.sendNotificationToUsers(participantIds, participantPayload);
      console.log(`[🔔 NOTIFICAÇÃO] Notificação de mudança de status enviada para ${participants.length} participantes`);

      // Notificar administradores e suporte (se não for quem mudou)
      if (changedBy.role !== 'admin' && changedBy.role !== 'support' && changedBy.role !== 'manager' && changedBy.role !== 'supervisor') {
        // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
        this.sendNotificationToAdmins(payload, ticket.company_id);
        this.sendNotificationToSupport(payload, ticket.company_id);
      }

      console.log(`Notificação enviada para mudança de status no ticket #${ticket.ticket_id}`);
    } catch (error) {
      logNotificationError(
        'Status change notification failed',
        error,
        'error',
        { ticketId, oldStatus, newStatus }
      );
    }
  }

  // Notificar sobre vencimento de SLA (ticket próximo do vencimento)
  public async notifyTicketDueSoon(ticketId: number, hoursUntilDue: number): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;

      // Criar mensagem baseada nas horas até o vencimento
      let message = '';
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

      if (hoursUntilDue <= 1) {
        message = `O ticket #${ticket.ticket_id} vence em menos de 1 hora. Ação imediata necessária.`;
        priority = 'critical';
      } else if (hoursUntilDue <= 4) {
        message = `O ticket #${ticket.ticket_id} vence em ${hoursUntilDue} horas. Atenção urgente necessária.`;
        priority = 'high';
      } else if (hoursUntilDue <= 24) {
        message = `O ticket #${ticket.ticket_id} vence em ${hoursUntilDue} horas. Verifique o status.`;
        priority = 'high';
      } else {
        const days = Math.ceil(hoursUntilDue / 24);
        message = `O ticket #${ticket.ticket_id} vence em aproximadamente ${days} dias.`;
        priority = 'medium';
      }

      const payload: NotificationPayload = {
        type: 'ticket_due_soon',
        title: 'Ticket Próximo do Vencimento',
        message: message,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority,
        metadata: {
          hoursUntilDue,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id
        }
      };

      // Notificar atendente atribuído (se houver)
      if (ticket.assigned_to_id) {
        const [official] = await db
          .select({ user_id: officials.user_id })
          .from(officials)
          .where(eq(officials.id, ticket.assigned_to_id))
          .limit(1);

        if (official?.user_id) {
          await this.sendNotificationToUser(official.user_id, payload);
        }
      }

      // Notificar atendentes do departamento
      if (ticket.department_id) {
        // 🔥 CORREÇÃO: Buscar user_id do atendente atribuído para excluir corretamente
        let assignedUserId: number | null = null;
        if (ticket.assigned_to_id) {
          const [assignedOfficial] = await db
            .select({ user_id: officials.user_id })
            .from(officials)
            .where(eq(officials.id, ticket.assigned_to_id))
            .limit(1);
          assignedUserId = assignedOfficial?.user_id || null;
        }

        const departmentUsers = await db
          .select({
            id: users.id,
            name: users.name
          })
          .from(users)
          .innerJoin(officials, eq(users.id, officials.user_id))
          .innerJoin(officialDepartments, eq(officials.id, officialDepartments.official_id))
          .where(and(
            eq(officialDepartments.department_id, ticket.department_id),
            eq(users.active, true),
            eq(officials.is_active, true),
            inArray(users.role, ['admin', 'support', 'manager', 'supervisor'] as any[]),
            assignedUserId ? ne(users.id, assignedUserId) : undefined
          ));

        const departmentUserIds = departmentUsers.map(u => u.id);
        await this.sendNotificationToUsers(departmentUserIds, payload);
      }

      console.log(`[🔔 NOTIFICAÇÃO] ✅ Notificação de vencimento de SLA enviada para ticket #${ticket.ticket_id}`);
    } catch (error) {
      logNotificationError(
        'Ticket due soon notification failed',
        error,
        'error',
        { ticketId, hoursUntilDue }
      );
    }
  }

  // Notificar sobre escalação de ticket
  public async notifyTicketEscalated(ticketId: number, escalatedByUserId?: number, reason?: string): Promise<void> {
    try {
      // Obter os detalhes do ticket
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
      if (!ticket) return;

      // Obter detalhes de quem escalou (se houver)
      let escalatedBy: any = null;
      if (escalatedByUserId) {
        const [user] = await db.select().from(users).where(eq(users.id, escalatedByUserId));
        escalatedBy = user;
      }

      const payload: NotificationPayload = {
        type: 'ticket_escalated',
        title: 'Ticket Escalado',
        message: reason || `O ticket #${ticket.ticket_id} foi escalado${escalatedBy ? ` por ${escalatedBy.name}` : ''}.`,
        ticketId: ticket.id,
        ticketCode: ticket.ticket_id,
        timestamp: new Date(),
        priority: 'high',
        metadata: {
          reason,
          escalatedByUserId,
          ticketId: ticket.id,
          ticketCode: ticket.ticket_id
        }
      };

      // Notificar o cliente
      if (ticket.customer_id) {
        const [customer] = await db
          .select({ user_id: customers.user_id })
          .from(customers)
          .where(eq(customers.id, ticket.customer_id))
          .limit(1);

        if (customer?.user_id) {
          await this.sendNotificationToUser(customer.user_id, payload);
        }
      }

      // 🔥 CORREÇÃO MULTI-TENANT: Passar company_id do ticket
      await this.sendNotificationToAdmins(payload, ticket.company_id);
      await this.sendNotificationToSupport(payload, ticket.company_id);

      // Notificar participantes
      const participants = await db
        .select({
          id: users.id,
          name: users.name
        })
        .from(users)
        .innerJoin(ticketParticipants, eq(users.id, ticketParticipants.user_id))
        .where(and(
          eq(ticketParticipants.ticket_id, ticketId),
          eq(users.active, true)
        ));

      const participantIds = participants.map(p => p.id);
      await this.sendNotificationToUsers(participantIds, payload);

      console.log(`[🔔 NOTIFICAÇÃO] ✅ Notificação de escalação enviada para ticket #${ticket.ticket_id}`);
    } catch (error) {
      logNotificationError(
        'Ticket escalated notification failed',
        error,
        'error',
        { ticketId, escalatedByUserId }
      );
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
