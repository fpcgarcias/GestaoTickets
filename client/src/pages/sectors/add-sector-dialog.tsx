import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useI18n } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Company {
  id: number;
  name: string;
}

interface AddSectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function AddSectorDialog({ open, onOpenChange, onCreated }: AddSectorDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(user?.company_id ?? user?.company?.id ?? null);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      return res.json();
    },
    enabled: user?.role === 'admin' && open,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; company_id?: number }) => {
      const res = await apiRequest('POST', '/api/sectors', payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao criar setor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      toast({
        title: formatMessage('sectors.add_success'),
        description: formatMessage('sectors.add_success_desc'),
        variant: 'default',
      });
      handleClose();
      onCreated?.();
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('sectors.add_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    setCompanyId(user?.company_id ?? user?.company?.id ?? null);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: formatMessage('common.error'),
        description: formatMessage('sectors.name_required'),
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      company_id: user?.role === 'admin' && companyId ? companyId : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{formatMessage('sectors.add_dialog_title')}</DialogTitle>
          <DialogDescription>{formatMessage('sectors.add_dialog_description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {user?.role === 'admin' && (
            <div className="grid gap-2">
              <Label>{formatMessage('sectors.company')}</Label>
              <Select
                value={companyId ? String(companyId) : 'none'}
                onValueChange={(v) => setCompanyId(v === 'none' ? null : parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage('sectors.select_company')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{formatMessage('sectors.no_company')}</SelectItem>
                  {companies.filter((c: Company) => c.id).map((c: Company) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name">{formatMessage('sectors.name')} *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={formatMessage('sectors.name_placeholder')} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">{formatMessage('sectors.description')}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={formatMessage('sectors.description_placeholder')} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {formatMessage('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{formatMessage('common.saving')}</> : formatMessage('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
