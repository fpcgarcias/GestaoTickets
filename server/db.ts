import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

// Janela de horário comercial (considera timezone do host)
const isBusinessHours = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 6 && hour < 21; // 06:00–20:59
};

// Overrides por ambiente
const FORCE_HTTP = process.env.NEON_HTTP_ONLY === '1' || process.env.DB_FORCE_HTTP === '1';
const FORCE_WS = process.env.NEON_WS_ONLY === '1';

type TransportMode = 'http' | 'ws';

function setTransport(mode: TransportMode) {
  if (mode === 'ws') {
    neonConfig.webSocketConstructor = ws;
  } else {
    neonConfig.webSocketConstructor = undefined; // HTTP fetch
  }
}

async function createDbWithTransport(mode: TransportMode) {
  setTransport(mode);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    allowExitOnIdle: true
  });
  const db = drizzle({ client: pool, schema });
  // Ping leve para validar transporte
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    // Propagar para o caller decidir fallback
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

// Selecionar transporte inicial
let initialMode: TransportMode;
if (FORCE_WS) initialMode = 'ws';
else if (FORCE_HTTP) initialMode = 'http';
else initialMode = isBusinessHours() ? 'ws' : 'http';

// Criar cliente com fallback (HTTP → WS fora do horário comercial)
let pool: Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

export async function initDb() {
  try {
    const created = await createDbWithTransport(initialMode);
    pool = created.pool;
    db = created.db as any;
  } catch (firstErr) {
    // Fallback apenas se não estiver forçando um modo específico
    if (!FORCE_HTTP && !FORCE_WS) {
      const fallbackMode: TransportMode = initialMode === 'http' ? 'ws' : 'http';
      try {
        const createdFallback = await createDbWithTransport(fallbackMode);
        pool = createdFallback.pool;
        db = createdFallback.db as any;
        console.warn(`[db.ts] Transporte '${initialMode}' falhou, usando fallback '${fallbackMode}'.`);
      } catch (secondErr) {
        console.error('[db.ts] Falha ao inicializar DB com ambos os transportes.', firstErr, secondErr);
        throw secondErr;
      }
    } else {
      console.error(`[db.ts] Falha ao inicializar DB com transporte '${initialMode}'.`, firstErr);
      throw firstErr as Error;
    }
  }
}

export { pool, db };
