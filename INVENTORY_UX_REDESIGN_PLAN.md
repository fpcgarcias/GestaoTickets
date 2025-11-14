# Plano UX Inventário 2.0

Documento preparado para reestruturar completamente a experiência do módulo de inventário com rotas dedicadas, navegação hierárquica e fluxos funcionais, eliminando sobrecarga visual e garantindo filtros/pesquisas em todas as entidades.

---

## 1. Objetivos e Diretrizes
- **Separar domínios**: cada recurso (inventário, fornecedores, tipos, locais, movimentações, termos, relatórios, configurações) terá rota própria e URL amigável.
- **Menu cascateado**: item “Inventário” na sidebar abre subitens claros; ícones e permissões consistentes (`admin`, `company_admin`, `manager`, `supervisor`, `support`, `inventory_manager`).
- **Listagens profissionais**: tabelas com paginação, ordenação, busca, filtros múltiplos e ações inline (editar, excluir, download, etc.).
- **Formulários leves**: criação/edição em drawers ou modais contextuais; campos agrupados por seção; importação NF-e acoplada ao cadastro de produto.
- **Feedback e estados vazios**: skeletons, mensagens de vazio úteis, toasts coerentes, CTAs para ação.
- **Confiabilidade**: toda ação deve chamar APIs existentes já implementadas; nada em memória.
- **Escalabilidade**: componentes genéricos (`DataTable`, `EntityFilterBar`) para reutilização em todas as páginas.

---

## 2. Problemas Identificados (referência)
1. Conteúdo único em `/inventory` com abas misturando cadastros, catálogo e configurações.
2. Ausência de listagens completas para tipos, fornecedores, localizações (apenas inputs).
3. Imports NF-e e formulário de produto no mesmo card → confusão.
4. Parâmetro `use_inventory_control` não exposto de forma funcional por departamento.
5. Falta de filtros/pesquisas/paginação para entidades auxiliares.
6. “Cadastros auxiliares” sem contexto, tornando fluxo não descobrível.
7. Navegação “Inventário” não reflete subdomínios; usuário não sabe onde clicar.

---

## 3. Arquitetura de Navegação
### 3.1 Sidebar
- **Inventário (pai)** — ícone `Boxes` ou similar. Ao expandir:
  1. `Visão geral` → `/inventory`
  2. `Catálogo` → `/inventory/catalog`
  3. `Movimentações` → `/inventory/movements`
  4. `Alocações & Termos` → `/inventory/assignments`
  5. `Fornecedores` → `/inventory/suppliers`
  6. `Tipos de produto` → `/inventory/product-types`
  7. `Localizações` → `/inventory/locations`
  8. `Relatórios` → `/inventory/reports`
  9. `Configurações` → `/inventory/settings`
  10. `Webhooks` → `/inventory/webhooks`
- Sidebar mantém seleção persistente e destaca subrota ativa.

### 3.2 Layout Base
- Criar `InventoryLayout` (header + breadcrumb + outlet) reutilizado pelas rotas filhas.
- Breadcrumb usa `Inventário / Seção`.
- Header com ações principais (ex: botão “Cadastrar produto” apenas em páginas relevantes, redirecionando para modal/drawer).

---

## 4. Rotas e Fluxos Detalhados

### 4.1 `/inventory` – Visão geral
- **Cards**: totais, status, KPIs principais (já existem via `/api/inventory/dashboard/...`).
- **Alertas**, **Top produtos**, **Movimentações recentes** em cards separados com filtros rápidos (por severidade, período).
- CTA “Ver catálogo” e “Ver movimentações” para fluxo natural.

### 4.2 `/inventory/catalog`
#### 4.2.1 Layout
- Header: título + contadores (itens disponíveis/em uso/reservados) + botões `Novo produto`, `Importar NF-e`.
- Barra de filtros (componentização):
  - Busca texto (nome, patrimônio, série).
  - Select múltiplo para status.
  - Select para tipo de produto.
  - Select para fornecedor.
  - Select para departamento/localização (com dados reais).
  - Range de datas (compra/garantia).
  - Botão “Limpar filtros”.
- Lista:
  - DataTable com colunas: checkbox (bulk), código, nome, status (badge), tipo, fornecedor, depto/local, garantia, ações.
  - Paginação server-side (usar query params `page`, `pageSize`, `search`, etc.).
  - Ações inline: ver detalhes, editar, anexar foto, gerar QR, arquivar (se disponível).
