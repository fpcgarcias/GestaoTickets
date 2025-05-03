import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Key, Pencil, Loader2, Copy, AlertTriangle, 
  User, Check, X, UserCog, UserCheck, UserX, Shield, Save
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function UsersIndex() {
  const { toast } = useToast();
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
    setEditDialogOpen(true);
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
    if (!editName || !editEmail || !editUsername) {
      toast({
        title: "Dados incompletos",
        description: "Nome, nome de usuário e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    
    updateUserMutation.mutate({
      id: selectedUser.id,
      userData: {
        name: editName,
        email: editEmail,
        username: editUsername
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Usuários</h1>
      </div>

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
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id} className={!user.active ? "opacity-60" : ""}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {user.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : 
                           user.role === 'support' ? <UserCog className="h-3 w-3 mr-1" /> : 
                           <User className="h-3 w-3 mr-1" />}
                          {getRoleText(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.active ? "default" : "outline"}
                          className={user.active ? "bg-green-500 hover:bg-green-500/80" : "text-neutral-500"}
                        >
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditUser(user)}
                            title="Editar usuário"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleResetPassword(user)}
                            title="Redefinir senha"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant={user.active ? "destructive" : "default"} 
                            size="sm"
                            className={user.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            onClick={() => handleStatusChange(user)}
                            title={user.active ? "Desativar usuário" : "Ativar usuário"}
                          >
                            {user.active ? 
                              <UserX className="h-3.5 w-3.5" /> : 
                              <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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