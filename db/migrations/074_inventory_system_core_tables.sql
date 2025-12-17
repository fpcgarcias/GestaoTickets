-- Migration 074: Sistema de Controle de Estoque - Tabelas Core
-- Data: 2025-11-14
-- Descrição: Adiciona estrutura completa do sistema de controle de estoque integrado ao service desk

-- ========================================
-- 1. TABELA: product_types (Tipos de Produtos)
-- ========================================

CREATE TABLE IF NOT EXISTS product_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('hardware', 'software', 'consumable', 'infrastructure')),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    requires_serial BOOLEAN NOT NULL DEFAULT false,
    requires_asset_tag BOOLEAN NOT NULL DEFAULT false,
    is_consumable BOOLEAN NOT NULL DEFAULT false,
    depreciation_years INTEGER,
    min_stock_alert INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para product_types
CREATE INDEX IF NOT EXISTS idx_product_types_company_active 
ON product_types(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_types_category 
ON product_types(category, company_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_types_department 
ON product_types(department_id) 
WHERE department_id IS NOT NULL;

COMMENT ON TABLE product_types IS 'Tipos e categorias de produtos do estoque';
COMMENT ON COLUMN product_types.custom_fields IS 'Campos customizáveis por tipo (JSONB)';
COMMENT ON COLUMN product_types.category IS 'Categoria: hardware, software, consumable, infrastructure';

-- ========================================
-- 2. TABELA: inventory_suppliers (Fornecedores)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    payment_terms TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_active 
ON inventory_suppliers(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj 
ON inventory_suppliers(cnpj) 
WHERE cnpj IS NOT NULL;

COMMENT ON TABLE inventory_suppliers IS 'Fornecedores de produtos e equipamentos';

-- ========================================
-- 3. TABELA: inventory_locations (Localizações)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_location_id INTEGER REFERENCES inventory_locations(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('building', 'floor', 'room', 'storage')),
    qr_code TEXT,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_locations
CREATE INDEX IF NOT EXISTS idx_locations_company_active 
ON inventory_locations(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_locations_parent 
ON inventory_locations(parent_location_id) 
WHERE parent_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_department 
ON inventory_locations(department_id) 
WHERE department_id IS NOT NULL;

COMMENT ON TABLE inventory_locations IS 'Hierarquia de localizações: Prédio > Andar > Sala > Armário';
COMMENT ON COLUMN inventory_locations.type IS 'Tipo: building, floor, room, storage';

-- ========================================
-- 4. TABELA: inventory_products (Produtos/Ativos)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_products (
    id SERIAL PRIMARY KEY,
    product_type_id INTEGER REFERENCES product_types(id) ON DELETE RESTRICT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    service_tag TEXT,
    asset_number TEXT,
    purchase_date DATE,
    warranty_expiry DATE,
    supplier_id INTEGER REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
    purchase_value DECIMAL(12, 2),
    depreciation_value DECIMAL(12, 2),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'written_off', 'reserved')),
    location_id INTEGER REFERENCES inventory_locations(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT,
    invoice_date DATE,
    invoice_file_id INTEGER,
    notes TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    created_by_id INTEGER REFERENCES users(id),
    updated_by_id INTEGER REFERENCES users(id)
);

-- Índices para inventory_products
CREATE INDEX IF NOT EXISTS idx_products_company_status 
ON inventory_products(company_id, status) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_type 
ON inventory_products(product_type_id) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_location 
ON inventory_products(location_id) 
WHERE location_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_department 
ON inventory_products(department_id) 
WHERE department_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_products_serial 
ON inventory_products(serial_number) 
WHERE serial_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_service_tag 
ON inventory_products(service_tag) 
WHERE service_tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_asset_number 
ON inventory_products(asset_number) 
WHERE asset_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_warranty_expiry 
ON inventory_products(warranty_expiry) 
WHERE warranty_expiry IS NOT NULL AND is_deleted = false;

COMMENT ON TABLE inventory_products IS 'Produtos e ativos do estoque';
COMMENT ON COLUMN inventory_products.specifications IS 'Campos dinâmicos específicos do tipo de produto (JSONB)';
COMMENT ON COLUMN inventory_products.photos IS 'Array de URLs de fotos do produto (JSONB)';

-- ========================================
-- 5. TABELA: inventory_movements (Movimentações)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE RESTRICT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'withdrawal', 'return', 'write_off', 'transfer', 'maintenance', 'reservation')),
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    responsible_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    from_location_id INTEGER REFERENCES inventory_locations(id) ON DELETE SET NULL,
    to_location_id INTEGER REFERENCES inventory_locations(id) ON DELETE SET NULL,
    reason TEXT,
    notes TEXT,
    movement_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'not_required')),
    approved_by_id INTEGER REFERENCES users(id),
    approval_date TIMESTAMP WITHOUT TIME ZONE,
    approval_notes TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    created_by_id INTEGER REFERENCES users(id)
);

