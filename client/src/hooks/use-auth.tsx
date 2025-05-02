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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: true, // Sempre habilitado para verificar o estado atual da autenticação
  });

  // Removido o useEffect de refetch, pois a consulta já está enabled=true

  useEffect(() => {
    if (data) {
      setUser(data as User);
      setError(null);
    } else if (queryError) {
      // Se a consulta falhar, apenas log o erro, mas não configura o usuário
      console.error('Erro ao verificar usuário:', queryError);
      // Não definimos setUser(null) aqui para evitar loops de redirecionamento
    }
  }, [data, queryError]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      const userData = await response.json();
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
    isLoading,
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
