import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import { ServiceProviderSelect } from './service-provider-select';
import { ServiceProvider, Department } from '@shared/schema';
import { Plus, X, Briefcase, Building2, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ServiceProviderManagementProps {
  ticketId: number;
  departmentId?: number;
  ticketCompanyId?: number;
}

export const ServiceProviderManagement: React.FC<ServiceProviderManagementProps> = ({ 
  ticketId,
  departmentId,
  ticketCompanyId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatMessage } = useI18n();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<ServiceProvider[]>([]);

  // Buscar prestadores do ticket
  const { data: providersData = [], isLoading: isLoadingProviders } = useQuery<ServiceProvider[]>({
    queryKey: [`/api/tickets/${ticketId}/service-providers`],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${ticketId}/service-providers`);
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Falha ao carregar prestadores');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Verificar se o usuário pode gerenciar prestadores
  const canManageProviders = ['admin', 'company_admin', 'support', 'supervisor', 'manager'].includes(user?.role || '');

  // Buscar departamento para verificar se usa prestadores
  const { data: department } = useQuery<Department>({
    queryKey: ['/api/departments', departmentId],
    queryFn: async () => {
      if (!departmentId) return null;
      try {
        const response = await fetch(`/api/departments/${departmentId}`);
        if (!response.ok) {
          return null;
        }
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: !!departmentId,
  });

  // Verificar se o departamento usa prestadores
  const departmentUsesProviders = (department as any)?.use_service_providers === true;

  // Mutation para adicionar prestadores
  const addProvidersMutation = useMutation({
    mutationFn: async (providerIds: number[]) => {
      const results = await Promise.all(
        providerIds.map(providerId =>
          apiRequest('POST', `/api/tickets/${ticketId}/service-providers`, {
            service_provider_id: providerId
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      toast({
        title: 'Prestadores adicionados',
        description: 'Os prestadores foram vinculados ao ticket com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/service-providers`] });
      setIsAddDialogOpen(false);
      setSelectedProviders([]);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar prestadores',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao adicionar os prestadores',
        variant: 'destructive',
      });
    },
  });

  // Mutation para remover prestador
  const removeProviderMutation = useMutation({
    mutationFn: async (providerId: number) => {
      const response = await apiRequest('DELETE', `/api/tickets/${ticketId}/service-providers/${providerId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao remover prestador');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Prestador removido',
        description: 'O prestador foi removido do ticket com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/service-providers`] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover prestador',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao remover o prestador',
        variant: 'destructive',
      });
    },
  });

  const handleAddProviders = () => {
    if (selectedProviders.length === 0) return;
    const providerIds = selectedProviders.map(p => p.id);
    addProvidersMutation.mutate(providerIds);
  };

  const handleRemoveProvider = (providerId: number) => {
    removeProviderMutation.mutate(providerId);
  };

  if (!canManageProviders) {
    return null;
  }

  if (!departmentId) {
    return null;
  }

  if (!departmentUsesProviders) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Prestadores de Serviços</CardTitle>
          {canManageProviders && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoadingProviders ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : providersData.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nenhum prestador vinculado a este ticket
          </div>
        ) : (
          <div className="space-y-2">
            {providersData.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {provider.is_external ? (
                    <Building2 className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Briefcase className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    {provider.is_external && provider.company_name && (
                      <div className="text-sm text-muted-foreground">{provider.company_name}</div>
                    )}
                    {provider.is_external && provider.cnpj && (
                      <div className="text-xs text-muted-foreground">CNPJ: {provider.cnpj}</div>
                    )}
                  </div>
                  <Badge variant={provider.is_external ? 'default' : 'secondary'}>
                    {provider.is_external ? 'Externo' : 'Interno'}
                  </Badge>
                </div>
                {canManageProviders && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProvider(provider.id)}
                    disabled={removeProviderMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog para adicionar prestadores */}
      {canManageProviders && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Prestadores de Serviços</DialogTitle>
              <DialogDescription>
                Selecione os prestadores que serão vinculados a este ticket
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <ServiceProviderSelect
                selectedProviders={selectedProviders}
                onSelectionChange={setSelectedProviders}
                placeholder="Buscar e selecionar prestadores..."
                departmentId={departmentId}
                companyId={ticketCompanyId}
              />
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddProviders}
                  disabled={addProvidersMutation.isPending || selectedProviders.length === 0}
                >
                  {addProvidersMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