- Drawer/Modal “Novo produto”:
  - Seções: Identificação, Classificação, Fiscal (NF, fornecedor, importação NF-e), Localização, Garantia, Complementos.
  - Importar NF-e: botão com input invisível, hint com fornecedor/total, preview dos itens antes de confirmar preenchimento.
  - Validação dos campos obrigatórios; mostrar erros API.
  - Após salvar → refetch lista + fechar drawer.
- Drawer “Editar” (mesma UI, dados carregados).
- Drawer “Detalhes” (timeline de movimentações, fotos, termos); pode ser fase 2, mas deixar planejado.

### 4.3 `/inventory/movements`
- Abas internas ou filtros para `Todos`, `Pendentes`, `Aprovados`, `Rejeitados`.
- Filtros: tipo, status aprovação, período, usuário responsável, ticket.
- Colunas: ID, Produto (com link), Tipo, Quantidade, Responsável, Ticket, Status aprovação, Data, Ações.
- Ações:
  - Aprovar/Rejeitar (botões inline, com confirmação).
  - Ver detalhes (drawer com payload completo + anexos).
- Formulário “Registrar movimentação” em drawer lateral:
  - Selecionar produto via combobox (search remoto) ou input ID + botão “Buscar”.
  - Campos dinâmicos conforme tipo (ex: transferência pede origem/destino).

### 4.4 `/inventory/assignments`
- Título “Alocações & Termos”.
- Filtros: status devolução, departamento, usuário, data prevista/real, termo assinado.
- Tabela: ID assignment, produto, usuário, datas, status termo.
- Ações: registrar devolução, gerar termo (se não existir), baixar termo, enviar para assinatura.
- Drawer “Gerar termo” com seleção de template e preview (embed PDF se disponível na fase 2).

### 4.5 `/inventory/suppliers`
- Header com botão “Novo fornecedor”.
- Barra de busca (nome, CNPJ, contato).
- Tabela: Nome, CNPJ, contato, telefone, email, produtos vinculados (contador), ações.
- Drawer de criação/edição com seções: Dados fiscais, Contatos, Endereço (opcional).
- Permitir exclusão com confirmação (somente se não usado ou com regra).

### 4.6 `/inventory/product-types`
- Lista com colunas: Nome, Categoria, Código interno, Campos obrigatórios (checkbox icons), nº produtos.
- Drawer para criar/editar, com opções:
  - Categoria (`hardware`, `software`, `accessory`, `service`, `other`).
  - Flags (ex: exige Nº de série, exige patrimônio, exige termo).
  - Campos customizáveis futuros (planejar estrutura, mas manter oculto se não implementado).

### 4.7 `/inventory/locations`
- Mapa hierárquico (tree) + tabela filtrável.
- Tabs: “Lista” (tabela com filtros por departamento/tipo) e “Hierarquia” (tree view com expansões).
- Drawer “Nova localização”: nome, tipo, departamento, local pai, capacidade opcional.
- Ação “Gerar QR Code” abre modal com preview e botão download (usa `/api/inventory/locations/:id/qrcode`).

### 4.8 `/inventory/reports`
- Cards com descrição dos 14 relatórios → clique abre modal informando filtros específicos; ou tabela com dropdown “Gerar”.
- Histórico de execuções? (opcional). Pelo menos mostrar JSON quando formato = `json`.
- Export Excel com feedback (toast + download).

### 4.9 `/inventory/settings`
- Seções:
  1. **Parâmetro por departamento**: tabela com todos departamentos, coluna toggle `use_inventory_control`, botão “Configurar” que abre drawer com `allowed_product_types`, `default_assignment_days`, `require_return_workflow`, `approval_rules`.
  2. **Regras globais**: configs gerais (exibir placeholders para fase futura).
  3. **Automação**: ganchos para integrações (somente CTA se ainda não implementado).
- Estado do toggle precisa refletir `departments.use_inventory_control` real (GET/PUT).

### 4.10 `/inventory/webhooks`
- Reaproveitar estrutura atual porém em rota dedicada.
- Lista com colunas Nome, URL (com tooltip), Eventos, Status, Último disparo, Ações (editar/remover/testar).
- Drawer para criar/editar.

