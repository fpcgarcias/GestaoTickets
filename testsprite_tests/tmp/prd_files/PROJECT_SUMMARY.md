# Resumo do Projeto Gestão de Tickets

## Visão Geral
O projeto `GestaoTickets` é um sistema de gerenciamento de tickets, provavelmente para suporte técnico ou atendimento, desenvolvido em stack full-stack com frontend em React (usando Vite), backend em Node.js/TypeScript e banco de dados PostgreSQL gerenciado por Drizzle ORM. Ele inclui suporte a multitenancy, SLAs (Service Level Agreements), prioridades, departamentos e integrações como Active Directory para autenticação.

## Funcionalidades Principais
- **Gerenciamento de Tickets**: Criação, edição, respostas e acompanhamento de tickets (ver pastas `tickets/` e `ticket-replies.ts` no server).
- **SLAs e Prioridades**: Configurações de SLAs, resolução de tickets com base em prazos, prioridades por departamento (arquivos como `sla-configurations.ts`, `priority-service.ts`, `department-priorities.ts`).
- **Departamentos e Permissões**: Gerenciamento de departamentos, permissões por empresa e usuários (pastas `departments/`, `company-permissions.ts`).
- **Tipos de Incidentes e Tickets**: Definições de tipos de tickets e incidentes (`incident-types/`, `ticket-types.ts`).
- **Relatórios e Dashboards**: Rotas para dashboards, relatórios e logs (`dashboard.ts`, `reports.ts`, `logs.ts`).
- **Anexos e Armazenamento**: Suporte a anexos via S3 (`attachments/`, `s3-service.ts`).
- **Agendamento e Serviços**: Scheduler para tarefas automáticas (`scheduler-service.ts`).
- **Integração com AI**: Configurações para IA, possivelmente para categorização ou automação (`ai-configurations.ts`, `ai-service.ts`).
- **Multitenancy**: Suporte a múltiplas empresas/tenants (`07-multitenancy.mdc` em .cursor).

## Autenticação e Segurança
- **Active Directory**: Integração com AD para autenticação de usuários (`active-directory.ts` em utils).
- **Sessões e Autorização**: Middleware para autorização e sessões Express (`authorization.ts`, `express-session.d.ts`).
- **Segurança**: Monitoramento de segurança, migração de senhas e práticas seguras (`security.ts`, `password.ts`, `security-monitoring.ts`).
- **Usuários**: Gerenciamento de usuários, incluindo suporte e orfãos (`users/`, `clean-orphan-users.ts`).

## Banco de Dados
- **ORM e Migrações**: Drizzle ORM para TypeScript, com migrações gerenciadas (`drizzle.config.ts`, `migrations/`, `db.ts`, `migrate.ts`).
- **Schema Compartilhado**: Definições de schema em `shared/schema.ts`.
- **Estrutura**: Tabelas para tickets, usuários, departamentos, prioridades, SLAs, etc. (arquivos JSON em `banco de dados/` descrevem colunas, chaves estrangeiras, índices e tabelas).
- **Transações**: Gerenciador de transações (`transaction-manager.ts`).
- **Seeds e Fixes**: Scripts para popular dados e corrigir issues (`seed-db.ts`, `fix_dept_null_immediate.sql`).
- **PostgreSQL**: Provavelmente Neon ou similar, dado o suporte a branches e migrações.

## Arquitetura e Tecnologias
- **Frontend**: React com TypeScript, componentes em `client/src/components/`, páginas em `pages/`, contextos e hooks para estado.
- **Backend**: Node.js/Express, rotas em `routes/`, serviços em `services/`, API endpoints em `api/`.
- **Compartilhado**: Utils para prioridades, SLAs e tickets (`shared/utils/`).
- **Configurações**: Tailwind CSS, PostCSS, Vite para build.
- **Deploy**: Vercel (`.vercel/project.json`), Nginx para WebSockets (`nginx-websocket-config.conf`).
- **Testes e Docs**: Suporte a Testsprite, regras em `.cursor/rules/`, assets e imagens em `attached_assets/` e `images/`.

