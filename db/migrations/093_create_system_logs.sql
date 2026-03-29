-- Migração: Criar tabela system_logs para logging centralizado
-- Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5

CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  server_identifier TEXT NOT NULL,
  trace_id TEXT,
  span_id TEXT,
  context_data JSONB DEFAULT '{}',
  company_id INTEGER REFERENCES companies(id),
  user_id INTEGER REFERENCES users(id),
  request_method TEXT,
  request_url TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_server ON system_logs (server_identifier);
CREATE INDEX IF NOT EXISTS idx_system_logs_trace_id ON system_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_company_id ON system_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_url ON system_logs (request_url);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON system_logs (level, created_at DESC);
