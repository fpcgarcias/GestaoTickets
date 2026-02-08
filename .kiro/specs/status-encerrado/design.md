# Documento de Design: Status "Encerrado" para Tickets

## Visão Geral

Este documento descreve o design técnico para implementação do novo status "Encerrado" (closed) no sistema de gerenciamento de tickets. O objetivo é diferenciar tickets que foram efetivamente resolvidos daqueles que foram fechados por outros motivos (timeout, abandono, etc).

### Contexto

Atualmente, o sistema usa o status "Resolvido" tanto para tickets que tiveram o problema solucionado quanto para tickets encerrados automaticamente por falta de interação do cliente. Isso gera confusão nos relatórios e métricas, pois não reflete a realidade operacional.

### Objetivos

1. Adicionar novo status "Encerrado" (closed) ao sistema
2. Manter "Resolvido" apenas para tickets efetivamente solucionados
3. Atualizar auto-close job para usar "Encerrado"
4. Criar template de e-mail específico para "Ticket Encerrado"
5. Enviar pesquisa de satisfação para ambos os status finais
6. Garantir consistência visual e comportamental em toda a aplicação

## Arquitetura

### Camadas Afetadas

1. **Camada de Dados (Database)**
   - Schema do banco de dados (enum ticketStatusEnum)
   - Migrações para adicionar novo valor ao enum

2. **Camada de Domínio (Shared)**
   - Tipos TypeScript (TicketStatus)
   - Constantes de configuração (STATUS_CONFIG, SLA_FINISHED_STATUSES)
   - Utilitários de status

3. **Camada de Serviços (Server)**
   - Auto-close job
   - Email notification service
   - Notification service
   - Storage layer

4. **Camada de Apresentação (Client)**
   - Componentes de UI (badges, dropdowns)
   - Páginas (tickets, dashboard, relatórios)
   - Internacionalização (i18n)

### Fluxo de Dados

```
[Auto-Close Job] → [Update Status to 'closed'] → [Email Service] → [Template 'ticket_closed']
                                                 ↓
                                          [Satisfaction Survey]
```

## Componentes e Interfaces

### 1. Schema do Banco de Dados

**Arquivo:** `shared/schema.ts`

**Alteração no Enum:**
```typescript
export const ticketStatusEnum = pgEnum('ticket_status', [
  'new', 
  'ongoing', 
  'suspended',
  'waiting_customer', 
  'escalated',
  'in_analysis',
  'pending_deployment',
  'reopened',
  'resolved',
  'closed'  // NOVO
]);
```

**Alteração no Enum de Templates:**
```typescript
export const emailTemplateTypeEnum = pgEnum('email_template_type', [
  'new_ticket',
  'ticket_assigned',
  'ticket_reply',
  'status_changed',
  'ticket_resolved',
  'ticket_closed',  // NOVO
  'ticket_escalated',
  'ticket_due_soon',
  'customer_registered',
  'user_created',
  'system_maintenance',
  'ticket_participant_added',
  'ticket_participant_removed',
  'satisfaction_survey',
  'satisfaction_survey_reminder',
  'waiting_customer_closure_alert'
]);
```


### 2. Tipos e Constantes Compartilhadas

**Arquivo:** `shared/ticket-utils.ts`

**Tipo TicketStatus:**
```typescript
export type TicketStatus = 
  | 'new'
  | 'ongoing' 
  | 'suspended'
  | 'waiting_customer'
  | 'escalated'
  | 'in_analysis'
  | 'pending_deployment'
  | 'reopened'
  | 'resolved'
  | 'closed';  // NOVO
```

**Constantes de SLA:**
```typescript
// Status final (SLA finalizado)
export const SLA_FINISHED_STATUSES: TicketStatus[] = [
  'resolved',
  'closed'  // NOVO - SLA também finaliza para encerrado
];
```

**Configuração Visual:**
```typescript
export const STATUS_CONFIG = {
  // ... status existentes ...
  closed: {
    label: 'Encerrado',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🔒'
  }
} as const;
```

### 3. Utilitários do Cliente

