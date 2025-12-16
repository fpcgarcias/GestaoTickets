/**
 * Gerenciador de Service Worker para notificações push
 * Sistema de Notificações Persistentes
 */

export interface ServiceWorkerRegistrationResult {
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private publicKey: string | null = null;

  private constructor() {}

  public static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  /**
   * Verifica se o navegador suporta Service Worker e Push API
   */
  public checkBrowserSupport(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Solicita permissão para notificações
   */
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Navegador não suporta notificações');
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return permission;
  }

  /**
   * Registra o Service Worker
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não suportado');
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW Manager] Service Worker registrado com sucesso:', this.registration.scope);

      // Aguardar ativação se necessário
      if (this.registration.installing) {
        await this.waitForServiceWorkerActivation(this.registration);
      }

      return this.registration;
    } catch (error) {
      console.error('[SW Manager] Erro ao registrar Service Worker:', error);
      throw error;
    }
  }

  /**
   * Obtém a chave pública VAPID do backend
   */
  public async getVapidPublicKey(): Promise<string> {
    if (this.publicKey) {
      return this.publicKey;
    }

    try {
      const response = await fetch('/api/notifications/push/public-key', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Erro ao obter chave pública: ${response.status}`);
      }

      const data = await response.json();
      this.publicKey = data.publicKey;

      return this.publicKey;
    } catch (error) {
      console.error('[SW Manager] Erro ao obter chave pública VAPID:', error);
      throw error;
    }
  }

  /**
   * Cria uma push subscription
   */
  public async subscribeToPush(
    registration: ServiceWorkerRegistration,
    publicKey: string
  ): Promise<PushSubscription> {
    if (!registration.pushManager) {
      throw new Error('Push Manager não disponível');
    }

    try {
      // Verificar se já existe uma subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[SW Manager] Subscription existente encontrada');
        return existingSubscription;
      }

      // Criar nova subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      console.log('[SW Manager] Nova push subscription criada');
      return subscription;
    } catch (error) {
      console.error('[SW Manager] Erro ao criar push subscription:', error);
      throw error;
    }
  }

  /**
   * Envia a subscription para o backend
   */
  public async sendSubscriptionToBackend(subscription: PushSubscription): Promise<boolean> {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        },
      };

      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(subscriptionData),
      });

      if (response.ok) {
        console.log('[SW Manager] Subscription enviada para backend com sucesso');
        return true;
      } else {
        console.error('[SW Manager] Erro ao enviar subscription:', response.status);
        return false;
      }
    } catch (error) {
      console.error('[SW Manager] Erro ao enviar subscription para backend:', error);
      throw error;
    }
  }

  /**
   * Remove subscription do backend
   */
  public async unsubscribeFromPush(): Promise<boolean> {
    try {
      if (!this.registration) {
        return false;
      }

      const subscription = await this.registration.pushManager?.getSubscription();
      if (!subscription) {
        return false;
      }

      // Remover do backend
      const response = await fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      // Remover localmente
      await subscription.unsubscribe();

      console.log('[SW Manager] Unsubscribe realizado com sucesso');
      return response.ok;
    } catch (error) {
      console.error('[SW Manager] Erro ao fazer unsubscribe:', error);
      return false;
    }
  }

  /**
   * Processo completo de inicialização do Service Worker e Push
   */
  public async initializeServiceWorker(): Promise<ServiceWorkerRegistrationResult> {
    try {
      // 1. Verificar suporte do navegador
      if (!this.checkBrowserSupport()) {
        return {
          success: false,
          error: 'Navegador não suporta Service Worker ou Push API',
        };
      }

      // 2. Solicitar permissão de notificação
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          error: `Permissão de notificação negada: ${permission}`,
        };
      }

      // 3. Registrar Service Worker
      const registration = await this.registerServiceWorker();

      // 4. Obter chave pública VAPID
      const publicKey = await this.getVapidPublicKey();

      // 5. Criar push subscription
      const subscription = await this.subscribeToPush(registration, publicKey);

      // 6. Enviar subscription para backend
      const backendSuccess = await this.sendSubscriptionToBackend(subscription);

      if (!backendSuccess) {
        return {
          success: false,
          error: 'Falha ao registrar subscription no backend',
        };
      }

      return {
        success: true,
        subscription,
      };
    } catch (error) {
      console.error('[SW Manager] Erro na inicialização:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Verifica se as notificações push estão ativas
   */
  public async isPushEnabled(): Promise<boolean> {
    try {
      if (!this.checkBrowserSupport() || Notification.permission !== 'granted') {
        return false;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager?.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('[SW Manager] Erro ao verificar status do push:', error);
      return false;
    }
  }

  /**
   * Aguarda a ativação do Service Worker
   */
  private waitForServiceWorkerActivation(registration: ServiceWorkerRegistration): Promise<void> {
    return new Promise((resolve) => {
      if (registration.active) {
        resolve();
        return;
      }

      const worker = registration.installing || registration.waiting;
      if (!worker) {
        resolve();
        return;
      }

      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          resolve();
        }
      });
    });
  }

  /**
   * Converte base64 URL-safe para Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Converte ArrayBuffer para base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Limpa todos os caches do Service Worker
   */
  public async clearAllCaches(): Promise<boolean> {
    try {
      if (!('caches' in window)) {
        console.warn('[SW Manager] Cache API não disponível');
        return false;
      }

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW Manager] Removendo cache:', cacheName);
          return caches.delete(cacheName);
        })
      );

      console.log('[SW Manager] Todos os caches foram limpos');
      return true;
    } catch (error) {
      console.error('[SW Manager] Erro ao limpar caches:', error);
      return false;
    }
  }

  /**
   * Desregistra todos os Service Workers
   */
  public async unregisterAllServiceWorkers(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) {
        return false;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => {
          console.log('[SW Manager] Desregistrando Service Worker:', registration.scope);
          return registration.unregister();
        })
      );

      this.registration = null;
      console.log('[SW Manager] Todos os Service Workers foram desregistrados');
      return true;
    } catch (error) {
      console.error('[SW Manager] Erro ao desregistrar Service Workers:', error);
      return false;
    }
  }

  /**
   * Limpa completamente o cache e desregistra Service Workers
   */
  public async clearCacheAndUnregister(): Promise<boolean> {
    try {
      const cacheCleared = await this.clearAllCaches();
      const unregistered = await this.unregisterAllServiceWorkers();
      return cacheCleared && unregistered;
    } catch (error) {
      console.error('[SW Manager] Erro ao limpar cache e desregistrar:', error);
      return false;
    }
  }
}

export default ServiceWorkerManager;