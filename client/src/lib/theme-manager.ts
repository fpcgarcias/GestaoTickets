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
  },

  // Tema Oficina Muda (tons terrosos e naturais)
  oficinaMuda: {
    name: 'Oficina Muda',
    colors: {
      '--primary': '15 58% 29%', // Marrom Avermelhado (#713127) - cor principal
      '--primary-foreground': '0 0% 100%', // Branco para contraste
      '--secondary': '86 15% 40%', // Verde musgo (#5F7254) - tons secundários
      '--secondary-foreground': '0 0% 100%',
      '--accent': '45 84% 60%', // Ouro envelhecido (#F1B241) - destaques
      '--accent-foreground': '15 58% 15%', // Marrom escuro
      '--background': '45 15% 97%', // Quase branco com toque caramelo
      '--foreground': '15 45% 15%', // Marrom escuro para texto
      '--card': '0 0% 100%', // Branco puro para cards
      '--card-foreground': '15 45% 15%',
      '--border': '45 20% 85%', // Borda suave derivada do caramelo
      '--input': '45 15% 95%', // Input com toque caramelo claro
      '--ring': '15 58% 29%', // Ring da cor principal
      '--muted': '86 25% 85%', // Verde areia (#ACB586) para elementos suaves
      '--muted-foreground': '15 25% 45%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '15 45% 15%',
      '--destructive': '0 84.2% 60.2%', // Vermelho padrão para ações destrutivas
      '--destructive-foreground': '210 20% 98%',
    }
  }
};

// Mapeamento de domínios para temas
const DOMAIN_THEME_MAP: Record<string, keyof typeof THEMES> = {
  'suporte.vixbrasil.com': 'vix',
  'sistema.vixbrasil.com': 'vix',
  'vixbrasil.com': 'vix',
  'suporte.oficinamuda.com.br': 'oficinaMuda',
  'oficinamuda.com.br': 'oficinaMuda',
  // Adicione outros domínios conforme necessário
  // 'cliente2.com': 'outroTema',
};

// Função para detectar o tema baseado no domínio atual
function detectThemeFromDomain(): keyof typeof THEMES {
  if (typeof window === 'undefined') return 'default';
  
  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);
  
  // 🧪 MODO DESENVOLVIMENTO: Permitir teste via query parameter
  // Exemplo: http://localhost:5173/?theme=oficinaMuda
  const themeParam = urlParams.get('theme');
  if (themeParam && themeParam in THEMES) {
    console.log(`🧪 [DEV] Tema forçado via query parameter: ${themeParam}`);
    return themeParam as keyof typeof THEMES;
  }
  
  // 🧪 MODO DESENVOLVIMENTO: Permitir teste via localStorage
  // Usar: localStorage.setItem('dev-theme', 'oficinaMuda')
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const devTheme = localStorage.getItem('dev-theme');
    if (devTheme && devTheme in THEMES) {
      console.log(`🧪 [DEV] Tema forçado via localStorage: ${devTheme}`);
      return devTheme as keyof typeof THEMES;
    }
  }
  
  // Verificar se o domínio atual está mapeado para algum tema
  for (const [domain, theme] of Object.entries(DOMAIN_THEME_MAP)) {
    if (hostname === domain || hostname.includes(domain)) {
      return theme;
    }
  }
  
  // Verificar subdomínios de oficinamuda.com.br
  if (hostname.endsWith('.oficinamuda.com.br') || hostname === 'oficinamuda.com.br') {
    return 'oficinaMuda';
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

// Função para obter o logo da empresa atual (retorna src da imagem ou null)
export function getCurrentCompanyLogo(): string | null {
  if (typeof window === 'undefined') return null;
  
  const detectedTheme = detectThemeFromDomain();
  console.log('🎨 [LOGO DEBUG] Tema detectado:', detectedTheme);
  
  if (detectedTheme === 'oficinaMuda') {
    console.log('✅ [LOGO DEBUG] Logo da Oficina Muda deve ser exibido');
    return '/logo_muda.png';
  }
  
  console.log('❌ [LOGO DEBUG] Usando texto normal, não é tema oficinaMuda');
  return null; // Retorna null para usar texto normal
}

// 🧪 FUNÇÕES DE DESENVOLVIMENTO PARA TESTE DE TEMAS
export const devUtils = {
  // Listar todos os temas disponíveis
  listThemes: () => {
    console.log('🎨 Temas disponíveis:', Object.keys(THEMES));
    Object.entries(THEMES).forEach(([key, theme]) => {
      console.log(`  • ${key}: "${theme.name}"`);
    });
  },
  
  // Aplicar tema via localStorage (persiste entre reloads)
  setTheme: (themeName: keyof typeof THEMES) => {
    if (themeName in THEMES) {
      localStorage.setItem('dev-theme', themeName);
      console.log(`🧪 Tema definido: ${themeName}. Recarregue a página para ver as mudanças.`);
      // Aplicar imediatamente também
      applyTheme(themeName);
      // Forçar atualização do nome da empresa
      window.dispatchEvent(new Event('storage'));
    } else {
      console.error(`❌ Tema "${themeName}" não existe. Temas disponíveis:`, Object.keys(THEMES));
    }
  },
  
  // Limpar tema de desenvolvimento
  clearTheme: () => {
    localStorage.removeItem('dev-theme');
    console.log('🧪 Tema de desenvolvimento removido. Recarregue a página.');
  },
  
  // Obter tema atual
  getCurrentTheme: () => {
    const current = detectThemeFromDomain();
    console.log(`🎯 Tema atual: ${current} ("${THEMES[current].name}")`);
    return current;
  }
};

// Disponibilizar no window para facilitar acesso no console do browser
if (typeof window !== 'undefined') {
  (window as any).themeDevUtils = devUtils;
}