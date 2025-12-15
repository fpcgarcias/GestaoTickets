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
 * Funciona em desenvolvimento E produção, mas com proteções para HMR
 */
async function initializeServiceWorker() {
  try {
    const swManager = ServiceWorkerManager.getInstance();
    
    // Verificar se o navegador suporta Service Worker
    if (!swManager.checkBrowserSupport()) {
      console.log('[Main] Navegador não suporta Service Worker ou Push API');
      return;
    }

    // Em desenvolvimento, aguardar mais tempo para evitar conflitos com HMR
    const delay = process.env.NODE_ENV === 'development' ? 5000 : 2000;
    
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
    }, delay);
    
  } catch (error) {
    console.error('[Main] Erro ao verificar suporte do Service Worker:', error);
  }
}
