# Documentação da Estrutura do Banco de Dados

## Visão Geral

Este documento descreve a estrutura do banco de dados PostgreSQL do sistema de gerenciamento de tickets, incluindo enums, tabelas principais e relacionamentos.

---

## Enums

### ticket_status

Enum que define os possíveis status de um ticket no sistema.

**Valores:**

- `new` - Ticket novo, recém-criado
- `ongoing` - Ticket em andamento, sendo trabalhado
- `suspended` - Ticket suspenso temporariamente
- `waiting_customer` - Aguardando resposta do cliente
- `escalated` - Ticket escalado para nível superior
- `in_analysis` - Ticket em análise
- `pending_deployment` - Aguardando implantação/deploy
- `reopened` - Ticket reaberto após ter sido finalizado
- `resolved` - Ticket resolvido com sucesso
- `closed` - Ticket encerrado sem resolução efetiva (por timeout, abandono, etc)

**Notas:**
- O status `closed` é usado quando um ticket é encerrado automaticamente por falta de interação do cliente ou por outros motivos que não representam uma resolução efetiva do problema
- O status `resolved` deve ser usado apenas quando o problema foi efetivamente solucionado
- Ambos os status `resolved` e `closed` preenchem o campo `resolved_at` com o timestamp de finalização
- Quando um ticket muda de `resolved` ou `closed` para outro status, o campo `resolved_at` é limpo (definido como null)

---

### email_template_type

Enum que define os tipos de templates de e-mail disponíveis no sistema.

**Valores:**

- `new_ticket` - Template enviado quando um novo ticket é criado
- `ticket_assigned` - Template enviado quando um ticket é atribuído a um atendente
- `ticket_reply` - Template enviado quando há uma nova resposta no ticket
- `status_changed` - Template enviado quando o status do ticket é alterado
- `ticket_resolved` - Template enviado quando um ticket é resolvido com sucesso
- `ticket_closed` - Template enviado quando ticket é encerrado automaticamente
- `ticket_escalated` - Template enviado quando um ticket é escalado
- `ticket_due_soon` - Template enviado quando o vencimento do SLA está próximo
- `customer_registered` - Template enviado quando um novo cliente é registrado
- `user_created` - Template enviado quando um novo usuário é criado
- `system_maintenance` - Template enviado para notificar sobre manutenção do sistema
- `ticket_participant_added` - Template enviado quando um participante é adicionado ao ticket
- `ticket_participant_removed` - Template enviado quando um participante é removido do ticket
- `satisfaction_survey` - Template enviado com a pesquisa de satisfação
- `satisfaction_survey_reminder` - Template enviado como lembrete da pesquisa de satisfação
- `waiting_customer_closure_alert` - Template de alerta enviado 48h antes do encerramento automático

**Notas:**
- O template `ticket_closed` é usado especificamente para notificar o cliente quando um ticket é encerrado automaticamente por falta de interação
- O template `ticket_resolved` é usado quando o ticket é resolvido com sucesso pelo atendente
- Ambos os templates (`ticket_closed` e `ticket_resolved`) disparam o envio da pesquisa de satisfação

---

### user_role

Enum que define os papéis/permissões dos usuários no sistema.

**Valores:**

- `admin` - Acesso total ao sistema, multiempresa
- `customer` - Cliente da empresa que cria tickets
- `support` - Atendente que responde tickets
- `manager` - Gestor da equipe de suporte
- `supervisor` - Nível intermediário entre manager e support
- `viewer` - Apenas visualização de chamados
- `company_admin` - Administrador local da empresa
- `triage` - Responsável por classificação e encaminhamento de tickets
- `quality` - Responsável por avaliação de qualidade
- `integration_bot` - Bots e integrações automatizadas
- `inventory_manager` - Gestor de estoque

---

### sla_mode

Enum que define o modo de cálculo de SLA por departamento.

**Valores:**

- `type` - SLA calculado com base no tipo de ticket
- `category` - SLA calculado com base na categoria do ticket

