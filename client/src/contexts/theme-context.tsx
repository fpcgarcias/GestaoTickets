import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeName: string;
  companyName: string;
  companyLogo: string | null;
  isLoading: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

type ThemeTokens = Record<string, string>;

interface ThemeDefinition {
  name: string;
  colors: Record<ThemeMode, ThemeTokens>;
}

const ticketWiseLight: ThemeTokens = {
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
  '--chart-1': '12 76% 61%',
  '--chart-2': '173 58% 39%',
  '--chart-3': '197 37% 24%',
  '--chart-4': '43 74% 66%',
  '--chart-5': '27 87% 67%',
  '--sidebar-background': '0 0% 98%',
  '--sidebar-foreground': '224 71.4% 4.1%',
  '--sidebar-primary': '262 83% 58%',
  '--sidebar-primary-foreground': '210 20% 98%',
  '--sidebar-accent': '262 83% 96%',
  '--sidebar-accent-foreground': '262 83% 58%',
  '--sidebar-border': '220 13% 91%',
  '--sidebar-ring': '262 83% 58%',
  '--status-new': '210 90% 60%',
  '--status-ongoing': '32 100% 60%',
  '--status-resolved': '120 40% 60%',
  '--status-high': '0 72% 60%',
};

const ticketWiseDark: ThemeTokens = {
  '--primary': '263 70% 66%',
  '--primary-foreground': '210 20% 98%',
  '--secondary': '240 5% 20%',
  '--secondary-foreground': '210 20% 96%',
  '--accent': '263 52% 26%',
  '--accent-foreground': '210 20% 96%',
  '--background': '240 11% 7%',
  '--foreground': '210 20% 96%',
  '--card': '240 10% 12%',
  '--card-foreground': '210 20% 96%',
  '--border': '240 5% 22%',
  '--input': '240 5% 22%',
  '--ring': '263 70% 66%',
  '--muted': '240 6% 18%',
  '--muted-foreground': '215 20% 72%',
  '--popover': '240 10% 10%',
  '--popover-foreground': '210 20% 96%',
  '--destructive': '0 72% 45%',
  '--destructive-foreground': '210 20% 96%',
  '--chart-1': '267 84% 80%',
  '--chart-2': '173 72% 55%',
  '--chart-3': '198 65% 50%',
  '--chart-4': '48 96% 65%',
  '--chart-5': '17 90% 66%',
  '--sidebar-background': '240 13% 9%',
  '--sidebar-foreground': '210 20% 96%',
  '--sidebar-primary': '263 70% 66%',
  '--sidebar-primary-foreground': '210 20% 96%',
  '--sidebar-accent': '263 62% 22%',
  '--sidebar-accent-foreground': '210 20% 96%',
  '--sidebar-border': '240 6% 18%',
  '--sidebar-ring': '263 70% 66%',
  '--status-new': '210 90% 70%',
  '--status-ongoing': '32 100% 70%',
  '--status-resolved': '135 74% 68%',
  '--status-high': '0 82% 62%',
};

const vixLight: ThemeTokens = {
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
  '--chart-1': '32 95% 55%',
  '--chart-2': '158 60% 40%',
  '--chart-3': '200 45% 30%',
  '--chart-4': '50 85% 60%',
  '--chart-5': '12 85% 62%',
  '--sidebar-background': '45 10% 97%',
  '--sidebar-foreground': '45 25% 20%',
  '--sidebar-primary': '45 93% 47%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-accent': '45 40% 90%',
  '--sidebar-accent-foreground': '45 30% 25%',
  '--sidebar-border': '45 20% 85%',
  '--sidebar-ring': '45 93% 47%',
  '--status-new': '210 90% 60%',
  '--status-ongoing': '32 100% 60%',
  '--status-resolved': '120 40% 60%',
  '--status-high': '0 72% 60%',
};

const oficinaMudaLight: ThemeTokens = {
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
  '--chart-1': '32 95% 55%',
  '--chart-2': '120 40% 40%',
  '--chart-3': '200 45% 30%',
  '--chart-4': '50 85% 60%',
  '--chart-5': '12 85% 62%',
  '--sidebar-background': '45 15% 97%',
  '--sidebar-foreground': '15 45% 20%',
  '--sidebar-primary': '15 58% 29%',
  '--sidebar-primary-foreground': '210 20% 98%',
  '--sidebar-accent': '45 84% 75%',
  '--sidebar-accent-foreground': '15 58% 25%',
  '--sidebar-border': '45 20% 85%',
  '--sidebar-ring': '15 58% 29%',
  '--status-new': '210 90% 60%',
  '--status-ongoing': '32 100% 60%',
  '--status-resolved': '120 40% 60%',
  '--status-high': '0 72% 60%',
};

const THEMES: Record<string, ThemeDefinition> = {
  default: {
    name: 'Ticket Wise',
    colors: {
      light: ticketWiseLight,
      dark: ticketWiseDark,
    },
  },
  vix: {
    name: 'ViX Brasil',
    colors: {
      light: vixLight,
      dark: { ...vixLight },
    },
  },
  oficinaMuda: {
    name: 'Oficina Muda',
    colors: {
      light: oficinaMudaLight,
      dark: { ...oficinaMudaLight },
    },
  },
} as const;

type ThemeKey = keyof typeof THEMES;
const DEFAULT_THEME_KEY: ThemeKey = 'default';

