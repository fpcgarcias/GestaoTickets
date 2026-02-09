# Plano de Implementação: Status "Encerrado"

## Visão Geral

Este plano detalha as tarefas necessárias para implementar o novo status "Encerrado" (closed) no sistema de gerenciamento de tickets. A implementação será feita de forma incremental, garantindo que cada etapa seja testada antes de prosseguir.

## Tarefas

- [x] 1. Criar migração de banco de dados para adicionar status "closed"
  - Criar arquivo de migração usando Drizzle ORM
  - Adicionar valor 'closed' ao enum ticket_status
  - Adicionar valor 'ticket_closed' ao enum email_template_type
  - Garantir que a migração seja idempotente (não falha se valores já existem)
  - Testar migração em ambiente de desenvolvimento
  - _Requisitos: 1.1, 1.2, 4.1_

- [x] 2. Atualizar schema TypeScript e tipos compartilhados
  - [x] 2.1 Atualizar shared/schema.ts
    - Adicionar 'closed' ao ticketStatusEnum
    - Adicionar 'ticket_closed' ao emailTemplateTypeEnum
    - _Requisitos: 1.1, 1.3, 4.1_
  
  - [x] 2.2 Atualizar shared/ticket-utils.ts
    - Adicionar 'closed' ao tipo TicketStatus
    - Adicionar 'closed' ao array SLA_FINISHED_STATUSES
    - Adicionar configuração visual para 'closed' em STATUS_CONFIG
    - _Requisitos: 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 2.3 Escrever teste de propriedade para configuração de status
    - **Property 1: Configuração de Status "Encerrado"**
    - **Valida: Requisitos 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 2.4 Escrever teste de propriedade para SLA_FINISHED_STATUSES
    - **Property 2: Status "Encerrado" em SLA_FINISHED_STATUSES**
    - **Valida: Requisitos 2.5**

- [x] 3. Atualizar utilitários do cliente
  - [x] 3.1 Atualizar client/src/lib/utils.ts
    - Adicionar TICKET_STATUS.CLOSED
    - Adicionar mapeamento de cor em STATUS_COLORS
    - Adicionar tradução em translateTicketStatus
    - _Requisitos: 2.1, 2.2, 2.3_

- [x] 4. Adicionar traduções de internacionalização
  - [x] 4.1 Atualizar client/src/i18n/messages/pt-BR.json
    - Adicionar "tickets.closed": "Encerrado"
    - Adicionar "tickets.tabs.closed": "🔒 Encerrados"
    - Adicionar "tickets.sla.closed": "Encerrado"
    - _Requisitos: 2.6, 13.1_
  
  - [x] 4.2 Atualizar client/src/i18n/messages/en-US.json
    - Adicionar "tickets.closed": "Closed"
    - Adicionar "tickets.tabs.closed": "🔒 Closed"
    - Adicionar "tickets.sla.closed": "Closed"
    - _Requisitos: 2.7, 13.2_
  
  - [ ]* 4.3 Escrever teste unitário para traduções
    - Verificar que chaves existem em ambos os idiomas
    - Verificar que traduções não estão vazias
    - _Requisitos: 13.1, 13.2, 13.3, 13.4_

- [x] 5. Atualizar componente de badge de status
  - [x] 5.1 Atualizar client/src/components/tickets/status-badge.tsx
    - Adicionar 'closed' ao mapeamento statusMap em getTranslatedStatus
    - Garantir que badge renderiza corretamente para status 'closed'
    - _Requisitos: 8.1, 8.2, 8.3_
  
  - [ ]* 5.2 Escrever teste de propriedade para badge rendering
    - **Property 7: Badge de Status Renderizado**
    - **Valida: Requisitos 8.1, 8.2, 8.3**

- [x] 6. Checkpoint - Verificar configurações básicas
  - Executar todos os testes
  - Verificar que não há erros de TypeScript
  - Verificar que migrações rodam sem erros
  - Perguntar ao usuário se há dúvidas

- [x] 7. Criar template de e-mail "Ticket Encerrado"
  - [x] 7.1 Criar template padrão em server/routes.ts
    - Adicionar template 'ticket_closed' na função de criar templates padrão
    - Usar layout idêntico ao template 'ticket_resolved'
    - Adaptar textos para explicar encerramento por falta de interação
    - Incluir variáveis: ticket_id, title, customer_name, company_name, support_email, base_url
    - _Requisitos: 4.2, 4.3, 4.4_
  
  - [ ]* 7.2 Escrever teste unitário para template
    - Verificar que template 'ticket_closed' existe após criação de templates padrão
    - Verificar que template tem subject_template e html_template não vazios
    - Verificar que template é diferente de 'ticket_resolved'
    - _Requisitos: 4.2, 4.3_

