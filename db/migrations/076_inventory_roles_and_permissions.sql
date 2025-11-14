-- Migration 076: Roles e Permissões para Sistema de Estoque
-- Data: 2025-11-14
-- Descrição: Adiciona role inventory_manager e sistema de permissões granulares para estoque

-- ========================================
-- 1. ADICIONAR 'inventory_manager' AO ENUM user_role
-- ========================================

-- Adicionar novo valor ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inventory_manager';

-- ========================================
-- 2. TABELA: inventory_permissions (Permissões Disponíveis)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_permissions (
    id SERIAL PRIMARY KEY,
    permission_code TEXT NOT NULL UNIQUE,
    permission_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('products', 'movements', 'reports', 'settings', 'approvals')),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para inventory_permissions
CREATE INDEX IF NOT EXISTS idx_inventory_permissions_code 
ON inventory_permissions(permission_code);

CREATE INDEX IF NOT EXISTS idx_inventory_permissions_category 
ON inventory_permissions(category);

COMMENT ON TABLE inventory_permissions IS 'Lista de permissões disponíveis para o sistema de estoque';
COMMENT ON COLUMN inventory_permissions.permission_code IS 'Código único da permissão (ex: view_inventory, manage_inventory, approve_withdrawals)';

-- ========================================
-- 3. TABELA: user_inventory_permissions (Permissões por Usuário)
-- ========================================

CREATE TABLE IF NOT EXISTS user_inventory_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    permission_id INTEGER REFERENCES inventory_permissions(id) ON DELETE CASCADE NOT NULL,
    granted_by_id INTEGER REFERENCES users(id),
    granted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission_id)
);

-- Índices para user_inventory_permissions
CREATE INDEX IF NOT EXISTS idx_user_inventory_permissions_user 
ON user_inventory_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_inventory_permissions_permission 
ON user_inventory_permissions(permission_id);

COMMENT ON TABLE user_inventory_permissions IS 'Relação N:N entre usuários e permissões de estoque';

-- ========================================
-- 4. INSERIR PERMISSÕES PADRÃO
-- ========================================

INSERT INTO inventory_permissions (permission_code, permission_name, description, category) VALUES
-- Permissões de Produtos
('view_inventory', 'Visualizar Estoque', 'Permite visualizar produtos e estoque', 'products'),
('manage_inventory', 'Gerenciar Estoque', 'Permite criar, editar e excluir produtos', 'products'),
('import_products', 'Importar Produtos', 'Permite importar produtos via NF-e ou planilha', 'products'),
('export_products', 'Exportar Produtos', 'Permite exportar lista de produtos', 'products'),

-- Permissões de Movimentações
('create_movements', 'Criar Movimentações', 'Permite criar movimentações de estoque', 'movements'),
('view_movements', 'Visualizar Movimentações', 'Permite visualizar histórico de movimentações', 'movements'),
('approve_movements', 'Aprovar Movimentações', 'Permite aprovar ou rejeitar movimentações', 'approvals'),

-- Permissões de Aprovações
('approve_withdrawals', 'Aprovar Retiradas', 'Permite aprovar retiradas de produtos', 'approvals'),
('approve_transfers', 'Aprovar Transferências', 'Permite aprovar transferências entre locais', 'approvals'),
('approve_write_off', 'Aprovar Write-off', 'Permite aprovar baixa de produtos', 'approvals'),

-- Permissões de Relatórios
('view_reports', 'Visualizar Relatórios', 'Permite visualizar relatórios de estoque', 'reports'),
('export_reports', 'Exportar Relatórios', 'Permite exportar relatórios em Excel/PDF', 'reports'),
('view_financial_reports', 'Visualizar Relatórios Financeiros', 'Permite visualizar relatórios de custos e depreciação', 'reports'),

-- Permissões de Configurações
('manage_settings', 'Gerenciar Configurações', 'Permite configurar regras e parâmetros do estoque', 'settings'),
('manage_suppliers', 'Gerenciar Fornecedores', 'Permite gerenciar cadastro de fornecedores', 'settings'),
('manage_locations', 'Gerenciar Localizações', 'Permite gerenciar localizações do estoque', 'settings'),
('manage_product_types', 'Gerenciar Tipos de Produto', 'Permite gerenciar tipos e categorias de produtos', 'settings'),
('manage_term_templates', 'Gerenciar Templates de Termos', 'Permite gerenciar templates de termos de responsabilidade', 'settings')
ON CONFLICT (permission_code) DO NOTHING;

-- ========================================
-- 5. COMENTÁRIOS FINAIS
-- ========================================

COMMENT ON TYPE user_role IS 'Roles de usuário: admin, company_admin, manager, supervisor, support, triage, customer, viewer, quality, integration_bot, inventory_manager';

-- ========================================
-- FIM DA MIGRATION 076
-- ========================================

