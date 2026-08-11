import type { RestaurantMatch } from "../../../restaurant/restaurant-types";

const endpoint = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";

type SearchRow = {
  camis?: string;
  dba?: string;
  boro?: string;
  building?: string;
  street?: string;
  zipcode?: string;
};

function escapeSoql(value: string) {
  return value.replaceAll("'", "''");
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ error: "Enter at least two characters." }, { status: 400 });
  }

  const term = escapeSoql(query.toUpperCase());
  const params = new URLSearchParams({
    "$select": "camis,dba,boro,building,street,zipcode",
    "$where": `upper(dba) like '%${term}%' OR upper(street) like '%${term}%'`,
    "$group": "camis,dba,boro,building,street,zipcode",
    "$order": "dba,boro,street",
    "$limit": "12",
  });

  try {
    const response = await fetch(`${endpoint}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("NYC Open Data request failed");
    const rows = (await response.json()) as SearchRow[];
    const restaurants: RestaurantMatch[] = rows
      .filter((row): row is SearchRow & { camis: string; dba: string } => Boolean(row.camis && row.dba))
      .map((row) => ({
        camis: row.camis,
        name: row.dba,
        borough: row.boro || "Borough unavailable",
        building: row.building || "",
        street: row.street || "Address unavailable",
        zipcode: row.zipcode || "",
      }));
    return Response.json({ restaurants });
  } catch {
    return Response.json(
      { error: "We couldn't search NYC inspection records right now. Please try again." },
      { status: 503 },
    );
  }
}
