# Documento de Requisitos: Correção de Erros TypeScript (Lint/Type Check)

## Introdução

O projeto possui 221 erros de TypeScript identificados pelo `tsc` (comando `npm run check`), distribuídos entre server (173) e client (48). A maioria dos erros concentra-se em `server/storage.ts` (114 erros) e está relacionada a inconsistência de nomenclatura entre o schema Drizzle ORM (snake_case) e o código de implementação (camelCase). Este documento define os requisitos para corrigir todos os erros de forma organizada, segura e sem introduzir regressões.

## Glossário

- **Sistema_TypeCheck**: O compilador TypeScript (`tsc`) executado via `npm run check`
- **Schema_Drizzle**: As definições de tabelas e tipos em `shared/schema.ts` usando Drizzle ORM
- **MemStorage**: A classe `MemStorage` em `server/storage.ts` que implementa a interface `IStorage`
- **Camada_Mapeamento**: Código que converte entre a convenção de nomes do banco (snake_case) e o código de aplicação
- **Hook_Inventário**: Os hooks React em `client/src/hooks/useInventoryApi.ts` e páginas de inventário
- **ESLint**: Ferramenta de análise estática de código JavaScript/TypeScript para prevenção de erros

## Requisitos

### Requisito 1: Correção de Nomenclatura de Propriedades no MemStorage

**User Story:** Como desenvolvedor, quero que o `MemStorage` use os mesmos nomes de propriedade definidos no Schema Drizzle (snake_case), para que o código compile sem erros TS2551/TS2561.

#### Critérios de Aceitação

1. WHEN o Sistema_TypeCheck analisa `server/storage.ts`, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2551 (propriedade com nome incorreto)
2. WHEN o Sistema_TypeCheck analisa `server/storage.ts`, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2561 (propriedade não esperada no objeto)
3. WHEN o MemStorage cria objetos do tipo User, Customer, Official, Ticket, TicketReply ou TicketStatusHistory, THE MemStorage SHALL usar os nomes de propriedade exatamente como definidos no Schema_Drizzle (snake_case: `created_at`, `updated_at`, `avatar_url`, `company_id`, `ticket_id`, `customer_id`, `assigned_to_id`, `user_id`, `is_internal`, `is_active`, `department_id`, `first_response_at`, `resolved_at`, `sla_breached`)
4. WHEN o MemStorage acessa propriedades de objetos tipados pelo Schema_Drizzle, THE MemStorage SHALL usar os nomes snake_case consistentes com a definição do schema

### Requisito 2: Correção de Propriedades Inexistentes no Tipo (TS2339)

**User Story:** Como desenvolvedor, quero que todos os acessos a propriedades de objetos tipados referenciem campos que realmente existem no tipo, para que o código compile sem erros TS2339.

#### Critérios de Aceitação

1. WHEN o Sistema_TypeCheck analisa os arquivos do server, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2339 relacionados a propriedades inexistentes
2. WHEN o Sistema_TypeCheck analisa os arquivos do client, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2339 relacionados a propriedades inexistentes
3. WHEN hooks de inventário retornam dados paginados, THE Hook_Inventário SHALL tipar corretamente a resposta incluindo campos `.data` e `.pagination` quando aplicável
4. WHEN rotas do server acessam campos como `.is_active`, `.notes`, `.description` em objetos tipados, THE Camada_Mapeamento SHALL garantir que esses campos existam nas interfaces correspondentes

### Requisito 3: Correção de Incompatibilidade de Tipos (TS2345/TS2322)

**User Story:** Como desenvolvedor, quero que todos os argumentos e atribuições usem tipos compatíveis, para que o código compile sem erros TS2345 e TS2322.

#### Critérios de Aceitação

1. WHEN uma função recebe um parâmetro do tipo `SupportedLocale`, THE Camada_Mapeamento SHALL garantir que o valor passado seja do tipo `SupportedLocale` e não `string` genérico
2. WHEN uma função espera um parâmetro do tipo `Date`, THE Camada_Mapeamento SHALL garantir que valores `string | Date` sejam convertidos para `Date` antes da chamada
3. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2345 (argumento com tipo inválido)
4. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2322 (atribuição com tipo incompatível)

### Requisito 4: Eliminação de `any` Implícito (TS7006/TS7005/TS7034)

