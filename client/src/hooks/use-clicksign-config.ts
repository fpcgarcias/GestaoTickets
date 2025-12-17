import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ClicksignConfig {
  accessToken: string | null;
  apiUrl: string;
  webhookSecret: string | null;
  enabled: boolean;
}

export interface ClicksignConfigResponse {
  success: boolean;
  data: ClicksignConfig;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  data?: any;
}

export function useClicksignConfig() {
  return useQuery<ClicksignConfigResponse>({
    queryKey: ['clicksign-config'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clicksign-config');
      if (!response.ok) {
        throw new Error('Failed to fetch ClickSign config');
      }
      return response.json();
    },
  });
}

export function useUpdateClicksignConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: Partial<ClicksignConfig>) => {
      const response = await apiRequest('PUT', '/api/clicksign-config', config);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update ClickSign config' }));
        throw new Error(error.message || 'Failed to update ClickSign config');
      }
      return response.json();
    },
    onSuccess: () => {
      // NÃO invalidar a query para evitar resetar o formulário
      // Os valores digitados devem permanecer visíveis após salvar
      // queryClient.invalidateQueries({ queryKey: ['clicksign-config'] });
    },
  });
}

export function useTestClicksignConnection() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/clicksign-config/test');
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to test ClickSign connection' }));
        throw new Error(error.message || 'Failed to test ClickSign connection');
      }
      return response.json() as Promise<TestConnectionResponse>;
    },
  });
}

