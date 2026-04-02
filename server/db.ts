import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

/**
 * Normaliza DATABASE_URL para evitar o aviso do pg sobre sslmode.
 * Os modos 'prefer', 'require' e 'verify-ca' passam a ser explícitos como 'verify-full'.
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    const sslmode = u.searchParams.get('sslmode');
    if (sslmode === 'prefer' || sslmode === 'require' || sslmode === 'verify-ca') {
      u.searchParams.set('sslmode', 'verify-full');
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

// Configuração simplificada para driver pg tradicional
async function createDb() {
  const connectionString = normalizeConnectionString(process.env.DATABASE_URL!);
  const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS || 300);
  const pool = new Pool({
    connectionString,
    max: 45,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // 10 segundos para testes
    allowExitOnIdle: true,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const originalQuery = pool.query.bind(pool);
  pool.query = (async (...args: any[]) => {
    const start = Date.now();
    try {
      return await originalQuery(...args as [any, ...any[]]);
    } finally {
      const durationMs = Date.now() - start;
      if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
        const firstArg = args[0];
        const queryText = typeof firstArg === 'string'
          ? firstArg
          : (firstArg?.text ?? '<query text unavailable>');
        console.warn(`[DB][SLOW_QUERY] ${durationMs}ms - ${queryText}`);
      }
    }
  }) as typeof pool.query;
  
  const db = drizzle(pool, { schema });
  
  // Ping leve para validar conexão
  await db.execute(sql`select 1`);
  
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
