# Documento de Requisitos: Status "Encerrado" para Tickets

## Introdução

Este documento especifica os requisitos para implementação de um novo status "Encerrado" (closed) no sistema de gerenciamento de tickets. O status atual "Resolvido" é usado tanto para tickets que foram efetivamente resolvidos quanto para tickets encerrados automaticamente por falta de interação do cliente, o que não reflete a realidade operacional. O novo status "Encerrado" será usado para casos de fechamento sem resolução efetiva do problema.

## Glossário

- **Sistema**: Sistema de gerenciamento de tickets
- **Ticket**: Chamado de suporte registrado no sistema
- **Status_Resolvido**: Status atual usado quando o problema foi efetivamente resolvido
- **Status_Encerrado**: Novo status para tickets fechados sem resolução efetiva (por timeout, abandono, etc)
- **Auto_Close_Job**: Processo automatizado que encerra tickets em "Aguardando Cliente" sem resposta após 48h + 24h
- **Pesquisa_Satisfacao**: Pesquisa enviada ao cliente após finalização do ticket
- **Template_Email**: Modelo de e-mail usado para notificações
- **Campo_Resolved_At**: Campo timestamp que registra quando o ticket foi finalizado
- **Filtro_Hide_Resolved**: Filtro que oculta tickets finalizados da visualização
- **SLA**: Service Level Agreement - acordo de nível de serviço com prazos definidos
- **Dropdown_Status**: Componente de interface para seleção de status
- **Badge_Status**: Componente visual que exibe o status do ticket
- **Atendente**: Usuário com permissão para responder e gerenciar tickets
- **Cliente**: Usuário que criou o ticket

## Requisitos

### Requisito 1: Adicionar Status "Encerrado" ao Schema do Banco de Dados

**User Story:** Como desenvolvedor, eu quero adicionar o status "closed" ao enum de status de tickets no banco de dados, para que o sistema possa armazenar e processar este novo estado.

#### Acceptance Criteria

1. WHEN o enum ticketStatusEnum é definido, THE Sistema SHALL incluir 'closed' como um valor válido
2. WHEN uma migração de banco de dados é executada, THE Sistema SHALL adicionar 'closed' ao tipo enum ticket_status sem perder dados existentes
3. WHEN o schema TypeScript é atualizado, THE Sistema SHALL incluir 'closed' no tipo TicketStatus

### Requisito 2: Configurar Propriedades Visuais e Comportamentais do Status "Encerrado"

**User Story:** Como desenvolvedor, eu quero definir as propriedades visuais e comportamentais do status "Encerrado", para que ele seja exibido consistentemente em toda a aplicação.

#### Acceptance Criteria

1. WHEN o status "closed" é configurado, THE Sistema SHALL definir label como "Encerrado"
2. WHEN o status "closed" é configurado, THE Sistema SHALL definir cor de fundo cinza (bg-gray-100)
3. WHEN o status "closed" é configurado, THE Sistema SHALL definir cor de texto cinza escuro (text-gray-800)
4. WHEN o status "closed" é configurado, THE Sistema SHALL definir ícone apropriado (🔒 ou similar)
5. WHEN o status "closed" é adicionado, THE Sistema SHALL incluí-lo em SLA_FINISHED_STATUSES
6. WHEN traduções são definidas, THE Sistema SHALL mapear 'closed' para 'Encerrado' em pt-BR
7. WHEN traduções são definidas, THE Sistema SHALL mapear 'closed' para 'Closed' em en-US

### Requisito 3: Atualizar Auto-Close Job para Usar Status "Encerrado"

**User Story:** Como administrador do sistema, eu quero que tickets em "Aguardando Cliente" sem resposta por 72h sejam automaticamente marcados como "Encerrado" ao invés de "Resolvido", para refletir que o problema não foi efetivamente resolvido.

#### Acceptance Criteria

1. WHEN o Auto_Close_Job identifica um ticket elegível para encerramento, THE Sistema SHALL alterar o status para 'closed'
2. WHEN o Auto_Close_Job encerra um ticket, THE Sistema SHALL preencher o Campo_Resolved_At com o timestamp atual
3. WHEN o Auto_Close_Job encerra um ticket, THE Sistema SHALL registrar a mudança no histórico de status
4. WHEN o Auto_Close_Job encerra um ticket, THE Sistema SHALL enviar o template de e-mail "Ticket Encerrado"
5. WHEN o Auto_Close_Job encerra um ticket, THE Sistema SHALL enviar a Pesquisa_Satisfacao

