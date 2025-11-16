# Validação de Equipamentos Únicos no Inventário

## Problema Identificado

O sistema estava permitindo que o mesmo equipamento (identificado por service tag, número de série ou número de patrimônio) fosse entregue para múltiplos usuários simultaneamente, causando inconsistências no controle de inventário.

## Solução Implementada

### 1. Validação de Disponibilidade em Movimentações

**Arquivo**: `server/services/inventory-movement-service.ts`

Foi adicionada a função `validateProductAvailability()` que verifica:

- **Para produtos com identificadores únicos** (serial_number, service_tag ou asset_number):
  - Verifica se já existe uma alocação ativa (sem data de devolução) para outro usuário
  - Bloqueia a entrega caso o equipamento já esteja alocado
  - Permite re-alocação para o mesmo usuário que já possui o equipamento

- **Para produtos consumíveis ou sem identificadores únicos**:
  - Permite múltiplas entregas/usos
  - Útil para itens como lâmpadas, peças de reposição, etc.

### 2. Atualização na Validação de Cadastro

**Arquivo**: `server/services/inventory-product-service.ts`

A função `ensureUniqueIdentifiers()` foi atualizada para:

- **Produtos não-consumíveis**: Mantém a validação de unicidade dos identificadores
- **Produtos consumíveis** (flag `is_consumable = true`): Permite cadastro de múltiplos produtos com os mesmos identificadores
- **Produtos sem identificadores**: Sempre permite cadastro (tratados como consumíveis)

## Regras de Negócio

### Equipamentos Únicos (Não-Consumíveis)

Exemplos: Notebooks, desktops, monitores, impressoras, tablets, smartphones

**Regras:**
1. Devem ter pelo menos um identificador único (serial_number, service_tag ou asset_number)
2. Não podem ser entregues para múltiplos usuários simultaneamente
3. Para entregar para um novo usuário, é necessário primeiro registrar a devolução do usuário atual
4. O sistema bloqueia tentativas de entrega duplicada com mensagem clara

**Mensagem de erro:**
```
Este equipamento (Service Tag ABC123) já está alocado para outro usuário e não pode ser entregue novamente. 
Para entregar este equipamento, primeiro registre a devolução do usuário atual.
```

### Produtos Consumíveis

Exemplos: Lâmpadas, pilhas, cabos, peças de reposição, toners

**Regras:**
1. Podem ou não ter identificadores
2. Podem ser usados em múltiplos chamados
3. Suportam controle por quantidade
4. Marcados com flag `is_consumable = true` no `product_type`

## Fluxos Afetados

### 1. Cadastro de Produtos

**Antes:**
- Não permitia produtos com identificadores duplicados, mesmo para consumíveis

**Depois:**
- Produtos consumíveis podem ter identificadores duplicados
- Produtos sem identificadores são sempre permitidos
- Produtos não-consumíveis mantêm validação de unicidade

### 2. Movimentação de Produtos (Entrega)

**Antes:**
- Permitia entregar o mesmo equipamento para múltiplos usuários

**Depois:**
- Valida disponibilidade antes de criar a movimentação
- Bloqueia entrega de equipamentos únicos já alocados
- Permite entregas de consumíveis sem restrição

### 3. Resposta de Ticket com Inventário

**Antes:**
- Não validava se o equipamento já estava em uso

**Depois:**
- A validação é aplicada automaticamente ao vincular produtos
- O erro é exibido para o usuário via toast

### 4. Aprovação de Movimentações Pendentes

**Antes:**
- Não validava disponibilidade na hora da aprovação

**Depois:**
- Valida disponibilidade no momento da aprovação
- Impede aprovação se o equipamento foi alocado entre a solicitação e aprovação

## Estrutura de Dados

### Tabela: product_types

```sql
is_consumable BOOLEAN NOT NULL DEFAULT false
```

- `true`: Produto consumível (permite múltiplas alocações)
- `false`: Produto único (valida alocação exclusiva)

### Tabela: inventory_products

```sql
serial_number TEXT
service_tag TEXT
asset_number TEXT
```

