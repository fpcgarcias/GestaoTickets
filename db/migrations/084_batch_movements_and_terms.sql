-- Migration 084: Movimentações em Lote e Termos Únicos
-- Data: 2025-01-XX
-- Descrição: Adiciona suporte para movimentações em lote e termos de responsabilidade com múltiplos produtos

-- ========================================
-- 1. NOVA TABELA: inventory_movement_items
-- ========================================
-- Tabela intermediária para relacionar movimentações com múltiplos produtos

CREATE TABLE IF NOT EXISTS inventory_movement_items (
    id SERIAL PRIMARY KEY,
    movement_id INTEGER REFERENCES inventory_movements(id) ON DELETE CASCADE NOT NULL,
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE RESTRICT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_movement_items
CREATE INDEX IF NOT EXISTS idx_movement_items_movement 
ON inventory_movement_items(movement_id);

CREATE INDEX IF NOT EXISTS idx_movement_items_product 
ON inventory_movement_items(product_id);

COMMENT ON TABLE inventory_movement_items IS 'Itens de produtos em movimentações em lote';
COMMENT ON COLUMN inventory_movement_items.movement_id IS 'ID da movimentação que contém este item';
COMMENT ON COLUMN inventory_movement_items.product_id IS 'ID do produto movimentado';

-- ========================================
-- 2. MODIFICAR: inventory_movements
-- ========================================

-- Adicionar campo movement_group_id para agrupar movimentações relacionadas
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS movement_group_id UUID;

-- Tornar product_id opcional (NULL quando for movimentação em lote)
ALTER TABLE inventory_movements
ALTER COLUMN product_id DROP NOT NULL;

-- Adicionar campo is_batch_movement para identificar movimentações em lote
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS is_batch_movement BOOLEAN NOT NULL DEFAULT false;

-- Índices para movement_group_id
CREATE INDEX IF NOT EXISTS idx_movements_group 
ON inventory_movements(movement_group_id) 
WHERE movement_group_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN inventory_movements.movement_group_id IS 'UUID para agrupar movimentações relacionadas (ex: lote de entrega)';
COMMENT ON COLUMN inventory_movements.product_id IS 'ID do produto (NULL quando is_batch_movement = true)';
COMMENT ON COLUMN inventory_movements.is_batch_movement IS 'Indica se esta movimentação contém múltiplos produtos';

-- ========================================
-- 3. MODIFICAR: user_inventory_assignments
-- ========================================

-- Adicionar campo assignment_group_id para agrupar assignments da mesma entrega
ALTER TABLE user_inventory_assignments
ADD COLUMN IF NOT EXISTS assignment_group_id UUID;

-- Índice para assignment_group_id
CREATE INDEX IF NOT EXISTS idx_assignments_group 
ON user_inventory_assignments(assignment_group_id) 
WHERE assignment_group_id IS NOT NULL;

-- Comentário
COMMENT ON COLUMN user_inventory_assignments.assignment_group_id IS 'UUID para agrupar assignments da mesma entrega em lote';

-- ========================================
-- 4. NOVA TABELA: responsibility_term_assignments
-- ========================================
-- Tabela intermediária para relacionar termos com múltiplos assignments

CREATE TABLE IF NOT EXISTS responsibility_term_assignments (
    id SERIAL PRIMARY KEY,
    term_id INTEGER REFERENCES inventory_responsibility_terms(id) ON DELETE CASCADE NOT NULL,
    assignment_id INTEGER REFERENCES user_inventory_assignments(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(term_id, assignment_id)
);

-- Índices para responsibility_term_assignments
CREATE INDEX IF NOT EXISTS idx_term_assignments_term 
ON responsibility_term_assignments(term_id);

CREATE INDEX IF NOT EXISTS idx_term_assignments_assignment 
ON responsibility_term_assignments(assignment_id);

COMMENT ON TABLE responsibility_term_assignments IS 'Relacionamento entre termos de responsabilidade e assignments (suporta múltiplos)';
COMMENT ON COLUMN responsibility_term_assignments.term_id IS 'ID do termo de responsabilidade';
COMMENT ON COLUMN responsibility_term_assignments.assignment_id IS 'ID do assignment incluído no termo';

-- ========================================
-- 5. MODIFICAR: inventory_responsibility_terms
-- ========================================

-- Tornar assignment_id opcional (NULL quando for termo em lote)
ALTER TABLE inventory_responsibility_terms
ALTER COLUMN assignment_id DROP NOT NULL;

-- Adicionar campo is_batch_term para identificar termos em lote
ALTER TABLE inventory_responsibility_terms
ADD COLUMN IF NOT EXISTS is_batch_term BOOLEAN NOT NULL DEFAULT false;

-- Comentários
COMMENT ON COLUMN inventory_responsibility_terms.assignment_id IS 'ID do assignment (NULL quando is_batch_term = true, usa responsibility_term_assignments)';
COMMENT ON COLUMN inventory_responsibility_terms.is_batch_term IS 'Indica se este termo contém múltiplos assignments/produtos';

-- ========================================
-- 6. MIGRAÇÃO DE DADOS EXISTENTES
-- ========================================
-- Para manter compatibilidade, movimentações existentes continuam funcionando normalmente
-- (product_id não nulo e is_batch_movement = false)

-- Para termos existentes, garantir que assignment_id não seja NULL
-- (já deve estar assim, mas garantimos com constraint se necessário)
-- Não precisamos fazer nada aqui pois os dados existentes já têm assignment_id preenchido



