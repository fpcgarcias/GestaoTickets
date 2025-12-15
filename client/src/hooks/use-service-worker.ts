/**
 * Hook para gerenciar Service Worker e notificações push
 * Sistema de Notificações Persistentes
 */

import { useState, useEffect, useCallback } from 'react';
import { ServiceWorkerManager, ServiceWorkerRegistrationResult } from '@/services/service-worker-manager';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isPushEnabled: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string | null;
}

export interface ServiceWorkerActions {
  initializeServiceWorker: () => Promise<ServiceWorkerRegistrationResult>;
  requestPermission: () => Promise<NotificationPermission>;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<boolean>;
  checkStatus: () => Promise<void>;
}

export function useServiceWorker(): ServiceWorkerState & ServiceWorkerActions {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isPushEnabled: false,
    permission: 'default',
    isLoading: true,
    error: null,
  });

  const swManager = ServiceWorkerManager.getInstance();

  /**
   * Verifica o status atual do Service Worker
   */
  const checkStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const isSupported = swManager.checkBrowserSupport();
      const permission = 'Notification' in window ? Notification.permission : 'denied';
      
      let isRegistered = false;
      let isPushEnabled = false;

      if (isSupported) {
        // Verificar se Service Worker está registrado
        const registration = await navigator.serviceWorker.getRegistration();
        isRegistered = !!registration;

        // Verificar se push está habilitado
        isPushEnabled = await swManager.isPushEnabled();
      }

      setState(prev => ({
        ...prev,
        isSupported,
        isRegistered,
        isPushEnabled,
        permission,
        isLoading: false,
      }));
    } catch (error) {
      console.error('[useServiceWorker] Erro ao verificar status:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao verificar status',
      }));
    }
  }, [swManager]);

  /**
   * Solicita permissão de notificação
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const permission = await swManager.requestNotificationPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        isLoading: false,
      }));

      return permission;
    } catch (error) {
      console.error('[useServiceWorker] Erro ao solicitar permissão:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao solicitar permissão';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, [swManager]);

  /**
   * Inicializa o Service Worker completo
   */
  const initializeServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistrationResult> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await swManager.initializeServiceWorker();

      if (result.success) {
        setState(prev => ({
          ...prev,
          isRegistered: true,
          isPushEnabled: true,
          permission: 'granted',
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Falha na inicialização',
        }));
      }

      return result;
    } catch (error) {
      console.error('[useServiceWorker] Erro na inicialização:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro na inicialização';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [swManager]);

  /**
   * Habilita notificações push
   */
  const enablePush = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await swManager.initializeServiceWorker();
      
      setState(prev => ({
        ...prev,
        isPushEnabled: result.success,
        isRegistered: result.success,
        permission: result.success ? 'granted' : prev.permission,
        isLoading: false,
        error: result.success ? null : result.error || 'Falha ao habilitar push',
      }));

      return result.success;
    } catch (error) {
      console.error('[useServiceWorker] Erro ao habilitar push:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao habilitar push';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, [swManager]);

  /**
   * Desabilita notificações push
   */
  const disablePush = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const success = await swManager.unsubscribeFromPush();
      
      setState(prev => ({
        ...prev,
        isPushEnabled: !success,
        isLoading: false,
        error: success ? null : 'Falha ao desabilitar push',
      }));

      return success;
    } catch (error) {
      console.error('[useServiceWorker] Erro ao desabilitar push:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao desabilitar push';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, [swManager]);

  // Verificar status inicial
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Escutar mudanças de permissão
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkStatus]);

  return {
    ...state,
    initializeServiceWorker,
    requestPermission,
    enablePush,
    disablePush,
    checkStatus,
  };
}