// @ts-nocheck
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface Company {
  id: number;
  name: string;
  email: string;
  domain: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onSaved?: () => void;
}

export default function EditCompanyDialog({ open, onOpenChange, company, onSaved }: EditCompanyDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    domain: '',
    active: true
  });
  
  // Atualizar o formulário quando a empresa selecionada mudar
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        email: company.email,
        domain: company.domain || '',
        active: company.active
      });
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const editCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!company) throw new Error('Nenhuma empresa selecionada');
      const res = await apiRequest('PUT', `/api/companies/${company.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Empresa atualizada com sucesso',
        description: 'As informações da empresa foram atualizadas',
        variant: 'default',
      });
      handleCloseDialog();
      if (onSaved) onSaved();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar empresa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.name.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'O nome da empresa é obrigatório',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast({
        title: 'Erro de validação',
        description: 'Email inválido',
        variant: 'destructive',
      });
      return;
    }
    
    editCompanyMutation.mutate(formData);
  };
  
  // Resetar estado quando o diálogo for fechado
  const handleCloseDialog = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa selecionada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Digite o nome da empresa"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Digite o email de contato da empresa"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domínio</Label>
            <Input
              id="domain"
              name="domain"
              placeholder="Digite o domínio da empresa (ex: empresa.com.br)"
              value={formData.domain}
              onChange={handleChange}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button type="submit" disabled={editCompanyMutation.isPending}>
              {editCompanyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 