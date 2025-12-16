import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications, NotificationFilters as FilterType } from '@/hooks/use-notifications';
import { Bell, X, Trash2, CheckCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { NotificationFilters } from './notification-filters';
import { useI18n } from '@/i18n';
import { translateNotification } from '@/utils/notification-i18n';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

interface PersistentNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ticketId?: number;
  ticketCode?: string;
  readAt?: Date | string | null; // Pode ser Date (local), string (do backend) ou null
  createdAt: Date | string; // Pode ser Date (local) ou string (do backend)
}

/**
 * NotificationPanel - Painel de notificações persistentes
 * 
 * Requirements: 2.1, 2.3, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5, 10.3
 * 
 * Funcionalidades:
 * - Lista de notificações com scroll infinito
 * - Botão "Marcar todas como lidas"
 * - Botão de exclusão individual
 * - Indicador visual de notificações não lidas
 * - Navegação ao clicar em notificação de ticket
 * - Marcação automática como lida ao clicar
 * - Timestamp relativo (ex: "há 5 minutos")
 * - Estados de loading e empty state
 * - Filtros por tipo, status de leitura, período e busca textual
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ open, onClose }) => {
  const [, setLocation] = useLocation();
  const { locale, formatMessage } = useI18n();
  // 🔥 CORREÇÃO: Usar hook useNotifications para sincronizar estado e contador
  const { 
    notifications: hookNotifications, 
    markAsRead, 
    markAllAsRead, 
    refresh,
    loading: hookLoading 
  } = useNotifications();
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterType>({});
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Buscar notificações do servidor com filtros (Requirements 8.1, 8.2, 8.3, 8.4, 8.5)
  const fetchNotifications = useCallback(async (pageNum: number, append: boolean = false) => {
    if (loading) return;

    try {
      setLoading(true);
      
      // Construir query params com filtros
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      });
      
      if (filters.type) params.append('type', filters.type);
      if (filters.read !== undefined) params.append('read', filters.read.toString());
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.search) params.append('search', filters.search);
      
      const response = await fetch(
        `/api/notifications?${params.toString()}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar notificações');
      }

      const data = await response.json();
      
      // 🔥 CORREÇÃO: Mapear campos snake_case do backend para camelCase do frontend
      const formattedNotifications = data.notifications.map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        priority: notif.priority,
        ticketId: notif.ticket_id,
        ticketCode: notif.ticket_code,
        createdAt: notif.created_at ? new Date(notif.created_at) : new Date(), // Backend retorna created_at
        readAt: notif.read_at ? new Date(notif.read_at) : null, // Backend retorna read_at (null se não lida)
        metadata: notif.metadata,
      }));

      if (append) {
        setNotifications(prev => [...prev, ...formattedNotifications]);
      } else {
        setNotifications(formattedNotifications);
      }

      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, filters]);

  // Carregar notificações quando o painel abre ou filtros mudam
  useEffect(() => {
    if (open) {
      setPage(1);
      setHasMore(true);
      fetchNotifications(1, false);
      // 🔥 CORREÇÃO: Sincronizar com hook quando painel abre (sem incluir refresh nas deps para evitar loop)
      refresh().catch(err => console.error('Erro ao sincronizar notificações:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filters]);

  // Implementar scroll infinito com Intersection Observer
  useEffect(() => {
    if (!open || !hasMore || loading) return;

    const options = {
      root: scrollRef.current,
      rootMargin: '100px',
      threshold: 0.1,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchNotifications(nextPage, true);
      }
    }, options);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [open, hasMore, loading, page, fetchNotifications]);

  // Marcar todas como lidas (Requirement 2.3)
  const handleMarkAllAsRead = async () => {
    try {
      // 🔥 CORREÇÃO: Usar função do hook para sincronizar com badge
      await markAllAsRead();
      // Recarregar notificações do servidor para garantir sincronização
      await refresh();
      // Atualizar estado local do painel também
      setNotifications(prev =>
        prev.map(notif => ({
          ...notif,
          readAt: notif.readAt || new Date(),
        }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  // Marcar como lida ao clicar (Requirement 2.1, 10.3)
  const handleNotificationClick = async (notification: PersistentNotification) => {
    // Marcar como lida se ainda não foi lida
    if (!notification.readAt || notification.readAt === null) {
      try {
        // 🔥 CORREÇÃO: Usar função do hook para sincronizar com badge
        await markAsRead(notification.id);
        
        // Recarregar notificações do servidor para garantir sincronização
        await refresh();
        
        // Atualizar estado local do painel também
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notification.id
              ? { ...notif, readAt: new Date() }
              : notif
          )
        );
      } catch (error) {
        console.error('Erro ao marcar como lida:', error);
      }
    }

    // Navegar para o ticket se houver ticketId (Requirement 10.3)
    if (notification.ticketId) {
      setLocation(`/tickets/${notification.ticketId}`);
      onClose();
    }
  };

  // Excluir notificação (Requirement 2.4)
  const handleDeleteNotification = async (
    e: React.MouseEvent,
    notificationId: number
  ) => {
    e.stopPropagation(); // Evitar trigger do click da notificação

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(formatMessage('notifications.ui.delete_error'));
      }

      // Remover do estado local
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
    }
  };

  // Formatar timestamp relativo (ex: "há 5 minutos")
  const formatRelativeTime = (date: Date): string => {
    try {
      const dateFnsLocale = locale === 'en-US' ? enUS : ptBR;
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: dateFnsLocale,
      });
    } catch (error) {
      return locale === 'en-US' ? 'now' : 'agora';
    }
  };

  // Obter cor da prioridade (Requirements 9.3)
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return 'border-l-red-600 bg-red-50/50 dark:bg-red-950/20';
      case 'high':
        return 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
      case 'low':
        return 'border-l-gray-400 bg-gray-50/50 dark:bg-gray-950/20';
      default:
        return 'border-l-gray-300 bg-gray-50/50 dark:bg-gray-950/20';
    }
  };

  // Obter badge de prioridade (Requirements 9.3)
  const getPriorityBadge = (priority: string): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    switch (priority) {
      case 'critical':
        return { text: formatMessage('settings.critical'), variant: 'destructive' };
      case 'high':
        return { text: formatMessage('settings.high'), variant: 'default' };
      case 'medium':
        return { text: formatMessage('settings.medium'), variant: 'secondary' };
      case 'low':
        return { text: formatMessage('settings.low'), variant: 'outline' };
      default:
        return { text: formatMessage('settings.medium'), variant: 'secondary' };
    }
  };

  // Obter ícone do tipo de notificação
  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'new_ticket':
        return '🎫';
      case 'status_change':
        return '🔄';
      case 'new_reply':
        return '💬';
      case 'participant_added':
        return '👥';
      case 'participant_removed':
        return '👤';
      case 'ticket_escalated':
        return '⚠️';
      case 'ticket_due_soon':
        return '⏰';
      default:
        return '📢';
    }
  };

  // 🔥 CORREÇÃO: Contar notificações não lidas (readAt pode ser Date, string, null ou undefined)
  const unreadCount = notifications.filter(n => !n.readAt || n.readAt === null).length;

  // Limpar filtros
  const handleClearFilters = () => {
    setFilters({});
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span>Notificações</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </SheetTitle>
          <SheetDescription>
            Gerencie suas notificações e mantenha-se atualizado
          </SheetDescription>
        </SheetHeader>

        {/* Botões de ação */}
        <div className="mt-4 flex justify-between items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          
          {notifications.length > 0 && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Componente de filtros (Requirements 8.1, 8.2, 8.3, 8.4, 8.5) */}
        {showFilters && (
          <div className="mt-4">
            <NotificationFilters
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={handleClearFilters}
            />
          </div>
        )}

        {/* Lista de notificações */}
        <ScrollArea className="h-[calc(100vh-200px)] mt-4" ref={scrollRef}>
          <div className="space-y-2">
            {/* Loading inicial */}
            {loading && notifications.length === 0 && (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  Nenhuma notificação
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você está em dia! Não há notificações no momento.
                </p>
              </div>
            )}

            {/* Lista de notificações */}
            {notifications.map((notification) => {
              // Traduzir título e mensagem
              const translated = translateNotification(notification.title, notification.message, locale);
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'p-4 border-l-4 rounded-lg cursor-pointer transition-colors',
                    'hover:bg-muted/50',
                    getPriorityColor(notification.priority),
                    !notification.readAt && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <h4 className="font-medium text-sm truncate flex-1">
                          {translated.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          {/* Badge de prioridade (Requirements 9.3) */}
                          <Badge 
                            variant={getPriorityBadge(notification.priority).variant} 
                            className="text-xs"
                          >
                            {getPriorityBadge(notification.priority).text}
                          </Badge>
                          {!notification.readAt && (
                            <Badge variant="secondary" className="text-xs">
                              {formatMessage('notifications.ui.new')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {translated.message}
                      </p>
                      {notification.ticketCode && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatMessage('notifications.ui.ticket_label')} {notification.ticketCode}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Loading mais notificações */}
            {loading && notifications.length > 0 && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Elemento para observar scroll infinito */}
            {hasMore && !loading && notifications.length > 0 && (
              <div ref={loadMoreRef} className="h-4" />
            )}

            {/* Fim da lista */}
            {!hasMore && notifications.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Todas as notificações foram carregadas
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
