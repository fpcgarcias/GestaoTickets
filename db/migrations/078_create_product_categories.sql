-- Migration 078: Criar Tabela de Categorias de Produtos
-- Data: 2025-11-16
-- Descrição: Adiciona gestão de categorias de produtos do inventário

-- ========================================
-- TABELA: product_categories
-- ========================================

CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT DEFAULT '#6B7280',
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para product_categories
CREATE INDEX IF NOT EXISTS idx_product_categories_company_active 
ON product_categories(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_categories_code 
ON product_categories(code, company_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_name 
ON product_categories(name);

COMMENT ON TABLE product_categories IS 'Categorias de produtos do inventário (hardware, software, consumíveis, etc)';
COMMENT ON COLUMN product_categories.code IS 'Código único da categoria (usado internamente)';
COMMENT ON COLUMN product_categories.icon IS 'Ícone Lucide para exibição (opcional)';
COMMENT ON COLUMN product_categories.color IS 'Cor hexadecimal para identificação visual';

-- Inserir categorias padrão
INSERT INTO product_categories (name, code, description, icon, color, is_active)
VALUES 
    -- Hardware (equipamentos únicos)
    ('Notebook', 'notebook', 'Computadores portáteis', 'Laptop', '#3B82F6', true),
    ('Desktop', 'desktop', 'Computadores de mesa', 'Monitor', '#1E40AF', true),
    ('Monitor', 'monitor', 'Monitores e displays', 'Monitor', '#3B82F6', true),
    ('Impressora', 'impressora', 'Impressoras e multifuncionais', 'Printer', '#6366F1', true),
    ('Servidor', 'servidor', 'Servidores e equipamentos de rede', 'Server', '#06B6D4', true),
    ('Smartphone', 'smartphone', 'Telefones celulares', 'Smartphone', '#8B5CF6', true),
    ('Tablet', 'tablet', 'Tablets e iPads', 'TabletSmartphone', '#A855F7', true),
    
    -- Acessórios (equipamentos únicos ou não)
    ('Teclado', 'teclado', 'Teclados diversos', 'Keyboard', '#F59E0B', true),
    ('Mouse', 'mouse', 'Mouse e trackpads', 'Mouse', '#F97316', true),
    ('Headset', 'headset', 'Fones de ouvido e headsets', 'Headphones', '#EC4899', true),
    ('Webcam', 'webcam', 'Câmeras web', 'Video', '#DB2777', true),
    ('Hub USB', 'hub_usb', 'Hubs e adaptadores USB', 'Usb', '#94A3B8', true),
    
    -- Consumíveis (materiais de uso)
    ('Toner', 'toner', 'Cartuchos de toner e tinta', 'Droplet', '#EF4444', true),
    ('Papel', 'papel', 'Resmas e papéis diversos', 'FileText', '#F59E0B', true),
    ('Lâmpada', 'lampada', 'Lâmpadas LED, fluorescentes, etc', 'Lightbulb', '#FCD34D', true),
    ('Pilha/Bateria', 'pilha_bateria', 'Pilhas e baterias', 'Battery', '#10B981', true),
    ('Cabo', 'cabo', 'Cabos de rede, energia, HDMI, etc', 'Cable', '#6B7280', true),
    
    -- Software
    ('Licença Software', 'licenca_software', 'Licenças de programas e sistemas', 'Code', '#10B981', true),
    
    -- Infraestrutura
    ('Switch', 'switch', 'Switches de rede', 'Network', '#06B6D4', true),
    ('Roteador', 'roteador', 'Roteadores e access points', 'Wifi', '#0EA5E9', true),
    ('Nobreak', 'nobreak', 'Nobreaks e estabilizadores', 'Zap', '#F59E0B', true),
    
    -- Outros
    ('Outro', 'outro', 'Outros tipos de produtos', 'MoreHorizontal', '#6B7280', true)
ON CONFLICT DO NOTHING;

