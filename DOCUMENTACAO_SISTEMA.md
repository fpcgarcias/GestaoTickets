# Documentacao do Sistema GestaoTickets

Documentacao consolidada a partir do codigo-fonte (atualizada em outubro/2025). Todos os caminhos citados sao relativos a raiz do repositorio.

---

## Visao Geral
- **Objetivo**: plataforma multitenant de gestao de tickets de suporte, cobrindo ciclo completo (abertura, triagem, atendimento, SLA, satisfacao, relatorios) para multiplas empresas.
- **Stack principal**:
  - **Frontend**: React 19 (Vite), TypeScript, React Query, Radix UI, Tailwind.
  - **Backend**: Node.js/Express (ESM via tsx), Drizzle ORM (PostgreSQL), Zod, sessions stateful via `connect-pg-simple`.
  - **Infra compartilhada**: `shared/` com schemas, utils e tipos alinhando client/server.
- **Pilares operacionais**: prioridades dinamicas por departamento, SLAs flexiveis, pesquisas de satisfacao, auditoria de IA, notificacoes multi-canal, observabilidade (New Relic + OTEL + logs Winston).

---

## Arquitetura de Diretorios
- `client/`: aplicacao React (componentes, paginas, hooks, lib utilitaria, i18n).
- `server/`: API REST + WebSocket, organizados em `routes/`, `api/`, `services/`, `middleware/`, `telemetry/`, `utils/`.
- `shared/`: `schema.ts` (Drizzle), utilitarios de SLA, prioridade e tickets.
- `db/`, `scripts/`, `testsprite_tests/`: assets de migracoes, scripts auxiliares, suites de teste.
- Raiz: arquivos de configuracao (`package.json`, `tailwind.config.ts`, `vite.config.ts`, `drizzle.config.ts`, docs auxiliares).

---

## Backend (pasta `server/`)

### Inicializacao e Infraestrutura
- **Entrypoint**: `server/index.ts`
  - Carrega variaveis (`loadEnv`), prepara New Relic / OTEL em producao.
  - Configura Express, trust proxy amplo, helmet (CSP desabilitada por compatibilidade), CORS permissivo com allowlist e baralhamento por subdominios/IPs.
  - Trata erros globais (`uncaughtException`, `unhandledRejection`, sinais) sem derrubar o processo.
  - Sessoes: `express-session` + store `connect-pg-simple`, secret gerado dinamicamente se nao existir.
  - Integracao com Vite (dev) ou assets estaticos (prod), alem de middleware de performance customizada.

### Banco de Dados
- **Conexao**: `server/db.ts`
  - Pool `pg` com ate 45 conexoes, SSL condicional em producao.
  - Exporta `initDb`, `db` (instancia Drizzle) e `pool`.
- **Runner**: `server/migration-runner.ts`, CLI em `server/cli-migrations.ts`.
- **Seed**: `server/seed-db.ts`.

### Storage
- Interface generica em `server/storage.ts` (memoria + contratos).
- Implementacao real `server/database-storage.ts`: consultas otimizadas via Drizzle (filtros por role, dashboard, historico, paginacao).

### Autenticacao e Autorizacao
- **Login**: rota `/auth/login` em `server/routes.ts` (linha ~6850)
  - Valida credenciais com Bcrypt (`server/utils/password.ts`).
  - Bloqueia usuarios/empresas inativos e sinaliza `must_change_password`.
  - Gera sessao com metadados (role, company_id).
- **Active Directory / LDAP**: `server/utils/active-directory.ts` integra AD, normalizando dominios (variaveis `AD_DOMAIN`, `AD_EMAIL_DOMAIN`).
- **Autorizacao**: `server/middleware/authorization.ts`
  - Middlewares `authRequired`, `adminRequired`, `companyAdminRequired`, `managerRequired`, `supervisorRequired`, `triageRequired`, `viewerRequired`, `authorize`.
  - Garantia multiempresa: `companyAccessRequired` bloqueia acesso inter-company; `ticketAccessRequired` valida participacao/role para tickets.
  - Controle de participantes: `participantManagementRequired`, `canAddParticipants`, `canRemoveParticipants`.

