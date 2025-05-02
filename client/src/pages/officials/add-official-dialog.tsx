import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, X, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateRandomPassword() {
  return Math.random().toString(36).slice(-8);
}

export function AddOfficialDialog({ open, onOpenChange }: AddOfficialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    departments: [] as string[],
    userId: null as number | null,
    isActive: true,
    avatarUrl: null as string | null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
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

  const createOfficialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/officials', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/officials'] });
      setSubmitting(false);
      setUserCreated(true);
      toast({
        title: "Atendente adicionado",
        description: "O atendente foi adicionado com sucesso.",
      });
    },
    onError: (error) => {
      setSubmitting(false);
      toast({
        title: "Erro ao adicionar atendente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await apiRequest('POST', '/api/users', userData);
      return res.json();
    },
    onSuccess: (data) => {
      // Após criar o usuário, criar o atendente
      createOfficialMutation.mutate({
        ...formData,
        userId: data.id
      });
    },
    onError: (error) => {
      setSubmitting(false);
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Generate a random password for the user
    const password = generateRandomPassword();
    setGeneratedPassword(password);
    
    // Create user first
    createUserMutation.mutate({
      username: formData.email,
      email: formData.email,
      name: formData.name,
      password: password,
      role: 'support',
      avatarUrl: null
    });
  };

  const handleCloseDialog = () => {
    // Reset form data when closing
    setFormData({
      name: '',
      email: '',
      departments: [],
      userId: null,
      isActive: true,
      avatarUrl: null,
    });
    setUserCreated(false);
    setGeneratedPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {!userCreated ? (
          <>
            <DialogHeader>
              <DialogTitle>Adicionar Atendente</DialogTitle>
              <DialogDescription>
                Adicione um novo membro à sua equipe de suporte.
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
                  <Label className="text-right">
                    Departamentos
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {formData.departments.map((dept) => (
                        <Badge key={dept} variant="secondary" className="gap-1">
                          {dept === 'technical' && 'Suporte Técnico'}
                          {dept === 'billing' && 'Faturamento'}
                          {dept === 'general' && 'Atendimento Geral'}
                          {dept === 'sales' && 'Vendas'}
                          {dept === 'other' && 'Outro'}
                          <button
                            type="button"
                            className="rounded-full outline-none hover:bg-neutral-200 flex items-center justify-center"
                            onClick={() => removeDepartment(dept)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {formData.departments.length === 0 && (
                        <span className="text-sm text-neutral-500">Nenhum departamento selecionado</span>
                      )}
                    </div>
                    
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className="w-full justify-between"
                        >
                          <span>Selecionar departamentos</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar departamento..." className="h-9" />
                          <CommandEmpty>Nenhum departamento encontrado.</CommandEmpty>
                          <CommandGroup>
                            {availableDepartments.map((dept) => (
                              <CommandItem
                                key={dept.value}
                                value={dept.value}
                                onSelect={() => {
                                  // Não fazer nada no onSelect
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDepartment(dept.value);
                                    }}
                                  >
                                    <Checkbox 
                                      checked={formData.departments.includes(dept.value)}
                                      className="mr-2"
                                    />
                                  </div>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDepartment(dept.value);
                                    }}
                                  >
                                    {dept.label}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adicionando..." : "Adicionar Atendente"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <CheckCircle className="mr-2 h-6 w-6 text-green-600" />
                Atendente Adicionado
              </DialogTitle>
              <DialogDescription>
                O atendente foi adicionado com sucesso.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="mb-4">
                <p className="font-medium mb-1">Dados de Acesso:</p>
                <p><strong>Nome de Usuário:</strong> {formData.email}</p>
                <p><strong>Senha Temporária:</strong> {generatedPassword}</p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                <p className="text-amber-800 text-sm">
                  Anote a senha temporária! Ela não poderá ser recuperada depois que esta janela for fechada.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCloseDialog}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
