# Plano de Implementação: Dashboard Interativo BI

## Visão Geral

Implementação incremental do dashboard BI interativo, começando pela camada de dados compartilhada (tipos + função de filtros), seguida pelos endpoints backend, componentes frontend e integração final. Cada tarefa constrói sobre as anteriores, garantindo que não haja código órfão.

## Tasks

- [x] 1. Tipos compartilhados e função de filtros base
  - [x] 1.1 Criar arquivo `shared/types/dashboard.ts` com todas as interfaces e tipos compartilhados
    - `TrendSeries`, `HeatmapCell`, `AgentRankingEntry`, `SlaComplianceData`, `BacklogMetrics`, `DrillDownTicket`, `DrillDownResponse`, `PeriodMetrics`, `DashboardFilters`, `AggregationType`, `DashboardExportData`
    - _Requisitos: 1.6, 2.5, 3.6, 4.5, 5.4, 6.4, 7.4, 8.5, 10.3_

  - [x] 1.2 Implementar `buildDashboardWhereClause` em `server/database-storage.ts`
    - Extrair a lógica de filtros por role/company_id já existente em `getTicketsForDashboardByUserRole` para uma função reutilizável
    - Aceitar parâmetros: `userId`, `userRole`, `options` (officialId, startDate, endDate, departmentId, incidentTypeId, categoryId, dateField)
    - Retornar array de cláusulas WHERE do Drizzle ORM
    - _Requisitos: 12.1, 12.4, 12.5, 12.6_

  - [ ]* 1.3 Escrever teste de propriedade para `buildDashboardWhereClause`
    - **Propriedade 5: Consistência da agregação dinâmica** — verificar que a soma dos grupos é igual ao total de tickets
    - **Valida: Requisitos 5.2, 5.4**

- [x] 2. Endpoints backend — Tendência e Heatmap
  - [x] 2.1 Implementar `GET /api/tickets/dashboard-trend` em `server/routes/dashboard.ts`
    - Aceitar query params: `start_date`, `end_date`, `granularity` (day/week/month), `group_by` (status/priority), filtros existentes
    - Validar parâmetros (granularity, datas, group_by)
    - Usar `buildDashboardWhereClause` para filtros de segurança
    - SQL com `date_trunc` para agrupamento temporal
    - Retornar `{ series: TrendSeries[] }`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Escrever teste de propriedade para agregação de tendência
    - **Propriedade 1: Integridade dos dados de tendência temporal** — soma das contagens por período = total de tickets, datas alinhadas à granularidade, número de séries = valores distintos do critério
    - **Valida: Requisitos 1.3, 1.4, 1.6**

  - [x] 2.3 Implementar `GET /api/tickets/dashboard-heatmap` em `server/routes/dashboard.ts`
    - Aceitar query params: `start_date`, `end_date`, filtros existentes
    - SQL com `EXTRACT(DOW)` e `EXTRACT(HOUR)` para agrupamento
    - Usar `buildDashboardWhereClause` para filtros de segurança
    - Retornar `{ data: HeatmapCell[] }`
    - _Requisitos: 2.1, 2.4, 2.5_

  - [ ]* 2.4 Escrever teste de propriedade para agregação do heatmap
    - **Propriedade 2: Validade da agregação do heatmap** — day_of_week ∈ [0,6], hour ∈ [0,23], soma = total tickets, sem duplicatas (day, hour)
    - **Valida: Requisitos 2.5**

- [x] 3. Endpoints backend — Ranking, SLA e Backlog
  - [x] 3.1 Implementar `GET /api/tickets/dashboard-ranking` em `server/routes/dashboard.ts`
    - Aceitar query params: `start_date`, `end_date`, `sort_by` (resolved_count/avg_first_response/avg_resolution), filtros existentes
    - SQL com JOIN em `officials`, agregações de COUNT e AVG
    - Usar `buildDashboardWhereClause` para filtros de segurança
    - Ocultar para role `customer`; restringir para role `support` ao próprio atendente
    - Retornar `{ ranking: AgentRankingEntry[] }`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 3.2 Escrever teste de propriedade para ranking de atendentes
    - **Propriedade 3: Integridade e ordenação do ranking** — campos obrigatórios presentes, lista ordenada pelo critério, resolved_count = contagem real
    - **Valida: Requisitos 3.1, 3.2, 3.3**

  - [x] 3.3 Implementar `GET /api/tickets/dashboard-sla` em `server/routes/dashboard.ts`
    - Aceitar query params: `start_date`, `end_date`, filtros existentes
    - SQL com JOIN em `sla_definitions`, comparar tempo de resolução com `resolution_time_hours`
    - Considerar apenas tickets com status `resolved` ou `closed`
    - Retornar `{ total_resolved, within_sla, compliance_rate, has_sla_config }`
    - Ocultar para role `customer`
    - _Requisitos: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_

  - [ ]* 3.4 Escrever teste de propriedade para taxa de SLA
    - **Propriedade 4: Cálculo da taxa de conformidade SLA** — compliance_rate = (within_sla / total_resolved) * 100, apenas tickets resolved/closed contabilizados
    - **Valida: Requisitos 4.1, 4.2, 4.5**

  - [x] 3.5 Implementar `GET /api/tickets/dashboard-backlog` em `server/routes/dashboard.ts`
    - Aceitar query params: `department_id`, `official_id`
    - Três queries: abertos >7 dias, sem atendente, sem atualização >3 dias
    - Considerar apenas tickets com status `new` ou `ongoing`
    - Usar `buildDashboardWhereClause` para filtros de segurança
    - Ocultar para role `customer`; restringir para role `support` ao próprio atendente
    - Retornar `{ open_over_7_days, unassigned, stale_over_3_days }`
    - _Requisitos: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.6 Escrever teste de propriedade para backlog
    - **Propriedade 7: Corretude do cálculo de backlog** — apenas tickets new/ongoing, created_at < 7 dias, assigned_to_id null, updated_at < 3 dias
    - **Valida: Requisitos 8.2, 8.5**

