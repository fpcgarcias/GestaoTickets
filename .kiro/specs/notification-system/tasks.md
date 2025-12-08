# Plano de Implementação - Sistema de Notificações Persistentes

## Visão Geral

Este plano detalha as tarefas para implementar o novo sistema de notificações com persistência, histórico, Web Push e gerenciamento avançado. A implementação será incremental, mantendo o sistema atual funcionando durante toda a migração.

## Tarefas

- [x] 1. Criar schema do banco de dados para notificações





  - Criar migration para tabela `notifications` com todos os campos (id, user_id, type, title, message, priority, ticket_id, ticket_code, metadata, read_at, created_at)
  - Criar migration para tabela `push_subscriptions` com campos (id, user_id, endpoint, p256dh_key, auth_key, user_agent, created_at, last_used_at)
  - Adicionar índices em `notifications` (user_id, read_at, created_at, type) para performance
  - Adicionar índice único em `push_subscriptions` (endpoint)
  - Atualizar `shared/schema.ts` com definições das novas tabelas usando Drizzle ORM
  - _Requirements: 1.1, 3.3_

- [x] 1.1 Escrever teste de propriedade para schema de notificações



  - **Property 1: Persistência completa de notificações**
  - **Validates: Requirements 1.1**

- [x] 2. Estender NotificationService com persistência básica





  - Adicionar método privado `persistNotification()` que salva notificação no banco de dados
  - Modificar `sendNotificationToUser()` para chamar `persistNotification()` antes de entregar via WebSocket
  - Modificar `sendNotificationToAdmins()` para persistir notificações para cada admin
  - Modificar `sendNotificationToSupport()` para persistir notificações para cada agente
  - Garantir que persistência não quebre funcionalidade WebSocket existente
  - Adicionar tratamento de erro: se persistência falhar, registrar erro mas continuar com WebSocket
  - _Requirements: 1.1, 1.2, 1.3, 4.2, 7.3_

- [x] 2.1 Escrever teste de propriedade para entrega dual


  - **Property 2: Entrega dual para usuários online**
  - **Validates: Requirements 1.2**


- [x] 2.2 Escrever teste de propriedade para persistência offline
  - **Property 3: Persistência para usuários offline**
  - **Validates: Requirements 1.3**


- [x] 2.3 Escrever teste de propriedade para retrocompatibilidade

  - **Property 15: Retrocompatibilidade de métodos existentes**

  - **Validates: Requirements 4.2, 4.3**

- [x] 2.4 Escrever teste de propriedade para resiliência a falhas
  - **Property 22: Resiliência a falhas de WebSocket**
  - **Property 24: Tratamento de falha crítica de persistência**
  - **Validates: Requirements 7.1, 7.3**

- [-] 3. Implementar APIs REST para gerenciamento de notificações



  - Criar endpoint `GET /api/notifications` com suporte a paginação (page, limit)
  - Criar endpoint `GET /api/notifications/unread-count` que retorna contador
  - Criar endpoint `PATCH /api/notifications/:id/read` para marcar como lida
  - Criar endpoint `PATCH /api/notifications/read-all` para marcar todas como lidas
  - Criar endpoint `DELETE /api/notifications/:id` para excluir notificação
  - Criar endpoint `DELETE /api/notifications` (batch) para excluir múltiplas
  - Adicionar validação de autorização: usuário só acessa suas notificações
  - Adicionar validação de inputs (IDs válidos, limites de paginação)
  - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1_

- [x] 3.1 Escrever teste de propriedade para ordenação e paginação


  - **Property 5: Ordenação e paginação do histórico**
  - **Validates: Requirements 1.5**

- [x] 3.2 Escrever teste de propriedade para marcação de leitura

  - **Property 6: Marcação de leitura persiste no banco**
  - **Validates: Requirements 2.1, 2.2**

- [x] 3.3 Escrever teste de propriedade para marcação em lote

  - **Property 7: Marcação em lote de todas como lidas**
  - **Validates: Requirements 2.3**

