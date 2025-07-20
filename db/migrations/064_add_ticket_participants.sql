-- Migração 064: Adicionar Sistema de Participantes de Tickets
-- Data: 2025-01-31
-- Descrição: Adiciona sistema de participantes para tickets, permitindo que usuários acompanhem chamados

-- ========================================
-- 1. CRIAR TABELA DE PARTICIPANTES DE TICKETS
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_participants (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    added_by_id INTEGER REFERENCES users(id),
    added_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(ticket_id, user_id)
);

-- ========================================
-- 2. ADICIONAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índice para busca rápida de participantes por ticket
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket_id 
ON ticket_participants(ticket_id);

-- Índice para busca rápida de tickets por participante
CREATE INDEX IF NOT EXISTS idx_ticket_participants_user_id 
ON ticket_participants(user_id);

-- Índice para busca de quem adicionou o participante
CREATE INDEX IF NOT EXISTS idx_ticket_participants_added_by_id 
ON ticket_participants(added_by_id);

-- Índice composto para otimizar consultas de participantes por ticket e usuário
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket_user 
ON ticket_participants(ticket_id, user_id);

-- ========================================
-- 3. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE ticket_participants IS 'Tabela para armazenar participantes de tickets (usuários que acompanham chamados)';
COMMENT ON COLUMN ticket_participants.ticket_id IS 'ID do ticket que o usuário está acompanhando';
COMMENT ON COLUMN ticket_participants.user_id IS 'ID do usuário que está acompanhando o ticket';
COMMENT ON COLUMN ticket_participants.added_by_id IS 'ID do usuário que adicionou o participante';
COMMENT ON COLUMN ticket_participants.added_at IS 'Data e hora em que o participante foi adicionado'; 