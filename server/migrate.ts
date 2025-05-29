import "./loadEnv"; // Importar PRIMEIRO para carregar variáveis de ambiente

import { db } from './db';
import { sql } from 'drizzle-orm';

// Função principal para executar migrações essenciais
async function migrate() {
  try {
    // Verificar se a tabela de migrações existe (para compatibilidade)
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);

    // Se a tabela não existir, criá-la
    if (!tableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          executed_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('✅ Tabela de migrações criada com sucesso!');
    }

    console.log('✅ Sistema de migração inicializado!');
  } catch (error) {
    console.error('❌ Erro durante inicialização:', error);
    // Não interromper o processo - deixar o sistema continuar
  }
}

// Exportar como módulo para ser usado pelo servidor
export { migrate };

// Auto-executar se este arquivo for o ponto de entrada
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  console.log('[migrate.ts] Executando inicialização direta...');
  migrate()
    .then(() => {
      console.log('[migrate.ts] Inicialização concluída, saindo com código 0.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[migrate.ts] Erro durante inicialização:', error);
      process.exit(1);
    });
} 