-- Migration 088: Fechamento automático por falta de interação (aguardando cliente)
-- Descrição: Adiciona parâmetro por departamento e campo em tickets para alerta 48h

-- ========================================
-- 1. DEPARTMENTS: auto_close_waiting_customer
-- ========================================

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS auto_close_waiting_customer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN departments.auto_close_waiting_customer IS 'Se true, tickets em aguardando cliente sem resposta do cliente: alerta em 48h, encerramento em 72h';

-- ========================================
-- 2. TICKETS: waiting_customer_alert_sent_at
-- ========================================

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS waiting_customer_alert_sent_at timestamp;

COMMENT ON COLUMN tickets.waiting_customer_alert_sent_at IS 'Data em que foi enviado o e-mail de alerta 48h (será encerrado em 24h). Zerado quando o cliente responde.';
