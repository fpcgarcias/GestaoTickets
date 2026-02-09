# Plano: Status "Encerrado" em todo o sistema

**Documento único: plano completo + alterações acordadas + to-do de implementação.**

---

**Regra crítica:** Nenhuma decisão de produto ou comportamento será tomada pelo assistente. Qualquer ponto que exija definição será levado a você para decisão.

---

## Contexto

- Hoje o sistema encerra automaticamente tickets em "Aguardando Cliente" sem resposta (48h + 24h) alterando o status para **resolvido**, o que não reflete a realidade (chamado não foi resolvido).
- Objetivo: novo status **"Encerrado"** (`closed`) para esse e outros casos de fechamento sem resolução; **"Resolvido"** continua para quando o problema foi de fato resolvido.

---

## Alterações acordadas (incorporadas a este plano)

1. **Pesquisa de satisfação:** Enviar para **resolvido** e para **encerrado**. Os dois indicam fim do chamado, então a pesquisa deve ser enviada em ambos os casos.
2. **Job de auto-close:** Preencher **sim** o campo `resolved_at` ao encerrar por falta de interação. Esse campo passa a indicar “quando o ticket foi finalizado” (seja resolvido ou encerrado).
3. **Template de e-mail:** Criar **novo** template “Ticket Encerrado”, com mensagem diferente do “Ticket Resolvido”. Incluir no botão “Criar templates padrão”, seguindo o mesmo padrão de layout dos demais.
4. **Decisões:** Qualquer dúvida ou alternativa de implementação deve ser decidida por você, não pelo assistente.

---

## 1. Banco de dados e schema compartilhado

**Migration (PostgreSQL)**  
- Criar nova migration em `db/migrations/` (ex.: `090_add_ticket_status_closed.sql`):
  - `ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'closed';`
  - Atualizar `COMMENT ON TYPE ticket_status` para documentar `closed: Encerrado (ex.: por falta de interação)`.
- Criar migration para o enum de templates: `ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ticket_closed';`

**Schema e tipos**  
- [shared/schema.ts](shared/schema.ts): adicionar `'closed'` ao `ticketStatusEnum`; adicionar `'ticket_closed'` ao `emailTemplateTypeEnum`.
- [shared/ticket-utils.ts](shared/ticket-utils.ts): incluir `'closed'` no type `TicketStatus`, em `SLA_FINISHED_STATUSES` e em `STATUS_CONFIG` (label "Encerrado", cor, ícone).

---

## 2. Job de auto-close (falta de interação)

- [server/services/email-notification-service.ts](server/services/email-notification-service.ts): onde hoje se usa `status: 'resolved'` e `notifyStatusChanged(..., 'resolved')`, alterar para **`status: 'closed'`** e **`notifyStatusChanged(..., 'closed')`**.
- **Preencher `resolved_at`** ao encerrar (data em que o ticket foi finalizado). Garantir que o update do ticket nesse fluxo inclua `resolved_at`.

---

## 3. Pesquisa de satisfação (resolvido e encerrado)

- Enviar pesquisa de satisfação quando o status mudar para **resolvido** ou para **encerrado**.
- [server/services/email-notification-service.ts](server/services/email-notification-service.ts): alterar a condição de envio de pesquisa de `newStatus === 'resolved'` para `newStatus === 'resolved' || newStatus === 'closed'`. Revisar qualquer outro ponto que dispare pesquisa e garantir que “encerrado” também dispare.

---

## 4. Regras de negócio: resposta e atendente

- **Não permitir resposta em ticket encerrado** (mesmo critério que resolvido): em [server/api/ticket-replies.ts](server/api/ticket-replies.ts) e [server/routes.ts](server/routes.ts), bloquear quando `status === 'closed'`.
- **Não alterar atendente em ticket encerrado:** em [server/routes.ts](server/routes.ts), incluir `existingTicket.status === 'closed'` na rejeição.
- **resolved_at:** Setar `resolved_at` quando o status for alterado para `resolved` **ou** para `closed` (em ticket-replies, database-storage e routes onde aplicável).

---

## 5. Filtro “Ocultar resolvidos” (hide_resolved)

- Ocultar **resolvidos** e **encerrados**. Em [server/database-storage.ts](server/database-storage.ts) e [server/storage.ts](server/storage.ts), excluir ambos os status quando `hide_resolved` estiver ativo.

---

## 6. Template de e-mail “Ticket Encerrado”

- Criar **novo** template com tipo `ticket_closed`, mensagem diferente do “Ticket Resolvido” (ex.: “Seu ticket foi encerrado.”, “Encerrado em”, “Encerrado por”).
- **Incluir no “Criar templates padrão”:** em [server/routes.ts](server/routes.ts): adicionar `'ticket_closed'` em `allTemplateTypes`; em `getDefaultTemplates('pt-BR')` e `getDefaultTemplates('en-US')` adicionar o objeto do template com o mesmo padrão de layout do “Ticket Resolvido” (estrutura HTML, header, detalhes, CTA, footer).
- No serviço de e-mail, quando o status mudar para `closed`, usar o template `ticket_closed`. Garantir variáveis como `ticket.resolved_at_formatted` e “Encerrado por” no contexto.

