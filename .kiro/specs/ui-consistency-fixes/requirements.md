# Documento de Requisitos

## Introdução

Este documento define os requisitos para correções de consistência visual (UI) no sistema GestaoTickets, baseado no relatório de auditoria visual (`docs/CODEX_UI_CONSISTENCY_REPORT.md`). O objetivo é eliminar padrões duplicados, centralizar componentes reutilizáveis e garantir que todas as telas sigam os mesmos tokens de tema e convenções de i18n.

## Glossário

- **DateRangeFilter**: Componente padronizado de filtro de período localizado em `client/src/components/ui/date-range-filter.tsx`
- **Token_de_Tema**: Classe CSS baseada em variáveis do tema Tailwind (ex: `bg-background`, `text-foreground`, `border-primary`, `text-muted-foreground`)
- **Cor_Hardcoded**: Classe CSS com valor fixo de cor (ex: `bg-gray-50`, `text-red-500`, `border-blue-500`) que ignora o tema
- **Nav_Config**: Arquivo centralizado de configuração de itens de navegação que serve como fonte única de verdade para menus
- **LoadingSpinner**: Componente padronizado de indicador de carregamento que utiliza tokens de tema
- **StatusBadge**: Componente existente em `client/src/components/tickets/status-badge.tsx` para exibição de status de tickets
- **PriorityBadge**: Componente existente em `client/src/components/tickets/status-badge.tsx` para exibição de prioridade de tickets
- **formatMessage**: Função do hook `useI18n()` usada para internacionalização de strings visíveis ao usuário
- **Sidebar_Layout**: Sidebar principal do layout em `client/src/components/layout/sidebar.tsx`
- **Header**: Componente de cabeçalho em `client/src/components/layout/header.tsx` que contém menu mobile com labels hardcoded
- **Sidebar_UI**: Sidebar não utilizada em `client/src/components/ui/sidebar.tsx`

## Requisitos

### Requisito 1: Padronização do Filtro de Período

**User Story:** Como usuário do sistema, eu quero que o filtro de período funcione da mesma forma em todas as telas, para que eu tenha uma experiência previsível e consistente ao navegar entre Dashboard, Tickets, Relatórios e Logs.

#### Critérios de Aceitação

1. THE DateRangeFilter SHALL ser o único componente utilizado para seleção de período em todas as telas do sistema (Dashboard, Satisfaction Dashboard, Tickets, Reports e Logs)
2. WHEN o usuário seleciona um período predefinido no DateRangeFilter, THE DateRangeFilter SHALL aplicar o filtro automaticamente sem necessidade de botão "Aplicar Filtros"
3. WHEN o usuário seleciona "Período Personalizado" no DateRangeFilter, THE DateRangeFilter SHALL exibir um calendário range picker via Popover para seleção de datas de início e fim
4. WHEN o usuário seleciona as datas de início e fim no calendário, THE DateRangeFilter SHALL fechar o calendário automaticamente e aplicar o filtro
5. THE DateRangeFilter SHALL oferecer as opções predefinidas: "Esta Semana", "Semana Passada", "Este Mês" e "Período Personalizado", todas internacionalizadas via formatMessage
6. WHEN a tela de Tickets utiliza o DateRangeFilter, THE sistema SHALL remover a implementação duplicada de Popover + Calendar que existe atualmente na página
7. WHEN as telas de Reports utilizam o DateRangeFilter, THE sistema SHALL remover as implementações duplicadas de range picker e o botão "Aplicar Filtros" das páginas performance, clients, department e sla
8. WHEN a tela de Logs utiliza o DateRangeFilter, THE sistema SHALL substituir os inputs nativos `type="date"` pelo DateRangeFilter

### Requisito 2: Fonte Única de Navegação

**User Story:** Como desenvolvedor do sistema, eu quero que os itens de menu sejam definidos em um único lugar, para que alterações de rota, label ou permissão sejam refletidas automaticamente na Sidebar desktop, no menu mobile e no Header.

#### Critérios de Aceitação

