import { QueryClient } from "@tanstack/react-query";
import { config } from "./config";

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

  console.log(`🌐 [API] ${method} ${fullUrl}`);
  
  const res = await fetch(fullUrl, requestConfig);
  
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = `${res.status}: ${res.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // Se não conseguir fazer parse, usar a mensagem padrão
    }
    
    console.error(`❌ [API] Erro ${method} ${fullUrl}:`, errorMessage);
    throw new Error(errorMessage);
  }

  console.log(`✅ [API] Sucesso ${method} ${fullUrl}`);
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
