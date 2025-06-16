
// ARQUIVO LEGADO - Mantido apenas para compatibilidade
// O novo sistema de tema está em /contexts/theme-context.tsx

// 🧪 FUNÇÕES DE DESENVOLVIMENTO PARA TESTE DE TEMAS (compatibilidade)
export const devUtils = {
  // Redireciona para o novo sistema
  setTheme: (themeName: string) => {
    if (typeof window !== 'undefined' && (window as any).themeDevUtils) {
      (window as any).themeDevUtils.setTheme(themeName);
    } else {
      console.warn('⚠️ Use o novo sistema: window.themeDevUtils.setTheme()');
    }
  },
  
  clearTheme: () => {
    if (typeof window !== 'undefined' && (window as any).themeDevUtils) {
      (window as any).themeDevUtils.clearTheme();
    } else {
      console.warn('⚠️ Use o novo sistema: window.themeDevUtils.clearTheme()');
    }
  },
  
  listThemes: () => {
    if (typeof window !== 'undefined' && (window as any).themeDevUtils) {
      (window as any).themeDevUtils.listThemes();
    } else {
      console.warn('⚠️ Use o novo sistema: window.themeDevUtils.listThemes()');
    }
  }
};

// Manter no window para compatibilidade com código existente
if (typeof window !== 'undefined') {
  (window as any).themeDevUtilsLegacy = devUtils;
}