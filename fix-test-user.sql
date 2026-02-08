-- Limpar usuário de teste com senha fraca
-- Execute este comando diretamente no seu cliente PostgreSQL

DELETE FROM users WHERE email = 'test-history-user@example.com';

-- Verificar se foi deletado
SELECT COUNT(*) as usuarios_teste_restantes FROM users WHERE email LIKE 'test-history-user%';
