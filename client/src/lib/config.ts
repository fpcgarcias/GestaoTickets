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
                     window.location.hostname === '127.0.0.1' ||
                     window.location.port === '5173';

const isProduction = !isDevelopment;

// Configurar URLs baseado no ambiente
function getConfig(): AppConfig {
  if (isDevelopment) {
    // Em desenvolvimento, sempre usar localhost:5173 onde o servidor está rodando
    return {
      apiBaseUrl: 'http://localhost:5173',
      wsBaseUrl: 'ws://localhost:5173',
      isDevelopment: true,
      isProduction: false
    };
  } else {
    // Em produção, usar o mesmo host da página atual
    const currentUrl = new URL(window.location.href);
    const isHTTPS = currentUrl.protocol === 'https:';
    const protocol = isHTTPS ? 'https:' : 'http:';
    const wsProtocol = isHTTPS ? 'wss:' : 'ws:';
    const host = currentUrl.host;
    
    return {
      apiBaseUrl: `${protocol}//${host}`,
      wsBaseUrl: `${wsProtocol}//${host}`,
      isDevelopment: false,
      isProduction: true
    };
  }
}

export const config = getConfig();

// Log da configuração para debug
console.log('🔧 [CONFIG] Configuração da aplicação:', {
  ambiente: config.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION',
  apiBaseUrl: config.apiBaseUrl,
  wsBaseUrl: config.wsBaseUrl,
  hostname: window.location.hostname,
  port: window.location.port
});

export default config; 