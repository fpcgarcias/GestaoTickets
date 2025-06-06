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
} from '@/components/ui/dialog';
import { useLocation } from 'wouter';
import { Switch } from '@/components/ui/switch';
import { Search, Building2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCNPJ, cleanCNPJ, isValidCNPJ } from '@/lib/utils';

// Novos imports padronizados
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup, SaveButton, CancelButton } from '@/components/ui/standardized-button';

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
  const [_location, setLocation] = useLocation();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    domain: '',
    cnpj: '',
    phone: '',
    active: true
  });

  // Handlers padronizados
  const handleCreateCompany = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
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

  const handleToggleCompanyStatus = async (company: Company) => {
    await handleToggleStatus(company);
  };
  
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
        setError(null);
        const response = await fetch('/api/companies'); 
        
        if (!response.ok) {
          console.error('Resposta não foi OK:', response.status, response.statusText);
          throw new Error('Falha ao carregar empresas');
        }
        
        let data = await response.json();
        
        const formattedData = Array.isArray(data) ? data.map(company => ({
          ...company,
          id: company.id || 0,
          name: company.name || '',
          email: company.email || '',
          domain: company.domain || '',
          active: company.active !== undefined ? company.active : true,
          cnpj: company.cnpj || '',
          phone: company.phone || '',
          createdAt: company.createdAt || new Date().toISOString(),
          updatedAt: company.updatedAt || new Date().toISOString()
        })) : [];
        
        setCompanies(formattedData);
      } catch (error) {
        console.error('Erro completo ao carregar empresas:', error);
        setError(error instanceof Error ? error.message : 'Erro ao carregar empresas');
        toast({
          title: "Erro ao carregar",
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
      setIsSubmitting(true);
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
      
      const savedCompany = await response.json();
      
      const fetchResponse = await fetch('/api/companies');
      const updatedData = await fetchResponse.json();
      const formattedData = Array.isArray(updatedData) ? updatedData.map(company => ({
        ...company,
        id: company.id || 0,
        name: company.name || '',
        email: company.email || '',
        active: company.active !== undefined ? company.active : true,
        createdAt: company.createdAt || new Date().toISOString(),
        updatedAt: company.updatedAt || new Date().toISOString()
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
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
        title: "Erro ao alterar status",
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

  // Estado de erro
  if (error) {
    return (
      <StandardPage
        icon={Building2}
        title="Empresas"
        description="Gerencie as empresas do sistema"
        createButtonText="Nova Empresa"
        onCreateClick={handleCreateCompany}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar empresas..."
      >
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {error}
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </StandardPage>
    );
  }

  // Estado vazio quando não há empresas
  if (filteredCompanies && filteredCompanies.length === 0 && !isLoading && !searchTerm) {
    return (
      <>
        <StandardPage
          icon={Building2}
          title="Empresas"
          description="Gerencie as empresas cadastradas no sistema"
          createButtonText="Nova Empresa"
          onCreateClick={handleCreateCompany}
          onSearchChange={handleSearchChange}
          searchValue={searchTerm}
          searchPlaceholder="Buscar empresas..."
        >
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            description="Não há empresas cadastradas no sistema. Clique no botão abaixo para criar a primeira empresa."
            actionLabel="Criar Primeira Empresa"
            onAction={handleCreateCompany}
          />
        </StandardPage>

        {/* Modal de formulário */}
        {renderDialog()}
      </>
    );
  }

  // Função para renderizar o modal
  function renderDialog() {
    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
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
                <Switch id="active" name="active" checked={formData.active} onCheckedChange={(checked) => setFormData({...formData, active: checked})} className="col-span-3 justify-self-start" />
              </div>
            </div>
            <DialogFooter className="flex gap-3">
              <CancelButton
                onClick={() => { resetForm(); setOpenDialog(false); }}
                disabled={isSubmitting}
              />
              <SaveButton
                onClick={handleSubmit}
                loading={isSubmitting}
                text={editingCompany ? 'Salvar Alterações' : 'Criar Empresa'}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <>
      <StandardPage
        icon={Building2}
        title="Empresas"
        description="Gerencie as empresas cadastradas no sistema"
        createButtonText="Nova Empresa"
        onCreateClick={handleCreateCompany}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar por nome, email, CNPJ..."
        isLoading={isLoading}
      >
        {/* Filtros adicionais */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="includeInactive" 
                checked={includeInactive} 
                onCheckedChange={setIncludeInactive}
              />
              <Label htmlFor="includeInactive">Incluir empresas inativas</Label>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {filteredCompanies ? `${filteredCompanies.length} empresa(s) encontrada(s)` : ''}
          </div>
        </div>

        {filteredCompanies && filteredCompanies.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhuma empresa encontrada"
            description={`Não foram encontradas empresas com o termo "${searchTerm}".`}
            actionLabel="Limpar busca"
            onAction={() => setSearchTerm('')}
          />
        ) : (
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
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className={!company.active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.cnpj ? formatCNPJ(company.cnpj) : '—'}</TableCell>
                    <TableCell>
                      <StatusBadge isActive={company.active} />
                    </TableCell>
                    <TableCell>
                      {new Date(company.createdAt).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButtonGroup
                        onEdit={() => handleEditCompany(company)}
                        onDelete={() => handleToggleCompanyStatus(company)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </StandardPage>

      {renderDialog()}
    </>
  );
} 