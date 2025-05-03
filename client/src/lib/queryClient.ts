import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
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
