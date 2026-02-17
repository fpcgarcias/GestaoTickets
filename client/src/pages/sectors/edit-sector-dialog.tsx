import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Switch } from '@/components/ui/switch';

interface Sector {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  is_active: boolean;
}

interface EditSectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sector: Sector | null;
  onUpdated?: () => void;
}

export default function EditSectorDialog({ open, onOpenChange, sector, onUpdated }: EditSectorDialogProps) {
  const { toast } = useToast();
  const { formatMessage } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (sector) {
      setName(sector.name);
      setDescription(sector.description ?? '');
      setIsActive(sector.is_active);
    }
  }, [sector]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; is_active: boolean }) => {
      if (!sector) throw new Error('Setor não selecionado');
      const res = await apiRequest('PATCH', `/api/sectors/${sector.id}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao atualizar setor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      toast({
        title: formatMessage('sectors.edit_success'),
        description: formatMessage('sectors.edit_success_desc'),
        variant: 'default',
      });
      onOpenChange(false);
      onUpdated?.();
    },
    onError: (error: Error) => {
      toast({
        title: formatMessage('sectors.edit_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sector) return;
    if (!name.trim()) {
      toast({
        title: formatMessage('common.error'),
        description: formatMessage('sectors.name_required'),
        variant: 'destructive',
      });
      return;
    }
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
    });
  };

  if (!sector) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{formatMessage('sectors.edit_dialog_title')}</DialogTitle>
          <DialogDescription>{formatMessage('sectors.edit_dialog_description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">{formatMessage('sectors.name')} *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={formatMessage('sectors.name_placeholder')} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">{formatMessage('sectors.description')}</Label>
            <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={formatMessage('sectors.description_placeholder')} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="edit-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="edit-active">{formatMessage('sectors.status_active')}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{formatMessage('common.saving')}</> : formatMessage('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
