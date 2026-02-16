import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Key, Pencil, AlertTriangle, 
  User, UserCog, UserCheck, UserX, Shield, Save, Building2, UserPlus
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessHoursRefetchInterval } from '../../hooks/use-business-hours';
import AddUserDialog from './add-user-dialog';
import { useI18n } from '@/i18n';

// Função para traduzir códigos de erro de senha
const translatePasswordErrors = (errorCodes: string[], formatMessage: (id: string) => string): string[] => {
  return errorCodes.map(code => formatMessage(`password_validation.${code}`));
};

interface Company {
  id: number;
  name: string;
  email: string;
  domain?: string;
  active: boolean;
  cnpj?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export default function UsersIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeStatusDialogOpen, setActiveStatusDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Estados para alteração de senha
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  
  // Estados para edição de usuário
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCpf, setEditCpf] = useState('');

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(30000);

  // Abrir gerenciador de status
  const handleStatusChange = (user: any) => {
    setSelectedUser(user);
    setActiveStatusDialogOpen(true);
  };
  
  // Abrir gerenciador de senha
  const handleResetPassword = (user: any) => {
    setSelectedUser(user);
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setMustChangePassword(true);
    setResetPasswordDialogOpen(true);
  };
  
  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  // Abrir gerenciador de edição
  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditCpf(user.cpf || '');
    setEditDialogOpen(true);
  };

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Reset page when company filter changes
  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Carrega usuários com paginação
  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['/api/users', includeInactive ? 'all' : 'active', currentPage, searchTerm, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(includeInactive && { includeInactive: 'true' }),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCompanyId !== 'all' && user?.role === 'admin' && { company_id: selectedCompanyId }),
      });
      
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      return res.json();
    },
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
  });

  // Buscar empresas apenas para admin
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin',
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
  });

  const users = usersResponse?.data || [];
  const pagination = usersResponse?.pagination;
  
  // Ordenação já é feita no banco de dados
  
  // Mutação para ativar/desativar usuário
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}/toggle-active`, { active });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.active ? formatMessage('users.status_dialog.activated_success') : formatMessage('users.status_dialog.deactivated_success'),
        description: data.active 
          ? formatMessage('users.status_dialog.activated_desc')
          : formatMessage('users.status_dialog.deactivated_desc'),
      });
      setActiveStatusDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: formatMessage('users.status_dialog.error_title'),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para redefinir senha
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword, mustChangePassword }: { id: number; newPassword: string; mustChangePassword: boolean }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}`, { 
        password: newPassword,
        must_change_password: mustChangePassword
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('users.reset_password_dialog.success_title'),
        description: formatMessage('users.reset_password_dialog.success_desc'),
      });
      setResetPasswordDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      let errorMessage = error.details || error.message;
      
      // Se for erro de validação de senha, traduzir os códigos
      if (error.passwordErrors && Array.isArray(error.passwordErrors)) {
        const translatedErrors = translatePasswordErrors(error.passwordErrors, formatMessage);
        errorMessage = (
          <div className="space-y-1">
            {translatedErrors.map((error, index) => (
              <div key={index} className="flex items-start">
                <span className="text-red-400 mr-2">•</span>
                <span>{error}</span>
              </div>
            ))}
          </div>
        );
      }
      
      toast({
        title: formatMessage('users.reset_password_dialog.error_title'),
        description: errorMessage,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para editar usuário
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: any }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}`, userData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('users.edit_dialog.success_title'),
        description: formatMessage('users.edit_dialog.success_desc'),
      });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: formatMessage('users.edit_dialog.error_title'),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Lidar com envio do formulário de edição
  const handleEditUserSubmit = () => {
    if (!selectedUser) return;
    
    // Verificar se o email é válido
    if (!editEmail || !editEmail.includes('@')) {
      toast({
        title: formatMessage('users.edit_dialog.invalid_email'),
        description: formatMessage('users.edit_dialog.invalid_email_desc'),
        variant: "destructive",
      });
      return;
    }
    
    // Enviar a requisição para atualizar o usuário
    updateUserMutation.mutate({
      id: selectedUser.id,
      userData: {
        name: editName,
        email: editEmail,
        username: editUsername,
        role: editRole,
        cpf: editCpf || undefined
      }
    });
  };
  
  // Lidar com envio do formulário de redefinição de senha
  const handleResetPasswordSubmit = () => {
    // Verificar se as senhas correspondem
    if (password !== confirmPassword) {
      setPasswordError(formatMessage('users.reset_password_dialog.password_mismatch'));
      return;
    }
    
    // Verificar se a senha tem pelo menos 6 caracteres
    if (password.length < 6) {
      setPasswordError(formatMessage('users.reset_password_dialog.password_min_length'));
      return;
    }
    
    // Submeter a redefinição de senha
    resetPasswordMutation.mutate({
      id: selectedUser.id,
      newPassword: password,
      mustChangePassword: mustChangePassword
    });
  };

  // Função para obter o texto de papel do usuário
  const getRoleText = (role: string) => {
    return formatMessage(`users.roles.${role}` as any) || role;
  };
  
  // Função para alternar o status ativo/inativo
  const handleToggleStatus = () => {
    if (selectedUser) {
      toggleUserStatusMutation.mutate({
        id: selectedUser.id,
        active: !selectedUser.active
      });
    }
  };

  // Função para obter o nome da empresa
  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return formatMessage('users.global_system');
    const company = companies.find(c => c.id === companyId);
    return company?.name || formatMessage('users.company_not_found');
  };

  // Função para obter os roles disponíveis baseado no perfil do usuário logado (para edição)
  const getAvailableRolesForEdit = () => {
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('users.title')}</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          {formatMessage('users.add_user')}
        </Button>
      </div>
      
      <AddUserDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={() => {
          // Atualizar a lista de usuários automaticamente
          queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('users.management_title')}</CardTitle>
          <CardDescription>{formatMessage('users.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder={formatMessage('users.search_placeholder')} 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              
              {/* Filtro por empresa - apenas para admin */}
              {user?.role === 'admin' && (
                <div className="w-64">
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('users.filter_by_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('users.all_companies')}</SelectItem>
                      {isLoadingCompanies ? (
                        <SelectItem value="loading" disabled>{formatMessage('users.loading_companies')}</SelectItem>
                      ) : (
                        companies
                          .filter(company => company.active) // Mostrar apenas empresas ativas
                          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                          .map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="includeInactive" 
                  checked={includeInactive} 
                  onCheckedChange={setIncludeInactive}
                />
                <Label htmlFor="includeInactive">{formatMessage('users.include_inactive')}</Label>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{formatMessage('users.name')}</TableHead>
                  <TableHead>{formatMessage('users.email')}</TableHead>
                  <TableHead>{formatMessage('users.profile')}</TableHead>
                  {user?.role === 'admin' && <TableHead>{formatMessage('users.company')}</TableHead>}
                  <TableHead>{formatMessage('users.status')}</TableHead>
                  <TableHead className="text-right">{formatMessage('users.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length > 0 ? (
                  users.map((userItem: any) => (
                    <TableRow key={userItem.id} className={!userItem.active ? "opacity-60" : ""}>
                      <TableCell>{userItem.name}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {userItem.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : 
                           userItem.role === 'support' ? <UserCog className="h-3 w-3 mr-1" /> : 
                           <User className="h-3 w-3 mr-1" />}
                          {getRoleText(userItem.role)}
                        </Badge>
                      </TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-neutral-500" />
                            <span className="text-sm text-neutral-600">
                              {getCompanyName(userItem.company_id)}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {(userItem.active === undefined || userItem.active) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {formatMessage('users.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {formatMessage('users.inactive')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditUser(userItem)}
                            title={formatMessage('users.edit_user')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleResetPassword(userItem)}
                            title={formatMessage('users.reset_password')}
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant={userItem.active ? "destructive" : "default"} 
                            size="sm"
                            className={userItem.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            onClick={() => handleStatusChange(userItem)}
                            title={userItem.active ? formatMessage('users.deactivate_user') : formatMessage('users.activate_user')}
                          >
                            {userItem.active ? 
                              <UserX className="h-3.5 w-3.5" /> : 
                              <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                      {searchTerm || selectedCompanyId !== 'all' 
                        ? formatMessage('users.no_users_filtered')
                        : formatMessage('users.no_users_found')
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                {formatMessage('users.showing_results', {
                  start: ((pagination.page - 1) * pagination.limit) + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })}
                {selectedCompanyId !== 'all' && user?.role === 'admin' && (
                  <span className="ml-2 text-neutral-500">
                    {formatMessage('users.filtered_by', { company: getCompanyName(parseInt(selectedCompanyId)) })}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!pagination.hasPrev}
                  onClick={() => pagination.hasPrev && setCurrentPage(pagination.page - 1)}
                >
                  {formatMessage('users.previous')}
                </Button>
                
                {/* Páginas numeradas */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={pagination.page === pageNum ? "bg-primary text-white hover:bg-primary/90" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!pagination.hasNext}
                  onClick={() => pagination.hasNext && setCurrentPage(pagination.page + 1)}
                >
                  {formatMessage('users.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Diálogo para alternar status ativo/inativo */}
      <Dialog open={activeStatusDialogOpen} onOpenChange={setActiveStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser && selectedUser.active ? formatMessage('users.status_dialog.deactivate_title') : formatMessage('users.status_dialog.activate_title')}
            </DialogTitle>
            <DialogDescription>
              {selectedUser && selectedUser.active ? 
                formatMessage('users.status_dialog.deactivate_description') :
                formatMessage('users.status_dialog.activate_description')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600" /> : 
                   selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600" /> : 
                   <User className="h-5 w-5 text-neutral-600" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <p className="text-sm text-neutral-600 mb-6">
                {selectedUser.active ? 
                  formatMessage('users.status_dialog.deactivate_warning') :
                  formatMessage('users.status_dialog.activate_warning')}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveStatusDialogOpen(false)}>{formatMessage('users.status_dialog.cancel')}</Button>
            <Button 
              onClick={handleToggleStatus}
              variant={selectedUser && selectedUser.active ? "destructive" : "default"}
              className={selectedUser && selectedUser.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
            >
              {selectedUser && selectedUser.active ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  {formatMessage('users.status_dialog.deactivate')}
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  {formatMessage('users.status_dialog.activate')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para redefinir senha */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage('users.reset_password_dialog.title')}</DialogTitle>
            <DialogDescription>
              {formatMessage('users.reset_password_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600" /> : 
                   selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600" /> : 
                   <User className="h-5 w-5 text-neutral-600" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">{formatMessage('users.reset_password_dialog.new_password')}</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={formatMessage('users.reset_password_dialog.new_password_placeholder')}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">{formatMessage('users.reset_password_dialog.confirm_password')}</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={formatMessage('users.reset_password_dialog.confirm_password_placeholder')}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="must_change_password"
                    checked={mustChangePassword}
                    onCheckedChange={(checked: boolean | 'indeterminate') => 
                      setMustChangePassword(checked === true)
                    }
                  />
                  <Label htmlFor="must_change_password" className="text-sm">
                    {formatMessage('users.reset_password_dialog.force_password_change')}
                  </Label>
                </div>
                
                {passwordError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                    {passwordError}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>{formatMessage('users.reset_password_dialog.cancel')}</Button>
            <Button onClick={handleResetPasswordSubmit}>
              <Key className="h-4 w-4 mr-2" />
              {formatMessage('users.reset_password_dialog.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para editar usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage('users.edit_dialog.title')}</DialogTitle>
            <DialogDescription>
              {formatMessage('users.edit_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600" /> : 
                   selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600" /> : 
                   <User className="h-5 w-5 text-neutral-600" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="editName">{formatMessage('users.edit_dialog.name')}</Label>
                  <Input 
                    id="editName" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={formatMessage('users.edit_dialog.name_placeholder')}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editEmail">{formatMessage('users.edit_dialog.email')}</Label>
                  <Input 
                    id="editEmail" 
                    type="email" 
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder={formatMessage('users.edit_dialog.email_placeholder')}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editUsername">{formatMessage('users.edit_dialog.username')}</Label>
                  <Input 
                    id="editUsername" 
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder={formatMessage('users.edit_dialog.username_placeholder')}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editCpf">{formatMessage('users.edit_dialog.cpf')}</Label>
                  <Input 
                    id="editCpf" 
                    value={editCpf}
                    onChange={(e) => setEditCpf(formatCPF(e.target.value))}
                    placeholder={formatMessage('users.edit_dialog.cpf_placeholder')}
                    maxLength={14}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editRole">{formatMessage('users.edit_dialog.profile')}</Label>
                  <Select 
                    value={editRole} 
                    onValueChange={setEditRole}
                  >
                    <SelectTrigger id="editRole">
                      <SelectValue placeholder={formatMessage('users.edit_dialog.profile_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRolesForEdit().map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{formatMessage('users.edit_dialog.cancel')}</Button>
            <Button onClick={handleEditUserSubmit}>
              <Save className="h-4 w-4 mr-2" />
              {formatMessage('users.edit_dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}