---

### ai_provider

Enum que define os provedores de IA disponíveis para análise de tickets.

**Valores:**

- `openai` - OpenAI (GPT-4, GPT-3.5, etc)
- `google` - Google AI (Gemini, etc)
- `anthropic` - Anthropic (Claude, etc)

---

## Tabelas Principais

### companies

Tabela que armazena as empresas do sistema (multi-tenant).

**Campos principais:**
- `id` - Identificador único
- `name` - Nome da empresa
- `email` - E-mail de contato
- `domain` - Domínio da empresa
- `active` - Flag indicando se a empresa está ativa
- `cnpj` - CNPJ da empresa
- `ai_permission` - Permite que a empresa use IA (padrão: true)
- `uses_flexible_sla` - Flag para sistema de SLA flexível (padrão: false)
- `logo_base64` - Logotipo da empresa em base64

---

### users

Tabela de usuários do sistema para autenticação.

**Campos principais:**
- `id` - Identificador único
- `username` - Nome de usuário (único)
- `password` - Senha criptografada
- `email` - E-mail (único)
- `name` - Nome completo
- `role` - Papel do usuário (user_role enum)
- `active` - Flag indicando se o usuário está ativo
- `ad_user` - Flag indicando se é usuário do Active Directory
- `must_change_password` - Flag para forçar troca de senha
- `company_id` - Referência para a empresa

---

### tickets

Tabela principal de tickets/chamados.

**Campos principais:**
- `id` - Identificador único
- `ticket_id` - ID público do ticket (único)
- `title` - Título do ticket
- `description` - Descrição detalhada
- `status` - Status atual (ticket_status enum)
- `priority` - Prioridade (TEXT para prioridades dinâmicas)
- `type` - Tipo do ticket
- `customer_id` - Referência para o cliente
- `customer_email` - E-mail do cliente
- `assigned_to_id` - Atendente responsável
- `company_id` - Referência para a empresa
- `first_response_at` - Timestamp da primeira resposta
- `resolved_at` - Timestamp de finalização (preenchido para status 'resolved' e 'closed')
- `sla_breached` - Flag indicando se o SLA foi violado
- `waiting_customer_alert_sent_at` - Timestamp do envio do alerta de encerramento

**Notas sobre resolved_at:**
- Este campo é preenchido automaticamente quando o status do ticket muda para `resolved` ou `closed`
- O campo é limpo (definido como null) quando o ticket é reaberto ou muda para qualquer outro status ativo
- É usado para cálculos de métricas e relatórios de tickets finalizados

---

### ticket_status_history

Tabela que registra o histórico de mudanças de status, prioridade e atribuições dos tickets.

**Campos principais:**
- `id` - Identificador único
- `ticket_id` - Referência para o ticket
- `old_status` - Status anterior (ticket_status enum)
- `new_status` - Novo status (ticket_status enum)
- `old_priority` - Prioridade anterior (TEXT)
- `new_priority` - Nova prioridade (TEXT)
- `change_type` - Tipo de mudança ('status', 'priority', 'assignment', 'department')
- `changed_by_id` - Usuário que fez a alteração (null para processos automáticos)
- `old_assigned_to_id` - Atendente anterior
- `new_assigned_to_id` - Novo atendente
- `old_department_id` - Departamento anterior
- `new_department_id` - Novo departamento

**Notas:**
- Todas as mudanças para e de status `closed` são registradas nesta tabela
- O campo `changed_by_id` é null quando a mudança é feita por processos automáticos (como o auto-close job)

---

### email_templates

Tabela que armazena os templates de e-mail do sistema.

**Campos principais:**
- `id` - Identificador único
- `name` - Nome do template
- `type` - Tipo do template (email_template_type enum)
- `description` - Descrição do template
- `subject_template` - Template do assunto do e-mail
- `html_template` - Template HTML do corpo do e-mail
- `text_template` - Template de texto plano (opcional)
- `is_active` - Flag indicando se o template está ativo
- `is_default` - Flag indicando se é o template padrão
- `available_variables` - Variáveis disponíveis para o template (JSON string)
- `company_id` - Referência para a empresa (null para templates globais)

