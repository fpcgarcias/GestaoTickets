import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { DialogTitle } from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TicketTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: number;
  currentDepartmentId?: number | null;
}

export const TicketTransferDialog: React.FC<TicketTransferDialogProps> = ({ open, onOpenChange, ticketId, currentDepartmentId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [departmentId, setDepartmentId] = React.useState<number | undefined>(undefined);
  const [incidentTypeId, setIncidentTypeId] = React.useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (open) {
      setDepartmentId(undefined);
      setIncidentTypeId(undefined);
      setCategoryId(undefined);
    }
  }, [open]);

  const { data: departmentsResp } = useQuery({
    queryKey: ['/api/departments', { context: 'transfer_ticket', active_only: true }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      params.append('context', 'transfer_ticket');
      const res = await fetch(`/api/departments?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      return res.json();
    },
    enabled: open,
  });
  const departments = Array.isArray(departmentsResp?.departments) ? departmentsResp.departments : Array.isArray(departmentsResp) ? departmentsResp : [];

  const { data: incidentTypesResp } = useQuery({
    queryKey: ['/api/incident-types', { department_id: departmentId, active_only: true }],
    queryFn: async () => {
      if (!departmentId) return [] as any[];
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      params.append('department_id', String(departmentId));
      const res = await fetch(`/api/incident-types?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar tipos de chamado');
      return res.json();
    },
    enabled: open && !!departmentId,
  });
  const incidentTypes = Array.isArray(incidentTypesResp?.incidentTypes) ? incidentTypesResp.incidentTypes : Array.isArray(incidentTypesResp) ? incidentTypesResp : [];

  const { data: categoriesResp } = useQuery({
    queryKey: ['/api/categories', { incident_type_id: incidentTypeId, active_only: true }],
    queryFn: async () => {
      if (!incidentTypeId) return { categories: [] };
      const params = new URLSearchParams();
      params.append('active_only', 'true');
      params.append('incident_type_id', String(incidentTypeId));
      const res = await fetch(`/api/categories?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar categorias');
      return res.json();
    },
    enabled: open && !!incidentTypeId,
  });
  const categories = Array.isArray(categoriesResp?.categories) ? categoriesResp.categories : Array.isArray(categoriesResp) ? categoriesResp : [];

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!departmentId || !incidentTypeId) throw new Error('Selecione departamento e tipo');
      const body: any = {
        department_id: departmentId,
        incident_type_id: incidentTypeId,
      };
      if (categoryId !== undefined) body.category_id = categoryId ?? null;
      const res = await apiRequest('POST', `/api/tickets/${ticketId}/transfer`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Transferência realizada', description: 'O chamado foi transferido com sucesso.' });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/status-history`] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error?.message || 'Falha ao transferir chamado', variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Chamado</DialogTitle>
          <DialogDescription>
            Selecione o departamento, tipo de chamado e categoria para transferir este ticket. O SLA será mantido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Departamento</div>
            <Select value={departmentId ? String(departmentId) : ''} onValueChange={(v) => { setDepartmentId(parseInt(v)); setIncidentTypeId(undefined); setCategoryId(undefined); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar departamento" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Tipo de Chamado</div>
            <Select disabled={!departmentId} value={incidentTypeId ? String(incidentTypeId) : ''} onValueChange={(v) => { setIncidentTypeId(parseInt(v)); setCategoryId(undefined); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {incidentTypes.map((it: any) => (
                  <SelectItem key={it.id} value={String(it.id)}>{it.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Categoria</div>
            <Select disabled={!incidentTypeId} value={categoryId !== undefined && categoryId !== null ? String(categoryId) : ''} onValueChange={(v) => setCategoryId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => transferMutation.mutate()} disabled={!departmentId || !incidentTypeId || transferMutation.isPending}>
              {transferMutation.isPending ? 'Transferindo...' : 'Transferir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


