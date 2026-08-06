import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function ensureDatabaseSchema() {
  if (!env.DB) {
    return Promise.reject(new Error("Cloudflare D1 binding `DB` is unavailable."));
  }
  if (!schemaReady) {
    schemaReady = env.DB.prepare(schema.audienceVotesSchemaSql).run().then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