### Requisito 4: Criar Template de E-mail "Ticket Encerrado"

**User Story:** Como cliente, eu quero receber um e-mail específico quando meu ticket for encerrado automaticamente, para entender que o ticket foi fechado por falta de interação e não por resolução do problema.

#### Acceptance Criteria

1. WHEN o enum emailTemplateTypeEnum é definido, THE Sistema SHALL incluir 'ticket_closed' como um valor válido
2. WHEN templates padrão são criados, THE Sistema SHALL criar um template "Ticket Encerrado" com layout idêntico ao template "Ticket Resolvido"
3. WHEN o template "Ticket Encerrado" é renderizado, THE Sistema SHALL usar textos diferentes do template "Ticket Resolvido" explicando o encerramento por falta de interação
4. WHEN o template "Ticket Encerrado" é criado, THE Sistema SHALL suportar as mesmas variáveis do template "Ticket Resolvido" (ticket_id, title, customer_name, etc)

### Requisito 5: Enviar Pesquisa de Satisfação para Tickets Encerrados

**User Story:** Como gestor, eu quero que a pesquisa de satisfação seja enviada tanto para tickets "Resolvidos" quanto para tickets "Encerrados", para coletar feedback em ambos os casos de finalização.

#### Acceptance Criteria

1. WHEN um ticket tem status alterado para 'resolved', THE Sistema SHALL enviar a Pesquisa_Satisfacao
2. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL enviar a Pesquisa_Satisfacao
3. WHEN a Pesquisa_Satisfacao é enviada, THE Sistema SHALL usar o template apropriado baseado no status (resolved ou closed)

### Requisito 6: Atualizar Filtro "Ocultar Resolvidos"

**User Story:** Como atendente, eu quero que o filtro "Ocultar Resolvidos" também oculte tickets "Encerrados", para manter a lista de trabalho focada apenas em tickets ativos.

#### Acceptance Criteria

1. WHEN o Filtro_Hide_Resolved está ativo, THE Sistema SHALL excluir tickets com status 'resolved' da listagem
2. WHEN o Filtro_Hide_Resolved está ativo, THE Sistema SHALL excluir tickets com status 'closed' da listagem
3. WHEN o Filtro_Hide_Resolved está inativo, THE Sistema SHALL incluir todos os status na listagem

### Requisito 7: Adicionar "Encerrado" em Todos os Dropdowns de Status

**User Story:** Como atendente, eu quero poder selecionar "Encerrado" manualmente em qualquer dropdown de status, para ter a opção de encerrar tickets sem marcá-los como resolvidos.

#### Acceptance Criteria

1. WHEN um Dropdown_Status é renderizado na página de tickets, THE Sistema SHALL incluir a opção "Encerrado"
2. WHEN um Dropdown_Status é renderizado no componente de resposta, THE Sistema SHALL incluir a opção "Encerrado"
3. WHEN um Dropdown_Status é renderizado em filtros de relatórios, THE Sistema SHALL incluir a opção "Encerrado"
4. WHEN um Dropdown_Status é renderizado na auditoria de IA, THE Sistema SHALL incluir a opção "Encerrado"
5. WHEN um Dropdown_Status é renderizado no dashboard, THE Sistema SHALL incluir dados de tickets "Encerrados"

### Requisito 8: Atualizar Badges de Status

**User Story:** Como usuário do sistema, eu quero ver badges visuais consistentes para o status "Encerrado" em todas as telas, para identificar rapidamente tickets encerrados.

#### Acceptance Criteria

1. WHEN um Badge_Status é renderizado para status 'closed', THE Sistema SHALL exibir o texto "Encerrado" (pt-BR) ou "Closed" (en-US)
2. WHEN um Badge_Status é renderizado para status 'closed', THE Sistema SHALL aplicar as cores configuradas (bg-gray-100, text-gray-800)
3. WHEN um Badge_Status é renderizado para status 'closed', THE Sistema SHALL exibir o ícone configurado

### Requisito 9: Restringir Ações em Tickets Encerrados

**User Story:** Como desenvolvedor, eu quero que tickets "Encerrados" tenham as mesmas restrições que tickets "Resolvidos", para manter a integridade dos tickets finalizados.

#### Acceptance Criteria

