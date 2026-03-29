# Plano de Implementação: Sistema Centralizado de Logging em Banco de Dados

## Visão Geral

Migração do sistema de logging baseado em arquivos Winston para um sistema centralizado em PostgreSQL. A implementação segue uma abordagem incremental: schema → buffer/logger → middleware → API → frontend → retenção → integração final.

## Tasks

- [x] 1. Criar schema Drizzle e migração da tabela `system_logs`
  - [x] 1.1 Adicionar a definição da tabela `system_logs` em `shared/schema.ts` com todos os campos: id, level, message, server_identifier, trace_id, span_id, context_data (JSONB), company_id, user_id, request_method, request_url, response_status, response_time_ms, created_at (timestamptz)
    - Adicionar referências FK para `companies.id` e `users.id`
    - Criar os índices: created_at DESC, level, server_identifier, trace_id, company_id, request_url, e índice composto (level, created_at DESC)
    - Exportar o `insertSystemLogSchema` via `createInsertSchema`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Gerar e executar a migração do banco de dados com `drizzle-kit`
    - _Requisitos: 1.1, 1.3_

- [x] 2. Implementar o LogBuffer e o Logger programático
  - [x] 2.1 Criar `server/services/log-buffer.ts` — classe singleton LogBuffer
    - Implementar buffer em memória com `MAX_BUFFER_SIZE = 50` e `FLUSH_INTERVAL_MS = 2000`
    - Métodos: `start()`, `stop()`, `add(entry)`, `flush()` (batch INSERT via Drizzle)
    - Retry com backoff exponencial (3 tentativas) no flush; descarta batch se falhar
    - Validar que `level` pertence ao conjunto {"debug", "info", "warn", "error", "fatal"}, rejeitar silenciosamente caso contrário
    - _Requisitos: 1.1, 1.4, 6.5_

  - [ ]* 2.2 Escrever teste de propriedade para round-trip de persistência
    - **Propriedade 1: Round-trip de persistência de log**
    - **Valida: Requisitos 1.1, 1.5, 3.1, 7.2**

  - [ ]* 2.3 Escrever teste de propriedade para validação de níveis
    - **Propriedade 2: Validação de níveis de log**
    - **Valida: Requisito 1.4**

  - [x] 2.4 Criar `server/services/db-logger.ts` — Logger programático
    - Expor funções `log.debug()`, `log.info()`, `log.warn()`, `log.error()`, `log.fatal()` que delegam ao LogBuffer
    - Implementar `setTraceContext(traceId, spanId)` e `setUserContext(userId, companyId)`
    - Ler `SERVER_IDENTIFIER` do `.env` (ou hostname como fallback)
    - Manter compatibilidade com a interface do Winston (`logger.info(...)`, `logger.error(...)`) para migração gradual
    - Quando `company_id` não for fornecido, registrar como null (log de sistema)
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

