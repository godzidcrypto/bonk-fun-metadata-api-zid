import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { metadataEnv } from "../env.js";

const client = createClient({
  url: metadataEnv.DB_FILE,
});

const db = drizzle(client);
migrate(db, { migrationsFolder: "./drizzle" });
