import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, UserCog } from 'lucide-react';
import { Customer } from '@shared/schema';

interface ToggleStatusClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Customer | null;
}

export default function ToggleStatusClientDialog({ 
  open, 
  onOpenChange, 
  client 
}: ToggleStatusClientDialogProps) {
  const { toast } = useToast();
  
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Cliente não selecionado');
      const res = await apiRequest('DELETE', `/api/customers/${client.id}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      onOpenChange(false);
      toast({
        title: data.inactive ? 'Cliente inativado com sucesso' : 'Cliente removido com sucesso',
        description: data.inactive ? 'O cliente foi inativado e não poderá mais acessar o sistema' : 'O cliente foi removido do sistema',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao inativar/remover cliente',
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
          <DialogTitle>Inativar Cliente</DialogTitle>
          <DialogDescription>
            Ao inativar um cliente, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico.
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
            Esta ação não exclui o cliente permanentemente. Os dados serão mantidos para histórico, mas o cliente não poderá mais acessar o sistema.
          </p>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirm}
              disabled={toggleStatusMutation.isPending || !client}
            >
              {toggleStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Inativação'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