### Rotas Principais (`server/routes.ts`)
- Mais de 14k linhas cobrindo:
  - **Tickets**: CRUD completo, filtros por role (`/tickets/user-role` linha ~1460), criacao (`POST /tickets` ~3578), atualizacoes com validações de SLA e auditoria de historico.
  - **Historico**: `/tickets/:id/history`, duracao por status, auditoria de prioridade/atribuicoes.
  - **Participantes**: endpoints dedicados e import de router especializado (`server/routes/ticket-participants.ts`).
  - **Anexos**: upload (S3) com `multer`, limites de tamanho, auditoria (`/tickets/:ticketId/attachments` ~13600).
  - **Relatorios e Dashboards**: routers `dashboard`, `logs`, `reports` e endpoints de performance.
  - **Configuracoes**: IA (`server/api/ai-configurations.ts`), permissoes de empresa, SLA (configs, resolver, dashboard), prioridades dinamicas.
  - **Autenticacao**: login, logout, troca de senha, validacao de token.

### API Modular (`server/api/`)
- **tickets/**: endpoints especificos por dominio (replies, attachments, listagem).
- **ai-configurations.ts**: CRUD de provedores/empresas, testes e auditoria.
- **sla-*`**: configuracoes, dashboards, resolver (preload/clean cache, estatisticas).
- **security-monitoring.ts**: health check, estatisticas do sistema, limpeza/log de eventos.
- **department-priorities.ts**: gestao de prioridades dinamicas por departamento.
- **satisfaction-*.ts**: pesquisas de satisfacao, dashboards e lembretes.
- **company-permissions.ts**: toggles por empresa (IA, acessos).

### Services
- **AI** (`server/services/ai-service.ts`):
  - Providers registrados: OpenAI, Google, Anthropic (`./providers/`).
  - Matching robusto com prioridades reais, fallback por peso, armazenamento de historico (`aiAnalysisHistory`).
  - Integra com `PriorityService` e `departmentPriorities`.
- **EmailConfig** (`server/services/email-config-service.ts`):
  - Suporta SMTP e APIs (Brevo, SendGrid, Mailgun).
  - Configuracao por empresa (`systemSettings` com sufixo `_company_{id}`); nunca vaza configuracao global para empresas especificas.
- **EmailNotificationService** (`server/services/email-notification-service.ts`):
  - Envio granular (novo ticket, replies, status, escalacao, lembretes SLA, pesquisas, digests).
  - Preferencias via `userNotificationSettings`, horarios e fins de semana respeitados.
- **NotificationService** (`server/services/notification-service.ts`):
  - WebSocket (ws) com grupos por role, filtros por preferencia e broadcast para admins/suporte.
  - Envia boas-vindas e integra com email para cross-channel.
- **SchedulerService** (`server/services/scheduler-service.ts`):
  - Executa `checkTickets` horaria (obedecendo janela 06h01-21h59).
  - Digests diario (08h) e semanal (domingo 09h), com filtro por empresa `SCHEDULER_COMPANY_FILTER`.
  - Permite execucao manual.
- **PriorityService**, **SlaService**, **SlaConfigurationService**: regras negociais para prioridades e SLA.
- **Logger** (`server/services/logger.ts`):
  - Winston com rotacao diaria para performance, arquivo dedicado para security, redireciona console em producao.
  - Helpers `logPerformance`, `logSecurity`.
- **S3Service** (`server/services/s3-service.ts`): upload, remocao, presign, normaliza buckets/chaves.

### Middleware
- **performance.ts**: coleta tempo de resposta, memoria e CPU; loga requests lentas e disponibiliza utilitarios para dashboards.
- **authorization.ts**: (detalhado acima).
- **telemetry/custom-metrics.ts**: auxilia integracao com New Relic/OTEL.

### Telemetria (`server/telemetry/`)
- `newrelic.ts`, `otel-config.ts`: instrumentacao de traces/metricas (OTLP HTTP exporters).
- `custom-metrics.ts`: metricas de API (tempo, erro).

### Utils (`server/utils/`)
- `active-directory.ts`: autenticacao LDAP com normalizacao de dominio.
- `password.ts`: hash/verify com bcrypt, manutencao de tokens temporarios.
- `password-migration.ts`: conversao de senhas legadas.
- `priority-fallback.ts`: logica de fallback para prioridades ausentes no banco.

---

## Modelo de Dados (`shared/schema.ts`)
- **Enums**:
  - Status de ticket (`ticketStatusEnum`), roles (`userRoleEnum`), modo de SLA (`slaModeEnum`), provedores de IA (`aiProviderEnum`).
- **Tabelas chave**:
  - `companies`: tenants (cnpj, dominio, permissao IA, flag SLA flexivel).
  - `users`: autenticacao (role, AD, empresa, flags).
  - `customers`: relaciona usuarios clientes, dados de contato.
  - `departments`, `officials`, `official_departments`: estrutura de atendimento e relacionamento N:N.
  - `tickets`: chamados (status, prioridade dinamica, tipo, departamento, SLA).
  - `ticket_replies`, `ticket_status_history`, `ticket_participants`, `ticket_attachments`.
  - `department_priorities`: lista dinamica com peso e flag `is_active`.
  - `sla_definitions`, `sla_configurations`: regras basicas e flexiveis.
  - `ai_configurations`, `ai_analysis_history`: configuracoes e auditoria IA.
  - `user_notification_settings`: preferencia por tipo/horario/finais de semana.
  - `system_settings`: chave-valor global/por empresa (email, temas, toggles).
  - `satisfaction_surveys`: configuracoes e resultados de pesquisa.
- **Esquemas Zod**: `insert`/`select` para tickets, replies, usuarios etc., reaproveitados pelo front.
- **Relacoes**: `relations` organiza joins (tickets -> replies, attachments, analises IA, participantes).

---

## Fluxos de Negocio

### Ciclo do Ticket
1. **Criacao** (`client/src/components/tickets/ticket-form.tsx`, `/api/tickets`):
   - Formulario com busca incremental de clientes (`CustomerSearch`) e participantes (`ParticipantSearch`).
   - Prioridade inicial pode ser deixada vazia para IA determinar.
   - Upload de anexos com preview e controle de estado.
   - Modal orientando etapas (criando, analisando IA, finalizado, erro).
2. **SLA**:
   - `shared/utils/sla-calculator.ts` calcula janelas validas, pausas e tempo efetivo de trabalho.
   - `server/api/sla-resolver.ts` faz preload de caches, resolve status e gera estatisticas.
   - Violar SLA marca `tickets.sla_breached` e dispara notificacoes.
3. **Historico e Auditoria**:
   - `ticket_status_history` guarda status, prioridade, atribuicao, departamento, justificativa.
   - Participantes tem historico proprio (`ticketParticipantsHistory`).
4. **IA**:
   - `AiService` consulta prioridades reais, chama provider configurado, ajusta prioridade final e persiste `ai_analysis_history`.
   - Auditoria visual via `client/src/pages/ai-audit.tsx`.
5. **Notificacoes**:
   - Email e WebSocket informam novos tickets, replies, mudancas de status, proximidade de SLA, novos usuarios/clientes.
   - Usuarios podem personalizar preferencia via `client/src/components/notification-settings.tsx`.

### Pesquisas de Satisfacao
- Configuracao por empresa/departamento.
- Envio automatico pos-resolucao + lembretes.
- Dashboard `client/src/pages/reports/satisfaction-dashboard.tsx` com filtros e graficos.

### Relatorios e Dashboards
- `client/src/pages/dashboard.tsx`: overview (tickets por status, SLA, cards priorizados).
- `performance-dashboard.tsx`: integra middleware de performance (`server/middleware/performance.ts`).
- `reports.tsx`: exportacoes e metricas detalhadas por periodo, departamento, prioridade.
- `logs.tsx`: leitura de logs de seguranca/erro agregados.

---

## Frontend (`client/`)

### Estrutura Principal
- **`main.tsx`**: monta Providers (QueryClient, Auth, Theme, WebSocket, I18n) e injeta `App`.
- **`App.tsx`**:
  - Rotas com `wouter`.
  - Protecao com `ProtectedRoute` (verifica sessao, role e redireciona para autenticao/troca de senha).
  - Layout compartilhado (sidebar, header, toasts).

### Estado e Contexto
- **Auth** (`client/src/hooks/use-auth.tsx`): gerencia usuario logado, empresa, loading, login/logout, refresh.
- **Theme** (`client/src/contexts/theme-context.tsx`): seleciona paleta por empresa (default, vix, oficinaMuda), integra com `useTheme`.
- **WebSocket** (`client/src/contexts/websocket-context.tsx`): conecta NotificationService e fornece hook para ouvir eventos.
- **React Query** (`client/src/lib/query-client.ts`): configuracoes padrao de cache, erros, revalidacao condicionada.
- **I18n** (`client/src/i18n`): `useI18n` expone `formatMessage`, `locale`; mensagens pt-BR e en-US em `messages/`.

### Componentes de Tickets
- `ticket-form.tsx`: formulario completo (ver fluxo acima).
- `ticket-card.tsx`, `ticket-detail.tsx`, `ticket-history.tsx`, `ticket-reply.tsx`: visoes de lista e detalhe.
- `participant-management.tsx`, `participant-list.tsx`: gestao de participantes.
- `sla-indicator.tsx`, `sla-status.tsx`: exibem SLA atual, cores e alertas.
- `ai-analysis-history.tsx`: timeline das analises de IA.
- `attachments-list.tsx`, `file-upload.tsx`: upload/download com preview e progresso.

### Paginas
- `pages/tickets/index.tsx`: listagem com filtros (status, prioridade, departamento, responsavel, periodo), paginacao e quick actions.
- `pages/tickets/new.tsx`: wrapper do formulario para nova criacao.
- `pages/tickets/[id].tsx`: detalhe via `TicketDetail`.
- `pages/dashboard.tsx`, `performance-dashboard.tsx`, `logs.tsx`, `reports/*.tsx`, `satisfaction-dashboard.tsx`, `ai-audit.tsx`: consoles analiticos.
- `pages/settings.tsx`: centraliza configuracoes (temas, IA, e-mail, notificacoes).
- `pages/companies`, `pages/users`, `pages/officials`, `pages/clients`: gestao de entidades administrativas.
- `pages/auth-page.tsx`: tela de login + integracao AD, inclui `ForcedPasswordChangeModal`.

### UI e Utilitarios
- `components/ui/`: wrappers Radix (Dialog, Select, Tabs, Popover, Toast, etc.), `comparison-arrow.tsx`, `calendar` etc.
- `hooks/use-priorities.tsx`, `use-sla.tsx`, `use-system-settings.ts`, `use-toast.ts`: abstraem chamadas e estado reativo.
- `lib/utils.ts`: helpers (formatos, status, prioridades legadas, datas, formatacao de tickets).
- Tailwind centralizado em `index.css` com tokens customizados.

---

## Seguranca
- **HTTP Hardening**: helmet (HSTS parcial), CORS com allowlist e fallback logado, rate limiters especificos (login, upload) com `express-rate-limit`.
- **Sessao**: cookies assinados, `trust proxy` habilitado para suportar terminacoes TLS, store persistente em Postgres.
- **Validacoes**: Zod nas rotas (`validateSchema`), express-validator em pontos criticos, sanitizacao XSS (`xss`), `multer` limita MIME/tamanho.
- **Controle de Acesso**: middlewares centralizados, cheque de empresa/participacao, bloqueio para bots (`integration_bot`).
- **Logs de Seguranca**: `securityLogger` escreve `logs/security.log`; endpoints para leitura/limpeza (`server/api/security-monitoring.ts`).
- **Tratamento de Erros**: listeners globais previnem crash, logam apenas eventos relevantes, `process.exit` evitado.
- **Protecao contra brute force**: `authLimiter` (rate limit) + auditoria de tentativas.

---

## Observabilidade
- **New Relic / OTEL**: ativados em producao (NODE_ENV=production) via `server/index.ts`; exporters HTTP para traces e metricas.
- **Metricas Customizadas**: `recordApiResponseTime`, `recordApiError`.
- **Logs**:
  - `logs/combined.log`, `logs/error.log`, `logs/performance.log`, `logs/security.log`.
  - Rotacao diaria (`winston-daily-rotate-file`) com compressao e retenção 14 dias para performance.
- **Dashboards internos**: performance, logs e AI audit leem diretamente os arquivos via endpoints.

---

## Integracoes Externas
- **Armazenamento S3**: `@aws-sdk/client-s3` + `s3-request-presigner`, compatibilidade Wasabi; variaveis `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
- **Email Providers**: SMTP, Brevo, SendGrid, Mailgun; configuracoes salvam `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `email_provider`, `api_key`, `from_email`.
- **Active Directory**: LDAPTS, variaveis `AD_URL`, `AD_BIND_DN`, `AD_BIND_PASSWORD`, `AD_DOMAIN`, `AD_EMAIL_DOMAIN`.
- **IA**: API keys por provider (`openai`, `google`, `anthropic`) armazenadas em `ai_configurations`.
- **New Relic**: `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_NO_CONFIG_FILE`.
- **OpenTelemetry**: exporters configurados para HTTP OTLP; variaveis `OTEL_EXPORTER_OTLP_ENDPOINT` etc.

---

## Agendamentos e Automacoes
- `SchedulerService.start()` (chamado em `server/index.ts` quando habilitado) cuida da rotina:
  - Verificacao horaria de tickets proximos do SLA (`checkTicketsDueSoon`).
  - Lembretes de pesquisa de satisfacao (`checkSatisfactionSurveyReminders`).
  - Digest diario e semanal para participantes (`generateDailyDigestForParticipants`, `generateWeeklyDigestForParticipants`).
- Respeita janela de hibernacao (21h-06h); filtro `SCHEDULER_COMPANY_FILTER` aceita `*`, lista de IDs ou exclusao `<>ID`.
- Metodos manuais expostos para acionamento administrativo.

---

## Configuracao e Deploy
- **Scripts NPM** (`package.json`):
  - `dev`: sobe API (tsx) + Vite.
  - `build`: `vite build` + bundle server (esbuild).
  - `build:prod` / `start:prod`: pipeline para producao.
  - `migrate`, `migrate:up/down/status`: utilitarios CLI.
  - `db:push`, `db:check-roles`: operacoes Drizzle.
  - `check`: `tsc`.
- **Variaveis essenciais**:
  - `DATABASE_URL` (obrigatoria), `SESSION_SECRET` (opcional, gerado se ausente).
  - `NODE_ENV` (`production` habilita monitoramento e altera log level).
  - `SCHEDULER_COMPANY_FILTER`, `HIBERNATION_START/END` (se existirem), `DEFAULT_THEME`.
  - Chaves para integracoes (IA, email, S3, New Relic, AD).
- **Logs e Monitoramento**: pasta `logs/` deve existir com permissao de escrita; New Relic requer arquivo `newrelic.js` ou variaveis correspondentes.
- **Reverse Proxy**: config nginx sugerida em `nginx-websocket-config.conf` (suporte a WebSocket, gzip, TLS).
- **Deploy serverless**: `.vercel` indica deploy via Vercel para frontend; backend mantem servidor proprio (precisa de host Node).

---

## Testes e Qualidade
- **Testsprite**: pasta `testsprite_tests/` (scripts especificos).
- **Validacoes automatizadas**:
  - Schemas Zod garantem payloads (API e frontend).
  - React Query e hooks encapsulam acesso a API com tratamento de erros/estados.
  - Auditorias de IA e SLA geram logs detalhados para investigacao.
- **Monitoramento continuo**: metricas OTEL + New Relic + performance logger oferecem alertas precoces.

---

## Referencias Rapidas
- **Criacao de ticket**:
  - Front: `client/src/components/tickets/ticket-form.tsx`.
  - Back: `server/routes.ts` (POST `/tickets`), `AiService`, `EmailNotificationService`.
- **Gestao de SLA**:
  - API: `server/api/sla-configurations.ts`, `server/api/sla-resolver.ts`.
  - Front: `client/src/components/tickets/sla-status.tsx`, `client/src/pages/sla-configurations.tsx`.
- **Notificacoes**:
  - Email: `server/services/email-notification-service.ts`.
  - WebSocket: `server/services/notification-service.ts`.
  - Config front: `client/src/components/notification-settings.tsx`.
- **IA**:
  - Service: `server/services/ai-service.ts`.
  - Config front: `client/src/components/ai-settings.tsx`.
  - Auditoria: `client/src/pages/ai-audit.tsx`.
- **Seguranca**:
  - Middlewares: `server/middleware/authorization.ts`, `server/middleware/performance.ts`.
  - Monitoramento: `server/api/security-monitoring.ts`, `logs/security.log`.

---

## Proximos Passos Suggeridos
1. Validar roteiro operacional com equipe de suporte para garantir que fluxos documentados refletem praticas reais.
2. Completar inventario de variaveis de ambiente consultando `.env` e publicando em runbook separado.
3. Planejar suite de testes automatizados (unitarios + e2e) usando Drizzle + React Testing Library para cobrir fluxos criticos (criacao ticket, SLA, notificacoes).

---

Esta documentacao deve ser atualizada sempre que novos dominios (ex.: integracoes adicionais, novos roles) forem adicionados ao repositorio. Utilize comentarios existentes no codigo como guia para expandir trechos especificos.

