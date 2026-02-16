# Plano de Implementação: Correção de N+1 Queries

## Visão Geral

Implementação em 3 fases das correções de N+1 queries, começando pelo query builder reutilizável e avançando dos problemas mais críticos para os de menor impacto. Cada fase é independente e pode ser validada separadamente.

## Tasks

- [ ] 1. Criar o ticketBaseQuery e mapTicketResult reutilizáveis
  - [ ] 1.1 Criar o método privado `ticketBaseQuery()` na classe `DatabaseStorage` em `server/database-storage.ts`
    - Extrair a lógica de SELECT com JOINs do `getTicketInternal` para um método reutilizável
    - Incluir LEFT JOINs para: customers, officials, departments, incidentTypes, categories
    - Definir o tipo `TicketBaseQueryResult` inferido do retorno
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 1.2 Criar o método privado `mapTicketResult()` na classe `DatabaseStorage`
    - Extrair a lógica de mapeamento do `getTicketInternal` para um método reutilizável
    - Converter resultado flat dos JOINs para o formato de objeto Ticket
    - Tratar campos nulos de customer/official/department
    - _Requirements: 1.4, 10.1, 10.2_
  - [ ] 1.3 Refatorar `getTicketInternal` para usar `ticketBaseQuery` e `mapTicketResult`
    - Substituir a query inline por `ticketBaseQuery().where(eq(tickets.id, id)).limit(1)`
    - Usar `mapTicketResult` para o mapeamento
    - Garantir que o comportamento é idêntico ao original
    - _Requirements: 10.1_
  - [ ]* 1.4 Escrever teste de propriedade para equivalência de dados
    - **Property 1: Equivalência de dados após otimização**
    - **Validates: Requirements 10.1, 10.2, 1.1**
  - [ ]* 1.5 Escrever teste de propriedade para mapeamento de resultado
    - **Property 4: Mapeamento produz estrutura válida de Ticket**
    - **Validates: Requirements 1.4**

