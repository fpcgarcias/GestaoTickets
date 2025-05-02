import { useQuery } from '@tanstack/react-query';

export interface SystemSettings {
  companyName: string;
  supportEmail: string;
  allowCustomerRegistration: boolean;
}

export function useSystemSettings() {
  const { data: settings, isLoading, error } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/general'],
  });

  return {
    settings,
    isLoading,
    error,
    companyName: settings?.companyName || 'Ticket Lead'
  };
}
