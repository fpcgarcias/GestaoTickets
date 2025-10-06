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
import { useI18n } from '@/i18n';
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
  must_change_password: boolean;
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
  const { formatMessage } = useI18n();
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
    must_change_password: false,
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
  const { data: departmentsResponse } = useQuery({
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

  // Extrair departamentos da estrutura paginada
  const departmentsData = departmentsResponse?.departments || departmentsResponse?.data || departmentsResponse || [];

  // Carregar atendentes existentes para seleção de supervisor/manager
  const { data: existingOfficials = [] } = useQuery<any[]>({
    queryKey: ['/api/officials', formData.company_id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/officials?limit=1000');
      if (!response.ok) {
        throw new Error('Erro ao carregar atendentes');
      }
      const data = await response.json();
      const officials = data.data || data; // Compatibilidade com novo formato
      
      // Se for admin e tiver empresa selecionada, filtrar por empresa
      if (user?.role === 'admin' && formData.company_id) {
        return officials.filter((official: any) => official.company_id === formData.company_id);
      }
      
      return officials;
    },
    enabled: user?.role !== 'admin' || formData.company_id !== null, // Para admin, só buscar se empresa estiver selecionada
  });

  // Utilitário: interseção de departamentos do oficial com os selecionados
  const hasDepartmentIntersection = (official: any): boolean => {
    try {
      const selected = Array.isArray(formData.departments) ? formData.departments : [];
      if (selected.length === 0) return true; // sem filtro se nada selecionado
      const offDepts: string[] = Array.isArray(official?.departments) ? official.departments : [];
      if (offDepts.length === 0) return false;
      const set = new Set(offDepts.map((d) => (typeof d === 'string' ? d : String(d))));
      return selected.some((d) => set.has(d));
    } catch {
      return false;
    }
  };

  // Mapear departamentos do banco para o formato usado no componente
  const availableDepartments = Array.isArray(departmentsData) ? departmentsData.map((dept: { id: number; name: string; description?: string }) => ({
    value: dept.name, // Usar o nome direto do banco
    label: dept.name,
    id: dept.id
  })) : [];

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
        username: official.user?.username || official.email,
        isActive: official.is_active,
        departments: currentDepartments, // Usar o array de strings processado
        supervisor_id: (official as any).supervisor_id || null,
        manager_id: (official as any).manager_id || null,
        company_id: (official as any).company_id || null,
        must_change_password: false,
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
        title: formatMessage('officials.edit_official_dialog.updated_title'),
        description: formatMessage('officials.edit_official_dialog.updated_desc'),
      });
    },
    onError: (error) => {
      setSubmitting(false);
      toast({
        title: formatMessage('officials.edit_official_dialog.error_title'),
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
        title: formatMessage('officials.edit_official_dialog.validation_error'),
        description: formatMessage('officials.edit_official_dialog.validation_departments_required'),
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
        username: formData.email // Sempre usar o email como username
      }
    };
    
    // Verificar se há senha para atualizar e se as senhas correspondem
    if (showPasswordForm) {
      // Verificar se as senhas correspondem
      if (passwordData.password !== passwordData.confirmPassword) {
        setPasswordError(formatMessage('officials.edit_official_dialog.password_mismatch'));
        setSubmitting(false);
        return;
      }
      
      // Verificar se a senha tem pelo menos 6 caracteres
      if (passwordData.password.length < 6) {
        setPasswordError(formatMessage('officials.edit_official_dialog.password_min_length'));
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
          <DialogTitle>{formatMessage('officials.edit_official_dialog.title')}</DialogTitle>
          <DialogDescription>
            {formatMessage('officials.edit_official_dialog.description')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                {formatMessage('officials.edit_official_dialog.name')}
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
                {formatMessage('officials.edit_official_dialog.email')}
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
                placeholder={formatMessage('officials.edit_official_dialog.email_placeholder')}
                required
              />
            </div>
            
            {/* Campo de seleção de empresa - apenas para admin */}
            {user?.role === 'admin' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_id" className="text-right">
                  {formatMessage('officials.edit_official_dialog.company')} *
                </Label>
                <div className="col-span-3">
                  <Select 
                    value={formData.company_id?.toString() || ""} 
                    onValueChange={(value) => setFormData({ ...formData, company_id: value ? parseInt(value) : null })}
                    disabled={isLoadingCompanies}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingCompanies ? formatMessage('officials.edit_official_dialog.loading_companies') : formatMessage('officials.edit_official_dialog.company_placeholder')} />
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
                  {formatMessage('officials.edit_official_dialog.company')}
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
              <Label className="text-right mt-2">{formatMessage('officials.edit_official_dialog.departments')}</Label>
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
                      <span>{formatMessage('officials.edit_official_dialog.departments_placeholder')}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={formatMessage('officials.edit_official_dialog.search_department')} />
                      <CommandEmpty>{formatMessage('officials.edit_official_dialog.no_departments')}</CommandEmpty>
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
                {formatMessage('officials.edit_official_dialog.supervisor')}
              </Label>
              <div className="col-span-3">
                {(user?.role === 'admin' || user?.role === 'company_admin') ? (
                  <Select 
                    value={formData.supervisor_id?.toString() || "none"} 
                    onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? null : parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('officials.edit_official_dialog.supervisor_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{formatMessage('officials.edit_official_dialog.no_supervisor')}</SelectItem>
                      {Array.isArray(existingOfficials) ? existingOfficials
                        .filter((off: any) => {
                          return off && off.id !== official?.id && off.user && off.user.role === 'supervisor' && hasDepartmentIntersection(off);
                        })
                        .map((off: any) => (
                          <SelectItem key={off.id} value={off.id.toString()}>
                            {off.name || 'Nome não disponível'} ({off.email || 'Email não disponível'})
                          </SelectItem>
                        )) : null}
                    </SelectContent>
                  </Select>
                ) : (
                  (() => {
                    const supervisor = existingOfficials.find((off: any) => off.id === formData.supervisor_id);
                    return (
                      <Input
                        value={supervisor ? `${supervisor.name} (${supervisor.email})` : 'Nenhum'}
                        disabled
                        className="bg-gray-100"
                      />
                    );
                  })()
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="manager" className="text-right">
                {formatMessage('officials.edit_official_dialog.manager')}
              </Label>
              <div className="col-span-3">
                {(user?.role === 'admin' || user?.role === 'company_admin') ? (
                  <Select 
                    value={formData.manager_id?.toString() || "none"} 
                    onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? null : parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage('officials.edit_official_dialog.manager_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{formatMessage('officials.edit_official_dialog.no_manager')}</SelectItem>
                      {Array.isArray(existingOfficials) ? existingOfficials
                        .filter((off: any) => {
                          return off && off.id !== official?.id && off.user && (off.user.role === 'manager' || off.user.role === 'company_admin') && hasDepartmentIntersection(off);
                        })
                        .map((off: any) => (
                          <SelectItem key={off.id} value={off.id.toString()}>
                            {off.name || 'Nome não disponível'} ({off.email || 'Email não disponível'})
                          </SelectItem>
                        )) : null}
                    </SelectContent>
                  </Select>
                ) : (
                  (() => {
                    const manager = existingOfficials.find((off: any) => off.id === formData.manager_id);
                    return (
                      <Input
                        value={manager ? `${manager.name} (${manager.email})` : 'Nenhum'}
                        disabled
                        className="bg-gray-100"
                      />
                    );
                  })()
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                {formatMessage('officials.edit_official_dialog.active')}
              </Label>
              <div className="col-span-3">
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
            </div>

            {/* Botão para mostrar/ocultar formulário de alteração de senha */}
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right">
                <Label htmlFor="changePassword" className="cursor-pointer select-none">
                  {formatMessage('officials.edit_official_dialog.password')}
                </Label>
              </div>
              <div className="col-span-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={togglePasswordForm}
                  className="w-full justify-start"
                >
                  {showPasswordForm ? formatMessage('officials.edit_official_dialog.cancel_password_change') : formatMessage('officials.edit_official_dialog.change_password')}
                </Button>
              </div>
            </div>

            {/* Formulário de alteração de senha (condicional) */}
            {showPasswordForm && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    {formatMessage('officials.edit_official_dialog.new_password')}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    className="col-span-3"
                    placeholder={formatMessage('officials.edit_official_dialog.new_password_placeholder')}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="confirmPassword" className="text-right">
                    {formatMessage('officials.edit_official_dialog.confirm_password')}
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full"
                      placeholder={formatMessage('officials.edit_official_dialog.confirm_password_placeholder')}
                    />
                    {passwordError && (
                      <p className="text-sm text-red-500">{passwordError}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="text-right">
                    <Label htmlFor="must_change_password" className="text-sm">
                      {formatMessage('officials.edit_official_dialog.force_change')}
                    </Label>
                  </div>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox
                      id="must_change_password"
                      checked={formData.must_change_password}
                      onCheckedChange={(checked: boolean | 'indeterminate') => 
                        setFormData(prev => ({ 
                          ...prev, 
                          must_change_password: checked === true 
                        }))
                      }
                    />
                    <Label htmlFor="must_change_password" className="text-sm">
                      {formatMessage('officials.edit_official_dialog.force_password_change')}
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
              {formatMessage('officials.edit_official_dialog.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? formatMessage('officials.edit_official_dialog.saving') : formatMessage('officials.edit_official_dialog.save_changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
