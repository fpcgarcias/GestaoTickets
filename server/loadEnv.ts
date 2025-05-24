import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error(`[loadEnv.ts] CRITICAL ERROR: .env file DOES NOT EXIST at ${envPath}`);
}

const dotenvResult = dotenv.config({ path: envPath }); 

if (dotenvResult.error) {
  console.error('[loadEnv.ts] Error loading .env file (explicit path):', dotenvResult.error);
  console.log('[loadEnv.ts] Attempting to load .env using default dotenv behavior (fallback)...');
  const fallbackResult = dotenv.config();
  if (fallbackResult.error) {
    console.error('[loadEnv.ts] Error loading .env file (fallback):', fallbackResult.error);
  }
}

export {}; // Ensures this file is treated as a module 