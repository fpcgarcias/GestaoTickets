// Setup global para testes
import { config } from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente ANTES de qualquer import
config({ path: path.resolve(process.cwd(), '.env') });

// Verificar se DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida no arquivo .env');
  console.error('Por favor, configure o arquivo .env com a variável DATABASE_URL');
  process.exit(1);
}

// Agora podemos importar o db
const { initDb } = await import('./db.js');

// Inicializar banco de dados antes de todos os testes
export async function setup() {
  try {
    await initDb();
    console.log('✅ Banco de dados inicializado para testes');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados para testes:', error);
    throw error;
  }
}

// Executar setup automaticamente
await setup();
