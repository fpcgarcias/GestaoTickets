import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { config } from '@/lib/config';
import { useBusinessHours } from '../hooks/use-business-hours';
import { useI18n } from '@/i18n';
import { translateNotification } from '@/utils/notification-i18n';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  ticketId?: number;
  ticketCode?: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  // 🔥 FASE 4.2: Novos campos para notificações de participantes
  participantId?: number;
  participantName?: string;
  action?: 'added' | 'removed';
}

interface WebSocketContextValue {
  socket: WebSocket | null;
  connected: boolean;
  notifications: NotificationPayload[];
  unreadCount: number;
  markAllAsRead: () => void;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Usar hook dinâmico para horário comercial
  const isWithinAllowedHours = useBusinessHours();

  /**
   * Recupera notificações não lidas do servidor
   * Requirements: 1.4, 6.1
   */
  const fetchUnreadNotifications = async () => {
    if (!user || isLoadingNotifications) return;

    try {
      setIsLoadingNotifications(true);
      
      // Buscar notificações não lidas (Requirement 1.4)

      const response = await fetch(`${config.apiBaseUrl}/api/notifications?read=false&limit=100&_t=${Date.now()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar notificações: ${response.status}`);
      }

      const data = await response.json();
      

      
      // Atualizar estado local com notificações recuperadas (Requirement 1.4)
      if (data.notifications && Array.isArray(data.notifications)) {
        // Converter notificações do banco para o formato do WebSocket
        const formattedNotifications = data.notifications.map((notif: any) => ({
          type: notif.type,
          title: notif.title,
          message: notif.message,
          ticketId: notif.ticket_id,
          ticketCode: notif.ticket_code,
          timestamp: new Date(notif.created_at),
          priority: notif.priority || 'medium',
          participantId: notif.metadata?.participantId,
          participantName: notif.metadata?.participantName,
          action: notif.metadata?.action,
        }));

        // Mesclar notificações recuperadas com notificações em tempo real
        // Evitar duplicatas baseado em timestamp e tipo
        setNotifications(prev => {
          const merged = [...formattedNotifications, ...prev];
          // Remover duplicatas mantendo a primeira ocorrência
          const unique = merged.filter((notif, index, self) => 
            index === self.findIndex(n => {
              const nTime = n.timestamp instanceof Date ? n.timestamp.getTime() : new Date(n.timestamp).getTime();
              const notifTime = notif.timestamp instanceof Date ? notif.timestamp.getTime() : new Date(notif.timestamp).getTime();
              return nTime === notifTime && 
                     n.type === notif.type &&
                     n.ticketId === notif.ticketId;
            })
          );
          // Ordenar por timestamp decrescente
          return unique.sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime;
          }).slice(0, 100);
        });
      }

      // Atualizar contador de não lidas (Requirement 6.1)
      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('[WEBSOCKET] Erro ao recuperar notificações não lidas:', error);
      // Não mostrar toast de erro para não incomodar o usuário
      // O sistema continuará funcionando com notificações em tempo real
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    // 🔥 CORREÇÃO: WebSocket sempre ativo quando usuário está autenticado
    // Horário comercial afeta apenas emails, não notificações em tempo real
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const wsUrl = `${config.wsBaseUrl}/ws`;
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      setConnected(true);
      setConnectionError(null);
      if (user) {
        const authMessage = {
          type: 'auth',
          userId: user.id,
          userRole: user.role
        };
        newSocket.send(JSON.stringify(authMessage));
        
        // 🔥 CORREÇÃO: Sempre recuperar notificações não lidas ao conectar/reconectar
        // Isso garante que usuários offline vejam notificações ao voltar online
        setTimeout(() => {
          fetchUnreadNotifications();
        }, 100);
      }
    };

    newSocket.onclose = (event) => {
      setConnected(false);
      setSocket(null);
      // 🔥 CORREÇÃO: Sempre tentar reconectar se usuário ainda estiver autenticado
      if (event.code !== 1000 && isAuthenticated && user) {
        setTimeout(() => {
          // A reconexão será feita pelo useEffect principal
        }, 3000);
      }
    };

    newSocket.onerror = (error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ [WEBSOCKET] Erro na conexão:', error);
      }
      setConnectionError(`Erro na conexão WebSocket: ${wsUrl}`);
      setConnected(false);
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification') {
          const notification = data.notification;
          
          // 🔥 FASE 4.2: Tratamento especial para notificações de participantes
          // Traduzir título e mensagem da notificação
          const translated = translateNotification(notification.title, notification.message, locale);
          
          let toastVariant: 'default' | 'destructive' = 'default';
          let toastTitle = translated.title;
          let toastDescription = translated.message;

          // Personalizar toast baseado no tipo de notificação
          switch (notification.type) {
            case 'participant_added':
              toastVariant = 'default';
              toastTitle = `👥 ${formatMessage('notifications.ui.toast_participant_added')}`;
              break;
            case 'participant_removed':
              toastVariant = 'destructive';
              toastTitle = `👥 ${formatMessage('notifications.ui.toast_participant_removed')}`;
              break;
            case 'new_reply':
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
              toastTitle = `💬 ${formatMessage('notifications.ui.toast_new_reply')}`;
              break;
            case 'status_change':
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
              toastTitle = `🔄 ${formatMessage('notifications.ui.toast_status_changed')}`;
              break;
            default:
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
          }

          // Mesclar notificações em tempo real with notificações recuperadas
          // Evitar duplicatas baseado em timestamp e tipo
          setNotifications(prev => {
            const newNotif = notification;
            // Verificar se já existe uma notificação similar
            const isDuplicate = prev.some(n => {
              if (!n.timestamp || !newNotif.timestamp) return false;
              
              const nTime = n.timestamp instanceof Date ? n.timestamp.getTime() : new Date(n.timestamp).getTime();
              const newTime = newNotif.timestamp instanceof Date ? newNotif.timestamp.getTime() : new Date(newNotif.timestamp).getTime();
              
              return nTime === newTime && 
                     n.type === newNotif.type &&
                     n.ticketId === newNotif.ticketId;
            });
            
            if (isDuplicate) {
              return prev;
            }
            
            return [newNotif, ...prev.slice(0, 99)];
          });
          
          setUnreadCount(prev => prev + 1);
          
          if (notification.title && notification.message) {
            toast({
              title: toastTitle,
              description: toastDescription,
              variant: toastVariant
            });
          }
        }
        // 🔥 SINCRONIZAÇÃO DE CONTADOR VIA WEBSOCKET (Requirement 6.5)
        else if (data.type === 'unread_count_update') {
          console.log(`[WEBSOCKET] 🔢 Contador atualizado via WebSocket: ${data.unreadCount}`);
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ [WEBSOCKET] Erro ao processar mensagem:', error);
        }
      }
    };

    setSocket(newSocket);
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close(1000, 'Component unmounting');
      }
    };
  }, [isAuthenticated, user, toast]);

  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  return (
    <WebSocketContext.Provider value={{ socket, connected, notifications, unreadCount, markAllAsRead, connectionError }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  return ctx;
} 