- [x] 4. Endpoint backend — Drill-down
  - [x] 4.1 Implementar `GET /api/tickets/dashboard-drilldown` em `server/routes/dashboard.ts`
    - Aceitar query params: `type` (status/priority/department/official/incident_type/category/backlog_type), `value`, `page`, `page_size`, filtros existentes + `start_date`, `end_date`
    - Validar `type` e `value`, `page` e `page_size` (máx 100)
    - Usar `buildDashboardWhereClause` para filtros de segurança
    - Retornar `{ tickets: DrillDownTicket[], total, page, page_size }`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 5. Checkpoint — Validar endpoints backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Componentes frontend — Gráficos de Tendência e Heatmap
  - [x] 6.1 Criar componente `TrendChart` em `client/src/components/charts/trend-chart.tsx`
    - Line chart com recharts (`LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`)
    - Seletores de granularidade (dia/semana/mês) e agrupamento (nenhum/status/prioridade)
    - Múltiplas linhas coloridas por série (status ou prioridade)
    - Estado vazio com mensagem i18n, skeleton loader
    - Suporte a onClick para drill-down
    - Todos os textos via `useI18n()` com chaves em `pt-BR.json` e `en-US.json`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.7, 11.2, 13.2, 13.4_

  - [x] 6.2 Criar componente `HeatmapChart` em `client/src/components/charts/heatmap-chart.tsx`
    - Grid SVG customizado ou recharts com escala de cores gradiente
    - Eixo Y: dias da semana (seg-dom), Eixo X: horas (0h-23h)
    - Tooltip com contagem ao hover
    - Estado vazio, skeleton loader
    - Nomes dos dias da semana via i18n
    - _Requisitos: 2.1, 2.2, 2.3, 11.3, 13.2, 13.4_

- [x] 7. Componentes frontend — Ranking, SLA e Funil
  - [x] 7.1 Criar componente `AgentRankingTable` em `client/src/components/charts/agent-ranking-table.tsx`
    - Tabela com colunas: nome, resolvidos, tempo médio resposta, tempo médio resolução
    - Ordenação alternável entre as 3 métricas
    - Estado vazio, skeleton loader
    - Todos os textos via i18n
    - _Requisitos: 3.1, 3.2, 3.3, 13.2_

  - [x] 7.2 Criar componente `SlaComplianceCard` em `client/src/components/charts/sla-compliance-card.tsx`
    - Card com indicador visual (gauge ou barra de progresso)
    - Cores: verde ≥90%, amarelo 70-89%, vermelho <70%
    - Exibir total resolvidos, dentro do SLA, percentual
    - Mensagem quando SLA não configurado (`has_sla_config: false`)
    - _Requisitos: 4.1, 4.2, 4.3, 4.6, 13.2_

  - [x] 7.3 Criar componente `FunnelChart` em `client/src/components/charts/funnel-chart.tsx`
    - Funil com 4 etapas: Novos → Em Andamento → Resolvidos → Encerrados
    - Exibir quantidade absoluta e percentual de conversão entre etapas
    - Estado vazio, skeleton loader
    - _Requisitos: 7.1, 7.2, 7.5, 13.4_

  - [ ]* 7.4 Escrever teste de propriedade para conversão do funil
    - **Propriedade 6: Cálculo das taxas de conversão do funil** — taxa = (próxima_etapa / etapa_atual) * 100, 0% quando etapa_atual = 0
    - **Valida: Requisitos 7.2**

