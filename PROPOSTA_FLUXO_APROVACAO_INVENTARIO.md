# 📋 Proposta: Fluxo de Aprovação para Movimentações de Inventário

## 🎯 Objetivo

Implementar um sistema completo de aprovação para movimentações de inventário, garantindo controle adequado sobre saídas, entradas e transferências de equipamentos e produtos.

---

## 📊 Situação Atual

### O que já existe:
- ✅ Campo `approval_status` na tabela `inventory_movements` com valores: `pending`, `approved`, `rejected`, `not_required`
- ✅ Campos de auditoria: `approved_by_id`, `approval_date`, `approval_notes`
- ✅ Funções `approveMovement()` e `rejectMovement()` no backend
- ✅ Interface com botões de aprovar/rejeitar na listagem de movimentações
- ✅ Tabela `department_inventory_settings` com campo `approval_rules` (JSONB) preparado
- ✅ Sistema de isolamento por departamento já implementado
- ✅ Role `inventory_manager` existente

### O que falta:
- ❌ Validação de quem pode aprovar
- ❌ Cadastro de aprovadores
- ❌ Regras de quando aprovação é necessária
- ❌ Notificações para aprovadores
- ❌ Interface de configuração de regras de aprovação

---

## 🏗️ Proposta de Arquitetura

### 1. **Tabela de Aprovadores** (Nova)

```sql
CREATE TABLE inventory_approvers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    product_category_id INTEGER REFERENCES product_categories(id) ON DELETE CASCADE,
    product_type_id INTEGER REFERENCES product_types(id) ON DELETE CASCADE,
    max_approval_value DECIMAL(12, 2), -- Valor máximo que pode aprovar
    min_approval_value DECIMAL(12, 2), -- Valor mínimo que requer aprovação
    movement_types TEXT[], -- ['withdrawal', 'entry', 'write_off', ...]
    requires_second_approval BOOLEAN DEFAULT false, -- Requer aprovação em 2 níveis
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER DEFAULT 1, -- Ordem de prioridade (1 = primeiro nível)
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by_id INTEGER REFERENCES users(id)
);
```

**Estratégia de Aprovação:**
- **Por Departamento**: Aprovador específico para um departamento
- **Por Categoria**: Aprovador para categorias específicas (ex: Notebooks, Monitores)
- **Por Tipo de Produto**: Aprovador para tipos específicos (ex: Dell Latitude 15 3550)
- **Por Valor**: Limites de valor para aprovação
- **Por Tipo de Movimentação**: Diferentes aprovadores para withdrawal, entry, write_off, etc.
- **Aprovação em 2 Níveis**: Para valores altos, requer aprovação de 2 pessoas

**Exemplos de Configuração:**
1. **Aprovador Geral do Departamento TI**
   - `department_id = 1` (TI)
   - `max_approval_value = 5000.00`
   - `movement_types = ['withdrawal', 'entry', 'transfer']`
   - `priority = 1`

2. **Aprovador para Equipamentos Caros**
   - `product_category_id = 5` (Notebooks)
   - `min_approval_value = 3000.00`
   - `max_approval_value = 10000.00`
   - `requires_second_approval = true`
   - `priority = 2`

3. **Aprovador Específico para Baixas**
   - `movement_types = ['write_off']`
   - `max_approval_value = NULL` (sem limite)
   - `priority = 1`

---

### 2. **Regras de Aprovação por Departamento** (Usar `department_inventory_settings.approval_rules`)

```json
{
  "enabled": true,
  "require_approval_by_default": true,
  "exempt_movement_types": ["return", "maintenance"],
  "value_rules": {
    "require_approval_above": 1000.00,
    "require_double_approval_above": 5000.00,
    "auto_approve_below": 100.00
  },
  "category_rules": {
    "5": { // ID da categoria
      "require_approval": true,
      "min_value": 500.00
    }
  },
  "type_rules": {
    "12": { // ID do tipo de produto
      "require_approval": true,
      "always_require": true
    }
  },
  "movement_type_rules": {
    "withdrawal": {
      "require_approval": true,
      "min_value": 0.00
    },
    "entry": {
      "require_approval": false
    },
    "write_off": {
      "require_approval": true,
      "always_require": true
    }
  }
}
```

---

### 3. **Fluxo de Decisão: Quando Aprovação é Necessária?**

