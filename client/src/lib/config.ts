// Configurações centralizadas da aplicação

interface AppConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

// Detectar ambiente automaticamente
const isDevelopment = import.meta.env.DEV || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

const isProduction = !isDevelopment;

// Configurar URLs baseado no ambiente
function getConfig(): AppConfig {
  const currentUrl = new URL(window.location.href);
  const currentHost = currentUrl.host;
  const currentHostname = currentUrl.hostname;
  
  if (isDevelopment) {
    // Em desenvolvimento local (localhost/127.0.0.1), usar localhost
    if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
      return {
        apiBaseUrl: 'http://localhost:5173',
        wsBaseUrl: 'ws://localhost:5173',
        isDevelopment: true,
        isProduction: false
      };
    } else {
      // Em desenvolvimento mas acessado de máquina externa, usar o host atual
      return {
        apiBaseUrl: `http://${currentHost}`,
        wsBaseUrl: `ws://${currentHost}`,
        isDevelopment: true,
        isProduction: false
      };
    }
  } else {
    // Em produção, usar o mesmo host da página atual
    const isHTTPS = currentUrl.protocol === 'https:';
    const protocol = isHTTPS ? 'https:' : 'http:';
    const wsProtocol = isHTTPS ? 'wss:' : 'ws:';
    
    return {
      apiBaseUrl: `${protocol}//${currentHost}`,
      wsBaseUrl: `${wsProtocol}//${currentHost}`,
      isDevelopment: false,
      isProduction: true
    };
  }
}

export const config = getConfig();

// Debug info para desenvolvimento
if (isDevelopment) {
  console.log('🔧 App Config:', {
    apiBaseUrl: config.apiBaseUrl,
    wsBaseUrl: config.wsBaseUrl,
    currentHost: window.location.host,
    isDevelopment: config.isDevelopment
  });
}

export default config; 