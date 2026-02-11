# Implementation Plan: Correção de Variáveis de Template de Email

## Overview

Centralizar o mapeamento de tradução de status em um módulo compartilhado, corrigir o `renderTemplate` e `notifyStatusChanged` para usar traduções bilíngues, e atualizar os seed templates para usar variáveis `_text`.

## Tasks

- [x] 1. Criar módulo centralizado de tradução de status
  - [x] 1.1 Criar `server/utils/status-translations.ts` com os mapas de tradução pt-BR e en-US para status, prioridade e role
    - Exportar `STATUS_TRANSLATIONS`, `PRIORITY_TRANSLATIONS`, `ROLE_TRANSLATIONS`
    - Exportar funções `translateStatus(status, language)`, `translatePriority(priority, language)`, `translateRole(role, language)`
    - Exportar função `detectLanguageFromDomain(domain)` que retorna `'pt-BR'` ou `'en-US'`
    - Fallback: retornar valor original se não encontrado no mapa
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ]* 1.2 Escrever teste de propriedade para tradução de status
    - **Property 1: Tradução de status cobre todos os enums válidos**
    - **Property 2: Fallback para status desconhecido**
    - **Property 5: Tradução por idioma retorna valor correto do mapa**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.1, 5.2**

- [x] 2. Atualizar `renderTemplate` no EmailNotificationService
  - [x] 2.1 Substituir funções locais `translateStatus`, `translatePriority`, `translateRole` por imports do módulo centralizado
    - Adicionar parâmetro de idioma ao `renderTemplate` ou detectar via contexto da empresa
    - Buscar domínio da empresa para determinar idioma antes de renderizar
    - Manter compatibilidade com todos os placeholders existentes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3_

  - [ ]* 2.2 Escrever testes unitários para renderTemplate com traduções
    - Testar renderização de `{{ticket.status_text}}` para cada status em pt-BR e en-US
    - Testar renderização de `{{status_change.old_status_text}}` e `{{status_change.new_status_text}}`
    - Testar fallback para status desconhecido
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Corrigir customMessage em `notifyStatusChanged`
  - [x] 3.1 Atualizar `notifyStatusChanged` para usar módulo centralizado de tradução
    - Remover o `statusTranslations` local duplicado
    - Importar e usar `translateStatus` do módulo centralizado
    - Detectar idioma da empresa via domínio antes de traduzir
    - Garantir que `customMessage` para participantes use `oldStatusText`/`newStatusText` traduzidos
    - _Requirements: 2.1, 2.2, 4.1, 5.1, 5.2_

  - [ ]* 3.2 Escrever teste de propriedade para customMessage
    - **Property 3: Custom_Message contém apenas textos traduzidos**
    - **Validates: Requirements 2.1**

- [x] 4. Checkpoint - Verificar que testes passam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Corrigir seed templates
  - [x] 5.1 Atualizar templates en-US na rota `seed-defaults` para usar variáveis `_text`
    - Substituir `{{ticket.status}}` por `{{ticket.status_text}}` onde aplicável
    - Substituir `{{status_change.old_status}}` por `{{status_change.old_status_text}}`
    - Substituir `{{status_change.new_status}}` por `{{status_change.new_status_text}}`
    - Remover espaços internos em placeholders (`{{ ticket.` → `{{ticket.`)
    - Verificar templates: `new_ticket`, `ticket_assigned`, `status_changed`, `ticket_reply`, `ticket_participant_added`, `ticket_participant_removed`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Atualizar templates pt-BR na rota `seed-defaults` com as mesmas correções
    - Aplicar as mesmas substituições de variáveis `_text` nos templates pt-BR
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.3 Escrever teste de propriedade para validação de seed templates
    - **Property 4: Seed templates usam variáveis _text**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 6. Final checkpoint - Verificar que todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade usam `fast-check` como biblioteca PBT
- Testes unitários validam exemplos específicos e edge cases
