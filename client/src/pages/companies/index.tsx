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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Switch } from '@/components/ui/switch';

interface Company {
  id: number;
  name: string;
  email: string;
  domain?: string;
  active: boolean;
  cnpj?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CompaniesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  // Formulário de nova empresa
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    domain: '',
    cnpj: '',
    phone: '',
    active: true
  });
  
  // Verificar se o usuário é admin
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
  
  // Carregar lista de empresas
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/companies');
        
        if (!response.ok) {
          throw new Error('Falha ao carregar empresas');
        }
        
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de empresas.",
          variant: "destructive",
        });
        console.error(error);
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
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const method = editingCompany ? 'PUT' : 'POST';
      const endpoint = editingCompany 
        ? `/api/admin/companies/${editingCompany.id}` 
        : '/api/admin/companies';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error('Falha ao salvar empresa');
      }
      
      const savedCompany = await response.json();
      
      if (editingCompany) {
        // Atualizar a empresa existente na lista
        setCompanies(companies.map(c => 
          c.id === editingCompany.id ? savedCompany : c
        ));
        toast({
          title: "Empresa atualizada",
          description: `A empresa "${formData.name}" foi atualizada com sucesso.`,
        });
      } else {
        // Adicionar nova empresa à lista
        setCompanies([...companies, savedCompany]);
        toast({
          title: "Empresa criada",
          description: `A empresa "${formData.name}" foi criada com sucesso.`,
        });
      }
      
      // Resetar formulário e fechar dialog
      resetForm();
      setOpenDialog(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar empresa.",
        variant: "destructive",
      });
      console.error(error);
    }
  };
  
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      email: company.email,
      domain: company.domain || '',
      cnpj: company.cnpj || '',
      phone: company.phone || '',
      active: company.active
    });
    setOpenDialog(true);
  };
  
  const handleToggleStatus = async (company: Company) => {
    try {
      const response = await fetch(`/api/admin/companies/${company.id}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Falha ao alterar status da empresa');
      }
      
      const updatedCompany = await response.json();
      
      // Atualizar a empresa na lista
      setCompanies(companies.map(c => 
        c.id === company.id ? updatedCompany : c
      ));
      
      toast({
        title: "Status alterado",
        description: `A empresa "${company.name}" foi ${updatedCompany.active ? 'ativada' : 'desativada'}.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao alterar status da empresa.",
        variant: "destructive",
      });
      console.error(error);
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
  
  // Redirecionamento se usuário não for admin
  if (authLoading || !user || user.role !== 'admin') {
    return null;
  }
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Empresas</h1>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}>
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </DialogTitle>
              <DialogDescription>
                {editingCompany 
                  ? 'Edite os detalhes da empresa selecionada.' 
                  : 'Preencha os detalhes para criar uma nova empresa.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="col-span-1">Nome</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="col-span-1">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="domain" className="col-span-1">Domínio</Label>
                  <Input
                    id="domain"
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="ex: minha-empresa.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="cnpj" className="col-span-1">CNPJ</Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="ex: 12.345.678/0001-90"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="col-span-1">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder="(11) 1234-5678"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="active" className="col-span-1">Ativo</Label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="active"
                      name="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => 
                        setFormData({...formData, active: checked})
                      }
                    />
                    <span>{formData.active ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  resetForm();
                  setOpenDialog(false);
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCompany ? 'Salvar Alterações' : 'Criar Empresa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Empresas Cadastradas</CardTitle>
          <CardDescription>
            Lista de todas as empresas no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center">
              <p>Carregando empresas...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="py-10 text-center">
              <p>Nenhuma empresa cadastrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${
                        company.active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}>
                        {company.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant={company.active ? "destructive" : "default"} 
                          size="sm"
                          onClick={() => handleToggleStatus(company)}
                        >
                          {company.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 