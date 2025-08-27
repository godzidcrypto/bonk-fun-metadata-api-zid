import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { metadataEnv } from "../env";

console.log("Starting migration script...");
console.log("DB_FILE:", metadataEnv.DB_FILE);

const sqlite = new Database(metadataEnv.DB_FILE);
const db = drizzle(sqlite);
console.log("Created drizzle instance");

console.log("Running migrations from ./drizzle folder...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migration completed!");
