# Relatorio de Lint - 2026-02-13

## Contexto
- Ambiente de desenvolvimento: Windows (PowerShell)
- Ambiente de producao: Linux
- Objetivo: listar erros de lint/static check atuais, com sugestoes de correcao e impactos

## Comandos executados (Windows)
```powershell
npm run lint
npm run check
```

## Resultado rapido
- `npm run lint`: falhou porque o script `lint` nao existe no `package.json`.
- Configuracao ESLint no codigo do projeto (fora de `node_modules`): nao encontrada.
- `npm run check` (`tsc`): **221 erros**.

## Distribuicao dos erros
### Por area
| Area | Qtde |
|---|---:|
| `server` | 173 |
| `client` | 48 |

### Por codigo TypeScript
| Codigo | Qtde | Leitura pratica |
|---|---:|---|
| `TS2551` | 78 | propriedade com nome incorreto (geralmente camelCase vs snake_case) |
| `TS2339` | 47 | propriedade nao existe no tipo |
| `TS2561` | 29 | objeto com propriedade nao esperada |
| `TS2345` | 22 | argumento com tipo invalido |
| `TS2322` | 10 | atribuicao com tipo incompativel |
| `TS7006` | 8 | parametro com `any` implicito |
| `TS2769` | 6 | overload invalido (assinatura nao bate) |
| `TS2304` | 5 | nome nao encontrado (import/falta de simbolo) |
| `TS7053` | 4 | indexacao sem index signature |
| `TS2552` | 2 | nome nao encontrado (sugestao de nome incorreta) |
| `TS7016` | 2 | falta declaracao de tipos para modulo |
| `TS18048` | 2 | valor possivelmente `undefined` |
| `TS2740` | 2 | tipo nao contem membros exigidos |
| `TS7005` | 2 | variavel com `any[]` implicito |
| `TS7034` | 1 | variavel inferida como `any[]` em parte dos fluxos |
| `TS2352` | 1 | type assertion potencialmente incorreta |

## Arquivos mais afetados
| Arquivo | Qtde |
|---|---:|
| `server/storage.ts` | 114 |
| `server/routes/service-providers.ts` | 9 |
| `client/src/pages/inventory/catalog.tsx` | 8 |
| `server/routes/ticket-service-providers.ts` | 7 |
| `client/src/pages/inventory/suppliers.tsx` | 6 |
| `client/src/pages/inventory/assignments.tsx` | 6 |
| `client/src/pages/inventory/product-types.tsx` | 5 |
| `server/routes/department-service-providers.ts` | 5 |
| `client/src/pages/inventory/movements.tsx` | 5 |
| `client/src/pages/reports/clients.tsx` | 4 |

## Erros encontrados, sugestao de correcao e impacto
### 1) `TS2551` / `TS2561` (nome de propriedade inconsistente)
- Exemplos: `updatedAt` vs `updated_at`, `ticketId` vs `ticket_id`, `avatarUrl` vs `avatar_url`.
- Sugestao:
  - Padronizar contratos de dados entre schema/ORM/API/UI.
  - Escolher um padrao unico na camada de dominio (ex.: snake_case no banco e mapeamento explicito para camelCase na borda da API).
  - Criar mappers tipados para conversao, evitando acesso direto a campos crus.
- Impacto:
  - Alto risco de bug funcional (dados nao persistem/leem corretamente).
  - Quebra de build/CI.

### 2) `TS2339` (propriedade inexistente no tipo)
- Exemplos: acesso a `.data`, `.pagination`, `.is_active`, `.notes` em tipos sem esses campos.
- Sugestao:
  - Corrigir tipagem de retorno de hooks/servicos.
  - Ajustar interfaces para refletir payload real.
  - Evitar `{} as any` e garantir tipo de `useQuery`/respostas.
- Impacto:
  - Alto: risco de erro em runtime ao acessar campos indefinidos.

