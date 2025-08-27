import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { metadataEnv } from '../env';

export const db = drizzle({ 
  connection: {
    url: metadataEnv.DB_FILE
  },
  schema
});