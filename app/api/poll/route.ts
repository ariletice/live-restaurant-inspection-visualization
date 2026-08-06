import { count, sql } from "drizzle-orm";
import { ensureDatabaseSchema, getDb } from "../../../db";
import { audienceVotes } from "../../../db/schema";
import { seasons, type Season } from "../../pest-data";

type PollCounts = Record<Season, number>;

function emptyCounts(): PollCounts {
  return { Winter: 0, Spring: 0, Summer: 0, Fall: 0 };
}

function pollError(error: unknown) {
  const message = error instanceof Error ? error.message : "Audience voting is temporarily unavailable.";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  return `${message}\n${cause}`.includes("no such table")
    ? "Audience voting is not initialized yet. Apply the saved database migration before collecting responses."
    : message;
}

export async function GET() {
  try {
    await ensureDatabaseSchema();
    const db = getDb();
    const rows = await db
      .select({ season: audienceVotes.season, votes: count() })
      .from(audienceVotes)
      .groupBy(audienceVotes.season);
    const counts = emptyCounts();
    for (const row of rows) {
      if (seasons.includes(row.season as Season)) counts[row.season as Season] = row.votes;
    }
    return Response.json({ counts, total: Object.values(counts).reduce((sum, votes) => sum + votes, 0) });
  } catch (error) {
    return Response.json({ error: pollError(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { season?: string; voterId?: string };
    if (!payload.season || !seasons.includes(payload.season as Season)) {
      return Response.json({ error: "Choose a valid season." }, { status: 400 });
    }
    if (!payload.voterId || !/^[a-zA-Z0-9-]{16,80}$/.test(payload.voterId)) {
      return Response.json({ error: "A valid anonymous voter ID is required." }, { status: 400 });
    }

    await ensureDatabaseSchema();
    const db = getDb();
    await db
      .insert(audienceVotes)
      .values({ voterId: payload.voterId, season: payload.season })
      .onConflictDoUpdate({
        target: audienceVotes.voterId,
        set: { season: payload.season, updatedAt: sql`CURRENT_TIMESTAMP` },
      });

    return GET();
  } catch (error) {
    return Response.json({ error: pollError(error) }, { status: 503 });
  }
}
