import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando tabela ticket_attachments');

  // Primeiro verificar se a tabela já existe para evitar erros
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ticket_attachments'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (tableExists) {
    console.log('Tabela ticket_attachments já existe, pulando criação');
    return;
  }

  // Criar a tabela ticket_attachments
  await db.execute(sql`
    CREATE TABLE ticket_attachments (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      
      -- Informações do arquivo
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      
      -- Chaves do S3/Wasabi
      s3_key TEXT NOT NULL,
      s3_bucket TEXT NOT NULL,
      
      -- Metadados
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      deleted_at TIMESTAMP,
      deleted_by_id INTEGER REFERENCES users(id)
    );

    -- Adicionar comentários para documentação
    COMMENT ON TABLE ticket_attachments IS 'Armazena metadados dos arquivos anexados aos tickets';
    COMMENT ON COLUMN ticket_attachments.ticket_id IS 'Referência ao ticket proprietário do anexo';
    COMMENT ON COLUMN ticket_attachments.user_id IS 'Usuário que fez upload do arquivo';
    COMMENT ON COLUMN ticket_attachments.s3_key IS 'Chave única do arquivo no S3/Wasabi';
    COMMENT ON COLUMN ticket_attachments.s3_bucket IS 'Nome do bucket onde o arquivo está armazenado';
    COMMENT ON COLUMN ticket_attachments.is_deleted IS 'Soft delete - indica se o arquivo foi removido logicamente';

    -- Criar índices para melhorar performance de consultas
    CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
    CREATE INDEX idx_ticket_attachments_user_id ON ticket_attachments(user_id);
    CREATE INDEX idx_ticket_attachments_is_deleted ON ticket_attachments(is_deleted);
    CREATE INDEX idx_ticket_attachments_uploaded_at ON ticket_attachments(uploaded_at);
  `);

  console.log('Migração: Tabela ticket_attachments criada com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo tabela ticket_attachments');
  
  // Primeira, verificar se a tabela existe
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ticket_attachments'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (!tableExists) {
    console.log('Tabela ticket_attachments não existe, nada a fazer');
    return;
  }

  // Remover a tabela
  await db.execute(sql`
    DROP TABLE IF EXISTS ticket_attachments CASCADE;
  `);

  console.log('Reversão: Tabela ticket_attachments removida com sucesso');
} 