**User Story:** Como desenvolvedor, quero que todos os parâmetros e variáveis tenham tipos explícitos, para que o código compile sem erros TS7006, TS7005 e TS7034.

#### Critérios de Aceitação

1. WHEN callbacks de `reduce`, `map`, `filter` ou `forEach` são usados, THE Sistema_TypeCheck SHALL encontrar tipos explícitos em todos os parâmetros dessas callbacks
2. WHEN variáveis auxiliares como arrays são declaradas, THE Sistema_TypeCheck SHALL encontrar tipos explícitos nessas declarações
3. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS7006, TS7005 e TS7034

### Requisito 5: Correção de Overload Inválido do TanStack Query (TS2769)

**User Story:** Como desenvolvedor, quero que os hooks do TanStack Query usem a API correta da versão instalada (v5), para que o código compile sem erros TS2769.

#### Critérios de Aceitação

1. WHEN hooks `useQuery` usam a opção `keepPreviousData`, THE Hook_Inventário SHALL substituir por `placeholderData: keepPreviousData` conforme a API do TanStack Query v5
2. WHEN o Sistema_TypeCheck analisa os arquivos do client, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2769 relacionados a overload inválido

### Requisito 6: Correção de Imports Faltantes e Símbolos Não Encontrados (TS2304/TS2552)

**User Story:** Como desenvolvedor, quero que todos os símbolos referenciados no código estejam corretamente importados, para que o código compile sem erros TS2304 e TS2552.

#### Critérios de Aceitação

1. WHEN `client/src/pages/reports/clients.tsx` usa `format` e `ptBR`, THE Sistema_TypeCheck SHALL encontrar os imports corretos de `date-fns` e `date-fns/locale`
2. WHEN qualquer arquivo referencia um símbolo externo, THE Sistema_TypeCheck SHALL encontrar o import correspondente
3. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2304 e TS2552

### Requisito 7: Declaração de Tipos para Módulos Externos (TS7016)

**User Story:** Como desenvolvedor, quero que todos os módulos externos tenham declarações de tipo, para que o código compile sem erros TS7016.

#### Critérios de Aceitação

1. WHEN o módulo `qrcode` é importado, THE Sistema_TypeCheck SHALL encontrar uma declaração de tipos (via `@types/qrcode` ou arquivo `.d.ts` local)
2. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS7016

### Requisito 8: Tratamento de Valores Possivelmente Undefined (TS18048)

**User Story:** Como desenvolvedor, quero que todos os acessos a valores possivelmente undefined tenham guard clauses, para que o código compile sem erros TS18048.

#### Critérios de Aceitação

1. WHEN código acessa `nfeData.products` ou propriedades similares que podem ser undefined, THE Camada_Mapeamento SHALL incluir verificação de existência antes do acesso
2. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS18048

### Requisito 9: Correção de Incompatibilidade Estrutural (TS2740/TS2352/TS7053)

**User Story:** Como desenvolvedor, quero que conversões entre tipos Drizzle e tipos de domínio sejam feitas com funções de transformação tipadas, para que o código compile sem erros TS2740, TS2352 e TS7053.

#### Critérios de Aceitação

1. WHEN retornos de queries Drizzle são convertidos para tipos de domínio, THE Camada_Mapeamento SHALL usar funções de transformação tipadas ao invés de casts diretos
2. WHEN objetos são indexados dinamicamente, THE Camada_Mapeamento SHALL usar index signatures ou type assertions seguras
3. WHEN o Sistema_TypeCheck analisa todos os arquivos do projeto, THE Sistema_TypeCheck SHALL reportar zero erros do tipo TS2740, TS2352 e TS7053

### Requisito 10: Configuração de ESLint para Prevenção de Reincidência

**User Story:** Como desenvolvedor, quero que o projeto tenha ESLint configurado com script `lint` no package.json, para que novos erros de tipo sejam detectados antes de chegarem ao type check.

#### Critérios de Aceitação

1. THE Sistema_TypeCheck SHALL compilar o projeto inteiro com zero erros ao executar `npm run check`
2. WHEN o comando `npm run lint` é executado, THE ESLint SHALL analisar os arquivos TypeScript do projeto e reportar violações de regras configuradas
3. WHEN o script `lint` é adicionado ao `package.json`, THE ESLint SHALL estar configurado com regras mínimas para TypeScript (incluindo `@typescript-eslint/no-explicit-any` como warning)
