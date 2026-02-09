---
inclusion: always
---

# Padrões de Consistência do Projeto

## Arquitetura e Stack Tecnológico

### Frontend
- **Framework**: React 19 com TypeScript
- **Roteamento**: Wouter (não React Router)
- **Estado**: TanStack Query (React Query) para gerenciamento de estado do servidor
- **UI Components**: shadcn/ui baseado em Radix UI
- **Estilização**: Tailwind CSS v4 com class-variance-authority (cva)
- **Internacionalização**: react-intl (ver regras específicas em linguagem-aplicacao.md)
- **Formulários**: react-hook-form com zod para validação

### Backend
- **Runtime**: Node.js com Express
- **Database**: PostgreSQL com Drizzle ORM
- **Autenticação**: Passport.js com express-session
- **WebSocket**: ws para comunicação em tempo real

## Padrões de Código

### Componentes React

1. **Estrutura de Componentes**
   - Use function components com TypeScript
   - Prefira hooks ao invés de classes
   - Componentes de UI devem seguir o padrão shadcn/ui
   - Use `React.forwardRef` para componentes que precisam expor refs

2. **Imports e Paths**
   - Use alias `@/` para imports do client (`client/src/*`)
   - Use alias `@shared/` para código compartilhado
   - Organize imports: externos → internos → relativos

3. **Tipagem**
   - Sempre defina interfaces para props de componentes
   - Use tipos explícitos, evite `any`
   - Prefira `interface` para objetos públicos, `type` para unions/intersections

### Estilização

1. **Tailwind CSS**
   - Use a função `cn()` de `@/lib/utils` para combinar classes condicionalmente
   - Siga o padrão de cores do tema (primary, secondary, destructive, etc.)
   - Use variáveis do tema para dark mode (classes são aplicadas automaticamente)

2. **Componentes UI**
   - Todos os componentes base estão em `client/src/components/ui/`
   - Use `cva` (class-variance-authority) para variantes de componentes
   - Mantenha consistência com componentes existentes (Button, Card, Input, etc.)

3. **Ícones**
   - Use `lucide-react` para ícones
   - Tamanho padrão: `h-4 w-4` ou `h-5 w-5`
   - Sempre adicione classes de acessibilidade quando necessário

### Gerenciamento de Estado

1. **TanStack Query**
   - Use `useQuery` para leitura de dados
   - Use `useMutation` para operações de escrita
   - Query keys devem seguir o padrão: `["/api/endpoint", ...params]`
   - Sempre invalide queries relacionadas após mutações bem-sucedidas

2. **Context API**
   - Use para estado global (auth, theme, websocket)
   - Sempre forneça valores padrão
   - Crie hooks customizados para consumir contexts (ex: `useAuth()`)

### Internacionalização (i18n)

**CRÍTICO**: Todas as strings visíveis ao usuário DEVEM ser internacionalizadas.

1. **Uso do Hook**
   ```tsx
   const { formatMessage } = useI18n();
   <button>{formatMessage('module.action')}</button>
   ```

2. **Estrutura de Chaves**
   - Use hierarquia: `module.submodule.key`
   - Mantenha consistência entre `pt-BR.json` e `en-US.json`
   - Nunca use strings hardcoded em componentes

3. **Formatação**
   - Datas: use `formatDate()` do hook
   - Números: use `formatNumber()` do hook
   - Mensagens com variáveis: `formatMessage('key', { var: value })`

### API e Requisições

1. **Padrões de Requisição**
   - Use `apiRequest()` de `@/lib/queryClient` para todas as chamadas
   - Sempre trate erros com try/catch
   - Use `useToast()` para feedback ao usuário

2. **Endpoints**
   - Prefixo padrão: `/api/`
   - Use RESTful conventions (GET, POST, PUT, DELETE)
   - Retorne JSON com estrutura consistente

### Formulários

1. **react-hook-form + zod**
   - Sempre valide com schemas zod
   - Use `zodResolver` para integração
   - Mostre erros de validação inline

2. **Componentes de Formulário**
   - Use componentes shadcn/ui (Input, Select, Textarea, etc.)
   - Sempre inclua Label para acessibilidade
   - Use FormField pattern quando disponível

