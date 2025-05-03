import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Pencil, UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import AddClientDialog from './add-client-dialog';
import EditClientDialog from './edit-client-dialog';
import ToggleStatusClientDialog from './toggle-status-client-dialog';
import { useAuth } from '@/hooks/use-auth';
export default function ClientsIndex() {
    var _a = useState(false), showAddDialog = _a[0], setShowAddDialog = _a[1];
    var _b = useState(false), showEditDialog = _b[0], setShowEditDialog = _b[1];
    var _c = useState(false), showDeleteDialog = _c[0], setShowDeleteDialog = _c[1];
    var _d = useState(null), selectedClient = _d[0], setSelectedClient = _d[1];
    var _e = useState(''), searchQuery = _e[0], setSearchQuery = _e[1];
    var user = useAuth().user;
    var _f = useQuery({
        queryKey: ['/api/customers'],
    }), _g = _f.data, clients = _g === void 0 ? [] : _g, isLoading = _f.isLoading;
    var handleEditClient = function (client) {
        setSelectedClient(client);
        setShowEditDialog(true);
    };
    var handleToggleStatusClient = function (client) {
        setSelectedClient(client);
        setShowDeleteDialog(true);
    };
    // Filtrar os clientes com base na busca
    var filteredClients = clients === null || clients === void 0 ? void 0 : clients.filter(function (client) {
        if (!searchQuery)
            return true;
        var query = searchQuery.toLowerCase();
        return (client.name.toLowerCase().includes(query) ||
            client.email.toLowerCase().includes(query) ||
            (client.company && client.company.toLowerCase().includes(query)));
    });
    // Verificar se o usuário tem permissão para acessar esta página
    // Apenas 'admin' e 'support' podem ver a lista de clientes
    var hasAccess = user && (user.role === 'admin' || user.role === 'support');
    if (!hasAccess) {
        return (<Card>
        <CardHeader>
          <CardTitle>Acesso Restrito</CardTitle>
          <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Esta página é reservada para administradores e atendentes do sistema.</p>
        </CardContent>
      </Card>);
    }
    return (<div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
        <Button onClick={function () { return setShowAddDialog(true); }}>
          <UserPlus className="mr-2 h-4 w-4"/>
          Adicionar Cliente
        </Button>
      </div>
      
      <AddClientDialog open={showAddDialog} onOpenChange={setShowAddDialog}/>
      
      <EditClientDialog open={showEditDialog} onOpenChange={setShowEditDialog} client={selectedClient}/>
      
      <ToggleStatusClientDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} client={selectedClient}/>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Clientes</CardTitle>
          <CardDescription>Gerencie os clientes cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4"/>
              <Input placeholder="Pesquisar clientes" className="pl-10" value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }}/>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (Array(5).fill(0).map(function (_, i) { return (<TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-full"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-full"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-full"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-full"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    </TableRow>); })) : filteredClients.length > 0 ? (filteredClients.map(function (client) { return (<TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>{client.company || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm" onClick={function () { return handleEditClient(client); }} title="Editar cliente">
                            <Pencil className="h-3.5 w-3.5"/>
                          </Button>
                          <Button variant="destructive" size="sm" title="Desativar/ativar cliente" onClick={function () { return handleToggleStatusClient(client); }} className="bg-amber-500 hover:bg-amber-500/90">
                            <UserX className="h-3.5 w-3.5"/>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>); })) : (<TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-neutral-500">
                      Nenhum cliente encontrado. Adicione seu primeiro cliente para começar.
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);
}
