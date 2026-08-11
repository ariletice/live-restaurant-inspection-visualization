import type {
  PestViolation,
  RestaurantHistory,
  RestaurantInspection,
} from "../../../restaurant/restaurant-types";

const endpoint = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";
const pestCodes = new Set<PestViolation["code"]>(["04K", "04L", "04M", "04N"]);

type InspectionRow = {
  camis?: string;
  dba?: string;
  boro?: string;
  building?: string;
  street?: string;
  zipcode?: string;
  inspection_date?: string;
  inspection_type?: string;
  action?: string;
  violation_code?: string;
  violation_description?: string;
  score?: string;
  grade?: string;
};

export async function GET(_request: Request, context: { params: Promise<{ camis: string }> }) {
  const { camis } = await context.params;
  if (!/^\d{8}$/.test(camis)) {
    return Response.json({ error: "That restaurant identifier is invalid." }, { status: 400 });
  }

  const params = new URLSearchParams({
    "$select": "camis,dba,boro,building,street,zipcode,inspection_date,inspection_type,action,violation_code,violation_description,score,grade",
    "$where": `camis='${camis}'`,
    "$order": "inspection_date DESC,inspection_type,violation_code",
    "$limit": "5000",
  });

  try {
    const response = await fetch(`${endpoint}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("NYC Open Data request failed");
    const rows = (await response.json()) as InspectionRow[];
    const profile = rows.find((row) => row.camis && row.dba);
    if (!profile?.camis || !profile.dba) {
      return Response.json({ error: "We couldn't find inspection records for that restaurant." }, { status: 404 });
    }

    const inspectionMap = new Map<string, RestaurantInspection>();
    for (const row of rows) {
      if (!row.inspection_date) continue;
      const type = row.inspection_type || "Inspection type unavailable";
      const key = `${row.inspection_date.slice(0, 10)}|${type}`;
      const inspection = inspectionMap.get(key) ?? {
        key,
        date: row.inspection_date,
        type,
        action: row.action || "Outcome unavailable",
        grade: row.grade || "Not graded",
        score: row.score || "Not reported",
        pestViolations: [],
      };
      if (row.grade && inspection.grade === "Not graded") inspection.grade = row.grade;
      if (row.score && inspection.score === "Not reported") inspection.score = row.score;
      if (row.action && inspection.action === "Outcome unavailable") inspection.action = row.action;
      if (row.violation_code && pestCodes.has(row.violation_code as PestViolation["code"])) {
        const code = row.violation_code as PestViolation["code"];
        if (!inspection.pestViolations.some((violation) => violation.code === code)) {
          inspection.pestViolations.push({
            code,
            description: row.violation_description || "Official violation description unavailable",
          });
        }
      }
      inspectionMap.set(key, inspection);
    }

    const history: RestaurantHistory = {
      restaurant: {
        camis: profile.camis,
        name: profile.dba,
        borough: profile.boro || "Borough unavailable",
        building: profile.building || "",
        street: profile.street || "Address unavailable",
        zipcode: profile.zipcode || "",
      },
      inspections: [...inspectionMap.values()],
      sourceUrl: `https://data.cityofnewyork.us/resource/43nn-pn8j.json?camis=${camis}`,
    };
    return Response.json(history);
  } catch {
    return Response.json(
      { error: "We couldn't retrieve this restaurant's inspection information right now. Please try again." },
      { status: 503 },
    );
  }
}
