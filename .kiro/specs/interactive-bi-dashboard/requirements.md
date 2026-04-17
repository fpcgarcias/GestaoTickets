# Documento de Requisitos — Dashboard Interativo BI

## Introdução

O sistema possui um dashboard funcional com KPIs, gráficos de pizza (por status) e barras (por prioridade), métricas de tempo e lista de chamados recentes. Esta funcionalidade transforma o dashboard estático em um painel interativo estilo BI, adicionando gráficos de tendência temporal, heatmap de volume, ranking de atendentes, taxa de conformidade SLA, opções de agregação dinâmica, drill-down nos gráficos, gráfico de funil de fluxo, métricas de backlog, comparativo entre períodos e exportação de dados. Todas as novas visualizações respeitam multi-tenancy (`company_id`), controle de acesso por role e internacionalização (pt-BR / en-US).

## Glossário

- **Dashboard**: Página principal de métricas do sistema, localizada em `client/src/pages/dashboard.tsx`.
- **API_Dashboard**: Endpoint backend `GET /api/tickets/dashboard-metrics` responsável por fornecer dados ao Dashboard.
- **Ticket**: Chamado de suporte registrado na tabela `tickets`.
- **Atendente**: Usuário com role `support`, `manager` ou `supervisor` vinculado a departamentos. Representado pela tabela `officials`.
- **SLA_Definition**: Definição de tempos de resposta e resolução por prioridade, na tabela `sla_definitions`.
- **Gráfico_Tendência**: Line chart que exibe a evolução de chamados ao longo do tempo (dia/semana/mês).
- **Heatmap_Volume**: Visualização em grade que mostra o volume de abertura de chamados por dia da semana e hora do dia.
- **Ranking_Atendentes**: Tabela/gráfico que classifica atendentes por volume resolvido e tempo médio de resposta.
- **Taxa_SLA**: Percentual de chamados resolvidos dentro do prazo definido pelo SLA.
- **Agregação_Dinâmica**: Capacidade do usuário de escolher como agrupar os dados nos gráficos (por departamento, atendente, tipo de chamado, categoria).
- **Drill_Down**: Interação onde o usuário clica em um segmento de gráfico para ver os chamados detalhados daquele segmento.
- **Gráfico_Funil**: Visualização que mostra o fluxo de chamados entre os status: Novos → Em Andamento → Resolvidos → Encerrados.
- **Métricas_Backlog**: Indicadores de chamados problemáticos: abertos há mais de X dias, sem atendente, ou parados sem atualização.
- **Comparativo_Períodos**: Visualização lado a lado ou overlay comparando métricas do período atual com o período anterior.
- **Exportação_Dados**: Funcionalidade de download dos dados do dashboard em formato CSV ou Excel.
- **Recharts**: Biblioteca de gráficos React utilizada pelo sistema (v2.15.3).
- **Filtros_Existentes**: Filtros já implementados no dashboard: período, departamento, tipo de chamado, categoria, atendente.

## Requisitos

### Requisito 1: Gráfico de Tendência Temporal

**User Story:** Como gestor, eu quero visualizar a evolução de chamados ao longo do tempo em um line chart, para que eu possa identificar tendências de aumento ou redução de demanda.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um Gráfico_Tendência com a contagem de chamados agrupados por intervalo de tempo no eixo X e quantidade no eixo Y.
2. THE Gráfico_Tendência SHALL oferecer ao usuário a opção de selecionar a granularidade do eixo X entre "dia", "semana" e "mês".
3. WHEN o usuário seleciona a opção de agrupar por status, THE Gráfico_Tendência SHALL exibir uma linha separada para cada status de chamado (Novo, Em Andamento, Resolvido, Encerrado).
4. WHEN o usuário seleciona a opção de agrupar por prioridade, THE Gráfico_Tendência SHALL exibir uma linha separada para cada nível de prioridade (Baixa, Média, Alta, Crítica).
5. THE Gráfico_Tendência SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard (período, departamento, tipo de chamado, categoria, atendente).
6. THE API_Dashboard SHALL retornar os dados de tendência temporal agrupados conforme a granularidade e o agrupamento solicitados, filtrados pelo `company_id` do usuário autenticado.
7. WHEN não existem dados para o período selecionado, THE Gráfico_Tendência SHALL exibir uma mensagem informativa de ausência de dados.

