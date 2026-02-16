# Documento de Requisitos — Correção de N+1 Queries

## Introdução

O sistema de gestão de tickets (helpdesk) apresenta 13 padrões de N+1 queries distribuídos em 6 arquivos do servidor. Em cenários com 100 tickets, o sistema pode executar mais de 1.100 queries em uma única chamada de API, quando deveria executar entre 1 e 5. Este documento define os requisitos para a correção sistemática desses problemas, organizados em 3 fases de prioridade.

A abordagem principal é extrair a lógica de JOINs do `getTicketInternal` em um query builder reutilizável (`ticketBaseQuery()`) que possa ser composto com diferentes WHERE clauses, paginação e ordenação.

## Glossário

- **Query_Builder**: Função reutilizável que constrói a query base com JOINs para tickets, podendo ser composta com filtros, paginação e ordenação adicionais
- **N+1_Query**: Padrão de acesso ao banco onde 1 query busca N itens e N queries adicionais buscam dados relacionados individualmente
- **Batch_Query**: Query que busca dados relacionados de múltiplos registros de uma vez usando `inArray` ou JOINs
- **Storage**: Camada de acesso a dados (`DatabaseStorage`) que encapsula todas as queries ao PostgreSQL via Drizzle ORM
- **Enriquecimento**: Processo de adicionar dados relacionados (customer, official, department) a um registro base de ticket
- **Scheduler**: Processo em background que executa tarefas periódicas como verificação de SLA breach e envio de digests

## Requisitos

### Requisito 1: Query Builder Reutilizável para Tickets

**User Story:** Como desenvolvedor, quero um query builder reutilizável para tickets com JOINs pré-configurados, para que todos os endpoints de listagem de tickets usem queries otimizadas sem duplicação de código.

#### Critérios de Aceitação

1. THE Query_Builder SHALL produzir uma query base com LEFT JOINs para customers, officials, departments, incident_types e categories
2. WHEN o Query_Builder é composto com uma WHERE clause, THE Query_Builder SHALL retornar apenas os tickets que satisfazem a condição, com todos os dados relacionados já incluídos
3. WHEN o Query_Builder é composto com paginação e ordenação, THE Query_Builder SHALL aplicar LIMIT, OFFSET e ORDER BY na query SQL sem buscar todos os registros em memória
4. THE Query_Builder SHALL mapear os resultados dos JOINs para o formato de objeto Ticket esperado pelo restante do sistema

### Requisito 2: Eliminação de N+1 no getTickets e getTicketReplies

**User Story:** Como usuário do sistema, quero que a listagem geral de tickets carregue rapidamente, para que eu possa navegar pelos tickets sem esperar vários segundos.

#### Critérios de Aceitação

1. WHEN o método getTickets é chamado, THE Storage SHALL buscar todos os tickets com dados de customer, official e department em no máximo 3 queries ao banco de dados
2. WHEN o método getTicketReplies é chamado, THE Storage SHALL buscar todas as replies de um ticket com dados de usuário em uma única query usando LEFT JOIN
3. WHEN o método getTickets busca replies em batch, THE Storage SHALL usar uma única query com inArray para buscar todas as replies de todos os tickets de uma vez
4. WHEN o método getTickets busca departamentos de officials, THE Storage SHALL usar uma única query batch com inArray para buscar todos os departamentos de todos os officials de uma vez

### Requisito 3: Eliminação de Requery por ID nos Métodos de Filtro

**User Story:** Como usuário do sistema, quero que a filtragem de tickets por status, cliente ou atendente seja tão rápida quanto a listagem geral, para que os filtros respondam instantaneamente.

#### Critérios de Aceitação

1. WHEN o método getTicketsByStatus é chamado, THE Storage SHALL buscar tickets filtrados com todos os dados relacionados em uma única query usando o Query_Builder, sem chamar getTicketInternal individualmente
2. WHEN o método getTicketsByCustomerId é chamado, THE Storage SHALL buscar tickets filtrados com todos os dados relacionados em uma única query usando o Query_Builder
3. WHEN o método getTicketsByOfficialId é chamado, THE Storage SHALL buscar tickets filtrados com todos os dados relacionados em uma única query usando o Query_Builder
4. WHEN o método getRecentTickets é chamado, THE Storage SHALL buscar tickets recentes com todos os dados relacionados em uma única query usando o Query_Builder com ORDER BY e LIMIT

### Requisito 4: Eliminação de N+1 no Enriquecimento de Clientes

**User Story:** Como usuário do sistema, quero que a listagem de clientes carregue rapidamente, para que eu possa buscar e gerenciar clientes sem atrasos.

#### Critérios de Aceitação

