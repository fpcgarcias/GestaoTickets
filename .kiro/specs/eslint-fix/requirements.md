# Documento de Requisitos: Correção de Erros de Lint

## Introdução

O projeto possui 1577 problemas de lint (774 erros + 803 warnings) identificados pelo ESLint. A configuração atual do ESLint está incompleta, faltando globals para browser/node, plugin de React Hooks e regras customizadas para os padrões do projeto. Este documento define os requisitos para corrigir a configuração do ESLint e resolver todos os erros de lint de forma organizada e incremental.

## Glossário

- **ESLint_Config**: Arquivo de configuração do ESLint (`eslint.config.js`) que define regras, plugins e globals para análise estática do código
- **Lint_Runner**: Processo de execução do ESLint via script `npm run lint` que analisa os diretórios `client/src`, `server` e `shared`
- **Auto_Fix**: Funcionalidade do ESLint (`--fix`) que corrige automaticamente erros que possuem fixers implementados
- **Client_Code**: Código TypeScript/React localizado em `client/src/`
- **Server_Code**: Código TypeScript/Node.js localizado em `server/`
- **Shared_Code**: Código TypeScript compartilhado localizado em `shared/`

## Requisitos

### Requisito 1: Configuração Robusta do ESLint

**User Story:** Como desenvolvedor, quero que a configuração do ESLint esteja completa e correta, para que os erros reportados sejam legítimos e não falsos positivos causados por configuração inadequada.

#### Critérios de Aceitação

1. WHEN o ESLint_Config é carregado, THE ESLint_Config SHALL definir globals de browser (window, document, console, etc.) para arquivos em `client/src/`
2. WHEN o ESLint_Config é carregado, THE ESLint_Config SHALL definir globals de Node.js (process, __dirname, Buffer, etc.) para arquivos em `server/` e `shared/`
3. WHEN o ESLint_Config é carregado, THE ESLint_Config SHALL incluir o plugin `eslint-plugin-react-hooks` com regras recomendadas para arquivos `.tsx`
4. WHEN uma variável não utilizada possui prefixo underscore (`_`), THE ESLint_Config SHALL ignorar essa variável na regra `no-unused-vars`
5. WHEN o Lint_Runner é executado, THE ESLint_Config SHALL aplicar configurações específicas por diretório (client, server, shared) sem conflitos entre ambientes

### Requisito 2: Correção Automática de Erros Triviais

**User Story:** Como desenvolvedor, quero que erros auto-corrigíveis sejam resolvidos automaticamente, para economizar tempo em correções mecânicas.

#### Critérios de Aceitação

1. WHEN o Auto_Fix é executado, THE Lint_Runner SHALL corrigir automaticamente os 52 erros de `prefer-const`
2. WHEN o Auto_Fix é executado, THE Lint_Runner SHALL corrigir automaticamente os 130 erros de `no-extra-non-null-assertion`
3. WHEN o Auto_Fix é executado, THE Lint_Runner SHALL corrigir automaticamente o erro de `prefer-as-const`
4. WHEN o Auto_Fix é executado, THE Lint_Runner SHALL preservar o comportamento funcional do código sem introduzir regressões

### Requisito 3: Eliminação de Variáveis Não Utilizadas

**User Story:** Como desenvolvedor, quero remover todas as variáveis, imports e parâmetros não utilizados, para manter o código limpo e reduzir confusão.

#### Critérios de Aceitação

1. WHEN o Client_Code é analisado, THE Lint_Runner SHALL reportar zero erros de `no-unused-vars` em `client/src/`
2. WHEN o Server_Code é analisado, THE Lint_Runner SHALL reportar zero erros de `no-unused-vars` em `server/`
3. WHEN o Shared_Code é analisado, THE Lint_Runner SHALL reportar zero erros de `no-unused-vars` em `shared/`
4. WHEN um import não utilizado é removido, THE Client_Code SHALL manter todas as funcionalidades existentes sem quebras
5. WHEN um parâmetro de callback é necessário por posição mas não utilizado, THE Server_Code SHALL prefixar o parâmetro com underscore (`_`) ao invés de removê-lo

### Requisito 4: Tipagem Progressiva para Eliminação de `any`

**User Story:** Como desenvolvedor, quero substituir usos de `any` por tipos específicos de forma progressiva, para melhorar a segurança de tipos do projeto sem bloquear o desenvolvimento.

#### Critérios de Aceitação

1. WHEN o Lint_Runner é executado, THE ESLint_Config SHALL tratar `no-explicit-any` como `error` ao invés de `warn`
2. WHEN um tipo `any` é substituído, THE Client_Code SHALL utilizar tipos específicos definidos no projeto (interfaces, types, ou tipos de bibliotecas)
3. WHEN um tipo `any` é substituído, THE Server_Code SHALL utilizar tipos específicos definidos no projeto ou tipos de bibliotecas (@types/*)
4. WHEN a substituição de `any` não é trivial em um arquivo, THE ESLint_Config SHALL permitir supressão inline com comentário justificativo (`// eslint-disable-next-line @typescript-eslint/no-explicit-any -- [justificativa]`)

### Requisito 5: Correção de Erros Menores Restantes

**User Story:** Como desenvolvedor, quero que todos os erros menores de lint sejam corrigidos, para que o projeto tenha zero erros e zero warnings no lint.

#### Critérios de Aceitação

1. WHEN o Lint_Runner é executado, THE Lint_Runner SHALL reportar zero erros de `no-undef` após configuração correta de globals
2. WHEN o Lint_Runner é executado, THE Lint_Runner SHALL reportar zero erros de `no-useless-assignment`, `no-useless-catch`, `no-useless-escape`, `no-self-assign` e `no-case-declarations`
3. WHEN o Lint_Runner é executado, THE Lint_Runner SHALL reportar zero erros de `no-empty`, `ban-ts-comment`, `no-empty-object-type`, `no-unused-expressions`, `no-require-imports` e `no-namespace`
4. WHEN o Lint_Runner é executado, THE Lint_Runner SHALL reportar zero erros de `react-hooks/exhaustive-deps`
5. WHEN o Lint_Runner é executado, THE Lint_Runner SHALL reportar zero erros de `no-non-null-asserted-optional-chain`

### Requisito 6: Manutenção Contínua da Qualidade de Lint

**User Story:** Como desenvolvedor, quero que o lint permaneça limpo após as correções, para que novos erros sejam detectados e corrigidos imediatamente.

#### Critérios de Aceitação

1. WHEN o Lint_Runner é executado após todas as correções, THE Lint_Runner SHALL reportar zero erros e zero warnings
2. WHEN a regra `no-explicit-any` está configurada como `error`, THE ESLint_Config SHALL impedir a introdução de novos usos de `any` sem justificativa
