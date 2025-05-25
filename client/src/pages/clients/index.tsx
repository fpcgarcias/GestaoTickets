import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Pencil, UserX, UserCheck } from 'lucide-react';
import { Customer } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import AddClientDialog from './add-client-dialog';
import EditClientDialog from './edit-client-dialog';
import ToggleStatusClientDialog from './toggle-status-client-dialog';
import { useAuth } from '@/hooks/use-auth';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export default function ClientsIndex() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const { user } = useAuth();
  
  const { data: clients = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers', includeInactive ? 'all' : 'active'],
    queryFn: async () => {
      const url = includeInactive ? '/api/customers?includeInactive=true' : '/api/customers';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar clientes');
      return res.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
  
  const handleEditClient = (client: Customer) => {
    setSelectedClient(client);
    setShowEditDialog(true);
  };
  
  const handleToggleStatusClient = (client: Customer) => {
    setSelectedClient(client);
    setShowDeleteDialog(true);
  };
  
  // Filtrar os clientes com base na busca
  const filteredClients = clients?.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.company && client.company.toLowerCase().includes(query))
    );
  });

  // Verificar se o usuário tem permissão para acessar esta página
  // Apenas 'admin', 'support' e 'company_admin' podem ver a lista de clientes
  const hasAccess = user && (user.role === 'admin' || user.role === 'support' || user.role === 'company_admin');

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acesso Restrito</CardTitle>
          <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Esta página é reservada para administradores e atendentes do sistema.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Verificar o status do cliente com base no usuário associado
  const getClientStatus = (client: Customer & { active?: boolean }) => {
    // Se já tiver a propriedade active, usar diretamente
    if ('active' in client) {
      return client.active !== false;
    }
    
    // Caso contrário, verificar com base no usuário
    // Podemos assumir que o cliente está ativo se não temos informação contrária
    if (!client.user_id) return true;
    
    // Se o cliente estiver com user_id mas o status não vier do backend, assumimos que está ativo
    return true;
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>
      
      <AddClientDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={() => {
          // Atualizar a lista de clientes automaticamente
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        }}
      />
      
      <EditClientDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        client={selectedClient}
        onSaved={() => {
          // Atualizar a lista após edição
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        }}
      />
      
      <ToggleStatusClientDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        client={selectedClient}
        onStatusChanged={() => {
          // Atualizar a lista após alteração de status
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Clientes</CardTitle>
          <CardDescription>Gerencie os clientes cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Pesquisar clientes" 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
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
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => {
                    const isActive = getClientStatus(client);
                    return (
                      <TableRow key={client.id} className={!isActive ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{client.phone || '-'}</TableCell>
                        {user?.role === 'admin' && <TableCell>{client.company || '-'}</TableCell>}
                        <TableCell>
                          <Badge 
                            variant={isActive ? "default" : "outline"}
                            className={isActive ? "bg-green-500 hover:bg-green-500/80" : "text-neutral-500"}
                          >
                            {isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditClient(client)}
                              title="Editar cliente"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant={isActive ? "destructive" : "default"}
                              size="sm"
                              title={isActive ? "Desativar cliente" : "Ativar cliente"}
                              onClick={() => handleToggleStatusClient(client)}
                              className={isActive ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            >
                              {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
    </div>
  );
}
