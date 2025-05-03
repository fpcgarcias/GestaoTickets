var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Key, Pencil, AlertTriangle, User, UserCog, UserCheck, UserX, Shield, Save } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
export default function UsersIndex() {
    var _this = this;
    var toast = useToast().toast;
    var _a = useState(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = useState(false), includeInactive = _b[0], setIncludeInactive = _b[1];
    var _c = useState(null), selectedUser = _c[0], setSelectedUser = _c[1];
    var _d = useState(false), activeStatusDialogOpen = _d[0], setActiveStatusDialogOpen = _d[1];
    // Estados para alteração de senha
    var _e = useState(false), resetPasswordDialogOpen = _e[0], setResetPasswordDialogOpen = _e[1];
    var _f = useState(''), password = _f[0], setPassword = _f[1];
    var _g = useState(''), confirmPassword = _g[0], setConfirmPassword = _g[1];
    var _h = useState(''), passwordError = _h[0], setPasswordError = _h[1];
    // Estados para edição de usuário
    var _j = useState(false), editDialogOpen = _j[0], setEditDialogOpen = _j[1];
    var _k = useState(''), editName = _k[0], setEditName = _k[1];
    var _l = useState(''), editEmail = _l[0], setEditEmail = _l[1];
    var _m = useState(''), editUsername = _m[0], setEditUsername = _m[1];
    // Abrir gerenciador de status
    var handleStatusChange = function (user) {
        setSelectedUser(user);
        setActiveStatusDialogOpen(true);
    };
    // Abrir gerenciador de senha
    var handleResetPassword = function (user) {
        setSelectedUser(user);
        setPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setResetPasswordDialogOpen(true);
    };
    // Abrir gerenciador de edição
    var handleEditUser = function (user) {
        setSelectedUser(user);
        setEditName(user.name);
        setEditEmail(user.email);
        setEditUsername(user.username);
        setEditDialogOpen(true);
    };
    // Carrega usuários com ou sem usuários inativos
    var _o = useQuery({
        queryKey: ['/api/users', includeInactive ? 'all' : 'active'],
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () {
            var url, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = includeInactive ? '/api/users?includeInactive=true' : '/api/users';
                        return [4 /*yield*/, fetch(url)];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error('Erro ao carregar usuários');
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        refetchInterval: 30000, // Atualiza a cada 30 segundos
    }), users = _o.data, isLoading = _o.isLoading;
    // Mutação para ativar/desativar usuário
    var toggleUserStatusMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var res;
            var id = _b.id, active = _b.active;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, apiRequest('PATCH', "/api/users/".concat(id, "/toggle-active"), { active: active })];
                    case 1:
                        res = _c.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            toast({
                title: data.active ? "Usuário ativado" : "Usuário desativado",
                description: data.active
                    ? "O usuário foi ativado com sucesso."
                    : "O usuário foi desativado com sucesso.",
            });
            setActiveStatusDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
        onError: function (error) {
            toast({
                title: "Erro ao alterar status do usuário",
                description: "Ocorreu um erro: ".concat(error.message),
                variant: "destructive",
            });
        }
    });
    // Mutação para redefinir senha
    var resetPasswordMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var res;
            var id = _b.id, newPassword = _b.newPassword;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, apiRequest('PATCH', "/api/users/".concat(id), { password: newPassword })];
                    case 1:
                        res = _c.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function () {
            toast({
                title: "Senha redefinida",
                description: "A senha do usuário foi redefinida com sucesso.",
            });
            setResetPasswordDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
        onError: function (error) {
            toast({
                title: "Erro ao redefinir senha",
                description: "Ocorreu um erro: ".concat(error.message),
                variant: "destructive",
            });
        }
    });
    // Mutação para editar usuário
    var updateUserMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var res;
            var id = _b.id, userData = _b.userData;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, apiRequest('PATCH', "/api/users/".concat(id), userData)];
                    case 1:
                        res = _c.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function () {
            toast({
                title: "Usuário atualizado",
                description: "Os dados do usuário foram atualizados com sucesso.",
            });
            setEditDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
        onError: function (error) {
            toast({
                title: "Erro ao atualizar usuário",
                description: "Ocorreu um erro: ".concat(error.message),
                variant: "destructive",
            });
        }
    });
    // Lidar com envio do formulário de edição
    var handleEditUserSubmit = function () {
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
    var handleResetPasswordSubmit = function () {
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
    var filteredUsers = users && searchTerm
        ? users.filter(function (user) {
            return user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username.toLowerCase().includes(searchTerm.toLowerCase());
        })
        : users;
    // Função para obter o texto de papel do usuário
    var getRoleText = function (role) {
        switch (role) {
            case 'admin': return 'Administrador';
            case 'support': return 'Suporte';
            case 'customer': return 'Cliente';
            default: return role;
        }
    };
    // Função para alternar o status ativo/inativo
    var handleToggleStatus = function () {
        if (selectedUser) {
            toggleUserStatusMutation.mutate({
                id: selectedUser.id,
                active: !selectedUser.active
            });
        }
    };
    return (<div>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4"/>
                <Input placeholder="Buscar usuários" className="pl-10" value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }}/>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="includeInactive" checked={includeInactive} onCheckedChange={setIncludeInactive}/>
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
                {isLoading ? (Array(5).fill(0).map(function (_, i) { return (<TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-40"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto"/></TableCell>
                    </TableRow>); })) : filteredUsers && filteredUsers.length > 0 ? (filteredUsers.map(function (user) { return (<TableRow key={user.id} className={!user.active ? "opacity-60" : ""}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {user.role === 'admin' ? <Shield className="h-3 w-3 mr-1"/> :
                user.role === 'support' ? <UserCog className="h-3 w-3 mr-1"/> :
                    <User className="h-3 w-3 mr-1"/>}
                          {getRoleText(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "default" : "outline"} className={user.active ? "bg-green-500 hover:bg-green-500/80" : "text-neutral-500"}>
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={function () { return handleEditUser(user); }} title="Editar usuário">
                            <Pencil className="h-3.5 w-3.5"/>
                          </Button>
                          <Button variant="outline" size="sm" onClick={function () { return handleResetPassword(user); }} title="Redefinir senha">
                            <Key className="h-3.5 w-3.5"/>
                          </Button>
                          <Button variant={user.active ? "destructive" : "default"} size="sm" className={user.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"} onClick={function () { return handleStatusChange(user); }} title={user.active ? "Desativar usuário" : "Ativar usuário"}>
                            {user.active ?
                <UserX className="h-3.5 w-3.5"/> :
                <UserCheck className="h-3.5 w-3.5"/>}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>); })) : (<TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>)}
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
          
          {selectedUser && (<div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600"/> :
                selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600"/> :
                    <User className="h-5 w-5 text-neutral-600"/>}
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
            </div>)}
          
          <DialogFooter>
            <Button variant="outline" onClick={function () { return setActiveStatusDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={handleToggleStatus} variant={selectedUser && selectedUser.active ? "destructive" : "default"} className={selectedUser && selectedUser.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}>
              {selectedUser && selectedUser.active ? (<>
                  <UserX className="h-4 w-4 mr-2"/>
                  Desativar
                </>) : (<>
                  <UserCheck className="h-4 w-4 mr-2"/>
                  Ativar
                </>)}
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
          
          {selectedUser && (<div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600"/> :
                selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600"/> :
                    <User className="h-5 w-5 text-neutral-600"/>}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input id="password" type="password" value={password} onChange={function (e) { return setPassword(e.target.value); }} placeholder="Digite a nova senha"/>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={function (e) { return setConfirmPassword(e.target.value); }} placeholder="Confirme a nova senha"/>
                </div>
                
                {passwordError && (<div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 inline-block mr-1"/>
                    {passwordError}
                  </div>)}
              </div>
            </div>)}
          
          <DialogFooter>
            <Button variant="outline" onClick={function () { return setResetPasswordDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={handleResetPasswordSubmit}>
              <Key className="h-4 w-4 mr-2"/>
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
          
          {selectedUser && (<div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600"/> :
                selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600"/> :
                    <User className="h-5 w-5 text-neutral-600"/>}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="editName">Nome</Label>
                  <Input id="editName" value={editName} onChange={function (e) { return setEditName(e.target.value); }} placeholder="Nome completo"/>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input id="editEmail" type="email" value={editEmail} onChange={function (e) { return setEditEmail(e.target.value); }} placeholder="email@exemplo.com"/>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="editUsername">Nome de usuário</Label>
                  <Input id="editUsername" value={editUsername} onChange={function (e) { return setEditUsername(e.target.value); }} placeholder="Nome de usuário"/>
                </div>
              </div>
            </div>)}
          
          <DialogFooter>
            <Button variant="outline" onClick={function () { return setEditDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={handleEditUserSubmit}>
              <Save className="h-4 w-4 mr-2"/>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
