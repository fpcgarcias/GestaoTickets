-- Otimização: Índice composto para verificação rápida de participantes
-- Usado no endpoint /api/ticket-replies para verificar se um usuário é participante de um ticket

-- Criar índice composto para (ticket_id, user_id) para otimizar a verificação EXISTS
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket_user 
ON ticket_participants (ticket_id, user_id);

-- Comentário explicativo
COMMENT ON INDEX idx_ticket_participants_ticket_user IS 'Índice otimizado para verificação rápida se um usuário é participante de um ticket específico'; 