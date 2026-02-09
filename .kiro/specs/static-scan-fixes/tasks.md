# Plano de Implementação: Correções do Scan Estático

## Visão Geral

Implementação incremental das correções dos 12 achados do relatório de análise estática, organizadas por dependência e severidade. Cada tarefa constrói sobre as anteriores, começando pelos helpers compartilhados e terminando com a consolidação e limpeza.

## Tarefas

- [x] 1. Criar helpers compartilhados (company filter e scheduler window)
  - [x] 1.1 Criar `server/utils/company-filter.ts` com funções `parseCompanyFilter()` e `expandCompanyFilter()`
    - `parseCompanyFilter(filter: string)` retorna predicado `(companyId: number) => boolean`
    - Suportar formatos: `*`, vazio, `<>id`, `id1,id2,...`, `id`
    - Ignorar valores não-numéricos em listas e logar warning via `logger.warn()`
    - `expandCompanyFilter(filter, allCompanyIds)` retorna array de IDs filtrados
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 12.1_

  - [ ]* 1.2 Escrever testes de propriedade para `parseCompanyFilter`
    - **Property 4: parseCompanyFilter interpreta todos os formatos corretamente**
    - Instalar `fast-check` como devDependency
    - Testar com IDs aleatórios e formatos variados (100+ iterações)
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [x] 1.3 Criar `server/utils/scheduler-window.ts` com função `isWithinAllowedWindow(now?: Date): boolean`
    - Janela permitida: 06:01 às 20:59 (inclusive)
    - Aceitar `Date` opcional (default: `new Date()`)
    - _Requirements: 11.2_

  - [ ]* 1.4 Escrever testes de propriedade para `isWithinAllowedWindow`
    - **Property 9: Janela de horário do scheduler**
    - Gerar horas/minutos aleatórios e verificar resultado esperado
    - **Validates: Requirements 11.2, 11.3**

- [x] 2. Corrigir ciclo de alerta waiting_customer (Crítico)
  - [x] 2.1 Corrigir `checkWaitingCustomerAutoClose()` em `server/services/email-notification-service.ts`
    - Adicionar cálculo de `effectiveAlertSentAt`: se `alert_sent_at < entered_at`, tratar como `null`
    - Usar `effectiveAlertSentAt` nas comparações de 48h e 24h
    - Remover a função local `parseFilter` e importar de `server/utils/company-filter.ts`
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Adicionar reset de `waiting_customer_alert_sent_at` na transição para `waiting_customer`
    - Localizar o handler de mudança de status para `waiting_customer` e adicionar `set({ waiting_customer_alert_sent_at: null })`
    - Verificar que o reset na resposta do cliente já existe em `server/api/ticket-replies.ts:207`
    - _Requirements: 1.2, 1.3_

  - [ ]* 2.3 Escrever testes de propriedade para lógica de ciclo de alerta
    - **Property 1: Effective alert_sent_at respeita o ciclo atual**
    - **Property 2: Reset de alert_sent_at em novo ciclo**
    - **Property 3: Scheduler não encerra ticket dentro do período de espera**
    - Gerar combinações aleatórias de entered_at, alert_sent_at e now
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 3. Corrigir scheduler para usar helpers compartilhados
  - [x] 3.1 Refatorar `SchedulerService` em `server/services/scheduler-service.ts`
    - Remover método privado `parseCompanyFilter` (lógica morta)
    - Importar `expandCompanyFilter` de `server/utils/company-filter.ts`
    - Refatorar `generateDailyDigest()` e `generateWeeklyDigest()` para usar `expandCompanyFilter` em vez de `split(',').map(parseInt)`
    - Substituir verificações inline de horário por `isWithinAllowedWindow()` em `checkTickets()`, `runDailyDigest()` e `runWeeklyDigest()`
    - _Requirements: 2.1, 11.1, 12.1, 12.2_

- [x] 4. Checkpoint — Verificar que helpers e scheduler funcionam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Corrigir lookup de prioridades para admin (Crítico)
  - [x] 5.1 Adicionar método `getPriorityById(id: number)` ao `PriorityService` em `server/services/priority-service.ts`
    - Query direta: `db.select().from(departmentPriorities).where(eq(departmentPriorities.id, id)).limit(1)`
    - Retornar `DepartmentPriority | null`
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Refatorar `updatePriority()` e `deletePriority()` em `server/api/department-priorities.ts`
    - Substituir `getAllCompanyPriorities(companyIdToSearch)` + `find` por `getPriorityById(priorityId)`
    - Verificar permissão usando `company_id` do registro retornado
    - Admin pode operar em qualquer empresa; não-admin só na própria
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.3 Escrever testes de propriedade para controle de acesso de prioridades
    - **Property 5: Controle de acesso por company_id em operações de prioridade**
    - Gerar combinações de userRole, userCompanyId e priority.company_id
    - **Validates: Requirements 3.3**