**Arquivo:** `client/src/lib/utils.ts`

**Mapeamento de Cores:**
```typescript
export const STATUS_COLORS = {
  // ... status existentes ...
  [TICKET_STATUS.CLOSED]: 'bg-gray-100 text-gray-800'
};
```

**Função de Tradução:**
```typescript
export function translateTicketStatus(status: string): string {
  const translations: Record<string, string> = {
    // ... traduções existentes ...
    'closed': 'Encerrado'
  };
  return translations[status] || status;
}
```

### 4. Internacionalização

**Arquivo:** `client/src/i18n/messages/pt-BR.json`

```json
{
  "tickets": {
    "closed": "Encerrado",
    "tabs": {
      "closed": "🔒 Encerrados"
    },
    "sla": {
      "closed": "Encerrado"
    }
  }
}
```

**Arquivo:** `client/src/i18n/messages/en-US.json`

```json
{
  "tickets": {
    "closed": "Closed",
    "tabs": {
      "closed": "🔒 Closed"
    },
    "sla": {
      "closed": "Closed"
    }
  }
}
```

### 5. Componente de Badge de Status

**Arquivo:** `client/src/components/tickets/status-badge.tsx`

**Atualização do Mapeamento:**
```typescript
const getTranslatedStatus = (status: TicketStatus) => {
  const statusMap: Record<TicketStatus, string> = {
    'new': formatMessage('tickets.new'),
    'ongoing': formatMessage('tickets.ongoing'),
    'suspended': formatMessage('tickets.suspended'),
    'waiting_customer': formatMessage('tickets.waiting_customer'),
    'escalated': formatMessage('tickets.escalated'),
    'in_analysis': formatMessage('tickets.in_analysis'),
    'pending_deployment': formatMessage('tickets.pending_deployment'),
    'reopened': formatMessage('tickets.reopened'),
    'resolved': formatMessage('tickets.resolved'),
    'closed': formatMessage('tickets.closed')  // NOVO
  };
  return statusMap[status] || config.label;
};
```

### 6. Auto-Close Job

**Arquivo:** `server/services/email-notification-service.ts`

**Lógica Atual (a ser modificada):**
- Identifica tickets em "waiting_customer" há mais de 72h
- Altera status para "resolved"
- Preenche resolved_at
- Envia e-mail "ticket_resolved"
- Envia pesquisa de satisfação

**Nova Lógica:**
- Identifica tickets em "waiting_customer" há mais de 72h
- Altera status para "closed" (ao invés de "resolved")
- Preenche resolved_at
- Envia e-mail "ticket_closed" (novo template)
- Envia pesquisa de satisfação

### 7. Template de E-mail "Ticket Encerrado"

**Estrutura do Template:**

**Subject:** `Chamado #{ticket_id} - Encerrado por Falta de Interação`

**HTML Body:**
- Layout idêntico ao template "Ticket Resolvido"
- Cores e estrutura mantidas
- Textos adaptados para explicar encerramento por falta de interação

**Variáveis Disponíveis:**
- `{ticket_id}` - ID do ticket
- `{title}` - Título do ticket
- `{customer_name}` - Nome do cliente
- `{company_name}` - Nome da empresa
- `{support_email}` - E-mail de suporte
- `{base_url}` - URL base do sistema

**Texto Sugerido:**
```
Olá {customer_name},

Seu chamado #{ticket_id} - "{title}" foi encerrado automaticamente devido à falta de interação.

Aguardamos sua resposta por 72 horas, mas não recebemos retorno. Por isso, o chamado foi encerrado para manter nossa fila organizada.

Se o problema persistir ou você precisar reabrir este chamado, basta responder a este e-mail ou acessar o sistema.

Atenciosamente,
Equipe {company_name}
```


### 8. Pesquisa de Satisfação

**Arquivo:** `server/services/email-notification-service.ts`

**Lógica Atual:**
- Envia pesquisa apenas para status "resolved"

**Nova Lógica:**
- Envia pesquisa para status "resolved" E "closed"
- Usa template apropriado baseado no status

