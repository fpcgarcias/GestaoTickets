# Documento de Requisitos — Correções do Scan Estático

## Introdução

Este documento especifica os requisitos para corrigir os 12 achados identificados no relatório de análise estática do sistema GestãoTickets. Os achados estão organizados por severidade (Crítico, Alto, Médio, Baixo) e cada requisito mapeia diretamente para um ou mais achados do relatório.

## Glossário

- **Scheduler**: Serviço agendador (`SchedulerService`) que executa tarefas periódicas como verificação de tickets e geração de digests.
- **Digest**: Resumo periódico (diário ou semanal) enviado por e-mail aos participantes de tickets.
- **Ciclo_WC**: Período contínuo em que um ticket permanece no status `waiting_customer`, delimitado pela última transição para esse status.
- **Alert_Sent_At**: Campo `waiting_customer_alert_sent_at` que registra quando o alerta de 48h foi enviado ao cliente.
- **Company_Filter**: Variável de ambiente `SCHEDULER_COMPANY_FILTER` que controla quais empresas são processadas pelo scheduler.
- **Parse_Company_Filter**: Função utilitária que interpreta o formato do `Company_Filter` (incluindo `*`, `<>id`, lista de IDs).
- **Priority_Service**: Serviço (`PriorityService`) responsável pelo CRUD de prioridades de departamento.
- **CSV_Parser**: Componente que importa configurações de SLA a partir de dados CSV.
- **Janela_Horario**: Intervalo de horas em que o scheduler pode executar tarefas (entre 06h e 21h).
- **CSPRNG**: Gerador de números pseudoaleatórios criptograficamente seguro (`crypto.randomBytes`).
- **Super_Admin**: Role `admin` / `super_admin` com acesso total ao sistema, incluindo dados de todas as empresas.

## Requisitos

### Requisito 1: Reset do ciclo de alerta em `waiting_customer` (Crítico — Achado #1)

**User Story:** Como atendente de suporte, quero que o sistema respeite o ciclo correto de alertas ao reentrar em `waiting_customer`, para que tickets não sejam encerrados indevidamente.

#### Critérios de Aceitação

1. WHEN um ticket transiciona para o status `waiting_customer`, THE Scheduler SHALL tratar o campo Alert_Sent_At como nulo se o valor existente for anterior à data de entrada no Ciclo_WC atual.
2. WHEN um ticket transiciona para o status `waiting_customer`, THE Sistema SHALL definir o campo Alert_Sent_At como nulo para iniciar um novo Ciclo_WC.
3. WHEN uma resposta do cliente é registrada em um ticket com status `waiting_customer`, THE Sistema SHALL definir o campo Alert_Sent_At como nulo.
4. WHEN o Scheduler avalia um ticket em `waiting_customer` cujo Alert_Sent_At é anterior ao `entered_at` do Ciclo_WC atual, THE Scheduler SHALL ignorar o Alert_Sent_At e tratar como se nenhum alerta tivesse sido enviado neste ciclo.
5. IF o Alert_Sent_At pertence ao Ciclo_WC atual e a diferença entre o momento atual e o Alert_Sent_At for menor que 24 horas, THEN THE Scheduler SHALL aguardar sem encerrar o ticket.

### Requisito 2: Parse consistente do filtro de empresas no scheduler (Crítico — Achado #2)

**User Story:** Como administrador do sistema, quero que o filtro de empresas do scheduler funcione de forma consistente em todas as tarefas, para que digests e verificações processem o conjunto correto de empresas.

#### Critérios de Aceitação

1. THE Scheduler SHALL utilizar a função Parse_Company_Filter para interpretar o Company_Filter em todas as tarefas (checks de tickets, digest diário e digest semanal).
2. WHEN o Company_Filter contém o formato `<>id`, THE Parse_Company_Filter SHALL excluir a empresa com o ID especificado e incluir todas as demais.
3. WHEN o Company_Filter contém uma lista separada por vírgulas, THE Parse_Company_Filter SHALL incluir apenas as empresas cujos IDs estão na lista.
4. WHEN o Company_Filter é `*` ou vazio, THE Parse_Company_Filter SHALL incluir todas as empresas.
5. IF o Company_Filter contém valores que não podem ser convertidos em IDs numéricos válidos, THEN THE Parse_Company_Filter SHALL ignorar esses valores e registrar um aviso no log.

