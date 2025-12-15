# Exemplos de Uso - Sistema de Notificações

Este documento fornece exemplos práticos de como usar o sistema de notificações em diferentes cenários.

## 📱 Frontend - React Components

### 1. Componente de Painel de Notificações

```tsx
import React from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export function NotificationCenter() {
  const { unreadCount, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      {/* Botão com contador */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Painel de notificações */}
      <NotificationPanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
```

### 2. Hook Personalizado para Notificações

```tsx
import { useNotifications as useBaseNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';

export function useNotificationManager() {
  const notifications = useBaseNotifications();
  const { toast } = useToast();

  // Marcar como lida e mostrar toast
  const markAsReadWithFeedback = async (id: number) => {
    try {
      await notifications.markAsRead(id);
      toast({
        title: "Notificação marcada como lida",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Erro ao marcar notificação",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    }
  };

  // Excluir com confirmação
  const deleteWithConfirmation = async (id: number) => {
    if (confirm('Deseja realmente excluir esta notificação?')) {
      try {
        await notifications.deleteNotification(id);
        toast({
          title: "Notificação excluída",
          variant: "success"
        });
      } catch (error) {
        toast({
          title: "Erro ao excluir notificação",
          variant: "destructive"
        });
      }
    }
  };

  return {
    ...notifications,
    markAsReadWithFeedback,
    deleteWithConfirmation
  };
}
```

### 3. Componente de Filtros

```tsx
import React from 'react';
import { NotificationFilters } from '@/components/notifications/notification-filters';
import { useNotifications } from '@/hooks/use-notifications';

export function NotificationFiltersExample() {
  const { filters, setFilters } = useNotifications();

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters({ ...filters, ...newFilters });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Filtrar Notificações</h3>
      
      <NotificationFilters
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* Botão para limpar filtros */}
      <button
        onClick={() => setFilters({})}
        className="text-sm text-blue-600 hover:underline"
      >
        Limpar todos os filtros
      </button>
    </div>
  );
}
```

## 🔧 Backend - Criando Notificações

### 1. Serviço de Notificações - Uso Básico

```typescript
import { NotificationService } from '@/services/notification-service';

// Instância do serviço (singleton)
const notificationService = NotificationService.getInstance();

// Exemplo 1: Notificação de novo chamado
async function notifyNewTicket(ticketId: number, customerId: number) {
  await notificationService.sendNotificationToUser(customerId, {
    type: 'new_ticket',
    title: 'Novo Chamado Criado',
    message: `Seu chamado #TK-${ticketId.toString().padStart(3, '0')} foi criado com sucesso`,
    priority: 'medium',
    ticketId: ticketId,
    ticketCode: `TK-${ticketId.toString().padStart(3, '0')}`,
    timestamp: new Date(),
    metadata: {
      customerName: 'João Silva',
      departmentId: 1,
      departmentName: 'Suporte Técnico'
    }
  });
}

// Exemplo 2: Notificação para todos os admins
async function notifyAdminsSystemMaintenance() {
  await notificationService.sendNotificationToAdmins({
    type: 'system_maintenance',
    title: 'Manutenção Programada',
    message: 'O sistema entrará em manutenção às 02:00 de amanhã',
    priority: 'high',
    timestamp: new Date(),
    metadata: {
      maintenanceStart: '2024-01-16T02:00:00Z',
      maintenanceEnd: '2024-01-16T04:00:00Z',
      affectedServices: ['tickets', 'reports']
    }
  });
}

// Exemplo 3: Notificação para equipe de suporte
async function notifyEscalatedTicket(ticketId: number, reason: string) {
  await notificationService.sendNotificationToSupport({
    type: 'ticket_escalated',
    title: 'Chamado Escalado',
    message: `Chamado #TK-${ticketId.toString().padStart(3, '0')} foi escalado`,
    priority: 'critical',
    ticketId: ticketId,
    ticketCode: `TK-${ticketId.toString().padStart(3, '0')}`,
    timestamp: new Date(),
    metadata: {
      escalatedFrom: 'Nível 1',
      escalatedTo: 'Nível 2',
      reason: reason,
      escalatedBy: 'Sistema Automático'
    }
  });
}
```

### 2. Integração com Eventos do Sistema

```typescript
// Em um controller de tickets
export class TicketController {
  