**Implementação:**
```typescript
// Verificar se deve enviar pesquisa de satisfação
if (newStatus === 'resolved' || newStatus === 'closed') {
  // Enviar pesquisa de satisfação
  await this.sendSatisfactionSurvey(ticket);
}
```

### 9. Filtros e Dropdowns

**Componentes Afetados:**

1. **Página de Tickets** (`client/src/pages/tickets/index.tsx`)
   - Dropdown de filtro de status
   - Abas de status
   - Filtro "Ocultar resolvidos"

2. **Componente de Resposta** (`client/src/components/tickets/ticket-reply.tsx`)
   - SelectItem de mudança de status

3. **Dashboard** (`client/src/pages/dashboard.tsx`)
   - Contadores de status
   - Gráficos e métricas

4. **Relatórios** (`server/routes/reports.ts`)
   - Filtros de status
   - Traduções de status

5. **Auditoria de IA** (`client/src/pages/ai-audit.tsx`)
   - Filtro de status

**Implementação do Filtro "Ocultar Resolvidos":**
```typescript
// Antes
const hideResolvedFilter = hideResolved 
  ? ne(tickets.status, 'resolved')
  : undefined;

// Depois
const hideResolvedFilter = hideResolved 
  ? and(
      ne(tickets.status, 'resolved'),
      ne(tickets.status, 'closed')
    )
  : undefined;
```

### 10. Restrições de Ações

**Regras de Negócio:**

Tickets com status "closed" devem ter as mesmas restrições que "resolved":

1. **Não permitir respostas de clientes**
   - Cliente não pode adicionar novas respostas
   - Sistema deve exibir mensagem informativa

2. **Não permitir alteração de atendente**
   - Atendente responsável não pode ser alterado
   - Dropdown de atendente deve estar desabilitado

3. **Permitir respostas internas**
   - Atendentes podem adicionar notas internas
   - Útil para documentação pós-encerramento

4. **Permitir reabertura**
   - Atendente pode alterar status para "reopened"
   - Cliente pode reabrir respondendo ao e-mail

**Implementação:**
```typescript
// Verificar se ticket está finalizado
const isTicketFinalized = (status: TicketStatus) => {
  return status === 'resolved' || status === 'closed';
};

// Usar em validações
if (isTicketFinalized(ticket.status) && !isInternal) {
  throw new Error('Não é possível adicionar respostas em tickets finalizados');
}
```

### 11. Histórico de Status

**Arquivo:** `shared/schema.ts` (tabela ticketStatusHistory)

**Comportamento:**
- Registrar mudanças para status "closed"
- Registrar mudanças de "closed" para outros status
- Incluir ID do usuário que fez a alteração
- Incluir timestamp da alteração

**Exemplo de Registro:**
```typescript
{
  ticket_id: 123,
  old_status: 'waiting_customer',
  new_status: 'closed',
  change_type: 'status',
  changed_by_id: null, // null para auto-close job
  created_at: new Date()
}
```

### 12. Campo resolved_at

**Comportamento:**

1. **Preencher resolved_at quando:**
   - Status muda para "resolved"
   - Status muda para "closed"

2. **Limpar resolved_at quando:**
   - Status muda de "resolved" ou "closed" para qualquer outro status

**Implementação:**
```typescript
// Ao atualizar status
const updates: any = { status: newStatus };

if (newStatus === 'resolved' || newStatus === 'closed') {
  updates.resolved_at = new Date();
} else if (oldStatus === 'resolved' || oldStatus === 'closed') {
  updates.resolved_at = null;
}
```

## Modelos de Dados

### Ticket

```typescript
interface Ticket {
  id: number;
  ticket_id: string;
  title: string;
  description: string;
  status: TicketStatus; // Inclui 'closed'
  priority: string;
  type: string;
  customer_id: number;
  customer_email: string;
  assigned_to_id: number | null;
  company_id: number;
  created_at: Date;
  updated_at: Date;
  first_response_at: Date | null;
  resolved_at: Date | null; // Preenchido para 'resolved' e 'closed'
  sla_breached: boolean;
}
```

### EmailTemplate

