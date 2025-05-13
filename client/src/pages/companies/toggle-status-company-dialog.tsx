// @ts-nocheck
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Company {
  id: number;
  name: string;
  email: string;
  domain: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ToggleStatusCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onStatusChanged?: () => void;
}

export default function ToggleStatusCompanyDialog({ 
  open, 
  onOpenChange, 
  company, 
  onStatusChanged 
}: ToggleStatusCompanyDialogProps) {
  const { toast } = useToast();

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error('Nenhuma empresa selecionada');
      const res = await apiRequest('PATCH', `/api/companies/${company.id}/toggle-status`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: `Empresa ${company?.active ? 'desativada' : 'ativada'} com sucesso`,
        description: `A empresa foi ${company?.active ? 'desativada' : 'ativada'} no sistema`,
        variant: 'default',
      });
      onOpenChange(false);
      if (onStatusChanged) onStatusChanged();
    },
    onError: (error: Error) => {
      toast({
        title: `Erro ao ${company?.active ? 'desativar' : 'ativar'} empresa`,
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
          <DialogTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
            {company?.active ? 'Desativar' : 'Ativar'} Empresa
          </DialogTitle>
          <DialogDescription>
            {company?.active
              ? 'Você está prestes a desativar esta empresa. Isso impedirá seu acesso ao sistema.'
              : 'Você está prestes a ativar esta empresa novamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-2">
            <strong>Empresa:</strong> {company?.name}
          </p>
          <p className="mb-4">
            <strong>Email:</strong> {company?.email}
          </p>

          {company?.active && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
              <p className="text-amber-800 text-sm">
                Ao desativar uma empresa, todos os seus usuários perderão o acesso ao sistema.
                Esta ação pode ser revertida posteriormente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex space-x-2 justify-end">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={toggleStatusMutation.isPending}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            variant={company?.active ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={toggleStatusMutation.isPending}
            className={company?.active ? "bg-amber-500 hover:bg-amber-500/90" : ""}
          >
            {toggleStatusMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              company?.active ? 'Desativar Empresa' : 'Ativar Empresa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 