1. WHEN o endpoint de listagem de clientes enriquece clientes com dados de usuário, THE Sistema SHALL buscar todos os usuários relacionados em uma única query batch usando inArray, em vez de uma query por cliente
2. WHEN os dados de usuários são buscados em batch, THE Sistema SHALL montar um Map de userId para userData e enriquecer os clientes em memória sem queries adicionais

### Requisito 5: Eliminação de N+1 nas Métricas de Relatórios

**User Story:** Como gestor, quero que os relatórios de métricas por atendente e departamento carreguem rapidamente, para que eu possa analisar a performance da equipe sem esperar longos tempos de processamento.

#### Critérios de Aceitação

1. WHEN o relatório calcula métricas por atendente, THE Sistema SHALL calcular tempo médio de primeira resposta e tempo médio de resolução para todos os atendentes em uma única query agrupada por official_id, em vez de 2 queries por atendente
2. WHEN o relatório calcula métricas por departamento, THE Sistema SHALL calcular tempo médio de primeira resposta e tempo médio de resolução para todos os departamentos em uma única query agrupada por department_id, em vez de 2 queries por departamento
3. WHEN as métricas agrupadas são calculadas, THE Storage SHALL fornecer funções dedicadas (getMetricsGroupedByOfficial e getMetricsGroupedByDepartment) que retornam um Map com os resultados agrupados

### Requisito 6: Eliminação de N+1 no Scheduler de SLA e Digest

**User Story:** Como administrador do sistema, quero que os jobs de background (verificação de SLA e digest de participantes) executem de forma eficiente, para que não sobrecarreguem o banco de dados durante a execução periódica.

#### Critérios de Aceitação

1. WHEN o scheduler verifica SLA breach para tickets abertos, THE Sistema SHALL pré-carregar todas as configurações de SLA, históricos de status e dados de customers em batch antes do loop de processamento
2. WHEN o scheduler verifica SLA breach, THE Sistema SHALL usar no máximo 3 queries batch (SLA configs, status history, customers) em vez de 2-3 queries por ticket
3. WHEN o serviço de email monta digests de participantes, THE Sistema SHALL buscar todos os participantes de todos os tickets ativos em uma única query batch com inArray, em vez de uma query por ticket

### Requisito 7: Eliminação de N+1 em Categorias e Tickets por Categoria

**User Story:** Como usuário do sistema, quero que a listagem de categorias e tickets por categoria carregue rapidamente, para que a navegação por categorias seja fluida.

#### Critérios de Aceitação

1. WHEN o método getCategoriesPaginated enriquece categorias, THE Storage SHALL usar LEFT JOINs para incident_types e companies na query original, em vez de queries individuais por categoria
2. WHEN o método getTicketsByCategory é chamado, THE Storage SHALL usar LEFT JOIN com customers na query original, em vez de uma query por ticket para buscar o customer

### Requisito 8: Eliminação de N+1 em Departamentos de Subordinados

**User Story:** Como gestor (manager/supervisor), quero que a listagem de tickets dos meus subordinados carregue rapidamente, para que eu possa supervisionar a equipe sem atrasos.

#### Critérios de Aceitação

1. WHEN o sistema busca departamentos de subordinados para filtrar tickets, THE Sistema SHALL usar uma única query batch com inArray para buscar todos os departamentos de todos os subordinados de uma vez, em vez de uma query por subordinado

### Requisito 9: Eliminação de N+1 na Validação de Participantes

**User Story:** Como usuário do sistema, quero que a adição de participantes a um ticket seja eficiente, para que a operação não demore mesmo com múltiplos participantes.

#### Critérios de Aceitação

1. WHEN múltiplos usuários são adicionados como participantes de um ticket, THE Sistema SHALL validar a existência de todos os usuários em uma única query batch com inArray, em vez de uma query por usuário
2. IF algum dos usuários não for encontrado na validação batch, THEN THE Sistema SHALL retornar um erro identificando quais IDs de usuário não foram encontrados

### Requisito 10: Preservação de Comportamento e Compatibilidade

**User Story:** Como desenvolvedor, quero que as otimizações de queries preservem o comportamento existente do sistema, para que nenhuma funcionalidade seja quebrada durante a refatoração.

#### Critérios de Aceitação

1. THE Storage SHALL retornar os mesmos dados no mesmo formato para todos os métodos otimizados, preservando a estrutura de objetos Ticket, TicketReply, Customer e Category
2. WHEN o Query_Builder é usado em métodos que antes chamavam getTicketInternal, THE Storage SHALL incluir os mesmos campos (department_name, incident_type_name, category_name) no resultado
3. WHEN métodos otimizados são chamados, THE Storage SHALL respeitar os filtros de multi-tenancy (company_id) exatamente como antes da otimização
4. WHEN métodos otimizados são chamados, THE Storage SHALL respeitar as regras de visibilidade por role (admin, company_admin, manager, supervisor, support, customer) exatamente como antes da otimização
