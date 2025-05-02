import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserX, UserCheck, UserCog } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Official } from '@shared/schema';
import { Badge } from "@/components/ui/badge";

interface ToggleStatusOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  official: Official | null;
}

export function ToggleStatusOfficialDialog({ open, onOpenChange, official }: ToggleStatusOfficialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!official?.id) return;
      const res = await apiRequest('PATCH', `/api/officials/${official.id}/toggle-status`, { 
        isActive: !official.isActive 
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
      setProcessing(false);
      onOpenChange(false);
      toast({
        title: data.isActive ? "Atendente ativado" : "Atendente desativado",
        description: data.isActive 
          ? "O atendente foi ativado com sucesso." 
          : "O atendente foi desativado com sucesso.",
      });
    },
    onError: (error) => {
      setProcessing(false);
      toast({
        title: "Erro ao alterar status do atendente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggleStatus = () => {
    setProcessing(true);
    toggleStatusMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {official && official.isActive ? "Desativar atendente" : "Ativar atendente"}
          </DialogTitle>
          <DialogDescription>
            {official && official.isActive ? 
              "Ao desativar um atendente, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico." :
              "Ao ativar um atendente, ele voltará a ter acesso ao sistema com suas mesmas permissões anteriores."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
            <div className="mr-3">
              <UserCog className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">{official?.name}</p>
              <p className="text-sm text-neutral-500">{official?.email}</p>
            </div>
          </div>
          
          {official && official.departments && official.departments.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-1">Departamentos:</p>
              <div className="flex flex-wrap gap-1">
                {official.departments.map((dept) => (
                  <Badge key={dept} variant="outline" className="capitalize">
                    {dept === 'technical' && 'Suporte Técnico'}
                    {dept === 'billing' && 'Faturamento'}
                    {dept === 'general' && 'Atendimento Geral'}
                    {dept === 'sales' && 'Vendas'}
                    {dept === 'other' && 'Outro'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <p className="text-sm text-neutral-600 mb-6">
            {official && official.isActive ? 
              "Esta ação não exclui o atendente permanentemente. Os dados serão mantidos para histórico e poderá ser reativado a qualquer momento." :
              "Ao ativar o atendente, ele poderá realizar login novamente no sistema e atender tickets."}
          </p>
        </div>
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleToggleStatus}
            variant={official && official.isActive ? "destructive" : "default"}
            className={official && official.isActive ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
            disabled={processing}
          >
            {official && official.isActive ? (
              <>
                <UserX className="h-4 w-4 mr-2" />
                {processing ? "Desativando..." : "Desativar"}
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                {processing ? "Ativando..." : "Ativar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
