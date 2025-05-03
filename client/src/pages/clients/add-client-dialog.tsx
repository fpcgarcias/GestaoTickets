import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Copy, CheckCircle } from 'lucide-react';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function AddClientDialog({ open, onOpenChange, onCreated }: AddClientDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });
  
  const [clientCreated, setClientCreated] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/customers', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      if (data.accessInfo) {
        // Mostrar as credenciais na interface
        setCredentials({
          username: data.accessInfo.username,
          password: data.accessInfo.temporaryPassword
        });
        setClientCreated(true);
        if (onCreated) onCreated();
      } else {
        // Fechar o diálogo se não houver credenciais
        handleCloseDialog();
        if (onCreated) onCreated();
        toast({
          title: 'Cliente adicionado com sucesso',
          description: 'Cliente cadastrado no sistema',
          variant: 'default',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar cliente',
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
    
    addClientMutation.mutate(formData);
  };
  
  // Limpar formulário e resetar estado quando o diálogo for fechado
  const handleCloseDialog = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: ''
    });
    setClientCreated(false);
    setCredentials({ username: '', password: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[450px]">
        {!clientCreated ? (
          // Formulário de adição
          <>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Adicione as informações do novo cliente ao sistema.
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
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Digite o nome da empresa"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addClientMutation.isPending}>
                  {addClientMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Cliente'
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          // Tela de sucesso com credenciais
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <CheckCircle className="mr-2 h-6 w-6 text-green-600" />
                Cliente Adicionado
              </DialogTitle>
              <DialogDescription>
                O cliente foi adicionado com sucesso.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">Credenciais Geradas:</p>
                <p className="flex items-center gap-2">
                  <strong>Login:</strong> {credentials.username}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.username);
                      toast({
                        title: "Login copiado",
                        description: "O login foi copiado para a área de transferência.",
                        duration: 3000,
                      });
                    }}
                    className="h-6 w-6"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </p>
                <p className="flex items-center gap-2">
                  <strong>Senha temporária:</strong> {credentials.password}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.password);
                      toast({
                        title: "Senha copiada",
                        description: "A senha foi copiada para a área de transferência.",
                        duration: 3000,
                      });
                    }}
                    className="h-6 w-6"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                <p className="text-amber-800 text-sm">
                  Anote estas credenciais! Elas não poderão ser recuperadas depois que esta janela for fechada.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCloseDialog}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
