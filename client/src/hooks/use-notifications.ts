import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  ticketId?: number;
  ticketCode?: string;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Inicializar a conexão WebSocket
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Se o usuário não estiver autenticado, não conectar
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Configurar o WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // O WebSocket deve usar o mesmo host e porta do servidor atual
    // já que frontend e backend rodam juntos na mesma porta
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const newSocket = new WebSocket(wsUrl);

    // Configurar os manipuladores de eventos
    newSocket.onopen = () => {
      console.log('Conexão WebSocket estabelecida');
      setConnected(true);
      
      // Enviar mensagem de autenticação
      const authMessage = {
        type: 'auth',
        userId: user.id,
        userRole: user.role,
      };
      newSocket.send(JSON.stringify(authMessage));
    };

    newSocket.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as NotificationPayload;
        console.log('Notificação recebida:', notification);
        
        // Adicionar à lista de notificações
        setNotifications((prev) => [notification, ...prev]);
        
        // Incrementar a contagem de notificações não lidas para notificações não welcome
        if (notification.type !== 'welcome') {
          setUnreadCount(count => count + 1);
          
          let variant: 'default' | 'destructive' | null = 'default';
          
          // Determinar a variação do toast com base na prioridade
          if (notification.priority === 'high' || notification.priority === 'critical') {
            variant = 'destructive';
          }
          
          toast({
            title: notification.title,
            description: notification.message,
            variant: variant === null ? undefined : variant,
          });
        }
      } catch (error) {
        console.error('Erro ao processar notificação:', error);
      }
    };

    newSocket.onclose = () => {
      console.log('Conexão WebSocket fechada');
      setConnected(false);
    };

    newSocket.onerror = (error) => {
      console.error('Erro na conexão WebSocket:', error);
      setConnected(false);
    };

    setSocket(newSocket);

    // Limpar ao desmontar
    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [isAuthenticated, user, toast]);

  // Função para marcar todas as notificações como lidas
  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  return {
    connected,
    notifications,
    unreadCount,
    markAllAsRead,
  };
}