- [x] 8. Atualizar auto-close job
  - [x] 8.1 Modificar server/services/email-notification-service.ts
    - Localizar lógica do auto-close job
    - Alterar status de 'resolved' para 'closed'
    - Garantir que resolved_at é preenchido
    - Garantir que histórico de status é criado
    - Alterar template de e-mail de 'ticket_resolved' para 'ticket_closed'
    - Manter envio de pesquisa de satisfação
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 8.2 Escrever teste de propriedade para auto-close job
    - **Property 4: Auto-Close Job Completo**
    - **Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 9. Atualizar lógica de pesquisa de satisfação
  - [x] 9.1 Modificar server/services/email-notification-service.ts
    - Localizar código que envia pesquisa de satisfação
    - Adicionar condição para enviar também quando status = 'closed'
    - Garantir que template correto é usado baseado no status
    - _Requisitos: 5.1, 5.2, 5.3_
  
  - [ ]* 9.2 Escrever teste de propriedade para pesquisa de satisfação
    - **Property 5: Pesquisa de Satisfação para Status Finais**
    - **Valida: Requisitos 5.1, 5.2, 5.3**

- [x] 10. Atualizar campo resolved_at
  - [x] 10.1 Modificar lógica de atualização de status
    - Localizar código que atualiza status de tickets
    - Adicionar lógica para preencher resolved_at quando status muda para 'closed'
    - Adicionar lógica para limpar resolved_at quando status sai de 'closed'
    - Garantir que mesma lógica se aplica a 'resolved'
    - _Requisitos: 14.1, 14.2, 14.3_
  
  - [ ]* 10.2 Escrever teste de propriedade para resolved_at round-trip
    - **Property 12: Campo resolved_at Round-Trip**
    - **Valida: Requisitos 14.1, 14.2, 14.3**

- [x] 11. Checkpoint - Verificar lógica de backend
  - Executar todos os testes
  - Testar auto-close job manualmente
  - Verificar que e-mails são enviados corretamente
  - Verificar que pesquisa de satisfação é criada
  - Perguntar ao usuário se há dúvidas

- [x] 12. Atualizar filtros de tickets
  - [x] 12.1 Modificar filtro "Ocultar Resolvidos"
    - Localizar implementação do filtro em server/database-storage.ts e server/storage.ts
    - Adicionar condição para excluir também status 'closed'
    - Usar operador AND para excluir ambos os status
    - _Requisitos: 6.1, 6.2, 6.3_
   
  - [ ]* 12.2 Escrever teste de propriedade para filtro
    - **Property 6: Filtro "Ocultar Resolvidos"**
    - **Valida: Requisitos 6.1, 6.2, 6.3**

- [x] 13. Atualizar dropdowns de status no frontend
  - [x] 13.1 Atualizar client/src/pages/tickets/index.tsx
    - Adicionar 'closed' ao dropdown de filtro de status
    - Adicionar aba "Encerrados" se necessário
    - Garantir que filtro "Ocultar resolvidos" funciona corretamente
    - _Requisitos: 7.1_
  
  - [x] 13.2 Atualizar client/src/components/tickets/ticket-reply.tsx
    - Adicionar 'closed' ao SelectItem de mudança de status
    - Garantir que opção está traduzida corretamente
    - _Requisitos: 7.2_
  
  - [x] 13.3 Atualizar client/src/pages/ai-audit.tsx
    - Adicionar 'closed' ao filtro de status
    - _Requisitos: 7.4_
  
  - [ ]* 13.4 Escrever testes unitários para dropdowns
    - Verificar que 'closed' aparece em todos os dropdowns
    - Verificar que texto está traduzido
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_


- [x] 14. Atualizar dashboard e métricas
  - [x] 14.1 Atualizar client/src/pages/dashboard.tsx
    - Adicionar contadores para tickets com status 'closed'
    - Incluir 'closed' em gráficos e visualizações
    - Garantir que métricas estão corretas
    - _Requisitos: 7.5, 11.4_
  
  - [ ]* 14.2 Escrever teste unitário para dashboard
    - Verificar que métricas incluem tickets 'closed'
    - Verificar que contadores estão corretos
    - _Requisitos: 11.4_

- [x] 15. Atualizar relatórios
  - [x] 15.1 Atualizar server/routes/reports.ts
    - Adicionar 'closed' aos filtros de status
    - Adicionar tradução de 'closed' para pt-BR e en-US
    - Garantir que contagens incluem tickets 'closed' separadamente
    - _Requisitos: 7.3, 11.1, 11.2, 11.3_
  
  - [ ]* 15.2 Escrever teste de propriedade para relatórios
    - **Property 10: Relatórios Incluem Status "Encerrado"**
    - **Valida: Requisitos 11.1, 11.2**