### Tratamento de Erros

1. **Frontend**
   - Use toast notifications para erros
   - Mostre mensagens amigáveis (internacionalizadas)
   - Log erros no console em desenvolvimento

2. **Backend**
   - Retorne status HTTP apropriados
   - Inclua mensagens de erro descritivas
   - Use middleware de erro centralizado

### Acessibilidade

1. **Semântica HTML**
   - Use elementos semânticos (`<button>`, `<nav>`, `<main>`, etc.)
   - Sempre inclua `aria-label` quando necessário
   - Use `role` attributes apropriadamente

2. **Navegação por Teclado**
   - Garanta que todos os elementos interativos sejam acessíveis via teclado
   - Use `tabIndex` apropriadamente
   - Teste navegação com Tab

### Performance

1. **Lazy Loading**
   - Use `React.lazy()` para páginas principais
   - Implemente Suspense com fallback apropriado
   - Exemplo já implementado em `App.tsx`

2. **Otimizações**
   - Memoize callbacks com `useCallback` quando necessário
   - Use `useMemo` para cálculos custosos
   - Evite re-renders desnecessários

### Convenções de Nomenclatura

1. **Arquivos**
   - Componentes: PascalCase (`CustomerSearch.tsx`)
   - Hooks: camelCase com prefixo `use` (`use-auth.tsx`)
   - Utils: kebab-case (`query-client.ts`)
   - Páginas: kebab-case ou PascalCase consistente

2. **Variáveis e Funções**
   - camelCase para variáveis e funções
   - PascalCase para componentes e classes
   - UPPER_SNAKE_CASE para constantes
   - **CRÍTICO**: Mantenha consistência de nomenclatura - se uma variável é `xpto`, não use `XpTO` em outro lugar

3. **Tipos e Interfaces**
   - PascalCase para interfaces e types
   - Sufixo `Props` para props de componentes
   - Sufixo `Type` para tipos de contexto

### Estrutura de Pastas

```
client/src/
├── components/
│   ├── ui/              # Componentes shadcn/ui base
│   ├── layout/          # Header, Sidebar, etc.
│   ├── [feature]/       # Componentes específicos de feature
│   └── [shared]/        # Componentes compartilhados
├── pages/               # Páginas da aplicação
├── hooks/               # Custom hooks
├── lib/                 # Utilitários e configurações
├── contexts/            # React contexts
├── i18n/                # Internacionalização
└── utils/               # Funções utilitárias
```

## Multi-Tenancy (CRÍTICO)

**O sistema é MULTI-TENANT - TODAS as operações devem considerar `company_id`**

### Regras Obrigatórias

1. **Filtros e Queries**
   - TODAS as queries devem filtrar por `company_id`
   - TODAS as telas devem considerar o contexto da empresa
   - NUNCA retorne dados de outras empresas sem autorização

2. **Role Admin**
   - Admins têm acesso a TODAS as empresas
   - Implemente dropdown de seleção de empresa em telas admin
   - Sempre valide permissões no backend também

3. **Segurança**
   - Valide `company_id` no backend em TODAS as operações
   - Nunca confie apenas em filtros do frontend
   - Use middleware para validação automática quando possível

### Exemplo de Implementação

```tsx
// Frontend - Query com company_id
const { data } = useQuery({
  queryKey: ["/api/tickets", user?.company_id],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (user?.company_id) {
      params.append('company_id', user.company_id.toString());
    }
    return fetch(`/api/tickets?${params}`).then(r => r.json());
  }
});

// Backend - Validação de company_id
app.get('/api/tickets', async (req, res) => {
  const companyId = req.user.role === 'admin' 
    ? req.query.company_id 
    : req.user.company_id;
  
  const tickets = await db.query.tickets.findMany({
    where: eq(tickets.company_id, companyId)
  });
  
  res.json(tickets);
});
```

## Padrões de UI Consistentes

### Filtros de Data

**Mantenha o mesmo padrão em TODAS as telas:**

1. **Opções Padrão**
   - Hoje
   - Esta Semana
   - Este Mês
   - Últimos 7 dias
   - Últimos 30 dias
   - Período Personalizado

