import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('[db.ts] ERRO: DATABASE_URL não está definida!');
  console.error('[db.ts] process.cwd():', process.cwd());
  console.error('[db.ts] Conteúdo de process.env.DATABASE_URL:', process.env.DATABASE_URL);
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
