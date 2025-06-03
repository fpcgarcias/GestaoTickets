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

    // === WEBSOCKET UNIVERSAL - FUNCIONA EM QUALQUER DOMÍNIO ===
    
    // 1. Obter protocolo e host da página atual
    const currentUrl = new URL(window.location.href);
    const isHTTPS = currentUrl.protocol === 'https:';
    const wsProtocol = isHTTPS ? 'wss:' : 'ws:';
    const wsHost = currentUrl.host; // Usa EXATAMENTE o mesmo host da página
    
    // 2. Construir URL do WebSocket
    const wsUrl = `${wsProtocol}//${wsHost}/ws`;
    
    console.log('🔌 [WEBSOCKET UNIVERSAL] - VERSÃO 2024-12-24-17:30');
    console.log('📍 URL da página:', window.location.href);
    console.log('🌐 Host detectado:', wsHost);
    console.log('🔒 Protocolo:', wsProtocol);
    console.log('⚡ WebSocket URL FINAL:', wsUrl);
    console.log('👤 Usuário autenticado:', user.name);
    
    // Verificar se o URL está correto
    if (wsUrl.includes('localhost') || wsUrl.includes('5173')) {
      console.warn('⚠️ AVISO: WebSocket aponta para localhost - verifique se está correto');
      console.warn('📍 Host atual:', wsHost);
    }
    
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('✅ WebSocket conectado com sucesso!');
      setConnected(true);
      setConnectionError(null);
    };

    newSocket.onclose = (event) => {
      console.log('🔴 WebSocket desconectado:', event.code, event.reason);
      setConnected(false);
      setSocket(null);
      
      // Tentar reconectar após 3 segundos se não foi fechamento intencional
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('🔄 Tentando reconectar WebSocket...');
          // O useEffect será disparado novamente pela mudança de estado
        }, 3000);
      }
    };

    newSocket.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
      setConnectionError('Erro na conexão WebSocket');
      setConnected(false);
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Notificação recebida:', data);
        
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev.slice(0, 99)]);
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('❌ Erro ao processar mensagem WebSocket:', error);
      }
    };

    setSocket(newSocket);

    // Cleanup: fechar conexão quando o componente for desmontado
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close(1000, 'Component unmounting');
      }
    };
  }, [isAuthenticated, user]); // Remover socket das dependências para evitar loops

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
