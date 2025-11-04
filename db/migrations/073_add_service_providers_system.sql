-- Migração 073: Adicionar Sistema de Prestadores de Serviços
-- Data: 2025-02-01
-- Descrição: Adiciona sistema de prestadores de serviços (internos e externos) com relacionamento N:N com departamentos e tickets

-- ========================================
-- 1. ADICIONAR CAMPO use_service_providers NA TABELA departments
-- ========================================

ALTER TABLE departments ADD COLUMN IF NOT EXISTS use_service_providers BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN departments.use_service_providers IS 'Habilita uso de prestadores de serviços para tickets deste departamento';

-- ========================================
-- 2. CRIAR TABELA service_providers
-- ========================================

CREATE TABLE IF NOT EXISTS service_providers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    is_external BOOLEAN DEFAULT false NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    -- Campos para prestadores externos (todos opcionais)
    company_name TEXT,
    cnpj TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- ========================================
-- 3. CRIAR TABELA department_service_providers (relacionamento N:N)
-- ========================================

CREATE TABLE IF NOT EXISTS department_service_providers (
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    service_provider_id INTEGER NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (department_id, service_provider_id)
);

-- ========================================
-- 4. CRIAR TABELA ticket_service_providers
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_service_providers (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    service_provider_id INTEGER NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
    added_by_id INTEGER REFERENCES users(id),
    added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(ticket_id, service_provider_id)
);

-- ========================================
-- 5. ADICIONAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índices para service_providers
CREATE INDEX IF NOT EXISTS idx_service_providers_company_id 
ON service_providers(company_id);

CREATE INDEX IF NOT EXISTS idx_service_providers_is_active 
ON service_providers(is_active);

CREATE INDEX IF NOT EXISTS idx_service_providers_company_active 
ON service_providers(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_service_providers_is_external 
ON service_providers(is_external);

-- Índices para department_service_providers
CREATE INDEX IF NOT EXISTS idx_department_service_providers_department_id 
ON department_service_providers(department_id);

CREATE INDEX IF NOT EXISTS idx_department_service_providers_provider_id 
ON department_service_providers(service_provider_id);

-- Índices para ticket_service_providers
CREATE INDEX IF NOT EXISTS idx_ticket_service_providers_ticket_id 
ON ticket_service_providers(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_service_providers_provider_id 
ON ticket_service_providers(service_provider_id);

CREATE INDEX IF NOT EXISTS idx_ticket_service_providers_added_by_id 
ON ticket_service_providers(added_by_id);

CREATE INDEX IF NOT EXISTS idx_ticket_service_providers_ticket_provider 
ON ticket_service_providers(ticket_id, service_provider_id);

-- ========================================
-- 6. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE service_providers IS 'Tabela de prestadores de serviços (internos e externos)';
COMMENT ON COLUMN service_providers.name IS 'Nome do prestador de serviço';
COMMENT ON COLUMN service_providers.is_external IS 'Indica se é prestador externo (true) ou interno (false)';
COMMENT ON COLUMN service_providers.company_id IS 'Empresa do prestador (para isolamento multi-empresa)';
COMMENT ON COLUMN service_providers.company_name IS 'Razão social (apenas para prestadores externos)';
COMMENT ON COLUMN service_providers.cnpj IS 'CNPJ (apenas para prestadores externos)';

COMMENT ON TABLE department_service_providers IS 'Relacionamento N:N entre departamentos e prestadores de serviços';
COMMENT ON COLUMN department_service_providers.department_id IS 'ID do departamento';
COMMENT ON COLUMN department_service_providers.service_provider_id IS 'ID do prestador de serviço';

COMMENT ON TABLE ticket_service_providers IS 'Prestadores de serviços vinculados a tickets específicos';
COMMENT ON COLUMN ticket_service_providers.ticket_id IS 'ID do ticket';
COMMENT ON COLUMN ticket_service_providers.service_provider_id IS 'ID do prestador de serviço';
COMMENT ON COLUMN ticket_service_providers.added_by_id IS 'ID do usuário que adicionou o prestador ao ticket';

