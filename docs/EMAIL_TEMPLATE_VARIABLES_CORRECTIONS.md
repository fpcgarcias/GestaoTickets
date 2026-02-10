# Auditoria: Variaveis de Templates de Email (Status e Placeholders)

## Sintoma reportado

Alguns emails estao chegando com valores "crus" de status (enum interno), por exemplo:

- `Status alterado para waiting_customer`

O desejado e apresentar o texto amigavel, por exemplo:

- `Status alterado para Aguardando Cliente`

## Achados (codigo / renderer)

### 1) `{{ticket.status_text}}` nao traduzia todos os status

Onde:

- `server/services/email-notification-service.ts`

Problema:

- O renderer (`renderTemplate`) tinha um `translateStatus()` com mapeamento incompleto (traduzia apenas `new`, `ongoing`, `resolved`).
- Templates que usam `{{ticket.status_text}}` (ex.: assunto "Status alterado para {{ticket.status_text}}") podiam renderizar `waiting_customer`, `closed`, etc como texto cru.

Correcao aplicada:

- Expandido o mapa de `translateStatus()` para cobrir os status usados no sistema (incluindo `waiting_customer`, `closed`, etc).

Templates que usam `{{ticket.status_text}}` nos templates seed (para referencia):

- `new_ticket`
- `ticket_assigned`
- `status_changed` (inclui `subject_template`)
- `ticket_reply`
- `ticket_participant_added`
- `ticket_participant_removed`

### 2) Mensagem customizada para participantes usava status cru (`oldStatus/newStatus`)

Onde:

- `server/services/email-notification-service.ts`

Problema:

- `notifyParticipantsWithSettings(..., customMessage)` recebia uma string montada com `${oldStatus}` e `${newStatus}`.
- Como esses valores sao os enums internos (ex.: `waiting_customer`), o email do participante podia exibir o status cru.

Correcao aplicada:

- Criados `oldStatusText/newStatusText` via `statusTranslations`.
- `customMessage` passou a usar os valores traduzidos.

## Instrucoes para corrigir templates (DB / HTML / texto)

### Regra 1: status para o usuario final deve usar a variante `_text`

Use:

- `{{ticket.status_text}}`
- `{{status_change.old_status_text}}`
- `{{status_change.new_status_text}}`

Evite (tende a exibir enum cru):

- `{{ticket.status}}`
- `{{status_change.old_status}}`
- `{{status_change.new_status}}`

### Regra 2: placeholders precisam bater exatamente com o renderer (sem espacos)

O renderer faz substituicoes por padrao exato `{{...}}`. Entao:

- OK: `{{ticket.ticket_id}}`
- Ruim: `{{ ticket.ticket_id }}` (com espacos) pode nao ser substituido e virar texto literal no email.

### Regra 3: se o template usa mensagem customizada, preferir `{{system.custom_message}}` apenas para texto "humano"

Quando existir `{{system.custom_message}}` no template:

- Garanta que o texto injetado ja esteja "pronto para o cliente" (sem enums, sem IDs internos).
- Para status, sempre passar texto traduzido (vide correcao no codigo).

## Checklist rapido para varrer templates

Procure por estes tokens e ajuste se aparecerem:

- `{{ticket.status}}` -> trocar por `{{ticket.status_text}}`
- `{{status_change.new_status}}` -> trocar por `{{status_change.new_status_text}}`
- `{{status_change.old_status}}` -> trocar por `{{status_change.old_status_text}}`
- `{{ ticket.` (com espaco depois de `{{`) -> remover espacos
