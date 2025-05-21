import pg from 'pg';
const { Pool } = pg;

async function checkEnum(databaseUrl) {
  console.log('Verificando valores do enum user_role...');
  
  // Criar uma pool de conexão com o banco de dados
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    // Executar consulta para verificar os valores do enum
    const result = await pool.query(`
      SELECT e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'user_role'
      ORDER BY e.enumlabel;
    `);
    
    console.log('Valores atuais do enum user_role:');
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.enumlabel}`);
    });
    
  } catch (error) {
    console.error('Erro ao consultar valores do enum:', error);
  } finally {
    // Encerrar a conexão com o banco de dados
    await pool.end();
  }
}

// Verificar argumentos da linha de comando
if (process.argv.length < 3) {
  console.error('\nErro: URL do banco de dados não fornecida!');
  console.log('\nUso: node server/check-enum.js "sua_database_url_aqui"');
  process.exit(1);
}

// Executar a verificação com a URL fornecida
const databaseUrl = process.argv[2];
checkEnum(databaseUrl); 