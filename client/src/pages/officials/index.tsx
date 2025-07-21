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
  X,
  UserCog,
  UserCheck,
  UserX,
  Shield,
  User,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddOfficialDialog } from './add-official-dialog';
import { EditOfficialDialog } from './edit-official-dialog';
import { ToggleStatusOfficialDialog } from '@/pages/officials/toggle-status-official-dialog';
import { Official } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

// Interface para empresa
interface Company {
  id: number;
  name: string;
  email: string;
  domain?: string;
  active: boolean;
  cnpj?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

// Estendendo a interface Official para incluir o user com username
interface OfficialWithUser extends Official {
  user?: {
    id: number;
    username: string;
    email?: string;
  };
}

export default function OfficialsIndex() {
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialWithUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  
  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Reset page when company filter changes
  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const { data: officialsResponse, isLoading } = useQuery({
    queryKey: ['/api/officials', currentPage, searchQuery, includeInactive ? 'all' : 'active', selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(includeInactive && { includeInactive: 'true' }),
        ...(searchQuery && { search: searchQuery }),
        ...(selectedCompanyId !== 'all' && user?.role === 'admin' && { company_id: selectedCompanyId }),
      });
      
      const res = await fetch(`/api/officials?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      const data = await res.json();
      
      return data;
    },
    staleTime: 0, // Forçar recarregamento
  });

  // Buscar empresas apenas para admin
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin',
    refetchInterval: 30000,
  });

  const officials = officialsResponse?.data || [];
  const pagination = officialsResponse?.pagination;
  
  
  
  const queryClient = useQueryClient();
  
  const handleEditOfficial = (official: OfficialWithUser) => {
    setSelectedOfficial(official);
    setShowEditDialog(true);
  };
  
  const handleDeleteOfficial = (official: OfficialWithUser) => {
    setSelectedOfficial(official);
    setShowDeleteDialog(true);
  };
  

  
  // Função para obter o nome da empresa
  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return 'Sistema Global';
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Empresa não encontrada';
  };

  // Garantir que companies é sempre um array válido
  const safeCompanies = Array.isArray(companies) ? companies : [];
  
  // Garantir que officials é sempre um array válido
  const safeOfficials = Array.isArray(officials) ? officials : [];

  // Ordenação e filtros já são feitos no backend

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
        onCreated={(official) => {
          // Atualizar a lista de atendentes automaticamente depois que um novo for adicionado
          queryClient.invalidateQueries({ predicate: (query) => 
            query.queryKey[0] === '/api/officials' 
          });
        }}
      />
      
      <EditOfficialDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        official={selectedOfficial}
        onSaved={() => {
          // Atualizar a lista após edição
          queryClient.invalidateQueries({ predicate: (query) => 
            query.queryKey[0] === '/api/officials' 
          });
        }}
      />
      
      <ToggleStatusOfficialDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        official={selectedOfficial}
        onStatusChanged={() => {
          // Atualizar a lista após alteração de status
          queryClient.invalidateQueries({ predicate: (query) => 
            query.queryKey[0] === '/api/officials' 
          });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Atendentes</CardTitle>
          <CardDescription>Gerencie os membros da sua equipe de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Pesquisar atendentes" 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              
              {/* Filtro por empresa - apenas para admin */}
              {user?.role === 'admin' && (
                <div className="w-64">
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {isLoadingCompanies ? (
                        <SelectItem value="loading" disabled>Carregando empresas...</SelectItem>
                      ) : (
                        safeCompanies
                          .filter(company => company.active) // Mostrar apenas empresas ativas
                          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                          .map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
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
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Gerente</TableHead>
                  {user?.role === 'admin' && <TableHead>Empresa</TableHead>}
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
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : safeOfficials && safeOfficials.length > 0 ? (
                  [...safeOfficials]
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                    .map((official: any) => {
                      return (
                        <TableRow key={official.id}>
                          <TableCell className="font-medium">{official.name}</TableCell>
                          <TableCell>{official.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {official.departments && Array.isArray(official.departments) && official.departments.length > 0 ? (
                                // Exibir os departamentos
                                official.departments.map((dept: any, index: number) => {
                                  // Se dept é um objeto com propriedade 'department', pegamos essa propriedade
                                  // Se não, assumimos que dept é uma string diretamente
                                  const departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                                    ? dept.department
                                    : dept;
                                    
                                  return (
                                    <Badge key={index} variant="outline" className="capitalize">
                                      {departmentValue}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <span className="text-neutral-500 text-sm">Sem departamento</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {/* SUPERVISOR: só para support, nunca para manager/supervisor */}
                            {(() => {
                              // Se o official tem supervisor_id, mostrar nome do supervisor
                              if ((official as any).supervisor_id) {
                                const supervisor = safeOfficials.find((o: any) => o.id === (official as any).supervisor_id);
                                return supervisor ? (
                                  <span className="text-sm text-neutral-600">{supervisor.name}</span>
                                ) : (
                                  <span className="text-sm text-neutral-400">-</span>
                                );
                              }
                              // Se não tem supervisor vinculado, mostrar '-'
                              return <span className="text-sm text-neutral-400">-</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                            {/* MANAGER: para support e supervisor, nunca para manager */}
                            {official.manager && official.manager.name ? (
                              <span className="text-sm text-neutral-600">{official.manager.name}</span>
                            ) : (
                              <span className="text-sm text-neutral-400">-</span>
                            )}
                          </TableCell>
                          {user?.role === 'admin' && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-neutral-500" />
                                <span className="text-sm text-neutral-600">
                                  {(official as any).company?.name || 'Sistema Global'}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            {(official.is_active === undefined || official.is_active) ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inativo
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const count = (official as any).assignedTicketsCount;
                              if (typeof count === 'number') return count;
                              if (typeof count === 'string' && !isNaN(Number(count))) return Number(count);
                              return '-';
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditOfficial(official)}
                                title="Editar atendente"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant={official.is_active ? "destructive" : "default"} 
                                size="sm"
                                className={official.is_active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                                onClick={() => handleDeleteOfficial(official)}
                                title={official.is_active ? "Desativar atendente" : "Ativar atendente"}
                              >
                                {official.is_active ? 
                                  <UserX className="h-3.5 w-3.5" /> : 
                                  <UserCheck className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                ) : (
                  <TableRow>
                    <TableCell colSpan={user?.role === 'admin' ? 9 : 8} className="text-center py-10 text-neutral-500">
                      {searchQuery || selectedCompanyId !== 'all' 
                        ? "Nenhum atendente encontrado com os filtros aplicados." 
                        : "Nenhum atendente encontrado. Adicione seu primeiro membro de equipe para começar."
                      }
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
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} atendentes
                {selectedCompanyId !== 'all' && user?.role === 'admin' && (
                  <span className="ml-2 text-neutral-500">
                    (filtrado por: {getCompanyName(parseInt(selectedCompanyId))})
                  </span>
                )}
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
    </div>
  );
}
