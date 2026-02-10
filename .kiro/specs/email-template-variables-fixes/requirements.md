# Requirements Document

## Introdução

O sistema de notificações por email do GestaoTickets apresenta um bug onde valores brutos de enum de status (ex: `waiting_customer`, `closed`) são exibidos nos emails enviados aos usuários, ao invés de textos traduzidos e amigáveis (ex: "Aguardando Cliente", "Encerrado"). Este documento especifica os requisitos para corrigir a tradução de variáveis de status nos templates de email e garantir que mensagens customizadas para participantes também utilizem textos traduzidos.

## Glossário

- **Email_Notification_Service**: Serviço backend responsável por renderizar templates de email e enviar notificações (`server/services/email-notification-service.ts`)
- **Template_Renderer**: Função `renderTemplate()` dentro do Email_Notification_Service que substitui placeholders por valores reais
- **Status_Enum**: Valor interno de status do ticket armazenado no banco de dados (ex: `new`, `ongoing`, `waiting_customer`, `closed`)
- **Status_Text**: Texto traduzido e amigável do status para exibição ao usuário final (ex: "Novo", "Em Andamento", "Aguardando Cliente", "Encerrado")
- **Placeholder**: Variável de template no formato `{{categoria.campo}}` usada nos templates de email
- **Custom_Message**: Mensagem de texto livre construída programaticamente e passada via `{{system.custom_message}}` para notificações de participantes
- **Seed_Template**: Template padrão de email criado pela rota `seed-defaults`, usado como base para cada empresa
- **Status_Translation_Map**: Objeto `Record<string, string>` que mapeia Status_Enum para Status_Text

## Requisitos

### Requisito 1: Tradução completa de status no Template_Renderer

**User Story:** Como usuário do sistema, eu quero que todos os status de ticket apareçam traduzidos nos emails, para que eu entenda o estado do meu chamado sem precisar interpretar códigos internos.

#### Critérios de Aceitação

1. WHEN o Template_Renderer processa um placeholder `{{ticket.status_text}}`, THE Template_Renderer SHALL substituir o placeholder pelo Status_Text correspondente ao Status_Enum do ticket, cobrindo todos os status do sistema: `new`, `ongoing`, `suspended`, `waiting_customer`, `escalated`, `in_analysis`, `pending_deployment`, `reopened`, `resolved`, `closed`
2. WHEN o Template_Renderer processa um placeholder `{{status_change.old_status_text}}`, THE Template_Renderer SHALL substituir o placeholder pelo Status_Text correspondente ao Status_Enum do status anterior
3. WHEN o Template_Renderer processa um placeholder `{{status_change.new_status_text}}`, THE Template_Renderer SHALL substituir o placeholder pelo Status_Text correspondente ao Status_Enum do novo status
4. IF o Status_Enum fornecido ao Template_Renderer for um valor desconhecido (não presente no Status_Translation_Map), THEN THE Template_Renderer SHALL retornar o valor original do Status_Enum como fallback

### Requisito 2: Mensagens customizadas de participantes com textos traduzidos

**User Story:** Como participante de um ticket, eu quero que as notificações de mudança de status que recebo contenham textos traduzidos, para que eu entenda claramente o que mudou.

#### Critérios de Aceitação

1. WHEN o Email_Notification_Service constrói a Custom_Message para notificação de mudança de status de participantes, THE Email_Notification_Service SHALL utilizar Status_Text (valores traduzidos) ao invés de Status_Enum (valores brutos) para os campos de status antigo e novo
2. WHEN a Custom_Message é passada para `notifyParticipantsWithSettings`, THE Custom_Message SHALL conter apenas texto legível por humanos, sem valores de enum internos

### Requisito 3: Consistência de variáveis nos Seed_Templates

**User Story:** Como administrador do sistema, eu quero que os templates padrão de email usem as variáveis corretas de tradução, para que novos tenants recebam templates que já exibem textos amigáveis.

#### Critérios de Aceitação

1. THE Seed_Template SHALL utilizar `{{ticket.status_text}}` ao invés de `{{ticket.status}}` em todos os templates que exibem status de ticket ao usuário final
2. THE Seed_Template SHALL utilizar `{{status_change.old_status_text}}` ao invés de `{{status_change.old_status}}` em todos os templates que exibem o status anterior
3. THE Seed_Template SHALL utilizar `{{status_change.new_status_text}}` ao invés de `{{status_change.new_status}}` em todos os templates que exibem o novo status
4. THE Seed_Template SHALL utilizar placeholders sem espaços internos (formato `{{variavel}}`, sem `{{ variavel }}`)

### Requisito 4: Consistência do Status_Translation_Map entre contextos

**User Story:** Como desenvolvedor, eu quero que exista uma única fonte de verdade para o mapeamento de tradução de status, para evitar inconsistências entre diferentes partes do código.

#### Critérios de Aceitação

1. THE Email_Notification_Service SHALL utilizar o mesmo Status_Translation_Map tanto na função `translateStatus()` do Template_Renderer quanto na função `notifyStatusChanged()` que constrói o contexto de mudança de status
2. WHEN um novo status é adicionado ao sistema, THE Status_Translation_Map SHALL ser atualizado em um único local para que todas as referências reflitam a mudança

### Requisito 5: Suporte bilíngue para tradução de status nos emails

**User Story:** Como usuário que utiliza o sistema em inglês, eu quero que os status nos emails sejam traduzidos para o idioma correto da minha empresa, para que a comunicação seja consistente.

#### Critérios de Aceitação

1. WHEN o Email_Notification_Service renderiza um template para uma empresa com idioma `en-US`, THE Template_Renderer SHALL utilizar traduções em inglês para os Status_Text (ex: "New", "In Progress", "Waiting for Customer", "Closed")
2. WHEN o Email_Notification_Service renderiza um template para uma empresa com idioma `pt-BR`, THE Template_Renderer SHALL utilizar traduções em português para os Status_Text (ex: "Novo", "Em Andamento", "Aguardando Cliente", "Encerrado")
3. IF o idioma da empresa não puder ser determinado, THEN THE Template_Renderer SHALL utilizar `pt-BR` como idioma padrão para tradução de status
