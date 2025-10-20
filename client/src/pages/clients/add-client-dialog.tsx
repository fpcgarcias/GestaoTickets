import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Copy, CheckCircle, AlertTriangle, UserPlus, Link } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

interface ExistingUser {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function AddClientDialog({ open, onOpenChange, onCreated }: AddClientDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    company_id: user?.company_id || user?.company?.id || 0, // Usar company_id do usuário logado
    must_change_password: true
  });
  
  // Buscar lista de empresas (apenas para admin)
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === 'admin', // Apenas buscar empresas se o usuário for admin
  });
  
  const [clientCreated, setClientCreated] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showLinkOption, setShowLinkOption] = useState(false);
  const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);
  const [linkingUser, setLinkingUser] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Definir company_id quando o usuário for carregado
  useEffect(() => {
    // Só executar se o usuário estiver carregado
    if (!user) {
      return;
    }
    
    // Usar company_id do user (que vem do backend) ou company.id
    const userCompanyId = user?.company_id || user?.company?.id;
    
    if (userCompanyId && formData.company_id === 0) {
      setFormData(prev => ({
        ...prev,
        company_id: userCompanyId
      }));
    } else if (userCompanyId && formData.company_id !== userCompanyId) {
      setFormData(prev => ({
        ...prev,
        company_id: userCompanyId
      }));
    }
  }, [user, formData.company_id]);

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

  const addClientMutation = useMutation({
    mutationFn: async (data: typeof formData & { linkExistingUser?: boolean }) => {
      // Remover campo company se estamos usando company_id
      const dataToSend: any = {...data};
      if (dataToSend.company_id) {
        delete dataToSend.company;
      }
      
      const res = await apiRequest('POST', '/api/customers', dataToSend);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      
      if (linkingUser) {
        // Mensagem diferente para vinculação
        toast({
          title: formatMessage('clients.add_client_dialog.client_linked_success_toast'),
          description: formatMessage('clients.add_client_dialog.client_linked_desc_toast'),
          variant: "default",
        });
        handleCloseDialog();
        if (onCreated) onCreated();
      } else if (data.accessInfo) {
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
          title: formatMessage('clients.add_client_dialog.client_added_success_toast'),
          description: formatMessage('clients.add_client_dialog.client_added_desc_toast'),
          variant: 'default',
        });
      }
    },
    onError: (error: any) => {
      // Verificar se é um erro de usuário existente
      if ((error.message === "Usuário já existe" && error.suggestion === "link_existing") || 
          (error.status === 409 && error.existingUser) ||
          (error.message && error.message.includes("já existe") && error.existingUser)) {
        setExistingUser(error.existingUser);
        setShowLinkOption(true);
        
        // Mostrar o diálogo de confirmação diretamente
        setShowConfirmDialog(true);
        return;
      }
      
      toast({
        title: formatMessage('clients.add_client_dialog.error_adding_client'),
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
        title: formatMessage('common.error'),
        description: formatMessage('clients.add_client_dialog.validation_name_required'),
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast({
        title: formatMessage('common.error'),
        description: formatMessage('clients.add_client_dialog.validation_email_invalid'),
        variant: 'destructive',
      });
      return;
    }
    
    // Validar que empresa foi selecionada
    if (!formData.company_id) {
      toast({
        title: formatMessage('common.error'),
        description: formatMessage('clients.add_client_dialog.validation_company_required'),
        variant: 'destructive',
      });
      return;
    }
    
    addClientMutation.mutate({
      ...formData,
      linkExistingUser: linkingUser
    });
  };

  const handleLinkExistingUser = () => {
    if (existingUser) {
      // Mostrar diálogo de confirmação
      setShowConfirmDialog(true);
    }
  };

  const confirmLinkUser = () => {
    if (existingUser) {
      // Preencher o formulário com dados do usuário existente
      setFormData(prev => ({
        ...prev,
        name: existingUser.name,
        email: existingUser.email,
      }));
      setLinkingUser(true);
      setShowLinkOption(false);
      setShowConfirmDialog(false);
    }
  };

  const handleCreateNewUser = () => {
    // Limpar o formulário e continuar com a criação normal
    setShowLinkOption(false);
    setExistingUser(null);
    setLinkingUser(false);
    setShowConfirmDialog(false);
    setFormData(prev => ({
      ...prev,
      email: '',
      name: '',
    }));
  };
  
  // Limpar formulário e resetar estado quando o diálogo for fechado
  const handleCloseDialog = () => {
    const userCompanyId = user?.company_id || user?.company?.id;
    
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      company_id: userCompanyId || 0,
      must_change_password: true
    });
    setClientCreated(false);
    setCredentials({ username: '', password: '' });
    setShowLinkOption(false);
    setExistingUser(null);
    setLinkingUser(false);
    setShowConfirmDialog(false);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[450px]">
        {!clientCreated ? (
          // Formulário de adição
          <>
            <DialogHeader>
              <DialogTitle>
                {linkingUser ? formatMessage('clients.add_client_dialog.link_user_title') : formatMessage('clients.add_client_dialog.title')}
              </DialogTitle>
              <DialogDescription>
                {linkingUser 
                  ? formatMessage('clients.add_client_dialog.link_user_description')
                  : formatMessage('clients.add_client_dialog.description')
                }
              </DialogDescription>
            </DialogHeader>

            {/* Alerta de usuário existente */}
            {showLinkOption && existingUser && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p>{formatMessage('clients.add_client_dialog.existing_user_alert')}</p>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>{formatMessage('clients.name')}:</strong> {existingUser.name}</p>
                      <p><strong>{formatMessage('clients.email')}:</strong> {existingUser.email}</p>
                      <p><strong>Username:</strong> {existingUser.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleLinkExistingUser}
                        className="flex items-center gap-1"
                      >
                        <Link className="h-3 w-3" />
                        {formatMessage('clients.add_client_dialog.link_as_client')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleCreateNewUser}
                      >
                        {formatMessage('clients.add_client_dialog.use_different_email')}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Alerta de vinculação ativa */}
            {linkingUser && existingUser && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <UserPlus className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="space-y-2">
                    <p className="font-semibold">{formatMessage('clients.add_client_dialog.linking_user_alert')}</p>
                    <div className="bg-white p-2 rounded border border-green-200">
                      <p><strong>{existingUser.name}</strong></p>
                      <p className="text-sm text-gray-600">{existingUser.email}</p>
                    </div>
                    <p className="text-sm">
                      {formatMessage('clients.add_client_dialog.linking_user_description')}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{formatMessage('clients.add_client_dialog.client_name')} *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={formatMessage('clients.add_client_dialog.client_name_placeholder')}
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{formatMessage('clients.email')} *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={formatMessage('clients.add_client_dialog.email_placeholder')}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{formatMessage('clients.phone')}</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder={formatMessage('clients.add_client_dialog.phone_placeholder')}
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_id">{formatMessage('clients.company')} *</Label>
                {user?.role === 'admin' ? (
                  // Admin pode selecionar qualquer empresa
                  <Select 
                    value={formData.company_id.toString()} 
                    onValueChange={handleCompanyChange}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('clients.add_client_dialog.company_placeholder')} />
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
              <div className="flex items-center space-x-2">
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
                  {formatMessage('clients.add_client_dialog.force_password_change')}
                </Label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  {formatMessage('clients.add_client_dialog.cancel')}
                </Button>
                <Button type="submit" disabled={addClientMutation.isPending}>
                  {addClientMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {linkingUser ? formatMessage('clients.add_client_dialog.linking') : formatMessage('clients.add_client_dialog.saving')}
                    </>
                  ) : (
                    linkingUser ? formatMessage('clients.add_client_dialog.link_client') : formatMessage('clients.add_client_dialog.save_client')
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
                {linkingUser ? formatMessage('clients.add_client_dialog.client_linked') : formatMessage('clients.add_client_dialog.client_added')}
              </DialogTitle>
              <DialogDescription>
                {linkingUser 
                  ? formatMessage('clients.add_client_dialog.client_linked_success')
                  : formatMessage('clients.add_client_dialog.client_added_success')
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">{formatMessage('clients.add_client_dialog.generated_credentials')}</p>
                <p className="flex items-center gap-2">
                  <strong>{formatMessage('clients.add_client_dialog.login')}</strong> {credentials.username}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.username);
                      toast({
                        title: formatMessage('clients.add_client_dialog.login_copied'),
                        description: formatMessage('clients.add_client_dialog.login_copied_desc'),
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
                  <strong>{formatMessage('clients.add_client_dialog.temp_password')}</strong> {credentials.password}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.password);
                      toast({
                        title: formatMessage('clients.add_client_dialog.password_copied'),
                        description: formatMessage('clients.add_client_dialog.password_copied_desc'),
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
                  {formatMessage('clients.add_client_dialog.save_credentials_warning')}
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCloseDialog}>
                {formatMessage('clients.add_client_dialog.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Diálogo de confirmação para vincular usuário existente */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{formatMessage('clients.add_client_dialog.link_existing_user_title')}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-3">
              <p>{formatMessage('clients.add_client_dialog.link_existing_user_desc')}</p>
              {existingUser && (
                <div className="bg-gray-50 p-3 rounded-md border">
                  <p className="font-semibold">{existingUser.name}</p>
                  <p className="text-sm text-gray-600">{existingUser.email}</p>
                  <p className="text-sm text-gray-500">Username: {existingUser.username}</p>
                </div>
              )}
              <p className="text-sm">
                {formatMessage('clients.add_client_dialog.link_existing_user_confirm')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
            {formatMessage('clients.add_client_dialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmLinkUser}>
            {formatMessage('clients.add_client_dialog.yes_link_client')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