Identificadores únicos para equipamentos não-consumíveis.

### Tabela: user_inventory_assignments

```sql
actual_return_date TIMESTAMP
```

- `NULL`: Equipamento ainda está com o usuário (alocação ativa)
- `NOT NULL`: Equipamento foi devolvido (alocação encerrada)

## Casos de Uso

### Caso 1: Entrega de Notebook

```
Cenário: João já possui notebook com service tag "ABC123"
Ação: Tentar entregar o mesmo notebook para José
Resultado: ❌ BLOQUEADO
Mensagem: "Este equipamento (Service Tag ABC123) já está alocado para outro usuário..."
```

### Caso 2: Entrega de Lâmpada

```
Cenário: Produto "Lâmpada LED 10W" marcado como consumível
Ação: Usar em múltiplos chamados de manutenção
Resultado: ✅ PERMITIDO
```

### Caso 3: Devolução e Nova Entrega

```
Cenário: João devolve notebook com service tag "ABC123"
Ação 1: Registrar devolução (preenche actual_return_date)
Ação 2: Entregar para José
Resultado: ✅ PERMITIDO
```

### Caso 4: Re-alocação para o Mesmo Usuário

```
Cenário: João já possui notebook com service tag "ABC123"
Ação: Criar nova movimentação para João (mesmo usuário)
Resultado: ✅ PERMITIDO
```

## Melhorias Futuras

### 1. Filtro Visual no Frontend ⏳

Adicionar filtro na seleção de produtos para mostrar apenas equipamentos disponíveis:
- Status: "available"
- Sem alocação ativa
- Ou produtos consumíveis

### 2. Indicador de Status ⏳

Mostrar ícone ou badge visual indicando se o equipamento está:
- 🟢 Disponível
- 🔴 Em uso (com nome do usuário)
- 🟡 Em manutenção
- ⚪ Consumível (sem restrição)

### 3. Controle de Quantidade para Consumíveis ⏳

Implementar controle de estoque por quantidade:
- Quantidade em estoque
- Quantidade alocada
- Alertas de estoque baixo

### 4. Histórico de Alocações ⏳

Dashboard mostrando:
- Histórico completo de quem usou cada equipamento
- Tempo médio de alocação
- Taxa de utilização

## Testes Manuais Recomendados

### Teste 1: Validação de Equipamento Único
1. Criar produto não-consumível com service tag
2. Entregar para Usuário A
3. Tentar entregar para Usuário B
4. Verificar erro: ❌ Bloqueado

### Teste 2: Devolução e Re-entrega
1. Registrar devolução do Usuário A
2. Entregar para Usuário B
3. Verificar sucesso: ✅ Permitido

### Teste 3: Produto Consumível
1. Criar product_type com is_consumable = true
2. Criar produto deste tipo
3. Entregar para múltiplos usuários
4. Verificar sucesso: ✅ Permitido

### Teste 4: Produto Sem Identificadores
1. Criar produto sem serial/service tag/patrimônio
2. Entregar para múltiplos usuários
3. Verificar sucesso: ✅ Permitido

## Arquivos Modificados

- `server/services/inventory-movement-service.ts`
  - Adicionada função `validateProductAvailability()`
  - Validação em `registerMovement()`
  - Validação em `approveMovement()`

- `server/services/inventory-product-service.ts`
  - Atualizada função `ensureUniqueIdentifiers()`
  - Suporte para produtos consumíveis

## Logs e Monitoramento

O sistema registra as seguintes situações:

1. **Tentativa de entrega bloqueada**: Erro com detalhes do equipamento e usuário atual
2. **Movimentações aprovadas**: Log de aprovação com validação
3. **Histórico de produtos**: Todas as alterações são registradas em `inventory_product_history`

## Suporte

Em caso de problemas ou dúvidas sobre o controle de inventário:

1. Verificar se o product_type está configurado corretamente (is_consumable)
2. Verificar se há alocações ativas em `user_inventory_assignments`
3. Consultar histórico em `inventory_movements` e `inventory_product_history`

