-- Migration: Add must_change_password field to users table
-- Adiciona campo para forçar troca de senha no primeiro login

-- Adicionar coluna must_change_password à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Comentário da coluna para documentação
COMMENT ON COLUMN users.must_change_password IS 'Indica se o usuário deve trocar a senha no próximo login'; 