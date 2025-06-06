import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Key, Pencil, Loader2, Copy, AlertTriangle, 
  User, Check, X, UserCog, UserCheck, UserX, Shield, Save, Building2, Users, UserPlus
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

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup, EditButton, SaveButton, CancelButton } from '@/components/ui/standardized-button';

export default function UsersIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeStatusDialogOpen, setActiveStatusDialogOpen] = useState(false);
  
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

  // Handlers padronizados
  const handleCreateUser = () => {
    // Função para criar usuário - será implementada futuramente
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A criação de usuários será implementada em breve.",
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleFilterClick = () => {
    setIncludeInactive(!includeInactive);
  };



  const handleEdit = (userItem: any) => {
    setSelectedUser(userItem);
    setEditName(userItem.name);
    setEditEmail(userItem.email);
    setEditUsername(userItem.username);
    setEditRole(userItem.role);
    setEditDialogOpen(true);
  };

  const handleDelete = (userItem: any) => {
    setSelectedUser(userItem);
    setActiveStatusDialogOpen(true);
  };

  const handleResetPassword = (userItem: any) => {
    setSelectedUser(userItem);
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setResetPasswordDialogOpen(true);
  };

  // Carrega usuários com ou sem usuários inativos
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/users', includeInactive ? 'all' : 'active'],
    queryFn: async () => {
      const url = includeInactive ? '/api/users?includeInactive=true' : '/api/users';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      return res.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
  
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

  // Filtragem de usuários
  const filteredUsers = users && searchTerm 
    ? users.filter((user: any) => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : users;
    
  // Função para obter o texto de papel do usuário
  const getRoleText = (role: string) => {
    switch(role) {
      case 'admin': return 'Administrador';
      case 'support': return 'Suporte';
      case 'customer': return 'Cliente';
      case 'manager': return 'Gestor';
      case 'supervisor': return 'Supervisor';
      case 'viewer': return 'Visualizador';
      case 'company_admin': return 'Admin Empresa';
      case 'triage': return 'Triagem';
      case 'quality': return 'Qualidade';
      case 'integration_bot': return 'Bot Integração';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'admin': return Shield;
      case 'support': return UserCog;
      default: return User;
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

  // Estado vazio quando não há usuários
  if (filteredUsers && filteredUsers.length === 0 && !isLoading && !searchTerm) {
    return (
      <StandardPage
        icon={Users}
        title="Usuários"
        description="Gerencie os usuários do sistema, seus acessos e permissões"
        createButtonText="Adicionar Usuário"
        onCreateClick={handleCreateUser}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar usuários..."
      >
        <EmptyState
          icon={Users}
          title="Nenhum usuário encontrado"
          description="Não há usuários cadastrados no sistema. Clique no botão abaixo para adicionar o primeiro usuário."
          actionLabel="Adicionar Primeiro Usuário"
          onAction={handleCreateUser}
        />
      </StandardPage>
    );
  }

  return (
    <>
      <StandardPage
        icon={Users}
        title="Usuários"
        description="Gerencie os usuários do sistema, seus acessos e permissões"
        createButtonText="Adicionar Usuário"
        onCreateClick={handleCreateUser}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar usuários..."
        isLoading={isLoading}
      >
        {/* Filtro adicional para incluir inativos */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="includeInactive" 
              checked={includeInactive} 
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="includeInactive">Incluir usuários inativos</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredUsers ? `${filteredUsers.length} usuário(s) encontrado(s)` : ''}
          </div>
        </div>

        {filteredUsers && filteredUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum usuário encontrado"
            description={`Não foram encontrados usuários com o termo "${searchTerm}".`}
            actionLabel="Limpar busca"
            onAction={() => setSearchTerm('')}
          />
        ) : (
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
              ) : (
                filteredUsers?.map((userItem: any) => {
                  const RoleIcon = getRoleIcon(userItem.role);
                  return (
                    <TableRow key={userItem.id} className={!userItem.active ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{userItem.name}</TableCell>
                      <TableCell>{userItem.username}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {getRoleText(userItem.role)}
                        </Badge>
                      </TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {userItem.company?.name || 'Sistema Global'}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge isActive={userItem.active} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Botão customizado para redefinir senha */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleResetPassword(userItem)}
                            title="Redefinir senha"
                            className="h-8 w-8 p-0"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          
                          {/* Grupo de ações padronizado */}
                          <ActionButtonGroup
                            onEdit={() => handleEdit(userItem)}
                            onDelete={() => handleDelete(userItem)}
                            loading={toggleUserStatusMutation.isPending}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </StandardPage>

      {/* Dialog para editar usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário selecionado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-username">Nome de usuário</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="nome_usuario"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Perfil</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="flex gap-3">
            <CancelButton 
              onClick={() => setEditDialogOpen(false)}
              disabled={updateUserMutation.isPending}
            />
            <SaveButton 
              onClick={handleEditUserSubmit}
              loading={updateUserMutation.isPending}
              text="Atualizar"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para alternar status ativo/inativo */}
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
              <div className="flex items-center p-3 rounded-md border bg-muted/50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-primary" /> : 
                   selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-blue-600" /> : 
                   <User className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-xs text-muted-foreground">{getRoleText(selectedUser.role)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">
                  Esta ação pode ser revertida posteriormente.
                </span>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-3">
            <CancelButton 
              onClick={() => setActiveStatusDialogOpen(false)}
              disabled={toggleUserStatusMutation.isPending}
            />
            <Button
              variant={selectedUser && selectedUser.active ? "destructive" : "default"}
              onClick={handleToggleStatus}
              disabled={toggleUserStatusMutation.isPending}
              className="min-w-[100px]"
            >
              {toggleUserStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                selectedUser && selectedUser.active ? "Desativar" : "Ativar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para redefinir senha */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário selecionado.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center p-3 rounded-md border bg-muted/50">
                <User className="h-5 w-5 text-muted-foreground mr-3" />
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Digite a nova senha"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Confirme a nova senha"
                />
              </div>
              
              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-3">
            <CancelButton 
              onClick={() => setResetPasswordDialogOpen(false)}
              disabled={resetPasswordMutation.isPending}
            />
            <SaveButton 
              onClick={handleResetPasswordSubmit}
              loading={resetPasswordMutation.isPending}
              text="Redefinir Senha"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}