---

### departments

Tabela de departamentos por empresa.

**Campos principais:**
- `id` - Identificador único
- `name` - Nome do departamento
- `description` - Descrição
- `company_id` - Referência para a empresa
- `is_active` - Flag indicando se o departamento está ativo
- `sla_mode` - Modo de cálculo de SLA (sla_mode enum)
- `satisfaction_survey_enabled` - Flag para habilitar pesquisa de satisfação
- `use_service_providers` - Flag para usar prestadores de serviço
- `use_inventory_control` - Flag para usar controle de inventário
- `auto_close_waiting_customer` - Flag para encerramento automático de tickets em 'waiting_customer'

---

### sla_definitions

Tabela que define os SLAs por prioridade.

**Campos principais:**
- `id` - Identificador único
- `priority` - Prioridade (TEXT para prioridades dinâmicas)
- `response_time_hours` - Tempo de resposta em horas
- `resolution_time_hours` - Tempo de resolução em horas
- `company_id` - Referência para a empresa

---

## Relacionamentos Principais

### Tickets
- `tickets.customer_id` → `customers.id`
- `tickets.assigned_to_id` → `officials.id`
- `tickets.company_id` → `companies.id`
- `tickets.department_id` → `departments.id`
- `tickets.incident_type_id` → `incident_types.id`
- `tickets.category_id` → `categories.id`

### Histórico
- `ticket_status_history.ticket_id` → `tickets.id`
- `ticket_status_history.changed_by_id` → `users.id`
- `ticket_status_history.old_assigned_to_id` → `officials.id`
- `ticket_status_history.new_assigned_to_id` → `officials.id`

### Usuários e Empresas
- `users.company_id` → `companies.id`
- `customers.company_id` → `companies.id`
- `officials.company_id` → `companies.id`
- `departments.company_id` → `companies.id`

---

## Índices e Performance

### Índices Recomendados

- `tickets.status` - Para filtros por status
- `tickets.company_id` - Para isolamento multi-tenant
- `tickets.assigned_to_id` - Para filtros por atendente
- `tickets.customer_id` - Para busca de tickets por cliente
- `tickets.created_at` - Para ordenação temporal
- `ticket_status_history.ticket_id` - Para consultas de histórico
- `email_templates.type` - Para busca de templates por tipo
- `email_templates.company_id` - Para templates por empresa

---

## Notas de Migração

### Adição do Status "Encerrado"

A migração que adiciona o status `closed` ao enum `ticket_status` e o template `ticket_closed` ao enum `email_template_type` é idempotente e pode ser executada múltiplas vezes sem causar erros.

**Impacto:**
- Nenhum dado existente é alterado
- Novos valores são adicionados aos enums
- Aplicações devem ser atualizadas para reconhecer os novos valores

---

## Convenções

### Nomenclatura
- Tabelas: snake_case, plural quando apropriado
- Colunas: snake_case
- Enums: snake_case para o nome, valores em lowercase
- Timestamps: sempre com timezone (padrão UTC)

### Soft Delete
- Tabelas principais usam flag `is_active` ou `active` ao invés de deletar registros
- Permite auditoria e recuperação de dados

### Multi-Tenancy
- Todas as tabelas de dados de negócio incluem `company_id`
- Queries devem sempre filtrar por `company_id` (exceto para role admin)
- Validações de acesso devem ser feitas no backend

---

## Manutenção

### Backup
- Backup diário completo recomendado
- Backup incremental a cada 6 horas
- Retenção mínima de 30 dias

### Limpeza
- Logs de performance: retenção de 14 dias
- Logs de segurança: retenção de 90 dias
- Anexos de tickets: retenção indefinida (ou conforme política da empresa)

---

**Última atualização:** Fevereiro de 2026
**Versão do Schema:** 1.0 (com status "Encerrado")
