# Relatorio de Consistencia Visual (UI) - GestaoTickets

Data: 09/02/2026

## Escopo
- Varredura estatica (sem rodar o app) do frontend em `client/`.
- Foco em consistencia visual/UX: filtros de data, cores/variantes de botoes, padronizacao de componentes, loading/spinner, i18n/textos.

## Metodologia
- Leitura de codigo e buscas textuais.
- Nao houve execucao do projeto, nem inspecao via browser/devtools.

## Achados (priorizados)

### Alto - Filtro de data (UX) inconsistente entre telas
**O que acontece**
- Existem pelo menos 3 padroes diferentes para "periodo":
- Componente padronizado `DateRangeFilter` (Dashboard e Satisfaction Dashboard).
- Range picker implementado "na mao" com `Popover + Calendar` dentro da pagina (Tickets e Reports).
- Inputs nativos `type="date"` (Logs).

**Onde**
- Dashboard usa `DateRangeFilter` e ainda mostra um indicador compacto do periodo: `client/src/pages/dashboard.tsx:479` e `client/src/pages/dashboard.tsx:488`.
- Satisfaction Dashboard usa `DateRangeFilter` sem o mesmo indicador: `client/src/pages/satisfaction-dashboard.tsx:490`.
- Tickets reimplementa o range picker com `Popover` e fecha o calendario automaticamente quando `from/to` estao preenchidos: `client/src/pages/tickets/index.tsx:349` ate `client/src/pages/tickets/index.tsx:390`.
- Reports reimplementam range picker e exigem clique em "Aplicar Filtros" (padrao diferente de "aplicar automaticamente"):
- `client/src/pages/reports/performance.tsx:463` ate `client/src/pages/reports/performance.tsx:493`
- `client/src/pages/reports/clients.tsx:407`
- `client/src/pages/reports/department.tsx:452`
- `client/src/pages/reports/sla.tsx:543`
- Logs usa inputs nativos de data para inicio/fim: `client/src/pages/logs.tsx:388` e `client/src/pages/logs.tsx:397`.

**Impacto**
- Usuario aprende um comportamento em uma tela e ele muda em outra (auto-aplicar vs botao "Aplicar Filtros", range picker vs dois inputs).
- A cada nova tela, aumenta a chance de erro operacional e reduz previsibilidade (principalmente em telas de relatorio).
- Manutencao fica cara: correcao/melhoria de UX precisa ser replicada em varias implementacoes semelhantes.

**Correcao sugerida (resumo)**
- Definir 1 padrao de "Filtro de Periodo" e centralizar:
- Opcao A (recomendada): expandir `client/src/components/ui/date-range-filter.tsx` para cobrir os casos de Reports (incluindo modo "aplicar manualmente" e layout responsivo).
- Migrar Tickets/Reports para reutilizar o mesmo componente (sem `Popover + Calendar` duplicado em cada pagina).
- Definir regra unica de aplicacao:
- Ou sempre auto-aplicar ao selecionar o range, ou sempre exigir "Aplicar" (o importante e ser consistente).

---

### Alto - Navegacao duplicada (risco de drift visual e de labels)
**O que acontece**
- Existe uma sidebar usada no layout (`components/layout/sidebar.tsx`), mas o Header tambem contem uma navegacao mobile com links/labels hardcoded, o que duplica a fonte de verdade do menu.
- Alem disso, existe um segundo sidebar grande em `components/ui/sidebar.tsx` (aparentemente sem uso), aumentando risco de divergencia ao longo do tempo.

**Onde**
- Sidebar usada pelo app: `client/src/App.tsx:9` (importa `Sidebar` de `@/components/layout/sidebar`).
- Header implementa menu mobile com `SheetContent` e varios `Link` com labels hardcoded: `client/src/components/layout/header.tsx:85` ate `client/src/components/layout/header.tsx:120`.
- Duas implementacoes de sidebar existem no repo:
- `client/src/components/layout/sidebar.tsx`
- `client/src/components/ui/sidebar.tsx`

**Impacto**
- Inconsistencias visuais e de texto entre desktop (sidebar) e mobile (menu do header) sao provaveis (ex: um item muda em um lugar e nao no outro).
- Maior chance de bugs de permissao/rotas (um menu mostra opcao, o outro nao), alem de inconsistencias de i18n.

**Correcao sugerida (resumo)**
- Transformar a definicao de itens de menu em uma unica fonte (ex: `nav-config.ts`) e reutilizar em Sidebar e no menu mobile.
- Remover ou arquivar `client/src/components/ui/sidebar.tsx` se realmente nao for usado (ou migrar para ele e remover o outro), para reduzir duplicacao.

---