  async createTicket(req: Request, res: Response) {
    try {
      const ticketData = req.body;
      const userId = req.session.userId;
      
      // Criar o ticket
      const ticket = await ticketService.create(ticketData, userId);
      
      // Notificar o cliente
      await notificationService.sendNotificationToUser(ticket.customerId, {
        type: 'new_ticket',
        title: 'Chamado Criado',
        message: `Seu chamado ${ticket.code} foi criado e está sendo analisado`,
        priority: 'medium',
        ticketId: ticket.id,
        ticketCode: ticket.code,
        timestamp: new Date(),
        metadata: {
          customerName: ticket.customer.name,
          departmentId: ticket.departmentId,
          category: ticket.category
        }
      });
      
      // Notificar a equipe responsável
      await notificationService.sendNotificationToSupport({
        type: 'new_ticket',
        title: 'Novo Chamado Recebido',
        message: `Novo chamado ${ticket.code} de ${ticket.customer.name}`,
        priority: ticket.priority === 'critical' ? 'critical' : 'medium',
        ticketId: ticket.id,
        ticketCode: ticket.code,
        timestamp: new Date(),
        metadata: {
          customerName: ticket.customer.name,
          departmentId: ticket.departmentId,
          category: ticket.category,
          description: ticket.description.substring(0, 100)
        }
      });
      
      res.json({ success: true, ticket });
      
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
  
  async updateTicketStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, comment } = req.body;
      const userId = req.session.userId;
      
      const ticket = await ticketService.updateStatus(id, status, userId, comment);
      
      // Notificar o cliente sobre mudança de status
      await notificationService.sendNotificationToUser(ticket.customerId, {
        type: 'status_change',
        title: 'Status do Chamado Atualizado',
        message: `Seu chamado ${ticket.code} foi ${getStatusMessage(status)}`,
        priority: status === 'resolved' ? 'high' : 'medium',
        ticketId: ticket.id,
        ticketCode: ticket.code,
        timestamp: new Date(),
        metadata: {
          oldStatus: ticket.previousStatus,
          newStatus: status,
          changedBy: req.session.userName,
          comment: comment
        }
      });
      
      res.json({ success: true, ticket });
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

function getStatusMessage(status: string): string {
  const messages = {
    'in_progress': 'colocado em andamento',
    'waiting_customer': 'aguardando sua resposta',
    'resolved': 'resolvido',
    'closed': 'fechado'
  };
  return messages[status] || 'atualizado';
}
```

## 🌐 API REST - Exemplos de Requisições

### 1. Listar Notificações com Filtros

```javascript
// Buscar notificações não lidas dos últimos 7 dias
async function getRecentUnreadNotifications() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const params = new URLSearchParams({
    read: 'false',
    startDate: sevenDaysAgo.toISOString(),
    limit: '20',
    page: '1'
  });
  
  const response = await fetch(`/api/notifications?${params}`);
  const data = await response.json();
  
  console.log(`${data.unreadCount} notificações não lidas`);
  return data.notifications;
}

// Buscar notificações de chamados por texto
async function searchTicketNotifications(searchTerm: string) {
  const params = new URLSearchParams({
    type: 'new_ticket,status_change,new_reply',
    search: searchTerm,
    limit: '50'
  });
  
  const response = await fetch(`/api/notifications?${params}`);
  const data = await response.json();
  
  return data.notifications;
}
```

### 2. Gerenciamento de Notificações

```javascript
// Marcar múltiplas notificações como lidas
async function markMultipleAsRead(notificationIds: number[]) {
  const promises = notificationIds.map(id => 
    fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
  );
  
  await Promise.all(promises);
  
  // Atualizar contador
  const countResponse = await fetch('/api/notifications/unread-count');
  const { count } = await countResponse.json();
  
  return count;
}

// Excluir notificações antigas (mais de 30 dias)
async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Buscar notificações antigas
  const params = new URLSearchParams({
    endDate: thirtyDaysAgo.toISOString(),
    limit: '100'
  });
  
  const response = await fetch(`/api/notifications?${params}`);
  const data = await response.json();
  
  if (data.notifications.length > 0) {
    const ids = data.notifications.map(n => n.id);
    
    // Excluir em lote
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    
    console.log(`${ids.length} notificações antigas removidas`);
  }
}
```

## 📱 Web Push - Configuração e Uso

### 1. Registrar Service Worker e Push Subscription

```javascript
// service-worker-manager.js
export class ServiceWorkerManager {
  
