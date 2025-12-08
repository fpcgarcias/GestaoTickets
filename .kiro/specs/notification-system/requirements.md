# Documento de Requisitos - Sistema de Notificações Persistentes

## Introdução

Este documento descreve os requisitos para modernizar o sistema de notificações da aplicação, substituindo o sistema atual baseado apenas em WebSocket por uma solução híbrida que combina persistência em banco de dados, histórico de notificações, e suporte a Web Push. O sistema atual perde todas as notificações quando o usuário desconecta, e não notifica usuários offline. O novo sistema resolverá essas limitações mantendo um histórico completo de notificações com controle de leitura e exclusão.

## Glossário

- **Sistema de Notificações**: O componente responsável por criar, armazenar, entregar e gerenciar notificações para usuários
- **Notificação**: Uma mensagem informativa enviada ao usuário sobre eventos relevantes no sistema (novos tickets, respostas, mudanças de status, etc.)
- **WebSocket**: Protocolo de comunicação bidirecional em tempo real usado atualmente para entrega instantânea de notificações
- **Web Push**: API do navegador que permite enviar notificações push mesmo quando o usuário não está com a aplicação aberta
- **Histórico de Notificações**: Registro persistente de todas as notificações enviadas a um usuário, armazenado no banco de dados
- **Notificação Lida**: Notificação que foi marcada como visualizada pelo usuário
- **Notificação Não Lida**: Notificação que ainda não foi visualizada pelo usuário
- **Service Worker**: Script que roda em background no navegador, necessário para Web Push
- **Push Subscription**: Registro do navegador do usuário para receber notificações push
- **Usuário Offline**: Usuário que não está conectado via WebSocket no momento
- **Usuário Online**: Usuário que possui conexão WebSocket ativa

## Requisitos

### Requisito 1

**User Story:** Como usuário do sistema, quero que minhas notificações sejam salvas em um histórico persistente, para que eu possa visualizá-las mesmo após desconectar e reconectar ao sistema.

#### Critérios de Aceitação

1. WHEN o Sistema de Notificações cria uma notificação THEN o Sistema de Notificações SHALL armazenar a notificação na tabela de banco de dados com todos os campos obrigatórios (tipo, título, mensagem, usuário destinatário, timestamp, status de leitura)

2. WHEN um Usuário Online recebe uma notificação THEN o Sistema de Notificações SHALL entregar a notificação via WebSocket em tempo real E SHALL armazenar a notificação no banco de dados

3. WHEN um Usuário Offline deveria receber uma notificação THEN o Sistema de Notificações SHALL armazenar a notificação no banco de dados para recuperação posterior

4. WHEN um usuário se conecta ao sistema THEN o Sistema de Notificações SHALL recuperar todas as Notificações Não Lidas do banco de dados e exibi-las ao usuário

5. WHEN um usuário solicita o histórico de notificações THEN o Sistema de Notificações SHALL retornar todas as notificações do usuário ordenadas por timestamp decrescente com paginação

### Requisito 2

**User Story:** Como usuário, quero marcar notificações como lidas ou excluí-las, para que eu possa gerenciar meu histórico de notificações e manter apenas o que é relevante.

#### Critérios de Aceitação

1. WHEN um usuário visualiza uma notificação THEN o Sistema de Notificações SHALL marcar a notificação como lida no banco de dados

2. WHEN um usuário marca uma notificação como lida THEN o Sistema de Notificações SHALL atualizar o campo read_at com o timestamp atual

3. WHEN um usuário solicita marcar todas as notificações como lidas THEN o Sistema de Notificações SHALL atualizar todas as Notificações Não Lidas do usuário para o status lido

4. WHEN um usuário exclui uma notificação THEN o Sistema de Notificações SHALL remover a notificação do banco de dados permanentemente

5. WHEN um usuário exclui múltiplas notificações THEN o Sistema de Notificações SHALL remover todas as notificações selecionadas em uma única operação