## Detalhamento técnico e operacional

- Stack geral
  - Frontend: React + Vite, Tailwind CSS, React Router, React Query para cache e sincronização de dados.
  - Backend: Node.js + Express, Zod (validação), Drizzle ORM (PostgreSQL), middlewares de segurança (Helmet, CORS, Rate Limiting), sessões com cookie e store em Postgres em produção.
  - Compartilhado: Tipos e esquemas (Zod/Drizzle) em shared/ para consistência entre client e server.
  - Infra de arquivos: Armazenamento de anexos em S3 compatível (Wasabi), com chaves s3_key/s3_bucket vinculadas aos anexos no banco.
  - Agendador: Serviço de scheduler de notificações por e‑mail com filtro por empresas via variável SCHEDULER_COMPANY_FILTER.

- Fluxos principais
  - Autenticação (Active Directory):
    1) Usuário informa credenciais; 2) Serviço AD valida; 3) Sistema normaliza domínio do e‑mail (AD_EMAIL_DOMAIN/AD_DOMAIN) quando necessário; 4) Sessão de usuário é criada; 5) Regras de autorização aplicadas por perfis/roles.
  - Ciclo do Ticket: criação (com prioridade e tipo), atualização de status, respostas/comentários, anexos (upload para S3/Wasabi), participantes adicionais, histórico de status e SLA.
  - SLA e Prioridade: configuração por departamento/empresa; cálculo de horas úteis, pausa/retomada por status; regra de sugestão e mapeamento de prioridade (dinâmica/legado). Pausas e reinícios seguem matrizes definidas em shared/utils e ticket-utils.
  - Notificações: preferências por usuário; scheduler consulta tickets pendentes e envia notificações conforme janelas e filtros de empresa, evitando processamento duplicado em multi‑instâncias.

- Segurança e conformidade
  - Helmet com políticas seguras, CORS configurado por ambiente, rate limiting ativo em produção.
  - Sessões httpOnly e sameSite apropriado; secure habilitado em produção; segredo de sessão vindo do ambiente.
  - Validações Zod nas entradas (ex.: criação de tickets, templates de e‑mail, configurações de IA/SLA, etc.).
  - Registro e auditoria: logs com níveis diferenciados por ambiente; trilhas de auditoria via históricos de tickets e configurações onde aplicável.

- Persistência e entidades-chave (PostgreSQL via Drizzle ORM)
  - Empresas (companies), Usuários (users) e Clientes (customers) com e‑mails únicos.
  - Departamentos (departments), Oficiais (officials) e vínculo many‑to‑many (official_departments).
  - Tickets (tickets): campos para prioridade, tipo, SLA e e‑mail do cliente; índices de desempenho aplicáveis.
  - Respostas (ticket_replies), Histórico de status (ticket_status_history) para auditoria do ciclo.
  - Anexos (ticket_attachments): referência a s3_key e s3_bucket para armazenamento externo.
  - Participantes (ticket_participants): colaboração e visibilidade.
  - Configurações: sistema (system_settings), SLA (sla_configurations), prioridades por departamento (department_priorities).
  - Tipificações e categorização: ticket_types, incident_types, categories.
  - E‑mail: templates (email_templates) com tipos (criação, atualização, SLA, etc.).
  - IA: configurações (ai_configurations) por provedor e histórico de análises (ai_analysis_history) com sugestão de prioridade e observações.

- SLA e Prioridades (regras)
  - SLA: cálculo em horas úteis com intervalo configurável por dia, pausa para certos status (ex.: aguardando cliente), retomada em mudanças específicas, e encerramento quando resolvido/fechado.
  - Prioridade: pesos ordenáveis, conversões entre nomenclaturas legadas e dinâmicas, validação de duplicidade e de consistência de pesos; criação de padrões por departamento.

