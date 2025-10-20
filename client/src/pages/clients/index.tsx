import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserPlus, Pencil, UserX, UserCheck, Building2, Upload } from 'lucide-react';
import { Customer } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import AddClientDialog from './add-client-dialog';
import EditClientDialog from './edit-client-dialog';
import ToggleStatusClientDialog from './toggle-status-client-dialog';
import BulkImportDialog from './bulk-import-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useBusinessHoursRefetchInterval } from '../../hooks/use-business-hours';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function ClientsIndex() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { formatMessage } = useI18n();

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(30000);
  
  const { data: clientsResponse, isLoading } = useQuery({
    queryKey: ['/api/customers', includeInactive ? 'all' : 'active', currentPage, searchQuery, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(includeInactive && { includeInactive: 'true' }),
        ...(searchQuery && { search: searchQuery }),
        ...(selectedCompanyId !== 'all' && user?.role === 'admin' && { company_id: selectedCompanyId }),
      });
      
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar clientes');
      return res.json();
    },
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
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
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
  });

  const clients = clientsResponse?.data || [];
  const pagination = clientsResponse?.pagination;
  
  // Ordenação já é feita no backend, filtro por empresa também é feito no backend
  
  const handleEditClient = (client: Customer) => {
    setSelectedClient(client);
    setShowEditDialog(true);
  };
  
  const handleToggleStatusClient = (client: Customer) => {
    setSelectedClient(client);
    setShowDeleteDialog(true);
  };
  
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

  // Verificar se o usuário tem permissão para acessar esta página
  // 'admin', 'support', 'company_admin', 'manager' e 'supervisor' podem ver a lista de clientes
  const hasAccess = user && (user.role === 'admin' || user.role === 'support' || user.role === 'company_admin' || user.role === 'manager' || user.role === 'supervisor');

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('clients.restricted_access')}</CardTitle>
          <CardDescription>{formatMessage('clients.no_permission')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>{formatMessage('clients.admin_only')}</p>
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

  // Função para obter o nome da empresa
  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return formatMessage('clients.global_system');
    const company = companies.find(c => c.id === companyId);
    return company?.name || formatMessage('clients.company_not_found');
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('clients.title')}</h1>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Button onClick={() => setShowBulkImportDialog(true)} variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              {formatMessage('clients.bulk_import')}
            </Button>
          )}
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {formatMessage('clients.add_client')}
          </Button>
        </div>
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
      
      <BulkImportDialog
        open={showBulkImportDialog}
        onOpenChange={setShowBulkImportDialog}
        onImported={() => {
          // Atualizar a lista após importação
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('clients.management_title')}</CardTitle>
          <CardDescription>{formatMessage('clients.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder={formatMessage('clients.search_placeholder')} 
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
                      <SelectValue placeholder={formatMessage('clients.filter_by_company')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{formatMessage('clients.all_companies')}</SelectItem>
                      {isLoadingCompanies ? (
                        <SelectItem value="loading" disabled>{formatMessage('clients.loading_companies')}</SelectItem>
                      ) : (
                        companies
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
                <Label htmlFor="includeInactive">{formatMessage('clients.include_inactive')}</Label>
              </div>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{formatMessage('clients.name')}</TableHead>
                  <TableHead>{formatMessage('clients.email')}</TableHead>
                  <TableHead>{formatMessage('clients.phone')}</TableHead>
                  {user?.role === 'admin' && <TableHead>{formatMessage('clients.company')}</TableHead>}
                  <TableHead>{formatMessage('clients.status')}</TableHead>
                  <TableHead className="text-right">{formatMessage('clients.actions')}</TableHead>
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
                ) : clients.length > 0 ? (
                  clients.map((client: any) => {
                    const isActive = getClientStatus(client);
                    return (
                      <TableRow key={client.id} className={!isActive ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{client.phone || '-'}</TableCell>
                        {user?.role === 'admin' && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-neutral-500" />
                              <span className="text-sm text-neutral-600">
                                {getCompanyName(client.company_id)}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          {(isActive === undefined || isActive) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {formatMessage('clients.active')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {formatMessage('clients.inactive')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditClient(client)}
                              title={formatMessage('clients.edit_client')}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant={isActive ? "destructive" : "default"}
                              size="sm"
                              title={isActive ? formatMessage('clients.deactivate_client') : formatMessage('clients.activate_client')}
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
                    <TableCell colSpan={user?.role === 'admin' ? 6 : 5} className="text-center py-10 text-neutral-500">
                      {searchQuery || selectedCompanyId !== 'all' 
                        ? formatMessage('clients.no_clients_filtered')
                        : formatMessage('clients.no_clients_found')
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
                {formatMessage('clients.showing_results', {
                  start: ((pagination.page - 1) * pagination.limit) + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })}
                {selectedCompanyId !== 'all' && user?.role === 'admin' && (
                  <span className="ml-2 text-neutral-500">
                    {formatMessage('clients.filtered_by', { company: getCompanyName(parseInt(selectedCompanyId)) })}
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
                  {formatMessage('clients.previous')}
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
                  {formatMessage('clients.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