### Requisito 3: Correção do lookup de prioridades para role admin (Crítico — Achado #3)

**User Story:** Como Super_Admin, quero conseguir atualizar e deletar prioridades de qualquer empresa, para que eu possa gerenciar o sistema de prioridades de forma confiável.

#### Critérios de Aceitação

1. WHEN um Super_Admin solicita atualização de uma prioridade, THE Sistema SHALL buscar a prioridade diretamente pelo ID do registro, sem filtrar por `company_id`.
2. WHEN um Super_Admin solicita exclusão de uma prioridade, THE Sistema SHALL buscar a prioridade diretamente pelo ID do registro, sem filtrar por `company_id`.
3. WHEN um usuário não-admin solicita atualização ou exclusão de uma prioridade, THE Sistema SHALL verificar que o `company_id` da prioridade corresponde ao `company_id` do usuário antes de permitir a operação.
4. IF a prioridade solicitada não existir no banco de dados, THEN THE Sistema SHALL retornar erro 404 com mensagem descritiva.

### Requisito 4: Consistência do comportamento de fallback de prioridades (Alto — Achado #4)

**User Story:** Como desenvolvedor, quero que o comportamento de fallback de prioridades seja consistente entre o serviço, o utilitário compartilhado e os testes, para evitar divergências e bugs em runtime.

#### Critérios de Aceitação

1. THE Priority_Service SHALL retornar `source: 'none'` e uma lista vazia quando não existirem prioridades customizadas para um departamento.
2. THE utilitário `priority-utils.ts` SHALL retornar `source: 'none'` e uma lista vazia quando não existirem prioridades customizadas, de forma consistente com o Priority_Service.
3. THE utilitário `priority-fallback.ts` SHALL ser removido ou atualizado para refletir o comportamento real do sistema (lista vazia, `source: 'none'`).
4. WHEN o sistema não encontra prioridades customizadas, THE Sistema SHALL retornar uma estrutura com `isDefault: true` e `source: 'none'` em todos os pontos de acesso.

### Requisito 5: Remoção de debug logging excessivo em produção (Alto — Achado #5)

**User Story:** Como administrador de infraestrutura, quero que logs de debug não poluam o ambiente de produção, para evitar overhead de performance e risco de vazamento de dados operacionais.

#### Critérios de Aceitação

1. THE Sistema SHALL remover ou proteger com verificação de nível de log todas as chamadas `console.log` de debug em `shared/utils/priority-utils.ts`.
2. THE Sistema SHALL remover ou proteger com verificação de nível de log todas as chamadas `console.log` de debug em `server/services/priority-service.ts`.
3. WHILE o ambiente estiver em modo de produção (`NODE_ENV === 'production'`), THE Sistema SHALL suprimir logs de debug que contenham identificadores de tenant, department IDs ou detalhes operacionais.

### Requisito 6: Parser CSV robusto para importação de SLA (Alto — Achado #6)

**User Story:** Como administrador de empresa, quero que a importação CSV de configurações de SLA processe corretamente arquivos com campos entre aspas, vírgulas internas e diferentes finais de linha, para que as configurações sejam importadas sem corrupção.

#### Critérios de Aceitação

1. WHEN um arquivo CSV contém campos entre aspas com vírgulas internas, THE CSV_Parser SHALL preservar o campo completo sem dividir nas vírgulas internas.
2. WHEN um arquivo CSV utiliza finais de linha `\r\n` (CRLF), THE CSV_Parser SHALL normalizar para `\n` antes do processamento.
3. WHEN um arquivo CSV contém campos com aspas escapadas (`""`), THE CSV_Parser SHALL interpretar corretamente como uma aspa literal.
4. THE CSV_Parser SHALL utilizar uma biblioteca de parsing CSV estabelecida em vez de split manual por vírgula.
5. THE CSV_Parser SHALL realizar verificações de duplicidade em lote em vez de consultas individuais por linha (padrão N+1).

