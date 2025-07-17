// Configurações centralizadas da aplicação

interface AppConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

// Lista de domínios de produção conhecidos
const PRODUCTION_DOMAINS = [
  'suporte.vixbrasil.com',
  'suporte.oficinamuda.com.br',
  'app.ticketwise.com.br'
];

// Detectar ambiente automaticamente
const currentHostname = window.location.hostname;
const isProductionDomain = PRODUCTION_DOMAINS.some(domain => 
  currentHostname === domain || currentHostname.endsWith(`.${domain}`)
);

// FORÇAR produção para domínios conhecidos
const isDevelopment = !isProductionDomain && (
  import.meta.env.DEV || 
  currentHostname === 'localhost' || 
  currentHostname === '127.0.0.1'
);

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
    // Em produção com Cloudflare Tunnel
    // SEMPRE usar o protocolo da página atual (Cloudflare cuida do HTTPS)
    const pageProtocol = currentUrl.protocol;
    const isHTTPS = pageProtocol === 'https:';
    const apiProtocol = isHTTPS ? 'https:' : 'http:';
    const wsProtocol = isHTTPS ? 'wss:' : 'ws:';
    
    return {
      apiBaseUrl: `${apiProtocol}//${currentHost}`,
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