import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserX, UserCheck, UserCog } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from '@/i18n';
import { Official } from '@shared/schema';
import { Badge } from "@/components/ui/badge";

interface ToggleStatusOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  official: Official | null;
  onStatusChanged?: () => void;
}

export function ToggleStatusOfficialDialog({ open, onOpenChange, official, onStatusChanged }: ToggleStatusOfficialDialogProps) {
  const { toast } = useToast();
  const { formatMessage } = useI18n();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!official?.id) return;
      const res = await apiRequest('PATCH', `/api/officials/${official.id}/toggle-active`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
      setProcessing(false);
      onOpenChange(false);
      if (onStatusChanged) onStatusChanged();
      toast({
        title: data.is_active ? formatMessage('officials.toggle_status_dialog.activated_success') : formatMessage('officials.toggle_status_dialog.deactivated_success'),
        description: data.is_active 
          ? formatMessage('officials.toggle_status_dialog.activated_desc')
          : formatMessage('officials.toggle_status_dialog.deactivated_desc'),
      });
    },
    onError: (error) => {
      setProcessing(false);
      toast({
        title: formatMessage('officials.toggle_status_dialog.error_title'),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleToggleStatus = () => {
    setProcessing(true);
    toggleStatusMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {official && official.is_active ? formatMessage('officials.toggle_status_dialog.deactivate_title') : formatMessage('officials.toggle_status_dialog.activate_title')}
          </DialogTitle>
          <DialogDescription>
            {official && official.is_active ? 
              formatMessage('officials.toggle_status_dialog.deactivate_description') :
              formatMessage('officials.toggle_status_dialog.activate_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center p-3 rounded-md border bg-neutral-50 mb-4">
            <div className="mr-3">
              <UserCog className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">{official?.name}</p>
              <p className="text-sm text-neutral-500">{official?.email}</p>
            </div>
          </div>
          
          {official && official.departments && official.departments.length > 0 && (
            <div className="mb-4">
              <p className='text-sm font-medium mb-1'>{formatMessage('officials.toggle_status_dialog.departments')}</p>
              <div className="flex flex-wrap gap-1">
                {official.departments.map((dept, index) => {
                  // Se dept é um objeto com propriedade 'department', pegamos essa propriedade
                  // Se não, assumimos que dept é uma string diretamente
                  const departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                    ? (dept as any).department
                    : dept;
                    
                  return (
                    <Badge key={index} variant="outline" className="capitalize">
                      {String(departmentValue)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          
          <p className="text-sm text-neutral-600 mb-6">
            {official && official.is_active ? 
              formatMessage('officials.toggle_status_dialog.deactivate_warning') :
              formatMessage('officials.toggle_status_dialog.activate_warning')}
          </p>
        </div>
        
        <DialogFooter className="flex space-x-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {formatMessage('officials.toggle_status_dialog.cancel')}
          </Button>
          <Button 
            onClick={handleToggleStatus}
            variant={official && official.is_active ? "destructive" : "default"}
            className={official && official.is_active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
            disabled={processing}
          >
            {official && official.is_active ? (
              <>
                <UserX className="h-4 w-4 mr-2" />
                {processing ? formatMessage('officials.toggle_status_dialog.deactivating') : formatMessage('officials.toggle_status_dialog.deactivate')}
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                {processing ? formatMessage('officials.toggle_status_dialog.activating') : formatMessage('officials.toggle_status_dialog.activate')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
