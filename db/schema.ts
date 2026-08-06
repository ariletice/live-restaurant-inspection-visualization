import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const audienceVotes = sqliteTable("audience_votes", {
  voterId: text("voter_id").primaryKey(),
  season: text("season").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const audienceVotesSchemaSql = `
  CREATE TABLE IF NOT EXISTS audience_votes (
    voter_id TEXT PRIMARY KEY NOT NULL,
    season TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
`;
