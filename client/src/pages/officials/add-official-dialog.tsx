import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, X, ChevronsUpDown, Copy } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn, generateSecurePassword } from "@/lib/utils";

interface AddOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (official: any) => void;
}

interface Company {
  id: number;
  name: string;
}

export function AddOfficialDialog({ open, onOpenChange, onCreated }: AddOfficialDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    departments: [] as string[],
    userId: null as number | null,
    isActive: true,
    avatarUrl: null as string | null,
    supervisor_id: null as number | null,
    manager_id: null as number | null,
    company_id: user?.company?.id || null as number | null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
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
    value: dept.name,
    label: dept.name,
    id: dept.id
  })) || [];
  
  const toggleDepartment = (department: string) => {
    setFormData(prev => {
      if (prev.departments.includes(department)) {
        return {
          ...prev,
          departments: prev.departments.filter((d: string) => d !== department)
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
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao criar atendente');
      }
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

  const createSupportUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      console.log('Enviando dados para criar usuário de suporte:', JSON.stringify(userData, null, 2));
      const res = await apiRequest('POST', '/api/support-users', userData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || errorData.error || 'Erro ao criar usuário e atendente');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSubmitting(false);
      
      // Mostrar mensagem de sucesso e senha gerada
      toast({
        title: "Atendente criado com sucesso",
        description: `Senha para primeiro acesso: ${generatedPassword}`,
        variant: "default",
        duration: 10000, // 10 segundos para copiar a senha
      });
      
      // Fechar o diálogo e resetar o formulário
      handleCloseDialog();
      onCreated && onCreated(data.official);
    },
    onError: (error) => {
      setSubmitting(false);
      toast({
        title: "Erro ao criar atendente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar se pelo menos um departamento foi selecionado
    if (!formData.departments.length) {
      toast({
        title: "Erro de validação",
        description: "Selecione pelo menos um departamento para o atendente.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se o email foi fornecido (não precisa mais verificar username separadamente)
    if (!formData.email.trim()) {
      toast({
        title: "Erro de validação",
        description: "O email é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se a empresa foi selecionada (apenas para admin)
    if (user?.role === 'admin' && !formData.company_id) {
      toast({
        title: "Erro de validação",
        description: "Selecione uma empresa para o atendente.",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    // Generate a random password for the user
    const password = generateSecurePassword();
    setGeneratedPassword(password);
    
    // Criar o usuário e atendente em uma única operação
    // IMPORTANTE: usar email como username para manter consistência
    createSupportUserMutation.mutate({
      username: formData.email, // ✅ USAR EMAIL COMO USERNAME
      email: formData.email,
      password: password,
      name: formData.name,
      departments: formData.departments,
      userDepartments: formData.departments,
      isActive: true,
      avatarUrl: null,
      supervisor_id: formData.supervisor_id,
      manager_id: formData.manager_id,
      company_id: formData.company_id,
    });
  };

  const handleCloseDialog = () => {
    // Reset form data when closing
    setFormData({
      name: '',
      email: '',
      username: '', // Manter por compatibilidade, mas não usar
      departments: [],
      userId: null,
      isActive: true,
      avatarUrl: null,
      supervisor_id: null,
      manager_id: null,
      company_id: null,
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
                    Email (Login)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">
                    Departamentos
                  </Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Array.isArray(formData.departments) ? formData.departments.map((dept: string) => {
                        const departmentInfo = Array.isArray(availableDepartments)
                          ? availableDepartments.find((d: { value: string; label: string; id: number }) => d.value === dept)
                          : null;
                        return (
                          <Badge key={dept} variant="secondary" className="gap-1">
                            {departmentInfo?.label || dept}
                            <button
                              type="button"
                              className="rounded-full outline-none hover:bg-neutral-200 flex items-center justify-center"
                              onClick={() => removeDepartment(dept)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      }) : null}
                      {(!Array.isArray(formData.departments) || formData.departments.length === 0) && (
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
                            {Array.isArray(availableDepartments) ? availableDepartments.map((dept: { value: string; label: string; id: number }) => (
                              <CommandItem
                                key={dept.value}
                                value={dept.value}
                                onSelect={() => {
                                  // Selecionar departamento quando item for clicado
                                  toggleDepartment(dept.value);
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
                          .filter((official: any) => {
                            // Filtrar apenas supervisores
                            return official && 
                                   official.user && 
                                   official.user.role === 'supervisor';
                          })
                          .map((official: any) => (
                            <SelectItem key={official.id} value={official.id.toString()}>
                              {official.name || 'Nome não disponível'} ({official.email || 'Email não disponível'})
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
                          .filter((official: any) => {
                            // Filtrar apenas managers e company_admins
                            return official && 
                                   official.user && 
                                   (official.user.role === 'manager' || official.user.role === 'company_admin');
                          })
                          .map((official: any) => (
                            <SelectItem key={official.id} value={official.id.toString()}>
                              {official.name || 'Nome não disponível'} ({official.email || 'Email não disponível'})
                            </SelectItem>
                          )) : null}
                      </SelectContent>
                    </Select>
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
                <p><strong>Nome de Usuário (Login):</strong> {formData.email}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p className="flex items-center gap-2">
                  <strong>Senha Temporária:</strong> {generatedPassword}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      toast({
                        title: "Senha copiada",
                        description: "A senha foi copiada para a área de transferência.",
                        duration: 3000,
                      });
                    }}
                    className="h-6 w-6"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </p>
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