### Requisito 2: Heatmap de Volume por Dia e Hora

**User Story:** Como gestor, eu quero visualizar um heatmap mostrando os horários e dias da semana com maior volume de abertura de chamados, para que eu possa planejar a alocação de equipe.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um Heatmap_Volume com os dias da semana (segunda a domingo) no eixo Y e as horas do dia (0h a 23h) no eixo X.
2. THE Heatmap_Volume SHALL representar o volume de chamados abertos em cada célula utilizando uma escala de cores gradiente, onde cores mais intensas indicam maior volume.
3. THE Heatmap_Volume SHALL exibir o valor numérico de chamados ao passar o cursor sobre cada célula (tooltip).
4. THE Heatmap_Volume SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
5. THE API_Dashboard SHALL retornar os dados de volume agrupados por dia da semana e hora, filtrados pelo `company_id` do usuário autenticado.

### Requisito 3: Ranking de Atendentes

**User Story:** Como gestor, eu quero visualizar um ranking dos atendentes por volume de chamados resolvidos e tempo médio de resposta, para que eu possa avaliar a performance da equipe.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um Ranking_Atendentes com a lista dos atendentes ordenados por volume de chamados resolvidos no período selecionado.
2. THE Ranking_Atendentes SHALL exibir para cada atendente: nome, quantidade de chamados resolvidos, tempo médio de primeira resposta e tempo médio de resolução.
3. THE Ranking_Atendentes SHALL permitir ao usuário alternar a ordenação entre "volume resolvido", "tempo médio de resposta" e "tempo médio de resolução".
4. THE Ranking_Atendentes SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
5. WHEN o usuário possui role `customer`, THE Dashboard SHALL ocultar o Ranking_Atendentes.
6. THE API_Dashboard SHALL retornar os dados de ranking filtrados pelo `company_id` do usuário autenticado e respeitando as restrições de visibilidade por role.
7. WHEN o usuário possui role `support`, THE Ranking_Atendentes SHALL exibir apenas os dados do próprio atendente.

### Requisito 4: Taxa de Conformidade SLA

**User Story:** Como gestor, eu quero visualizar a taxa de chamados resolvidos dentro do prazo de SLA, para que eu possa monitorar o cumprimento dos acordos de nível de serviço.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um card de Taxa_SLA com o percentual de chamados resolvidos dentro do prazo definido pela SLA_Definition correspondente à prioridade do chamado.
2. THE Taxa_SLA SHALL calcular o percentual considerando apenas chamados que possuem status "resolved" ou "closed" no período selecionado.
3. THE Taxa_SLA SHALL exibir uma indicação visual de conformidade: cor verde para taxa igual ou superior a 90%, cor amarela para taxa entre 70% e 89%, e cor vermelha para taxa inferior a 70%.
4. THE Taxa_SLA SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
5. THE API_Dashboard SHALL calcular a taxa de SLA comparando o tempo entre `created_at` e `resolved_at` de cada chamado com o `resolution_time_hours` da SLA_Definition correspondente, filtrado pelo `company_id` do usuário autenticado.
6. WHEN não existem definições de SLA configuradas para a empresa, THE Dashboard SHALL exibir uma mensagem informando que o SLA não está configurado.
7. WHEN o usuário possui role `customer`, THE Dashboard SHALL ocultar o card de Taxa_SLA.

### Requisito 5: Opções de Agregação Dinâmica

**User Story:** Como gestor, eu quero escolher como agrupar os dados dos gráficos existentes (por departamento, atendente, tipo de chamado ou categoria), para que eu possa analisar os dados sob diferentes perspectivas.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um seletor de Agregação_Dinâmica que permita ao usuário escolher o critério de agrupamento entre: "por status" (padrão), "por departamento", "por atendente", "por tipo de chamado" e "por categoria".
2. WHEN o usuário seleciona um critério de agrupamento, THE Dashboard SHALL atualizar o gráfico de pizza e o gráfico de barras para refletir o agrupamento selecionado.
3. THE Agregação_Dinâmica SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
4. THE API_Dashboard SHALL retornar os dados agrupados conforme o critério solicitado, filtrados pelo `company_id` do usuário autenticado.
5. WHEN o usuário possui role `customer`, THE Dashboard SHALL limitar as opções de agregação a "por status" e "por prioridade".

