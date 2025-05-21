import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.resolve(process.cwd(), '.env');

console.log(`[loadEnv.ts] Current working directory (process.cwd()): ${process.cwd()}`);
console.log(`[loadEnv.ts] Attempting to load .env file from path: ${envPath}`);

if (fs.existsSync(envPath)) {
  console.log(`[loadEnv.ts] Confirmed: .env file EXISTS at ${envPath}`);
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    console.log(`[loadEnv.ts] .env file content (first 200 chars):\n---BEGIN .ENV CONTENT---\n${content.substring(0, 200)}
---END .ENV CONTENT---`);
    if(content.includes("DATABASE_URL=")) {
      console.log("[loadEnv.ts] Sanity check: String 'DATABASE_URL=' FOUND in .env file content.");
    } else {
      console.warn("[loadEnv.ts] Sanity check WARNING: String 'DATABASE_URL=' NOT FOUND in .env file content.");
    }
  } catch(e) {
    console.error("[loadEnv.ts] Error reading .env file content for debugging:", e);
  }
} else {
  console.error(`[loadEnv.ts] CRITICAL ERROR: .env file DOES NOT EXIST at ${envPath}`);
}

const dotenvResult = dotenv.config({ path: envPath, debug: true }); // Habilitando debug do dotenv

if (dotenvResult.error) {
  console.error('[loadEnv.ts] Error loading .env file (explicit path):', dotenvResult.error);
  console.log('[loadEnv.ts] Attempting to load .env using default dotenv behavior (fallback)...');
  const fallbackResult = dotenv.config({ debug: true });
  if (fallbackResult.error) {
    console.error('[loadEnv.ts] Error loading .env file (fallback):', fallbackResult.error);
  } else {
    console.log('[loadEnv.ts] Fallback dotenv.config() loaded successfully.');
    if (fallbackResult.parsed) {
      console.log('[loadEnv.ts] Variables parsed by fallback dotenv.config():', Object.keys(fallbackResult.parsed));
    }
  }
} else {
  console.log('[loadEnv.ts] .env file loaded successfully using explicit path.');
  if (dotenvResult.parsed) {
    console.log('[loadEnv.ts] Variables parsed from .env (explicit path):', Object.keys(dotenvResult.parsed));
  }
}

console.log('[loadEnv.ts] Value of process.env.DATABASE_URL after dotenv attempts:', 
  process.env.DATABASE_URL ? `DEFINED (starts with: ${process.env.DATABASE_URL.substring(0, 30)}...)` : 'NOT DEFINED'
);

export {}; // Ensures this file is treated as a module 