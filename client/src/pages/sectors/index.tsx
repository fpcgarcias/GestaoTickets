import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import AddSectorDialog from './add-sector-dialog';
import EditSectorDialog from './edit-sector-dialog';

interface Sector {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: number;
  name: string;
}

export default function SectorsIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

  const { data: sectorsResponse, isLoading } = useQuery({
    queryKey: ['/api/sectors', includeInactive ? 'all' : 'active', currentPage, searchTerm, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        active_only: includeInactive ? 'false' : 'true',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCompanyId !== 'all' && user?.role === 'admin' && { company_id: selectedCompanyId }),
      });
      const res = await fetch(`/api/sectors?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar setores');
      return res.json();
    },
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin',
  });

  const sectors = sectorsResponse?.data || [];
  const pagination = sectorsResponse?.pagination;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/sectors/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao excluir setor');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      toast({
        title: formatMessage('sectors.delete_success'),
        description: formatMessage('sectors.delete_success_desc'),
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('sectors.delete_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (sector: Sector) => {
    setSelectedSector(sector);
    setEditDialogOpen(true);
  };

  const handleDelete = (sector: Sector) => {
    if (window.confirm(formatMessage('sectors.delete_confirm', { name: sector.name }))) {
      deleteMutation.mutate(sector.id);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setCurrentPage(1);
  };

  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return '-';
    const c = companies.find((x: Company) => x.id === companyId);
    return c?.name ?? '-';
  };

  const colSpanCount = user?.role === 'admin' ? 5 : 4;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('sectors.title')}</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          {formatMessage('sectors.add')}
        </Button>
      </div>

      <AddSectorDialog open={showAddDialog} onOpenChange={setShowAddDialog} onCreated={() => queryClient.invalidateQueries({ queryKey: ['/api/sectors'] })} />
      <EditSectorDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        sector={selectedSector}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
          setEditDialogOpen(false);
          setSelectedSector(null);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('sectors.management_title')}</CardTitle>
          <CardDescription>{formatMessage('sectors.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
              <Input
                placeholder={formatMessage('sectors.search_placeholder')}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            {user?.role === 'admin' && (
              <div className="w-64">
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('sectors.filter_company')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{formatMessage('sectors.all_companies')}</SelectItem>
                    {companies
                      .filter((c: Company) => c.id)
                      .sort((a: Company, b: Company) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                      .map((c: Company) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch id="includeInactive" checked={includeInactive} onCheckedChange={(checked) => { setIncludeInactive(!!checked); setCurrentPage(1); }} />
              <Label htmlFor="includeInactive">{formatMessage('sectors.include_inactive')}</Label>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{formatMessage('sectors.name')}</TableHead>
                  <TableHead>{formatMessage('sectors.description')}</TableHead>
                  {user?.role === 'admin' && <TableHead>{formatMessage('sectors.company')}</TableHead>}
                  <TableHead>{formatMessage('sectors.status')}</TableHead>
                  <TableHead className="text-right">{formatMessage('sectors.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sectors.length > 0 ? (
                  sectors.map((sector: Sector) => (
                    <TableRow key={sector.id}>
                      <TableCell>{sector.name}</TableCell>
                      <TableCell>{sector.description || '-'}</TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <span className="text-sm text-neutral-600">{getCompanyName(sector.company_id)}</span>
                        </TableCell>
                      )}
                      <TableCell>
                        {sector.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {formatMessage('sectors.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {formatMessage('sectors.inactive')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(sector)} title={formatMessage('common.edit')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(sector)} title={formatMessage('sectors.delete_action')}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={colSpanCount} className="text-center py-10 text-neutral-500">
                      {formatMessage('sectors.no_data')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                {formatMessage('sectors.showing', {
                  start: (pagination.page - 1) * pagination.limit + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                })}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  {formatMessage('common.previous')}
                </Button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (pagination.totalPages > 5) {
                    if (pagination.page <= 3) pageNum = i + 1;
                    else if (pagination.page >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                    else pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={pagination.page === pageNum ? 'bg-primary text-white hover:bg-primary/90' : ''}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => setCurrentPage((p) => p + 1)}>
                  {formatMessage('common.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
