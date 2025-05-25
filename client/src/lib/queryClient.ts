import { QueryClient } from "@tanstack/react-query";

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any
): Promise<Response> {
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  const res = await fetch(url, config);
  
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
    
    throw new Error(errorMessage);
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
