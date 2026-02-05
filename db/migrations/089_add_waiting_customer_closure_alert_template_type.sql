-- Migration 089: Adicionar tipo de template de e-mail para alerta de encerramento por falta de interação
-- Usado pelo template waiting_customer_closure_alert (alerta 48h, ticket será encerrado em 24h)

ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'waiting_customer_closure_alert';