- [x] 3.4 Escrever teste de propriedade para exclusão



  - **Property 8: Exclusão remove permanentemente**
  - **Property 9: Exclusão em lote funciona corretamente**
  - **Validates: Requirements 2.4, 2.5**

- [x] 3.5 Escrever teste de propriedade para contador


  - **Property 10: Contador atualizado após mudança de status**
  - **Property 20: Contador correto na conexão**
  - **Validates: Requirements 2.6, 6.1, 6.2, 6.3, 6.4**

- [x] 4. Implementar recuperação de notificações na conexão








  - Modificar `WebSocketProvider` para buscar notificações não lidas ao conectar
  - Chamar API `GET /api/notifications?read=false` após autenticação WebSocket
  - Atualizar estado local com notificações recuperadas
  - Atualizar contador de não lidas
  - Mesclar notificações recuperadas com notificações em tempo real
  - _Requirements: 1.4, 6.1_

- [x] 4.1 Escrever teste de propriedade para recuperação na conexão


  - **Property 4: Recuperação de notificações não lidas na conexão**
  - **Validates: Requirements 1.4**

- [x] 5. Criar componente NotificationPanel no frontend





  - Criar componente `NotificationPanel` com lista de notificações
  - Implementar scroll infinito para carregar mais notificações
  - Adicionar botão "Marcar todas como lidas"
  - Adicionar botão de exclusão individual para cada notificação
  - Mostrar indicador visual de notificações não lidas
  - Adicionar navegação ao clicar em notificação de ticket
  - Marcar como lida automaticamente ao clicar
  - Mostrar timestamp relativo (ex: "há 5 minutos")
  - Adicionar estados de loading e empty state
  - _Requirements: 2.1, 2.3, 2.4, 10.3_

- [x] 5.1 Escrever testes unitários para NotificationPanel


  - Testar renderização de notificações
  - Testar clique em notificação
  - Testar botão marcar todas como lidas
  - Testar exclusão de notificação
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 6. Estender hook useNotifications com novas funcionalidades





  - Adicionar estado `notifications` (array de notificações persistentes)
  - Adicionar estado `loading` e `hasMore` para paginação
  - Adicionar função `loadMore()` para carregar próxima página
  - Adicionar função `markAsRead(id)` que chama API
  - Adicionar função `markAllAsRead()` que chama API
  - Adicionar função `deleteNotification(id)` que chama API
  - Adicionar função `refresh()` para recarregar notificações
  - Manter funcionalidades WebSocket existentes (connected, unreadCount)
  - Sincronizar notificações WebSocket com estado persistente
  - _Requirements: 1.4, 2.1, 2.3, 2.4, 6.5_

- [x] 6.1 Escrever testes unitários para useNotifications hook


  - Testar carregamento inicial de notificações
  - Testar paginação (loadMore)
  - Testar marcação como lida
  - Testar exclusão
  - Testar sincronização com WebSocket
  - _Requirements: 1.4, 2.1, 2.4_

- [x] 7. Implementar filtros e busca de notificações





  - Adicionar parâmetros de filtro ao endpoint `GET /api/notifications` (type, read, startDate, endDate, search)
  - Implementar query SQL com filtros combinados usando AND
  - Adicionar busca textual case-insensitive em title e message
  - Criar componente `NotificationFilters` no frontend
  - Adicionar dropdowns para filtrar por tipo e status de leitura
  - Adicionar date range picker para filtrar por período
  - Adicionar campo de busca textual
  - Atualizar hook `useNotifications` com estado de filtros
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7.1 Escrever teste de propriedade para filtros


  - **Property 26: Filtragem por tipo funciona corretamente**
  - **Property 27: Filtragem por status de leitura**
  - **Property 28: Filtragem por período de datas**
  - **Property 29: Busca textual funciona**
  - **Property 30: Combinação de filtros usa AND**
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 8. Checkpoint - Garantir que testes estão passando






  - Garantir que todos os testes passam, perguntar ao usuário se surgem questões.

