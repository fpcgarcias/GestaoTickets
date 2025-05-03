import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Pencil, UserPlus, Check, X, UserCheck, UserX } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { AddOfficialDialog } from './add-official-dialog';
import { EditOfficialDialog } from './edit-official-dialog';
import { ToggleStatusOfficialDialog } from '@/pages/officials/toggle-status-official-dialog';
import { useQueryClient } from '@tanstack/react-query';

export default function OfficialsIndex() {
    var _a = useState(false), showAddDialog = _a[0], setShowAddDialog = _a[1];
    var _b = useState(false), showEditDialog = _b[0], setShowEditDialog = _b[1];
    var _c = useState(false), showDeleteDialog = _c[0], setShowDeleteDialog = _c[1];
    var _d = useState(null), selectedOfficial = _d[0], setSelectedOfficial = _d[1];
    var _e = useState(''), searchQuery = _e[0], setSearchQuery = _e[1];
    var _f = useQuery({
        queryKey: ['/api/officials'],
    }), _g = _f.data, officials = _g === void 0 ? [] : _g, isLoading = _f.isLoading;
    var queryClient = useQueryClient();

    var handleEditOfficial = function (official) {
        setSelectedOfficial(official);
        setShowEditDialog(true);
    };
    var handleDeleteOfficial = function (official) {
        setSelectedOfficial(official);
        setShowDeleteDialog(true);
    };
    
    // Função para obter o username do atendente de qualquer estrutura possível
    var getUsernameFromOfficial = function(official) {
        // Caso 1: o usuário está na propriedade 'user'
        if (official.user && official.user.username) {
            return official.user.username;
        }
        
        // Caso 2: username está diretamente no atendente
        if (official.username) {
            return official.username;
        }
        
        // Caso 3: pode estar em outra estrutura como userId: {username: ...}
        if (official.userId && typeof official.userId === 'object' && official.userId.username) {
            return official.userId.username;
        }
        
        // Caso 4: pode estar em userData
        if (official.userData && official.userData.username) {
            return official.userData.username;
        }
        
        // Caso 5: fallback para email se nenhum username for encontrado
        return official.email || '-';
    };
    
    // Filtrar os atendentes com base na busca
    var filteredOfficials = officials === null || officials === void 0 ? void 0 : officials.filter(function (official) {
        if (!searchQuery)
            return true;
        var query = searchQuery.toLowerCase();
        var username = getUsernameFromOfficial(official);
        return (official.name.toLowerCase().includes(query) ||
                official.email.toLowerCase().includes(query) ||
                (username && username.toLowerCase().includes(query)));
    });
    
    return (<div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Atendentes</h1>
        <Button onClick={function () { return setShowAddDialog(true); }}>
          <UserPlus className="mr-2 h-4 w-4"/>
          Adicionar Atendente
        </Button>
      </div>
      
      <AddOfficialDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={(official) => {
          // Atualizar a lista de atendentes automaticamente depois que um novo for adicionado
          queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
        }}
      />
      
      <EditOfficialDialog open={showEditDialog} onOpenChange={setShowEditDialog} official={selectedOfficial}/>
      
      <ToggleStatusOfficialDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} official={selectedOfficial}/>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Atendentes</CardTitle>
          <CardDescription>Gerencie os membros da sua equipe de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4"/>
              <Input placeholder="Pesquisar atendentes" className="pl-10" value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }}/>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tickets Atribuídos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (Array(5).fill(0).map(function (_, i) { return (<TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-40"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto"/></TableCell>
                    </TableRow>); })) : filteredOfficials && filteredOfficials.length > 0 ? (filteredOfficials.map(function (official) {
                      var username = getUsernameFromOfficial(official);
                      console.log('Official data:', official);
                      
                      // Adicionar logs específicos para debugar a estrutura do user
                      if (official.user) {
                        console.log('User data encontrado:', official.user);
                        console.log('Username do usuário:', official.user.username);
                      } else {
                        console.log('Oficial sem propriedade user:', official);
                        console.log('UserId value:', official.userId);
                      }
                      
                      return (<TableRow key={official.id}>
                      <TableCell className="font-medium">{official.name}</TableCell>
                      <TableCell>{username}</TableCell>
                      <TableCell>{official.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {official.departments && Array.isArray(official.departments) && official.departments.length > 0 ? (
            // Exibir os departamentos
            official.departments.map(function (dept, index) {
                // Se dept é um objeto com propriedade 'department', pegamos essa propriedade
                // Se não, assumimos que dept é uma string diretamente
                var departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                    ? dept.department
                    : dept;
                return (<Badge key={index} variant="outline" className="capitalize">
                                  {departmentValue === 'technical' && 'Suporte Técnico'}
                                  {departmentValue === 'billing' && 'Faturamento'}
                                  {departmentValue === 'general' && 'Atendimento Geral'}
                                  {departmentValue === 'sales' && 'Vendas'}
                                  {departmentValue === 'other' && 'Outro'}
                                </Badge>);
            })) : (<span className="text-neutral-500 text-sm">Sem departamento</span>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {official.isActive ? (<Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="w-3 h-3 mr-1"/>
                            Ativo
                          </Badge>) : (<Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                            <X className="w-3 h-3 mr-1"/>
                            Inativo
                          </Badge>)}
                      </TableCell>
                      <TableCell className="text-center">
                        {/* TODO: Add assigned tickets count */}
                        -
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={function () { return handleEditOfficial(official); }} title="Editar atendente">
                            <Pencil className="h-3.5 w-3.5"/>
                          </Button>
                          <Button variant={official.isActive ? "destructive" : "default"} size="sm" className={official.isActive ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"} onClick={function () { return handleDeleteOfficial(official); }} title={official.isActive ? "Desativar atendente" : "Ativar atendente"}>
                            {official.isActive ?
                <UserX className="h-3.5 w-3.5"/> :
                <UserCheck className="h-3.5 w-3.5"/>}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>);})) : (<TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-neutral-500">
                      Nenhum atendente encontrado. Adicione seu primeiro membro de equipe para começar.
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);
}
