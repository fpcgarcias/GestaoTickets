/**
 * Testes unitários para registro de Service Worker
 * Feature: notification-system
 * Requirements: 3.1, 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock das APIs do navegador
const mockServiceWorkerRegistration = {
  pushManager: {
    subscribe: vi.fn(),
    getSubscription: vi.fn(),
  },
  unregister: vi.fn(),
};

const mockServiceWorker = {
  register: vi.fn(),
};

const mockNotification = {
  requestPermission: vi.fn(),
  permission: 'default' as NotificationPermission,
};

// Função que será testada (simulando a implementação)
interface ServiceWorkerRegistrationResult {
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}

class ServiceWorkerManager {
  async checkBrowserSupport(): Promise<boolean> {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Navegador não suporta notificações');
    }
    
    return await (window as any).Notification.requestPermission();
  }

  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não suportado');
    }

    return await navigator.serviceWorker.register('/sw.js');
  }

  async subscribeToPush(registration: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
    if (!registration.pushManager) {
      throw new Error('Push Manager não disponível');
    }

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(publicKey),
    });
  }

  async sendSubscriptionToBackend(subscription: PushSubscription): Promise<boolean> {
    const response = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        },
      }),
    });

    return response.ok;
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

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

describe('Service Worker Registration', () => {
  let swManager: ServiceWorkerManager;
  let originalNavigator: any;
  let originalWindow: any;

  beforeEach(() => {
    swManager = new ServiceWorkerManager();
    
    // Salvar referências originais
    originalNavigator = global.navigator;
    originalWindow = global.window;

    // Mock do fetch
    global.fetch = vi.fn();
    
    // Mock do window.atob e btoa
    global.window = {
      ...global.window,
      atob: vi.fn((str) => Buffer.from(str, 'base64').toString('binary')),
      btoa: vi.fn((str) => Buffer.from(str, 'binary').toString('base64')),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  describe('checkBrowserSupport', () => {
    it('deve retornar true quando navegador suporta todas as APIs necessárias', async () => {
      // Arrange
      global.navigator = {
        serviceWorker: mockServiceWorker,
      };
      global.window = {
        ...global.window,
        PushManager: class {},
        Notification: mockNotification,
      };

      // Act
      const result = await swManager.checkBrowserSupport();

      // Assert
      expect(result).toBe(true);
    });

    it('deve retornar false quando Service Worker não é suportado', async () => {
      // Arrange
      global.navigator = {};
      global.window = {
        ...global.window,
        PushManager: class {},
        Notification: mockNotification,
      };

      // Act
      const result = await swManager.checkBrowserSupport();

      // Assert
      expect(result).toBe(false);
    });

    it('deve retornar false quando PushManager não é suportado', async () => {
      // Arrange
      global.navigator = {
        serviceWorker: mockServiceWorker,
      };
      global.window = {
        ...global.window,
        Notification: mockNotification,
      };

      // Act
      const result = await swManager.checkBrowserSupport();

      // Assert
      expect(result).toBe(false);
    });

    it('deve retornar false quando Notification não é suportado', async () => {
      // Arrange
      global.navigator = {
        serviceWorker: mockServiceWorker,
      };
      global.window = {
        ...global.window,
        PushManager: class {},
      };

      // Act
      const result = await swManager.checkBrowserSupport();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('requestNotificationPermission', () => {
    it('deve solicitar permissão e retornar granted', async () => {
      // Arrange
      const mockRequestPermission = vi.fn().mockResolvedValue('granted');
      global.window = {
        ...global.window,
        Notification: {
          requestPermission: mockRequestPermission,
        },
      };

      // Act
      const result = await swManager.requestNotificationPermission();

      // Assert
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('deve solicitar permissão e retornar denied', async () => {
      // Arrange
      const mockRequestPermission = vi.fn().mockResolvedValue('denied');
      global.window = {
        ...global.window,
        Notification: {
          requestPermission: mockRequestPermission,
        },
      };

      // Act
      const result = await swManager.requestNotificationPermission();

      // Assert
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result).toBe('denied');
    });

    it('deve lançar erro quando Notification não é suportado', async () => {
      // Arrange
      global.window = {};

      // Act & Assert
      await expect(swManager.requestNotificationPermission()).rejects.toThrow(
        'Navegador não suporta notificações'
      );
    });
  });

  describe('registerServiceWorker', () => {
    it('deve registrar Service Worker com sucesso', async () => {
      // Arrange
      const mockRegister = vi.fn().mockResolvedValue(mockServiceWorkerRegistration);
      global.navigator = {
        serviceWorker: {
          register: mockRegister,
        },
      };

      // Act
      const result = await swManager.registerServiceWorker();

      // Assert
      expect(mockRegister).toHaveBeenCalledWith('/sw.js');
      expect(result).toBe(mockServiceWorkerRegistration);
    });

    it('deve lançar erro quando Service Worker não é suportado', async () => {
      // Arrange
      global.navigator = {};

      // Act & Assert
      await expect(swManager.registerServiceWorker()).rejects.toThrow(
        'Service Worker não suportado'
      );
    });

    it('deve propagar erro de registro', async () => {
      // Arrange
      const mockRegister = vi.fn().mockRejectedValue(new Error('Falha no registro'));
      global.navigator = {
        serviceWorker: {
          register: mockRegister,
        },
      };

      // Act & Assert
      await expect(swManager.registerServiceWorker()).rejects.toThrow('Falha no registro');
    });
  });

  describe('subscribeToPush', () => {
    it('deve criar push subscription com sucesso', async () => {
      // Arrange
      const mockSubscription = {
        endpoint: 'https://example.com/push',
        getKey: vi.fn((name) => {
          if (name === 'p256dh') return new ArrayBuffer(65);
          if (name === 'auth') return new ArrayBuffer(16);
          return null;
        }),
      };
      
      const mockSubscribe = vi.fn().mockResolvedValue(mockSubscription);
      const registration = {
        pushManager: {
          subscribe: mockSubscribe,
        },
      } as any;

      const publicKey = 'BNWh9aq5NKkYjQ_m7zfz8Q';

      // Act
      const result = await swManager.subscribeToPush(registration, publicKey);

      // Assert
      expect(mockSubscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });
      expect(result).toBe(mockSubscription);
    });

    it('deve lançar erro quando pushManager não está disponível', async () => {
      // Arrange
      const registration = {} as ServiceWorkerRegistration;
      const publicKey = 'BNWh9aq5NKkYjQ_m7zfz8Q';

      // Act & Assert
      await expect(swManager.subscribeToPush(registration, publicKey)).rejects.toThrow(
        'Push Manager não disponível'
      );
    });
  });

  describe('sendSubscriptionToBackend', () => {
    it('deve enviar subscription para backend com sucesso', async () => {
      // Arrange
      const mockSubscription = {
        endpoint: 'https://example.com/push',
        getKey: vi.fn((name) => {
          if (name === 'p256dh') return new ArrayBuffer(65);
          if (name === 'auth') return new ArrayBuffer(16);
          return null;
        }),
      } as any;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      // Act
      const result = await swManager.sendSubscriptionToBackend(mockSubscription);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: expect.stringContaining('"endpoint":"https://example.com/push"'),
      });
      expect(result).toBe(true);
    });

    it('deve retornar false quando backend retorna erro', async () => {
      // Arrange
      const mockSubscription = {
        endpoint: 'https://example.com/push',
        getKey: vi.fn(() => new ArrayBuffer(16)),
      } as any;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      // Act
      const result = await swManager.sendSubscriptionToBackend(mockSubscription);

      // Assert
      expect(result).toBe(false);
    });

    it('deve propagar erro de rede', async () => {
      // Arrange
      const mockSubscription = {
        endpoint: 'https://example.com/push',
        getKey: vi.fn(() => new ArrayBuffer(16)),
      } as any;

      const mockFetch = vi.fn().mockRejectedValue(new Error('Erro de rede'));
      global.fetch = mockFetch;

      // Act & Assert
      await expect(swManager.sendSubscriptionToBackend(mockSubscription)).rejects.toThrow(
        'Erro de rede'
      );
    });
  });
});