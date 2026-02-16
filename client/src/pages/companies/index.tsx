import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Switch } from '@/components/ui/switch';
import { Search, Pencil, UserX, UserCheck, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCNPJ, cleanCNPJ, isValidCNPJ } from '@/lib/utils';

interface Company {
  id: number;
  name: string;
  email: string;
  domain?: string;
  active: boolean;
  cnpj?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export default function CompaniesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [_location, setLocation] = useLocation();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    domain: '',
    cnpj: '',
    phone: '',
    active: true
  });
  
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [user, authLoading, toast, setLocation]);
  
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/companies'); 
        
        if (!response.ok) {
          console.error('Resposta não foi OK:', response.status, response.statusText);
          throw new Error('Falha ao carregar empresas');
        }
        
        const data = await response.json();
        
        const formattedData = Array.isArray(data) ? data.map(company => ({
          ...company,
          id: company.id || 0,
          name: company.name || '',
          email: company.email || '',
          domain: company.domain || '',
          active: company.active !== undefined ? company.active : true,
          cnpj: company.cnpj || '',
          phone: company.phone || '',
          created_at: company.created_at || new Date().toISOString(),
          updated_at: company.updated_at || new Date().toISOString()
        })) : [];
        
        setCompanies(formattedData);
      } catch (error) {
        console.error('Erro completo ao carregar empresas:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de empresas.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user && user.role === 'admin') {
      fetchCompanies();
    }
  }, [user, toast]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      });
    } else if (name === 'cnpj') {
      const formatted = formatCNPJ(value);
      setFormData({
        ...formData,
        [name]: formatted
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.cnpj && !isValidCNPJ(formData.cnpj)) {
      toast({
        title: "CNPJ Inválido",
        description: "Por favor, insira um CNPJ válido.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const method = editingCompany ? 'PUT' : 'POST';
      const endpoint = editingCompany 
        ? `/api/companies/${editingCompany.id}` 
        : '/api/companies';
      
      const dataToSend = {
        ...formData,
        cnpj: formData.cnpj ? cleanCNPJ(formData.cnpj) : ''
      };
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao salvar empresa' }));
        throw new Error(errorData.message || 'Falha ao salvar empresa');
      }
      
      await response.json();
      
      const fetchResponse = await fetch('/api/companies');
      const updatedData = await fetchResponse.json();
      const formattedData = Array.isArray(updatedData) ? updatedData.map(company => ({
        ...company,
        id: company.id || 0,
        name: company.name || '',
        email: company.email || '',
        active: company.active !== undefined ? company.active : true,
        created_at: company.created_at || new Date().toISOString(),
        updated_at: company.updated_at || new Date().toISOString()
      })) : [];
      setCompanies(formattedData);

      toast({
        title: editingCompany ? "Empresa atualizada" : "Empresa criada",
        description: `A empresa "${formData.name}" foi ${editingCompany ? 'atualizada' : 'criada'} com sucesso.`,
      });
      
      resetForm();
      setOpenDialog(false);
    } catch (error) {
      toast({
        title: "Erro ao Salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    }
  };
  
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      email: company.email,
      domain: company.domain || '',
      cnpj: company.cnpj ? formatCNPJ(company.cnpj) : '',
      phone: company.phone || '',
      active: company.active
    });
    setOpenDialog(true);
  };
  
  const handleToggleStatus = async (company: Company) => {
    try {
      const response = await fetch(`/api/companies/${company.id}/toggle-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao alterar status' }));
        throw new Error(errorData.message || 'Falha ao alterar status');
      }
      
      const updatedCompany = await response.json();
      
      setCompanies(prevCompanies => 
        prevCompanies.map(c => (c.id === company.id ? updatedCompany : c))
      );
      
      toast({
        title: "Status alterado",
        description: `A empresa "${company.name}" foi ${updatedCompany.active ? 'ativada' : 'desativada'}.`,
      });
    } catch (error) {
       toast({
        title: "Erro ao Alterar Status",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    }
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      domain: '',
      cnpj: '',
      phone: '',
      active: true
    });
    setEditingCompany(null);
  };

  const filteredCompanies = companies
    .filter(company => includeInactive ? true : company.active)
    .filter(company => 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.cnpj && company.cnpj.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (company.domain && company.domain.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  if (authLoading) {
    return <div className="container mx-auto py-10 text-center"><p>Carregando autenticação...</p></div>;
  }
  if (!user || user.role !== 'admin') {
    return null; 
  }
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Empresas</h1>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Empresas Cadastradas</CardTitle>
              <CardDescription>
                Lista de todas as empresas no sistema.
              </CardDescription>
            </div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setOpenDialog(true); }}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Nova Empresa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
                  <DialogDescription>
                    {editingCompany ? 'Edite os detalhes da empresa.' : 'Preencha os detalhes para criar uma nova empresa.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">Nome</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="email" className="text-right">Email</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="domain" className="text-right">Domínio</Label>
                      <Input id="domain" name="domain" value={formData.domain} onChange={handleInputChange} className="col-span-3" placeholder="ex: minhaempresa.com"/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="cnpj" className="text-right">CNPJ</Label>
                      <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleInputChange} className="col-span-3" placeholder="XX.XXX.XXX/0001-XX"/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="phone" className="text-right">Telefone</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} className="col-span-3" placeholder="(XX) XXXXX-XXXX"/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="active" className="text-right">Ativo</Label>
                      <div className="col-span-3">
                        <Switch
                          id="active"
                          checked={formData.active}
                          onCheckedChange={(checked) => 
                            setFormData((prev) => ({
                              ...prev,
                              active: checked,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { resetForm(); setOpenDialog(false); }}>Cancelar</Button>
                    <Button type="submit">{editingCompany ? 'Salvar Alterações' : 'Criar Empresa'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Buscar por nome, email, CNPJ..." 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="includeInactive" 
                  checked={includeInactive} 
                  onCheckedChange={setIncludeInactive}
                />
                <Label htmlFor="includeInactive">Incluir inativas</Label>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                      {searchTerm ? "Nenhuma empresa encontrada para sua busca." : "Nenhuma empresa cadastrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id} className={!company.active ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.email}</TableCell>
                      <TableCell>{company.cnpj ? formatCNPJ(company.cnpj) : '-'}</TableCell>
                      <TableCell>
                        {(company.active === undefined || company.active) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inativo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(company.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                            title="Editar Empresa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant={company.active ? "destructive" : "default"} 
                            size="sm"
                            className={company.active ? "bg-amber-500 hover:bg-amber-500/90" : "bg-green-500 hover:bg-green-500/90"}
                            onClick={() => handleToggleStatus(company)}
                            title={company.active ? "Desativar Empresa" : "Ativar Empresa"}
                          >
                            {company.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 