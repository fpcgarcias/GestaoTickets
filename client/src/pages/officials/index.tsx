import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Mail, 
  Pencil, 
  Trash, 
  UserPlus,
  Check,
  X
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { AddOfficialDialog } from './add-official-dialog';
import { EditOfficialDialog } from './edit-official-dialog';
import { DeleteOfficialDialog } from './delete-official-dialog';
import { Official } from '@shared/schema';

export default function OfficialsIndex() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<Official | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: officials, isLoading } = useQuery({
    queryKey: ['/api/officials'],
  });
  
  const handleEditOfficial = (official: Official) => {
    setSelectedOfficial(official);
    setShowEditDialog(true);
  };
  
  const handleDeleteOfficial = (official: Official) => {
    setSelectedOfficial(official);
    setShowDeleteDialog(true);
  };
  
  // Filtrar os atendentes com base na busca
  const filteredOfficials = officials?.filter(official => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      official.name.toLowerCase().includes(query) ||
      official.email.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Atendentes</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar Atendente
        </Button>
      </div>
      
      <AddOfficialDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
      
      <EditOfficialDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        official={selectedOfficial}
      />
      
      <DeleteOfficialDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        official={selectedOfficial}
      />

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Atendentes</CardTitle>
          <CardDescription>Gerencie os membros da sua equipe de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
              <Input 
                placeholder="Pesquisar atendentes" 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tickets Atribuídos</TableHead>
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
                ) : filteredOfficials && filteredOfficials.length > 0 ? (
                  filteredOfficials.map((official) => (
                    <TableRow key={official.id}>
                      <TableCell className="font-medium">{official.name}</TableCell>
                      <TableCell>{official.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {official.departments && Array.isArray(official.departments) && official.departments.length > 0 ? (
                            official.departments.map((dept, index) => (
                              <Badge key={index} variant="outline" className="capitalize">
                                {dept === 'technical' && 'Suporte Técnico'}
                                {dept === 'billing' && 'Faturamento'}
                                {dept === 'general' && 'Atendimento Geral'}
                                {dept === 'sales' && 'Vendas'}
                                {dept === 'other' && 'Outro'}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-neutral-500 text-sm">Sem departamento</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {official.isActive ? (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                            <X className="w-3 h-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {/* TODO: Add assigned tickets count */}
                        -
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleEditOfficial(official)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleDeleteOfficial(official)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                      Nenhum atendente encontrado. Adicione seu primeiro membro de equipe para começar.
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
