import React, { useState } from 'react';
import { Redirect } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Key, Pencil, AlertTriangle,
  User, UserCog, UserCheck, UserX, Shield, Save, Building2, UserPlus
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessHoursRefetchInterval } from '../../hooks/use-business-hours';
import AddPersonDialog from './add-person-dialog';
import EditPersonDialog from './edit-person-dialog';
import { useI18n } from '@/i18n';
import { getAllowedRolesToAssign } from '@/lib/people-roles';

export { getAllowedRolesToAssign };

const translatePasswordErrors = (errorCodes: string[], formatMessage: (id: string) => string): string[] => {
  return errorCodes.map(code => formatMessage(`password_validation.${code}`));
};

interface Company {
  id: number;
  name: string;
  email?: string;
  active?: boolean;
}

/** Roles que cada perfil pode atribuir (hierarquia). Deve espelhar o backend. */
export default function PeopleIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeStatusDialogOpen, setActiveStatusDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);

  const refetchInterval = useBusinessHoursRefetchInterval(30000);

  if (user?.role === 'customer') return <Redirect to="/" />;

  const handleStatusChange = (userItem: any) => {
    setSelectedUser(userItem);
    setActiveStatusDialogOpen(true);
  };

  const handleResetPassword = (userItem: any) => {
    setSelectedUser(userItem);
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setMustChangePassword(true);
    setResetPasswordDialogOpen(true);
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const handleEditUser = (userItem: any) => {
    setSelectedUser(userItem);
    setEditDialogOpen(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setCurrentPage(1);
  };

  const handleProfileFilterChange = (value: string) => {
    setProfileFilter(value);
    setCurrentPage(1);
  };

  const { data: peopleResponse, isLoading } = useQuery({
    queryKey: ['/api/people', includeInactive ? 'all' : 'active', currentPage, searchTerm, selectedCompanyId, profileFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...(includeInactive && { includeInactive: 'true' }),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCompanyId !== 'all' && user?.role === 'admin' && { company_id: selectedCompanyId }),
        ...(profileFilter !== 'all' && { profile: profileFilter }),
      });
      const res = await fetch(`/api/people?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      return res.json();
    },
    refetchInterval: refetchInterval,
  });

  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin',
    refetchInterval: refetchInterval,
  });

  const people = peopleResponse?.data || [];
  const pagination = peopleResponse?.pagination;

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}/toggle-active`, { active });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.active ? formatMessage('people.status_dialog.activated_success') : formatMessage('people.status_dialog.deactivated_success'),
        description: data.active ? formatMessage('people.status_dialog.activated_desc') : formatMessage('people.status_dialog.deactivated_desc'),
      });
      setActiveStatusDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
      if (data.user?.id != null && (data.isRequester != null || data.isOfficial != null || data.requesterData != null || data.officialData != null)) {
        queryClient.setQueriesData(
          { queryKey: ['/api/people'] },
          (old: { data?: any[]; pagination?: any } | undefined) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((p: any) =>
                p.id === data.user.id
                  ? {
                      ...p,
                      ...data.user,
                      isRequester: data.isRequester ?? p.isRequester,
                      isOfficial: data.isOfficial ?? p.isOfficial,
                      requesterData: data.requesterData !== undefined ? data.requesterData : p.requesterData,
                      officialData: data.officialData !== undefined ? data.officialData : p.officialData,
                    }
                  : p
              ),
            };
          }
        );
      }
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('people.edit_dialog_error_title'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword, mustChangePassword }: { id: number; newPassword: string; mustChangePassword: boolean }) => {
      const res = await apiRequest('PATCH', `/api/users/${id}`, {
        password: newPassword,
        must_change_password: mustChangePassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('people.reset_password_dialog.success_title'),
        description: formatMessage('people.reset_password_dialog.success_desc'),
      });
      setResetPasswordDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/people'] });
    },
    onError: (error: any) => {
      let errorMessage = error.details || error.message;
      if (error.passwordErrors && Array.isArray(error.passwordErrors)) {
        const translatedErrors = translatePasswordErrors(error.passwordErrors, formatMessage);
        errorMessage = (
          <div className="space-y-1">
            {translatedErrors.map((err: string, index: number) => (
              <div key={index} className="flex items-start">
                <span className="text-red-400 mr-2">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>
        );
      }
      toast({
        title: formatMessage('people.reset_password_dialog.error_title'),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const getRoleText = (role: string) => {
    return formatMessage(`users.roles.${role}` as any) || role;
  };

  const getCompanyName = (companyId: number | null) => {
    if (!companyId) return formatMessage('users.global_system');
    const company = companies.find(c => c.id === companyId);
    return company?.name || formatMessage('users.company_not_found');
  };

  const getAvailableRolesForEdit = () => {
    const roleOptions = [
      { value: 'admin', label: formatMessage('users.roles.admin') },
      { value: 'company_admin', label: formatMessage('users.roles.company_admin') },
      { value: 'manager', label: formatMessage('users.roles.manager') },
      { value: 'supervisor', label: formatMessage('users.roles.supervisor') },
      { value: 'support', label: formatMessage('users.roles.support') },
      { value: 'triage', label: formatMessage('users.roles.triage') },
      { value: 'quality', label: formatMessage('users.roles.quality') },
      { value: 'viewer', label: formatMessage('users.roles.viewer') },
      { value: 'customer', label: formatMessage('users.roles.customer') },
      { value: 'integration_bot', label: formatMessage('users.roles.integration_bot') },
    ];
    if (user?.role === 'admin') return roleOptions;
    if (['company_admin', 'manager', 'supervisor'].includes(user?.role || '')) {
      return roleOptions.filter(r => !['admin', 'integration_bot'].includes(r.value));
    }
    return [];
  };

  const handleToggleStatus = () => {
    if (selectedUser) {
      toggleUserStatusMutation.mutate({ id: selectedUser.id, active: !selectedUser.active });
    }
  };

  const handleResetPasswordSubmit = () => {
    if (password !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (selectedUser) {
      resetPasswordMutation.mutate({
        id: selectedUser.id,
        newPassword: password,
        mustChangePassword,
      });
    }
  };

  const colSpanCount = (user?.role === 'admin' ? 7 : 6);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{formatMessage('people.title')}</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          {formatMessage('people.add_person')}
        </Button>
      </div>

      <AddPersonDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['/api/people'] })}
      />

      <EditPersonDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        person={selectedUser}
        onUpdated={() => {
          setEditDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/people'] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{formatMessage('people.management_title')}</CardTitle>
          <CardDescription>{formatMessage('people.management_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
              <Input
                placeholder={formatMessage('people.search_placeholder')}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select value={profileFilter} onValueChange={handleProfileFilterChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage('people.filter_all')}</SelectItem>
                  <SelectItem value="requester">{formatMessage('people.filter_requesters')}</SelectItem>
                  <SelectItem value="official">{formatMessage('people.filter_officials')}</SelectItem>
                  <SelectItem value="no_profile">{formatMessage('people.filter_no_profile')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'admin' && (
              <div className="w-64">
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage('users.filter_by_company')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{formatMessage('users.all_companies')}</SelectItem>
                    {companies.filter(c => c.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch id="includeInactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="includeInactive">{formatMessage('users.include_inactive')}</Label>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{formatMessage('people.name')}</TableHead>
                  <TableHead>{formatMessage('people.email')}</TableHead>
                  <TableHead>{formatMessage('people.profile')}</TableHead>
                  <TableHead>{formatMessage('people.profiles_column')}</TableHead>
                  {user?.role === 'admin' && <TableHead>{formatMessage('people.company')}</TableHead>}
                  <TableHead>{formatMessage('people.status')}</TableHead>
                  <TableHead className="text-right">{formatMessage('people.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {user?.role === 'admin' && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : people.length > 0 ? (
                  people.map((userItem: any) => (
                    <TableRow key={userItem.id} className={!userItem.active ? "opacity-60" : ""}>
                      <TableCell>{userItem.name}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {userItem.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> :
                            userItem.role === 'support' ? <UserCog className="h-3 w-3 mr-1" /> :
                              <User className="h-3 w-3 mr-1" />}
                          {getRoleText(userItem.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {userItem.isRequester && (
                            <Badge variant="secondary" className="text-xs">
                              {formatMessage('people.profile_requester')}
                            </Badge>
                          )}
                          {userItem.isOfficial && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {formatMessage('people.profile_official')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {user?.role === 'admin' && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-neutral-500" />
                            <span className="text-sm text-neutral-600">{getCompanyName(userItem.company_id)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {(userItem.active === undefined || userItem.active) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {formatMessage('people.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {formatMessage('people.inactive')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditUser(userItem)} title={formatMessage('people.edit_user')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleResetPassword(userItem)} title={formatMessage('people.reset_password')}>
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={userItem.active ? "destructive" : "default"}
                            size="sm"
                            className={userItem.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            onClick={() => handleStatusChange(userItem)}
                            title={userItem.active ? formatMessage('people.deactivate_user') : formatMessage('people.activate_user')}
                          >
                            {userItem.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={colSpanCount} className="text-center py-10 text-neutral-500">
                      {searchTerm || selectedCompanyId !== 'all' || profileFilter !== 'all'
                        ? formatMessage('people.no_users_filtered')
                        : formatMessage('people.no_users_found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                {formatMessage('people.showing_results', {
                  start: ((pagination.page - 1) * pagination.limit) + 1,
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                })}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => pagination.hasPrev && setCurrentPage(pagination.page - 1)}>
                  {formatMessage('people.previous')}
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
                      className={pagination.page === pageNum ? "bg-primary text-white hover:bg-primary/90" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => pagination.hasNext && setCurrentPage(pagination.page + 1)}>
                  {formatMessage('people.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activeStatusDialogOpen} onOpenChange={setActiveStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.active ? formatMessage('people.status_dialog.deactivate') : formatMessage('people.status_dialog.activate')}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.active
                ? formatMessage('people.status_dialog.deactivated_desc')
                : formatMessage('people.status_dialog.activated_desc')}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600" /> :
                    selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600" /> :
                      <User className="h-5 w-5 text-neutral-600" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveStatusDialogOpen(false)}>{formatMessage('people.status_dialog.cancel')}</Button>
            <Button
              onClick={handleToggleStatus}
              variant={selectedUser?.active ? "destructive" : "default"}
              className={selectedUser?.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
            >
              {selectedUser?.active ? formatMessage('people.status_dialog.deactivate') : formatMessage('people.status_dialog.activate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>Informe a nova senha para o usuário.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
                <div className="mr-3">
                  {selectedUser.role === 'admin' ? <Shield className="h-5 w-5 text-blue-600" /> :
                    selectedUser.role === 'support' ? <UserCog className="h-5 w-5 text-amber-600" /> :
                      <User className="h-5 w-5 text-neutral-600" />}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="must_change_password"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                  />
                  <Label htmlFor="must_change_password" className="text-sm">Forçar troca de senha no próximo login</Label>
                </div>
                {passwordError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                    {passwordError}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPasswordSubmit}>Redefinir Senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
