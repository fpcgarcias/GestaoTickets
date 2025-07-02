-- Migração 058: Adicionar Sistema de Categorias
-- Data: 2025-01-31
-- Descrição: Adiciona terceira hierarquia (Departamento → Tipo de Chamado → Categoria)

-- ========================================
-- 1. CRIAR TABELA DE CATEGORIAS
-- ========================================

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    value TEXT NOT NULL,
    incident_type_id INTEGER REFERENCES incident_types(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ========================================
-- 2. ADICIONAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índice para busca rápida por tipo de incidente
CREATE INDEX IF NOT EXISTS idx_categories_incident_type_active 
ON categories(incident_type_id, is_active) 
WHERE is_active = true;

-- Índice para busca por empresa e ativo
CREATE INDEX IF NOT EXISTS idx_categories_company_active 
ON categories(company_id, is_active) 
WHERE is_active = true;

-- Índice para busca por valor (usado em seleções)
CREATE INDEX IF NOT EXISTS idx_categories_value 
ON categories(value);

-- Índice para ordenação por nome
CREATE INDEX IF NOT EXISTS idx_categories_name 
ON categories(name);

-- ========================================
-- 3. ADICIONAR COLUNA CATEGORY_ID NA TABELA TICKETS
-- ========================================

-- Adicionar coluna category_id (opcional, permitindo NULL para tickets existentes)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Índice para busca de tickets por categoria
CREATE INDEX IF NOT EXISTS idx_tickets_category_id 
ON tickets(category_id) 
WHERE category_id IS NOT NULL;

-- Índice composto para busca por status e categoria
CREATE INDEX IF NOT EXISTS idx_tickets_status_category 
ON tickets(status, category_id) 
WHERE category_id IS NOT NULL;

-- ========================================
-- 4. ADICIONAR CONSTRAINT DE UNICIDADE
-- ========================================

-- Garantir que não existam categorias duplicadas por tipo de incidente e empresa
-- Nota: Como esta constraint pode já existir de tentativas anteriores, vamos usar uma abordagem mais simples
ALTER TABLE categories 
ADD CONSTRAINT unique_category_per_incident_type_company 
UNIQUE (value, incident_type_id, company_id);

-- ========================================
-- 5. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE categories IS 'Terceiro nível da hierarquia: Departamento → Tipo de Chamado → Categoria';
COMMENT ON COLUMN categories.name IS 'Nome exibido da categoria (ex: "Servidores")';
COMMENT ON COLUMN categories.value IS 'Valor interno da categoria (ex: "servers")';
COMMENT ON COLUMN categories.incident_type_id IS 'Referência ao tipo de incidente pai';
COMMENT ON COLUMN categories.company_id IS 'Permite categorias específicas por empresa';
COMMENT ON COLUMN tickets.category_id IS 'Referência opcional à categoria específica do ticket';

-- ========================================
-- 6. DADOS DE EXEMPLO (OPCIONAL - COMENTADO)
-- ========================================

/*
-- Exemplos de categorias para demonstração
-- Descomente se quiser inserir dados de exemplo

INSERT INTO categories (name, value, incident_type_id, company_id, description) VALUES
-- Para tipo de incidente "Infraestrutura" (assumindo id=1)
('Servidores', 'servers', 1, 1, 'Problemas relacionados a servidores físicos e virtuais'),
('Rede', 'network', 1, 1, 'Problemas de conectividade e configuração de rede'),
('Storage', 'storage', 1, 1, 'Problemas relacionados a armazenamento de dados'),

-- Para tipo de incidente "Desenvolvimento" (assumindo id=2)
('Bug Frontend', 'bug_frontend', 2, 1, 'Erros na interface do usuário'),
('Bug Backend', 'bug_backend', 2, 1, 'Erros na lógica de negócio e APIs'),
('Nova Funcionalidade', 'new_feature', 2, 1, 'Solicitações de novas funcionalidades');
*/

-- ========================================
-- 7. VERIFICAÇÃO DA MIGRAÇÃO
-- ========================================

-- Sistema de categorias implementado: Departamento → Tipo de Chamado → Categoria 