### Medio - Cores hardcoded competindo com tokens do tema (Tailwind vars)
**O que acontece**
- Ha mistura entre:
- classes baseadas em tokens (`bg-background`, `text-foreground`, `border-primary`, etc.)
- classes hardcoded (`border-blue-500`, `text-gray-600`, `bg-gray-100`, `text-blue-600`, etc.)

**Onde (exemplos)**
- Loading padrao usa `border-primary`: `client/src/App.tsx:57`.
- Varias telas/componentes usam spinner hardcoded `border-blue-500`:
- `client/src/pages/reports/sla.tsx:553`
- `client/src/pages/reports/clients.tsx:417`
- `client/src/pages/reports/department.tsx:463`
- `client/src/components/charts/modern-sla-bar-chart.tsx:68`
- `client/src/components/charts/performance-bar-chart.tsx:58`
- Charts usam varios `text-gray-*` / `bg-gray-*` hardcoded:
- `client/src/components/charts/modern-sla-bar-chart.tsx:37` e `client/src/components/charts/modern-sla-bar-chart.tsx:77`
- `client/src/components/charts/performance-bar-chart.tsx:31` e `client/src/components/charts/performance-bar-chart.tsx:67`

**Impacto**
- Temas diferentes (ou ajustes de identidade visual) ficam parcialmente quebrados, porque os hardcoded ignoram tokens.
- UI passa sensacao de "colcha de retalhos": algumas areas respeitam tema, outras nao.

**Correcao sugerida (resumo)**
- Padronizar loading/spinner em um componente (ex: `LoadingSpinner`) usando tokens (`border-primary`, `text-muted-foreground`).
- Trocar `text-gray-*`, `bg-gray-*`, `border-blue-500` por tokens equivalentes (`text-muted-foreground`, `bg-muted`, `border-primary`, etc.), ou criar tokens especificos no tema se necessario.

---

### Medio - Representacao de prioridade/status nao padronizada (chips/badges)
**O que acontece**
- Existem estrategias diferentes para prioridade/status:
- CSS utilitario global por status/priority (ex: `.bg-status-high` no `index.css`)
- Mapeamentos em `utils.ts` com cores hardcoded (aparentemente nao usados)
- Componente de badge mais "theme-friendly" em `status-badge.tsx`

**Onde**
- Dashboard mostra chip de alta prioridade com `bg-status-high`: `client/src/pages/dashboard.tsx:738` (classe definida em `client/src/index.css:111`).
- `utils.ts` define mapeamentos hardcoded (sem evidencias de uso na base): `client/src/lib/utils.ts:69` e `client/src/lib/utils.ts:76`.
- `StatusBadge/PriorityBadge` usam classes orientadas a tokens e indicador via `indicatorColor`: `client/src/components/tickets/status-badge.tsx:116` ate `client/src/components/tickets/status-badge.tsx:150`.

**Impacto**
- Prioridade/status podem parecer diferentes entre paginas (mesmo valor semantico, cores/estilos diferentes).
- Manutencao fica confusa: nao fica claro qual e o padrao oficial (CSS global vs mapping em utils vs componente).

**Correcao sugerida (resumo)**
- Definir uma unica estrategia:
- Ou centralizar em `StatusBadge/PriorityBadge` e usar tokens (recomendado),
- Ou centralizar em tokens CSS (`--status-*`) e expor via classes consistentes (sem hardcoded).
- Remover/atualizar `PRIORITY_COLORS`/`STATUS_COLORS` se nao forem usados, para evitar "documentacao enganosa" no codigo.

---

### Medio - Textos/i18n inconsistentes (mistura de ingles e PT-BR e hardcoded)
**O que acontece**
- Algumas paginas estao em ingles e/ou com strings hardcoded, enquanto outras usam `useI18n()/formatMessage`.

**Onde**
- Pagina 404 esta em ingles e com paleta hardcoded: `client/src/pages/not-found.tsx:6` ate `client/src/pages/not-found.tsx:16`.
- Header (menu mobile) tem labels hardcoded (ex: "Painel de Controle", "Chamados", etc.): `client/src/components/layout/header.tsx:91` ate `client/src/components/layout/header.tsx:120`.

**Impacto**
- Experiencia multi-idioma fica inconsistente.
- Mudanca de nomenclatura exige mexer em varios lugares (risco de divergencia).

**Correcao sugerida (resumo)**
- Migrar 404 para `formatMessage` e tokens de tema (substituir `bg-gray-50`, `text-red-500`, etc.).
- Extrair labels do menu para i18n (ou para uma config unica do menu, junto com a Sidebar).

---

## Observacoes
- Uso de `type="date"` aparece tambem em formularios (ex: inventario), o que pode ser OK (nao e necessariamente "filtro de periodo"): `client/src/pages/inventory/catalog.tsx:810` e `client/src/pages/inventory/catalog.tsx:818`.

