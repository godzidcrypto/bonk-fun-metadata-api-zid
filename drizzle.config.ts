import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { metadataEnv } from './env';

export default defineConfig({
  out: './drizzle',
  schema: './db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: metadataEnv.DB_FILE,
  },
});