```
┌─────────────────────────────────────┐
│ Movimentação Criada                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Verificar Regras do Departamento    │
│ - approval_rules.enabled?           │
│ - require_approval_by_default?       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Tipo de Movimentação                │
│ - Está em exempt_movement_types?    │
│   → NOT_REQUIRED                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Calcular Valor Total da Movimentação│
│ (soma de purchase_value dos produtos)│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Aplicar Regras de Valor             │
│ - Valor < auto_approve_below?       │
│   → APPROVED (automático)           │
│ - Valor > require_approval_above?   │
│   → PENDING                          │
│ - Valor > require_double_approval?  │
│   → PENDING (2 níveis)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Verificar Regras por Categoria/Tipo │
│ - Categoria tem regra específica?   │
│ - Tipo tem regra específica?         │
│ - always_require = true?             │
│   → PENDING (obrigatório)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Status Final:                       │
│ - PENDING: Requer aprovação          │
│ - APPROVED: Aprovado automaticamente │
│ - NOT_REQUIRED: Não requer aprovação│
└─────────────────────────────────────┘
```

---

### 4. **Sistema de Notificações**

**Quando uma movimentação requer aprovação:**
1. Buscar aprovadores elegíveis baseado em:
   - Departamento do produto
   - Categoria do produto
   - Tipo do produto
   - Valor da movimentação
   - Tipo de movimentação

2. Enviar notificação para:
   - Aprovadores do primeiro nível (priority = 1)
   - Se `requires_second_approval = true`, também notificar segundo nível (priority = 2)

3. Opções de notificação:
   - Email
   - Notificação in-app
   - Webhook (se configurado)

---

### 5. **Interface do Usuário**

#### 5.1. **Tela de Cadastro de Aprovadores**
**Rota:** `/inventory/approvers`

**Campos:**
- Usuário (select com busca)
- Departamento (opcional - se vazio, é aprovador global)
- Categoria de Produto (opcional)
- Tipo de Produto (opcional)
- Valor Máximo de Aprovação (opcional)
- Valor Mínimo que Requer Aprovação (opcional)
- Tipos de Movimentação (multiselect)
- Requer Segunda Aprovação (checkbox)
- Prioridade (1 = primeiro nível, 2 = segundo nível)
- Ativo (checkbox)

**Validações:**
- Usuário deve ter role `inventory_manager`, `manager`, `supervisor` ou `admin`
- Se não especificar departamento/categoria/tipo, será aprovador geral
- Valor mínimo deve ser menor que valor máximo (se ambos preenchidos)

#### 5.2. **Tela de Configuração de Regras por Departamento**
**Rota:** `/inventory/departments/:id/settings` (já existe parcialmente)

**Seções:**
1. **Configuração Geral**
   - Habilitar aprovação para este departamento
   - Exigir aprovação por padrão
   - Tipos de movimentação que não requerem aprovação

2. **Regras por Valor**
   - Valor mínimo para requerer aprovação
   - Valor mínimo para requerer dupla aprovação
   - Valor máximo para aprovação automática

3. **Regras por Categoria**
   - Lista de categorias com regras específicas
   - Adicionar/editar/remover regras por categoria

4. **Regras por Tipo de Produto**
   - Lista de tipos com regras específicas
   - Adicionar/editar/remover regras por tipo

5. **Regras por Tipo de Movimentação**
   - Configuração específica para cada tipo:
     - `withdrawal`: Requer aprovação? Valor mínimo?
     - `entry`: Requer aprovação? Valor mínimo?
     - `write_off`: Requer aprovação? (geralmente sempre)
     - `transfer`: Requer aprovação? Valor mínimo?
     - `return`: Geralmente não requer
     - `maintenance`: Geralmente não requer
     - `reservation`: Requer aprovação? Valor mínimo?

#### 5.3. **Melhorias na Tela de Movimentações**
- **Filtro por Status de Aprovação**: Pending, Approved, Rejected
- **Badge Visual**: Destaque para movimentações pendentes
- **Coluna de Aprovador**: Mostrar quem aprovou/rejeitou
- **Ações Contextuais**:
  - Se `pending`: Botões "Aprovar" e "Rejeitar" (apenas para aprovadores elegíveis)
  - Se `approved`: Mostrar data/hora e aprovador
  - Se `rejected`: Mostrar motivo da rejeição

#### 5.4. **Dashboard de Aprovações Pendentes**
**Rota:** `/inventory/approvals/pending`

**Funcionalidades:**
- Lista de movimentações pendentes de aprovação
- Filtros: Departamento, Categoria, Tipo, Valor
- Ações em lote: Aprovar múltiplas, Rejeitar múltiplas
- Informações destacadas:
  - Valor total
  - Quantidade de itens
  - Tipo de movimentação
  - Data de criação
  - Solicitante

---

## 🔐 Regras de Permissão

