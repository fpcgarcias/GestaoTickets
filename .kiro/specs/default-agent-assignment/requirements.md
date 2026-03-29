# Documento de Requisitos — Atendente Padrão por Departamento

## Introdução

Esta funcionalidade permite que departamentos configurem um atendente padrão para receber automaticamente todos os novos chamados. Quando habilitado, o ticket é vinculado ao atendente padrão no momento da abertura e apenas esse atendente recebe a notificação — ao invés de notificar todos os atendentes do departamento. O atendente padrão atua como triagem, redirecionando os chamados para quem efetivamente fará o atendimento. Quando desabilitado, o fluxo atual é mantido (ticket sem atendente, notificação para todo o departamento).

## Glossário

- **Departamento**: Entidade organizacional que agrupa atendentes e tipos de incidentes. Representado pela tabela `departments`.
- **Atendente**: Usuário com role `support`, `manager` ou `supervisor` vinculado a um ou mais departamentos via `official_departments`. Representado pela tabela `officials`.
- **Ticket**: Chamado de suporte aberto por um cliente. Representado pela tabela `tickets`.
- **Atendente_Padrão**: Atendente designado para receber automaticamente todos os novos tickets de um departamento específico.
- **Parâmetro_Atendente_Padrão**: Configuração booleana no departamento que habilita ou desabilita a funcionalidade de atendente padrão.
- **Serviço_de_Notificação**: Componente responsável por enviar notificações via WebSocket e e-mail aos usuários. Representado pela classe `NotificationService`.
- **Formulário_de_Departamento**: Interface de configuração do departamento no painel administrativo.
- **API_de_Departamentos**: Endpoints REST responsáveis por criar e atualizar departamentos.
- **Fluxo_Normal**: Comportamento atual onde tickets são criados sem atendente vinculado e todos os atendentes do departamento são notificados.

## Requisitos

### Requisito 1: Configuração do Atendente Padrão no Departamento

**User Story:** Como administrador, eu quero configurar um atendente padrão em um departamento, para que todos os novos chamados daquele departamento sejam automaticamente direcionados a esse atendente.

#### Critérios de Aceitação

1. THE Departamento SHALL possuir um campo `default_agent_enabled` do tipo booleano com valor padrão `false`.
2. THE Departamento SHALL possuir um campo `default_agent_id` do tipo inteiro que referencia a tabela `officials`, com valor padrão `null`.
3. WHEN o Parâmetro_Atendente_Padrão está desabilitado, THE Formulário_de_Departamento SHALL ocultar o dropdown de seleção de atendente padrão.
4. WHEN o Parâmetro_Atendente_Padrão está habilitado, THE Formulário_de_Departamento SHALL exibir um dropdown para selecionar o Atendente_Padrão dentre os atendentes ativos vinculados àquele departamento.
5. WHEN o administrador habilita o Parâmetro_Atendente_Padrão sem selecionar um atendente, THE Formulário_de_Departamento SHALL exibir uma mensagem de validação solicitando a seleção de um atendente.
6. THE API_de_Departamentos SHALL validar que o `default_agent_id` referencia um atendente ativo vinculado ao departamento quando `default_agent_enabled` é `true`.
7. IF o `default_agent_enabled` é enviado como `true` sem um `default_agent_id` válido, THEN THE API_de_Departamentos SHALL retornar um erro de validação com status HTTP 400.
8. WHEN o Parâmetro_Atendente_Padrão é desabilitado, THE API_de_Departamentos SHALL definir o campo `default_agent_id` como `null`.

### Requisito 2: Atribuição Automática na Abertura do Ticket

**User Story:** Como atendente padrão, eu quero que os novos chamados do meu departamento sejam automaticamente atribuídos a mim, para que eu possa fazer a triagem e direcionar para o atendente correto.

#### Critérios de Aceitação

1. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão habilitado, THE Sistema SHALL atribuir automaticamente o campo `assigned_to_id` do ticket ao `default_agent_id` do departamento.
2. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão desabilitado, THE Sistema SHALL manter o campo `assigned_to_id` do ticket como `null`, seguindo o Fluxo_Normal.
3. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão habilitado, THE Sistema SHALL definir o status do ticket como `in_progress` ao invés de `new`, pois o ticket já possui um atendente vinculado.
4. IF o Atendente_Padrão configurado no departamento estiver inativo no momento da criação do ticket, THEN THE Sistema SHALL seguir o Fluxo_Normal e registrar um log de aviso.

### Requisito 3: Notificação Direcionada ao Atendente Padrão

**User Story:** Como atendente padrão, eu quero ser notificado individualmente quando um novo chamado é aberto no meu departamento, para que eu possa agir rapidamente na triagem.

#### Critérios de Aceitação

1. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão habilitado, THE Serviço_de_Notificação SHALL enviar a notificação de novo ticket apenas para o Atendente_Padrão e para os administradores da empresa.
2. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão habilitado, THE Serviço_de_Notificação SHALL omitir a notificação para os demais atendentes do departamento.
3. WHEN um ticket é criado em um departamento com Parâmetro_Atendente_Padrão desabilitado, THE Serviço_de_Notificação SHALL notificar todos os atendentes do departamento, seguindo o Fluxo_Normal.
4. THE Serviço_de_Notificação SHALL enviar tanto a notificação via WebSocket quanto a notificação por e-mail ao Atendente_Padrão, respeitando as configurações individuais de notificação do usuário.

### Requisito 4: Validação Multi-Tenant

**User Story:** Como administrador de uma empresa, eu quero que a configuração de atendente padrão seja isolada por empresa, para que não haja interferência entre empresas diferentes.

#### Critérios de Aceitação

1. THE API_de_Departamentos SHALL filtrar os atendentes disponíveis para seleção como Atendente_Padrão pelo `company_id` do departamento.
2. THE API_de_Departamentos SHALL validar que o atendente selecionado como Atendente_Padrão pertence à mesma empresa (`company_id`) do departamento.
3. WHEN um usuário com role `super_admin` acessa a configuração de departamentos, THE Formulário_de_Departamento SHALL permitir a configuração do Atendente_Padrão para qualquer empresa selecionada.

### Requisito 5: Internacionalização

**User Story:** Como usuário do sistema, eu quero que todos os textos da funcionalidade de atendente padrão estejam disponíveis em português (pt-BR) e inglês (en-US), para manter a consistência do sistema bilíngue.

#### Critérios de Aceitação

1. THE Formulário_de_Departamento SHALL exibir todos os labels, tooltips e mensagens de validação da funcionalidade de Atendente_Padrão utilizando chaves de internacionalização nos arquivos `pt-BR.json` e `en-US.json`.
2. THE Serviço_de_Notificação SHALL utilizar textos internacionalizados nas notificações enviadas ao Atendente_Padrão.
