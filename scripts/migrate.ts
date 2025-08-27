import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { metadataEnv } from "../env";

console.log("Starting migration script...");
console.log("DB_FILE:", metadataEnv.DB_FILE);

const client = createClient({
  url: metadataEnv.DB_FILE,
});

const db = drizzle(client);
console.log("Created drizzle instance");

console.log("Running migrations from ./drizzle folder...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migration completed!");
