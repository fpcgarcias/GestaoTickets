-- Migração 074: Adicionar Sistema de Notificações Persistentes
-- Data: 2025-12-08
-- Descrição: Adiciona sistema de notificações com persistência, histórico, Web Push e gerenciamento avançado

-- ========================================
-- 1. CRIAR TABELA notifications
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    
    -- Metadados opcionais para contexto
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_code TEXT,
    
    -- Metadados adicionais em JSON
    metadata JSONB,
    
    -- Controle de leitura
    read_at TIMESTAMP WITHOUT TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- ========================================
-- 2. CRIAR TABELA push_subscriptions
-- ========================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Dados da subscription do navegador
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- Metadados
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMP WITHOUT TIME ZONE
);

-- ========================================
-- 3. ADICIONAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read_at 
ON notifications(read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, read_at) 
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id 
ON notifications(ticket_id) 
WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_priority 
ON notifications(priority);

-- Índice composto para queries comuns (usuário + não lidas + ordenação)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON notifications(user_id, read_at, created_at DESC);

-- Índices para push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
ON push_subscriptions(endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_used 
ON push_subscriptions(last_used_at);

-- ========================================
-- 4. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE notifications IS 'Tabela de notificações persistentes do sistema';
COMMENT ON COLUMN notifications.id IS 'ID único da notificação';
COMMENT ON COLUMN notifications.user_id IS 'ID do usuário destinatário';
COMMENT ON COLUMN notifications.type IS 'Tipo da notificação (new_ticket, status_change, new_reply, etc.)';
COMMENT ON COLUMN notifications.title IS 'Título da notificação';
COMMENT ON COLUMN notifications.message IS 'Mensagem da notificação';
COMMENT ON COLUMN notifications.priority IS 'Prioridade da notificação (low, medium, high, critical)';
COMMENT ON COLUMN notifications.ticket_id IS 'ID do ticket relacionado (opcional)';
COMMENT ON COLUMN notifications.ticket_code IS 'Código do ticket relacionado (opcional)';
COMMENT ON COLUMN notifications.metadata IS 'Metadados adicionais em formato JSON';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp de quando a notificação foi lida (NULL = não lida)';
COMMENT ON COLUMN notifications.created_at IS 'Timestamp de criação da notificação';

COMMENT ON TABLE push_subscriptions IS 'Tabela de subscriptions para Web Push';
COMMENT ON COLUMN push_subscriptions.id IS 'ID único da subscription';
COMMENT ON COLUMN push_subscriptions.user_id IS 'ID do usuário';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Endpoint único da subscription do navegador';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'Chave pública P256DH para criptografia';
COMMENT ON COLUMN push_subscriptions.auth_key IS 'Chave de autenticação';
COMMENT ON COLUMN push_subscriptions.user_agent IS 'User agent do navegador';
COMMENT ON COLUMN push_subscriptions.created_at IS 'Timestamp de criação da subscription';
COMMENT ON COLUMN push_subscriptions.last_used_at IS 'Timestamp do último uso da subscription';

-- ========================================
-- 5. CONSTRAINTS ADICIONAIS
-- ========================================

-- Garantir que priority tem valores válidos
ALTER TABLE notifications 
ADD CONSTRAINT check_notification_priority 
CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Garantir que type não é vazio
ALTER TABLE notifications 
ADD CONSTRAINT check_notification_type_not_empty 
CHECK (type <> '');

-- Garantir que title não é vazio
ALTER TABLE notifications 
ADD CONSTRAINT check_notification_title_not_empty 
CHECK (title <> '');

-- Garantir que message não é vazio
ALTER TABLE notifications 
ADD CONSTRAINT check_notification_message_not_empty 
CHECK (message <> '');