- [x] 6. Corrigir fallback de prioridades e remover debug logs (Alto)
  - [x] 6.1 Atualizar `server/utils/priority-fallback.ts` para refletir comportamento real
    - Alterar `testPriorityFallback()` para esperar `source: 'none'` e lista vazia
    - Remover expectativa de 4 prioridades padrão e `source: 'default'`
    - _Requirements: 4.3_

  - [x] 6.2 Remover `console.log` de debug em `shared/utils/priority-utils.ts`
    - Remover todos os `console.log` da função `getDepartmentPriorities` e demais
    - _Requirements: 5.1_

  - [x] 6.3 Substituir `console.log` por `logger.debug()` em `server/services/priority-service.ts`
    - Importar `logger` de `server/services/logger.ts`
    - Substituir `console.log` por `logger.debug()` com contexto estruturado
    - _Requirements: 5.2_

  - [ ]* 6.4 Escrever testes de propriedade para consistência do fallback
    - **Property 6: Consistência do fallback de prioridades**
    - Gerar companyId/departmentId aleatórios sem prioridades e verificar retorno
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 7. Parser CSV robusto e remoção de log sensível (Alto)
  - [x] 7.1 Instalar `csv-parse` e refatorar `importSLAConfigurationsCSV()` em `server/api/sla-configurations.ts`
    - Substituir split manual por `csv-parse/sync`
    - Normalizar CRLF antes do parse
    - Manter validação de cabeçalhos e campos obrigatórios
    - Refatorar verificação de duplicidade para consulta em lote
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 Remover log de payload sensível em `createSLAConfiguration()` em `server/api/sla-configurations.ts`
    - Remover `console.log('📋 [SLA CREATE] Dados recebidos:', JSON.stringify(input, null, 2))`
    - Substituir por `logger.debug('[SLA CREATE]', { departmentId: input.departmentId, companyId: input.companyId })`
    - _Requirements: 7.1, 7.2_

  - [ ]* 7.3 Escrever testes de propriedade para CSV parser
    - **Property 7: CSV round-trip — campos com caracteres especiais**
    - Gerar registros com vírgulas, aspas e quebras de linha; serializar e parsear
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 8. Checkpoint — Verificar correções de alto impacto
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Remoção do @ts-nocheck e correção de tipos (Médio)
  - [ ] 9.1 Remover `// @ts-nocheck` de `server/storage.ts` e corrigir erros de tipagem
    - Remover a diretiva da linha 1
    - Remover importação de `ticketPriorityEnum` se enum não existir no schema
    - Corrigir demais erros de tipo identificados por `getDiagnostics`
    - _Requirements: 8.1, 8.2_

- [ ] 10. Consolidar APIs de prioridades duplicadas (Médio)
  - [ ] 10.1 Migrar funções de `server/api/priorities.ts` para `server/api/department-priorities.ts`
    - Mover `getDepartmentPriorities` e `createDefaultPriorities` para `department-priorities.ts`
    - Resolver conflitos de nomes (funções já existem em ambos os arquivos)
    - _Requirements: 9.1_

  - [ ] 10.2 Atualizar `server/routes.ts` para importar de `department-priorities.ts`
    - Alterar imports que apontam para `./api/priorities` para `./api/department-priorities`
    - _Requirements: 9.2_

  - [ ] 10.3 Remover `server/api/priorities.ts`
    - Deletar o arquivo após confirmar que todas as referências foram migradas
    - _Requirements: 9.3_

- [ ] 11. Token seguro para pesquisa de satisfação (Médio)
  - [ ] 11.1 Refatorar `generateSurveyToken()` em `server/services/email-notification-service.ts`
    - Importar `crypto` do Node.js
    - Substituir `Math.random()` por `crypto.randomBytes(16).toString('hex')`
    - Formato: `survey_${hex32chars}`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 11.2 Escrever testes de propriedade para geração de token
    - **Property 8: Formato e entropia do token de pesquisa de satisfação**
    - Gerar múltiplos tokens e verificar formato, comprimento e unicidade
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 12. Checkpoint final — Verificar todas as correções
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade usam `fast-check` com Vitest (mínimo 100 iterações)
- Testes unitários cobrem edge cases e condições de erro específicas