### Requisito 7: Remoção de log de payload sensível no endpoint de SLA (Alto — Achado #7)

**User Story:** Como administrador de segurança, quero que payloads completos não sejam logados em produção nos endpoints de SLA, para evitar vazamento de dados sensíveis nos logs.

#### Critérios de Aceitação

1. THE endpoint de criação de SLA SHALL remover o `console.log` que registra o payload completo (`JSON.stringify(input)`).
2. WHILE o ambiente estiver em modo de produção, THE Sistema SHALL registrar apenas metadados não-sensíveis (como `departmentId` e `companyId`) em nível de log apropriado.

### Requisito 8: Remoção do `@ts-nocheck` em `storage.ts` (Médio — Achado #8)

**User Story:** Como desenvolvedor, quero que o arquivo `storage.ts` tenha verificação de tipos habilitada, para que erros de tipagem sejam detectados em tempo de compilação.

#### Critérios de Aceitação

1. THE arquivo `server/storage.ts` SHALL ser compilado sem a diretiva `// @ts-nocheck`.
2. WHEN a diretiva `@ts-nocheck` for removida, THE Sistema SHALL corrigir todos os erros de tipagem resultantes, incluindo a importação de `ticketPriorityEnum` se o enum estiver removido do schema.
3. IF o `MemStorage` não for utilizado em código de produção, THEN THE Sistema SHALL mover a classe para um módulo exclusivo de testes.

### Requisito 9: Consolidação de APIs de prioridades duplicadas (Médio — Achado #9)

**User Story:** Como desenvolvedor, quero que exista uma única fonte de verdade para as APIs de prioridades, para reduzir confusão de rotas e risco de manutenção incorreta.

#### Critérios de Aceitação

1. THE Sistema SHALL consolidar as funções `getDepartmentPriorities` e `createDefaultPriorities` que existem em ambos `server/api/priorities.ts` e `server/api/department-priorities.ts` em um único módulo.
2. WHEN a consolidação for realizada, THE Sistema SHALL atualizar todas as referências e registros de rotas para apontar para o módulo consolidado.
3. THE Sistema SHALL remover ou depreciar explicitamente o módulo redundante após a consolidação.

### Requisito 10: Geração segura de tokens de pesquisa de satisfação (Médio — Achado #10)

**User Story:** Como administrador de segurança, quero que os tokens de pesquisa de satisfação sejam gerados com um CSPRNG, para que não possam ser adivinhados por atacantes.

#### Critérios de Aceitação

1. THE Sistema SHALL gerar tokens de pesquisa de satisfação utilizando `crypto.randomBytes()` em vez de `Math.random()`.
2. THE Sistema SHALL codificar os tokens gerados em formato hex ou base64url.
3. WHEN um token é gerado, THE Sistema SHALL produzir um valor com entropia mínima de 128 bits (16 bytes).

### Requisito 11: Janela de horário consistente no scheduler (Médio — Achado #11)

**User Story:** Como administrador do sistema, quero que as regras de janela de horário do scheduler sejam consistentes entre todas as tarefas, para que o comportamento seja previsível e explicável.

#### Critérios de Aceitação

1. THE Scheduler SHALL utilizar uma única função helper `isWithinAllowedWindow()` para determinar se uma tarefa pode ser executada.
2. THE função `isWithinAllowedWindow()` SHALL definir a janela permitida como das 06:01 às 20:59 (inclusive), aplicada igualmente a checks de tickets e digests.
3. WHEN o horário atual estiver fora da Janela_Horario, THE Scheduler SHALL pular a execução de todas as tarefas de forma consistente.

### Requisito 12: Remoção de lógica morta no scheduler (Baixo — Achado #12)

**User Story:** Como desenvolvedor, quero que código não utilizado seja removido do scheduler, para reduzir overhead de manutenção e risco de inconsistência.

#### Critérios de Aceitação

1. THE Scheduler SHALL utilizar a função `parseCompanyFilter` existente em todas as tarefas que processam o Company_Filter (incluindo digests), eliminando a lógica duplicada de parse.
2. IF após a consolidação do Requisito 2 ainda existir código morto no scheduler, THEN THE Sistema SHALL remover esse código.