- [ ] 2. Fase 1A — Corrigir getTickets e getTicketReplies (Problemas #1 e #4)
  - [ ] 2.1 Criar método `getTicketRepliesBatch(ticketIds: number[])` no `DatabaseStorage`
    - Buscar todas as replies dos ticketIds em uma única query com LEFT JOIN em users
    - Retornar `Map<number, TicketReply[]>` agrupado por ticket_id
    - Tratar array vazio retornando Map vazio
    - _Requirements: 2.2, 2.3_
  - [ ] 2.2 Criar método `getOfficialDepartmentsBatch(officialIds: number[])` no `DatabaseStorage`
    - Buscar departamentos de múltiplos officials em uma única query com INNER JOIN em departments
    - Retornar `Map<number, string[]>` agrupado por official_id
    - Tratar array vazio retornando Map vazio
    - _Requirements: 2.4_
  - [ ] 2.3 Refatorar `getTickets()` para usar ticketBaseQuery + batch queries
    - Usar `ticketBaseQuery()` para buscar todos os tickets com JOINs
    - Usar `getTicketRepliesBatch()` para buscar todas as replies em batch
    - Usar `getOfficialDepartmentsBatch()` para buscar departamentos em batch
    - Montar resultado em memória usando Maps
    - _Requirements: 2.1, 2.4_
  - [ ] 2.4 Refatorar `getTicketReplies(ticketId)` para usar LEFT JOIN com users
    - Substituir o loop com Promise.all por uma única query com LEFT JOIN
    - Manter a interface pública inalterada
    - _Requirements: 2.2_

- [ ] 3. Fase 1B — Corrigir métodos de filtro e requery (Problemas #2 e #3)
  - [ ] 3.1 Refatorar `getTicketsByStatus()` para usar ticketBaseQuery
    - Substituir query + getTicketInternal por `ticketBaseQuery().where(eq(tickets.status, status))`
    - Usar `mapTicketResult` para mapear resultados
    - _Requirements: 3.1_
  - [ ] 3.2 Refatorar `getTicketsByCustomerId()` para usar ticketBaseQuery
    - Substituir query + getTicketInternal por `ticketBaseQuery().where(eq(tickets.customer_id, customerId))`
    - _Requirements: 3.2_
  - [ ] 3.3 Refatorar `getTicketsByOfficialId()` para usar ticketBaseQuery
    - Substituir query + getTicketInternal por `ticketBaseQuery().where(eq(tickets.assigned_to_id, officialId))`
    - _Requirements: 3.3_
  - [ ] 3.4 Refatorar `getRecentTickets()` para usar ticketBaseQuery
    - Substituir query + getTicketInternal por `ticketBaseQuery().orderBy(desc(tickets.created_at)).limit(limit)`
    - _Requirements: 3.4_
  - [ ]* 3.5 Escrever teste de propriedade para filtros
    - **Property 2: Filtros preservam semântica**
    - **Validates: Requirements 3.1, 3.2, 3.3, 1.2**
  - [ ]* 3.6 Escrever teste de propriedade para ordenação e limite
    - **Property 3: Ordenação e limite são respeitados**
    - **Validates: Requirements 3.4**

- [ ] 4. Fase 1C — Corrigir enriquecimento de clientes (Problema #8)
  - [ ] 4.1 Refatorar o endpoint de listagem de clientes em `server/routes.ts`
    - Substituir o `Promise.all` com `storage.getUser()` individual por query batch com `inArray`
    - Montar Map de userId para userData
    - Enriquecer clientes em memória usando o Map
    - _Requirements: 4.1, 4.2_

- [ ] 5. Checkpoint Fase 1 — Validar correções de maior impacto
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Fase 2A — Corrigir métricas de relatórios (Problemas #9 e #10)
  - [ ] 6.1 Criar método `getMetricsGroupedByOfficial()` no `DatabaseStorage`
    - Calcular avg first response time e avg resolution time agrupados por official_id em uma única query
    - Usar a mesma lógica de cálculo de `calculateEffectiveTime` existente
    - Retornar `Map<number, { avgFirstResponse: number; avgResolution: number }>`
    - _Requirements: 5.1, 5.3_
  - [ ] 6.2 Criar método `getMetricsGroupedByDepartment()` no `DatabaseStorage`
    - Calcular avg first response time e avg resolution time agrupados por department_id em uma única query
    - Retornar `Map<number, { avgFirstResponse: number; avgResolution: number }>`
    - _Requirements: 5.2, 5.3_
  - [ ] 6.3 Refatorar `server/routes/reports.ts` para usar as funções agrupadas
    - Substituir os 2 blocos de `Promise.all` com `getAverageFirstResponseTimeByUserRole`/`getAverageResolutionTimeByUserRole` individuais
    - Usar `getMetricsGroupedByOfficial()` e `getMetricsGroupedByDepartment()` em vez dos loops
    - _Requirements: 5.1, 5.2_
  - [ ]* 6.4 Escrever teste de propriedade para métricas agrupadas
    - **Property 5: Métricas agrupadas são equivalentes às individuais**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 7. Fase 2B — Corrigir SLA breach e digest (Problemas #12 e #13)
  - [ ] 7.1 Refatorar verificação de SLA breach em `server/services/email-notification-service.ts`
    - Pré-carregar históricos de status em batch com `inArray` por ticket_id
    - Pré-carregar dados de customers em batch com `inArray`
    - Agrupar em Maps e usar lookup em memória no loop
    - _Requirements: 6.1, 6.2_
  - [ ] 7.2 Refatorar digest de participantes em `server/services/email-notification-service.ts`
    - Buscar todos os participantes de todos os tickets ativos em uma única query batch
    - Agrupar por ticket_id em Map
    - _Requirements: 6.3_

- [ ] 8. Checkpoint Fase 2 — Validar correções de relatórios e background
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Fase 3A — Corrigir categorias e tickets por categoria (Problemas #5 e #6)
  - [ ] 9.1 Refatorar `getCategories()` para usar LEFT JOINs
    - Adicionar LEFT JOIN com incidentTypes e companies na query principal
    - Remover o loop de enriquecimento individual
    - _Requirements: 7.1_
  - [ ] 9.2 Refatorar `getTicketsByCategory()` para usar LEFT JOIN
    - Adicionar LEFT JOIN com customers na query principal
    - Remover o loop de enriquecimento individual
    - _Requirements: 7.2_
  - [ ]* 9.3 Escrever teste de propriedade para enriquecimento via JOIN
    - **Property 6: Enriquecimento via JOIN é equivalente ao individual**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 10. Fase 3B — Corrigir departamentos de subordinados e validação de participantes (Problemas #7, #11)
  - [ ] 10.1 Refatorar busca de departamentos de subordinados em `server/routes.ts`
    - Substituir os 3 loops `for (const subordinate of subordinates)` por query batch com `inArray`
    - Aplicar nos blocos de manager, supervisor e no terceiro local identificado
    - _Requirements: 8.1_
  - [ ] 10.2 Refatorar validação de usuários em `server/routes/ticket-participants.ts`
    - Substituir `Promise.all` com `storage.getUser()` individual por query batch com `inArray`
    - Verificar IDs faltantes comparando resultado com input
    - Retornar erro com lista de IDs não encontrados
    - _Requirements: 9.1, 9.2_
  - [ ]* 10.3 Escrever teste de propriedade para validação batch
    - **Property 7: Validação batch identifica IDs faltantes corretamente**
    - **Validates: Requirements 9.2**

- [ ] 11. Checkpoint Final — Validação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental entre fases
- Testes de propriedade validam propriedades universais de corretude
- A Fase 1 é a mais crítica e deve ser priorizada (redução de ~95% nas queries das APIs principais)
