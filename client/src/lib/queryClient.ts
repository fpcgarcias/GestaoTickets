import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Tenta obter o corpo como JSON primeiro
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.clone().json();
        throw new Error(`${res.status}: ${errorData.error || res.statusText}`);
      } else {
        // Se não for JSON, pega o texto
        const text = await res.text();
        console.error('[DEBUG] Resposta não-JSON recebida:', text.substring(0, 200));
        if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
          throw new Error(`${res.status}: Recebeu HTML quando deveria receber JSON. Verifique as rotas da API.`);
        }
        throw new Error(`${res.status}: ${text.substring(0, 100) || res.statusText}`);
      }
    } catch (parseError) {
      console.error('[DEBUG] Erro ao processar resposta de erro:', parseError);
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`[DEBUG] Enviando requisição ${method} para ${url}`, data ? { data } : '');
  try {
    // Verificar se está usando a URL correta
    if (url.startsWith('/settings/')) {
      console.warn('[AVISO API] Usando URL legada: ' + url);
      console.warn('[AVISO API] Considere migrar para as novas APIs');
    }
    
    // Corrigir prefixos de API automaticamente
    // Isso detecta padrões comuns de URLs internas e garante que tenham o prefixo /api/
    const shouldHaveApiPrefix = url.match(/^\/(ticket-types|incident-types|departments|companies|officials|customers|users)(?:\/|$)/);
    if (shouldHaveApiPrefix && !url.startsWith('/api/')) {
      const correctedUrl = `/api${url}`;
      console.warn('[AVISO API] URL corrigida automaticamente:', url, '->', correctedUrl);
      url = correctedUrl;
    }

    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`[DEBUG] Resposta recebida: ${url} - Status: ${res.status}`);
    
    // Para erros 500, vamos mostrar mais detalhes
    if (res.status >= 500) {
      try {
        const text = await res.clone().text();
        console.error(`[DEBUG] Detalhes do erro ${res.status}:`, text.substring(0, 200));
        
        if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
          console.error('[ERRO API] A resposta é HTML, não JSON!');
        }
      } catch (e) {
        console.error('[DEBUG] Não foi possível ler o corpo da resposta de erro');
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`[DEBUG] Erro na requisição ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log('[DEBUG] Iniciando requisição:', queryKey[0]);
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      console.log('[DEBUG] Resposta recebida:', queryKey[0], 'Status:', res.status);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log('[DEBUG] Retornando null por causa de 401:', queryKey[0]);
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log('[DEBUG] Dados recebidos para', queryKey[0], 'Quantidade:', Array.isArray(data) ? data.length : 'Objeto');
      return data;
    } catch (error) {
      console.error('[DEBUG] Erro na requisição:', queryKey[0], error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mudar comportamento padrão para retornar null em vez de lançar erro em 401
      // Isso evita loops de autenticação
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
