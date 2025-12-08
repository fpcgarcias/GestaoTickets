import { useState, useCallback, useEffect } from 'react';
import { useWebSocketContext } from '@/contexts/websocket-context';
import { config } from '@/lib/config';

/**
 * Interface para notificação persistente
 * Requirements: 1.4, 2.1, 2.3, 2.4, 6.5
 */
export interface PersistentNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ticketId?: number;
  ticketCode?: string;
  metadata?: Record<string, any>;
  readAt?: string | null;
  createdAt: string;
}

/**
 * Interface para filtros de notificação
 */
export interface NotificationFilters {
  type?: string;
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Interface de retorno do hook useNotifications
 * Requirements: 1.4, 2.1, 2.3, 2.4, 6.5
 */
export interface UseNotificationsReturn {
  // Estado de notificações persistentes
  notifications: PersistentNotification[];
  loading: boolean;
  hasMore: boolean;
  
  // WebSocket (funcionalidades existentes mantidas)
  connected: boolean;
  unreadCount: number;
  
  // Ações de gerenciamento
  loadMore: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Filtros
  setFilters: (filters: NotificationFilters) => void;
  filters: NotificationFilters;
}

/**
 * Hook estendido para gerenciamento de notificações
 * Combina funcionalidades WebSocket existentes com persistência e gerenciamento
 * 
 * Requirements:
 * - 1.4: Recuperação de notificações não lidas na conexão
 * - 2.1: Marcação de notificações como lidas
 * - 2.3: Marcação em lote de todas como lidas
 * - 2.4: Exclusão de notificações
 * - 6.5: Sincronização de contador via WebSocket
 */
export function useNotifications(): UseNotificationsReturn {
  // Obter funcionalidades WebSocket existentes
  const wsContext = useWebSocketContext();
  
  // Estado de notificações persistentes
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<NotificationFilters>({});
  
  /**
   * Carrega notificações do servidor
   * Requirements: 1.4, 1.5
   */
  const loadNotifications = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      setLoading(true);
      
      // Construir query params com filtros
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (filters.type) params.append('type', filters.type);
      if (filters.read !== undefined) params.append('read', filters.read.toString());
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.search) params.append('search', filters.search);
      
      const response = await fetch(
        `${config.apiBaseUrl}/api/notifications?${params.toString()}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar notificações: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Atualizar estado com notificações
      if (append) {
        setNotifications(prev => [...prev, ...data.notifications]);
      } else {
        setNotifications(data.notifications);
      }
      
      // Atualizar paginação
      setHasMore(data.hasMore);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('[useNotifications] Erro ao carregar notificações:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  /**
   * Carrega próxima página de notificações
   * Requirements: 1.5
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await loadNotifications(currentPage + 1, true);
  }, [loading, hasMore, currentPage, loadNotifications]);
  
  /**
   * Marca notificação como lida
   * Requirements: 2.1, 2.2, 6.5
   */
  const markAsRead = useCallback(async (id: number) => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/notifications/${id}/read`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro ao marcar notificação como lida: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Atualizar notificação localmente
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id
            ? { ...notif, readAt: new Date().toISOString() }
            : notif
        )
      );
      
      // Sincronizar contador via WebSocket (Requirement 6.5)
      // O contador será atualizado pelo WebSocket automaticamente
      
    } catch (error) {
      console.error('[useNotifications] Erro ao marcar como lida:', error);
      throw error;
    }
  }, []);
  
  /**
   * Marca todas as notificações como lidas
   * Requirements: 2.3, 6.5
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/notifications/read-all`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro ao marcar todas como lidas: ${response.status}`);
      }
      
      // Atualizar todas as notificações localmente
      const now = new Date().toISOString();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, readAt: now }))
      );
      
      // Sincronizar contador via WebSocket (Requirement 6.5)
      // O contador será atualizado pelo WebSocket automaticamente
      
    } catch (error) {
      console.error('[useNotifications] Erro ao marcar todas como lidas:', error);
      throw error;
    }
  }, []);
  
  /**
   * Exclui uma notificação
   * Requirements: 2.4
   */
  const deleteNotification = useCallback(async (id: number) => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/notifications/${id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro ao excluir notificação: ${response.status}`);
      }
      
      // Remover notificação localmente
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      
    } catch (error) {
      console.error('[useNotifications] Erro ao excluir notificação:', error);
      throw error;
    }
  }, []);
  
  /**
   * Recarrega notificações do início
   * Requirements: 1.4
   */
  const refresh = useCallback(async () => {
    setCurrentPage(1);
    setHasMore(true);
    await loadNotifications(1, false);
  }, [loadNotifications]);
  
  /**
   * Carrega notificações iniciais quando o hook é montado
   * Requirements: 1.4
   */
  useEffect(() => {
    loadNotifications(1, false);
  }, [loadNotifications]);
  
  /**
   * Sincroniza notificações WebSocket com estado persistente
   * Requirements: 6.5
   * 
   * Quando uma nova notificação chega via WebSocket, ela é adicionada
   * ao estado local de notificações persistentes
   */
  useEffect(() => {
    if (wsContext.notifications.length > 0) {
      const latestWsNotification = wsContext.notifications[0];
      
      // Verificar se a notificação já existe no estado persistente
      const exists = notifications.some(
        notif =>
          notif.type === latestWsNotification.type &&
          notif.ticketId === latestWsNotification.ticketId &&
          new Date(notif.createdAt).getTime() === new Date(latestWsNotification.timestamp).getTime()
      );
      
      if (!exists) {
        // Adicionar notificação WebSocket ao estado persistente
        // Nota: A notificação ainda não tem ID do banco, será atualizada no próximo refresh
        const persistentNotif: PersistentNotification = {
          id: Date.now(), // ID temporário
          userId: 0, // Será preenchido pelo servidor
          type: latestWsNotification.type,
          title: latestWsNotification.title,
          message: latestWsNotification.message,
          priority: latestWsNotification.priority || 'medium',
          ticketId: latestWsNotification.ticketId,
          ticketCode: latestWsNotification.ticketCode,
          metadata: {
            participantId: latestWsNotification.participantId,
            participantName: latestWsNotification.participantName,
            action: latestWsNotification.action,
          },
          readAt: null,
          createdAt: new Date(latestWsNotification.timestamp).toISOString(),
        };
        
        setNotifications(prev => [persistentNotif, ...prev]);
      }
    }
  }, [wsContext.notifications]);
  
  return {
    // Estado de notificações persistentes
    notifications,
    loading,
    hasMore,
    
    // WebSocket (funcionalidades existentes mantidas)
    connected: wsContext.connected,
    unreadCount: wsContext.unreadCount,
    
    // Ações de gerenciamento
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    
    // Filtros
    setFilters,
    filters,
  };
}
