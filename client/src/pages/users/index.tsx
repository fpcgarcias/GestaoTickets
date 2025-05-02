import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Mail, Phone, Building, Pencil, Trash, UserPlus, Loader2, Copy, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function UsersIndex() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  // Função para controlar a abertura/fechamento do diálogo de edição
  const handleEditDialogOpenChange = (open: boolean) => {
    // Se estiver fechando o diálogo, resetar formulário de senha
    if (!open) {
      setShowPasswordForm(false);
      setPassword('');
      setConfirmPassword('');
      setPasswordError('');
    }
    setIsEditDialogOpen(open);
  };
  
  // Formulário para novo cliente
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompany, setNewCompany] = useState('');
  
  // Formulário para edição
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  
  // Estados para alteração de senha
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Estado para armazenar as informações de acesso temporário
  const [tempAccessInfo, setTempAccessInfo] = useState<{
    username: string,
    temporaryPassword: string,
    message: string
  } | null>(null);
  
  // Mutação para adicionar cliente
  const addCustomerMutation = useMutation({
    mutationFn: async (customerData: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
    }) => {
      const res = await apiRequest('POST', '/api/customers', customerData);
      return res.json();
    },
    onSuccess: (data) => {
      // Verificar se há informações de acesso na resposta
      if (data.accessInfo) {
        setTempAccessInfo(data.accessInfo);
        toast({
          title: "Cliente adicionado",
          description: "Cliente adicionado com sucesso. Uma senha temporária foi gerada.",
        });
      } else {
        toast({
          title: "Cliente adicionado",
          description: "Cliente adicionado com sucesso.",
        });
        resetForm();
        setIsAddDialogOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar cliente",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar cliente
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { id: number, customerData: any }) => {
      const res = await apiRequest('PATCH', `/api/customers/${data.id}`, data.customerData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente atualizado",
        description: "Cliente atualizado com sucesso.",
      });
      handleEditDialogOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutação para excluir cliente
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/customers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente excluído",
        description: "Cliente excluído com sucesso.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir cliente",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleAddCustomer = () => {
    if (!newName || !newEmail) {
      toast({
        title: "Dados incompletos",
        description: "Nome e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    addCustomerMutation.mutate({
      name: newName,
      email: newEmail,
      phone: newPhone || undefined,
      company: newCompany || undefined,
    });
  };

  const resetForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewCompany('');
  };

  const handleEditCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditPhone(customer.phone || '');
    setEditCompany(customer.company || '');
    setIsEditDialogOpen(true);
  };

  const handleDeleteCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  // Função para alternar a exibição do formulário de senha
  const togglePasswordForm = () => {
    // Limpar os campos de senha e erros ao alternar
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordForm(!showPasswordForm);
  };

  const submitEditCustomer = () => {
    if (!editName || !editEmail) {
      toast({
        title: "Dados incompletos",
        description: "Nome e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se há senha para atualizar
    if (showPasswordForm) {
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

      // Adicionar senha aos dados a serem atualizados
      updateCustomerMutation.mutate({
        id: selectedCustomer.id,
        customerData: {
          name: editName,
          email: editEmail,
          phone: editPhone || undefined,
          company: editCompany || undefined,
          password: password
        }
      });
    } else {
      // Atualização normal sem senha
      updateCustomerMutation.mutate({
        id: selectedCustomer.id,
        customerData: {
          name: editName,
          email: editEmail,
          phone: editPhone || undefined,
          company: editCompany || undefined,
        }
      });
    }
  };

  const confirmDeleteCustomer = () => {
    if (selectedCustomer) {
      deleteCustomerMutation.mutate(selectedCustomer.id);
    }
  };
  
  // Filtragem de clientes
  const filteredCustomers = customers && searchTerm 
    ? customers.filter((customer) => 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.company && customer.company.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : customers;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Clientes</CardTitle>
          <CardDescription>Gerencie clientes que podem criar chamados de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
              <Input 
                placeholder="Buscar clientes" 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Chamados</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredCustomers && filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell>{customer.company || '-'}</TableCell>
                      <TableCell>{customer.ticketCount || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditCustomer(customer)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteCustomer(customer)}>
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                      Nenhum cliente encontrado. Adicione seu primeiro cliente para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Dialog para adicionar cliente */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Limpar as informações de acesso temporário ao fechar o diálogo
          setTempAccessInfo(null);
          resetForm();
        }
        setIsAddDialogOpen(open);
      }}>
        <DialogContent>
          {tempAccessInfo ? (
            // Exibir informações de acesso se estiverem disponíveis
            <>
              <DialogHeader>
                <DialogTitle>Cliente Adicionado com Sucesso</DialogTitle>
                <DialogDescription>
                  As informações de acesso do cliente foram geradas. Guarde essas informações em um lugar seguro.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                    <p className="text-sm font-medium text-yellow-800">
                      Importante: Estas informações só serão exibidas uma vez.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="font-semibold block mb-1">Nome de usuário</Label>
                    <div className="rounded-md border p-3 bg-neutral-50 text-neutral-900 flex justify-between items-center">
                      <span>{tempAccessInfo.username}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(tempAccessInfo.username)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="font-semibold block mb-1">Senha temporária</Label>
                    <div className="rounded-md border p-3 bg-neutral-50 text-neutral-900 flex justify-between items-center">
                      <span>{tempAccessInfo.temporaryPassword}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(tempAccessInfo.temporaryPassword)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-600 mt-4">
                    {tempAccessInfo.message}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={() => {
                    setTempAccessInfo(null);
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                >
                  Entendi, fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            // Formulário para adicionar cliente
            <>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Preencha os dados do cliente para adicioná-lo ao sistema.  
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input 
                    id="name" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input 
                    id="phone" 
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input 
                    id="company" 
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={handleAddCustomer}
                  disabled={addCustomerMutation.isPending}
                >
                  {addCustomerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>Adicionar Cliente</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para editar cliente */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Editar informações do cliente
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input 
                id="edit-name" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input 
                id="edit-email" 
                type="email" 
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input 
                id="edit-phone" 
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-company">Empresa</Label>
              <Input 
                id="edit-company" 
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>

            {/* Botão para exibir/ocultar formulário de senha */}
            <div className="grid gap-2">
              <Label htmlFor="change-password">Senha</Label>
              <Button 
                id="change-password"
                type="button" 
                variant="outline" 
                onClick={togglePasswordForm}
                className="w-full justify-start"
              >
                {showPasswordForm ? "Cancelar alteração de senha" : "Alterar senha"}
              </Button>
            </div>
            
            {/* Formulário de senha condicional */}
            {showPasswordForm && (
              <>
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
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <div className="space-y-2">
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite a senha novamente"
                    />
                    {passwordError && (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleEditDialogOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={submitEditCustomer}
              disabled={updateCustomerMutation.isPending}
            >
              {updateCustomerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>Salvar Alterações</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="py-4">
              <p className="mb-2"><strong>Nome:</strong> {selectedCustomer.name}</p>
              <p className="mb-2"><strong>Email:</strong> {selectedCustomer.email}</p>
              <p className="text-red-500 mt-4 text-sm">
                Atenção: Todos os chamados associados a este cliente permanecerão no sistema.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteCustomer}
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>Excluir Cliente</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