### Requisito 6: Drill-Down nos Gráficos

**User Story:** Como gestor, eu quero clicar em um segmento de gráfico e ver os chamados detalhados daquele segmento, para que eu possa investigar os dados em profundidade.

#### Critérios de Aceitação

1. WHEN o usuário clica em um segmento do gráfico de pizza (por status), THE Dashboard SHALL exibir um painel ou modal com a lista de chamados correspondentes àquele status.
2. WHEN o usuário clica em uma barra do gráfico de barras (por prioridade), THE Dashboard SHALL exibir um painel ou modal com a lista de chamados correspondentes àquela prioridade.
3. THE lista de chamados exibida no Drill_Down SHALL conter: ID do chamado, título, status, prioridade, data de criação e atendente responsável.
4. THE Drill_Down SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard e o `company_id` do usuário autenticado.
5. THE lista de chamados no Drill_Down SHALL permitir ao usuário clicar em um chamado para navegar diretamente à página de detalhes do chamado.
6. WHEN o Drill_Down retorna mais de 20 chamados, THE Dashboard SHALL paginar os resultados exibindo 20 chamados por página.

### Requisito 7: Gráfico de Funil de Fluxo

**User Story:** Como gestor, eu quero visualizar o fluxo de chamados entre os status em formato de funil, para que eu possa identificar gargalos no processo de atendimento.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um Gráfico_Funil que represente a quantidade de chamados em cada etapa do fluxo: Novos → Em Andamento → Resolvidos → Encerrados.
2. THE Gráfico_Funil SHALL exibir a quantidade absoluta e o percentual de conversão entre cada etapa.
3. THE Gráfico_Funil SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
4. THE API_Dashboard SHALL retornar as contagens por status para o Gráfico_Funil, filtradas pelo `company_id` do usuário autenticado.
5. WHEN não existem dados para o período selecionado, THE Gráfico_Funil SHALL exibir uma mensagem informativa de ausência de dados.

### Requisito 8: Métricas de Backlog

**User Story:** Como gestor, eu quero visualizar indicadores de chamados problemáticos (abertos há muito tempo, sem atendente, parados), para que eu possa priorizar ações corretivas.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir cards de Métricas_Backlog com três indicadores: chamados abertos há mais de 7 dias, chamados sem atendente atribuído e chamados sem atualização há mais de 3 dias.
2. THE Métricas_Backlog SHALL considerar apenas chamados com status "new" ou "ongoing" (não resolvidos e não encerrados).
3. WHEN o usuário clica em um card de Métricas_Backlog, THE Dashboard SHALL exibir a lista de chamados correspondentes àquele indicador.
4. THE Métricas_Backlog SHALL respeitar os filtros de departamento e atendente aplicados no Dashboard.
5. THE API_Dashboard SHALL calcular as métricas de backlog com base na data atual, filtradas pelo `company_id` do usuário autenticado.
6. WHEN o usuário possui role `customer`, THE Dashboard SHALL ocultar as Métricas_Backlog.
7. WHEN o usuário possui role `support`, THE Métricas_Backlog SHALL exibir apenas os chamados atribuídos ao próprio atendente.

### Requisito 9: Comparativo entre Períodos

**User Story:** Como gestor, eu quero comparar as métricas do período atual com o período anterior, para que eu possa avaliar a evolução do desempenho.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um Comparativo_Períodos que mostre as métricas principais (total de chamados, resolvidos, tempo médio de resposta, tempo médio de resolução) do período atual lado a lado com o período anterior.
2. THE Comparativo_Períodos SHALL calcular o período anterior automaticamente com a mesma duração do período selecionado (ex: se o período atual é "este mês", o anterior é "mês passado").
3. THE Comparativo_Períodos SHALL exibir a variação percentual entre os dois períodos com indicação visual (seta para cima/baixo e cor verde/vermelha conforme a métrica).
4. THE Comparativo_Períodos SHALL respeitar todos os Filtros_Existentes aplicados no Dashboard.
5. THE API_Dashboard SHALL retornar os dados do período anterior junto com os dados do período atual, filtrados pelo `company_id` do usuário autenticado.

