import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { Customer } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: number;
  name: string;
}

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Customer | null;
  onSaved?: () => void;
}

export default function EditClientDialog({ open, onOpenChange, client, onSaved }: EditClientDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    company_id: 0,
    password: '',
    confirmPassword: '',
    must_change_password: false
  });

  // Buscar lista de empresas (apenas para admin)
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === 'admin', // Apenas buscar empresas se o usuário for admin
  });

  // Atualizar o formulário quando o cliente selecionado mudar
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        company_id: client.company_id || (user?.company?.id || 0),
        password: '',
        confirmPassword: '',
        must_change_password: false
      });
    }
  }, [client, user]);

  // Garantir que a company_id seja sempre definida para usuários não-admin
  useEffect(() => {
    if (user && user.role !== 'admin' && user.company?.id) {
      setFormData(prev => ({
        ...prev,
        company_id: user.company?.id ?? 0
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCompanyChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      company_id: parseInt(value)
    }));
  };

  const updateClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!client) throw new Error('Cliente não selecionado');
      
      // Remover campos de senha se estiverem vazios
      const dataToSend: any = {...data};
      
      if (!data.password) {
        delete dataToSend.password;
        delete dataToSend.confirmPassword;
      }
      
      // Remover campo company se estamos usando company_id
      if (dataToSend.company_id) {
        delete dataToSend.company;
      }
      
      const res = await apiRequest('PATCH', `/api/customers/${client.id}`, dataToSend);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      onOpenChange(false);
      if (onSaved) onSaved();
      toast({
        title: 'Cliente atualizado',
        description: 'As informações do cliente foram atualizadas com sucesso.',
        variant: 'default',
      });
      
      // Limpar campos de senha
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar cliente',
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
        description: 'O nome do cliente é obrigatório',
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

    // Validar que empresa foi selecionada
    if (!formData.company_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma empresa',
        variant: 'destructive',
      });
      return;
    }
    
    // Verificar se senhas coincidem caso tenham sido preenchidas
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: 'Erro de validação',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }
    
    // Verificar comprimento mínimo da senha caso tenha sido preenchida
    if (formData.password && formData.password.length < 6) {
      toast({
        title: 'Erro de validação',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }
    
    updateClientMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente selecionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cliente *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Digite o nome do cliente"
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
              placeholder="Digite o email do cliente"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              placeholder="Digite o telefone do cliente"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_id">Empresa *</Label>
            {user?.role === 'admin' ? (
              // Admin pode selecionar qualquer empresa
              <Select 
                value={formData.company_id.toString()} 
                onValueChange={handleCompanyChange}
                disabled={isLoadingCompanies}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map(company => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // Usuários não-admin veem apenas sua própria empresa
              <Input
                value={user?.company?.name || ""}
                disabled
                className="bg-gray-100"
              />
            )}
          </div>
          
          <div className="pt-4">
            <h4 className="text-sm font-medium mb-2">Alterar Senha (opcional)</h4>
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Digite a nova senha"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2 mt-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirme a nova senha"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
            {(formData.password || formData.confirmPassword) && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="must_change_password"
                  checked={formData.must_change_password}
                  onCheckedChange={(checked: boolean | 'indeterminate') => 
                    setFormData(prev => ({ 
                      ...prev, 
                      must_change_password: checked === true 
                    }))
                  }
                />
                <Label htmlFor="must_change_password" className="text-sm">
                  Forçar alteração de senha no próximo login
                </Label>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? (
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