2. **Implementação**
   - Use o mesmo componente de filtro em todas as telas
   - Mantenha a mesma ordem de opções
   - Use as mesmas labels (internacionalizadas)

### Ordenação de Listas

**CRÍTICO**: Se uma lista tem ordem B, A, C em uma tela, mantenha EXATAMENTE a mesma ordem em outras telas.

1. **Consistência de Ordenação**
   - Documente a ordem padrão de cada tipo de lista
   - Use constantes para definir ordenação
   - Aplique a mesma lógica em todas as telas

2. **Exemplo**
   ```tsx
   // Definir ordem em constante
   const STATUS_ORDER = ['new', 'ongoing', 'resolved'];
   
   // Usar em todas as telas
   const sortedStatuses = statuses.sort((a, b) => 
     STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)
   );
   ```

### Componentes Visuais

1. **Cores e Temas**
   - Use as variáveis CSS do tema (--primary, --secondary, etc.)
   - Teste sempre em dark mode e light mode
   - Mantenha consistência de cores para status (verde=sucesso, vermelho=erro, etc.)

2. **Layouts**
   - Use os mesmos espaçamentos (p-4, p-6, gap-4, etc.)
   - Mantenha consistência de Cards, Buttons, Inputs
   - Siga o padrão de Header + Content + Footer quando aplicável

3. **Badges e Status**
   - Use as mesmas cores para os mesmos status em todo o sistema
   - Mantenha o mesmo formato (rounded, tamanho, padding)
   - Use os utilitários de `@/lib/utils` (STATUS_COLORS, PRIORITY_COLORS)

## Boas Práticas Específicas

### Queries e Mutations

1. **Invalidação de Cache**
   - Sempre use `queryClient.invalidateQueries()` após mutações
   - Invalide queries relacionadas (ex: ao criar ticket, invalide lista de tickets)
   - Configure `staleTime` e `cacheTime` apropriadamente

2. **Loading States**
   - Sempre mostre feedback visual durante carregamento
   - Use skeleton loaders quando apropriado
   - Desabilite botões durante operações

### WebSocket

1. **Uso do Provider**
   - Use o `WebSocketProvider` existente
   - Sempre limpe listeners no cleanup (`useEffect` return)
   - Trate reconexões apropriadamente

2. **Eventos**
   - Documente eventos disponíveis
   - Use tipos TypeScript para payloads
   - Sempre valide dados recebidos

### Autenticação e Autorização

1. **Frontend**
   - Use `useAuth()` hook para acessar usuário
   - Proteja rotas com `ProtectedRoute`
   - Esconda elementos baseado em permissões

2. **Backend**
   - SEMPRE valide permissões no backend
   - Nunca confie apenas em validações do frontend
   - Use middleware para rotas protegidas

### Bibliotecas e Dependências

1. **Atualização**
   - Sempre use a versão mais recente compatível
   - Verifique compatibilidade com outras dependências
   - Teste após atualizar bibliotecas

2. **Instalação**
   - Documente novas dependências
   - Explique o motivo da escolha
   - Verifique licenças

## Checklist de Revisão

Antes de considerar uma feature completa:

- [ ] Todas as strings estão internacionalizadas (pt-BR e en-US)
- [ ] Componentes seguem padrão shadcn/ui
- [ ] Tipagem TypeScript completa (sem `any`)
- [ ] Tratamento de erros implementado
- [ ] Loading states implementados
- [ ] Responsividade testada (mobile, tablet, desktop)
- [ ] Acessibilidade verificada (navegação por teclado, aria-labels)
- [ ] Dark mode testado
- [ ] Queries invalidadas após mutações
- [ ] Console limpo (sem warnings ou errors)
- [ ] **Multi-tenancy**: Todos os filtros incluem `company_id`
- [ ] **Multi-tenancy**: Role admin pode acessar todas as empresas
- [ ] **Consistência**: Nomenclatura de variáveis consistente
- [ ] **Consistência**: Ordenação de listas igual em todas as telas
- [ ] **Consistência**: Filtros de data seguem padrão estabelecido
- [ ] **Consistência**: Cores e temas aplicados corretamente