6. WHEN o Sistema de Notificações atualiza o status de uma notificação THEN o Sistema de Notificações SHALL retornar a contagem atualizada de Notificações Não Lidas

### Requisito 3

**User Story:** Como usuário, quero receber notificações push no navegador mesmo quando não estou com a aplicação aberta, para que eu seja informado sobre eventos importantes em tempo real.

#### Critérios de Aceitação

1. WHEN um usuário acessa a aplicação pela primeira vez THEN o Sistema de Notificações SHALL solicitar permissão para enviar notificações push

2. WHEN um usuário concede permissão para notificações push THEN o Sistema de Notificações SHALL registrar o Service Worker e criar uma Push Subscription

3. WHEN uma Push Subscription é criada THEN o Sistema de Notificações SHALL armazenar a subscription no banco de dados associada ao usuário

4. WHEN uma notificação é criada para um Usuário Offline com Push Subscription ativa THEN o Sistema de Notificações SHALL enviar a notificação via Web Push

5. WHEN um usuário revoga permissão de notificações push THEN o Sistema de Notificações SHALL remover a Push Subscription do banco de dados

6. WHEN uma Push Subscription expira ou se torna inválida THEN o Sistema de Notificações SHALL remover a subscription do banco de dados e registrar o erro

### Requisito 4

**User Story:** Como desenvolvedor, quero que o sistema de notificações seja retrocompatível com o código existente, para que a migração seja suave e não quebre funcionalidades atuais.

#### Critérios de Aceitação

1. WHEN o Sistema de Notificações é inicializado THEN o Sistema de Notificações SHALL manter todas as interfaces públicas existentes do serviço de notificações

2. WHEN uma notificação é enviada usando métodos existentes (sendNotificationToUser, sendNotificationToAdmins, etc.) THEN o Sistema de Notificações SHALL funcionar corretamente com persistência adicional

3. WHEN o WebSocket está conectado THEN o Sistema de Notificações SHALL continuar entregando notificações em tempo real como antes

4. WHEN o Sistema de Notificações persiste notificações THEN o Sistema de Notificações SHALL manter os mesmos tipos de notificação existentes (new_ticket, status_change, new_reply, participant_added, participant_removed)

5. WHEN o frontend solicita notificações THEN o Sistema de Notificações SHALL fornecer APIs REST compatíveis com a estrutura de dados atual

### Requisito 5

**User Story:** Como administrador do sistema, quero que notificações antigas sejam automaticamente limpas, para que o banco de dados não cresça indefinidamente e mantenha performance adequada.

#### Critérios de Aceitação

1. WHEN o Sistema de Notificações executa limpeza automática THEN o Sistema de Notificações SHALL remover notificações lidas com mais de 90 dias

2. WHEN o Sistema de Notificações executa limpeza automática THEN o Sistema de Notificações SHALL remover notificações não lidas com mais de 180 dias

3. WHEN o Sistema de Notificações executa limpeza THEN o Sistema de Notificações SHALL registrar no log a quantidade de notificações removidas

4. WHEN o Sistema de Notificações agenda a limpeza automática THEN o Sistema de Notificações SHALL executar a limpeza diariamente às 3h da manhã

5. WHEN o Sistema de Notificações remove notificações antigas THEN o Sistema de Notificações SHALL manter integridade referencial e não afetar outras tabelas

### Requisito 6

**User Story:** Como usuário, quero visualizar um contador de notificações não lidas, para que eu saiba rapidamente quantas notificações novas tenho sem precisar abrir o painel.

#### Critérios de Aceitação

1. WHEN um usuário se conecta ao sistema THEN o Sistema de Notificações SHALL calcular e retornar a contagem de Notificações Não Lidas

2. WHEN uma nova notificação é criada para um usuário THEN o Sistema de Notificações SHALL incrementar o contador de notificações não lidas

3. WHEN um usuário marca uma notificação como lida THEN o Sistema de Notificações SHALL decrementar o contador de notificações não lidas

4. WHEN um usuário marca todas as notificações como lidas THEN o Sistema de Notificações SHALL zerar o contador de notificações não lidas

