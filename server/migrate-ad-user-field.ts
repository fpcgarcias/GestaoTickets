import { Database } from 'sqlite3';
import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Migração para adicionar campo adUser à tabela users
 */
async function main() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
  console.log(`Abrindo banco de dados em: ${dbPath}`);
  
  // Verificar se o arquivo existe
  try {
    await fs.access(dbPath);
  } catch (error) {
    console.error(`Erro: Arquivo de banco de dados não encontrado em ${dbPath}`);
    process.exit(1);
  }
  
  const db = new Database(dbPath);
  
  return new Promise<void>((resolve, reject) => {
    // Verificar se a coluna já existe
    db.get('PRAGMA table_info(users)', (err, rows) => {
      if (err) {
        console.error('Erro ao verificar estrutura da tabela:', err);
        db.close();
        return reject(err);
      }
      
      // Verificar se a coluna adUser já existe
      const columns = Array.isArray(rows) ? rows : [rows];
      const hasAdUserColumn = columns.some((col: any) => col.name === 'adUser');
      
      if (hasAdUserColumn) {
        console.log('Coluna adUser já existe na tabela users. Nenhuma migração necessária.');
        db.close();
        return resolve();
      }
      
      // Adicionar a coluna adUser
      db.run('ALTER TABLE users ADD COLUMN adUser BOOLEAN DEFAULT 0', (err) => {
        if (err) {
          console.error('Erro ao adicionar coluna adUser:', err);
          db.close();
          return reject(err);
        }
        
        console.log('Coluna adUser adicionada com sucesso à tabela users!');
        db.close();
        resolve();
      });
    });
  });
}

// Executar migração
main()
  .then(() => {
    console.log('Migração concluída com sucesso.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro na migração:', error);
    process.exit(1);
  }); 