```typescript
interface EmailTemplate {
  id: number;
  name: string;
  type: EmailTemplateType; // Inclui 'ticket_closed'
  description: string | null;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  is_active: boolean;
  is_default: boolean;
  available_variables: string | null;
  company_id: number | null;
  created_at: Date;
  updated_at: Date;
}
```

### SatisfactionSurvey

```typescript
interface SatisfactionSurvey {
  id: number;
  ticket_id: number;
  company_id: number;
  customer_email: string;
  survey_token: string;
  sent_at: Date;
  responded_at: Date | null;
  rating: number | null;
  comments: string | null;
  status: 'sent' | 'responded' | 'expired';
  expires_at: Date;
}
```


## Propriedades de Correção

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema - essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como a ponte entre especificações legíveis por humanos e garantias de correção verificáveis por máquina.*

### Property 1: Configuração de Status "Encerrado"

*Para qualquer* consulta à configuração de status 'closed', o sistema deve retornar uma configuração válida contendo label "Encerrado", cor cinza (bg-gray-100, text-gray-800) e ícone apropriado (🔒).

**Valida: Requisitos 2.1, 2.2, 2.3, 2.4**

### Property 2: Status "Encerrado" em SLA_FINISHED_STATUSES

*Para qualquer* verificação do array SLA_FINISHED_STATUSES, o status 'closed' deve estar presente junto com 'resolved'.

**Valida: Requisitos 2.5**

### Property 3: Traduções de Status "Encerrado"

*Para qualquer* idioma suportado (pt-BR, en-US), o sistema deve ter traduções definidas para o status 'closed' ('Encerrado' em pt-BR, 'Closed' em en-US).

**Valida: Requisitos 2.6, 2.7, 13.1, 13.2, 13.3, 13.4**

### Property 4: Auto-Close Job Completo

*Para qualquer* ticket em status 'waiting_customer' há mais de 72 horas, quando o auto-close job é executado, o sistema deve:
- Alterar o status para 'closed'
- Preencher o campo resolved_at com timestamp atual
- Criar registro no histórico de status
- Enviar e-mail usando template 'ticket_closed'
- Enviar pesquisa de satisfação

**Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: Pesquisa de Satisfação para Status Finais

*Para qualquer* ticket que tem status alterado para 'resolved' ou 'closed', o sistema deve enviar a pesquisa de satisfação usando o template apropriado baseado no status final.

**Valida: Requisitos 5.1, 5.2, 5.3**

### Property 6: Filtro "Ocultar Resolvidos"

*Para qualquer* conjunto de tickets, quando o filtro "Ocultar Resolvidos" está ativo, a listagem não deve conter tickets com status 'resolved' nem 'closed'. Quando o filtro está inativo, todos os status devem estar presentes.

**Valida: Requisitos 6.1, 6.2, 6.3**

### Property 7: Badge de Status Renderizado

*Para qualquer* badge renderizado com status 'closed', o sistema deve exibir o texto traduzido corretamente para o idioma atual, aplicar as cores configuradas (bg-gray-100, text-gray-800) e exibir o ícone configurado (🔒).

**Valida: Requisitos 8.1, 8.2, 8.3**

### Property 8: Restrições em Tickets Encerrados

*Para qualquer* ticket com status 'closed', o sistema deve:
- Rejeitar tentativas de clientes adicionarem respostas públicas
- Rejeitar tentativas de alterar o atendente responsável
- Permitir que atendentes adicionem respostas internas
- Permitir que atendentes alterem o status para 'reopened'

**Valida: Requisitos 9.1, 9.2, 9.3, 9.4**

### Property 9: SLA Finalizado para Status "Encerrado"

*Para qualquer* ticket que tem status alterado para 'closed', o sistema deve parar a contagem de SLA e marcá-lo como finalizado. Se o status for alterado de 'closed' para um status ativo (SLA_ACTIVE_STATUSES), o SLA deve reiniciar.

**Valida: Requisitos 10.1, 10.2, 10.3**

### Property 10: Relatórios Incluem Status "Encerrado"

