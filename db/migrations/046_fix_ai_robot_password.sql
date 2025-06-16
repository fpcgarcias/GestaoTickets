-- Migration: Fix ai_robot user password
-- Corrige a senha do usuário ai_robot para atender aos critérios de segurança
-- Garante que o bot seja global (company_id = null)

-- Atualizar a senha do usuário ai_robot e garantir que seja global
UPDATE users 
SET password = 'AiBot123!@#', 
    company_id = null, 
    updated_at = now()
WHERE username = 'ai_robot' AND role = 'integration_bot';

-- Comentário para documentação
COMMENT ON TABLE users IS 'Usuário ai_robot atualizado com senha segura e configurado como global'; 