# Documento de Requisitos — Sistema Centralizado de Logging em Banco de Dados

## Introdução

Este documento define os requisitos para migrar o sistema de logging atual (baseado em arquivos `.txt` via Winston) para um sistema centralizado em banco de dados PostgreSQL. O objetivo é resolver os problemas de falta de ordem cronológica, dificuldade de busca, dispersão entre 3 servidores e falta de contexto/detalhamento nos logs. O sistema deve permitir consultas eficientes, rastreamento de problemas (tracing) e centralização de logs de múltiplos servidores em uma única tabela, mantendo o isolamento multi-tenant.

## Glossário

- **Log_Service**: Serviço backend responsável por receber, validar e persistir entradas de log no banco de dados PostgreSQL.
- **Log_Viewer**: Interface frontend (React) que permite visualizar, filtrar e pesquisar logs armazenados no banco de dados.
- **Log_Entry**: Registro individual de log contendo nível, mensagem, contexto estruturado, identificadores de rastreamento e metadados do servidor de origem.
- **Trace_ID**: Identificador único que agrupa todas as Log_Entries relacionadas a uma mesma requisição ou fluxo de operação, compatível com o padrão OpenTelemetry.
- **Span_ID**: Identificador único de uma operação específica dentro de um Trace_ID.
- **Server_Identifier**: Nome ou identificador único do servidor de origem de uma Log_Entry (ex: "server-1", "server-2", "server-3").
- **Context_Data**: Objeto JSON estruturado contendo informações adicionais relevantes para debugging (ex: ticket_id, user_id, duração de operação externa, parâmetros da requisição).
- **Log_Retention_Policy**: Regra que define por quanto tempo as Log_Entries são mantidas no banco de dados antes de serem arquivadas ou removidas.
- **Super_Admin**: Usuário com role `admin` que possui acesso total ao sistema, podendo visualizar logs de todas as empresas.

## Requisitos

### Requisito 1: Tabela de Logs no Banco de Dados

**User Story:** Como administrador do sistema, eu quero que os logs sejam armazenados em uma tabela PostgreSQL com estrutura definida, para que eu possa consultá-los de forma organizada e eficiente.

#### Critérios de Aceitação

1. THE Log_Service SHALL persistir cada Log_Entry em uma tabela `system_logs` no banco de dados PostgreSQL com os seguintes campos: id, level, message, server_identifier, trace_id, span_id, context_data (JSONB), company_id, user_id, request_method, request_url, response_status, response_time_ms, created_at.
2. THE Log_Service SHALL registrar o campo `created_at` com timestamp incluindo timezone (timestamptz) para garantir ordenação cronológica precisa.
3. THE Log_Service SHALL criar índices na tabela `system_logs` para os campos: created_at, level, server_identifier, trace_id, company_id e request_url.
4. THE Log_Service SHALL aceitar os seguintes níveis de log: "debug", "info", "warn", "error" e "fatal".
5. THE Log_Service SHALL armazenar o campo context_data como JSONB para permitir consultas estruturadas sobre dados de contexto.

### Requisito 2: Contexto Enriquecido nos Logs

**User Story:** Como administrador do sistema, eu quero que os logs contenham informações detalhadas de contexto, para que eu consiga identificar rapidamente a causa de problemas sem precisar adivinhar.

#### Critérios de Aceitação

1. WHEN uma requisição HTTP é processada, THE Log_Service SHALL registrar no context_data: o método HTTP, a URL completa, os parâmetros de rota, o status da resposta e o tempo de resposta em milissegundos.
2. WHEN uma operação envolve um ticket, THE Log_Service SHALL incluir no context_data o ticket_id e o ticket_code correspondentes.
3. WHEN uma operação envolve uma chamada a serviço externo (ex: OpenAI, Clicksign, S3), THE Log_Service SHALL incluir no context_data o nome do serviço externo, a duração da chamada em milissegundos e o status da resposta do serviço.
4. WHEN uma operação envolve um usuário autenticado, THE Log_Service SHALL registrar o user_id e o company_id do usuário no Log_Entry.
5. WHEN uma requisição excede 1000ms de tempo de resposta, THE Log_Service SHALL registrar uma Log_Entry com nível "warn" contendo a decomposição do tempo gasto em cada etapa (ex: tempo de query ao banco, tempo de chamada externa, tempo de processamento).

### Requisito 3: Centralização Multi-Servidor

**User Story:** Como administrador do sistema, eu quero que logs de todos os 3 servidores sejam armazenados em um único local, para que eu não precise acessar cada servidor individualmente.

#### Critérios de Aceitação

1. THE Log_Service SHALL incluir o campo server_identifier em cada Log_Entry para identificar o servidor de origem.
2. THE Log_Service SHALL utilizar a mesma tabela `system_logs` no banco de dados PostgreSQL compartilhado para persistir logs de todos os servidores.
3. WHEN o Log_Viewer exibe logs, THE Log_Viewer SHALL permitir filtrar por server_identifier específico ou exibir logs de todos os servidores simultaneamente.
4. THE Log_Service SHALL gerar Trace_IDs compatíveis com o padrão OpenTelemetry para permitir rastreamento de requisições entre servidores.

### Requisito 4: API de Consulta de Logs

**User Story:** Como administrador do sistema, eu quero uma API para consultar logs com filtros avançados, para que eu possa encontrar informações específicas de forma rápida.

#### Critérios de Aceitação

