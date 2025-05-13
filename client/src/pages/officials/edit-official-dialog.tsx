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
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Interface definida manualmente para cobrir os campos necessários
interface OfficialWithUser {
  id?: number;
  name: string;
  email: string;
  isActive: boolean;
  department?: string;
  departments?: any[]; // Usando any[] para evitar erros de tipo
  userId?: number;
  user?: {
    id?: number;
    username: string;
    email?: string;
    password?: string;
  };
}

interface EditOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  official: OfficialWithUser | null;
  onSaved?: () => void; // Callback opcional para quando o atendente for salvo
}

export function EditOfficialDialog({ open, onOpenChange, official, onSaved }: EditOfficialDialogProps) {
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
    username: '',
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
      // Garantir que official.departments seja sempre um array de strings
      let currentDepartments: string[] = [];
      if (official.departments) {
        if (Array.isArray(official.departments)) {
          // Extrair os departamentos de forma segura
          currentDepartments = [];
          
          for (const item of official.departments) {
            if (item === null || item === undefined) continue;
            
            if (typeof item === 'string') {
              currentDepartments.push(item);
            } else if (typeof item === 'object') {
              // Tratando como any para evitar erros de tipo
              const dept = (item as any).department;
              if (typeof dept === 'string') {
                currentDepartments.push(dept);
              }
            }
          }
        } else {
          // Tratar caso inesperado onde official.departments não é array (opcional)
          console.warn("official.departments não é um array:", official.departments);
        }
      }
      
      setFormData({
        name: official.name,
        email: official.email,
        username: official.user?.username || '',
        isActive: official.isActive,
        departments: currentDepartments // Usar o array de strings processado
      });
    }
  }, [official]);
  
  const toggleDepartment = (department: string) => {
    setFormData(prev => {
      // Trabalhar diretamente com array de strings
      const exists = prev.departments.includes(department);
      
      if (exists) {
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
      // Filtrar diretamente o array de strings
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
      handleOpenChange(false);
      // Chamar o callback se fornecido
      if (onSaved) onSaved();
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
    
    // Verificar se pelo menos um departamento foi selecionado
    if (!formData.departments || formData.departments.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Selecione pelo menos um departamento para o atendente.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se o nome de login foi fornecido
    if (!formData.username.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome de login é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    // Usar diretamente formData, pois já contém o array de strings 'departments'
    let updatedData = {
      ...formData,
      user: {
        ...(official?.user || {}),
        username: formData.username
      }
    };
    
    // Remover o username do nível principal pois ele pertence ao objeto user
    delete updatedData.username;
    
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
      updatedData.user.password = passwordData.password;
    }
    
    // Atualização com os dados corretos
    updateOfficialMutation.mutate(updatedData);
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
              <Label htmlFor="username" className="text-right">
                Login
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                  {formData.departments.map((dept: string) => {
                    const deptInfo = availableDepartments.find(d => d.value === dept);
                    return (
                      <Badge key={dept} variant="secondary" className="px-3 py-1">
                        {deptInfo?.label || dept}
                        <X 
                          className="ml-2 h-3 w-3 cursor-pointer" 
                          onClick={() => removeDepartment(dept)}
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
                              toggleDepartment(dept.value);
                              setPopoverOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDepartment(dept.value);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    // Verificar se dept.value existe no array de strings
                                    formData.departments.includes(dept.value) ? "opacity-100" : "opacity-0"
                                  )}
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
