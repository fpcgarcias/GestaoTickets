import { QueryClient, DefaultOptions } from '@tanstack/react-query';

// Configurações otimizadas para diferentes tipos de dados
const defaultOptions: DefaultOptions = {
  queries: {
    // Cache por 5 minutos para dados que mudam pouco
    staleTime: 5 * 60 * 1000, // 5 minutos
    
    // Manter cache por 10 minutos após não ser usado
    gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
    
    // Não refetch automaticamente quando a janela ganha foco
    refetchOnWindowFocus: false,
    
    // Não refetch automaticamente quando reconecta
    refetchOnReconnect: 'always',
    
    // Retry apenas 1 vez em caso de erro
    retry: (failureCount, error: any) => {
      // Não retry para erros 4xx (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry até 2 vezes para outros erros
      return failureCount < 2;
    },
    
    // Delay entre retries (exponential backoff)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Configurações de network mode
    networkMode: 'online'
  },
  
  mutations: {
    // Retry apenas 1 vez para mutations
    retry: 1,
    
    // Network mode para mutations
    networkMode: 'online'
  }
};

// Configurações específicas por tipo de query
export const queryConfigs = {
  // Dados que mudam frequentemente (tickets, notificações)
  // NOTA: refetchInterval deve ser configurado individualmente usando useBusinessHoursRefetchInterval
  realtime: {
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 2 * 60 * 1000, // 2 minutos
    // refetchInterval removido - usar useBusinessHoursRefetchInterval nos componentes
  },
  
  // Dados que mudam ocasionalmente (usuários, solicitantes)
  dynamic: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  },
  
  // Dados que raramente mudam (configurações, departamentos)
  static: {
    staleTime: 15 * 60 * 1000, // 15 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  },
  
  // Dados que nunca mudam (enums, constantes)
  immutable: {
    staleTime: Infinity,
    gcTime: Infinity,
  }
};

// Criar solicitante com configurações otimizadas
export const queryClient = new QueryClient({
  defaultOptions,
  
});

// Função helper para criar query keys consistentes
export const createQueryKey = (entity: string, params?: Record<string, any>) => {
  const baseKey = [entity];
  
  if (params) {
    // Ordenar parâmetros para consistência
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    
    baseKey.push(JSON.stringify(sortedParams));
  }
  
  return baseKey;
};

// Query keys padronizadas para o sistema
export const queryKeys = {
  // Tickets
  tickets: {
    all: () => createQueryKey('tickets'),
    list: (filters?: any) => createQueryKey('tickets', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('tickets', { type: 'detail', id }),
    stats: () => createQueryKey('tickets', { type: 'stats' }),
    recent: (limit?: number) => createQueryKey('tickets', { type: 'recent', limit }),
    replies: (ticketId: number) => createQueryKey('ticket-replies', { ticketId }),
    history: (ticketId: number) => createQueryKey('ticket-history', { ticketId }),
    attachments: (ticketId: number) => createQueryKey('ticket-attachments', { ticketId })
  },
  
  // Usuários
  users: {
    all: () => createQueryKey('users'),
    list: (filters?: any) => createQueryKey('users', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('users', { type: 'detail', id }),
    current: () => createQueryKey('users', { type: 'current' })
  },
  
  // solicitantes
  customers: {
    all: () => createQueryKey('customers'),
    list: (filters?: any) => createQueryKey('customers', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('customers', { type: 'detail', id })
  },
  
  // Atendentes
  officials: {
    all: () => createQueryKey('officials'),
    list: (filters?: any) => createQueryKey('officials', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('officials', { type: 'detail', id })
  },
  
  // Departamentos
  departments: {
    all: () => createQueryKey('departments'),
    list: (filters?: any) => createQueryKey('departments', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('departments', { type: 'detail', id })
  },
  
  // Empresas
  companies: {
    all: () => createQueryKey('companies'),
    list: (filters?: any) => createQueryKey('companies', { type: 'list', ...filters }),
    detail: (id: number) => createQueryKey('companies', { type: 'detail', id })
  },
  
  // Tipos de incidente
  incidentTypes: {
    all: () => createQueryKey('incident-types'),
    list: (filters?: any) => createQueryKey('incident-types', { type: 'list', ...filters })
  },
  
  // Configurações
  settings: {
    general: () => createQueryKey('settings', { type: 'general' }),
    sla: (companyId?: number) => createQueryKey('settings', { type: 'sla', companyId }),
    notifications: () => createQueryKey('settings', { type: 'notifications' }),
    email: () => createQueryKey('settings', { type: 'email' })
  }
};

// Função para invalidar queries relacionadas
export const invalidateRelatedQueries = async (entity: string, action: 'create' | 'update' | 'delete') => {
  switch (entity) {
    case 'ticket':
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.stats() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.recent() });
      break;
      
    case 'user':
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      if (action === 'create') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.officials.all() });
      }
      break;
      
    case 'customer':
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      break;
      
    case 'official':
      await queryClient.invalidateQueries({ queryKey: queryKeys.officials.all() });
      break;
      
    case 'department':
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all() });
      break;
      
    case 'company':
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all() });
      break;
      
    case 'incident-type':
      await queryClient.invalidateQueries({ queryKey: queryKeys.incidentTypes.all() });
      break;
  }
};

// Função para prefetch dados importantes
export const prefetchCriticalData = async () => {
  // Prefetch dados que são usados em múltiplas páginas
  const prefetchPromises = [
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.current(),
      queryFn: () => fetch('/api/auth/me').then(res => res.json()),
      ...queryConfigs.static
    }),
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.departments.all(),
      queryFn: () => fetch('/api/departments?active_only=true').then(res => res.json()),
      ...queryConfigs.static
    }),
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.incidentTypes.all(),
      queryFn: () => fetch('/api/incident-types').then(res => res.json()),
      ...queryConfigs.static
    })
  ];
  
  try {
    await Promise.allSettled(prefetchPromises);
  } catch (error) {
    console.warn('Erro ao fazer prefetch de dados críticos:', error);
  }
};

export default queryClient; 