- Agendador de Notificações
  - Frequência: execução periódica (ex.: hora em hora) para varredura de tickets elegíveis.
  - Filtro por empresa: SCHEDULER_COMPANY_FILTER aceita padrões como "*" (todas), listas ("1,2,5") e exclusões ("<>3").
  - Objetivo: evitar e‑mails duplicados em ambientes/instâncias diferentes, com logs claros do que foi processado e filtrado.

- Integrações externas
  - Active Directory: credenciais e base DN via ambiente; normalização de e‑mail por AD_EMAIL_DOMAIN/AD_DOMAIN.
  - Armazenamento S3/Wasabi: endpoint, região e credenciais via ambiente; upload/download por URLs assinadas; metadados persistidos em ticket_attachments.
  - IA: provedores configuráveis no banco (OpenAI, Anthropic, Azure/custom endpoints), com API endpoint e chave armazenados em ai_configurations; histórico de execuções em ai_analysis_history.

- Frontend: navegação e estado
  - Rotas privadas para: Dashboard, Tickets (lista/detalhe), Relatórios, Configurações (SLA, Prioridades, E‑mail, IA), etc.; páginas públicas como /auth e /changelog.
  - React Query: cache, invalidação por chaves, revalidação em segundo plano, controle de erros e estados de carregamento.
  - UX: formulários com validação, tabelas com paginação/virtualização quando necessário, feedback claro de operações e estados do SLA.

- Variáveis de ambiente (principais)
  - Gerais: NODE_ENV, PORT (opcional).
  - Banco: DATABASE_URL (obrigatória).
  - Sessão: SESSION_SECRET (recomendado em produção; fallback gerado em dev).
  - Active Directory: AD_URL, AD_BASE_DN, AD_USERNAME, AD_PASSWORD, AD_DOMAIN (opcional), AD_EMAIL_DOMAIN (opcional para normalização de e‑mail).
  - S3/Wasabi: WASABI_ACCESS_KEY_ID, WASABI_SECRET_ACCESS_KEY, WASABI_REGION (padrão us‑east‑1), WASABI_ENDPOINT (padrão https://s3.wasabisys.com), WASABI_BUCKET_NAME.
  - Scheduler: SCHEDULER_COMPANY_FILTER (ex.: "*", "1,2,5", "<>3").

- Operação e deploy
  - Desenvolvimento: Vite dev server integrado ao Express; CORS e logs verbosos; store de sessão em memória.
  - Produção: build do client (Vite) e bundle do server (esbuild); serve estático de dist/public; store de sessão em Postgres; SSL opcional conforme infraestrutura; rate limiting habilitado.
  - Migrações: Drizzle executa/valida na inicialização do servidor; script auxiliar para índices de performance quando necessário.

- Observabilidade e logs
  - Logger com níveis por ambiente (debug em dev, info em prod); logs de requisição; logs específicos do scheduler (empresas processadas, contagens e filtros aplicados).
  - Erros tratados com respostas padronizadas e detalhes no log; em dev, mensagens mais descritivas para diagnóstico.

- Testes e qualidade
  - Plano de testes backend cobrindo: criação/atualização de tickets, respostas, SLA, departamentos, usuários, configurações e rotas do scheduler.
  - Recomenda‑se testes de integração para rotas críticas (tickets, anexos, AD login) e testes de UI e2e para fluxos chave no frontend.

- Boas práticas e performance
  - Índices no banco para consultas de tickets e e‑mails; normalização de entidades e uso de relações Drizzle.
  - Cache de dados no client via React Query; invalidação seletiva para manter consistência.
  - Segurança por padrão: headers, cookies seguros em produção, validação de entrada, e limitação de taxa.

- Roadmap sugerido
  - Notificações em tempo real via WebSocket para eventos de ticket (opcional, há contexto de WebSocket no frontend).
  - Painéis adicionais: produtividade por atendente, burndown de SLA por departamento.
  - Fluxo de anexos offline/reativo com fila no client.
  - Melhoria de observabilidade: tracing distribuído e métricas de SLA.

---

Caso deseje, posso transformar este resumo em documentação por público (Negócio, Suporte, TI/DevOps) ou gerar checklists de implantação para ambientes DEV/QA/PROD.