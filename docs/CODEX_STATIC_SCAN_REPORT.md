# Relatorio de Varredura Estatica (Sem Runtime) - GestaoTickets

Data: 2026-02-09  
Escopo: leitura estatica do codigo (sem build, sem testes, sem lint).  
Nota de seguranca: eu nao usei `rg` (no seu ambiente, `C:\WINDOWS\RG.cmd` abre o regedit); tudo abaixo veio de leitura direta de arquivos e PowerShell `Select-String`.

## Achados (Priorizados)

### Critico

1. **Auto-close em `waiting_customer` pode encerrar tickets imediatamente num novo ciclo (valor "velho" em `waiting_customer_alert_sent_at`)**
   - Onde: `server/services/email-notification-service.ts:3827`, `server/services/email-notification-service.ts:3829`, `server/services/email-notification-service.ts:3839`
   - O que acontece:
     - O job define o inicio do "ciclo" atual como o ultimo `entered_at` (ultima mudanca de status para `waiting_customer`).
     - Mas ele **nao** reseta nem re-escopa `tickets.waiting_customer_alert_sent_at` para esse mesmo ciclo.
     - Se um ticket teve alerta num ciclo antigo e depois voltou para `waiting_customer`, o `waiting_customer_alert_sent_at` antigo pode fazer o job pular o alerta de 48h e ir direto para fechamento (porque `now - alert_sent_at >= 24h` vai ser verdadeiro).
   - Impacto:
     - Tickets podem ser encerrados indevidamente, sem respeitar 48h/72h apos reentrar em `waiting_customer`.
     - Experiencia de suporte/cliente e metricas de SLA ficam erradas; alem de gerar fechamentos "aleatorios" dificeis de debugar.
   - Como corrigir (resumo):
     - Tratar `alert_sent_at` como **pertencente ao ciclo**: se `alert_sent_at` existe mas `alert_sent_at < entered_at`, ignorar para este ciclo (tratar como `null`).
     - Alem disso (recomendado), zerar `waiting_customer_alert_sent_at = null` quando:
       - o status muda **para** `waiting_customer` (novo ciclo), e/ou
       - uma resposta do cliente e criada (como descrito em `.cursor/plans/automacao-aguardando-cliente.md`).

2. **Digest do scheduler ignora os formatos documentados de `SCHEDULER_COMPANY_FILTER` (quebra `<>id` e casos nao-lista)**
   - Onde: `server/services/scheduler-service.ts:136`, `server/services/scheduler-service.ts:156`
   - O que acontece:
     - `generateDailyDigest()` / `generateWeeklyDigest()` parseiam a env var apenas com `split(',')` + `parseInt`.
     - Formatos como `<>3` (documentados em `SCHEDULER_CONFIG.md`) viram `NaN`, e isso acaba sendo passado para `generateDailyDigestForParticipants(companyId)` / `generateWeeklyDigestForParticipants(companyId)`.
   - Impacto:
     - Digests podem ser gerados para o conjunto errado de empresas (ou para nenhuma), e voce pode ter duplicacao entre ambientes mesmo configurando `SCHEDULER_COMPANY_FILTER` conforme a doc.
   - Como corrigir (resumo):
     - Centralizar o parse do filtro e reutilizar a mesma logica em tudo (ou reutilizar `parseCompanyFilter()` no `SchedulerService`, ou expor um helper compartilhado).
     - Fazer o digest aceitar o mesmo formato de `companyFilter` que os outros checks do scheduler (ou expandir corretamente para uma lista de company ids).

3. **Admin nao consegue atualizar/deletar prioridades por causa de `companyIdToSearch = 0`**
   - Onde: `server/api/department-priorities.ts:262`, `server/api/department-priorities.ts:373`
   - O que acontece:
     - Para `admin`, o codigo seta `companyIdToSearch = 0` e chama `getAllCompanyPriorities(0)`, que consulta `department_priorities.company_id = 0` (provavelmente nao existe).
     - O lookup de `existingPriority` falha e o admin recebe 404 mesmo com prioridades validas.
   - Impacto:
     - Role `admin` nao consegue gerenciar prioridades de forma confiavel (fluxos de update/delete quebram).
   - Como corrigir (resumo):
     - Buscar a prioridade diretamente por `id` (uma query), e entao aplicar a regra de permissao usando o `company_id` do registro.
     - Se mantiver o padrao "carregar tudo e dar find", nao force `company_id=0` para admin.

### Alto

4. **Comportamento de fallback de prioridades esta inconsistente entre codigo e utilitario de teste**
   - Onde:
     - `server/utils/priority-fallback.ts:29` (espera `source === 'default'` e 4 prioridades padrao)
     - `shared/utils/priority-utils.ts:86` (retorna lista vazia e `source: 'none'`)
     - `server/services/priority-service.ts:130` (retorna lista vazia no legado/sem prioridades)
   - Impacto:
     - Expectativas internas divergem: qualquer codigo que suponha "defaults existem" vai quebrar, e o utilitario de teste atual esta incompatível com o comportamento real.
   - Como corrigir (resumo):
     - Definir o comportamento desejado do produto:
       - Se defaults devem existir automaticamente: implementar de forma consistente (`source: 'default'`, retornar 4 prioridades).
       - Se defaults *nao* devem existir automaticamente: ajustar/remover `server/utils/priority-fallback.ts` e qualquer doc/teste que espere defaults.

