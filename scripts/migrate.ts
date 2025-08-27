import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { metadataEnv } from "../env";

const sqlite = new Database(metadataEnv.DB_FILE);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: "./drizzle" });