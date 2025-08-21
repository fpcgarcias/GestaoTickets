import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configurar WebSocket apenas durante horário comercial
const isBusinessHours = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 6 && hour < 21;
};

// Só configurar WebSocket durante horário comercial
if (isBusinessHours()) {
  neonConfig.webSocketConstructor = ws;
} else {
  // Durante a madrugada, usar HTTP apenas (mais lento, mas hiberna)
  neonConfig.webSocketConstructor = undefined;
}

if (!process.env.DATABASE_URL) {
  console.error('[db.ts] ERRO: DATABASE_URL não está definida!');
  console.error('[db.ts] process.cwd():', process.cwd());
  console.error('[db.ts] Conteúdo de process.env.DATABASE_URL:', process.env.DATABASE_URL);
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Configurações para reduzir conexões persistentes
  max: 10, // Máximo de conexões no pool
  idleTimeoutMillis: 30000, // Fechar conexões ociosas após 30 segundos
  connectionTimeoutMillis: 2000, // Timeout de conexão de 2 segundos
  // Não manter conexões persistentes durante a madrugada
  allowExitOnIdle: true
});
export const db = drizzle({ client: pool, schema });