- [-] 9. Implementar WebPushService






  - Criar classe `WebPushService` em `server/services/web-push-service.ts`
  - Instalar biblioteca `web-push` via npm
  - Implementar método `subscribe()` para salvar subscription no banco
  - Implementar método `unsubscribe()` para remover subscription
  - Implementar método `getSubscriptions()` para buscar subscriptions de usuário
  - Implementar método `sendPushNotification()` que envia para todas subscriptions do usuário
  - Implementar método privado `sendToSubscription()` com retry logic
  - Implementar método `removeInvalidSubscription()` para limpar subscriptions inválidas
  - Configurar VAPID keys a partir de variáveis de ambiente
  - Adicionar tratamento de erro 410 (Gone) para remover subscriptions expiradas
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 7.2, 7.4_

- [x] 9.1 Escrever teste de propriedade para push subscriptions



  - **Property 11: Push subscription persiste corretamente**
  - **Property 13: Remoção de subscription ao revogar**
  - **Property 14: Limpeza de subscriptions inválidas**
  - **Validates: Requirements 3.3, 3.5, 3.6, 7.4**



- [ ] 9.2 Escrever teste de propriedade para Web Push
  - **Property 12: Web Push para usuários offline**
  - **Property 23: Resiliência a falhas de Web Push**
  - **Validates: Requirements 3.4, 7.2**

- [ ] 10. Integrar WebPushService com NotificationService
  - Modificar `persistNotification()` para verificar se usuário está offline
  - Se usuário offline, buscar push subscriptions do banco
  - Se subscriptions existem, chamar `webPushService.sendPushNotification()`
  - Adicionar tratamento de erro: se Web Push falhar, registrar mas manter notificação no banco
  - Garantir que notificações críticas usam configuração de urgência alta
  - _Requirements: 3.4, 7.2, 9.2_

- [ ] 11. Criar endpoints REST para push subscriptions
  - Criar endpoint `POST /api/notifications/push/subscribe` para registrar subscription
  - Criar endpoint `POST /api/notifications/push/unsubscribe` para remover subscription
  - Criar endpoint `GET /api/notifications/push/public-key` para obter chave VAPID pública
  - Adicionar validação de dados de subscription (endpoint, keys)
  - Adicionar tratamento de duplicatas (subscription já existe)
  - _Requirements: 3.2, 3.5_

- [ ] 12. Implementar Service Worker para Web Push
  - Criar arquivo `client/public/sw.js` com Service Worker
  - Implementar event listener `install` para instalação
  - Implementar event listener `activate` para ativação
  - Implementar event listener `push` para receber notificações
  - Implementar exibição de notificação com `showNotification()`
  - Configurar ícone, badge, tag, data, requireInteraction baseado em prioridade
  - Implementar event listener `notificationclick` para navegação
  - Abrir ou focar janela da aplicação ao clicar
  - Navegar para página do ticket se notificação tiver ticketId
  - _Requirements: 3.2, 10.4_

- [ ] 13. Adicionar registro de Service Worker no frontend
  - Modificar `client/src/main.tsx` para registrar Service Worker
  - Verificar se navegador suporta Service Worker e Push API
  - Solicitar permissão de notificação ao usuário
  - Após permissão concedida, registrar Service Worker
  - Obter push subscription do Service Worker
  - Enviar subscription para backend via API
  - Adicionar tratamento de erro se registro falhar
  - Adicionar UI para gerenciar permissões de notificação
  - _Requirements: 3.1, 3.2_

- [ ] 13.1 Escrever testes unitários para registro de Service Worker
  - Testar verificação de suporte do navegador
  - Testar solicitação de permissão
  - Testar registro de Service Worker
  - Testar envio de subscription para backend
  - _Requirements: 3.1, 3.2_

- [ ] 14. Implementar suporte a prioridades de notificação
  - Adicionar campo `priority` com default 'medium' na criação de notificações
  - Validar que priority é um dos valores válidos (low, medium, high, critical)
  - Modificar `WebPushService` para configurar urgência baseada em prioridade
  - Notificações críticas: requireInteraction=true, vibrate=[200,100,200]
  - Notificações high: vibrate=[100]
  - Notificações medium/low: sem vibração especial
  - Adicionar estilização visual no frontend baseada em prioridade
  - Adicionar suporte a ordenação por prioridade na API
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 14.1 Escrever teste de propriedade para prioridades
  - **Property 31: Validação de prioridades**
  - **Property 32: Configuração de Web Push para notificações críticas**
  - **Property 33: Prioridade incluída nos dados retornados**
  - **Property 34: Prioridade padrão é medium**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