*Para qualquer* relatório de status gerado, o sistema deve incluir contagem separada para tickets com status 'closed' e traduzir o status corretamente para o idioma selecionado.

**Valida: Requisitos 11.1, 11.2**

### Property 11: Notificações In-App para Status "Encerrado"

*Para qualquer* ticket que tem status alterado para 'closed', o sistema deve criar notificações in-app para o cliente e para o atendente responsável, com o status traduzido corretamente.

**Valida: Requisitos 12.1, 12.2, 12.3**

### Property 12: Campo resolved_at Round-Trip

*Para qualquer* ticket, quando o status é alterado para 'resolved' ou 'closed', o campo resolved_at deve ser preenchido com timestamp atual. Quando o status é alterado de 'resolved' ou 'closed' para qualquer outro status, o campo resolved_at deve ser limpo (null).

**Valida: Requisitos 14.1, 14.2, 14.3**

### Property 13: Histórico de Mudanças de Status

*Para qualquer* mudança de status envolvendo 'closed' (para ou de), o sistema deve criar um registro em ticketStatusHistory contendo o ID do usuário que fez a alteração (ou null para processos automáticos) e o timestamp da mudança.

**Valida: Requisitos 15.1, 15.2, 15.3, 15.4**

## Tratamento de Erros

### Erros de Validação

1. **Status Inválido**
   - Erro: Tentativa de definir status não existente
   - Tratamento: Rejeitar com mensagem de erro clara
   - Código: 400 Bad Request

2. **Transição de Status Inválida**
   - Erro: Tentativa de transição não permitida
   - Tratamento: Rejeitar com mensagem explicando a restrição
   - Código: 403 Forbidden

3. **Permissão Negada**
   - Erro: Usuário sem permissão para alterar status
   - Tratamento: Rejeitar com mensagem de permissão negada
   - Código: 403 Forbidden

### Erros de Integração

1. **Falha no Envio de E-mail**
   - Erro: Serviço de e-mail indisponível
   - Tratamento: Registrar erro em log, não bloquear mudança de status
   - Retry: Sim, com backoff exponencial

2. **Falha na Criação de Pesquisa**
   - Erro: Erro ao criar registro de pesquisa de satisfação
   - Tratamento: Registrar erro em log, não bloquear mudança de status
   - Retry: Sim, uma vez

3. **Falha no Histórico**
   - Erro: Erro ao criar registro de histórico
   - Tratamento: Registrar erro crítico em log, não bloquear mudança de status
   - Retry: Não (histórico é secundário)

### Erros de Migração

1. **Enum Já Existe**
   - Erro: Valor 'closed' já existe no enum
   - Tratamento: Ignorar (idempotente)

2. **Dados Inconsistentes**
   - Erro: Tickets com status inválido após migração
   - Tratamento: Script de correção para normalizar dados

## Estratégia de Testes

### Abordagem Dual de Testes

O sistema utilizará duas abordagens complementares de testes:

1. **Testes Unitários**: Verificam exemplos específicos, casos extremos e condições de erro
2. **Testes Baseados em Propriedades**: Verificam propriedades universais através de múltiplas entradas geradas

Ambos são necessários para cobertura abrangente. Testes unitários capturam bugs concretos, enquanto testes de propriedades verificam correção geral.

### Configuração de Testes de Propriedades

- **Biblioteca**: fast-check (JavaScript/TypeScript)
- **Iterações Mínimas**: 100 por teste de propriedade
- **Formato de Tag**: `Feature: status-encerrado, Property {número}: {texto da propriedade}`

### Testes Unitários

**Foco dos Testes Unitários:**
- Exemplos específicos de mudanças de status
- Casos extremos (tickets sem atendente, sem cliente, etc)
- Condições de erro (permissões, validações)
- Integração entre componentes

**Exemplos de Testes Unitários:**

1. **Teste de Configuração de Status**
   ```typescript
   test('Status "closed" deve ter configuração correta', () => {
     const config = getStatusConfig('closed');
     expect(config.label).toBe('Encerrado');
     expect(config.bgColor).toBe('bg-gray-100');
     expect(config.textColor).toBe('text-gray-800');
     expect(config.icon).toBe('🔒');
   });
   ```