5. **Debug logging excessivo em caminho de producao (prioridades)**
   - Onde:
     - `shared/utils/priority-utils.ts:50` (varios `console.log`)
     - `server/services/priority-service.ts:34` (varios `console.log`)
   - Impacto:
     - Poluicao de logs e overhead de performance.
     - Risco de vazamento de identificadores de tenant/empresa, department ids e detalhes operacionais nos logs.
   - Como corrigir (resumo):
     - Substituir por logger estruturado + niveis; proteger logs de debug com `NODE_ENV !== 'production'` ou uma env flag dedicada.

6. **Importacao CSV de SLA e um parser simplista e pode corromper importacoes**
   - Onde: `server/api/sla-configurations.ts:628`
   - O que acontece:
     - Faz split de linhas por `\n` e colunas por `,` sem lidar com campos com aspas, virgulas dentro de aspas, `\r\n` ou escapes.
     - Faz checagem de duplicidade linha-a-linha via chamadas de servico (estilo N+1).
   - Impacto:
     - CSV valido pode ser interpretado errado, gerando configuracoes de SLA incorretas ou falsos erros/duplicidades.
     - Importacoes grandes podem ficar lentas e pesadas para o banco.
   - Como corrigir (resumo):
     - Usar um parser de CSV de verdade (streaming se necessario) e normalizar CRLF.
     - Fazer consultas em lote para existentes e inserts em lote quando possivel.

7. **Endpoint de create de SLA loga o payload inteiro (risco de dados sensiveis em logs)**
   - Onde: `server/api/sla-configurations.ts:186`
   - Impacto:
     - Payloads podem conter campos operacionais/sensiveis; logs viram vetor de vazamento.
   - Como corrigir (resumo):
     - Remover em producao, ou mascarar campos; manter apenas em nivel debug.

### Medio

8. **`// @ts-nocheck` em storage esconde erros de tipagem e drift**
   - Onde: `server/storage.ts:1`
   - Observacoes:
     - O arquivo importa `ticketPriorityEnum` mesmo com o enum de prioridade comentado/removido em `shared/schema.ts`.
   - Impacto:
     - Type safety desligado em um modulo central, aumentando risco de bug em runtime.
   - Como corrigir (resumo):
     - Remover `@ts-nocheck`, ajustar tipos, e considerar mover `MemStorage` para um modulo somente de teste.

9. **APIs de prioridades duplicadas/sobrepostas (risco de confusao de rotas)**
   - Onde:
     - `server/api/priorities.ts` (tem `getDepartmentPriorities`, `createDefaultPriorities`)
     - `server/api/department-priorities.ts` (CRUD completo de prioridades)
   - Impacto:
     - Duas "fontes de verdade" com nomes parecidos aumentam o risco de registrar/manter o handler errado.
   - Como corrigir (resumo):
     - Consolidar em um unico modulo; remover ou depreciar explicitamente o outro.

10. **Geracao de token de pesquisa de satisfacao usa `Math.random()`**
   - Onde: `server/services/email-notification-service.ts:3862`
   - Impacto:
     - Tokens sao mais faceis de adivinhar do que um CSPRNG; se o token for a unica barreira de um endpoint publico de pesquisa, isso vira risco de seguranca.
   - Como corrigir (resumo):
     - Usar `crypto.randomBytes(…)` (Node) e codificar como hex/base64url; manter timestamp so se for necessario para debug.

11. **Regras de janela de horario do scheduler sao inconsistentes entre checks e digests**
   - Onde:
     - Checks de tickets: `server/services/scheduler-service.ts` (permite 21:00..21:59, bloqueia 06:00 exato)
     - Digests: `server/services/scheduler-service.ts` (bloqueia `hour >= 21`)
   - Impacto:
     - Comportamento dificil de explicar em bordas ("por que isso rodou e aquilo nao").
   - Como corrigir (resumo):
     - Definir um helper unico de "janela permitida" e reutilizar em todas as tarefas.

### Baixo

12. **Logica morta/nao usada no scheduler**
   - Onde: `server/services/scheduler-service.ts` (`parseCompanyFilter` existe mas nao e usado nos digests)
   - Impacto:
     - Overhead de manutencao e maior chance de comportamento inconsistente entre tarefas.
   - Como corrigir (resumo):
     - Ou usar em tudo, ou remover.

## Observacoes (Nao-bugs)

- `client/public/version.json` está em UTF-8 válido (sem BOM) e lê corretamente quando decodificado explicitamente como UTF-8. Se você ver "ImplementaÃ§Ã£o" (ou seja, "Implementação" exibido errado) em algum lugar, isso tende a ser mismatch de encoding do terminal/output, não do conteúdo do arquivo.