---

## 7. Notificações in-app (push/toast)

- [server/services/notification-service.ts](server/services/notification-service.ts): quando a mudança for para `closed`, usar título “Ticket Encerrado” e mensagem adequada.
- [client/src/utils/notification-i18n.ts](client/src/utils/notification-i18n.ts): mapear “Ticket Encerrado” para a chave i18n.

---

## 8. Frontend – constantes, i18n, telas e componentes

- [client/src/lib/utils.ts](client/src/lib/utils.ts): `TICKET_STATUS.CLOSED`, `STATUS_COLORS`, `translateTicketStatus('closed')`.
- i18n: chaves para “Encerrado” em pt-BR e en-US.
- [client/src/pages/tickets/index.tsx](client/src/pages/tickets/index.tsx): dropdown e aba “Encerrado”.
- [client/src/components/tickets/ticket-reply.tsx](client/src/components/tickets/ticket-reply.tsx): SelectItem “Encerrado”.
- [client/src/components/tickets/status-badge.tsx](client/src/components/tickets/status-badge.tsx): `'closed'` nos statusMap.
- [client/src/pages/dashboard.tsx](client/src/pages/dashboard.tsx): “Encerrados” nos dados de status.
- Relatórios (TicketReports, ai-audit): garantir que “Encerrado” apareça em filtros e listas (STATUS_CONFIG já cobre após shared).

---

## 9. Relatórios backend e SLA

- [server/routes/reports.ts](server/routes/reports.ts): `translateTicketStatus` com `'closed': 'Encerrado'`. Definir com você se “Resolvidos” em relatórios/desempenho conta só `resolved` ou também `closed`; para coluna “Resolvido em”, com `resolved_at` preenchido para ambos, exibir conforme decisão (“Encerrado em” para status closed se desejar).
- SLA: com `closed` em `SLA_FINISHED_STATUSES`, o SLA já será finalizado para “Encerrado”. Garantir uso de `resolved_at` como data de fim também para status `closed`.

---

## Resumo de arquivos a alterar

| Área | Arquivos |
|------|----------|
| DB | Nova migration ticket_status + email_template_type |
| Shared | shared/schema.ts, shared/ticket-utils.ts |
| Auto-close + pesquisa + e-mail | server/services/email-notification-service.ts |
| Regras (reply, atendente, resolved_at) | server/api/ticket-replies.ts, server/routes.ts, server/database-storage.ts |
| hide_resolved | server/database-storage.ts, server/storage.ts |
| Template “Ticket Encerrado” + seed | server/routes.ts |
| Notificações | server/services/notification-service.ts, client/src/utils/notification-i18n.ts |
| Frontend | client/src/lib/utils.ts, i18n, tickets/index, ticket-reply, status-badge, dashboard, reports, ai-audit |
| Relatórios | server/routes/reports.ts |

---

## Fluxo desejado após a implementação

- **Resolvido:** atendente marca Resolvido → `resolved_at` preenchido → pesquisa de satisfação enviada → e-mail “Ticket Resolvido”.
- **Encerrado (auto-close):** 48h + 24h em Aguardando Cliente sem resposta → status `closed` → `resolved_at` preenchido → pesquisa de satisfação enviada → e-mail “Ticket Encerrado”.
- **Encerrado (manual):** atendente marca Encerrado → `resolved_at` preenchido → pesquisa de satisfação enviada → e-mail “Ticket Encerrado”.
- “Ocultar resolvidos” oculta resolvidos e encerrados.

---

# To-do de implementação (passo a passo)

Use esta lista para marcar o que já foi feito. Qualquer decisão de produto: parar e perguntar ao usuário.

### 1. Banco de dados e schema

- [ ] **1.1** Criar migration `090_add_ticket_status_closed.sql`: `ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'closed';` e COMMENT.
- [ ] **1.2** Em `shared/schema.ts`: adicionar `'closed'` ao `ticketStatusEnum`.
- [ ] **1.3** Criar migration para `email_template_type`: `ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ticket_closed';`
- [ ] **1.4** Em `shared/schema.ts`: adicionar `'ticket_closed'` ao `emailTemplateTypeEnum`.

### 2. Fonte da verdade de status (shared)

- [ ] **2.1** Em `shared/ticket-utils.ts`: `'closed'` no type `TicketStatus`, em `SLA_FINISHED_STATUSES` e em `STATUS_CONFIG`.

### 3. Job de auto-close

