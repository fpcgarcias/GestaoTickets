import React, { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'support' | 'customer';
  name: string;
  avatarUrl?: string;
  initials?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const { data, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false, // Não tentar novamente em caso de falha
    refetchInterval: false, // Não fazer requisições em intervalo
    refetchOnWindowFocus: false, // Não refetch ao focar a janela
    staleTime: 60 * 1000, // 1 minuto
  });

  useEffect(() => {
    if (data) {
      setUser(data as User);
      setError(null);
    } else if (queryError) {
      console.error('Erro ao verificar usuário:', queryError);
      setUser(null);
    }
    setIsInitializing(false);
  }, [data, queryError]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      
      // --- DEBUG LOGIN FRONTEND ---
      console.log('DEBUG FE: Login Response Status:', response.status);
      const responseText = await response.text(); // Ler como texto primeiro
      console.log('DEBUG FE: Login Response Body Text:', responseText);
      // --- FIM DEBUG ---
      
      // Tentar fazer parse do JSON agora
      const userData = JSON.parse(responseText);
      console.log('DEBUG FE: Parsed User Data:', userData); // Logar dados parseados

      setUser(userData);
      // Atualiza o cache do React Query com os dados do usuário
      queryClient.setQueryData(['/api/auth/me'], userData);
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Falha ao fazer login'));
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      setUser(null);
      // Limpa o cache do React Query para o usuário
      queryClient.setQueryData(['/api/auth/me'], null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Falha ao fazer logout'));
      throw err;
    }
  };

  const value = {
    user,
    isLoading: isInitializing,
    error,
    login,
    logout,
    isAuthenticated: !!user
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