1. THE Log_Service SHALL expor um endpoint GET /api/logs que retorne Log_Entries paginadas com suporte a cursor-based pagination.
2. THE Log_Service SHALL suportar os seguintes filtros na consulta: level, server_identifier, trace_id, company_id, user_id, request_url, date_from, date_to e busca textual na mensagem.
3. THE Log_Service SHALL suportar filtro por campos dentro do context_data usando operadores JSONB do PostgreSQL.
4. WHEN um usuário com role diferente de Super_Admin consulta logs, THE Log_Service SHALL filtrar automaticamente os resultados pelo company_id do usuário autenticado.
5. WHEN um Super_Admin consulta logs, THE Log_Service SHALL permitir visualizar logs de todas as empresas ou filtrar por uma empresa específica via parâmetro.
6. THE Log_Service SHALL retornar os resultados ordenados por created_at em ordem decrescente por padrão.

### Requisito 5: Interface de Visualização de Logs (Log Viewer)

**User Story:** Como administrador do sistema, eu quero uma interface visual para consultar e analisar logs, para que eu não precise escrever queries SQL manualmente.

#### Critérios de Aceitação

1. THE Log_Viewer SHALL exibir uma tabela de logs com as colunas: timestamp, level, server_identifier, message, request_url e response_time_ms.
2. THE Log_Viewer SHALL fornecer filtros visuais para: nível de log, servidor de origem, intervalo de datas, busca textual e tempo de resposta mínimo.
3. WHEN o usuário clica em uma Log_Entry, THE Log_Viewer SHALL exibir um painel de detalhes contendo todos os campos da Log_Entry incluindo o context_data formatado.
4. WHEN o usuário clica em um Trace_ID, THE Log_Viewer SHALL exibir todas as Log_Entries associadas àquele Trace_ID em ordem cronológica, permitindo rastrear o fluxo completo da requisição.
5. THE Log_Viewer SHALL aplicar cores distintas para cada nível de log (debug, info, warn, error, fatal) para facilitar a identificação visual.
6. WHEN o usuário autenticado é um Super_Admin, THE Log_Viewer SHALL exibir um dropdown de seleção de empresa no topo da página, permitindo filtrar logs por empresa ou visualizar todos.
7. THE Log_Viewer SHALL utilizar strings internacionalizadas (pt-BR e en-US) para todos os textos visíveis ao usuário.
8. THE Log_Viewer SHALL implementar scroll infinito ou paginação para carregar logs sob demanda sem sobrecarregar o navegador.

### Requisito 6: Middleware de Logging Automático

**User Story:** Como desenvolvedor, eu quero que o logging aconteça automaticamente para todas as requisições HTTP, para que eu não precise adicionar código de logging manualmente em cada rota.

#### Critérios de Aceitação

1. THE Log_Service SHALL fornecer um middleware Express que registre automaticamente uma Log_Entry para cada requisição HTTP processada.
2. THE Log_Service SHALL extrair automaticamente o user_id e company_id da sessão do usuário autenticado, quando disponível.
3. THE Log_Service SHALL gerar automaticamente um Trace_ID para cada requisição que não possua um no header de entrada.
4. WHEN uma requisição resulta em erro (status >= 400), THE Log_Service SHALL registrar a Log_Entry com nível "error" e incluir o corpo da resposta de erro no context_data.
5. THE Log_Service SHALL registrar o logging de forma assíncrona para não impactar o tempo de resposta das requisições.

### Requisito 7: Logging Programático para Operações Internas

**User Story:** Como desenvolvedor, eu quero uma API simples para registrar logs com contexto rico em qualquer parte do código, para que operações internas (jobs, schedulers, webhooks) também sejam rastreáveis.

#### Critérios de Aceitação

1. THE Log_Service SHALL expor funções auxiliares (log.info, log.warn, log.error, log.debug, log.fatal) que aceitem uma mensagem e um objeto de contexto opcional.
2. THE Log_Service SHALL permitir associar um Trace_ID e Span_ID a logs programáticos para correlacionar com requisições HTTP.
3. WHEN um log programático é registrado sem company_id, THE Log_Service SHALL registrar a Log_Entry com company_id nulo, indicando um log de nível de sistema.
4. THE Log_Service SHALL manter compatibilidade com as chamadas existentes do Winston logger durante o período de migração.

### Requisito 8: Retenção e Manutenção de Logs

**User Story:** Como administrador do sistema, eu quero que logs antigos sejam gerenciados automaticamente, para que o banco de dados não cresça indefinidamente.

#### Critérios de Aceitação

1. THE Log_Service SHALL implementar uma Log_Retention_Policy configurável através da variável de ambiente `LOG_RETENTION_DAYS` no arquivo `.env`.
2. THE Log_Service SHALL executar um job periódico (diário) que remova Log_Entries mais antigas que o número de dias definido em `LOG_RETENTION_DAYS`.
3. WHEN a variável `LOG_RETENTION_DAYS` não estiver definida no `.env`, THE Log_Service SHALL aplicar um período de retenção padrão de 90 dias.
4. IF a remoção de logs falhar, THEN THE Log_Service SHALL registrar o erro e tentar novamente na próxima execução do job.

### Requisito 9: Estatísticas e Dashboard de Logs

**User Story:** Como administrador do sistema, eu quero visualizar estatísticas resumidas dos logs, para que eu tenha uma visão geral da saúde do sistema.

#### Critérios de Aceitação

1. THE Log_Service SHALL expor um endpoint GET /api/logs/stats que retorne: contagem de logs por nível, contagem por servidor, média de tempo de resposta e contagem de erros, filtráveis por intervalo de datas.
2. THE Log_Viewer SHALL exibir cards de resumo no topo da página de logs com: total de logs, total de erros, tempo médio de resposta e requisições lentas (acima de 1000ms) para o período selecionado.
3. WHEN o usuário autenticado é um Super_Admin, THE Log_Service SHALL incluir estatísticas agregadas de todas as empresas ou filtradas pela empresa selecionada.
