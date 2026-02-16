# Plano de Implementação: Correção de Erros TypeScript (Lint/Type Check)

## Visão Geral

Correção de 221 erros de TypeScript organizados em 6 fases incrementais, começando pelo arquivo mais afetado (storage.ts) e terminando com configuração de ESLint para prevenção.

## Tasks

- [x] 1. Corrigir nomenclatura camelCase → snake_case no MemStorage (server/storage.ts)
  - [x] 1.1 Corrigir propriedades camelCase nos objetos User criados em `initializeData()` e `createUser()`
    - Renomear `createdAt` → `created_at`, `updatedAt` → `updated_at`, `avatarUrl` → `avatar_url`, `adUser` → `ad_user`, `mustChangePassword` → `must_change_password`, `companyId` → `company_id`
    - Aplicar em todos os objetos User: adminUser, supportUser, customerUser, inactiveUser
    - Corrigir também `updateUser()`, `inactivateUser()`, `activateUser()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Corrigir propriedades camelCase nos objetos Customer criados em `initializeData()` e `createCustomer()`
    - Renomear `userId` → `user_id`, `avatarUrl` → `avatar_url`, `createdAt` → `created_at`, `updatedAt` → `updated_at`, `companyId` → `company_id`
    - Corrigir também `updateCustomer()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Corrigir propriedades camelCase nos objetos Official criados em `initializeData()` e `createOfficial()`
    - Renomear `departmentId` → `department_id`, `userId` → `user_id`, `isActive` → `is_active`, `avatarUrl` → `avatar_url`, `companyId` → `company_id`, `supervisorId` → `supervisor_id`, `managerId` → `manager_id`, `createdAt` → `created_at`, `updatedAt` → `updated_at`
    - Corrigir também `updateOfficial()`, `inactivateOfficial()`, `activateOfficial()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.4 Corrigir propriedades camelCase nos objetos Ticket criados em `initializeData()` e `createTicket()`
    - Renomear `ticketId` → `ticket_id`, `customerId` → `customer_id`, `customerEmail` → `customer_email`, `assignedToId` → `assigned_to_id`, `companyId` → `company_id`, `departmentId` → `department_id`, `incidentTypeId` → `incident_type_id`, `categoryId` → `category_id`, `createdAt` → `created_at`, `updatedAt` → `updated_at`, `firstResponseAt` → `first_response_at`, `resolvedAt` → `resolved_at`, `slaBreached` → `sla_breached`, `waitingCustomerAlertSentAt` → `waiting_customer_alert_sent_at`
    - Corrigir também `updateTicket()` e todos os acessos a propriedades de tickets em métodos de consulta
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.5 Corrigir propriedades camelCase nos objetos TicketReply e TicketStatusHistory
    - TicketReply: `ticketId` → `ticket_id`, `userId` → `user_id`, `createdAt` → `created_at`, `isInternal` → `is_internal`
    - TicketStatusHistory: `ticketId` → `ticket_id`, `oldStatus` → `old_status`, `newStatus` → `new_status`, `changedById` → `changed_by_id`, `createdAt` → `created_at`, `changeType` → `change_type`
    - Corrigir `createTicketReply()` e `addTicketStatusHistory()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.6 Corrigir propriedades camelCase nos objetos OfficialDepartment e SLADefinition
    - OfficialDepartment: `officialId` → `official_id`, `departmentId` → `department_id`, `createdAt` → `created_at`
    - SLADefinition: `responseTimeHours` → `response_time_hours`, `resolutionTimeHours` → `resolution_time_hours`, `companyId` → `company_id`, `createdAt` → `created_at`, `updatedAt` → `updated_at`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.7 Corrigir todos os acessos a propriedades camelCase em métodos de consulta e filtro do MemStorage
    - Atualizar comparações como `ticket.createdAt` → `ticket.created_at`, `ticket.customerId` → `ticket.customer_id`, `ticket.assignedToId` → `ticket.assigned_to_id`, etc.
    - Inclui métodos: `getTicketsByUserRole`, `getTicketsByUserRolePaginated`, `getTicketStatsByUserRole`, `getRecentTicketsByUserRole`, `getAverageFirstResponseTimeByUserRole`, `getAverageResolutionTimeByUserRole`, `getTicketStatsForDashboardByUserRole`, `getRecentTicketsForDashboardByUserRole`, `getTicketStats`, `getRecentTickets`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Checkpoint - Verificar storage.ts
  - Executar `npm run check` e confirmar que os erros de `server/storage.ts` foram eliminados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Corrigir erros nas rotas do server
  - [x] 3.1 Corrigir erros em `server/routes/service-providers.ts`
    - Corrigir acessos a propriedades inexistentes (TS2339)
    - Adicionar tipos explícitos a parâmetros de callbacks (TS7006)
    - Corrigir argumentos com tipos incompatíveis (TS2345)
    - Verificar que métodos chamados em `storage` existem na interface `IStorage`
    - _Requirements: 2.1, 2.4, 3.3, 4.1_

  - [x] 3.2 Corrigir erros em `server/routes/ticket-service-providers.ts`
    - Corrigir acessos a propriedades inexistentes (TS2339)
    - Adicionar tipos explícitos a parâmetros (TS7006)
    - Corrigir tipos incompatíveis (TS2345)
    - _Requirements: 2.1, 2.4, 3.3, 4.1_

  - [x] 3.3 Corrigir erros em `server/routes/department-service-providers.ts`
    - Corrigir acessos a propriedades inexistentes (TS2339)
    - Adicionar tipos explícitos a parâmetros (TS7006)
    - _Requirements: 2.1, 2.4, 4.1_

  - [x] 3.4 Corrigir erros restantes em outros arquivos do server
    - Corrigir indexação sem index signature (TS7053)
    - Corrigir incompatibilidade estrutural (TS2740/TS2352)
    - Adicionar tipos explícitos a variáveis com `any[]` implícito (TS7005/TS7034)
    - _Requirements: 2.1, 4.2, 4.3, 9.1, 9.2, 9.3_

