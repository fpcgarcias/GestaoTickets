import { QueryClient } from "@tanstack/react-query";
import { config } from "./config";

// Callback global para quando a sessão expira
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredCallback(callback: () => void) {
  onSessionExpired = callback;
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any
): Promise<Response> {
  // Construir URL completa se for uma URL relativa
  const fullUrl = url.startsWith('http') ? url : `${config.apiBaseUrl}${url}`;
  
  const requestConfig: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && method !== 'GET') {
    requestConfig.body = JSON.stringify(data);
  }

  // Logs apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    console.log(`🌐 [API] ${method} ${fullUrl}`);
  }
  
  const res = await fetch(fullUrl, requestConfig);
  
  if (!res.ok) {
    const errorText = await res.text();
    let errorData: any = null;
    
    try {
      errorData = JSON.parse(errorText);
    } catch (_parseError) {
      // Se não conseguir fazer parse, usar mensagem padrão
      errorData = { message: `${res.status}: ${res.statusText}` };
    }
    
    // Logs apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ [API] Erro ${method} ${fullUrl}:`, errorData.message || errorData);
    }
    
    // Detectar sessão expirada (401 Unauthorized ou 403 Forbidden)
    if (res.status === 401 || res.status === 403) {
      console.log('🔒 [AUTH] Sessão expirada detectada, redirecionando para login...');
      
      // Chamar callback global se estiver definido
      if (onSessionExpired) {
        onSessionExpired();
      }
    }
    
    // Criar erro personalizado que preserva todas as propriedades
    const error = new Error(errorData.message || `${res.status}: ${res.statusText}`) as any;
    
    // Preservar todas as propriedades extras do erro
    if (errorData) {
      Object.keys(errorData).forEach(key => {
        error[key] = errorData[key];
      });
    }
    
    // Adicionar status HTTP
    error.status = res.status;
    
    throw error;
  }

  // Logs apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ [API] Sucesso ${method} ${fullUrl}`);
  }
  
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await apiRequest('GET', queryKey[0] as string);
        
        if (res.status === 401) {
          return null;
        }
        
        const data = await res.json();
        return data;
      },
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
