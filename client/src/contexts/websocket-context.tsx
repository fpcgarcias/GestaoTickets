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
          setNotifications(prev => [data.notification, ...prev.slice(0, 99)]);
          setUnreadCount(prev => prev + 1);
          if (data.notification.title && data.notification.message) {
            toast({
              title: data.notification.title,
              description: data.notification.message,
              variant: data.notification.priority === 'critical' ? 'destructive' : 'default'
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