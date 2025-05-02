import { useQuery } from '@tanstack/react-query';

export interface SystemSettings {
  companyName: string;
  supportEmail: string;
  allowCustomerRegistration: boolean;
}

// Valores padrão para as configurações do sistema
const defaultSettings: SystemSettings = {
  companyName: 'Ticket Lead',
  supportEmail: 'suporte@ticketlead.com.br',
  allowCustomerRegistration: true
};

export function useSystemSettings() {
  const { data, isLoading, error } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/general'],
    // Se a requisição falhar, não tentar novamente para não sobrecarregar o servidor
    retry: false,
    // Não mostrar erro na UI para configurações (é esperado que usuários não-admin recebam 403)
    throwOnError: false,
    // Tempo de cache mais longo para configurações
    staleTime: 5 * 60 * 1000, // 5 minutos
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
