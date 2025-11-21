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
import { useI18n } from '@/i18n';
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
  const { formatMessage } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: '',
    company_id: user?.company?.id || 0,
    cpf: ''
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

  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'cpf' ? formatCPF(value) : value
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
        title: formatMessage('users.add_user_dialog.user_added_success_toast'),
        description: formatMessage('users.add_user_dialog.user_added_desc_toast'),
          variant: 'default',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('users.add_user_dialog.error_adding_user'),
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
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_name_required'),
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast({
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_email_invalid'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.username.trim()) {
      toast({
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_username_required'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.password.trim() || formData.password.length < 6) {
      toast({
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_password_min'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.role) {
      toast({
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_profile_required'),
        variant: 'destructive',
      });
      return;
    }
    
    // Validar que empresa foi selecionada
    if (!formData.company_id) {
      toast({
        title: formatMessage('users.add_user_dialog.validation_error'),
        description: formatMessage('users.add_user_dialog.validation_company_required'),
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
      company_id: user?.company?.id || 0,
      cpf: ''
    });
    setUserCreated(false);
    setCredentials({ username: '', password: '' });
    onOpenChange(false);
  };

  // Função para obter os roles disponíveis baseado no perfil do usuário logado
  const getAvailableRoles = () => {
    const roleOptions = [
      { value: 'admin', label: formatMessage('users.roles.admin') },
      { value: 'company_admin', label: formatMessage('users.roles.company_admin') },
      { value: 'manager', label: formatMessage('users.roles.manager') },
      { value: 'supervisor', label: formatMessage('users.roles.supervisor') },
      { value: 'support', label: formatMessage('users.roles.support') },
      { value: 'triage', label: formatMessage('users.roles.triage') },
      { value: 'quality', label: formatMessage('users.roles.quality') },
      { value: 'viewer', label: formatMessage('users.roles.viewer') },
      { value: 'customer', label: formatMessage('users.roles.customer') },
      { value: 'integration_bot', label: formatMessage('users.roles.integration_bot') }
    ];
    
    if (user?.role === 'admin') {
      return roleOptions;
    } else if (user?.role === 'company_admin') {
      return roleOptions.filter(role => !['admin', 'integration_bot'].includes(role.value));
    } else if (user?.role === 'manager') {
      return roleOptions.filter(role => !['admin', 'integration_bot'].includes(role.value));
    } else if (user?.role === 'supervisor') {
      return roleOptions.filter(role => !['admin', 'integration_bot'].includes(role.value));
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
              <DialogTitle>{formatMessage('users.add_user_dialog.title')}</DialogTitle>
              <DialogDescription>
                {formatMessage('users.add_user_dialog.description')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{formatMessage('users.add_user_dialog.name')} *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={formatMessage('users.add_user_dialog.name_placeholder')}
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{formatMessage('users.add_user_dialog.email')} *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={formatMessage('users.add_user_dialog.email_placeholder')}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{formatMessage('users.add_user_dialog.username')} *</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder={formatMessage('users.add_user_dialog.username_placeholder')}
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">{formatMessage('users.add_user_dialog.cpf')}</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  placeholder={formatMessage('users.add_user_dialog.cpf_placeholder')}
                  value={formData.cpf}
                  onChange={handleChange}
                  maxLength={14}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{formatMessage('users.add_user_dialog.password')} *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={formatMessage('users.add_user_dialog.password_placeholder')}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{formatMessage('users.add_user_dialog.profile')} *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('users.add_user_dialog.profile_placeholder')} />
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
                <Label htmlFor="company_id">{formatMessage('users.add_user_dialog.company')} *</Label>
                {user?.role === 'admin' ? (
                  // Admin pode selecionar qualquer empresa
                  <Select 
                    value={formData.company_id.toString()} 
                    onValueChange={handleCompanyChange}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('users.add_user_dialog.company_placeholder')} />
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
                  {formatMessage('users.add_user_dialog.cancel')}
                </Button>
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {formatMessage('users.add_user_dialog.saving')}
                    </>
                  ) : (
                    formatMessage('users.add_user_dialog.save_user')
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
                {formatMessage('users.add_user_dialog.user_added')}
              </DialogTitle>
              <DialogDescription>
                {formatMessage('users.add_user_dialog.user_added_success')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">{formatMessage('users.add_user_dialog.credentials_title')}</p>
                <p className="flex items-center gap-2">
                  <strong>{formatMessage('users.add_user_dialog.login')}</strong> {credentials.username}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.username);
                      toast({
                        title: formatMessage('users.add_user_dialog.login_copied'),
                        description: formatMessage('users.add_user_dialog.login_copied_desc'),
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
                  <strong>{formatMessage('users.add_user_dialog.password_label')}</strong> {credentials.password}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.password);
                      toast({
                        title: formatMessage('users.add_user_dialog.password_copied'),
                        description: formatMessage('users.add_user_dialog.password_copied_desc'),
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
                  {formatMessage('users.add_user_dialog.save_credentials_warning')}
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCloseDialog}>
                {formatMessage('users.add_user_dialog.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
} 