import pg from 'pg';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Migração para adicionar campo ad_user à tabela users
 */
async function main() {
  console.log('Iniciando migração para adicionar o campo ad_user à tabela users...');
  
  if (!process.env.DATABASE_URL) {
    console.error('Erro: Variável de ambiente DATABASE_URL não encontrada');
    process.exit(1);
  }
  
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('Conectado ao banco de dados.');
    
    // Verificar se a coluna já existe
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'ad_user'
    `;
    
    const result = await client.query(checkQuery);
    
    if (result.rows.length > 0) {
      console.log('Coluna ad_user já existe na tabela users. Nenhuma migração necessária.');
      return;
    }
    
    // Adicionar a coluna ad_user com valor padrão false
    const alterQuery = `
      ALTER TABLE users 
      ADD COLUMN ad_user BOOLEAN DEFAULT false
    `;
    
    await client.query(alterQuery);
    console.log('Coluna ad_user adicionada com sucesso à tabela users!');
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
    throw error;
  } finally {
    // Encerrar a conexão com o banco
    await client.end();
  }
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