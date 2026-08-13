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
  latitude?: string;
  longitude?: string;
};

type ScoredInspection = {
  camis: string;
  key: string;
  date: string;
  type: string;
  score: number;
  grade: string;
};

function scoredInitialInspections(rows: InspectionRow[], year?: number): ScoredInspection[] {
  const inspections = new Map<string, ScoredInspection>();
  for (const row of rows) {
    if (!row.camis || !row.inspection_date || !row.inspection_type?.includes("Initial Inspection") || row.score == null) continue;
    const score = Number(row.score);
    if (!Number.isFinite(score) || (year && !row.inspection_date.startsWith(`${year}-`))) continue;
    const key = `${row.camis}|${row.inspection_date.slice(0, 10)}|${row.inspection_type}`;
    const inspection = inspections.get(key) ?? {
      camis: row.camis,
      key,
      date: row.inspection_date,
      type: row.inspection_type,
      score,
      grade: row.grade || "Not graded",
    };
    if (row.grade && inspection.grade === "Not graded") inspection.grade = row.grade;
    inspections.set(key, inspection);
  }
  return [...inspections.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function latestInspectionPerRestaurant(inspections: ScoredInspection[]) {
  const latest = new Map<string, ScoredInspection>();
  for (const inspection of inspections) {
    const existing = latest.get(inspection.camis);
    if (!existing || inspection.date > existing.date) latest.set(inspection.camis, inspection);
  }
  return [...latest.values()];
}

function medianScore(inspections: ScoredInspection[]) {
  const scores = inspections.map((inspection) => inspection.score).sort((a, b) => a - b);
  const midpoint = Math.floor(scores.length / 2);
  return scores.length % 2 ? scores[midpoint] : (scores[midpoint - 1] + scores[midpoint]) / 2;
}

export async function GET(_request: Request, context: { params: Promise<{ camis: string }> }) {
  const { camis } = await context.params;
  if (!/^\d{8}$/.test(camis)) {
    return Response.json({ error: "That restaurant identifier is invalid." }, { status: 400 });
  }

  const params = new URLSearchParams({
    "$select": "camis,dba,boro,building,street,zipcode,inspection_date,inspection_type,action,violation_code,violation_description,score,grade,latitude,longitude",
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

    const targetInitialInspections = scoredInitialInspections(rows);
    const targetInspection = targetInitialInspections[0];
    let nearbyComparison: RestaurantHistory["nearbyComparison"] = {
      status: "unavailable",
      reason: "A nearby comparison could not be calculated for this restaurant.",
    };
    const latitude = Number(profile.latitude);
    const longitude = Number(profile.longitude);
    if (!targetInspection) {
      nearbyComparison = { status: "unavailable", reason: "This restaurant does not have a scored initial inspection available for comparison." };
    } else if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0) {
      try {
        const radiusMeters = 500;
        const comparisonYear = Number(targetInspection.date.slice(0, 4));
        const nearbyParams = new URLSearchParams({
          "$select": "camis,dba,inspection_date,inspection_type,score,grade",
          "$where": `within_circle(location,${latitude},${longitude},${radiusMeters}) AND camis != '${camis}' AND inspection_date between '${comparisonYear}-01-01T00:00:00.000' and '${comparisonYear}-12-31T23:59:59.999' AND inspection_type like '%Initial Inspection%' AND score IS NOT NULL`,
          "$order": "camis,inspection_date DESC,inspection_type",
          "$limit": "50000",
        });
        const nearbyResponse = await fetch(`${endpoint}?${nearbyParams}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!nearbyResponse.ok) throw new Error("Nearby NYC Open Data request failed");
        const nearbyRows = (await nearbyResponse.json()) as InspectionRow[];
        const nearbyInspections = latestInspectionPerRestaurant(scoredInitialInspections(nearbyRows, comparisonYear));
        if (nearbyInspections.length) {
          const nearbyARangeCount = nearbyInspections.filter((inspection) => inspection.score <= 13).length;
          nearbyComparison = {
            status: "available",
            radiusMeters,
            comparisonYear,
            targetInspection: {
              date: targetInspection.date,
              type: targetInspection.type,
              score: targetInspection.score,
              grade: targetInspection.grade,
            },
            nearbyRestaurantCount: nearbyInspections.length,
            nearbyMedianScore: medianScore(nearbyInspections),
            nearbyARangeCount,
            nearbyARangeRate: (nearbyARangeCount / nearbyInspections.length) * 100,
          };
        } else {
          nearbyComparison = { status: "unavailable", reason: `No comparable scored initial inspections from ${comparisonYear} were found within 500 meters.` };
        }
      } catch {
        nearbyComparison = { status: "unavailable", reason: "Nearby inspection data is temporarily unavailable." };
      }
    } else {
      nearbyComparison = { status: "unavailable", reason: "NYC Open Data does not provide usable coordinates for this restaurant." };
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
      nearbyComparison,
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
