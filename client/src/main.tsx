import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";



// Importar Service Worker Manager
import { ServiceWorkerManager } from "./services/service-worker-manager";

// O ThemeProvider agora gerencia a inicialização do tema automaticamente

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

const root = createRoot(container);
root.render(<App />);

// Inicializar Service Worker após renderização
initializeServiceWorker();

/**
 * Inicializa o Service Worker para notificações push
 * IMPORTANTE: NÃO registra em desenvolvimento para evitar conflitos com HMR
 */
async function initializeServiceWorker() {
  // NÃO registrar Service Worker em desenvolvimento
  // Isso evita conflitos com o HMR do Vite
  if (import.meta.env.DEV) {
    console.log('[Main] Modo desenvolvimento - Service Worker desabilitado para evitar conflitos com HMR');
    
    // Em desenvolvimento, desregistrar qualquer Service Worker existente
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          console.log('[Main] Desregistrando Service Worker em desenvolvimento:', registration.scope);
          await registration.unregister();
        }
      } catch (error) {
        console.warn('[Main] Erro ao desregistrar Service Workers:', error);
      }
    }
    return;
  }

  try {
    const swManager = ServiceWorkerManager.getInstance();
    
    // Verificar se o navegador suporta Service Worker
    if (!swManager.checkBrowserSupport()) {
      console.log('[Main] Navegador não suporta Service Worker ou Push API');
      return;
    }

    // Aguardar um pouco antes de registrar em produção
    setTimeout(async () => {
      try {
        // Verificar se já existe permissão concedida
        if ('Notification' in window && Notification.permission === 'granted') {
          console.log('[Main] Permissão já concedida, inicializando Service Worker...');
          
          const result = await swManager.initializeServiceWorker();
          
          if (result.success) {
            console.log('[Main] Service Worker inicializado com sucesso');
          } else {
            console.warn('[Main] Falha na inicialização do Service Worker:', result.error);
          }
        } else {
          // Apenas registrar o Service Worker sem solicitar permissão
          // A permissão será solicitada quando o usuário interagir com a UI
          console.log('[Main] Registrando Service Worker sem solicitar permissão...');
          
          await swManager.registerServiceWorker();
          console.log('[Main] Service Worker registrado. Permissão será solicitada via UI.');
        }
      } catch (error) {
        console.error('[Main] Erro na inicialização do Service Worker:', error);
      }
    }, 2000);
    
  } catch (error) {
    console.error('[Main] Erro ao verificar suporte do Service Worker:', error);
  }
}