-- Índices para inventory_movements
CREATE INDEX IF NOT EXISTS idx_movements_product 
ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_movements_ticket 
ON inventory_movements(ticket_id) 
WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movements_user 
ON inventory_movements(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movements_company_date 
ON inventory_movements(company_id, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_movements_approval_status 
ON inventory_movements(approval_status, company_id) 
WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_movements_type 
ON inventory_movements(movement_type, company_id);

COMMENT ON TABLE inventory_movements IS 'Histórico de todas as movimentações de produtos';
COMMENT ON COLUMN inventory_movements.movement_type IS 'Tipo: entry, withdrawal, return, write_off, transfer, maintenance, reservation';

-- ========================================
-- 6. TABELA: user_inventory_assignments (Alocações de Usuário)
-- ========================================

CREATE TABLE IF NOT EXISTS user_inventory_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE RESTRICT NOT NULL,
    assigned_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    expected_return_date DATE,
    actual_return_date TIMESTAMP WITHOUT TIME ZONE,
    condition_on_return TEXT,
    responsibility_term_id INTEGER,
    signature_status TEXT NOT NULL DEFAULT 'pending' CHECK (signature_status IN ('pending', 'sent', 'signed', 'expired')),
    notes TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    assigned_by_id INTEGER REFERENCES users(id),
    returned_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para user_inventory_assignments
CREATE INDEX IF NOT EXISTS idx_assignments_user 
ON user_inventory_assignments(user_id) 
WHERE actual_return_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_product 
ON user_inventory_assignments(product_id);

CREATE INDEX IF NOT EXISTS idx_assignments_company 
ON user_inventory_assignments(company_id);

CREATE INDEX IF NOT EXISTS idx_assignments_pending_return 
ON user_inventory_assignments(expected_return_date) 
WHERE actual_return_date IS NULL AND expected_return_date IS NOT NULL;

COMMENT ON TABLE user_inventory_assignments IS 'Alocações de produtos para usuários';
COMMENT ON COLUMN user_inventory_assignments.signature_status IS 'Status da assinatura do termo de responsabilidade';

-- ========================================
-- 7. TABELA: ticket_inventory_items (Vínculo Tickets-Produtos)
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_inventory_items (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE RESTRICT NOT NULL,
    movement_id INTEGER REFERENCES inventory_movements(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('delivery', 'return', 'replacement', 'consumption', 'reservation')),
    quantity INTEGER NOT NULL DEFAULT 1,
    condition TEXT,
    notes TEXT,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para ticket_inventory_items
CREATE INDEX IF NOT EXISTS idx_ticket_inventory_ticket 
ON ticket_inventory_items(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_inventory_product 
ON ticket_inventory_items(product_id);

CREATE INDEX IF NOT EXISTS idx_ticket_inventory_movement 
ON ticket_inventory_items(movement_id) 
WHERE movement_id IS NOT NULL;

COMMENT ON TABLE ticket_inventory_items IS 'Produtos vinculados a tickets';
COMMENT ON COLUMN ticket_inventory_items.action_type IS 'Tipo: delivery, return, replacement, consumption, reservation';

-- ========================================
-- 8. TABELA: inventory_responsibility_terms (Termos de Responsabilidade)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_responsibility_terms (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES user_inventory_assignments(id) ON DELETE CASCADE NOT NULL,
    template_id INTEGER,
    template_version INTEGER,
    generated_pdf_url TEXT,
    pdf_s3_key TEXT,
    sent_date TIMESTAMP WITHOUT TIME ZONE,
    signed_date TIMESTAMP WITHOUT TIME ZONE,
    signature_method TEXT CHECK (signature_method IN ('email', 'digital', 'physical')),
    signature_data JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'signed', 'expired', 'cancelled')),
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_responsibility_terms
CREATE INDEX IF NOT EXISTS idx_terms_assignment 
ON inventory_responsibility_terms(assignment_id);

CREATE INDEX IF NOT EXISTS idx_terms_status 
ON inventory_responsibility_terms(status, company_id);

CREATE INDEX IF NOT EXISTS idx_terms_company 
ON inventory_responsibility_terms(company_id);

COMMENT ON TABLE inventory_responsibility_terms IS 'Termos de responsabilidade para alocação de produtos';
COMMENT ON COLUMN inventory_responsibility_terms.signature_data IS 'Dados da assinatura (timestamp, IP, etc) em JSONB';

-- ========================================
-- 9. TABELA: department_inventory_settings (Configurações por Departamento)
-- ========================================

CREATE TABLE IF NOT EXISTS department_inventory_settings (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE NOT NULL UNIQUE,
    allowed_product_types JSONB DEFAULT '[]'::jsonb,
    approval_rules JSONB DEFAULT '{}'::jsonb,
    min_stock_alerts BOOLEAN NOT NULL DEFAULT true,
    require_return_workflow BOOLEAN NOT NULL DEFAULT false,
    default_assignment_days INTEGER DEFAULT 30,
    auto_create_maintenance_tickets BOOLEAN NOT NULL DEFAULT false,
    maintenance_interval_days INTEGER,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para department_inventory_settings
CREATE INDEX IF NOT EXISTS idx_dept_settings_department 
ON department_inventory_settings(department_id);

CREATE INDEX IF NOT EXISTS idx_dept_settings_company 
ON department_inventory_settings(company_id);

COMMENT ON TABLE department_inventory_settings IS 'Configurações de estoque específicas por departamento';
COMMENT ON COLUMN department_inventory_settings.allowed_product_types IS 'Array de IDs de tipos de produtos permitidos (JSONB)';
COMMENT ON COLUMN department_inventory_settings.approval_rules IS 'Regras de aprovação por valor/tipo (JSONB)';

-- ========================================
-- 10. TABELA: inventory_product_history (Audit Trail)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_product_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE CASCADE NOT NULL,
    changed_by_id INTEGER REFERENCES users(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'status_changed', 'location_changed')),
    old_values JSONB,
    new_values JSONB,
    change_description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_product_history
CREATE INDEX IF NOT EXISTS idx_product_history_product 
ON inventory_product_history(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_history_user 
ON inventory_product_history(changed_by_id) 
WHERE changed_by_id IS NOT NULL;

COMMENT ON TABLE inventory_product_history IS 'Histórico de alterações em produtos (audit trail)';

-- ========================================
-- 11. TABELA: inventory_term_templates (Templates de Termos)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_term_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_term_templates
CREATE INDEX IF NOT EXISTS idx_term_templates_company_active 
ON inventory_term_templates(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_term_templates_default 
ON inventory_term_templates(company_id, is_default) 
WHERE is_default = true;

COMMENT ON TABLE inventory_term_templates IS 'Templates customizáveis de termos de responsabilidade';

-- ========================================
-- 12. TABELA: inventory_alerts (Alertas do Sistema)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'warranty_expiring', 'overdue_return', 'maintenance_due', 'obsolete_item')),
    product_id INTEGER REFERENCES inventory_products(id) ON DELETE CASCADE,
    assignment_id INTEGER REFERENCES user_inventory_assignments(id) ON DELETE CASCADE,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by_id INTEGER REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_alerts
CREATE INDEX IF NOT EXISTS idx_alerts_company_unresolved 
ON inventory_alerts(company_id, is_resolved, created_at DESC) 
WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_alerts_product 
ON inventory_alerts(product_id) 
WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_type 
ON inventory_alerts(alert_type, company_id) 
WHERE is_resolved = false;

COMMENT ON TABLE inventory_alerts IS 'Alertas automáticos do sistema de estoque';

-- ========================================
-- 13. TABELA: inventory_webhooks (Webhooks para Integrações)
-- ========================================

CREATE TABLE IF NOT EXISTS inventory_webhooks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    secret_key TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para inventory_webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_company_active 
ON inventory_webhooks(company_id, is_active) 
WHERE is_active = true;

COMMENT ON TABLE inventory_webhooks IS 'Configuração de webhooks para integrações externas';
COMMENT ON COLUMN inventory_webhooks.events IS 'Array de eventos para notificar: inventory.created, inventory.updated, inventory.movement, inventory.alert';

-- ========================================
-- FIM DA MIGRATION 074
-- ========================================