1. THE Nav_Config SHALL definir todos os itens de navegação do sistema em um único arquivo, incluindo href, ícone, chave i18n e roles permitidas
2. WHEN a Sidebar_Layout renderiza o menu desktop, THE Sidebar_Layout SHALL consumir os itens de navegação exclusivamente do Nav_Config
3. WHEN a Sidebar_Layout renderiza o menu mobile (Sheet), THE Sidebar_Layout SHALL consumir os itens de navegação exclusivamente do Nav_Config
4. WHEN o Header renderiza o menu mobile, THE Header SHALL consumir os itens de navegação exclusivamente do Nav_Config em vez de usar links com labels hardcoded
5. THE sistema SHALL remover o arquivo Sidebar_UI (`client/src/components/ui/sidebar.tsx`) que não é utilizado por nenhum componente
6. WHEN os itens de navegação são exibidos, THE sistema SHALL utilizar formatMessage para todas as labels, eliminando strings hardcoded em PT-BR no Header

### Requisito 3: Eliminação de Cores Hardcoded

**User Story:** Como usuário do sistema, eu quero que todas as telas respeitem o tema ativo (claro/escuro), para que a interface seja visualmente coesa independentemente do tema selecionado.

#### Critérios de Aceitação

1. THE LoadingSpinner SHALL ser um componente padronizado que utiliza exclusivamente Token_de_Tema (`border-primary`) para a cor do spinner
2. WHEN qualquer tela exibe um indicador de carregamento, THE sistema SHALL utilizar o componente LoadingSpinner em vez de spinners inline com Cor_Hardcoded (`border-blue-500`)
3. WHEN a página 404 (not-found) é exibida, THE sistema SHALL utilizar Token_de_Tema (`bg-background`, `text-foreground`, `text-destructive`, `text-muted-foreground`) em vez de Cor_Hardcoded (`bg-gray-50`, `text-red-500`, `text-gray-900`, `text-gray-600`)
4. WHEN os componentes de gráficos exibem estados vazios ou de carregamento, THE sistema SHALL utilizar Token_de_Tema (`bg-muted`, `text-muted-foreground`) em vez de Cor_Hardcoded (`bg-gray-100`, `text-gray-400`, `text-gray-500`)

### Requisito 4: Padronização de Badges de Status e Prioridade

**User Story:** Como usuário do sistema, eu quero que status e prioridade sejam exibidos com a mesma aparência em todas as telas, para que eu identifique rapidamente a informação sem confusão visual.

#### Critérios de Aceitação

1. THE sistema SHALL utilizar exclusivamente StatusBadge e PriorityBadge para exibir status e prioridade de tickets em todas as telas
2. THE sistema SHALL remover os mapeamentos não utilizados `PRIORITY_COLORS` e `STATUS_COLORS` do arquivo `client/src/lib/utils.ts`
3. IF uma tela utiliza classes CSS globais de status/prioridade (ex: `bg-status-high`) em vez de StatusBadge/PriorityBadge, THEN THE sistema SHALL migrar para o uso dos componentes padronizados

### Requisito 5: Internacionalização Completa

**User Story:** Como usuário do sistema, eu quero que todas as telas estejam traduzidas corretamente, para que a experiência seja consistente ao alternar entre PT-BR e EN-US.

#### Critérios de Aceitação

1. WHEN a página 404 é exibida, THE sistema SHALL utilizar formatMessage para todos os textos visíveis ("Página não encontrada", mensagem de orientação) em vez de strings hardcoded em inglês
2. WHEN o Header exibe o menu mobile, THE sistema SHALL utilizar formatMessage para todas as labels de navegação em vez de strings hardcoded em PT-BR
3. WHEN o Header exibe o dropdown do usuário, THE sistema SHALL utilizar formatMessage para os textos "Minha Conta", "Modo escuro", "Configurações" e "Sair"
4. WHEN o Header exibe a mensagem de boas-vindas, THE sistema SHALL utilizar formatMessage com variável dinâmica para o nome do usuário
5. WHEN novas chaves de tradução são adicionadas, THE sistema SHALL incluí-las em ambos os arquivos `pt-BR.json` e `en-US.json`

### Requisito 6: Atualização de Versionamento

**User Story:** Como administrador do sistema, eu quero que o arquivo de versão reflita as correções realizadas, para que o changelog esteja atualizado.

#### Critérios de Aceitação

1. WHEN as correções de consistência visual são concluídas, THE sistema SHALL atualizar o arquivo `client/public/version.json` com versão 1.2.4, data 2026-02-16 e a lista de correções realizadas
