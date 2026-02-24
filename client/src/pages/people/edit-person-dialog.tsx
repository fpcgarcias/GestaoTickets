import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, ChevronsUpDown, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import { getAllowedRolesToAssign, canOnlyCreateCustomer } from '@/lib/people-roles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface EditPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: any;
  onUpdated?: () => void;
}

export default function EditPersonDialog({ open, onOpenChange, person, onUpdated }: EditPersonDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: '',
    company_id: 0 as number,
    cpf: '',
    isRequester: false,
    isOfficial: false,
    phone: '',
    company: '',
    sector_id: null as number | null,
    departments: [] as string[],
    supervisor_id: null as number | null,
    manager_id: null as number | null,
    is_external: false,
    observer_official_ids: [] as number[],
  });

  useEffect(() => {
    if (person) {
      setFormData({
        name: person.name ?? '',
        email: person.email ?? '',
        username: person.username ?? '',
        password: '',
        role: person.role ?? '',
        company_id: person.company_id ?? 0,
        cpf: person.cpf ?? '',
        isRequester: !!person.isRequester,
        isOfficial: !!person.isOfficial,
        phone: person.requesterData?.phone ?? '',
        company: person.requesterData?.company ?? '',
        sector_id: person.requesterData?.sector_id ?? null,
        departments: person.officialData?.departments ?? [],
        supervisor_id: person.officialData?.supervisor_id ?? null,
        manager_id: person.officialData?.manager_id ?? null,
        is_external: person.officialData?.is_external ?? false,
        observer_official_ids: [],
      });
    }
  }, [person]);

  const officialId = person?.officialData?.id;
  const { data: visibilityGrantsData } = useQuery<{ observer_official_ids: number[] }>({
    queryKey: ['/api/officials', officialId, 'visibility-grants'],
    queryFn: async () => {
      if (!officialId) return { observer_official_ids: [] };
      const res = await apiRequest('GET', `/api/officials/${officialId}/visibility-grants`);
      if (!res.ok) return { observer_official_ids: [] };
      return res.json();
    },
    enabled: !!(open && officialId),
  });
  useEffect(() => {
    if (visibilityGrantsData?.observer_official_ids != null) {
      setFormData(prev => ({ ...prev, observer_official_ids: visibilityGrantsData.observer_official_ids }));
    }
  }, [visibilityGrantsData]);

  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin' && open,
  });

  const { data: sectorsResponse } = useQuery({
    queryKey: ['/api/sectors', formData.company_id],
    queryFn: async () => {
      let url = '/api/sectors?active_only=true&limit=500';
      if (user?.role === 'admin' && formData.company_id) url += `&company_id=${formData.company_id}`;
      const res = await apiRequest('GET', url);
      if (!res.ok) throw new Error('Erro ao carregar setores');
      return res.json();
    },
    enabled: formData.isRequester && open && (user?.role !== 'admin' || !!formData.company_id),
  });

  const sectorsData = sectorsResponse?.data || sectorsResponse || [];
  const availableSectors = Array.isArray(sectorsData)
    ? sectorsData.map((s: { id: number; name: string }) => ({ value: String(s.id), label: s.name }))
    : [];

  const { data: departmentsResponse } = useQuery({
    queryKey: ['/api/departments', formData.company_id],
    queryFn: async () => {
      let url = '/api/departments?active_only=true';
      if (user?.role === 'admin' && formData.company_id) url += `&company_id=${formData.company_id}`;
      const res = await apiRequest('GET', url);
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: formData.isOfficial && open && (user?.role !== 'admin' || !!formData.company_id),
  });

  const departmentsData = departmentsResponse?.departments || departmentsResponse?.data || departmentsResponse || [];
  const availableDepartments = Array.isArray(departmentsData)
    ? departmentsData.map((d: { id: number; name: string }) => ({ value: d.name, label: d.name, id: d.id }))
    : [];

  const selectedDepartmentIds = (formData.departments || [])
    .map((name: string) => availableDepartments.find((d: { value: string; label: string; id?: number }) => d.value === name)?.id)
    .filter((id: number | undefined) => id != null) as number[];

  const { data: officialsData = [] } = useQuery({
    queryKey: ['/api/officials', formData.company_id, selectedDepartmentIds.join(',')],
    queryFn: async () => {
      let url = '/api/officials?limit=1000';
      if (selectedDepartmentIds.length > 0) url += `&department_ids=${selectedDepartmentIds.join(',')}`;
      const res = await apiRequest('GET', url);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      const data = await res.json();
      const list = data.data || data;
      if (user?.role === 'admin' && formData.company_id) return list.filter((o: any) => o.company_id === formData.company_id);
      return list;
    },
    enabled: formData.isOfficial && open && (user?.role !== 'admin' || !!formData.company_id),
  });

  const supervisorsForDept = selectedDepartmentIds.length === 0 ? [] : (officialsData as any[]).filter((o: any) => o.user?.role === 'supervisor' && o.id !== person?.officialData?.id);
  const managersForDept = selectedDepartmentIds.length === 0 ? [] : (officialsData as any[]).filter((o: any) => o.user?.role === 'manager' && o.id !== person?.officialData?.id);
  const [observersPopoverOpen, setObserversPopoverOpen] = useState(false);
  const observersCandidates = (officialsData as any[]).filter((o: any) => o.id !== person?.officialData?.id && !(formData.observer_official_ids || []).includes(o.id));

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest('PATCH', `/api/people/${person?.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: formatMessage('people.edit_dialog.success_title'),
        description: formatMessage('people.edit_dialog.success_desc'),
        variant: 'default',
      });
      onOpenChange(false);
      onUpdated?.();
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('people.edit_dialog_error_title'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person?.id) return;
    if (!formData.name.trim()) {
      toast({ title: formatMessage('common.error'), description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast({ title: formatMessage('common.error'), description: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (formData.isOfficial && formData.departments.length === 0) {
      toast({ title: formatMessage('common.error'), description: 'Selecione ao menos um departamento para atendente', variant: 'destructive' });
      return;
    }

    const payload: any = {
      name: formData.name,
      email: formData.email,
      username: formData.username,
      role: onlyCustomer ? 'customer' : formData.role,
      company_id: formData.company_id || undefined,
      cpf: formData.cpf || undefined,
      isRequester: formData.isRequester,
      isOfficial: onlyCustomer ? false : formData.isOfficial,
      phone: formData.isRequester ? formData.phone || undefined : undefined,
      company: formData.isRequester ? formData.company || undefined : undefined,
      sector_id: formData.isRequester ? formData.sector_id ?? undefined : undefined,
      departments: formData.isOfficial ? formData.departments : undefined,
      supervisor_id: formData.isOfficial ? formData.supervisor_id : undefined,
      manager_id: formData.isOfficial ? formData.manager_id : undefined,
      is_external: formData.isOfficial ? formData.is_external : undefined,
      observer_official_ids: formData.isOfficial ? formData.observer_official_ids : undefined,
    };
    if (formData.password && formData.password.length >= 6) {
      payload.password = formData.password;
    }
    updateMutation.mutate(payload);
  };

  const toggleDepartment = (name: string) => {
    setFormData(prev =>
      prev.departments.includes(name)
        ? { ...prev, departments: prev.departments.filter(d => d !== name) }
        : { ...prev, departments: [...prev.departments, name] }
    );
  };

  const allowedRoles = getAllowedRolesToAssign(user?.role ?? '');
  const onlyCustomer = canOnlyCreateCustomer(user?.role ?? '');
  const roleOptions = [
    { value: 'admin', label: formatMessage('users.roles.admin') },
    { value: 'company_admin', label: formatMessage('users.roles.company_admin') },
    { value: 'manager', label: formatMessage('users.roles.manager') },
    { value: 'supervisor', label: formatMessage('users.roles.supervisor') },
    { value: 'support', label: formatMessage('users.roles.support') },
    { value: 'viewer', label: formatMessage('users.roles.viewer') },
    { value: 'customer', label: formatMessage('users.roles.customer') },
  ].filter(r => allowedRoles.includes(r.value) && (user?.role === 'admin' || r.value !== 'admin'));

  if (!person) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage('people.edit_dialog.title')}</DialogTitle>
          <DialogDescription>{formatMessage('people.edit_dialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label>Email *</Label>
            <Input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label>Username *</Label>
            <Input value={formData.username} onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))} required />
          </div>
          <div className="grid gap-2">
            <Label>Nova senha (deixe em branco para não alterar)</Label>
            <Input type="password" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} placeholder="Mín. 6 caracteres" minLength={6} />
          </div>
          <div className="grid gap-2">
            <Label>CPF</Label>
            <Input value={formData.cpf} onChange={e => setFormData(prev => ({ ...prev, cpf: e.target.value }))} />
          </div>
          {user?.role === 'admin' && (
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Select
                value={String(formData.company_id)}
                onValueChange={v => setFormData(prev => ({ ...prev, company_id: parseInt(v, 10) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter((c: any) => c.id).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t pt-4">
            <Label className="mb-2 block">Perfis</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="editIsRequester" checked={formData.isRequester} onCheckedChange={c => setFormData(prev => ({ ...prev, isRequester: c === true }))} />
                <Label htmlFor="editIsRequester" className="text-sm font-normal">{formatMessage('people.add_dialog.is_requester')}</Label>
              </div>
              {!onlyCustomer && (
                <div className="flex items-center space-x-2">
                  <Checkbox id="editIsOfficial" checked={formData.isOfficial} onCheckedChange={c => setFormData(prev => ({ ...prev, isOfficial: c === true }))} />
                  <Label htmlFor="editIsOfficial" className="text-sm font-normal">{formatMessage('people.add_dialog.is_official')}</Label>
                </div>
              )}
            </div>
          </div>

          {!onlyCustomer && (
            <div className="grid gap-2">
              <Label>Papel (role)</Label>
              <Select value={formData.role} onValueChange={v => setFormData(prev => ({ ...prev, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.isRequester && (
            <div className="space-y-2 border-t pt-4">
              <Label>{formatMessage('people.add_dialog.requester_fields')}</Label>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{formatMessage('people.add_dialog.phone')}</Label>
                <Input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{formatMessage('people.add_dialog.sector')}</Label>
                <Select
                  value={formData.sector_id ? String(formData.sector_id) : 'none'}
                  onValueChange={v => setFormData(prev => ({ ...prev, sector_id: v === 'none' ? null : parseInt(v, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {availableSectors.map((s: { value: string; label: string }) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!onlyCustomer && formData.isOfficial && (
            <div className="space-y-2 border-t pt-4">
              <Label>{formatMessage('people.add_dialog.official_fields')}</Label>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{formatMessage('people.add_dialog.departments')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {formData.departments.length > 0 ? `${formData.departments.length} selecionado(s)` : 'Selecione os departamentos'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar..." />
                      <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                      <CommandGroup>
                        {availableDepartments.map((d: { value: string; label: string }) => (
                          <CommandItem key={d.value} value={d.value} onSelect={() => toggleDepartment(d.value)}>
                            <Checkbox checked={formData.departments.includes(d.value)} className="mr-2" />
                            {d.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formData.departments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.departments.map(d => (
                      <Badge key={d} variant="secondary" className="flex items-center gap-1">
                        {d}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleDepartment(d)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{formatMessage('people.add_dialog.supervisor')}</Label>
                <Select
                  value={formData.supervisor_id ? String(formData.supervisor_id) : 'none'}
                  onValueChange={v => setFormData(prev => ({ ...prev, supervisor_id: v === 'none' ? null : parseInt(v, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.departments?.length === 0 ? 'Selecione os departamentos' : 'Nenhum'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {supervisorsForDept.map((off: any) => (
                      <SelectItem key={off.id} value={String(off.id)}>{off.name} ({off.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{formatMessage('people.add_dialog.manager')}</Label>
                <Select
                  value={formData.manager_id ? String(formData.manager_id) : 'none'}
                  onValueChange={v => setFormData(prev => ({ ...prev, manager_id: v === 'none' ? null : parseInt(v, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.departments?.length === 0 ? 'Selecione os departamentos' : 'Nenhum'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {managersForDept.map((off: any) => (
                      <SelectItem key={off.id} value={String(off.id)}>{off.name} ({off.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-is-external"
                    checked={formData.is_external}
                    onCheckedChange={c => setFormData(prev => ({ ...prev, is_external: c === true }))}
                  />
                  <Label htmlFor="edit-is-external" className="text-sm font-normal">{formatMessage('officials.edit_official_dialog.is_external')}</Label>
                </div>
                <p className="text-xs text-muted-foreground">{formatMessage('officials.edit_official_dialog.is_external_help')}</p>
              </div>
              {formData.is_external && (
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">{formatMessage('officials.edit_official_dialog.visibility_observers')}</Label>
                  <p className="text-xs text-muted-foreground">{formatMessage('officials.edit_official_dialog.visibility_observers_help')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(formData.observer_official_ids || []).map(id => {
                      const off = (officialsData as any[]).find((o: any) => o.id === id);
                      return off ? (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1">
                          {off.name}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, observer_official_ids: (prev.observer_official_ids || []).filter(x => x !== id) }))} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                  <Popover open={observersPopoverOpen} onOpenChange={setObserversPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        {formatMessage('officials.edit_official_dialog.add_observer')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder={formatMessage('officials.edit_official_dialog.search_official')} />
                        <CommandEmpty>{formatMessage('officials.edit_official_dialog.no_officials')}</CommandEmpty>
                        <CommandGroup>
                          {observersCandidates.map((off: any) => (
                            <CommandItem
                              key={off.id}
                              value={`${off.name} ${off.email}`}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, observer_official_ids: [...(prev.observer_official_ids || []), off.id] }));
                                setObserversPopoverOpen(false);
                              }}
                            >
                              {off.name} ({off.email})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
