import React, { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient, setSessionExpiredCallback } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface Company {
  id: number;
  name: string;
  email: string;
  domain?: string;
  active: boolean;
  cnpj?: string;
  phone?: string;
  ai_permission?: boolean;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'support' | 'customer' | 'manager' | 'supervisor' | 'viewer' | 'company_admin' | 'triage' | 'quality' | 'integration_bot';
  name: string;
  avatarUrl?: string;
  initials?: string;
  companyId?: number;
  company_id?: number;
  company?: Company;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  company: Company | null;
  mustChangePassword: { show: boolean; userId: number | null };
  clearMustChangePassword: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<{ show: boolean; userId: number | null }>({ 
    show: false, 
    userId: null 
  });
  const [, setLocation] = useLocation();

  // Função para lidar com sessão expirada
  const handleSessionExpired = () => {
    console.log('🔒 [AUTH] Limpando estado de autenticação e redirecionando...');
    setUser(null);
    setCompany(null);
    setError(null);
    queryClient.setQueryData(['/api/auth/me'], null);
    setLocation('/auth');
  };

  // Configurar callback global para sessão expirada
  useEffect(() => {
    setSessionExpiredCallback(handleSessionExpired);
  }, []);

  // Detecção por Visibility API - verificar sessão quando usuário volta à aba
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Só verificar se a aba ficou visível e há um usuário logado
      if (!document.hidden && user) {
        try {
          // Fazer uma requisição simples para verificar se a sessão ainda é válida
          await apiRequest('GET', '/api/auth/me');
        } catch (error: any) {
          // Se a requisição falhar com 401/403, o interceptor global já vai lidar
          // Mas podemos adicionar um log adicional aqui se necessário
          if (error.status === 401 || error.status === 403) {
            console.log('🔒 [AUTH] Sessão expirada detectada via Visibility API');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const { data, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => apiRequest('GET', '/api/auth/me').then(res => res.json()),
    retry: false, // Não tentar novamente em caso de falha
    refetchInterval: false, // Não fazer requisições em intervalo
    refetchOnWindowFocus: false, // Não refetch ao focar a janela
    staleTime: 60 * 1000, // 1 minuto
  });

  useEffect(() => {
    // Só considerar inicialização completa quando a query não estiver mais carregando
    if (!isQueryLoading) {
      if (data) {
        setUser(data as User);
        if ((data as User).company) {
          setCompany((data as User).company as Company);
        }
        setError(null);
      } else if (queryError) {
        setUser(null);
        setCompany(null);
        setError(queryError as Error);
      }
      setIsInitializing(false);
    }
  }, [data, queryError, isQueryLoading]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      const response = await apiRequest('POST', '/api/auth/login', { 
        username, 
        password
      });
      
      const responseText = await response.text();
      
      let userData;
      try {
        userData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Resposta inválida do servidor');
      }

      // Verificar se o usuário precisa trocar a senha
      if (userData.must_change_password) {
        setMustChangePassword({ show: true, userId: userData.user_id });
        return; // Não continuar com o login normal
      }

      setUser(userData);
      if (userData.company) {
        setCompany(userData.company);
      }
      
      queryClient.setQueryData(['/api/auth/me'], userData);
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Falha ao fazer login'));
      throw err;
    }
  };

  const clearMustChangePassword = () => {
    setMustChangePassword({ show: false, userId: null });
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      handleSessionExpired(); // Usar a mesma função de limpeza
    } catch (err) {
      // Mesmo se o logout falhar no servidor, limpar o estado local
      handleSessionExpired();
      setError(err instanceof Error ? err : new Error('Falha ao fazer logout'));
      throw err;
    }
  };

  const value = {
    user,
    company,
    isLoading: isInitializing || isQueryLoading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    mustChangePassword,
    clearMustChangePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
