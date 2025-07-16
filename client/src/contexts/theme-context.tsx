import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Tipos para o contexto
interface ThemeContextType {
  themeName: string;
  companyName: string;
  companyLogo: string | null;
  isLoading: boolean;
}

// Temas disponíveis (movido do theme-manager.ts)
const THEMES = {
  default: {
    name: 'Ticket Wise',
    colors: {
      '--primary': '262 83% 58%',
      '--primary-foreground': '210 20% 98%',
      '--secondary': '220 14.3% 95.9%',
      '--secondary-foreground': '220.9 39.3% 11%',
      '--accent': '262 83% 96%',
      '--accent-foreground': '262 83% 28%',
      '--background': '0 0% 98%',
      '--foreground': '224 71.4% 4.1%',
      '--card': '0 0% 100%',
      '--card-foreground': '224 71.4% 4.1%',
      '--border': '220 13% 91%',
      '--input': '220 13% 91%',
      '--ring': '262 83% 58%',
      '--muted': '220 14.3% 95.9%',
      '--muted-foreground': '220 8.9% 46.1%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '224 71.4% 4.1%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 20% 98%',
    }
  },
  vix: {
    name: 'ViX Brasil',
    colors: {
      '--primary': '45 93% 47%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '45 20% 95%',
      '--secondary-foreground': '45 20% 20%',
      '--accent': '45 50% 90%',
      '--accent-foreground': '45 50% 30%',
      '--background': '45 10% 98%',
      '--foreground': '45 20% 15%',
      '--card': '0 0% 100%',
      '--card-foreground': '45 20% 15%',
      '--border': '45 20% 85%',
      '--input': '45 20% 90%',
      '--ring': '45 93% 47%',
      '--muted': '45 20% 95%',
      '--muted-foreground': '45 20% 45%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '45 20% 15%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 20% 98%',
    }
  },
  oficinaMuda: {
    name: 'Oficina Muda',
    colors: {
      '--primary': '15 58% 29%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '86 15% 40%',
      '--secondary-foreground': '0 0% 100%',
      '--accent': '45 84% 60%',
      '--accent-foreground': '15 58% 15%',
      '--background': '45 15% 97%',
      '--foreground': '15 45% 15%',
      '--card': '0 0% 100%',
      '--card-foreground': '15 45% 15%',
      '--border': '45 20% 85%',
      '--input': '45 15% 95%',
      '--ring': '15 58% 29%',
      '--muted': '86 25% 85%',
      '--muted-foreground': '15 25% 45%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '15 45% 15%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 20% 98%',
    }
  }
} as const;

type ThemeKey = keyof typeof THEMES;

// Mapeamento de domínios para temas
const DOMAIN_THEME_MAP: Record<string, ThemeKey> = {
  'suporte.vixbrasil.com': 'vix',
  'sistema.vixbrasil.com': 'vix',
  'vixbrasil.com': 'vix',
  'suporte.oficinamuda.com.br': 'oficinaMuda',
  'oficinamuda.com.br': 'oficinaMuda',
};

// Função para detectar o tema (otimizada - executa apenas uma vez)
function detectThemeFromDomain(): ThemeKey {
  if (typeof window === 'undefined') return 'default';

  const hostname = window.location.hostname;
  console.log('Detectando tema para o hostname:', hostname);
  const urlParams = new URLSearchParams(window.location.search);
  
  // 🧪 MODO DESENVOLVIMENTO: Query parameter tem prioridade
  const themeParam = urlParams.get('theme');
  if (themeParam && themeParam in THEMES) {
    return themeParam as ThemeKey;
  }
  
  // 🧪 MODO DESENVOLVIMENTO: localStorage para persistência local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const devTheme = localStorage.getItem('dev-theme');
    if (devTheme && devTheme in THEMES) {
      return devTheme as ThemeKey;
    }
  }
  
  // Sort domains by length descending to check specific subdomains first
  const sortedDomains = Object.keys(DOMAIN_THEME_MAP).sort((a, b) => b.length - a.length);

  for (const domain of sortedDomains) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return DOMAIN_THEME_MAP[domain];
    }
  }
  
  return 'default';
}

// Função para aplicar as cores CSS
function applyThemeColors(themeName: ThemeKey) {
  const theme = THEMES[themeName];
  if (!theme) return;
  
  const root = document.documentElement;
  
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Atualizar título da página
  document.title = `${theme.name} - Sistema de Gestão de Chamados`;
}

// Função para obter logo baseado no tema
function getLogoForTheme(themeName: ThemeKey): string | null {
  if (themeName === 'oficinaMuda') {
    return '/logo_muda.png';
  }
  return null;
}

// Criação do contexto
const ThemeContext = createContext<ThemeContextType | null>(null);

// Provider do contexto
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeData, setThemeData] = useState<ThemeContextType>({
    themeName: 'default',
    companyName: 'Ticket Wise',
    companyLogo: null,
    isLoading: true,
  });

  useEffect(() => {
    // Detectar tema apenas uma vez quando o componente monta
    const detectedTheme = detectThemeFromDomain();
    const theme = THEMES[detectedTheme];
    
    // Aplicar cores CSS
    applyThemeColors(detectedTheme);
    
    // Atualizar estado do contexto
    setThemeData({
      themeName: detectedTheme,
      companyName: theme.name,
      companyLogo: getLogoForTheme(detectedTheme),
      isLoading: false,
    });
    
    // Theme configured successfully
  }, []); // Executa apenas uma vez

  return (
    <ThemeContext.Provider value={themeData}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook para usar o contexto
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}

// Utilitários para desenvolvimento (mantém compatibilidade)
export const devUtils = {
  setTheme: (themeName: ThemeKey) => {
    if (themeName in THEMES) {
      localStorage.setItem('dev-theme', themeName);
      window.location.reload();
    }
  },
  
  clearTheme: () => {
    localStorage.removeItem('dev-theme');
    window.location.reload();
  },
  
  listThemes: () => {
    return Object.keys(THEMES);
  }
};

// Disponibilizar no window
if (typeof window !== 'undefined') {
  (window as any).themeDevUtils = devUtils;
}