---

## 5. Componentização Reutilizável
1. **`InventoryLayout`**: header, breadcrumb, slot para actions.
2. **`InventoryFilterBar`**: recebe array de filtros (tipo select, search, date range) e emite objeto. Usada em catálogo, fornecedores, etc.
3. **`EntityTable` (generic)**: abstração sobre `Table` com paginação, ordenação, ações inline.
4. **`EntityDrawer`**: layout padrão para criar/editar com footer fixo (Cancelar/Salvar).
5. **`ImportNfeButton`**: encapsula input file, estados e callback para preencher formulários.
6. **`StatusBadge`** e mapeamento de cores centralizado.
7. **`EmptyState`** component com props `icon`, `title`, `description`, `action`.

---

## 6. Estado, Dados e Hooks
- **React Query**: cada rota tem `queryKey` distinto com paginação (`["inventory-products", { page, filters }]`). Utilizar `keepPreviousData`.
- **URL Sync**: filtros/paginador sincronizados com query string usando `useSearchParams` (wouter) para deep-link.
- **Mutations**: centralizar calls em hooks `useInventoryApi` para manter mensagens padronizadas.
- **Erro/Loading**: skeletons para cards/tabelas; fallback `ErrorState` com retry.

---

## 7. Fluxos Especiais
1. **Importação NF-e**
   - Botão no catálogo abre file picker → mostra modal de confirmação com itens encontrados → usuário escolhe qual preencher.
   - Persistir `parsedProducts` no estado até salvar.
2. **Upload de fotos**
   - Ação em cada linha abre modal “Anexar foto” com preview e histórico.
3. **Termos digitais**
   - Lista indica status (gerado, enviado, assinado, expirado).
   - Ação “Enviar para assinatura” chama `digital-signature-service`.
4. **Departamento `use_inventory_control`**
   - Toggle faz PUT a `/api/departments/:id` (ou endpoint específico) e atualiza tabela local.
   - Exibir tag “Inventário habilitado” em listagens que dependam disso.

---

## 8. Sequência de Implementação Recomendada
1. **Infra navegação**
   - Criar `InventoryLayout` e ajustar rotas em `client/src/App.tsx`.
   - Atualizar sidebar com menu cascateado.
2. **Visão geral + Catálogo**
   - Construir páginas com componentes genéricos.
   - Implementar drawer de produto e importação NF-e.
3. **Fornecedores / Tipos / Localizações**
   - Reaproveitar `EntityTable`, construir drawers e filtros.
4. **Movimentações / Assignments**
   - Foco em fluxos críticos (aprovação, devolução, termos).
5. **Relatórios / Webhooks / Configurações**
   - Ajustar para rotas próprias com UI consistente.
6. **Refino**
   - Estados vazios, toasts, i18n, testes de regressão.

Cada etapa deve atualizar o `TODO` correspondente no board atual (não criar novos IDs; apenas marcar progresso).

---

## 9. Critérios de Aceite e Testes
- **Navegação**: todos submenus funcionam, highlight correto, deep-link direto carrega dados e mantém filtros via URL.
- **Listagens**: cada entidade suporta busca e ao menos um filtro adicional, com paginação real (usar query params `page`, `pageSize`, `search`).
- **Formulários**: validação client-side + mensagem de erro da API; loading no botão; reset após sucesso.
- **NF-e**: upload válido → formulário preenchido + mensagem; em erro exibir detalhes.
- **Department toggle**: refletir estado real; atualizar sem reload.
- **Internacionalização**: todos textos novos adicionados em `pt-BR` e `en-US`.
- **Acessibilidade**: componentes interativos com `aria-label` quando necessário, foco gerenciado nos drawers/modais.
- **Responsividade**: breakpoints ≥ 1280px (layout 2 colunas), 768-1024 (stack com cards), mobile (stack full width, filtros em accordion).

---

## 10. Próximos Passos
1. Atualizar `todo` “Planejar UX completo do inventário” para `completed`.
2. Iniciar implementação seguindo a sequência proposta (navegação primeiro).
3. Após cada entrega parcial, solicitar validação visual com o usuário antes de avançar para a próxima rota.

> Este plano substitui a abordagem anterior e serve como referência única para o redesenho completo do módulo de inventário.

