-- Migration: Adicionar campo is_stock_transfer na tabela inventory_movements
-- Data: 2024

-- Adicionar coluna is_stock_transfer
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS is_stock_transfer BOOLEAN NOT NULL DEFAULT false;

-- Comentário na coluna
COMMENT ON COLUMN inventory_movements.is_stock_transfer IS 'Indica se a movimentação é apenas entre estoques (sem vinculação a usuário)';




