import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
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

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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

    // === WEBSOCKET COM CONFIGURAÇÃO CENTRALIZADA ===
    
    // Construir URL do WebSocket usando a configuração centralizada
    const wsUrl = `${config.wsBaseUrl}/ws`;
    
    console.log('🔌 [WEBSOCKET] Iniciando conexão - VERSÃO 2025-01-02');
    console.log('🔧 [WEBSOCKET] Ambiente:', config.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION');
    console.log('📍 [WEBSOCKET] URL da página:', window.location.href);
    console.log('⚡ [WEBSOCKET] URL WebSocket:', wsUrl);
    console.log('👤 [WEBSOCKET] Usuário autenticado:', user.name);
    
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('✅ [WEBSOCKET] Conectado com sucesso!');
      setConnected(true);
      setConnectionError(null);
      
      // Enviar mensagem de autenticação
      if (user) {
        const authMessage = {
          type: 'auth',
          userId: user.id,
          userRole: user.role
        };
        newSocket.send(JSON.stringify(authMessage));
        console.log('📤 [WEBSOCKET] Mensagem de autenticação enviada:', authMessage);
      }
    };

    newSocket.onclose = (event) => {
      console.log('🔴 [WEBSOCKET] Desconectado:', event.code, event.reason);
      setConnected(false);
      setSocket(null);
      
      // Tentar reconectar após 3 segundos se não foi fechamento intencional
      if (event.code !== 1000 && isAuthenticated) {
        setTimeout(() => {
          console.log('🔄 [WEBSOCKET] Tentando reconectar...');
          // O useEffect será disparado novamente pela mudança de estado
        }, 3000);
      }
    };

    newSocket.onerror = (error) => {
      console.error('❌ [WEBSOCKET] Erro na conexão:', error);
      setConnectionError(`Erro na conexão WebSocket: ${wsUrl}`);
      setConnected(false);
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [WEBSOCKET] Notificação recebida:', data);
        
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev.slice(0, 99)]);
          setUnreadCount(prev => prev + 1);
          
          // Mostrar toast da notificação se habilitado
          if (data.notification.title && data.notification.message) {
            toast({
              title: data.notification.title,
              description: data.notification.message,
              variant: data.notification.priority === 'critical' ? 'destructive' : 'default'
            });
          }
        }
      } catch (error) {
        console.error('❌ [WEBSOCKET] Erro ao processar mensagem:', error);
      }
    };

    setSocket(newSocket);

    // Cleanup: fechar conexão quando o componente for desmontado
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close(1000, 'Component unmounting');
      }
    };
  }, [isAuthenticated, user, toast]); // Adicionar toast nas dependências

  // Função para marcar todas as notificações como lidas
  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  return {
    connected,
    notifications,
    unreadCount,
    markAllAsRead,
    connectionError,
  };
}
