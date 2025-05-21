import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Função simplificada para executar a migração
async function simpleUpdate(databaseUrl) {
  console.log('Iniciando migração para atualizar o enum user_role...');
  
  // Criar uma pool de conexão com o banco de dados
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    console.log('Conectado ao banco de dados. Executando migração...');
    
    // Comandos SQL simples para adicionar os novos valores ao enum
    const commands = [
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'manager';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'supervisor';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'viewer';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'company_admin';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'triage';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'quality';",
      "ALTER TYPE \"public\".\"user_role\" ADD VALUE IF NOT EXISTS 'integration_bot';"
    ];
    
    // Executar cada comando separadamente
    for (const cmd of commands) {
      console.log(`Executando: ${cmd}`);
      await pool.query(cmd);
      console.log('Comando executado com sucesso');
    }
    
    console.log('Migração concluída com sucesso!');
    console.log('Enum user_role foi atualizado com os novos roles.');
  } catch (error) {
    console.error('Erro ao executar migração:', error);
  } finally {
    // Encerrar a conexão com o banco de dados
    await pool.end();
    console.log('Conexão com banco de dados fechada.');
  }
}

// Verificar argumentos da linha de comando
if (process.argv.length < 3) {
  console.error('\nErro: URL do banco de dados não fornecida!');
  console.log('\nUso: node server/simple-migrate.js "sua_database_url_aqui"');
  console.log('Exemplo: node server/simple-migrate.js "postgresql://usuario:senha@host:porta/banco"\n');
  process.exit(1);
}

// Executar a migração com a URL fornecida
const databaseUrl = process.argv[2];
simpleUpdate(databaseUrl); 