import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { metadataEnv } from "../env.js";

export const db = drizzle({
  connection: {
    url: metadataEnv.DB_FILE,
  },
  schema,
});