### Quem pode aprovar?
1. **Aprovadores Cadastrados**: Usuários na tabela `inventory_approvers` com:
   - `is_active = true`
   - Critérios correspondentes à movimentação (departamento, categoria, tipo, valor)

2. **Roles com Permissão Especial**:
   - `admin`: Pode aprovar qualquer movimentação
   - `company_admin`: Pode aprovar movimentações da empresa
   - `inventory_manager`: Pode aprovar se for aprovador cadastrado

3. **Validação no Backend**:
   - Antes de aprovar, verificar se usuário é aprovador elegível
   - Se `requires_second_approval = true`, verificar se já foi aprovado no primeiro nível

### Quem pode cadastrar aprovadores?
- `admin`
- `company_admin`
- `inventory_manager` (apenas para seu(s) departamento(s))

---

## 📝 Exemplos de Uso

### Exemplo 1: Retirada de Notebook
**Cenário:**
- Produto: Notebook Dell Latitude (valor: R$ 3.500,00)
- Departamento: TI
- Tipo de Movimentação: `withdrawal`
- Categoria: Notebooks

**Fluxo:**
1. Sistema verifica regras do departamento TI
2. Regra: `require_approval_above = 1000.00` → Valor > 1000, requer aprovação
3. Sistema busca aprovadores:
   - Aprovador do departamento TI (priority = 1)
   - Aprovador para categoria Notebooks (priority = 2, se valor > 3000)
4. Status inicial: `pending`
5. Notificação enviada para aprovador do primeiro nível
6. Aprovador aprova → Status: `approved`
7. Se `requires_second_approval = true`, aguarda segunda aprovação

### Exemplo 2: Entrada de Toner
**Cenário:**
- Produto: Toner HP (valor: R$ 50,00)
- Departamento: TI
- Tipo de Movimentação: `entry`

**Fluxo:**
1. Sistema verifica regras do departamento TI
2. Regra: `auto_approve_below = 100.00` → Valor < 100, aprovação automática
3. Status inicial: `approved` (automático)
4. Nenhuma notificação enviada

### Exemplo 3: Baixa de Equipamento
**Cenário:**
- Produto: Monitor antigo (valor: R$ 800,00)
- Departamento: TI
- Tipo de Movimentação: `write_off`

**Fluxo:**
1. Sistema verifica regras do departamento TI
2. Regra: `movement_type_rules.write_off.always_require = true` → Sempre requer aprovação
3. Status inicial: `pending`
4. Notificação enviada para aprovador de baixas
5. Aprovador aprova → Status: `approved`

---

## 🎨 Recomendações de Implementação

### Fase 1: Estrutura Base (Prioritária)
1. ✅ Criar tabela `inventory_approvers`
2. ✅ Criar API de CRUD de aprovadores
3. ✅ Criar tela de cadastro de aprovadores
4. ✅ Atualizar função `shouldRequireApproval()` no service
5. ✅ Implementar busca de aprovadores elegíveis

### Fase 2: Regras e Configuração
1. ✅ Criar interface de configuração de regras por departamento
2. ✅ Implementar lógica de cálculo de valor total da movimentação
3. ✅ Implementar aplicação de regras (valor, categoria, tipo, movimento)
4. ✅ Atualizar criação de movimentação para aplicar regras

### Fase 3: Notificações e Interface
1. ✅ Implementar sistema de notificações
2. ✅ Melhorar tela de movimentações com filtros e badges
3. ✅ Criar dashboard de aprovações pendentes
4. ✅ Adicionar validação de permissões na aprovação

### Fase 4: Aprovação em 2 Níveis
1. ✅ Implementar lógica de aprovação em 2 níveis
2. ✅ Interface para mostrar status de cada nível
3. ✅ Notificações para segundo nível

---

## 🤔 Decisões a Tomar

### 1. **Estratégia de Aprovação**
- [ ] **Opção A**: Aprovação por hierarquia (1º nível → 2º nível sequencial)
- [ ] **Opção B**: Aprovação paralela (ambos os níveis podem aprovar simultaneamente)
- [ ] **Opção C**: Aprovação por maioria (2 de 3 aprovadores, por exemplo)

**Recomendação:** Opção A (sequencial) para maior controle e rastreabilidade.

### 2. **Valor da Movimentação**
- [ ] **Opção A**: Soma do `purchase_value` de todos os produtos na movimentação
- [ ] **Opção B**: Valor unitário do produto × quantidade
- [ ] **Opção C**: Valor configurável por tipo de produto (ex: valor de mercado atual)

**Recomendação:** Opção A (soma do purchase_value) - mais simples e direto.