- [ ] 15. Implementar metadados e links de notificações
  - Garantir que notificações de ticket incluem ticket_id e ticket_code
  - Adicionar campo `metadata` (JSONB) para dados customizados
  - Modificar frontend para construir URLs de navegação a partir de metadados
  - Implementar navegação ao clicar em notificação
  - Marcar notificação como lida ao clicar
  - Adicionar suporte a metadados customizados para notificações não-ticket
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ] 15.1 Escrever teste de propriedade para metadados
  - **Property 35: Metadados de ticket incluídos**
  - **Property 36: Clique marca como lida**
  - **Property 37: Metadados customizados permitidos**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

- [ ] 16. Implementar CleanupScheduler para limpeza automática
  - Criar classe `CleanupScheduler` em `server/services/cleanup-scheduler.ts`
  - Instalar biblioteca `node-cron` via npm
  - Implementar método `start()` que agenda job diário às 3h
  - Implementar método `stop()` para parar scheduler
  - Implementar método `cleanupOldNotifications()` que remove notificações antigas
  - Remover notificações lidas com mais de 90 dias
  - Remover notificações não lidas com mais de 180 dias
  - Registrar no log quantidade de notificações removidas
  - Garantir que remoção não afeta outras tabelas (integridade referencial)
  - Adicionar variáveis de ambiente para configurar retenção
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 16.1 Escrever teste de propriedade para limpeza
  - **Property 16: Limpeza de notificações lidas antigas**
  - **Property 17: Limpeza de notificações não lidas antigas**
  - **Property 18: Logging de limpeza**
  - **Property 19: Integridade referencial na limpeza**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

- [ ] 17. Inicializar CleanupScheduler no servidor
  - Modificar `server/index.ts` para importar e inicializar `CleanupScheduler`
  - Chamar `cleanupScheduler.start()` após inicialização do servidor
  - Adicionar graceful shutdown: chamar `cleanupScheduler.stop()` ao desligar
  - Adicionar logs de inicialização e parada do scheduler
  - _Requirements: 5.4_

- [ ] 18. Implementar sincronização de contador via WebSocket
  - Modificar NotificationService para enviar atualização de contador via WebSocket
  - Após marcar como lida, enviar novo contador para usuário online
  - Após criar notificação, enviar contador atualizado
  - Modificar frontend para escutar atualizações de contador via WebSocket
  - Atualizar UI quando contador mudar
  - _Requirements: 6.5_

- [ ] 18.1 Escrever teste de propriedade para sincronização de contador
  - **Property 21: Sincronização de contador via WebSocket**
  - **Validates: Requirements 6.5**

- [ ] 19. Adicionar logging completo de erros
  - Modificar todos os catch blocks para registrar erros completos
  - Incluir mensagem de erro, stack trace, contexto (userId, notificationId)
  - Adicionar níveis de severidade (info, warning, error, critical)
  - Usar serviço de logger existente (`server/services/logger.ts`)
  - Garantir que erros críticos são destacados nos logs
  - _Requirements: 7.5_

- [ ] 19.1 Escrever teste de propriedade para logging de erros
  - **Property 25: Logging completo de erros**
  - **Validates: Requirements 7.5**

- [ ] 20. Adicionar variáveis de ambiente e documentação
  - Adicionar variáveis VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT ao `.env`
  - Adicionar variáveis de configuração de limpeza
  - Criar script para gerar chaves VAPID
  - Atualizar README com instruções de configuração
  - Documentar endpoints da API
  - Documentar estrutura de dados de notificações
  - Adicionar exemplos de uso

- [ ] 21. Checkpoint Final - Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se surgem questões.
  - Executar testes de propriedade (mínimo 100 iterações cada)
  - Executar testes unitários
  - Verificar cobertura de código (meta: 80%+)
  - Testar fluxo completo manualmente
  - Verificar logs para erros
