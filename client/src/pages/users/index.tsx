import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Key, Pencil, Loader2, Copy, AlertTriangle, 
  User, Check, X, UserCog, UserCheck, UserX, Shield, Save, Building2, UserPlus
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
import AddUserDialog from './add-user-dialog';

export default function UsersIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeStatusDialogOpen, setActiveStatusDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Estados para alteração de senha
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Estados para edição de usuário
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('');

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
    setResetPasswordDialogOpen(true);
  };
  
  // Abrir gerenciador de edição
  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditDialogOpen(true);
  };

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Carrega usuários com paginação
  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['/api/users', includeInactive ? 'all' : 'active', currentPage, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(includeInactive && { includeInactive: 'true' }),
        ...(searchTerm && { search: searchTerm }),
      });
      
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      return res.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const users = usersResponse?.data || [];
  const pagination = usersResponse?.pagination;
  
  // Mutação para ativar/desativar usuário
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}/toggle-active`, { active });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.active ? "Usuário ativado" : "Usuário desativado",
        description: data.active 
          ? "O usuário foi ativado com sucesso."
          : "O usuário foi desativado com sucesso.",
      });
      setActiveStatusDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao alterar status do usuário",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para redefinir senha
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}`, { password: newPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha redefinida",
        description: "A senha do usuário foi redefinida com sucesso.",
      });
      setResetPasswordDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao redefinir senha",
        description: `Ocorreu um erro: ${error.message}`,
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
        title: "Usuário atualizado",
        description: "Os dados do usuário foram atualizados com sucesso.",
      });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: `Ocorreu um erro: ${error.message}`,
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
        title: "Email inválido",
        description: "Por favor, forneça um email válido.",
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
        role: editRole
      }
    });
  };
  
  // Lidar com envio do formulário de redefinição de senha
  const handleResetPasswordSubmit = () => {
    // Verificar se as senhas correspondem
    if (password !== confirmPassword) {
      setPasswordError('As senhas não correspondem');
      return;
    }
    
    // Verificar se a senha tem pelo menos 6 caracteres
    if (password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    // Submeter a redefinição de senha
    resetPasswordMutation.mutate({
      id: selectedUser.id,
      newPassword: password
    });
  };

  // Não precisamos mais filtrar no frontend, pois a busca é feita no backend
    
  // Função para obter o texto de papel do usuário
  const getRoleText = (role: string) => {
    switch(role) {
      case 'admin': return 'Administrador Global';
      case 'company_admin': return 'Administrador da Empresa';
      case 'manager': return 'Gerente';
      case 'supervisor': return 'Supervisor';
      case 'support': return 'Atendente';
      case 'triage': return 'Triagem';
      case 'quality': return 'Qualidade';
      case 'viewer': return 'Visualizador';
      case 'customer': return 'Cliente';
      case 'integration_bot': return 'Bot de Integração';
      default: return role;
    }
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

  // Função para obter os roles disponíveis baseado no perfil do usuário logado (para edição)
  const getAvailableRolesForEdit = () => {
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Usuários</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Usuário
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
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>Gerencie usuários do sistema, seus acessos e permissões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Buscar usuários" 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="includeInactive" 
                  checked={includeInactive} 
                  onCheckedChange={setIncludeInactive}
                />
                <Label htmlFor="includeInactive">Incluir inativos</Label>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nome de usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users && users.length > 0 ? (
                  users.map((userItem: any) => (
                    <TableRow key={userItem.id} className={!userItem.active ? "opacity-60" : ""}>
                      <TableCell>{userItem.name}</TableCell>
                      <TableCell>{userItem.username}</TableCell>
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
                              {userItem.company?.name || 'Sistema Global'}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {(userItem.active === undefined || userItem.active) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inativo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditUser(userItem)}
                            title="Editar usuário"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleResetPassword(userItem)}
                            title="Redefinir senha"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant={userItem.active ? "destructive" : "default"} 
                            size="sm"
                            className={userItem.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            onClick={() => handleStatusChange(userItem)}
                            title={userItem.active ? "Desativar usuário" : "Ativar usuário"}
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
                    <TableCell colSpan={user?.role === 'admin' ? 7 : 6} className="text-center py-10 text-neutral-500">
                      Nenhum usuário encontrado.
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
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} usuários
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!pagination.hasPrev}
                  onClick={() => pagination.hasPrev && setCurrentPage(pagination.page - 1)}
                >
                  Anterior
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
                  Próxima
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
              {selectedUser && selectedUser.active ? "Desativar usuário" : "Ativar usuário"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser && selectedUser.active ? 
                "Ao desativar um usuário, ele não poderá mais acessar o sistema, mas seus dados serão mantidos para fins de histórico." :
                "Ao ativar um usuário, ele voltará a ter acesso ao sistema com suas mesmas permissões anteriores."}
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
                  "Esta ação não exclui o usuário permanentemente. Os dados serão mantidos para histórico e poderá ser reativado a qualquer momento." :
                  "Ao ativar o usuário, ele poderá realizar login novamente no sistema."}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveStatusDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleToggleStatus}
              variant={selectedUser && selectedUser.active ? "destructive" : "default"}
              className={selectedUser && selectedUser.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
            >
              {selectedUser && selectedUser.active ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Desativar
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Ativar
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
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário selecionado.
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
                  <Label htmlFor="password">Nova senha</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                  />
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
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPasswordSubmit}>
              <Key className="h-4 w-4 mr-2" />
              Redefinir senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para editar usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite as informações do usuário selecionado.
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
                  <Label htmlFor="editName">Nome</Label>
                  <Input 
                    id="editName" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input 
                    id="editEmail" 
                    type="email" 
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editUsername">Nome de usuário</Label>
                  <Input 
                    id="editUsername" 
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Nome de usuário"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editRole">Perfil do Usuário</Label>
                  <Select 
                    value={editRole} 
                    onValueChange={setEditRole}
                  >
                    <SelectTrigger id="editRole">
                      <SelectValue placeholder="Selecione o perfil" />
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditUserSubmit}>
              <Save className="h-4 w-4 mr-2" />
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}