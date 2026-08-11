import { getStore } from "@netlify/blobs";
import { seasons, type Season } from "../../pest-data";

type PollCounts = Record<Season, number>;

const storeName = "nyc-pest-season-poll";

function emptyCounts(): PollCounts {
  return { Winter: 0, Spring: 0, Summer: 0, Fall: 0 };
}

async function readPoll() {
  const store = getStore(storeName);
  const { blobs } = await store.list({ prefix: "votes/" });
  const votes = await Promise.all(
    blobs.map((blob) =>
      store.get(blob.key, { consistency: "strong", type: "json" }) as Promise<{ season?: string } | null>,
    ),
  );
  const counts = emptyCounts();
  for (const vote of votes) {
    if (vote?.season && seasons.includes(vote.season as Season)) {
      counts[vote.season as Season] += 1;
    }
  }
  return { counts, total: votes.length };
}

export async function GET() {
  try {
    return Response.json(await readPoll());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audience voting is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
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

    const store = getStore(storeName);
    await store.setJSON(`votes/${payload.voterId}`, { season: payload.season });
    return Response.json(await readPoll());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audience voting is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}
