# Exemplos de Implementação - Design System

## 📝 Como Aplicar a Padronização

Este documento mostra exemplos práticos de como refatorar as páginas existentes para seguir o design system padronizado.

## 🔄 Exemplo 1: Refatoração da Página de Usuários

### ❌ ANTES (Estado Atual)
```tsx
// client/src/pages/users/index.tsx - Trecho atual
export default function UsersIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="space-y-6">
      {/* Header não padronizado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <Button variant="default">
          <PlusIcon className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>
      
      {/* Filtros não padronizados */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Input 
              placeholder="Buscar usuários..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabela com botões não padronizados */}
      <Table>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleView(user)}>
                    <EyeIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### ✅ DEPOIS (Padronizado)
```tsx
// client/src/pages/users/index.tsx - Versão padronizada
import { Users, UserPlus } from 'lucide-react';
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup } from '@/components/ui/standardized-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UsersIndex() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateUser = () => {
    // Lógica para criar usuário
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // Lógica de busca
  };

  const handleFilterClick = () => {
    // Lógica para abrir filtros avançados
  };

  const handleView = (user: any) => {
    // Lógica para visualizar usuário
  };

  const handleEdit = (user: any) => {
    // Lógica para editar usuário
  };

  const handleDelete = (user: any) => {
    // Lógica para excluir usuário
  };

  if (users.length === 0 && !isLoading) {
    return (
      <StandardPage
        icon={Users}
        title="Usuários"
        description="Gerencie os usuários do sistema"
        createButtonText="Adicionar Usuário"
        onCreateClick={handleCreateUser}
        onSearchChange={handleSearchChange}
        onFilterClick={handleFilterClick}
        searchValue={searchTerm}
        searchPlaceholder="Buscar usuários..."
      >
        <EmptyState
          icon={Users}
          title="Nenhum usuário encontrado"
          description="Não há usuários cadastrados no sistema. Clique no botão abaixo para adicionar o primeiro usuário."
          actionLabel="Adicionar Primeiro Usuário"
          onAction={handleCreateUser}
        />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      icon={Users}
      title="Usuários"
      description="Gerencie os usuários do sistema"
      createButtonText="Adicionar Usuário"
      onCreateClick={handleCreateUser}
      onSearchChange={handleSearchChange}
      onFilterClick={handleFilterClick}
      searchValue={searchTerm}
      searchPlaceholder="Buscar usuários..."
      isLoading={isLoading}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>
                <StatusBadge isActive={user.active} />
              </TableCell>
              <TableCell className="text-right">
                <ActionButtonGroup
                  onView={() => handleView(user)}
                  onEdit={() => handleEdit(user)}
                  onDelete={() => handleDelete(user)}
                  loading={isLoading}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StandardPage>
  );
}
```

## 🔄 Exemplo 2: Padronização da Página de Departamentos

### ✅ Versão Padronizada Completa
```tsx
// client/src/pages/DepartmentManagement.tsx - Versão padronizada
import { Building2, FolderIcon } from 'lucide-react';
import { StandardPage, StatusBadge, EmptyState } from '@/components/layout/admin-page-layout';
import { ActionButtonGroup, SaveButton, CancelButton } from '@/components/ui/standardized-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const DepartmentManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateDepartment = () => {
    setIsDialogOpen(true);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleView = (department: any) => {
    // Lógica para visualizar departamento
  };

  const handleEdit = (department: any) => {
    setIsDialogOpen(true);
    // Carregar dados do departamento
  };

  const handleDelete = (department: any) => {
    // Lógica para excluir departamento
  };

  const handleSubmit = () => {
    setIsLoading(true);
    // Lógica para salvar
    setTimeout(() => {
      setIsLoading(false);
      setIsDialogOpen(false);
    }, 2000);
  };

  return (
    <>
      <StandardPage
        icon={Building2}
        title="Departamentos"
        description="Gerencie os departamentos da organização"
        createButtonText="Adicionar Departamento"
        onCreateClick={handleCreateDepartment}
        onSearchChange={handleSearchChange}
        searchValue={searchTerm}
        searchPlaceholder="Buscar departamentos..."
        isLoading={isLoading}
      >
        {departments.length === 0 ? (
          <EmptyState
            icon={FolderIcon}
            title="Nenhum departamento encontrado"
            description="Não há departamentos cadastrados. Comece criando o primeiro departamento da organização."
            actionLabel="Criar Primeiro Departamento"
            onAction={handleCreateDepartment}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {department.description || 'Sem descrição'}
                  </TableCell>
                  <TableCell>{department.company_name}</TableCell>
                  <TableCell>
                    <StatusBadge isActive={department.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionButtonGroup
                      onView={() => handleView(department)}
                      onEdit={() => handleEdit(department)}
                      onDelete={() => handleDelete(department)}
                      loading={isLoading}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </StandardPage>

      {/* Dialog padronizado */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Departamento' : 'Criar Departamento'}
            </DialogTitle>
          </DialogHeader>
          
          <Form>
            <div className="space-y-4">
              <FormField name="name">
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do departamento" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
              
              <FormField name="description">
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição do departamento" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
              
              <FormField name="is_active">
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Ativo</FormLabel>
                  <FormControl>
                    <Switch />
                  </FormControl>
                </FormItem>
              </FormField>
            </div>
          </Form>
          
          <DialogFooter className="flex gap-3">
            <CancelButton 
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            />
            <SaveButton 
              onClick={handleSubmit}
              loading={isLoading}
              text={isEditing ? 'Atualizar' : 'Criar'}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

## 🎨 Exemplo 3: Aplicação de Paleta de Cores

### Atualização do Tailwind Config
```typescript
// tailwind.config.ts - Cores padronizadas
export default {
  theme: {
    extend: {
      colors: {
        // Cores primárias
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
          hover: '#1d4ed8',
        },
        
        // Cores semânticas
        success: {
          DEFAULT: '#059669',
          foreground: '#ffffff',
          hover: '#047857',
        },
        warning: {
          DEFAULT: '#d97706',
          foreground: '#ffffff',
          hover: '#b45309',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff',
          hover: '#b91c1c',
        },
        info: {
          DEFAULT: '#0891b2',
          foreground: '#ffffff',
          hover: '#0e7490',
        },
        
        // Cores neutras
        secondary: {
          DEFAULT: '#f1f5f9',
          foreground: '#475569',
          hover: '#e2e8f0',
        },
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
        },
      },
    },
  },
};
```

## 📱 Exemplo 4: Responsividade Padronizada

### Mobile-First Approach
```tsx
// Componente responsivo
const ResponsiveUserCard: React.FC<{ user: User }> = ({ user }) => {
  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="block sm:hidden">
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <StatusBadge isActive={user.active} />
            </div>
            
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Função: </span>
                <span className="capitalize">{user.role}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Empresa: </span>
                <span>{user.company}</span>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <ViewButton 
                onClick={() => handleView(user)}
                className="flex-1"
                text="Ver"
              />
              <EditButton 
                onClick={() => handleEdit(user)}
                className="flex-1"
                text="Editar"
              />
              <DeleteButton 
                onClick={() => handleDelete(user)}
                iconOnly
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Table Row */}
      <TableRow className="hidden sm:table-row">
        <TableCell className="font-medium">{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell className="capitalize">{user.role}</TableCell>
        <TableCell>
          <StatusBadge isActive={user.active} />
        </TableCell>
        <TableCell className="text-right">
          <ActionButtonGroup
            onView={() => handleView(user)}
            onEdit={() => handleEdit(user)}
            onDelete={() => handleDelete(user)}
          />
        </TableCell>
      </TableRow>
    </>
  );
};
```

## 🚀 Plano de Implementação

### Fase 1: Componentes Base (Semana 1)
1. ✅ Criar `StandardizedButton` com todas as variantes
2. ✅ Criar `AdminPageLayout` com componentes base
3. ⏳ Atualizar `tailwind.config.ts` com paleta padronizada
4. ⏳ Criar componentes de `StatusBadge` e `EmptyState`

### Fase 2: Refatoração das Páginas (Semanas 2-3)
1. ⏳ Usuários (`/users`)
2. ⏳ Clientes (`/clients`)
3. ⏳ Atendentes (`/officials`)
4. ⏳ Empresas (`/companies`)

### Fase 3: Páginas de Configuração (Semana 4)
1. ⏳ Permissões (`/permissions`)
2. ⏳ Departamentos (`/departments`)
3. ⏳ Tipos de Chamados (`/ticket-types`)

### Fase 4: Testes e Validação (Semana 5)
1. ⏳ Testes de responsividade
2. ⏳ Testes de acessibilidade
3. ⏳ Validação com usuários
4. ⏳ Documentação final

## 📋 Checklist de Validação por Página

### ✅ Página de Usuários
- [ ] Header padronizado com ícone e botão criar
- [ ] Barra de filtros com busca
- [ ] Tabela com botões de ação padronizados
- [ ] Estado vazio implementado
- [ ] Loading state implementado
- [ ] Responsividade testada
- [ ] Cores padronizadas aplicadas

### ⏳ Página de Clientes
- [ ] Header padronizado com ícone e botão criar
- [ ] Barra de filtros com busca
- [ ] Tabela com botões de ação padronizados
- [ ] Estado vazio implementado
- [ ] Loading state implementado
- [ ] Responsividade testada
- [ ] Cores padronizadas aplicadas

### ⏳ Página de Departamentos
- [ ] Header padronizado com ícone e botão criar
- [ ] Barra de filtros com busca
- [ ] Tabela com botões de ação padronizados
- [ ] Estado vazio implementado
- [ ] Loading state implementado
- [ ] Responsividade testada
- [ ] Cores padronizadas aplicadas

---

**Próximos Passos:**
1. Implementar os componentes base criados
2. Testar em uma página piloto (Usuários)
3. Aplicar gradualmente em todas as páginas
4. Coletar feedback e refinar 