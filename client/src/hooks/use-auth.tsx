import React, { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: false, // We'll manually trigger this
  });

  useEffect(() => {
    // Check if user is already logged in
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (data) {
      setUser(data as User);
      setError(null);
    }
  }, [data]);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      const userData = await response.json();
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to login'));
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to logout'));
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