const DOMAIN_THEME_MAP: Record<string, ThemeKey> = {
  'suporte.vixbrasil.com': 'vix',
  'sistema.vixbrasil.com': 'vix',
  'vixbrasil.com': 'vix',
  'suporte.oficinamuda.com.br': 'oficinaMuda',
  'oficinamuda.com.br': 'oficinaMuda',
};

function detectThemeFromDomain(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT_THEME_KEY;

  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);

  const themeParam = urlParams.get('theme');
  if (themeParam && themeParam in THEMES) {
    return themeParam as ThemeKey;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const devTheme = localStorage.getItem('dev-theme');
    if (devTheme && devTheme in THEMES) {
      return devTheme as ThemeKey;
    }
  }

  const sortedDomains = Object.keys(DOMAIN_THEME_MAP).sort((a, b) => b.length - a.length);
  for (const domain of sortedDomains) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return DOMAIN_THEME_MAP[domain];
    }
  }

  return DEFAULT_THEME_KEY;
}

function applyThemeColors(themeName: ThemeKey, mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME_KEY];
  const palette = theme.colors[mode] ?? theme.colors.light;
  const root = document.documentElement;
  const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  Object.entries(palette).forEach(([property, value]) => {
    if (isProduction) {
      root.style.setProperty(property, value, 'important');
    } else {
      root.style.setProperty(property, value);
    }
  });

  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  document.title = `${theme.name} - Sistema de Gestão de Chamados`;
}

function verifyThemeApplication(themeName: ThemeKey, mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME_KEY];
  const palette = theme.colors[mode] ?? theme.colors.light;
  const expectedPrimary = palette['--primary'];
  if (!expectedPrimary) return;

  const computedStyle = window.getComputedStyle(document.documentElement);
  const appliedPrimary = computedStyle.getPropertyValue('--primary').trim();
  if (appliedPrimary !== expectedPrimary) {
    applyThemeColors(themeName, mode);
    const root = document.documentElement;
    root.className = root.className;
  }
}

function getLogoForTheme(themeName: ThemeKey): string | null {
  if (themeName === 'oficinaMuda') {
    return '/logo_muda.png';
  }
  return null;
}

interface ThemeState {
  themeName: ThemeKey;
  companyName: string;
  companyLogo: string | null;
  isLoading: boolean;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeState, setThemeState] = useState<ThemeState>({
    themeName: DEFAULT_THEME_KEY,
    companyName: THEMES[DEFAULT_THEME_KEY].name,
    companyLogo: getLogoForTheme(DEFAULT_THEME_KEY),
    isLoading: true,
    mode: 'light',
  });
  const hasAppliedThemeRef = useRef(false);
  const manualModePreferenceRef = useRef(false);

  const setMode = useCallback((mode: ThemeMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme-mode', mode);
      manualModePreferenceRef.current = true;
    }
    setThemeState((prev) => (prev.mode === mode ? prev : { ...prev, mode }));
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => {
      const nextMode: ThemeMode = prev.mode === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('theme-mode', nextMode);
        manualModePreferenceRef.current = true;
      }
      if (prev.mode === nextMode) {
        return prev;
      }
      return { ...prev, mode: nextMode };
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectedTheme = detectThemeFromDomain();
    const theme = THEMES[detectedTheme] ?? THEMES[DEFAULT_THEME_KEY];

    const storedMode = window.localStorage.getItem('theme-mode') as ThemeMode | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialMode: ThemeMode =
      storedMode === 'dark' || storedMode === 'light'
        ? storedMode
        : prefersDark
        ? 'dark'
        : 'light';

    manualModePreferenceRef.current = storedMode === 'dark' || storedMode === 'light';

    setThemeState({
      themeName: detectedTheme,
      companyName: theme.name,
      companyLogo: getLogoForTheme(detectedTheme),
      isLoading: false,
      mode: initialMode,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (themeState.isLoading) return;

    applyThemeColors(themeState.themeName, themeState.mode);

    const isFirstApplication = !hasAppliedThemeRef.current;
    if (isFirstApplication) {
      document.documentElement.style.display = 'none';
      document.documentElement.offsetHeight;
      document.documentElement.style.display = '';
      hasAppliedThemeRef.current = true;
    }

    const timeouts: number[] = [];
    if (isFirstApplication) {
      timeouts.push(
        window.setTimeout(() => applyThemeColors(themeState.themeName, themeState.mode), 100),
      );
    }
    timeouts.push(
      window.setTimeout(
        () => verifyThemeApplication(themeState.themeName, themeState.mode),
        isFirstApplication ? 500 : 100,
      ),
      window.setTimeout(
        () => verifyThemeApplication(themeState.themeName, themeState.mode),
        isFirstApplication ? 1000 : 250,
      ),
    );

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [themeState.themeName, themeState.mode, themeState.isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (manualModePreferenceRef.current) {
      return;
    }

    const listener = (event: MediaQueryListEvent) => {
      setThemeState((prev) => ({
        ...prev,
        mode: event.matches ? 'dark' : 'light',
      }));
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      themeName: themeState.themeName,
      companyName: themeState.companyName,
      companyLogo: themeState.companyLogo,
      isLoading: themeState.isLoading,
      mode: themeState.mode,
      setMode,
      toggleMode,
    }),
    [themeState, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

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
  },
};

if (typeof window !== 'undefined') {
  (window as any).themeDevUtils = devUtils;
}