1. WHEN um ticket tem status 'closed', THE Sistema SHALL impedir que Cliente adicione novas respostas
2. WHEN um ticket tem status 'closed', THE Sistema SHALL impedir que Atendente altere o atendente responsável
3. WHEN um ticket tem status 'closed', THE Sistema SHALL permitir que Atendente adicione respostas internas
4. WHEN um ticket tem status 'closed', THE Sistema SHALL permitir que Atendente altere o status para 'reopened'

### Requisito 10: Finalizar SLA para Status "Encerrado"

**User Story:** Como gestor, eu quero que o SLA seja finalizado quando um ticket é marcado como "Encerrado", para que o tempo de atendimento seja contabilizado corretamente nos relatórios.

#### Acceptance Criteria

1. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL parar a contagem de SLA
2. WHEN um ticket tem status 'closed', THE Sistema SHALL considerar o SLA como finalizado em cálculos e relatórios
3. WHEN um ticket tem status alterado de 'closed' para outro status, THE Sistema SHALL reiniciar a contagem de SLA se o novo status for um SLA_ACTIVE_STATUSES

### Requisito 11: Atualizar Relatórios e Estatísticas

**User Story:** Como gestor, eu quero que todos os relatórios e estatísticas incluam dados de tickets "Encerrados" separadamente de tickets "Resolvidos", para ter visibilidade clara sobre os diferentes tipos de finalização.

#### Acceptance Criteria

1. WHEN relatórios de status são gerados, THE Sistema SHALL incluir contagem separada para status 'closed'
2. WHEN traduções de relatórios são aplicadas, THE Sistema SHALL traduzir 'closed' corretamente para o idioma selecionado
3. WHEN filtros de relatórios são exibidos, THE Sistema SHALL incluir 'closed' como opção de filtro
4. WHEN dashboards são renderizados, THE Sistema SHALL incluir métricas de tickets 'closed'

### Requisito 12: Atualizar Notificações In-App

**User Story:** Como usuário, eu quero receber notificações in-app quando um ticket é marcado como "Encerrado", para ser informado sobre mudanças de status.

#### Acceptance Criteria

1. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL criar uma notificação in-app para o Cliente
2. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL criar uma notificação in-app para o Atendente responsável
3. WHEN notificações são renderizadas, THE Sistema SHALL traduzir o status 'closed' corretamente

### Requisito 13: Internacionalização Completa

**User Story:** Como usuário internacional, eu quero que todas as strings relacionadas ao status "Encerrado" sejam traduzidas corretamente para pt-BR e en-US, para usar o sistema no meu idioma preferido.

#### Acceptance Criteria

1. WHEN arquivos de tradução são atualizados, THE Sistema SHALL incluir traduções para 'closed' em pt-BR.json
2. WHEN arquivos de tradução são atualizados, THE Sistema SHALL incluir traduções para 'closed' em en-US.json
3. WHEN traduções de status são aplicadas, THE Sistema SHALL usar as chaves de tradução corretas para 'closed'
4. WHEN templates de e-mail são renderizados, THE Sistema SHALL usar traduções apropriadas baseadas no idioma do destinatário

### Requisito 14: Preencher Campo Resolved_At para Status "Encerrado"

**User Story:** Como desenvolvedor, eu quero que o campo resolved_at seja preenchido tanto para status "Resolvido" quanto para "Encerrado", para manter consistência nos dados de finalização de tickets.

#### Acceptance Criteria

1. WHEN um ticket tem status alterado para 'resolved', THE Sistema SHALL preencher Campo_Resolved_At com o timestamp atual
2. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL preencher Campo_Resolved_At com o timestamp atual
3. WHEN um ticket tem status alterado de 'resolved' ou 'closed' para outro status, THE Sistema SHALL limpar o Campo_Resolved_At (definir como null)

### Requisito 15: Registrar Histórico de Mudanças de Status

**User Story:** Como auditor, eu quero que todas as mudanças para e de status "Encerrado" sejam registradas no histórico, para rastreabilidade completa.

#### Acceptance Criteria

1. WHEN um ticket tem status alterado para 'closed', THE Sistema SHALL criar um registro em ticketStatusHistory
2. WHEN um ticket tem status alterado de 'closed' para outro status, THE Sistema SHALL criar um registro em ticketStatusHistory
3. WHEN registros de histórico são criados, THE Sistema SHALL incluir o ID do usuário que fez a alteração
4. WHEN registros de histórico são criados, THE Sistema SHALL incluir o timestamp da alteração