### Requisito 10: Exportação de Dados

**User Story:** Como gestor, eu quero exportar os dados do dashboard em formato CSV ou Excel, para que eu possa realizar análises externas ou compartilhar relatórios.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir um botão de Exportação_Dados que permita ao usuário escolher entre os formatos CSV e XLSX (Excel).
2. WHEN o usuário clica no botão de exportação e seleciona um formato, THE Dashboard SHALL gerar e iniciar o download de um arquivo contendo os dados visíveis no dashboard.
3. THE arquivo exportado SHALL conter as métricas de KPIs, dados dos gráficos e lista de chamados recentes, respeitando os Filtros_Existentes aplicados.
4. THE Exportação_Dados SHALL respeitar o `company_id` do usuário autenticado, exportando apenas dados da empresa do usuário.
5. WHEN o usuário possui role `customer`, THE Dashboard SHALL ocultar o botão de Exportação_Dados.
6. THE arquivo exportado SHALL utilizar os labels no idioma ativo do usuário (pt-BR ou en-US).
7. IF a geração do arquivo falhar, THEN THE Dashboard SHALL exibir uma mensagem de erro informativa ao usuário.

### Requisito 11: Internacionalização das Novas Visualizações

**User Story:** Como usuário do sistema, eu quero que todos os textos das novas visualizações do dashboard estejam disponíveis em português (pt-BR) e inglês (en-US), para manter a consistência do sistema bilíngue.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir todos os títulos, labels, tooltips, mensagens de estado vazio e opções de seleção das novas visualizações utilizando chaves de internacionalização nos arquivos `pt-BR.json` e `en-US.json`.
2. THE Gráfico_Tendência SHALL exibir os nomes dos meses, dias da semana e labels de granularidade no idioma ativo do usuário.
3. THE Heatmap_Volume SHALL exibir os nomes dos dias da semana no idioma ativo do usuário.
4. THE Exportação_Dados SHALL utilizar headers de colunas no idioma ativo do usuário no arquivo exportado.

### Requisito 12: Controle de Acesso e Multi-Tenancy

**User Story:** Como administrador, eu quero que todas as novas visualizações respeitem o controle de acesso por role e o isolamento de dados por empresa, para garantir a segurança dos dados.

#### Critérios de Aceitação

1. THE API_Dashboard SHALL filtrar todos os dados das novas visualizações pelo `company_id` do usuário autenticado.
2. WHEN o usuário possui role `super_admin`, THE Dashboard SHALL exibir um dropdown de seleção de empresa, permitindo visualizar os dados de qualquer empresa.
3. WHEN o usuário possui role `customer`, THE Dashboard SHALL ocultar as visualizações de Ranking_Atendentes, Taxa_SLA, Métricas_Backlog e Exportação_Dados.
4. WHEN o usuário possui role `support`, THE Dashboard SHALL restringir os dados de Ranking_Atendentes e Métricas_Backlog aos chamados do próprio atendente.
5. WHEN o usuário possui role `manager` ou `supervisor`, THE Dashboard SHALL restringir os dados aos departamentos vinculados ao usuário.
6. THE API_Dashboard SHALL validar as permissões de acesso no backend, independentemente das restrições aplicadas no frontend.

### Requisito 13: Performance e Responsividade

**User Story:** Como usuário do sistema, eu quero que o dashboard carregue de forma eficiente e se adapte a diferentes tamanhos de tela, para que eu tenha uma boa experiência de uso.

#### Critérios de Aceitação

1. THE API_Dashboard SHALL retornar os dados de todas as novas visualizações em uma única requisição ou em requisições paralelas que completem em até 3 segundos para volumes de até 10.000 chamados.
2. THE Dashboard SHALL exibir skeleton loaders durante o carregamento dos dados de cada nova visualização.
3. THE Dashboard SHALL organizar as novas visualizações em um layout responsivo que se adapte a telas de desktop (1280px+), tablet (768px-1279px) e mobile (abaixo de 768px).
4. THE Dashboard SHALL utilizar a biblioteca Recharts para todas as novas visualizações gráficas, mantendo consistência com os gráficos existentes.