- [x] 4. Corrigir declaração de tipos para módulo qrcode
  - Instalar `@types/qrcode` ou criar arquivo `server/types/qrcode.d.ts` com declaração mínima
  - Verificar compatibilidade com a versão instalada do `qrcode` (v1.5.4)
  - _Requirements: 7.1, 7.2_

- [x] 5. Checkpoint - Verificar server completo
  - Executar `npm run check` e confirmar que todos os erros do server foram eliminados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Corrigir erros nas páginas do client
  - [x] 6.1 Corrigir erros em `client/src/pages/inventory/catalog.tsx`
    - Corrigir propriedades inexistentes no tipo retornado por hooks (TS2339)
    - Ajustar tipagem de respostas paginadas (`.data`, `.pagination`)
    - Corrigir tipos incompatíveis em atribuições (TS2322)
    - _Requirements: 2.2, 2.3, 3.4_

  - [x] 6.2 Corrigir erros em `client/src/pages/inventory/suppliers.tsx`
    - Corrigir propriedades inexistentes (TS2339)
    - Ajustar tipagem de respostas
    - _Requirements: 2.2, 2.3_

  - [x] 6.3 Corrigir erros em `client/src/pages/inventory/assignments.tsx`
    - Corrigir propriedades inexistentes (TS2339)
    - Ajustar tipagem de respostas
    - Adicionar guard clauses para valores possivelmente undefined (TS18048)
    - _Requirements: 2.2, 2.3, 8.1, 8.2_

  - [x] 6.4 Corrigir erros em `client/src/pages/inventory/product-types.tsx`
    - Corrigir propriedades inexistentes (TS2339)
    - Ajustar tipagem de respostas
    - _Requirements: 2.2, 2.3_

  - [x] 6.5 Corrigir erros em `client/src/pages/inventory/movements.tsx`
    - Corrigir propriedades inexistentes (TS2339)
    - Ajustar tipagem de respostas
    - _Requirements: 2.2, 2.3_

  - [x] 6.6 Corrigir erros em `client/src/pages/reports/clients.tsx`
    - Adicionar imports faltantes de `format` do `date-fns` e `ptBR` do `date-fns/locale/pt-BR`
    - Corrigir tipo `SupportedLocale` se necessário
    - _Requirements: 6.1, 6.2, 6.3, 3.1_

  - [x] 6.7 Corrigir erros restantes em outros arquivos do client
    - Corrigir overloads inválidos do TanStack Query v5 (TS2769) - substituir `keepPreviousData` por `placeholderData: keepPreviousData`
    - Corrigir valores possivelmente undefined (TS18048)
    - Corrigir tipos incompatíveis restantes (TS2322/TS2345)
    - _Requirements: 5.1, 5.2, 8.1, 8.2, 3.3, 3.4_

- [x] 7. Checkpoint - Verificar client completo
  - Executar `npm run check` e confirmar que todos os erros do client foram eliminados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Configurar ESLint para prevenção de reincidência
  - [x] 8.1 Instalar e configurar ESLint com @typescript-eslint
    - Instalar `eslint`, `@eslint/js`, `typescript-eslint` nas versões mais recentes compatíveis
    - Criar arquivo de configuração `eslint.config.js` (flat config)
    - Configurar regras mínimas: `@typescript-eslint/no-explicit-any` como warning
    - _Requirements: 10.2, 10.3_

  - [x] 8.2 Adicionar script `lint` ao package.json
    - Adicionar `"lint": "eslint client/src server shared --ext .ts,.tsx"` ao `scripts`
    - Verificar que `npm run lint` executa corretamente
    - _Requirements: 10.2_

- [x] 9. Verificação final
  - [x] 9.1 Executar `npm run check` e confirmar zero erros
    - _Requirements: 10.1_

  - [ ]* 9.2 Escrever teste de propriedade: conformidade de objetos MemStorage com schema
    - **Property 1: Conformidade de objetos MemStorage com tipos do Schema**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 9.3 Escrever teste de propriedade: conversão segura de Date
    - **Property 2: Conversão segura de valores Date**
    - **Validates: Requirements 3.2**

  - [ ]* 9.4 Escrever teste de propriedade: acesso seguro a valores possivelmente undefined
    - **Property 3: Acesso seguro a valores possivelmente undefined**
    - **Validates: Requirements 8.1**

  - [x] 9.5 Checkpoint final - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- A ordem de execução é importante: storage.ts primeiro (maior impacto), depois server routes, depois client, depois ESLint
- Não rodar build no ambiente de desenvolvimento - usar apenas `npm run check` para verificação
- Se houver alteração no banco de dados (não esperado neste spec), atualizar DOCUMENTACAO_ESTRUTURA_BD.md
