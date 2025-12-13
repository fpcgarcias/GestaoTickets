// Service Worker para Web Push Notifications
// Sistema de Notificações Persistentes

const CACHE_NAME = 'ticketwise-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/logo_muda.png',
  '/pwa-96x96.png'
];

// Event listener para instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Service Worker instalado com sucesso');
        // Força a ativação imediata do novo Service Worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Erro durante instalação:', error);
      })
  );
});

// Event listener para ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remove caches antigos
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker ativado com sucesso');
      // Toma controle de todas as abas abertas
      return self.clients.claim();
    }).catch((error) => {
      console.error('[SW] Erro durante ativação:', error);
    })
  );
});

// Event listener para receber notificações push
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event);
  
  let notificationData = {};
  
  try {
    if (event.data) {
      notificationData = event.data.json();
      console.log('[SW] Dados da notificação:', notificationData);
    }
  } catch (error) {
    console.error('[SW] Erro ao parsear dados da notificação:', error);
    // Fallback para notificação genérica
    notificationData = {
      title: 'Nova Notificação',
      message: 'Você tem uma nova notificação no sistema.',
      priority: 'medium'
    };
  }
  
  // Configurar opções da notificação baseado na prioridade
  const notificationOptions = {
    body: notificationData.message || 'Nova notificação disponível',
    icon: '/logo_muda.png',
    badge: '/pwa-96x96.png',
    tag: `notification-${notificationData.id || Date.now()}`,
    data: {
      notificationId: notificationData.id,
      ticketId: notificationData.ticketId,
      ticketCode: notificationData.ticketCode,
      type: notificationData.type,
      url: buildNotificationUrl(notificationData),
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/pwa-96x96.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  // Configurações específicas baseadas na prioridade (Requirements 9.2)
  // Usar configurações do payload se disponíveis, senão usar padrões
  if (notificationData.requireInteraction !== undefined) {
    notificationOptions.requireInteraction = notificationData.requireInteraction;
  }
  
  if (notificationData.vibrate !== undefined) {
    notificationOptions.vibrate = notificationData.vibrate;
  } else {
    // Fallback para configurações baseadas na prioridade
    switch (notificationData.priority) {
      case 'critical':
        notificationOptions.requireInteraction = true;
        notificationOptions.vibrate = [200, 100, 200];
        notificationOptions.silent = false;
        break;
      case 'high':
        notificationOptions.vibrate = [100];
        notificationOptions.silent = false;
        break;
      case 'medium':
        notificationOptions.vibrate = undefined;
        break;
      case 'low':
      default:
        notificationOptions.silent = true;
        break;
    }
  }
  
  const title = notificationData.title || 'TicketWise';
  
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
      .then(() => {
        console.log('[SW] Notificação exibida com sucesso');
      })
      .catch((error) => {
        console.error('[SW] Erro ao exibir notificação:', error);
      })
  );
});

// Event listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Fechar a notificação
  notification.close();
  
  // Se a ação for 'close', apenas fecha a notificação
  if (action === 'close') {
    console.log('[SW] Notificação fechada pelo usuário');
    return;
  }
  
  // Determinar URL de destino
  const targetUrl = data.url || '/';
  
  console.log('[SW] Navegando para:', targetUrl);
  
  event.waitUntil(
    // Buscar todas as janelas/abas abertas da aplicação
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('[SW] Clientes encontrados:', clientList.length);
      
      // Procurar por uma janela já aberta da aplicação
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const targetUrlObj = new URL(targetUrl, self.location.origin);
        
        // Se encontrar uma janela da mesma origem, focar nela
        if (clientUrl.origin === targetUrlObj.origin) {
          console.log('[SW] Focando janela existente:', client.url);
          
          // Navegar para a URL específica se necessário
          if (client.url !== targetUrlObj.href) {
            client.navigate(targetUrlObj.href);
          }
          
          return client.focus();
        }
      }
      
      // Se não encontrar janela aberta, abrir nova
      if (self.clients.openWindow) {
        console.log('[SW] Abrindo nova janela:', targetUrl);
        return self.clients.openWindow(targetUrl);
      }
    }).catch((error) => {
      console.error('[SW] Erro ao processar clique na notificação:', error);
    })
  );
  
  // Marcar notificação como lida (se tiver ID)
  if (data.notificationId) {
    markNotificationAsRead(data.notificationId);
  }
});

// Event listener para fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificação fechada:', event.notification.tag);
  
  const data = event.notification.data || {};
  
  // Opcional: registrar que a notificação foi fechada sem clique
  if (data.notificationId) {
    console.log('[SW] Notificação', data.notificationId, 'fechada sem interação');
  }
});

// Função auxiliar para construir URL da notificação
function buildNotificationUrl(notificationData) {
  const baseUrl = self.location.origin;
  
  // Se tiver ticket, navegar para página do ticket
  if (notificationData.ticketId && notificationData.ticketCode) {
    return `${baseUrl}/tickets/${notificationData.ticketCode}`;
  }
  
  // Se tiver tipo específico, navegar para página relevante
  switch (notificationData.type) {
    case 'new_ticket':
    case 'status_change':
    case 'new_reply':
      return `${baseUrl}/tickets`;
    case 'new_customer':
      return `${baseUrl}/clients`;
    case 'new_user':
      return `${baseUrl}/users`;
    case 'system_maintenance':
      return `${baseUrl}/settings`;
    default:
      return `${baseUrl}/`;
  }
}

// Função auxiliar para marcar notificação como lida
function markNotificationAsRead(notificationId) {
  // Fazer requisição para marcar como lida
  fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (response.ok) {
      console.log('[SW] Notificação marcada como lida:', notificationId);
    } else {
      console.warn('[SW] Falha ao marcar notificação como lida:', response.status);
    }
  }).catch(error => {
    console.error('[SW] Erro ao marcar notificação como lida:', error);
  });
}

// Event listener para fetch (cache de recursos)
self.addEventListener('fetch', (event) => {
  // Apenas cachear recursos GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Não cachear APIs
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retornar do cache se disponível
        if (response) {
          return response;
        }
        
        // Buscar da rede e cachear
        return fetch(event.request).then((response) => {
          // Verificar se é uma resposta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clonar a resposta
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        // Fallback para offline
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Event listener para sincronização em background
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Sincronizar notificações pendentes
      syncPendingNotifications()
    );
  }
});

// Função para sincronizar notificações pendentes
function syncPendingNotifications() {
  return fetch('/api/notifications/sync', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (response.ok) {
      console.log('[SW] Notificações sincronizadas com sucesso');
    } else {
      console.warn('[SW] Falha na sincronização de notificações');
    }
  }).catch(error => {
    console.error('[SW] Erro na sincronização de notificações:', error);
  });
}

// Mensagem de inicialização
console.log('[SW] Service Worker carregado - Sistema de Notificações TicketWise');