  async initialize() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Service Worker ou Push API não suportados');
      return false;
    }
    
    try {
      // Registrar service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration);
      
      // Solicitar permissão para notificações
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        await this.subscribeToPush(registration);
        return true;
      } else {
        console.warn('Permissão para notificações negada');
        return false;
      }
      
    } catch (error) {
      console.error('Erro ao inicializar Service Worker:', error);
      return false;
    }
  }
  
  async subscribeToPush(registration: ServiceWorkerRegistration) {
    try {
      // Obter chave pública VAPID
      const keyResponse = await fetch('/api/notifications/push/public-key');
      const { publicKey } = await keyResponse.json();
      
      // Criar subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });
      
      // Enviar para o servidor
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      
      console.log('Push subscription criada com sucesso');
      
    } catch (error) {
      console.error('Erro ao criar push subscription:', error);
    }
  }
  
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
}
```

### 2. Service Worker - Tratamento de Push Events

```javascript
// client/public/sw.js
self.addEventListener('push', function(event) {
  console.log('Push event recebido:', event);
  
  if (!event.data) {
    console.warn('Push event sem dados');
    return;
  }
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.message,
      icon: '/logo_muda.png',
      badge: '/pwa-96x96.png',
      tag: `notification-${data.id}`,
      data: {
        notificationId: data.id,
        ticketId: data.ticketId,
        ticketCode: data.ticketCode,
        url: data.url || '/'
      },
      requireInteraction: data.priority === 'critical',
      vibrate: getPriorityVibration(data.priority),
      actions: getNotificationActions(data.type)
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
    
  } catch (error) {
    console.error('Erro ao processar push event:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notificação clicada:', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  let url = data.url || '/';
  
  // Construir URL baseada no tipo
  if (data.ticketId) {
    url = `/tickets/${data.ticketId}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Tentar focar janela existente
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
  
  // Marcar notificação como lida
  if (data.notificationId) {
    fetch(`/api/notifications/${data.notificationId}/read`, {
      method: 'PATCH'
    }).catch(error => {
      console.error('Erro ao marcar como lida:', error);
    });
  }
});

function getPriorityVibration(priority) {
  switch (priority) {
    case 'critical':
      return [200, 100, 200, 100, 200];
    case 'high':
      return [100, 50, 100];
    case 'medium':
      return [100];
    default:
      return [];
  }
}

function getNotificationActions(type) {
  const actions = [];
  
  if (type.includes('ticket')) {
    actions.push({
      action: 'view',
      title: 'Ver Chamado',
      icon: '/icons/view.png'
    });
  }
  
  actions.push({
    action: 'dismiss',
    title: 'Dispensar',
    icon: '/icons/dismiss.png'
  });
  
  return actions;
}
```

## 🔄 WebSocket - Tempo Real

### 1. Cliente WebSocket

```typescript
// websocket-client.ts
export class NotificationWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket conectado');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket desconectado');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('Erro no WebSocket:', error);
    };
  }
  
  private handleMessage(data: any) {
    switch (data.type) {
      case 'notification':
        this.onNotification(data.data);
        break;
        
      case 'notification_count_update':
        this.onCountUpdate(data.data.count);
        break;
        
      case 'notification_read':
        this.onNotificationRead(data.data.id);
        break;
        
      default:
        console.log('Mensagem WebSocket não reconhecida:', data);
    }
  }
  
  private onNotification(notification: any) {
    // Atualizar estado local
    this.addNotificationToState(notification);
    
    // Mostrar toast se usuário está na página
    if (document.visibilityState === 'visible') {
      this.showToastNotification(notification);
    }
    
    // Emitir evento customizado
    window.dispatchEvent(new CustomEvent('newNotification', {
      detail: notification
    }));
  }
  
  private onCountUpdate(count: number) {
    // Atualizar contador na UI
    this.updateUnreadCounter(count);
    
    // Emitir evento
    window.dispatchEvent(new CustomEvent('unreadCountUpdate', {
      detail: { count }
    }));
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Backoff exponencial
      
      console.log(`Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Máximo de tentativas de reconexão atingido');
    }
  }
}
```

## 🧪 Testes - Exemplos

### 1. Teste de Propriedade - Persistência

```typescript
// notification-persistence.test.ts
import fc from 'fast-check';
import { NotificationService } from '@/services/notification-service';

describe('Notification Persistence Properties', () => {
  
  test('Property 1: Persistência completa de notificações', async () => {
    // Feature: notification-system, Property 1: Persistência completa de notificações
    
    await fc.assert(fc.asyncProperty(
      fc.record({
        userId: fc.integer({ min: 1, max: 1000 }),
        type: fc.constantFrom('new_ticket', 'status_change', 'new_reply'),
        title: fc.string({ minLength: 1, maxLength: 255 }),
        message: fc.string({ minLength: 1, maxLength: 1000 }),
        priority: fc.constantFrom('low', 'medium', 'high', 'critical')
      }),
      async (payload) => {
        const notificationService = NotificationService.getInstance();
        
        // Criar notificação
        await notificationService.sendNotificationToUser(payload.userId, {
          ...payload,
          timestamp: new Date()
        });
        
        // Verificar se foi persistida
        const notifications = await notificationService.getNotifications(payload.userId, {
          limit: 1
        });
        
        const savedNotification = notifications.notifications[0];
        
        // Propriedade: deve ter todos os campos obrigatórios
        expect(savedNotification).toBeDefined();
        expect(savedNotification.userId).toBe(payload.userId);
        expect(savedNotification.type).toBe(payload.type);
        expect(savedNotification.title).toBe(payload.title);
        expect(savedNotification.message).toBe(payload.message);
        expect(savedNotification.priority).toBe(payload.priority);
        expect(savedNotification.createdAt).toBeInstanceOf(Date);
      }
    ), { numRuns: 100 });
  });
});
```

### 2. Teste Unitário - Componente

```tsx
// notification-panel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import { useNotifications } from '@/hooks/use-notifications';

// Mock do hook
jest.mock('@/hooks/use-notifications');
const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;

describe('NotificationPanel', () => {
  
  beforeEach(() => {
    mockUseNotifications.mockReturnValue({
      notifications: [
        {
          id: 1,
          title: 'Novo Chamado',
          message: 'Chamado #TK-001 criado',
          type: 'new_ticket',
          priority: 'medium',
          readAt: null,
          createdAt: new Date('2024-01-15T10:00:00Z')
        }
      ],
      unreadCount: 1,
      loading: false,
      hasMore: false,
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
      setFilters: jest.fn(),
      filters: {},
      connected: true
    });
  });
  
  test('deve renderizar notificações corretamente', () => {
    render(<NotificationPanel open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Novo Chamado')).toBeInTheDocument();
    expect(screen.getByText('Chamado #TK-001 criado')).toBeInTheDocument();
  });
  
  test('deve marcar como lida ao clicar', async () => {
    const mockMarkAsRead = jest.fn();
    mockUseNotifications.mockReturnValue({
      ...mockUseNotifications(),
      markAsRead: mockMarkAsRead
    });
    
    render(<NotificationPanel open={true} onClose={() => {}} />);
    
    const notification = screen.getByText('Novo Chamado');
    fireEvent.click(notification);
    
    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(1);
    });
  });
});
```

## 📊 Monitoramento e Métricas

### 1. Logging de Notificações

```typescript
// notification-logger.ts
export class NotificationLogger {
  
