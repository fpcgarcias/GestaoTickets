import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Official } from '@shared/schema';

interface DeleteOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  official: Official | null;
}

export function DeleteOfficialDialog({ open, onOpenChange, official }: DeleteOfficialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const deleteOfficialMutation = useMutation({
    mutationFn: async () => {
      if (!official?.id) return;
      const res = await apiRequest('DELETE', `/api/officials/${official.id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
      setDeleting(false);
      onOpenChange(false);
      toast({
        title: "Atendente excluído",
        description: "O atendente foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      setDeleting(false);
      toast({
        title: "Erro ao excluir atendente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleDelete = () => {
    setDeleting(true);
    deleteOfficialMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir este atendente? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-2"><strong>Nome:</strong> {official?.name}</p>
          <p className="mb-2"><strong>Email:</strong> {official?.email}</p>
          <p><strong>Departamento:</strong> {
            official?.department === 'technical' ? 'Suporte Técnico' :
            official?.department === 'billing' ? 'Faturamento' :
            official?.department === 'general' ? 'Atendimento Geral' :
            official?.department === 'sales' ? 'Vendas' : 'Outro'
          }</p>
        </div>
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={deleting}
          >
            {deleting ? "Excluindo..." : "Excluir Atendente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
