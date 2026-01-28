import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, X, ChevronsUpDown, Copy, AlertTriangle, UserPlus, Link } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from '@/i18n';
import { cn, generateSecurePassword } from "@/lib/utils";

interface AddOfficialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (official: any) => void;
}

interface ExistingUser {
  id: number;
  name: string;
  email: string;
  username: string;
}

export function AddOfficialDialog({ open, onOpenChange, onCreated }: AddOfficialDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatMessage } = useI18n();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '', // Manter por compatibilidade, mas não usar
    departments: [] as string[],
    userId: null as number | null,
    isActive: true,
    avatarUrl: null as string | null,
    supervisor_id: null as number | null,
    manager_id: null as number | null,
    company_id: null as number | null,
    must_change_password: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showLinkOption, setShowLinkOption] = useState(false);
  const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);
  const [linkingUser, setLinkingUser] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Carregar empresas (apenas para admin)
  const { data: companiesData } = useQuery({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/companies');
      if (!response.ok) {
        throw new Error('Erro ao carregar empresas');
      }
      return response.json();
    },
    enabled: user?.role === 'admin',
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

  // Utilitário: checar interseção de departamentos
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
    value: dept.name,
    label: dept.name,
    id: dept.id
  })) : [];
  
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

  const createSupportUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest('POST', '/api/support-users', userData);
      return response.json();
    },
    onSuccess: (data) => {
      setSubmitting(false);
      
      if (linkingUser) {
        // Mensagem diferente para vinculação
        toast({
        title: formatMessage('officials.add_official_dialog.user_linked_success_toast'),
        description: formatMessage('officials.add_official_dialog.user_linked_desc_toast'),
          variant: "default",
        });
      } else {
        // Mostrar mensagem de sucesso com botão para copiar senha
        toast({
          title: formatMessage('officials.add_official_dialog.official_created_success'),
          description: (
            <div className="space-y-2">
              <p>{formatMessage('officials.add_official_dialog.password_for_first_access')}</p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono select-all">
                  {generatedPassword}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    toast({
                      title: formatMessage('officials.add_official_dialog.password_copied'),
                      description: formatMessage('officials.add_official_dialog.password_copied_desc'),
                      variant: "default",
                    });
                  }}
                  className="h-6 px-2"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ),
          variant: "default",
          duration: 30000, // 30 segundos para dar tempo de copiar
        });
      }
      
      // Fechar o diálogo e resetar o formulário
      handleCloseDialog();
      onCreated && onCreated(data.official);
    },
    onError: (error: any) => {
      setSubmitting(false);
      
      // Verificar se é um erro de usuário existente
      if ((error.message === "Usuário já existe" && error.suggestion === "link_existing") || 
          (error.status === 409 && error.existingUser) ||
          (error.message && error.message.includes("já existe") && error.existingUser)) {
        setExistingUser(error.existingUser);
        setShowLinkOption(true);
        
        // Mostrar o diálogo de confirmação diretamente
        setShowConfirmDialog(true);
        return;
      }
      
      toast({
        title: formatMessage('officials.add_official_dialog.error_creating_official'),
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
        title: formatMessage('officials.add_official_dialog.validation_error'),
        description: formatMessage('officials.add_official_dialog.validation_departments_required'),
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se o email foi fornecido (não precisa mais verificar username separadamente)
    if (!formData.email.trim()) {
      toast({
        title: formatMessage('officials.add_official_dialog.validation_error'),
        description: formatMessage('officials.add_official_dialog.validation_email_required'),
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se a empresa foi selecionada (apenas para admin)
    if (user?.role === 'admin' && !formData.company_id) {
      toast({
        title: formatMessage('officials.add_official_dialog.validation_error'),
        description: formatMessage('officials.add_official_dialog.validation_company_required'),
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    const password = linkingUser ? undefined : generateSecurePassword();
    if (password) {
      setGeneratedPassword(password);
    }
    
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
      must_change_password: formData.must_change_password,
      linkExistingUser: linkingUser,
    });
  };

  const handleLinkExistingUser = () => {
    if (existingUser) {
      // Mostrar diálogo de confirmação
      setShowConfirmDialog(true);
    }
  };

  const confirmLinkUser = () => {
    if (existingUser) {
      // Preencher o formulário com dados do usuário existente
      setFormData(prev => ({
        ...prev,
        name: existingUser.name,
        email: existingUser.email,
        username: existingUser.username,
      }));
      setLinkingUser(true);
      setShowLinkOption(false);
      setShowConfirmDialog(false);
    }
  };

  const handleCreateNewUser = () => {
    // Limpar o formulário e continuar com a criação normal
    setShowLinkOption(false);
    setExistingUser(null);
    setLinkingUser(false);
    setShowConfirmDialog(false);
    setFormData(prev => ({
      ...prev,
      email: '',
      name: '',
      username: '',
    }));
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
      must_change_password: true,
    });
    setUserCreated(false);
    setGeneratedPassword('');
    setShowLinkOption(false);
    setExistingUser(null);
    setLinkingUser(false);
    setShowConfirmDialog(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          {!userCreated ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {linkingUser ? formatMessage('officials.add_official_dialog.link_user_title') : formatMessage('officials.add_official_dialog.title')}
                </DialogTitle>
                <DialogDescription>
                  {linkingUser 
                    ? formatMessage('officials.add_official_dialog.link_user_description')
                    : formatMessage('officials.add_official_dialog.description')
                  }
                </DialogDescription>
              </DialogHeader>

              {/* Alerta de usuário existente */}
              {showLinkOption && existingUser && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p>{formatMessage('officials.add_official_dialog.existing_user_alert')}</p>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p><strong>{formatMessage('officials.add_official_dialog.name')}:</strong> {existingUser.name}</p>
                        <p><strong>{formatMessage('officials.add_official_dialog.email')}:</strong> {existingUser.email}</p>
                        <p><strong>Username:</strong> {existingUser.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleLinkExistingUser}
                          className="flex items-center gap-1"
                        >
                          <Link className="h-3 w-3" />
                          {formatMessage('officials.add_official_dialog.link_as_official')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleCreateNewUser}
                        >
                          {formatMessage('officials.add_official_dialog.use_different_email')}
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Alerta de vinculação ativa */}
              {linkingUser && existingUser && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <UserPlus className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="space-y-2">
                      <p className='font-semibold'>{formatMessage('officials.add_official_dialog.linking_user_alert')}</p>
                      <div className="bg-white p-2 rounded border border-green-200">
                        <p><strong>{existingUser.name}</strong></p>
                        <p className="text-sm text-gray-600">{existingUser.email}</p>
                      </div>
                      <p className="text-sm">
                        {formatMessage('officials.add_official_dialog.linking_user_description')}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      {formatMessage('officials.add_official_dialog.name')}
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="col-span-3"
                      required
                      disabled={linkingUser}
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      {formatMessage('officials.add_official_dialog.email')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="col-span-3"
                      placeholder={formatMessage('officials.add_official_dialog.email_placeholder')}
                      required
                      disabled={linkingUser}
                    />
                  </div>
                  
                  {/* Campo de seleção de empresa - apenas para admin */}
                  {user?.role === 'admin' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="company" className="text-right">
                        {formatMessage('officials.add_official_dialog.company')}
                      </Label>
                      <div className="col-span-3">
                        <Select 
                          value={formData.company_id?.toString() || ""} 
                          onValueChange={(value) => setFormData({ ...formData, company_id: value ? parseInt(value) : null })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={formatMessage('officials.add_official_dialog.company_placeholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {companiesData?.map((company: any) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">
                      {formatMessage('officials.add_official_dialog.departments')}
                    </Label>
                    <div className="col-span-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {formData.departments.length > 0
                              ? formatMessage('officials.add_official_dialog.departments_selected', { count: formData.departments.length })
                              : formatMessage('officials.add_official_dialog.departments_placeholder')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder={formatMessage('officials.add_official_dialog.departments_placeholder')} />
                            <CommandEmpty>{formatMessage('officials.add_official_dialog.departments_placeholder')}</CommandEmpty>
                            <CommandGroup>
                              {availableDepartments.map((department: {value: string, label: string, id: number}) => (
                                <CommandItem
                                  key={department.value}
                                  value={department.value}
                                  onSelect={() => toggleDepartment(department.value)}
                                >
                                  <Checkbox
                                    checked={formData.departments.includes(department.value)}
                                    className="mr-2"
                                  />
                                  {department.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                                           {/* Mostrar departamentos selecionados */}
                       {formData.departments.length > 0 && (
                         <div className="flex flex-wrap gap-1 mt-2">
                           {formData.departments.map((department: string) => (
                             <Badge key={department} variant="secondary" className="flex items-center gap-1">
                               {department}
                               <X 
                                 className="h-3 w-3 cursor-pointer" 
                                 onClick={() => removeDepartment(department)}
                               />
                             </Badge>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="supervisor" className="text-right">
                      {formatMessage('officials.add_official_dialog.supervisor')}
                    </Label>
                    <div className="col-span-3">
                      <Select 
                        value={formData.supervisor_id?.toString() || "none"} 
                        onValueChange={(value) => setFormData({ ...formData, supervisor_id: value === "none" ? null : parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formatMessage('officials.add_official_dialog.supervisor_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{formatMessage('officials.add_official_dialog.no_supervisor')}</SelectItem>
                          {Array.isArray(existingOfficials) ? existingOfficials
                            .filter((off: any) => {
                              // Filtrar apenas supervisores dos departamentos selecionados
                              return off && off.user && off.user.role === 'supervisor' && hasDepartmentIntersection(off);
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
                      {formatMessage('officials.add_official_dialog.manager')}
                    </Label>
                    <div className="col-span-3">
                      <Select 
                        value={formData.manager_id?.toString() || "none"} 
                        onValueChange={(value) => setFormData({ ...formData, manager_id: value === "none" ? null : parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formatMessage('officials.add_official_dialog.manager_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{formatMessage('officials.add_official_dialog.no_manager')}</SelectItem>
                          {Array.isArray(existingOfficials) ? existingOfficials
                            .filter((off: any) => {
                              // Filtrar apenas managers e company_admins dos departamentos selecionados
                              return off && off.user && (off.user.role === 'manager' || off.user.role === 'company_admin') && hasDepartmentIntersection(off);
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
                </div>
                
                <div className="flex items-center space-x-2">
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
                    {formatMessage('officials.add_official_dialog.force_password_change')}
                  </Label>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={handleCloseDialog}>
                    {formatMessage('officials.add_official_dialog.cancel')}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 
                      (linkingUser ? formatMessage('officials.add_official_dialog.linking') : formatMessage('officials.add_official_dialog.adding')) : 
                      (linkingUser ? formatMessage('officials.add_official_dialog.link_official') : formatMessage('officials.add_official_dialog.add_official'))
                    }
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-6 w-6 text-green-600" />
                  {linkingUser ? formatMessage('officials.add_official_dialog.user_linked') : formatMessage('officials.add_official_dialog.official_added')}
                </DialogTitle>
                <DialogDescription>
                  {linkingUser 
                    ? formatMessage('officials.add_official_dialog.user_linked_success')
                    : formatMessage('officials.add_official_dialog.official_added_success')
                  }
                </DialogDescription>
              </DialogHeader>
              
              {!linkingUser && (
                <div className="py-6">
                  <div className="mb-4">
                    <p className='font-medium mb-1'>{formatMessage('officials.add_official_dialog.access_data')}</p>
                    <p><strong>{formatMessage('officials.add_official_dialog.username')}</strong> {formData.email}</p>
                    <p><strong>{formatMessage('officials.add_official_dialog.email_label')}</strong> {formData.email}</p>
                    <p><strong>{formatMessage('officials.add_official_dialog.temp_password')}</strong> {generatedPassword}</p>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                    <p className="text-amber-800 text-sm">
                      {formatMessage('officials.add_official_dialog.save_password_warning')}
                    </p>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button onClick={handleCloseDialog}>{formatMessage('officials.add_official_dialog.close')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para vincular usuário existente */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{formatMessage('officials.add_official_dialog.link_existing_user_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>{formatMessage('officials.add_official_dialog.link_existing_user_desc')}</p>
                {existingUser && (
                  <div className="bg-gray-50 p-3 rounded-md border">
                    <p className="font-semibold">{existingUser.name}</p>
                    <p className="text-sm text-gray-600">{existingUser.email}</p>
                    <p className="text-sm text-gray-500">Username: {existingUser.username}</p>
                  </div>
                )}
                <p className="text-sm">
                  {formatMessage('officials.add_official_dialog.link_existing_user_confirm')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              {formatMessage('officials.add_official_dialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLinkUser}>
              {formatMessage('officials.add_official_dialog.yes_link_official')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
