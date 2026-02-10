# Plano de Implementação: Correções de Consistência Visual (UI)

## Visão Geral

Implementação incremental das correções de consistência visual, começando pelos componentes base (LoadingSpinner, Nav Config), depois migrando as telas consumidoras, e finalizando com limpeza e versionamento.

## Tasks

- [x] 1. Criar componentes base e configuração de navegação
  - [x] 1.1 Criar componente `LoadingSpinner` em `client/src/components/ui/loading-spinner.tsx`
    - Implementar com props `size` (sm/md/lg) e `className` opcional
    - Usar `border-primary` como token de tema para a cor do spinner
    - Usar `cn()` para combinar classes
    - _Requirements: 3.1_

  - [x] 1.2 Criar arquivo `client/src/lib/nav-config.ts` com fonte única de itens de navegação
    - Exportar `NAV_ITEMS` com todos os itens de menu (href, icon, labelKey, roles) extraídos de `sidebar.tsx`
    - Exportar `INVENTORY_ITEMS` com itens do submenu de inventário
    - Exportar `INVENTORY_ROLES` com roles que acessam inventário
    - Exportar função `filterNavItems(items, userRole)` para filtrar por role
    - _Requirements: 2.1_

  - [x] 1.3 Adicionar chaves i18n novas em `client/src/i18n/messages/pt-BR.json` e `client/src/i18n/messages/en-US.json`
    - Adicionar seção `header`: welcome, my_account, dark_mode, settings, logout
    - Adicionar seção `not_found`: title, description
    - Garantir paridade de chaves entre os dois arquivos
    - _Requirements: 5.5_

- [x] 2. Migrar Sidebar e Header para Nav Config
  - [x] 2.1 Refatorar `client/src/components/layout/sidebar.tsx` para consumir `NAV_ITEMS` e `INVENTORY_ITEMS` do `nav-config.ts`
    - Remover definições inline de `navItems` e `inventoryMenuItems`
    - Importar e usar `NAV_ITEMS`, `INVENTORY_ITEMS`, `INVENTORY_ROLES`, `filterNavItems`
    - Manter toda a lógica de renderização (SidebarItem, Sheet mobile, etc.)
    - _Requirements: 2.2, 2.3_

  - [x] 2.2 Refatorar `client/src/components/layout/header.tsx` para usar Nav Config e i18n
    - Substituir menu mobile hardcoded (SheetContent com links PT-BR) por iteração sobre `filterNavItems(NAV_ITEMS, user.role)` usando `formatMessage(item.labelKey)`
    - Substituir "Bem-vindo, {name}!" por `formatMessage('header.welcome', { name })`
    - Substituir "Minha Conta" por `formatMessage('header.my_account')`
    - Substituir "Modo escuro" por `formatMessage('header.dark_mode')`
    - Substituir "Configurações" por `formatMessage('header.settings')`
    - Substituir "Sair" por `formatMessage('header.logout')`
    - _Requirements: 2.4, 2.6, 5.2, 5.3, 5.4_

  - [x] 2.3 Remover arquivo não utilizado `client/src/components/ui/sidebar.tsx`
    - Confirmar que nenhum import referencia este arquivo (já verificado: nenhum)
    - _Requirements: 2.5_

- [x] 3. Checkpoint - Verificar navegação
  - Garantir que sidebar desktop, sidebar mobile e header mobile funcionam corretamente com Nav Config
  - Garantir que i18n funciona no header
  - Perguntar ao usuário se há dúvidas

- [ ] 4. Migrar filtros de data para DateRangeFilter
  - [x] 4.1 Migrar `client/src/pages/tickets/index.tsx` para usar `DateRangeFilter`
    - Remover bloco inline de Popover + Calendar (~linhas 349-400)
    - Remover imports não mais necessários (Popover, PopoverTrigger, PopoverContent, Calendar de react-day-picker se não usado em outro lugar da página)
    - Importar e usar `<DateRangeFilter />` com os states existentes (timeFilter, dateRange, calendarOpen)
    - _Requirements: 1.1, 1.6_

  - [x] 4.2 Migrar `client/src/pages/reports/performance.tsx` para usar `DateRangeFilter`
    - Remover Popover + Calendar inline e botão "Aplicar Filtros" para período
    - Adicionar states `timeFilter` e `calendarOpen`
    - Importar e usar `<DateRangeFilter />`
    - Ajustar lógica de fetch para usar dateRange diretamente (auto-aplicar)
    - _Requirements: 1.1, 1.7_

  - [x] 4.3 Migrar `client/src/pages/reports/clients.tsx` para usar `DateRangeFilter`
    - Mesma abordagem de 4.2
    - _Requirements: 1.1, 1.7_

  - [x] 4.4 Migrar `client/src/pages/reports/department.tsx` para usar `DateRangeFilter`
    - Mesma abordagem de 4.2
    - _Requirements: 1.1, 1.7_

  - [x] 4.5 Migrar `client/src/pages/reports/sla.tsx` para usar `DateRangeFilter`
    - Remover Popover + Calendar inline e botão "Aplicar Filtros" para período
    - Adicionar states `timeFilter` e `calendarOpen`
    - Importar e usar `<DateRangeFilter />`
    - Ajustar lógica de fetch para usar dateRange diretamente (auto-aplicar)
    - _Requirements: 1.1, 1.7_

  - [x] 4.6 Migrar `client/src/pages/logs.tsx` para usar `DateRangeFilter`
    - Remover os dois `<Input type="date" />` (startDate e endDate)
    - Adicionar states `timeFilter`, `dateRange`, `calendarOpen`
    - Importar e usar `<DateRangeFilter />`
    - Adaptar lógica de filtro para usar dateRange em vez de strings de data
    - _Requirements: 1.1, 1.8_

