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
  // Função wrapper para controlar o fechamento do diálogo e limpar estados
  const handleOpenChange = (isOpen: boolean) => {
    // Se estiver fechando o diálogo
    if (!isOpen) {
      // Limpar os estados de senha
      setShowPasswordForm(false);
      setPasswordData({ password: '', confirmPassword: '' });
      setPasswordError('');
    }
    // Chamar o manipulador original
    onOpenChange(isOpen);
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    isActive: true,
    departments: [] as string[]
  });

  // Estado para o formulário de senha
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState('');

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
        // Se o oficial tiver departamentos definidos, usamos eles
        departments: official.departments 
          ? Array.isArray(official.departments) 
            ? official.departments as string[]
            : [] 
          : []
      });
    }
  }, [official]);
  
  const toggleDepartment = (department: string) => {
    setFormData(prev => {
      // Verificar se o departamento já existe na lista
      const exists = prev.departments.some(d => {
        // Se for um objeto com propriedade 'department'
        if (typeof d === 'object' && d !== null && 'department' in d) {
          return d.department === department;
        }
        // Se for uma string
        return d === department;
      });
      
      if (exists) {
        // Filtrar o departamento (tanto se for string quanto objeto)
        return {
          ...prev,
          departments: prev.departments.filter(d => {
            if (typeof d === 'object' && d !== null && 'department' in d) {
              return d.department !== department;
            }
            return d !== department;
          })
        };
      } else {
        // Adicionar o novo departamento como string
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
      departments: prev.departments.filter(d => {
        // Se for um objeto com propriedade 'department'
        if (typeof d === 'object' && d !== null && 'department' in d) {
          return d.department !== department;
        }
        // Se for uma string
        return d !== department;
      })
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
      handleOpenChange(false);
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

  // Adicionar método para lidar com o toggle do formulário de senha
  const togglePasswordForm = () => {
    setPasswordData({ password: '', confirmPassword: '' }); // Limpar campos de senha
    setPasswordError(''); // Limpar erros de senha
    setShowPasswordForm(!showPasswordForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Verificar se há senha para atualizar e se as senhas correspondem
    if (showPasswordForm) {
      // Verificar se as senhas correspondem
      if (passwordData.password !== passwordData.confirmPassword) {
        setPasswordError('As senhas não correspondem');
        setSubmitting(false);
        return;
      }
      
      // Verificar se a senha tem pelo menos 6 caracteres
      if (passwordData.password.length < 6) {
        setPasswordError('A senha deve ter pelo menos 6 caracteres');
        setSubmitting(false);
        return;
      }
      
      // Se chegou aqui, a senha é válida, adicionar ao formData
      updateOfficialMutation.mutate({
        ...formData,
        password: passwordData.password
      });
    } else {
      // Atualização normal sem senha
      updateOfficialMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right mt-2">Departamentos</Label>
              <div className="col-span-3 space-y-4">
                {/* Exibir departamentos selecionados */}
                <div className="flex flex-wrap gap-2">
                  {/* Exibir departamentos */}
                  {formData.departments.map((dept, index) => {
                    // Normalizamos o valor do departamento
                    const departmentValue = typeof dept === 'object' && dept !== null && 'department' in dept
                      ? dept.department
                      : dept;
                      
                    const deptInfo = availableDepartments.find(d => d.value === departmentValue);
                    return (
                      <Badge key={index} variant="secondary" className="px-3 py-1">
                        {deptInfo?.label || departmentValue}
                        <X 
                          className="ml-2 h-3 w-3 cursor-pointer" 
                          onClick={() => removeDepartment(departmentValue)}
                        />
                      </Badge>
                    );
                  })}
                </div>
                
                {/* Seletor de departamentos */}
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      type="button"
                    >
                      <span>Selecionar departamentos</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Pesquisar departamento..." />
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
                                  checked={formData.departments.some(d => {
                                    // Se for um objeto com propriedade 'department'
                                    if (typeof d === 'object' && d !== null && 'department' in d) {
                                      return d.department === dept.value;
                                    }
                                    // Se for uma string
                                    return d === dept.value;
                                  })}
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

            {/* Botão para mostrar/ocultar formulário de alteração de senha */}
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">
                <Label htmlFor="changePassword" className="cursor-pointer select-none">
                  Senha
                </Label>
              </div>
              <div className="col-span-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={togglePasswordForm}
                  className="w-full justify-start"
                >
                  {showPasswordForm ? "Cancelar alteração de senha" : "Alterar senha"}
                </Button>
              </div>
            </div>

            {/* Formulário de alteração de senha (condicional) */}
            {showPasswordForm && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Nova Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    className="col-span-3"
                    placeholder="Digite a nova senha"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="confirmPassword" className="text-right">
                    Confirmar
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full"
                      placeholder="Digite a senha novamente"
                    />
                    {passwordError && (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
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
