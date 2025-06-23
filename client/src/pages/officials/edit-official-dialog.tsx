import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Official } from '@shared/schema';
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Estendendo a interface Official para incluir o user com username
interface OfficialWithUser extends Official {
  user?: {
    id: number;
    username: string;
    email?: string;
  };
}

interface Company {
  id: number;
  name: string;
}

interface FormData {
  name: string;
  email: string;
  username: string;
  isActive: boolean;
  departments: string[];
  supervisor_id: number | null;
  manager_id: number | null;
  company_id: number | null;
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    username: '',
    isActive: true,
    departments: [],
    supervisor_id: null,
    manager_id: null,
    company_id: null,
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

  // Buscar lista de empresas (apenas para admin)
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === 'admin', // Apenas buscar empresas se o usuário for admin
  });

  // Carregar departamentos disponíveis do banco de dados
  const { data: departmentsData } = useQuery({
    queryKey: ["/api/departments", formData.company_id],
    queryFn: async () => {
      let url = '/api/departments?active_only=true';
      
      // Se for admin e tiver empresa selecionada, filtrar por empresa
      if (user?.role === 'admin' && formData.company_id) {
        url += `&company_id=${formData.company_id}`;
      }
      
      const response = await apiRequest('GET', url);
      if (!response.ok) {
        throw new Error('Erro ao carregar departamentos');
      }
      return response.json();
    },
    enabled: user?.role !== 'admin' || formData.company_id !== null, // Para admin, só buscar se empresa estiver selecionada
  });

  // Carregar atendentes existentes para seleção de supervisor/manager
  const { data: existingOfficials = [] } = useQuery<any[]>({
    queryKey: ['/api/officials', formData.company_id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/officials');
      if (!response.ok) {
        throw new Error('Erro ao carregar atendentes');
      }
      const officials = await response.json();
      
      // Se for admin e tiver empresa selecionada, filtrar por empresa
      if (user?.role === 'admin' && formData.company_id) {
        return officials.filter((official: any) => official.company_id === formData.company_id);
      }
      
      return officials;
    },
    enabled: user?.role !== 'admin' || formData.company_id !== null, // Para admin, só buscar se empresa estiver selecionada
  });

  // Mapear departamentos do banco para o formato usado no componente
  const availableDepartments = departmentsData?.map((dept: { id: number; name: string; description?: string }) => ({
    value: dept.name, // Usar o nome direto do banco
    label: dept.name,
    id: dept.id
  })) || [];

  // Carregar dados do atendente quando o componente abrir
  useEffect(() => {
    if (official) {
      // Garantir que official.departments seja sempre um array de strings
      let currentDepartments: string[] = [];
      if (official.departments) {
        if (Array.isArray(official.departments)) {
          currentDepartments = official.departments.map(d => 
            typeof d === 'object' && d !== null && 'department' in d ? d.department : d
          ).filter(d => typeof d === 'string') as string[];
        } else {
          // Tratar caso inesperado onde official.departments não é array (opcional)
          console.warn("official.departments não é um array:", official.departments);
        }
      }
      
      setFormData({
        name: official.name,
        email: official.email,
        username: official.user?.username || '',
        isActive: official.is_active,
        departments: currentDepartments, // Usar o array de strings processado
        supervisor_id: (official as any).supervisor_id || null,
        manager_id: (official as any).manager_id || null,
        company_id: (official as any).company_id || null,
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
    let updatedData: any = {
      name: formData.name,
      email: formData.email,
      is_active: formData.isActive,
      departments: formData.departments,
      supervisor_id: formData.supervisor_id,
      manager_id: formData.manager_id,
      company_id: formData.company_id,
      user: {
        ...(official?.user || {}),
        username: formData.username
      }
    };
    
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
      updatedData.user = {
        ...updatedData.user,
        password: passwordData.password
      };
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
              <Label htmlFor="email" className="text-right">
                Email (Login)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  email: e.target.value,
                  username: e.target.value // ✅ SINCRONIZAR USERNAME COM EMAIL
                })}
                className="col-span-3"
                placeholder="email@empresa.com"
                required
              />
            </div>
            
            {/* Campo de seleção de empresa - apenas para admin */}
            {user?.role === 'admin' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_id" className="text-right">
                  Empresa *
                </Label>
                <div className="col-span-3">
                  <Select 
                    value={formData.company_id?.toString() || ""} 
                    onValueChange={(value) => setFormData({ ...formData, company_id: value ? parseInt(value) : null })}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingCompanies ? "Carregando..." : "Selecione a empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {/* Campo de empresa para não-admin (apenas visualização) */}
            {user?.role !== 'admin' && user?.company && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_readonly" className="text-right">
                  Empresa
                </Label>
                <Input
                  id="company_readonly"
                  value={user.company.name}
                  disabled
                  className="col-span-3 bg-gray-100"
                />
              </div>
            )}
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right mt-2">Departamentos</Label>
              <div className="col-span-3 space-y-4">
                {/* Exibir departamentos selecionados */}
                <div className="flex flex-wrap gap-2">
                  {/* Exibir departamentos */}
                  {Array.isArray(formData.departments) ? formData.departments.map((dept: string) => {
                    const deptInfo = Array.isArray(availableDepartments) 
                      ? availableDepartments.find((d: { value: string; label: string; id: number }) => d.value === dept)
                      : null;
                    return (
                      <Badge key={dept} variant="secondary" className="px-3 py-1">
                        {deptInfo?.label || dept}
                        <X 
                          className="ml-2 h-3 w-3 cursor-pointer" 
                          onClick={() => removeDepartment(dept)}
                        />
                      </Badge>
                    );
                  }) : null}
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
                        {Array.isArray(availableDepartments) ? availableDepartments.map((dept: { value: string; label: string; id: number }) => (
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
                        )) : null}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="supervisor" className="text-right">
                Supervisor
              </Label>
              <div className="col-span-3">
                <Select 
                  value={formData.supervisor_id?.toString() || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar supervisor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum supervisor</SelectItem>
                    {Array.isArray(existingOfficials) ? existingOfficials
                      .filter((off: any) => {
                        // Filtrar apenas supervisores, excluindo o próprio atendente
                        return off && 
                               off.id !== official?.id && 
                               off.user && 
                               off.user.role === 'supervisor';
                      })
                      .map((off: any) => (
                        <SelectItem key={off.id} value={off.id.toString()}>
                          {off.name || 'Nome não disponível'} ({off.email || 'Email não disponível'})
                        </SelectItem>
                      )) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="manager" className="text-right">
                Manager
              </Label>
              <div className="col-span-3">
                <Select 
                  value={formData.manager_id?.toString() || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar manager (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum manager</SelectItem>
                    {Array.isArray(existingOfficials) ? existingOfficials
                      .filter((off: any) => {
                        // Filtrar apenas managers e company_admins, excluindo o próprio atendente
                        return off && 
                               off.id !== official?.id && 
                               off.user && 
                               (off.user.role === 'manager' || off.user.role === 'company_admin');
                      })
                      .map((off: any) => (
                        <SelectItem key={off.id} value={off.id.toString()}>
                          {off.name || 'Nome não disponível'} ({off.email || 'Email não disponível'})
                        </SelectItem>
                      )) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="isActive">Ativo</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked: boolean) => 
                  setFormData((prev) => ({
                    ...prev,
                    isActive: checked,
                  }))
                }
              />
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
