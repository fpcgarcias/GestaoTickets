# Sistema de Design - Gestão de Tickets

## 📋 Visão Geral

Este documento define os padrões de design para botões, cores e layout das páginas administrativas do sistema de gestão de tickets. O objetivo é garantir consistência visual e melhorar a experiência do usuário em todas as páginas: clientes, usuários, atendentes, empresas, permissões, departamentos e tipos de chamados.

## 🎨 Paleta de Cores Padronizada

### Cores Primárias
```css
--primary: #2563eb;          /* Azul principal */
--primary-foreground: #ffffff;
--primary-hover: #1d4ed8;    /* Azul escuro no hover */
```

### Cores Semânticas
```css
--success: #059669;          /* Verde para ações de sucesso */
--success-foreground: #ffffff;
--success-hover: #047857;

--warning: #d97706;          /* Laranja para avisos */
--warning-foreground: #ffffff;
--warning-hover: #b45309;

--destructive: #dc2626;      /* Vermelho para ações destrutivas */
--destructive-foreground: #ffffff;
--destructive-hover: #b91c1c;

--info: #0891b2;            /* Azul claro para informações */
--info-foreground: #ffffff;
--info-hover: #0e7490;
```

### Cores Neutras
```css
--secondary: #f1f5f9;        /* Cinza claro para botões secundários */
--secondary-foreground: #475569;
--secondary-hover: #e2e8f0;

--muted: #f8fafc;           /* Fundo suave */
--muted-foreground: #64748b;

--accent: #f1f5f9;          /* Cor de destaque */
--accent-foreground: #0f172a;
```

## 🔘 Padronização de Botões

### Variantes de Botões

#### 1. Botão Primário (Ações Principais)
```tsx
<Button variant="default" size="default">
  <PlusIcon className="h-4 w-4 mr-2" />
  Adicionar
</Button>
```
**Uso:** Criar novos registros, salvar alterações, confirmar ações importantes.

#### 2. Botão Secundário (Ações Secundárias)
```tsx
<Button variant="outline" size="default">
  <Search className="h-4 w-4 mr-2" />
  Buscar
</Button>
```
**Uso:** Buscar, filtrar, cancelar ações.

#### 3. Botão de Edição
```tsx
<Button variant="ghost" size="sm">
  <PencilIcon className="h-4 w-4 mr-2" />
  Editar
</Button>
```
**Uso:** Editar registros existentes.

#### 4. Botão Destrutivo
```tsx
<Button variant="destructive" size="sm">
  <TrashIcon className="h-4 w-4 mr-2" />
  Excluir
</Button>
```
**Uso:** Excluir registros, ações irreversíveis.

#### 5. Botão de Informação
```tsx
<Button variant="secondary" size="sm">
  <EyeIcon className="h-4 w-4 mr-2" />
  Visualizar
</Button>
```
**Uso:** Visualizar detalhes, informações adicionais.

### Tamanhos Padronizados

- **sm**: Botões em tabelas e cards (h-8)
- **default**: Botões padrão em formulários (h-10)
- **lg**: Botões de destaque em cabeçalhos (h-11)
- **icon**: Botões apenas com ícones (h-10 w-10)

## 🎯 Padrões por Página

### 1. Página de Listagem (Clientes, Usuários, etc.)

```tsx
// Cabeçalho da página
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center space-x-2">
    <UsersIcon className="h-6 w-6 text-primary" />
    <h1 className="text-2xl font-bold">Usuários</h1>
  </div>
  <Button variant="default" size="default">
    <PlusIcon className="h-4 w-4 mr-2" />
    Adicionar Usuário
  </Button>
</div>

// Barra de filtros
<Card className="mb-6">
  <CardContent className="p-4">
    <div className="flex gap-4 items-center">
      <div className="flex-1">
        <Input 
          placeholder="Buscar usuários..." 
          className="max-w-sm"
        />
      </div>
      <Button variant="outline" size="default">
        <Search className="h-4 w-4 mr-2" />
        Buscar
      </Button>
      <Button variant="ghost" size="default">
        <FilterIcon className="h-4 w-4 mr-2" />
        Filtros
      </Button>
    </div>
  </CardContent>
</Card>

// Ações em tabela
<div className="flex gap-2">
  <Button variant="ghost" size="sm">
    <EyeIcon className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="sm">
    <PencilIcon className="h-4 w-4" />
  </Button>
  <Button variant="destructive" size="sm">
    <TrashIcon className="h-4 w-4" />
  </Button>
</div>
```

