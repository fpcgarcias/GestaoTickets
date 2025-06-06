import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Pencil, UserX, UserCheck, Building2, Users } from 'lucide-react';
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

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup } from '@/components/ui/standardized-button';

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
  
  // Handlers padronizados
  const handleCreateClient = () => {
    setShowAddDialog(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };



  const handleEdit = (client: Customer) => {
    setSelectedClient(client);
    setShowEditDialog(true);
  };

  const handleDelete = (client: Customer) => {
    setSelectedClient(client);
    setShowDeleteDialog(true);
  };
  
  // Handlers antigos mantidos para compatibilidade
  const handleEditClient = (client: Customer) => {
    handleEdit(client);
  };
  
  const handleToggleStatusClient = (client: Customer) => {
    handleDelete(client);
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
      <div className="container mx-auto py-6 px-4">
        <EmptyState
          icon={Building2}
          title="Acesso Restrito"
          description="Esta página é reservada para administradores e atendentes do sistema."
        />
      </div>
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

  // Estado vazio quando não há clientes
  if (filteredClients && filteredClients.length === 0 && !isLoading && !searchQuery) {
    return (
      <>
        <StandardPage
          icon={Users}
          title="Clientes"
          description="Gerencie os clientes cadastrados no sistema"
          createButtonText="Adicionar Cliente"
          onCreateClick={handleCreateClient}
          onSearchChange={handleSearchChange}
          searchValue={searchQuery}
          searchPlaceholder="Pesquisar clientes..."
        >
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Não há clientes cadastrados no sistema. Clique no botão abaixo para adicionar o primeiro cliente."
            actionLabel="Adicionar Primeiro Cliente"
            onAction={handleCreateClient}
          />
        </StandardPage>

        <AddClientDialog 
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
          }}
        />
      </>
    );
  }
  
  return (
    <>
      <StandardPage
        icon={Users}
        title="Clientes"
        description="Gerencie os clientes cadastrados no sistema"
        createButtonText="Adicionar Cliente"
        onCreateClick={handleCreateClient}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        searchPlaceholder="Pesquisar clientes..."
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
            <Label htmlFor="includeInactive">Incluir clientes inativos</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredClients ? `${filteredClients.length} cliente(s) encontrado(s)` : ''}
          </div>
        </div>

        {filteredClients && filteredClients.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum cliente encontrado"
            description={`Não foram encontrados clientes com o termo "${searchQuery}".`}
            actionLabel="Limpar busca"
            onAction={() => setSearchQuery('')}
          />
        ) : (
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
              ) : (
                filteredClients?.map((client) => {
                  const isActive = getClientStatus(client);
                  return (
                    <TableRow key={client.id} className={!isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {client.company || 'Sistema Global'}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge isActive={isActive} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButtonGroup
                          onEdit={() => handleEdit(client)}
                          onDelete={() => handleDelete(client)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </StandardPage>
      
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
    </>
  );
}