- [x] 3. Checkpoint — Verificar que LogBuffer e DbLogger funcionam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 4. Implementar o middleware de logging automático de requisições
  - [x] 4.1 Criar `server/middleware/request-logging.ts` — middleware Express
    - Gerar `trace_id` (UUID v4) se ausente no header `x-trace-id`; gerar `span_id` para cada requisição
    - Capturar `startTime` via `performance.now()`
    - No evento `res.on('finish')`: calcular duração, extrair `user_id`/`company_id` da sessão, montar `LogEntryInput` e adicionar ao buffer
    - Para status >= 400: registrar com nível "error" e incluir corpo da resposta de erro no context_data
    - Para status < 400: registrar com nível "info"
    - Para `response_time_ms > 1000`: registrar log adicional com nível "warn" contendo decomposição de tempo
    - Escrita assíncrona — não bloquear o response
    - _Requisitos: 2.1, 2.4, 2.5, 3.1, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.2 Escrever teste de propriedade para captura de campos HTTP
    - **Propriedade 3: Middleware captura campos HTTP obrigatórios**
    - **Valida: Requisitos 2.1, 6.1**

  - [ ]* 4.3 Escrever teste de propriedade para contexto de usuário autenticado
    - **Propriedade 4: Contexto de usuário autenticado**
    - **Valida: Requisitos 2.4, 6.2**

  - [ ]* 4.4 Escrever teste de propriedade para alerta de requisição lenta
    - **Propriedade 5: Alerta de requisição lenta**
    - **Valida: Requisito 2.5**

  - [ ]* 4.5 Escrever teste de propriedade para geração automática de Trace_ID
    - **Propriedade 6: Geração automática de Trace_ID**
    - **Valida: Requisitos 3.4, 6.3**

  - [ ]* 4.6 Escrever teste de propriedade para classificação automática de erros HTTP
    - **Propriedade 11: Classificação automática de erros HTTP**
    - **Valida: Requisito 6.4**

  - [x] 4.7 Registrar o `requestLoggingMiddleware` no `server/index.ts` (substituindo ou complementando o `performanceMiddleware` atual)
    - Inicializar o LogBuffer com `logBuffer.start()` na inicialização do servidor
    - Adicionar `logBuffer.stop()` no `gracefulShutdown()`
    - _Requisitos: 6.1, 6.5_

- [x] 5. Checkpoint — Verificar middleware e logging automático
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 6. Implementar a API de consulta de logs
  - [x] 6.1 Criar `server/api/logs-api.ts` — endpoint GET /api/logs
    - Implementar cursor-based pagination usando `id` decrescente (query params: `cursor`, `limit` default 50)
    - Suportar filtros: `level`, `server_identifier`, `trace_id`, `company_id`, `user_id`, `request_url`, `date_from`, `date_to`, `search` (busca textual na mensagem), `context_filter` (operadores JSONB)
    - Filtragem automática por `company_id` para usuários não-super_admin
    - Super_admin pode filtrar por empresa ou ver todos
    - Ordenação por `created_at` DESC por padrão
    - Retornar `LogsResponse` com `{ data, pagination: { nextCursor, hasMore, total } }`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Criar endpoint GET /api/logs/stats no mesmo arquivo
    - Retornar: totalLogs, totalErrors, avgResponseTime, slowRequests (>1000ms), byLevel, byServer
    - Filtros: `date_from`, `date_to`, `company_id`
    - Mesma lógica de filtragem multi-tenant
    - _Requisitos: 9.1, 9.3_

  - [x] 6.3 Criar `server/routes/system-logs.ts` — registrar rotas com `authRequired` + `companyAdminRequired`
    - Registrar as rotas no `server/routes.ts` via `registerRoutes`
    - _Requisitos: 4.1, 4.4, 4.5_

  - [ ]* 6.4 Escrever teste de propriedade para paginação por cursor
    - **Propriedade 7: Paginação por cursor sem duplicatas e ordenada**
    - **Valida: Requisitos 4.1, 4.6**

  - [ ]* 6.5 Escrever teste de propriedade para filtros
    - **Propriedade 8: Filtros retornam apenas resultados válidos**
    - **Valida: Requisitos 4.2, 4.3, 3.3**

  - [ ]* 6.6 Escrever teste de propriedade para isolamento multi-tenant
    - **Propriedade 9: Isolamento multi-tenant**
    - **Valida: Requisitos 4.4, 4.5, 9.3**

  - [ ]* 6.7 Escrever teste de propriedade para trace view ordenado
    - **Propriedade 10: Trace view retorna entries em ordem cronológica**
    - **Valida: Requisito 5.4**

  - [ ]* 6.8 Escrever teste de propriedade para estatísticas consistentes
    - **Propriedade 13: Estatísticas consistentes com dados reais**
    - **Valida: Requisito 9.1**

