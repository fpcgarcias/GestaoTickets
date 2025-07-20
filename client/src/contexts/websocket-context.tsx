import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { config } from '@/lib/config';

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
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
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
      }
    };

    newSocket.onclose = (event) => {
      setConnected(false);
      setSocket(null);
      if (event.code !== 1000 && isAuthenticated) {
        setTimeout(() => {}, 3000);
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
          let toastVariant: 'default' | 'destructive' = 'default';
          let toastTitle = notification.title;
          let toastDescription = notification.message;

          // Personalizar toast baseado no tipo de notificação
          switch (notification.type) {
            case 'participant_added':
              toastVariant = 'default';
              toastTitle = '👥 Participante Adicionado';
              break;
            case 'participant_removed':
              toastVariant = 'destructive';
              toastTitle = '👥 Participante Removido';
              break;
            case 'new_reply':
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
              toastTitle = '💬 Nova Resposta';
              break;
            case 'status_change':
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
              toastTitle = '🔄 Status Alterado';
              break;
            default:
              toastVariant = notification.priority === 'critical' ? 'destructive' : 'default';
          }

          setNotifications(prev => [notification, ...prev.slice(0, 99)]);
          setUnreadCount(prev => prev + 1);
          
          if (notification.title && notification.message) {
            toast({
              title: toastTitle,
              description: toastDescription,
              variant: toastVariant
            });
          }
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