### 3) `TS2345` / `TS2322` (mismatch de tipos)
- Exemplos: `string` enviado onde se espera `SupportedLocale`; `string | Date` onde se espera `Date`.
- Sugestao:
  - Validar/normalizar tipos antes da chamada.
  - Usar guards (`if`, `instanceof`, predicates) e narrowings.
  - Tipar corretamente respostas e estados intermediarios.
- Impacto:
  - Medio/alto: comportamento incorreto em formatacao, locale, datas e filtros.

### 4) `TS7006` / `TS7005` / `TS7034` (uso de `any` implicito)
- Exemplos: parametros de callback e arrays auxiliares sem tipo.
- Sugestao:
  - Declarar tipos explicitos em callbacks (`reduce`, `map`, `filter`).
  - Tipar variaveis auxiliares (`const keysToSearch: string[] = [...]`).
- Impacto:
  - Medio: perda de seguranca de tipo e regressao silenciosa.

### 5) `TS2769` (overload invalido)
- Exemplo recorrente: `keepPreviousData` em `useQuery`.
- Sugestao:
  - Revisar API da versao atual do TanStack Query.
  - Substituir por padrao compativel (ex.: `placeholderData: keepPreviousData` quando aplicavel) e ajustar generics.
- Impacto:
  - Alto: quebra de compilacao e comportamento inconsistente de cache/paginacao.

### 6) `TS2304` / `TS2552` (simbolo nao encontrado)
- Exemplos: `format` e `ptBR` em `client/src/pages/reports/clients.tsx`.
- Sugestao:
  - Corrigir imports faltantes.
  - Validar se simbolos vieram da lib correta (`date-fns`, locale etc.).
- Impacto:
  - Alto: pagina/fluxo nao compila.

### 7) `TS7016` (sem declaracao de tipos para modulo)
- Exemplo: modulo `qrcode`.
- Sugestao:
  - Instalar `@types` correspondente, quando existir.
  - Se nao existir, criar `*.d.ts` local minimo.
- Impacto:
  - Medio: reduz seguranca de tipos e pode mascarar erros.

### 8) `TS18048` (possivelmente `undefined`)
- Exemplo: `nfeData.products` possivelmente indefinido.
- Sugestao:
  - Guard clauses e fallback (`if (!nfeData.products) return ...`).
  - Ajustar contrato para obrigatorio quando regra de negocio exigir.
- Impacto:
  - Medio/alto: risco de excecao em runtime.

### 9) `TS2740` / `TS2352` (incompatibilidade estrutural complexa)
- Contexto: tipos de retorno Drizzle/queries e conversao para entidades de dominio.
- Sugestao:
  - Reduzir cast direto e usar funcoes de transformacao tipadas.
  - Garantir que campos obrigatorios do tipo final existam antes do retorno.
- Impacto:
  - Alto: risco de dados inconsistentes na camada de dominio.

## Impactos especificos Windows (dev) x Linux (producao)
- Como o build TypeScript ja falha no dev, a pipeline pode bloquear deploy em Linux imediatamente.
- Mesmo quando compilar localmente com ajustes parciais, divergencias de contrato podem gerar falhas de runtime iguais em Linux.
- Recomendacao: manter checagem tipada estrita no CI Linux para evitar diferencas de ambiente passarem despercebidas.

## Priorizacao recomendada
1. Resolver `server/storage.ts` (maior concentracao: 114 erros).
2. Corrigir padrao de nomenclatura de campos (`snake_case` x `camelCase`) em camada de mapeamento.
3. Corrigir hooks e retornos de inventario no `client` (`TS2339`, `TS2769`).
4. Corrigir imports faltantes e tipagem de datas/locales.
5. Reintroduzir script `lint` e configurar ESLint para prevenir reincidencia.

## Status final
- Erros listados e classificados com sugestoes de correcao e impacto.
- Arquivo gerado: `docs/RELATORIO_LINT_2026-02-13.md`.
