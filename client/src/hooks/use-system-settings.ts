import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { getCurrentCompanyName } from '@/lib/theme-manager';

export interface SystemSettings {
  companyName: string;
  supportEmail: string;
  allowCustomerRegistration: boolean;
}

// Valores padrão para as configurações do sistema
const defaultSettings: SystemSettings = {
  companyName: getCurrentCompanyName(),
  supportEmail: 'suporte@ticketflow.com.br',
  allowCustomerRegistration: true
};

export function useSystemSettings() {
  const { user } = useAuth();
  
  const { data, isLoading, error } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/general'],
    queryFn: () => fetch('/api/settings/general').then(res => {
      if (!res.ok) {
        // Se der 403 (sem permissão), retornar valores padrão
        if (res.status === 403) {
          return defaultSettings;
        }
        throw new Error('Erro ao carregar configurações');
      }
      return res.json();
    }),
    // Se a requisição falhar, não tentar novamente para não sobrecarregar o servidor
    retry: false,
    // Não mostrar erro na UI para configurações (é esperado que usuários não-admin recebam 403)
    throwOnError: false,
    // Tempo de cache mais longo para configurações
    staleTime: 5 * 60 * 1000, // 5 minutos
    // Só executar quando o usuário estiver autenticado
    enabled: !!user,
  });

  // Mesclar configurações carregadas com valores padrão
  const settings = data || defaultSettings;

  return {
    // Retorna todos os valores de configuração
    ...settings,
    // Adiciona também variáveis específicas para mais clareza no código
    settings,
    isLoading,
    error
  };
}
