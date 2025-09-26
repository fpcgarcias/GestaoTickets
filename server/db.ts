import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

// Configuração simplificada para driver pg tradicional
async function createDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 45,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
    allowExitOnIdle: true,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const db = drizzle(pool, { schema });
  
  // Ping leve para validar conexão
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    throw err;
  }
  
  return { pool, db } as const;
}

if (!process.env.DATABASE_URL) {
  console.error('[db.ts] ERRO: DATABASE_URL não está definida!');
  console.error('[db.ts] process.cwd():', process.cwd());
  console.error('[db.ts] Conteúdo de process.env.DATABASE_URL:', process.env.DATABASE_URL);
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Variáveis globais do banco
let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

export async function initDb() {
  try {
    const created = await createDb();
    pool = created.pool;
    db = created.db;
    console.log('✅ Banco de dados inicializado com driver pg tradicional (compatível com OpenTelemetry)');
  } catch (error) {
    console.error('[db.ts] Falha ao inicializar DB:', error);
    throw error;
  }
}

export { pool, db };
