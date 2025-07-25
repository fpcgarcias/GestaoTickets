/**
 * Utilitário para gerenciar cache da aplicação
 * Útil para resolver problemas de cache durante desenvolvimento
 */

export class CacheManager {
  /**
   * Limpa todos os caches do navegador
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // 1. Limpar cache do Service Worker (se existir)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          if (process.env.NODE_ENV !== 'production') {
            console.log('🧹 Service Worker removido:', registration.scope);
          }
        }
      }

      // 2. Limpar Cache API (se disponível)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          if (process.env.NODE_ENV !== 'production') {
            console.log('🧹 Cache removido:', cacheName);
          }
        }
      }

      // 3. Limpar localStorage
      if (typeof Storage !== 'undefined') {
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        if (process.env.NODE_ENV !== 'production') {
          console.log('🧹 localStorage limpo');
        }
      }

      // 4. Limpar sessionStorage
      if (typeof Storage !== 'undefined') {
        sessionStorage.clear();
        if (process.env.NODE_ENV !== 'production') {
          console.log('🧹 sessionStorage limpo');
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Todos os caches foram limpos com sucesso!');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erro ao limpar caches:', error);
      }
    }
  }

  /**
   * Força recarregamento completo da página sem cache
   */
  static forceReload(): void {
    // Recarregar ignorando cache
    window.location.reload();
  }

  /**
   * Verifica se há problemas de cache
   */
  static async checkCacheHealth(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Verificando saúde do cache...');
    }
    
    // Verificar Service Workers ativos
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 Service Workers ativos: ${registrations.length}`);
      }
      registrations.forEach(reg => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`  - Escopo: ${reg.scope}`);
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log(`  - Estado: ${reg.active?.state || 'inativo'}`);
        }
      });
    }

    // Verificar Cache API
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 Caches ativos: ${cacheNames.length}`);
      }
      cacheNames.forEach(name => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`  - Cache: ${name}`);
        }
      });
    }

    // Verificar tamanho do localStorage
    if (typeof Storage !== 'undefined') {
      const localStorageSize = new Blob(Object.values(localStorage)).size;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 localStorage: ${(localStorageSize / 1024).toFixed(2)} KB`);
      }
    }
  }

  /**
   * Adiciona listeners para detectar problemas de cache
   */
  static setupCacheMonitoring(): void {
    // Monitor para erros de carregamento
    window.addEventListener('error', (event) => {
      if (event.filename && (event.filename.includes('.js') || event.filename.includes('.css'))) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ Erro de carregamento de recurso (possível problema de cache):', event.filename);
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log('💡 Tente limpar o cache: CacheManager.clearAllCaches()');
        }
      }
    });

    // Monitor para rejections não capturadas
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('Loading chunk')) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ Erro de carregamento de chunk (possível problema de cache)');
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log('💡 Tente limpar o cache: CacheManager.clearAllCaches()');
        }
      }
    });
  }
}

// Adicionar função global para debug fácil no console
(window as any).clearAppCache = CacheManager.clearAllCaches;
(window as any).checkCacheHealth = CacheManager.checkCacheHealth;

// Configurar monitoramento automaticamente em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  CacheManager.setupCacheMonitoring();
  console.log('🔧 Cache monitoring ativo. Use clearAppCache() ou checkCacheHealth() no console para debug.');
}

export default CacheManager; 