- [x] 8. Componentes frontend — Backlog, Comparativo e Agregação
  - [x] 8.1 Criar componente `BacklogMetricsCards` em `client/src/components/charts/backlog-metrics-cards.tsx`
    - 3 cards: abertos >7 dias, sem atendente, sem atualização >3 dias
    - Cards clicáveis (onClick para drill-down)
    - Estado vazio, skeleton loader
    - _Requisitos: 8.1, 8.3, 13.2_

  - [x] 8.2 Criar componente `PeriodComparison` em `client/src/components/charts/period-comparison.tsx`
    - Seção comparativa: total chamados, resolvidos, tempo médio resposta, tempo médio resolução
    - Reutilizar `ComparisonArrow` existente para variação percentual
    - Calcular período anterior automaticamente (mesma duração)
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 8.3 Escrever teste de propriedade para cálculo do período anterior
    - **Propriedade 8: Cálculo do período anterior** — duração igual, prevEndDate imediatamente anterior a startDate
    - **Valida: Requisitos 9.2**

  - [x] 8.4 Criar componente `AggregationSelector` em `client/src/components/charts/aggregation-selector.tsx`
    - Seletor com opções: por status (padrão), por prioridade, por departamento, por atendente, por tipo de chamado, por categoria
    - Limitar opções para role `customer` (apenas status e prioridade)
    - _Requisitos: 5.1, 5.2, 5.5_

- [x] 9. Componentes frontend — Drill-down e Exportação
  - [x] 9.1 Criar componente `DrillDownModal` em `client/src/components/charts/drill-down-modal.tsx`
    - Modal/Sheet com lista paginada de tickets (20 por página)
    - Colunas: ID, título, status, prioridade, data criação, atendente
    - Link para página de detalhes do chamado ao clicar
    - Estado vazio, skeleton loader
    - _Requisitos: 6.1, 6.2, 6.3, 6.5, 6.6_

  - [x] 9.2 Criar componente `ExportButton` em `client/src/components/charts/export-button.tsx`
    - Botão com dropdown: CSV e XLSX (Excel)
    - Exportação client-side usando biblioteca `xlsx`
    - Incluir KPIs, dados de gráficos, chamados recentes
    - Headers no idioma ativo do usuário
    - Ocultar para role `customer`
    - Tratar erro com toast informativo
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 9.3 Escrever teste de propriedade para round-trip da exportação CSV
    - **Propriedade 9: Round-trip da exportação de dados** — exportar para CSV e parsear de volta deve conter todas as métricas e chamados originais
    - **Valida: Requisitos 10.2, 10.3**

- [x] 10. Checkpoint — Validar componentes frontend isolados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integração no Dashboard
  - [x] 11.1 Adicionar queries TanStack Query no `dashboard.tsx` para os novos endpoints
    - Queries paralelas para: trend, heatmap, ranking, sla, backlog
    - Usar `useBusinessHoursRefetchInterval` para refetch dinâmico
    - Respeitar `isDateRangeReady` para queries com período
    - Reutilizar `getQueryParamsWithPeriod()` existente
    - _Requisitos: 13.1_

  - [x] 11.2 Integrar novos componentes no layout do `dashboard.tsx`
    - Adicionar seção SLA + Comparativo (2 colunas)
    - Adicionar seção Backlog (3 cards)
    - Adicionar Gráfico de Tendência (full width)
    - Adicionar AggregationSelector nos gráficos de pizza e barras existentes
    - Adicionar Funil + Heatmap (2 colunas)
    - Adicionar Ranking de Atendentes (full width)
    - Adicionar botão de Exportação no header
    - Controle de visibilidade por role (ocultar ranking/SLA/backlog/export para customer)
    - Layout responsivo: desktop 2 colunas, tablet 2 colunas, mobile 1 coluna
    - _Requisitos: 5.2, 12.3, 12.4, 12.5, 13.3_

  - [x] 11.3 Integrar DrillDownModal com todos os gráficos clicáveis
    - Conectar onClick do gráfico de pizza, barras, funil, backlog cards ao DrillDownModal
    - Passar filtros ativos e tipo/valor do segmento clicado
    - _Requisitos: 6.1, 6.2, 6.4, 8.3_

- [x] 12. Internacionalização
  - [x] 12.1 Adicionar todas as chaves i18n em `client/src/i18n/messages/pt-BR.json` e `client/src/i18n/messages/en-US.json`
    - Títulos, labels, tooltips, mensagens de estado vazio, opções de seleção de todos os novos componentes
    - Nomes dos dias da semana, meses, labels de granularidade
    - Headers de exportação
    - Mensagens de erro
    - _Requisitos: 11.1, 11.2, 11.3, 11.4_

- [x] 13. Controle de acesso e super_admin
  - [x] 13.1 Implementar verificações de role no frontend para todos os novos componentes
    - `customer`: ocultar Ranking, SLA, Backlog, Exportação; limitar agregação a status/prioridade
    - `support`: restringir Ranking e Backlog aos próprios dados
    - `super_admin`: adicionar dropdown de seleção de empresa no dashboard (se não existir)
    - _Requisitos: 12.2, 12.3, 12.4, 12.5_

  - [x] 13.2 Validar permissões de acesso no backend em todos os novos endpoints
    - Verificar role e company_id em cada endpoint
    - Retornar 403 para acessos não autorizados
    - Garantir que filtros de segurança são aplicados independentemente do frontend
    - _Requisitos: 12.1, 12.6_

- [ ] 14. Checkpoint final — Validação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude (fast-check já instalado)
- Testes unitários validam exemplos específicos e edge cases
- A biblioteca `xlsx` precisará ser instalada para a funcionalidade de exportação
