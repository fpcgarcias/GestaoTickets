import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Official } from '@shared/schema';
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  official: Official | null;
}

export function EditOfficialDialog({ open, onOpenChange, official }: EditOfficialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    isActive: true,
    departments: [] as string[]
  });

  const [submitting, setSubmitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Carregar departamentos disponíveis
  const { data: departmentsData } = useQuery({
    queryKey: ["/api/settings/departments"],
  });

  // Departamentos disponíveis para seleção
  const availableDepartments = [
    { value: "technical", label: "Suporte Técnico" },
    { value: "billing", label: "Faturamento" },
    { value: "general", label: "Atendimento Geral" },
    { value: "sales", label: "Vendas" },
    { value: "other", label: "Outro" }
  ];

  // Carregar dados do atendente quando o componente abrir
  useEffect(() => {
    if (official) {
      setFormData({
        name: official.name,
        email: official.email,
        isActive: official.isActive,
        // Se o oficial tiver um único departamento definido, convertemos para array
        departments: official.departments 
          ? Array.isArray(official.departments) 
            ? official.departments as string[]
            : [official.department] 
          : []
      });
    }
  }, [official]);
  
  const toggleDepartment = (department: string) => {
    setFormData(prev => {
      if (prev.departments.includes(department)) {
        return {
          ...prev,
          departments: prev.departments.filter(d => d !== department)
        };
      } else {
        return {
          ...prev,
          departments: [...prev.departments, department]
        };
      }
    });
  };
  
  const removeDepartment = (department: string) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.filter(d => d !== department)
    }));
  };

  const updateOfficialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/officials/${official?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
      setSubmitting(false);
      onOpenChange(false);
      toast({
        title: "Atendente atualizado",
        description: "As informações do atendente foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      setSubmitting(false);
      toast({
        title: "Erro ao atualizar atendente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    updateOfficialMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Atendente</DialogTitle>
          <DialogDescription>
            Atualize as informações do atendente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">
                Departamento
              </Label>
              <Select 
                value={formData.department} 
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Suporte Técnico</SelectItem>
                  <SelectItem value="billing">Faturamento</SelectItem>
                  <SelectItem value="general">Atendimento Geral</SelectItem>
                  <SelectItem value="sales">Vendas</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select 
                value={formData.isActive ? "active" : "inactive"} 
                onValueChange={(value) => setFormData({ ...formData, isActive: value === "active" })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