2. **Teste de Template de E-mail**
   ```typescript
   test('Template "ticket_closed" deve existir nos templates padrão', async () => {
     const templates = await getDefaultTemplates();
     const closedTemplate = templates.find(t => t.type === 'ticket_closed');
     expect(closedTemplate).toBeDefined();
     expect(closedTemplate.name).toBe('Ticket Encerrado');
   });
   ```

3. **Teste de Filtro**
   ```typescript
   test('Filtro "Ocultar Resolvidos" deve excluir tickets closed', async () => {
     const tickets = await getTickets({ hideResolved: true });
     const hasClosedTickets = tickets.some(t => t.status === 'closed');
     expect(hasClosedTickets).toBe(false);
   });
   ```

### Testes de Propriedades

**Foco dos Testes de Propriedades:**
- Propriedades universais que devem valer para todas as entradas
- Cobertura abrangente através de randomização
- Invariantes do sistema

**Exemplos de Testes de Propriedades:**

1. **Property Test: Auto-Close Job**
   ```typescript
   // Feature: status-encerrado, Property 4: Auto-Close Job Completo
   test.prop([ticketArbitrary])('Auto-close deve processar corretamente', async (ticket) => {
     // Configurar ticket em waiting_customer há mais de 72h
     ticket.status = 'waiting_customer';
     ticket.updated_at = new Date(Date.now() - 73 * 60 * 60 * 1000);
     
     await autoCloseJob.run();
     
     const updated = await getTicket(ticket.id);
     expect(updated.status).toBe('closed');
     expect(updated.resolved_at).toBeDefined();
     
     const history = await getStatusHistory(ticket.id);
     expect(history).toContainEqual(expect.objectContaining({
       new_status: 'closed'
     }));
   }, { numRuns: 100 });
   ```

2. **Property Test: Filtro Hide Resolved**
   ```typescript
   // Feature: status-encerrado, Property 6: Filtro "Ocultar Resolvidos"
   test.prop([fc.array(ticketArbitrary)])('Filtro deve excluir finalizados', async (tickets) => {
     await seedTickets(tickets);
     
     const filtered = await getTickets({ hideResolved: true });
     
     const hasFinalized = filtered.some(t => 
       t.status === 'resolved' || t.status === 'closed'
     );
     expect(hasFinalized).toBe(false);
   }, { numRuns: 100 });
   ```

3. **Property Test: Campo resolved_at Round-Trip**
   ```typescript
   // Feature: status-encerrado, Property 12: Campo resolved_at Round-Trip
   test.prop([ticketArbitrary])('resolved_at deve ser preenchido e limpo', async (ticket) => {
     // Mudar para closed
     await updateTicketStatus(ticket.id, 'closed');
     let updated = await getTicket(ticket.id);
     expect(updated.resolved_at).toBeDefined();
     
     // Mudar para ongoing
     await updateTicketStatus(ticket.id, 'ongoing');
     updated = await getTicket(ticket.id);
     expect(updated.resolved_at).toBeNull();
   }, { numRuns: 100 });
   ```

### Cobertura de Testes

**Metas de Cobertura:**
- Cobertura de linhas: > 80%
- Cobertura de branches: > 75%
- Cobertura de funções: > 85%

**Áreas Críticas (100% de cobertura):**
- Lógica de mudança de status
- Auto-close job
- Validações de permissões
- Preenchimento de resolved_at

### Testes de Integração

1. **Teste de Fluxo Completo de Auto-Close**
   - Criar ticket
   - Mover para waiting_customer
   - Aguardar 72h (simulado)
   - Executar job
   - Verificar status, e-mail, pesquisa, histórico

2. **Teste de Fluxo de Reabertura**
   - Criar ticket closed
   - Reabrir como atendente
   - Verificar status, SLA, histórico

3. **Teste de Filtros em Relatórios**
   - Criar tickets de vários status
   - Gerar relatórios com filtros
   - Verificar contagens corretas