- [x] 7. Checkpoint — Verificar API de consulta e estatísticas
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 8. Implementar o job de retenção de logs
  - [x] 8.1 Criar `server/services/log-retention-job.ts` — job cron diário às 2h
    - Seguir o mesmo padrão do `CleanupScheduler` existente
    - Ler `LOG_RETENTION_DAYS` do `.env` (padrão 90 dias)
    - Deletar logs com `created_at < now() - retention_days`
    - Em caso de erro, registrar e tentar na próxima execução
    - Inicializar no `server/index.ts` junto com o `cleanupScheduler`
    - _Requisitos: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 8.2 Escrever teste de propriedade para retenção de logs
    - **Propriedade 12: Retenção remove logs conforme configuração**
    - **Valida: Requisitos 8.1, 8.2**

- [x] 9. Implementar o frontend — Log Viewer
  - [x] 9.1 Adicionar chaves de internacionalização em `client/src/i18n/messages/pt-BR.json` e `en-US.json`
    - Prefixo `logs.*` para todas as strings: título da página, labels de filtros, colunas da tabela, mensagens de empty state, labels de stats cards, textos do painel de detalhes, trace view, etc.
    - _Requisitos: 5.7_

  - [x] 9.2 Criar `client/src/pages/system-logs.tsx` — página principal do Log Viewer
    - Componente `StatsCards`: cards de resumo no topo (total logs, erros, tempo médio, requisições lentas) usando shadcn/ui Card
    - Componente `FilterBar`: filtros visuais (nível, servidor, datas, busca textual, tempo mínimo de resposta) usando shadcn/ui Select, Input, DatePicker
    - Componente `LogTable`: tabela com colunas timestamp, level, server, message, request_url, response_time_ms usando shadcn/ui Table
    - Cores por nível: debug=gray, info=blue, warn=yellow, error=red, fatal=purple via Badge
    - `useInfiniteQuery` para scroll infinito / paginação cursor-based
    - Dropdown de empresa para super_admin no topo da página
    - Todas as strings via `useI18n().formatMessage()`
    - _Requisitos: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 9.2_

  - [x] 9.3 Implementar `DetailPanel` — painel lateral de detalhes
    - Sheet/drawer lateral (shadcn/ui Sheet) com todos os campos da Log_Entry
    - context_data formatado em JSON com syntax highlighting
    - Abrir ao clicar em uma linha da tabela
    - _Requisitos: 5.3_

  - [x] 9.4 Implementar `TraceView` — visualização de trace
    - Ao clicar em um trace_id, exibir todas as Log_Entries do trace em ordem cronológica (created_at ASC)
    - Timeline visual mostrando o fluxo da requisição
    - _Requisitos: 5.4_

  - [ ]* 9.5 Escrever teste de propriedade para completude de internacionalização
    - **Propriedade 14: Completude de internacionalização**
    - **Valida: Requisito 5.7**

- [x] 10. Integração e wiring final
  - [x] 10.1 Registrar a rota da página `system-logs` no `client/src/App.tsx` usando Wouter
    - Substituir ou atualizar a rota existente `/logs` para apontar para o novo componente
    - Manter lazy loading com `React.lazy()`
    - _Requisitos: 5.1_

  - [x] 10.2 Adicionar logging de contexto enriquecido para operações com tickets e serviços externos
    - Nos handlers de tickets: incluir `ticket_id` e `ticket_code` no context_data via `log.info()`/`log.error()`
    - Nas chamadas a serviços externos (OpenAI, Clicksign, S3): incluir nome do serviço, duração e status no context_data
    - _Requisitos: 2.2, 2.3_

  - [x] 10.3 Adicionar variável `SERVER_IDENTIFIER` e `LOG_RETENTION_DAYS` no `.env`
    - _Requisitos: 3.1, 8.1_

- [x] 11. Checkpoint final — Verificar integração completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- A linguagem de implementação é TypeScript, conforme o design e stack do projeto
