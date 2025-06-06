import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Copy, CheckCircle } from 'lucide-react';
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

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function AddUserDialog({ open, onOpenChange, onCreated }: AddUserDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: '',
    company_id: user?.company?.id || 0
  });
  
  // Buscar lista de empresas (apenas para admin)
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === 'admin', // Apenas buscar empresas se o usuário for admin
  });
  
  const [userCreated, setUserCreated] = useState(false);
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

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      role: value
    }));
  };

  const handleCompanyChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      company_id: parseInt(value)
    }));
  };

  const addUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/users', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      if (data.accessInfo) {
        // Mostrar as credenciais na interface
        setCredentials({
          username: data.accessInfo.username,
          password: data.accessInfo.temporaryPassword || data.accessInfo.password
        });
        setUserCreated(true);
        if (onCreated) onCreated();
      } else {
        // Fechar o diálogo se não houver credenciais
        handleCloseDialog();
        if (onCreated) onCreated();
        toast({
          title: 'Usuário adicionado com sucesso',
          description: 'Usuário cadastrado no sistema',
          variant: 'default',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar usuário',
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
        description: 'O nome do usuário é obrigatório',
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

    if (!formData.username.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome de usuário é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.password.trim() || formData.password.length < 6) {
      toast({
        title: 'Erro de validação',
        description: 'Senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.role) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um perfil',
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
    
    addUserMutation.mutate(formData);
  };
  
  // Limpar formulário e resetar estado quando o diálogo for fechado
  const handleCloseDialog = () => {
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: '',
      company_id: user?.company?.id || 0
    });
    setUserCreated(false);
    setCredentials({ username: '', password: '' });
    onOpenChange(false);
  };

  // Função para obter os roles disponíveis baseado no perfil do usuário logado
  const getAvailableRoles = () => {
    if (user?.role === 'admin') {
      return [
        { value: 'admin', label: 'Administrador Global' },
        { value: 'company_admin', label: 'Administrador da Empresa' },
        { value: 'manager', label: 'Gerente' },
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'support', label: 'Atendente' },
        { value: 'triage', label: 'Triagem' },
        { value: 'quality', label: 'Qualidade' },
        { value: 'viewer', label: 'Visualizador' },
        { value: 'customer', label: 'Cliente' },
        { value: 'integration_bot', label: 'Bot de Integração' }
      ];
    } else if (user?.role === 'company_admin') {
      return [
        { value: 'company_admin', label: 'Administrador da Empresa' },
        { value: 'manager', label: 'Gerente' },
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'support', label: 'Atendente' },
        { value: 'triage', label: 'Triagem' },
        { value: 'quality', label: 'Qualidade' },
        { value: 'viewer', label: 'Visualizador' },
        { value: 'customer', label: 'Cliente' }
      ];
    } else if (user?.role === 'manager') {
      return [
        { value: 'company_admin', label: 'Administrador da Empresa' },
        { value: 'manager', label: 'Gerente' },
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'support', label: 'Atendente' },
        { value: 'triage', label: 'Triagem' },
        { value: 'quality', label: 'Qualidade' },
        { value: 'viewer', label: 'Visualizador' },
        { value: 'customer', label: 'Cliente' }
      ];
    } else if (user?.role === 'supervisor') {
      return [
        { value: 'company_admin', label: 'Administrador da Empresa' },
        { value: 'manager', label: 'Gerente' },
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'support', label: 'Atendente' },
        { value: 'triage', label: 'Triagem' },
        { value: 'quality', label: 'Qualidade' },
        { value: 'viewer', label: 'Visualizador' },
        { value: 'customer', label: 'Cliente' }
      ];
    }
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[450px]">
        {!userCreated ? (
          // Formulário de adição
          <>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Adicione as informações do novo usuário ao sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Digite o nome completo do usuário"
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
                  placeholder="Digite o email do usuário"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário *</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Digite o nome de usuário"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Digite a senha (mín. 6 caracteres)"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Perfil *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil do usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Usuário'
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
                Usuário Adicionado
              </DialogTitle>
              <DialogDescription>
                O usuário foi adicionado com sucesso.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">Credenciais de Acesso:</p>
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
                  <strong>Senha:</strong> {credentials.password}
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
              <Button onClick={handleCloseDialog}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
} 