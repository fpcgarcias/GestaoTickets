# Plano de Implementação: Correção de Erros de Lint

## Visão Geral

Correção dos 1577 problemas de lint (774 erros + 803 warnings) em 5 fases incrementais, começando pela configuração do ESLint e terminando com zero erros e zero warnings.

## Tasks

- [x] 1. Fase 1 — Corrigir configuração do ESLint
  - [x] 1.1 Instalar dependências necessárias
    - Instalar `globals` e `eslint-plugin-react-hooks` como devDependencies
    - Verificar compatibilidade com ESLint 10 e typescript-eslint 8.55 antes de instalar
    - _Requisitos: 1.1, 1.2, 1.3_

  - [x] 1.2 Reestruturar `eslint.config.js` com configurações por diretório
    - Adicionar globals de browser para `client/src/**/*.{ts,tsx}`
    - Adicionar globals de Node.js para `server/**/*.{ts,tsx}` e `shared/**/*.{ts,tsx}`
    - Configurar plugin `react-hooks` com regras recomendadas para arquivos do client
    - Configurar `no-unused-vars` com `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, `caughtErrorsIgnorePattern: '^_'`
    - Manter `no-explicit-any` como `warn` temporariamente (será alterado para `error` na Fase 4)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Validar configuração
    - Rodar `npm run lint` e confirmar que erros de `no-undef` (9) foram eliminados pela adição de globals
    - Confirmar que o ESLint carrega sem erros de configuração
    - _Requisitos: 5.1_

- [x] 2. Fase 2 — Executar auto-fix para erros triviais
  - [x] 2.1 Rodar `eslint --fix` nos diretórios do projeto
    - Executar `npx eslint client/src server shared --fix`
    - Isso deve corrigir automaticamente: ~52 `prefer-const`, ~130 `no-extra-non-null-assertion`, 1 `prefer-as-const`
    - _Requisitos: 2.1, 2.2, 2.3_

  - [x] 2.2 Validar resultado do auto-fix
    - Rodar `npm run lint` e confirmar redução de ~183 erros
    - Rodar `npm run test` para garantir que nenhuma regressão foi introduzida
    - _Requisitos: 2.4_

- [x] 3. Checkpoint — Validar Fases 1 e 2
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Fase 3 — Corrigir `no-unused-vars` (525 erros)
  - [x] 4.1 Corrigir `no-unused-vars` em `shared/`
    - Remover imports não utilizados
    - Remover variáveis não utilizadas
    - Prefixar parâmetros posicionais não utilizados com `_`
    - _Requisitos: 3.3_

  - [x] 4.2 Corrigir `no-unused-vars` em `server/`
    - Remover imports não utilizados
    - Prefixar parâmetros de middleware não utilizados com `_` (ex: `_req`, `_res`, `_next`)
    - Remover variáveis locais não utilizadas
    - Processar arquivo por arquivo, começando pelos que têm mais erros
    - _Requisitos: 3.2, 3.5_

  - [x] 4.3 Corrigir `no-unused-vars` em `client/src/lib/` e `client/src/utils/`
    - Remover imports não utilizados
    - Remover variáveis e funções não utilizadas
    - _Requisitos: 3.1_

  - [x] 4.4 Corrigir `no-unused-vars` em `client/src/hooks/`
    - Remover imports não utilizados
    - Remover variáveis de desestruturação não utilizadas
    - _Requisitos: 3.1_

  - [x] 4.5 Corrigir `no-unused-vars` em `client/src/components/`
    - Remover imports não utilizados
    - Remover props e variáveis não utilizadas
    - Processar subdiretório por subdiretório
    - _Requisitos: 3.1_

  - [x] 4.6 Corrigir `no-unused-vars` em `client/src/pages/`
    - Remover imports não utilizados
    - Remover variáveis de estado e desestruturação não utilizadas
    - Processar página por página
    - _Requisitos: 3.1_

  - [ ] 4.7 Corrigir `no-unused-vars` em `client/src/contexts/` e `client/src/services/`
    - Remover imports e variáveis não utilizadas nos diretórios restantes
    - _Requisitos: 3.1_

- [ ] 5. Checkpoint — Validar Fase 3
  - Rodar `npm run lint` e confirmar zero erros de `no-unused-vars`
  - Rodar `npm run test` para garantir que nenhuma regressão foi introduzida
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Fase 4 — Tipar `no-explicit-any` (803 warnings)
  - [ ] 6.1 Tipar `any` em `shared/`
    - Substituir `any` por tipos específicos em `shared/schema.ts`, `shared/utils.ts`, `shared/ticket-utils.ts`
    - Usar tipos existentes do Drizzle ORM e interfaces do projeto
    - _Requisitos: 4.2, 4.3_

  - [ ] 6.2 Tipar `any` em `server/types/`
    - Substituir `any` por tipos específicos nas definições de tipos do servidor
    - _Requisitos: 4.3_

  - [ ] 6.3 Tipar `any` em `server/` (arquivos raiz e middleware)
    - Substituir `any` em `server/routes.ts`, `server/storage.ts`, `server/database-storage.ts`, `server/db.ts`
    - Substituir `any` em `server/middleware/`
    - Usar tipos do Express (`Request`, `Response`, `NextFunction`) e Drizzle
    - Para casos complexos, usar `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- [justificativa]`
    - _Requisitos: 4.3, 4.4_

  - [ ] 6.4 Tipar `any` em `server/services/`, `server/routes/`, `server/endpoints/` e `server/api/`
    - Substituir `any` por tipos específicos
    - Usar tipos de bibliotecas (@types/*) quando disponíveis
    - _Requisitos: 4.3, 4.4_

  - [ ] 6.5 Tipar `any` em `client/src/lib/` e `client/src/utils/`
    - Substituir `any` por tipos específicos nos utilitários do frontend
    - _Requisitos: 4.2_

  - [ ] 6.6 Tipar `any` em `client/src/hooks/`
    - Substituir `any` por tipos específicos nos hooks customizados
    - Usar tipos do React e TanStack Query
    - _Requisitos: 4.2_

  - [ ] 6.7 Tipar `any` em `client/src/contexts/` e `client/src/services/`
    - Substituir `any` por tipos específicos nos contexts e services
    - _Requisitos: 4.2_

  - [ ] 6.8 Tipar `any` em `client/src/components/`
    - Substituir `any` por tipos específicos nos componentes React
    - Usar tipos de props, event handlers do React, e tipos de bibliotecas (Radix, recharts, etc.)
    - Processar subdiretório por subdiretório
    - _Requisitos: 4.2, 4.4_

  - [ ] 6.9 Tipar `any` em `client/src/pages/`
    - Substituir `any` por tipos específicos nas páginas
    - Processar página por página
    - _Requisitos: 4.2, 4.4_

  - [ ] 6.10 Alterar `no-explicit-any` de `warn` para `error` no `eslint.config.js`
    - Após todas as correções de `any`, alterar a regra para `error`
    - Confirmar que não há novos warnings/erros
    - _Requisitos: 4.1_

- [ ] 7. Checkpoint — Validar Fase 4
  - Rodar `npm run lint` e confirmar zero warnings de `no-explicit-any`
  - Rodar `npm run test` para garantir que nenhuma regressão foi introduzida
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Fase 5 — Corrigir erros menores restantes (~22 erros)
  - [ ] 8.1 Corrigir `no-useless-assignment` (8 erros)
    - Remover atribuições sem efeito ou reestruturar lógica
    - _Requisitos: 5.2_

  - [ ] 8.2 Corrigir `ban-ts-comment` (7 erros)
    - Substituir `@ts-ignore` por `@ts-expect-error` com justificativa descritiva
    - _Requisitos: 5.3_

  - [ ] 8.3 Corrigir `no-empty` (4 erros)
    - Adicionar comentário `// intentionally empty` ou implementar lógica adequada
    - _Requisitos: 5.3_

  - [ ] 8.4 Corrigir `no-empty-object-type` (3 erros)
    - Substituir `{}` por `Record<string, never>` ou tipo específico
    - _Requisitos: 5.3_

  - [ ] 8.5 Corrigir `no-unused-expressions` (3 erros)
    - Converter para statements válidos ou remover código morto
    - _Requisitos: 5.3_

  - [ ] 8.6 Corrigir erros pontuais restantes (6 erros)
    - `no-useless-catch` (2): remover try/catch desnecessário ou adicionar lógica
    - `no-non-null-asserted-optional-chain` (2): remover `!` após `?.` e tratar null
    - `no-require-imports` (2): converter `require()` para `import`
    - _Requisitos: 5.2, 5.3, 5.5_

  - [ ] 8.7 Corrigir erros unitários restantes (4 erros)
    - `react-hooks/exhaustive-deps` (1): adicionar dependências faltantes ao array
    - `no-self-assign` (1): remover auto-atribuição
    - `no-case-declarations` (1): envolver case em bloco `{}`
    - `no-namespace` (1): converter namespace para module ou desabilitar pontualmente
    - `no-useless-escape` (1): remover escape desnecessário
    - _Requisitos: 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Checkpoint Final — Validar lint limpo
  - Rodar `npm run lint` e confirmar zero erros e zero warnings
  - Rodar `npm run test` para garantir que nenhuma regressão foi introduzida
  - Ensure all tests pass, ask the user if questions arise.
  - _Requisitos: 6.1, 6.2_

## Notas

- Cada fase deve ser validada antes de prosseguir para a próxima
- As contagens de erros são aproximadas e podem variar após a Fase 1 (configuração)
- Na Fase 4 (tipagem de `any`), priorizar tipos existentes no projeto antes de criar novos
- Supressões inline (`eslint-disable`) devem ser usadas apenas como último recurso e sempre com justificativa
- Após a conclusão, qualquer novo código deve respeitar as regras configuradas
