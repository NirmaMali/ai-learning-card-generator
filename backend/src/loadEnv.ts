import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/** Resolve backend/.env regardless of tsx vs compiled dist/ cwd quirks. */
function findEnvFile(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend', '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

const envPath = findEnvFile();

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const ENV_FILE = envPath;
