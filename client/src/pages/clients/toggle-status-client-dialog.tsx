import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, UserCog, UserX, UserCheck } from 'lucide-react';
import { Customer } from '@shared/schema';

interface ToggleStatusClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: (Customer & { active?: boolean }) | null;
  onStatusChanged?: () => void;
}

export default function ToggleStatusClientDialog({ 
  open, 
  onOpenChange, 
  client, 
  onStatusChanged 
}: ToggleStatusClientDialogProps) {
  const { toast } = useToast();
  
  // Verificar se o cliente está ativo
  const isActive = client ? 'active' in client ? client.active !== false : !!client.user_id : false;
  
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Cliente não selecionado');
      const res = await apiRequest('DELETE', `/api/customers/${client.id}`);
      return res.json();
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      onOpenChange(false);
      if (onStatusChanged) onStatusChanged();
      
      // Mensagem específica para ativação/inativação
      if (isActive) {
        toast({
          title: 'Cliente inativado com sucesso',
          description: 'O cliente foi inativado e não poderá mais acessar o sistema',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Cliente ativado com sucesso',
          description: 'O cliente agora pode acessar o sistema normalmente',
          variant: 'default',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: isActive ? 'Erro ao inativar cliente' : 'Erro ao ativar cliente',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleConfirm = () => {
    toggleStatusMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Inativar Cliente" : "Ativar Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isActive 
              ? "Ao inativar um cliente, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico."
              : "Ao ativar um cliente, ele voltará a ter acesso ao sistema com suas mesmas permissões anteriores."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
            <div className="mr-3">
              <UserCog className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">{client?.name}</p>
              <p className="text-sm text-neutral-500">{client?.email}</p>
              {client?.company && (
                <p className="text-sm text-neutral-500">{client.company}</p>
              )}
            </div>
          </div>
          
          <p className="text-sm text-neutral-600 mb-6">
            {isActive 
              ? "Esta ação não exclui o cliente permanentemente. Os dados serão mantidos para histórico, mas o cliente não poderá mais acessar o sistema."
              : "Ao ativar o cliente, ele poderá realizar login novamente no sistema."
            }
          </p>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              variant={isActive ? "destructive" : "default"}
              className={isActive ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
              onClick={handleConfirm}
              disabled={toggleStatusMutation.isPending || !client}
            >
              {toggleStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isActive ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Confirmar Inativação
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Confirmar Ativação
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