### 3. **Aprovadores Globais vs Específicos**
- [ ] **Opção A**: Aprovador sem departamento = aprovador global (pode aprovar qualquer departamento)
- [ ] **Opção B**: Aprovador sempre vinculado a um departamento
- [ ] **Opção C**: Aprovador global apenas para roles admin/company_admin

**Recomendação:** Opção A + C (global para admins, específico para outros).

### 4. **Aprovação Automática**
- [ ] **Opção A**: Aprovar automaticamente movimentações abaixo de X valor
- [ ] **Opção B**: Sempre requerer aprovação, mesmo para valores baixos
- [ ] **Opção C**: Aprovação automática apenas para tipos específicos (ex: return, maintenance)

**Recomendação:** Opção A + C (automática para valores baixos E tipos específicos).

### 5. **Interface de Aprovação**
- [ ] **Opção A**: Aprovar diretamente na listagem de movimentações
- [ ] **Opção B**: Tela dedicada de aprovações pendentes
- [ ] **Opção C**: Modal/drawer com detalhes da movimentação

**Recomendação:** Opção B + C (tela dedicada com modal de detalhes).

---

## 📊 Estrutura de Dados Proposta

### Tabela: `inventory_approvers`
```sql
CREATE TABLE inventory_approvers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    product_category_id INTEGER REFERENCES product_categories(id) ON DELETE CASCADE,
    product_type_id INTEGER REFERENCES product_types(id) ON DELETE CASCADE,
    max_approval_value DECIMAL(12, 2),
    min_approval_value DECIMAL(12, 2),
    movement_types TEXT[],
    requires_second_approval BOOLEAN DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER DEFAULT 1,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by_id INTEGER REFERENCES users(id),
    
    -- Índices
    CONSTRAINT idx_approvers_user UNIQUE(user_id, department_id, product_category_id, product_type_id, company_id)
);
```

### Atualização: `inventory_movements`
```sql
-- Adicionar campos para aprovação em 2 níveis
ALTER TABLE inventory_movements
ADD COLUMN first_approver_id INTEGER REFERENCES users(id),
ADD COLUMN first_approval_date TIMESTAMP,
ADD COLUMN second_approver_id INTEGER REFERENCES users(id),
ADD COLUMN second_approval_date TIMESTAMP;
```

---

## ✅ Checklist de Implementação

### Backend
- [ ] Criar migration para tabela `inventory_approvers`
- [ ] Criar service `inventory-approver-service.ts`
- [ ] Criar API routes para CRUD de aprovadores
- [ ] Atualizar `inventory-movement-service.ts`:
  - [ ] Função `shouldRequireApproval()` com regras completas
  - [ ] Função `findEligibleApprovers()` para buscar aprovadores
  - [ ] Função `calculateMovementValue()` para calcular valor total
  - [ ] Validação de permissão antes de aprovar
- [ ] Implementar notificações (email/in-app)
- [ ] Adicionar validação de aprovação em 2 níveis

### Frontend
- [ ] Criar página `/inventory/approvers` (CRUD de aprovadores)
- [ ] Atualizar página de configurações de departamento
- [ ] Melhorar página de movimentações:
  - [ ] Filtro por status de aprovação
  - [ ] Badges visuais
  - [ ] Coluna de aprovador
- [ ] Criar página `/inventory/approvals/pending` (dashboard)
- [ ] Adicionar modal de detalhes para aprovação
- [ ] Implementar notificações in-app

### Testes
- [ ] Testar criação de movimentação com diferentes regras
- [ ] Testar busca de aprovadores elegíveis
- [ ] Testar aprovação/rejeição
- [ ] Testar aprovação em 2 níveis
- [ ] Testar notificações

---

## 🎯 Próximos Passos

1. **Revisar esta proposta** e definir decisões sobre as opções apresentadas
2. **Validar regras de negócio** com stakeholders
3. **Priorizar funcionalidades** (Fase 1 é essencial)
4. **Criar issues/tasks** no sistema de gestão
5. **Iniciar implementação** pela Fase 1

---

## 📝 Notas Finais

- Esta proposta é **flexível** e pode ser adaptada conforme necessidades específicas
- A estrutura permite **evoluir** para regras mais complexas no futuro
- O sistema de aprovação deve ser **configurável** por departamento para atender diferentes necessidades
- **Performance**: Considerar índices adequados na tabela de aprovadores
- **Auditoria**: Todas as aprovações devem ser registradas com data/hora e usuário

---

**Data da Proposta:** 2025-01-XX  
**Versão:** 1.0

