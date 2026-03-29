# Plano de Implementação: Atendente Padrão por Departamento

## Visão Geral

Implementação incremental da funcionalidade de atendente padrão por departamento, começando pela camada de dados (migração + schema), passando pela lógica de backend (validação, atribuição automática, notificações), e finalizando com o frontend (formulário) e internacionalização.

## Tarefas

- [x] 1. Migração de banco de dados e atualização do schema Drizzle
  - [x] 1.1 Criar arquivo de migração SQL `db/migrations/094_add_default_agent_to_departments.sql`
    - Adicionar coluna `default_agent_enabled BOOLEAN NOT NULL DEFAULT false`
    - Adicionar coluna `default_agent_id INTEGER DEFAULT NULL REFERENCES officials(id) ON DELETE SET NULL`
    - _Requisitos: 1.1, 1.2_
  - [x] 1.2 Atualizar a tabela `departments` em `shared/schema.ts`
    - Adicionar campos `default_agent_enabled` e `default_agent_id` com referência FK para `officials.id` e `onDelete: 'set null'`
    - _Requisitos: 1.1, 1.2_
  - [ ]* 1.3 Escrever teste de propriedade para defaults do schema
    - **Propriedade 1: Defaults do schema para novos departamentos**
    - **Valida: Requisitos 1.1, 1.2**

- [x] 2. Validação na API de departamentos (PUT /api/departments/:id)
  - [x] 2.1 Atualizar o handler PUT `/departments/:id` em `server/routes.ts`
    - Extrair `default_agent_enabled` e `default_agent_id` do `req.body`
    - Quando `default_agent_enabled = true`: validar que `default_agent_id` é fornecido, referencia atendente ativo, vinculado ao departamento, e com mesmo `company_id`
    - Quando `default_agent_enabled = false`: definir `default_agent_id` como `null` automaticamente
    - Retornar HTTP 400 para configurações inválidas
    - _Requisitos: 1.6, 1.7, 1.8, 4.1, 4.2_
  - [ ]* 2.2 Escrever teste de propriedade para validação da API
    - **Propriedade 2: Validação da API rejeita configurações inválidas de atendente padrão**
    - **Valida: Requisitos 1.6, 1.7, 4.2**
  - [ ]* 2.3 Escrever teste de propriedade para desabilitar atendente padrão
    - **Propriedade 3: Desabilitar atendente padrão limpa o agent_id**
    - **Valida: Requisitos 1.8**

- [x] 3. Checkpoint — Verificar migração e validação
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Lógica de atribuição automática na criação de tickets
  - [x] 4.1 Alterar o handler POST de tickets em `server/routes.ts` (após `storage.createTicket`, antes da análise de IA ~linha 4048)
    - Buscar `default_agent_enabled` e `default_agent_id` do departamento do ticket
    - Se habilitado e atendente ativo: atualizar ticket com `assigned_to_id = default_agent_id` e `status = 'in_progress'`
    - Se atendente inativo: seguir fluxo normal e registrar `console.warn`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 4.2 Escrever teste de propriedade para atribuição automática
    - **Propriedade 4: Atribuição automática de ticket com atendente padrão**
    - **Valida: Requisitos 2.1, 2.2, 2.3**

- [x] 5. Serviço de notificação WebSocket
  - [x] 5.1 Alterar método `notifyNewTicket` em `server/services/notification-service.ts`
    - Após notificar admins, verificar `default_agent_enabled` e `default_agent_id` do departamento
    - Se habilitado e atendente ativo: notificar apenas o atendente padrão via `sendNotificationToUser(agent.user_id, payload)`
    - Se atendente inativo: fallback para `sendNotificationToDepartment` (fluxo normal)
    - _Requisitos: 3.1, 3.2, 3.3_
  - [x] 5.2 Alterar método `notifyNewTicket` em `server/services/email-notification-service.ts`
    - Mesma lógica: quando `default_agent_enabled = true` e atendente ativo, enviar e-mail apenas para o atendente padrão (e admins)
    - Quando desabilitado ou atendente inativo: manter fluxo atual (todos os atendentes do departamento)
    - _Requisitos: 3.1, 3.4_
  - [ ]* 5.3 Escrever teste de propriedade para roteamento de notificação
    - **Propriedade 5: Roteamento de notificação com atendente padrão**
    - **Valida: Requisitos 3.1, 3.2, 3.3**

- [x] 6. Checkpoint — Verificar backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend — Formulário de departamento
  - [x] 7.1 Atualizar `client/src/pages/DepartmentManagement.tsx`
    - Adicionar `Switch` para `default_agent_enabled` com label i18n
    - Adicionar `Select` dropdown condicional (visível quando toggle ativo) listando atendentes ativos vinculados ao departamento
    - Implementar validação: se toggle ativo e nenhum atendente selecionado, exibir mensagem de erro
    - Enviar `default_agent_enabled` e `default_agent_id` no PUT da API
    - Considerar acesso `super_admin` (pode configurar para qualquer empresa)
    - _Requisitos: 1.3, 1.4, 1.5, 4.3_
  - [ ]* 7.2 Escrever teste de propriedade para isolamento multi-tenant
    - **Propriedade 6: Isolamento multi-tenant na listagem de atendentes elegíveis**
    - **Valida: Requisitos 4.1**

- [x] 8. Internacionalização (i18n)
  - [x] 8.1 Adicionar chaves de tradução em `client/src/i18n/messages/pt-BR.json` e `client/src/i18n/messages/en-US.json`
    - Chaves: `departments.default_agent_enabled`, `departments.default_agent_enabled_description`, `departments.default_agent_id`, `departments.default_agent_id_placeholder`, `departments.default_agent_validation_required`, `departments.default_agent_not_found`
    - _Requisitos: 5.1, 5.2_

- [x] 9. Checkpoint final — Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade usam `fast-check` com Vitest (mínimo 100 iterações)
- Testes unitários validam exemplos específicos e edge cases