- [x] 5. Checkpoint - Verificar filtros de data
  - Garantir que todas as telas migradas usam DateRangeFilter corretamente
  - Perguntar ao usuário se há dúvidas

- [x] 6. Corrigir cores hardcoded e spinners
  - [x] 6.1 Substituir spinners hardcoded por `LoadingSpinner` nas páginas de Reports
    - `client/src/pages/reports/sla.tsx`: substituir `<div className="animate-spin ... border-blue-500">` por `<LoadingSpinner size="lg" />`
    - `client/src/pages/reports/clients.tsx`: mesma substituição
    - `client/src/pages/reports/department.tsx`: mesma substituição
    - _Requirements: 3.2_

  - [x] 6.2 Substituir spinners hardcoded por `LoadingSpinner` nos componentes de Charts
    - `client/src/components/charts/modern-sla-bar-chart.tsx`: substituir spinner inline por `<LoadingSpinner size="lg" />`
    - `client/src/components/charts/performance-bar-chart.tsx`: mesma substituição
    - _Requirements: 3.2_

  - [x] 6.3 Corrigir cores hardcoded nos estados vazios e tooltips dos Charts
    - `modern-sla-bar-chart.tsx`: substituir `bg-white` → `bg-card`, `border-gray-200` → `border-border`, `text-gray-900` → `text-foreground`, `text-gray-600` → `text-muted-foreground`, `text-gray-500` → `text-muted-foreground`, `text-gray-400` → `text-muted-foreground`, `bg-gray-100` → `bg-muted`
    - `performance-bar-chart.tsx`: mesmas substituições nos tooltips e estados vazios
    - _Requirements: 3.4_

  - [x] 6.4 Corrigir página 404 (`client/src/pages/not-found.tsx`)
    - Substituir `bg-gray-50` → `bg-background`, `text-red-500` → `text-destructive`, `text-gray-900` → `text-foreground`, `text-gray-600` → `text-muted-foreground`
    - Adicionar `useI18n()` e substituir textos em inglês por `formatMessage('not_found.title')` e `formatMessage('not_found.description')`
    - _Requirements: 3.3, 5.1_

- [x] 7. Limpar mapeamentos não utilizados
  - [x] 7.1 Remover `PRIORITY_COLORS` e `STATUS_COLORS` de `client/src/lib/utils.ts`
    - Esses mapeamentos não são importados por nenhum componente
    - _Requirements: 4.2_

- [x] 8. Checkpoint - Verificar consistência visual
  - Garantir que spinners, cores e página 404 estão corretos
  - Perguntar ao usuário se há dúvidas

- [ ]* 9. Testes
  - [ ]* 9.1 Escrever teste de propriedade para paridade de chaves i18n
    - **Property 1: Paridade de chaves i18n entre pt-BR e en-US**
    - Usar fast-check para gerar caminhos de chaves aleatórios e verificar que ambos os arquivos contêm exatamente o mesmo conjunto de chaves
    - **Validates: Requirements 5.5**

  - [ ]* 9.2 Escrever testes unitários para `LoadingSpinner`
    - Verificar renderização com classe `border-primary`
    - Verificar os 3 tamanhos (sm, md, lg)
    - _Requirements: 3.1_

  - [ ]* 9.3 Escrever testes unitários para `filterNavItems`
    - Verificar filtragem correta por role (admin vê tudo, customer vê subset)
    - Verificar que itens sem a role do usuário são excluídos
    - _Requirements: 2.1_

- [x] 10. Atualizar versionamento
  - [x] 10.1 Atualizar `client/public/version.json`
    - Definir `current` como `1.2.4`
    - Definir `releaseDate` como `2026-02-16`
    - Adicionar entrada na lista `versions` com versão 1.2.4, data 2026-02-16, tipo "update"
    - Listar as correções realizadas na seção `changes.fixed`
    - _Requirements: 6.1_

- [ ] 11. Checkpoint final
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Nenhuma alteração de backend ou banco de dados é necessária
