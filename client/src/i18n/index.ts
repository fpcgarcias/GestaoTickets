import { createIntl, createIntlCache, useIntl } from 'react-intl';

// Mensagens em português brasileiro
import ptBRMessages from './messages/pt-BR.json';

// Mensagens em inglês americano
import enUSMessages from './messages/en-US.json';

// Cache para melhorar performance
const cache = createIntlCache();

// Tipos para idiomas suportados
export type SupportedLocale = 'pt-BR' | 'en-US';

// react-intl espera um dicionário plano: { 'auth.login_tab': 'Login', ... }
function flattenMessages(source: Record<string, any>, parentKey = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const composedKey = parentKey ? `${parentKey}.${key}` : key;
    if (value && typeof value === 'object') {
      Object.assign(flat, flattenMessages(value as Record<string, any>, composedKey));
    } else if (typeof value === 'string') {
      flat[composedKey] = value;
    }
  }
  return flat;
}

// Mapeamento de mensagens por idioma (achatado)
export const messages: Record<SupportedLocale, Record<string, string>> = {
  'pt-BR': flattenMessages(ptBRMessages as unknown as Record<string, any>),
  'en-US': flattenMessages(enUSMessages as unknown as Record<string, any>),
};

// Função para detectar idioma baseado no domínio E navegador
export function detectLocaleFromDomain(): SupportedLocale {
  if (typeof window === 'undefined') return 'pt-BR';

  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);

  // 🧪 MODO DESENVOLVIMENTO: Query parameter tem prioridade
  const langParam = urlParams.get('lang');
  if (langParam && (langParam === 'pt-BR' || langParam === 'en-US')) {
    return langParam as SupportedLocale;
  }

  // 🧪 MODO DESENVOLVIMENTO: localStorage para persistência local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const devLang = localStorage.getItem('dev-lang');
    if (devLang && (devLang === 'pt-BR' || devLang === 'en-US')) {
      return devLang as SupportedLocale;
    }
  }

  // 🔥 DOMÍNIOS COM IDIOMA FIXO (independente do navegador)
  const fixedDomainLocaleMap: Record<string, SupportedLocale> = {
    // Empresa internacional - sempre em inglês
    'support.vixpaulahermanny.com': 'en-US',
    'vixpaulahermanny.com': 'en-US',
    'suporte.empresa-usa.com': 'en-US',
    'empresa-usa.com': 'en-US',
  };

  // Verificar se é domínio com idioma fixo
  for (const [domain, locale] of Object.entries(fixedDomainLocaleMap)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return locale;
    }
  }

  // 🔄 DOMÍNIOS GENÉRICOS: detectar idioma do navegador
  const genericDomains = [
    'app.ticketwise.com.br',
    'localhost',
    '127.0.0.1'
  ];

  const isGenericDomain = genericDomains.some(domain =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (isGenericDomain) {
    // Detectar idioma do navegador
    const browserLang = navigator.language || 'pt-BR';

    // Mapear idiomas suportados
    if (browserLang.startsWith('en')) {
      return 'en-US';
    } else if (browserLang.startsWith('pt')) {
      return 'pt-BR';
    }

    // Fallback para português se idioma não suportado
    return 'pt-BR';
  }

  // 🔄 OUTROS DOMÍNIOS: lógica padrão (empresas existentes)
  const defaultDomainMap: Record<string, SupportedLocale> = {
    'suporte.vixbrasil.com': 'pt-BR',
    'sistema.vixbrasil.com': 'pt-BR',
    'vixbrasil.com': 'pt-BR',
    'suporte.oficinamuda.com.br': 'pt-BR',
    'oficinamuda.com.br': 'pt-BR',
  };

  for (const [domain, locale] of Object.entries(defaultDomainMap)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return locale;
    }
  }

  // Fallback final para português
  return 'pt-BR';
}

// Criar instância do Intl baseada no domínio
export function createIntlInstance(locale?: SupportedLocale) {
  const detectedLocale = locale || detectLocaleFromDomain();
  const localeMessages = messages[detectedLocale];

  return createIntl(
    {
      locale: detectedLocale,
      messages: localeMessages,
      defaultLocale: 'pt-BR',
    },
    cache
  );
}

// Exportar instância padrão
export const intl = createIntlInstance();

// Utilitários para desenvolvimento (mantém compatibilidade)
export const devUtils = {
  setLanguage: (locale: SupportedLocale) => {
    if (locale === 'pt-BR' || locale === 'en-US') {
      localStorage.setItem('dev-lang', locale);
      window.location.reload();
    }
  },

  clearLanguage: () => {
    localStorage.removeItem('dev-lang');
    window.location.reload();
  },

  listLanguages: () => {
    return ['pt-BR', 'en-US'];
  }
};

// Disponibilizar no window
if (typeof window !== 'undefined') {
  (window as any).i18nDevUtils = devUtils;
}

// Hook personalizado para usar traduções (compatibilidade com nossa API)
export function useI18n() {
  const intl = useIntl();

  return {
    formatMessage: (id: string, values?: Record<string, any>) => {
      return intl.formatMessage({ id }, values);
    },
    formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return intl.formatDate(value, options);
    },
    formatTime: (value: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return intl.formatTime(value, options);
    },
    formatNumber: (value: number, options?: any) => {
      return intl.formatNumber(value, options as any);
    },
    locale: intl.locale
  };
}