### 2. Formulários de Criação/Edição

```tsx
// Rodapé do formulário
<DialogFooter className="flex gap-3">
  <Button variant="outline" onClick={onCancel}>
    Cancelar
  </Button>
  <Button variant="default" type="submit" disabled={isLoading}>
    {isLoading && <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />}
    {isEditing ? 'Atualizar' : 'Criar'}
  </Button>
</DialogFooter>
```

### 3. Cards de Status

```tsx
// Badge para status
const getStatusBadge = (isActive: boolean) => (
  <Badge variant={isActive ? "default" : "secondary"}>
    {isActive ? "Ativo" : "Inativo"}
  </Badge>
);

// Switch para ativação
<div className="flex items-center space-x-2">
  <Switch 
    checked={item.isActive} 
    onCheckedChange={handleToggle}
  />
  <Label>Ativo</Label>
</div>
```

## 🏗️ Layout Padronizado

### Estrutura Básica das Páginas

```tsx
<div className="space-y-6">
  {/* Header com ícone, título e ação principal */}
  <div className="flex items-center space-x-2">
    <IconComponent className="h-6 w-6 text-primary" />
    <h1 className="text-2xl font-bold">Título da Página</h1>
  </div>
  
  {/* Descrição opcional */}
  <p className="text-muted-foreground">
    Descrição da funcionalidade da página.
  </p>

  {/* Filtros e busca */}
  <Card>
    <CardContent className="p-4">
      {/* Controles de filtro */}
    </CardContent>
  </Card>

  {/* Conteúdo principal */}
  <Card>
    <CardHeader>
      <CardTitle>Lista de Itens</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Tabela ou grid de dados */}
    </CardContent>
  </Card>
</div>
```

## 🎨 Estados Visuais

### Estados de Botões
1. **Normal**: Cor padrão da variante
2. **Hover**: Ligeiramente mais escuro (-10% brightness)
3. **Active**: Mais escuro (-20% brightness)
4. **Disabled**: Opacidade 50%, cursor not-allowed
5. **Loading**: Spinner + texto "Carregando..."

### Estados de Dados
1. **Carregando**: Skeleton loaders
2. **Vazio**: Ilustração + mensagem + botão de ação
3. **Erro**: Ícone de erro + mensagem + botão para tentar novamente

## 📱 Responsividade

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Adaptações Mobile
```tsx
// Botões em mobile ficam full-width em dialogs
<Button className="w-full sm:w-auto">
  Ação
</Button>

// Tabelas se tornam cards em mobile
<div className="block sm:hidden">
  {/* Cards para mobile */}
</div>
<div className="hidden sm:block">
  {/* Tabela para desktop */}
</div>
```

## 🔧 Implementação

### Passos para Implementação

1. **Atualizar tema Tailwind** com as cores padronizadas
2. **Criar componentes base** para botões com variantes
3. **Implementar layouts padrão** para cada tipo de página
4. **Aplicar consistentemente** em todas as páginas mencionadas
5. **Testar responsividade** em diferentes dispositivos

### Componentes a Criar

1. `PageHeader` - Cabeçalho padronizado
2. `FilterBar` - Barra de filtros reutilizável
3. `ActionButtons` - Grupo de botões de ação
4. `StatusBadge` - Badge de status consistente
5. `EmptyState` - Estado vazio padronizado

## ✅ Checklist de Validação

- [ ] Todas as páginas usam a mesma paleta de cores
- [ ] Botões têm tamanhos e variantes consistentes
- [ ] Ícones são consistentes (mesma biblioteca)
- [ ] Espaçamentos seguem o sistema (space-x-2, space-y-4, etc.)
- [ ] Estados de loading são padronizados
- [ ] Responsividade funciona em todas as páginas
- [ ] Acessibilidade está implementada (ARIA labels, contrastes)

---

**Versão:** 1.0  
**Última atualização:** Dezembro 2024  
**Responsável:** Equipe de Desenvolvimento 