- [x] 16. Implementar restrições de ações em tickets encerrados
  - [x] 16.1 Atualizar server/api/ticket-replies.ts
    - Adicionar validação para impedir respostas de clientes em tickets 'closed'
    - Permitir respostas internas de atendentes em tickets 'closed'
    - Adicionar mensagem de erro apropriada
    - _Requisitos: 9.1, 9.3_
  
  - [x] 16.2 Atualizar server/routes.ts
    - Adicionar validação para impedir alteração de atendente em tickets 'closed'
    - Permitir mudança de status de 'closed' para 'reopened'
    - _Requisitos: 9.2, 9.4_
  
  - [ ]* 16.3 Escrever teste de propriedade para restrições
    - **Property 8: Restrições em Tickets Encerrados**
    - **Valida: Requisitos 9.1, 9.2, 9.3, 9.4**

- [x] 17. Atualizar lógica de SLA
  - [x] 17.1 Modificar cálculos de SLA
    - Garantir que SLA para quando status muda para 'closed'
    - Garantir que SLA é marcado como finalizado para status 'closed'
    - Garantir que SLA reinicia se status sai de 'closed' para status ativo
    - _Requisitos: 10.1, 10.2, 10.3_
  
  - [ ]* 17.2 Escrever teste de propriedade para SLA
    - **Property 9: SLA Finalizado para Status "Encerrado"**
    - **Valida: Requisitos 10.1, 10.2, 10.3**

- [x] 18. Atualizar sistema de notificações in-app
  - [x] 18.1 Modificar server/services/notification-service.ts
    - Adicionar criação de notificações quando status muda para 'closed'
    - Criar notificação para cliente
    - Criar notificação para atendente responsável
    - _Requisitos: 12.1, 12.2_
  
  - [x] 18.2 Atualizar client/src/utils/notification-i18n.ts
    - Adicionar mapeamento de tradução para status 'closed'
    - Garantir que notificações são traduzidas corretamente
    - _Requisitos: 12.3_
  
  - [ ]* 18.3 Escrever teste de propriedade para notificações
    - **Property 11: Notificações In-App para Status "Encerrado"**
    - **Valida: Requisitos 12.1, 12.2, 12.3**

- [x] 19. Atualizar histórico de status
  - [x] 19.1 Verificar implementação de histórico
    - Confirmar que mudanças para 'closed' são registradas
    - Confirmar que mudanças de 'closed' são registradas
    - Confirmar que user_id e timestamp são incluídos
    - _Requisitos: 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 19.2 Escrever teste de propriedade para histórico
    - **Property 13: Histórico de Mudanças de Status**
    - **Valida: Requisitos 15.1, 15.2, 15.3, 15.4**

- [ ] 20. Checkpoint - Testes de integração
  - Executar todos os testes unitários e de propriedades
  - Testar fluxo completo de auto-close
  - Testar fluxo de reabertura de ticket encerrado
  - Testar filtros em todas as telas
  - Testar relatórios com tickets encerrados
  - Verificar notificações in-app
  - Perguntar ao usuário se há dúvidas

- [ ] 21. Atualizar documentação do banco de dados
  - [ ] 21.1 Atualizar DOCUMENTACAO_ESTRUTURA_BD.md
    - Documentar adição de 'closed' ao enum ticket_status
    - Documentar adição de 'ticket_closed' ao enum email_template_type
    - Incluir descrição do novo status
    - Incluir descrição do novo template
    - _Requisitos: Todos (documentação)_

- [ ] 22. Testes finais e validação
  - [ ] 22.1 Testes manuais completos
    - Criar ticket e deixar em waiting_customer
    - Aguardar auto-close (ou simular)
    - Verificar que status muda para 'closed'
    - Verificar que e-mail "Ticket Encerrado" é enviado
    - Verificar que pesquisa de satisfação é enviada
    - Verificar que resolved_at está preenchido
    - Verificar que histórico foi criado
    - Verificar que notificações foram criadas
    - Verificar que SLA está finalizado
    - Verificar que filtros funcionam corretamente
    - Verificar que relatórios incluem tickets encerrados
    - Verificar que badges exibem corretamente
    - Verificar que não é possível adicionar respostas
    - Verificar que é possível reabrir o ticket
    - Testar em ambos os idiomas (pt-BR e en-US)
  
  - [ ] 22.2 Revisão de código
    - Verificar que todas as strings estão internacionalizadas
    - Verificar que não há código duplicado
    - Verificar que tratamento de erros está adequado
    - Verificar que logs estão apropriados
  
  - [ ] 22.3 Verificação de performance
    - Verificar que queries não são N+1
    - Verificar que índices do banco estão adequados
    - Verificar que não há vazamentos de memória

- [ ] 23. Checkpoint final
  - Executar suite completa de testes
  - Verificar cobertura de testes (meta: >80% linhas, >75% branches)
  - Confirmar que todas as tarefas foram completadas
  - Confirmar que documentação está atualizada
  - Perguntar ao usuário se está pronto para deploy

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia os requisitos específicos que valida
- Checkpoints garantem validação incremental
- Testes de propriedades usam fast-check com mínimo de 100 iterações
- Todas as strings visíveis devem estar nos arquivos de tradução (pt-BR.json e en-US.json)
- Documentação do banco de dados deve ser atualizada após mudanças no schema
