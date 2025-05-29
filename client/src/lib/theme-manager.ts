// Temas disponíveis
const THEMES = {
  // Tema padrão (atual do sistema)
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

  // Tema ViX Brasil (dourado/bege elegante)
  vix: {
    name: 'ViX Brasil',
    colors: {
      '--primary': '45 93% 47%', // Dourado
      '--primary-foreground': '0 0% 100%',
      '--secondary': '45 20% 95%', // Bege claro
      '--secondary-foreground': '45 20% 20%',
      '--accent': '45 50% 90%', // Bege suave
      '--accent-foreground': '45 50% 30%',
      '--background': '45 10% 98%', // Quase branco com toque bege
      '--foreground': '45 20% 15%', // Marrom escuro
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
  }
};

// Mapeamento de domínios para temas
const DOMAIN_THEME_MAP: Record<string, keyof typeof THEMES> = {
  'suporte.vixbrasil.com': 'vix',
  'sistema.vixbrasil.com': 'vix',
  'vixbrasil.com': 'vix',
  // Adicione outros domínios conforme necessário
  // 'cliente2.com': 'outroTema',
};

// Função para detectar o tema baseado no domínio atual
function detectThemeFromDomain(): keyof typeof THEMES {
  if (typeof window === 'undefined') return 'default';
  
  const hostname = window.location.hostname;
  
  // Verificar se o domínio atual está mapeado para algum tema
  for (const [domain, theme] of Object.entries(DOMAIN_THEME_MAP)) {
    if (hostname === domain || hostname.includes(domain)) {
      return theme;
    }
  }
  
  return 'default';
}

// Função para aplicar o tema
function applyTheme(themeName: keyof typeof THEMES) {
  const theme = THEMES[themeName];
  if (!theme) return;
  
  const root = document.documentElement;
  
  // Aplicar as variáveis CSS
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Atualizar o título da página se necessário
  if (theme.name !== 'Ticket Wise') {
    document.title = `${theme.name} - Sistema de Gestão de Chamados`;
  }
}

// Função principal para inicializar o tema automaticamente
export function initializeTheme() {
  if (typeof window === 'undefined') return;
  
  const detectedTheme = detectThemeFromDomain();
  applyTheme(detectedTheme);
  
  console.log(`Tema aplicado: ${THEMES[detectedTheme].name}`);
}

// Função para obter o nome da empresa atual (para usar no header, etc.)
export function getCurrentCompanyName(): string {
  if (typeof window === 'undefined') return 'Ticket Wise';
  
  const detectedTheme = detectThemeFromDomain();
  return THEMES[detectedTheme].name;
} 