- [ ] **3.1** Em `server/services/email-notification-service.ts`: status `'closed'`, `notifyStatusChanged(..., 'closed')`, **preencher `resolved_at`** ao encerrar.
- [ ] **3.2** Garantir que o update do ticket nesse fluxo inclua `resolved_at`.

### 4. Pesquisa de satisfação (resolvido e encerrado)

- [ ] **4.1** Em `server/services/email-notification-service.ts`: enviar pesquisa quando `newStatus === 'resolved' || newStatus === 'closed'`.
- [ ] **4.2** Revisar outros pontos que disparem pesquisa e garantir “encerrado”.

### 5. Regras de negócio: resposta e atendente

- [ ] **5.1** Em `server/api/ticket-replies.ts`: bloquear resposta quando `status === 'closed'`.
- [ ] **5.2** Em `server/routes.ts`: na rota canReply, incluir `ticket.status === 'closed'`.
- [ ] **5.3** Em `server/routes.ts`: impedir alterar atendente quando `existingTicket.status === 'closed'`.
- [ ] **5.4** Ao alterar status para `closed`, setar `resolved_at` (ticket-replies, database-storage, routes).

### 6. Filtro hide_resolved

- [ ] **6.1** Em `server/database-storage.ts`: excluir `resolved` e `closed` quando `hide_resolved`.
- [ ] **6.2** Em `server/storage.ts`: filtro em memória excluir `resolved` e `closed`.

### 7. Template de e-mail “Ticket Encerrado”

- [ ] **7.1** Em `server/routes.ts`, lista `allTemplateTypes`: adicionar `'ticket_closed'`.
- [ ] **7.2** Em `getDefaultTemplates('pt-BR')`: adicionar template “Ticket Encerrado” (layout igual ao Resolvido, texto encerramento).
- [ ] **7.3** Em `getDefaultTemplates('en-US')`: adicionar template “Ticket Closed”.
- [ ] **7.4** Serviço de e-mail: quando status `closed`, usar template `ticket_closed`.

### 8. Envio do e-mail “Ticket Encerrado”

- [ ] **8.1** Em `server/services/email-notification-service.ts`: quando novo status `closed`, usar template `ticket_closed`.
- [ ] **8.2** Garantir variáveis (resolved_at_formatted, “Encerrado por”) no contexto do template.

### 9. Notificações in-app

- [ ] **9.1** Em `server/services/notification-service.ts`: título/mensagem “Ticket Encerrado” quando status `closed`.
- [ ] **9.2** Em `client/src/utils/notification-i18n.ts`: mapear “Ticket Encerrado”.

### 10. Frontend – constantes e i18n

- [ ] **10.1** Em `client/src/lib/utils.ts`: TICKET_STATUS.CLOSED, STATUS_COLORS, translateTicketStatus.
- [ ] **10.2** Em pt-BR.json e en-US.json: chaves tickets.closed, tickets.tabs.closed.

### 11. Frontend – telas e componentes

- [ ] **11.1** tickets/index.tsx: dropdown e aba “Encerrado”.
- [ ] **11.2** ticket-reply.tsx: SelectItem “Encerrado”.
- [ ] **11.3** status-badge.tsx: `'closed'` nos dois statusMap.
- [ ] **11.4** dashboard.tsx: “Encerrados” em statusData.
- [ ] **11.5** TicketReports.tsx: confirmar STATUS_CONFIG cobre; lista fixa se houver.
- [ ] **11.6** ai-audit.tsx: opção “Encerrado” no filtro de status.

### 12. Relatórios backend

- [ ] **12.1** reports.ts: translateTicketStatus `'closed': 'Encerrado'`.
- [ ] **12.2** Decidir com você: “Resolvidos” em relatórios = só resolved ou resolved+closed; implementar.
- [ ] **12.3** Coluna “Resolvido em”/“Encerrado em” para status closed usando resolved_at.

### 13. SLA

- [ ] **13.1** Confirmar sla-calculator usa isSlaFinished; closed em SLA_FINISHED_STATUSES.
- [ ] **13.2** Garantir uso de resolved_at para “data de fim” também para status closed.

### 14. Validação final

- [ ] **14.1** Rodar migrations; validar enums.
- [ ] **14.2** Testar auto-close: status closed, resolved_at preenchido, pesquisa enviada, e-mail Ticket Encerrado.
- [ ] **14.3** Testar Resolvido e Encerrado manual: pesquisa enviada em ambos.
- [ ] **14.4** “Criar templates padrão”: template “Ticket Encerrado” criado.
- [ ] **14.5** Validar todas as telas com status (listagem, filtros, dashboard, relatórios, ticket-reply).

---

**Observações:**  
- Template “Ticket Encerrado”: mesmo layout do “Ticket Resolvido”, só texto e rótulos diferentes.  
- `resolved_at` = data em que o ticket foi finalizado (resolvido ou encerrado).  
- Nenhuma decisão de produto pelo assistente: sempre perguntar ao usuário.
