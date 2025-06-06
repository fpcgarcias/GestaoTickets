-- Adicionar campo ad_user para identificar usuários que autenticam via Active Directory
-- Migration: 036_add_ad_user_field.sql

-- Adicionar coluna ad_user na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_user BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN users.ad_user IS 'Indica se o usuário autentica via Active Directory (true) ou autenticação tradicional (false)'; 