5. WHEN o contador de notificações não lidas é atualizado THEN o Sistema de Notificações SHALL enviar a atualização via WebSocket se o usuário estiver online

### Requisito 7

**User Story:** Como desenvolvedor, quero que o sistema de notificações tenha tratamento robusto de erros, para que falhas em um canal de entrega não afetem outros canais.

#### Critérios de Aceitação

1. WHEN o envio via WebSocket falha THEN o Sistema de Notificações SHALL registrar o erro E SHALL continuar com a persistência no banco de dados

2. WHEN o envio via Web Push falha THEN o Sistema de Notificações SHALL registrar o erro E SHALL manter a notificação no banco de dados para recuperação

3. WHEN a persistência no banco de dados falha THEN o Sistema de Notificações SHALL registrar o erro crítico E SHALL tentar entregar via WebSocket se possível

4. WHEN uma Push Subscription retorna erro 410 (Gone) THEN o Sistema de Notificações SHALL remover automaticamente a subscription inválida

5. WHEN ocorre erro em qualquer operação de notificação THEN o Sistema de Notificações SHALL registrar detalhes completos do erro incluindo stack trace e contexto

### Requisito 8

**User Story:** Como usuário, quero filtrar e buscar no meu histórico de notificações, para que eu possa encontrar rapidamente notificações específicas.

#### Critérios de Aceitação

1. WHEN um usuário solicita filtrar notificações por tipo THEN o Sistema de Notificações SHALL retornar apenas notificações do tipo especificado

2. WHEN um usuário solicita filtrar notificações por status de leitura THEN o Sistema de Notificações SHALL retornar apenas notificações lidas ou não lidas conforme solicitado

3. WHEN um usuário solicita filtrar notificações por período THEN o Sistema de Notificações SHALL retornar apenas notificações dentro do intervalo de datas especificado

4. WHEN um usuário busca notificações por texto THEN o Sistema de Notificações SHALL retornar notificações cujo título ou mensagem contenham o texto buscado

5. WHEN um usuário aplica múltiplos filtros THEN o Sistema de Notificações SHALL combinar todos os filtros usando operador AND

### Requisito 9

**User Story:** Como desenvolvedor, quero que o sistema suporte diferentes prioridades de notificação, para que notificações críticas sejam destacadas visualmente e tratadas com urgência.

#### Critérios de Aceitação

1. WHEN uma notificação é criada THEN o Sistema de Notificações SHALL aceitar um campo de prioridade com valores (low, medium, high, critical)

2. WHEN uma notificação crítica é enviada via Web Push THEN o Sistema de Notificações SHALL configurar a notificação com urgência alta e som

3. WHEN notificações são exibidas no frontend THEN o Sistema de Notificações SHALL incluir o campo de prioridade para estilização apropriada

4. WHEN notificações são ordenadas THEN o Sistema de Notificações SHALL permitir ordenação por prioridade além de timestamp

5. WHEN uma notificação não especifica prioridade THEN o Sistema de Notificações SHALL usar prioridade medium como padrão

### Requisito 10

**User Story:** Como usuário, quero que notificações relacionadas a tickets incluam links diretos, para que eu possa navegar rapidamente para o contexto relevante.

#### Critérios de Aceitação

1. WHEN uma notificação está relacionada a um ticket THEN o Sistema de Notificações SHALL incluir o ticket_id e ticket_code nos metadados

2. WHEN uma notificação é exibida no frontend THEN o Sistema de Notificações SHALL fornecer dados suficientes para construir URL de navegação

3. WHEN um usuário clica em uma notificação de ticket THEN o Sistema de Notificações SHALL marcar a notificação como lida E SHALL navegar para a página do ticket

4. WHEN uma notificação push é clicada THEN o Service Worker SHALL abrir ou focar a aplicação na página do ticket correspondente

5. WHEN uma notificação não está relacionada a um ticket THEN o Sistema de Notificações SHALL permitir metadados opcionais para outros tipos de links
