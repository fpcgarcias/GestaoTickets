-- Migration 086: Adicionar campo signed_pdf_s3_key para PDFs assinados
-- Data: 2025-01-XX
-- Descrição: Adiciona campo para armazenar a chave S3 do PDF assinado da ClickSign

-- ========================================
-- 1. ADICIONAR COLUNA signed_pdf_s3_key
-- ========================================

ALTER TABLE inventory_responsibility_terms 
ADD COLUMN IF NOT EXISTS signed_pdf_s3_key TEXT;

-- ========================================
-- 2. ÍNDICE PARA CONSULTAS
-- ========================================

CREATE INDEX IF NOT EXISTS idx_terms_signed_pdf_s3_key 
ON inventory_responsibility_terms(signed_pdf_s3_key) 
WHERE signed_pdf_s3_key IS NOT NULL;

-- ========================================
-- 3. COMENTÁRIOS
-- ========================================

COMMENT ON COLUMN inventory_responsibility_terms.signed_pdf_s3_key IS 'Chave S3 do PDF assinado baixado da ClickSign após assinatura';