  static logNotificationSent(notification: any, deliveryMethod: string) {
    console.log('Notification sent', {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      priority: notification.priority,
      deliveryMethod,
      timestamp: new Date().toISOString()
    });
  }
  
  static logDeliveryFailure(notification: any, method: string, error: Error) {
    console.error('Notification delivery failed', {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      method,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
  
  static logPushSubscriptionEvent(event: string, userId: number, endpoint?: string) {
    console.log('Push subscription event', {
      event,
      userId,
      endpoint: endpoint ? endpoint.substring(0, 50) + '...' : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
```

### 2. Métricas de Performance

```typescript
// notification-metrics.ts
export class NotificationMetrics {
  private static metrics = new Map<string, number>();
  
  static incrementCounter(metric: string) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + 1);
  }
  
  static recordTiming(metric: string, duration: number) {
    const timingKey = `${metric}_timing`;
    const current = this.metrics.get(timingKey) || 0;
    this.metrics.set(timingKey, current + duration);
  }
  
  static getMetrics() {
    return Object.fromEntries(this.metrics);
  }
  
  // Exemplo de uso
  static async measureNotificationDelivery<T>(
    operation: () => Promise<T>,
    type: string
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      this.incrementCounter(`notifications_sent_${type}`);
      this.recordTiming(`notification_delivery_${type}`, duration);
      
      return result;
      
    } catch (error) {
      this.incrementCounter(`notifications_failed_${type}`);
      throw error;
    }
  }
}
```

Estes exemplos cobrem os principais cenários de uso do sistema de notificações, desde a implementação básica até casos avançados de monitoramento e testes.