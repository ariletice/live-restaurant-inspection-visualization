export type Season = "Winter" | "Spring" | "Summer" | "Fall";
export type PestType = "rats" | "mice" | "roaches" | "flies";

export type PestApiRow = {
  camis?: string;
  inspection_date?: string;
  inspection_type?: string;
  violation_code?: string;
  critical_flag?: string;
};

export type PestAnalysis = {
  inspectionCount: number;
  overallSeasonal: Record<Season, number>;
  seasonal: Record<PestType, Record<Season, number>>;
  monthly: Record<PestType, number[]>;
};

export const seasons: Season[] = ["Winter", "Spring", "Summer", "Fall"];
export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const pestConfig: Record<PestType, {
  name: string;
  singular: string;
  code: string;
  mark: string;
  color: string;
  soft: string;
  description: string;
}> = {
  rats: {
    name: "Rats",
    singular: "rat",
    code: "04K",
    mark: "🐀",
    color: "var(--orange)",
    soft: "var(--orange-soft)",
    description: "Evidence of rats or live rats in food or non-food areas.",
  },
  mice: {
    name: "Mice",
    singular: "mouse",
    code: "04L",
    mark: "🐁",
    color: "var(--green-dark)",
    soft: "var(--green)",
    description: "Evidence of mice or live mice in food or non-food areas.",
  },
  roaches: {
    name: "Roaches",
    singular: "roach",
    code: "04M",
    mark: "🪳",
    color: "var(--blue)",
    soft: "var(--blue-soft)",
    description: "Live roaches in a facility’s food or non-food areas.",
  },
  flies: {
    name: "Flies",
    singular: "fly",
    code: "04N",
    mark: "🪰",
    color: "var(--purple)",
    soft: "var(--purple-soft)",
    description: "Filth flies, food/refuse/sewage-associated flies, or other nuisance pests.",
  },
};

export const pestTypes = Object.keys(pestConfig) as PestType[];

export const fallbackPestAnalysis: PestAnalysis = {
  inspectionCount: 13158,
  overallSeasonal: { Winter: 28.7487, Spring: 28.3992, Summer: 32.5624, Fall: 35.8669 },
  seasonal: {
    rats: { Winter: 3.45, Spring: 3.98, Summer: 2.68, Fall: 2.95 },
    mice: { Winter: 17.89, Spring: 18.42, Summer: 14.46, Fall: 16.66 },
    roaches: { Winter: 4.69, Spring: 4.55, Summer: 6.57, Fall: 6.74 },
    flies: { Winter: 8.24, Spring: 6.48, Summer: 15.88, Fall: 18.53 },
  },
  monthly: {
    rats: [4.7666, 3.3223, 5.059, 3.6939, 3.2047, 3.2967, 1.5977, 3.1124, 2.8746, 2.9272, 3.035, 2.4768],
    mice: [21.8471, 14.7841, 20.742, 20.0528, 15.5135, 17.4134, 12.594, 12.9518, 15.1568, 16.693, 17.9767, 16.2539],
    roaches: [6.3555, 3.3223, 5.312, 3.9578, 4.2243, 5.2409, 7.0489, 7.6305, 6.8815, 7.2785, 6.07, 4.0248],
    flies: [8.2423, 5.1495, 5.6492, 6.7282, 7.0648, 13.0178, 17.1053, 17.9719, 20.0348, 18.2753, 17.4319, 9.6749],
  },
};

const codeToPest = new Map(Object.entries(pestConfig).map(([pest, config]) => [config.code, pest as PestType]));

function seasonForMonth(month: number): Season {
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}

function createSeasonSets(): Record<Season, Set<string>> {
  return { Winter: new Set(), Spring: new Set(), Summer: new Set(), Fall: new Set() };
}

export function calculatePestAnalysis(rows: PestApiRow[]): PestAnalysis {
  const monthlyDenominators = Array.from({ length: 12 }, () => new Set<string>());
  const seasonalDenominators = createSeasonSets();
  const overallSeasonalNumerators = createSeasonSets();
  const monthlyNumerators = Object.fromEntries(
    pestTypes.map((pest) => [pest, Array.from({ length: 12 }, () => new Set<string>())]),
  ) as Record<PestType, Set<string>[]>;
  const seasonalNumerators = Object.fromEntries(
    pestTypes.map((pest) => [pest, createSeasonSets()]),
  ) as Record<PestType, Record<Season, Set<string>>>;

  for (const row of rows) {
    if (!row.camis || !row.inspection_date || !row.inspection_type) continue;
    const date = new Date(row.inspection_date);
    if (Number.isNaN(date.getTime())) continue;
    const monthIndex = date.getUTCMonth();
    const season = seasonForMonth(monthIndex + 1);
    const inspectionKey = `${row.camis}|${row.inspection_date.slice(0, 10)}|${row.inspection_type}`;

    monthlyDenominators[monthIndex].add(inspectionKey);
    seasonalDenominators[season].add(inspectionKey);

    if (row.critical_flag !== "Critical" || !row.violation_code) continue;
    const pest = codeToPest.get(row.violation_code);
    if (!pest) continue;
    overallSeasonalNumerators[season].add(inspectionKey);
    monthlyNumerators[pest][monthIndex].add(inspectionKey);
    seasonalNumerators[pest][season].add(inspectionKey);
  }

  const inspectionCount = seasons.reduce((total, season) => total + seasonalDenominators[season].size, 0);
  if (!inspectionCount) throw new Error("No initial inspections were returned");

  const seasonal = Object.fromEntries(
    pestTypes.map((pest) => [
      pest,
      Object.fromEntries(seasons.map((season) => [
        season,
        seasonalDenominators[season].size
          ? (seasonalNumerators[pest][season].size / seasonalDenominators[season].size) * 100
          : 0,
      ])),
    ]),
  ) as PestAnalysis["seasonal"];

  const overallSeasonal = Object.fromEntries(
    seasons.map((season) => [
      season,
      seasonalDenominators[season].size
        ? (overallSeasonalNumerators[season].size / seasonalDenominators[season].size) * 100
        : 0,
    ]),
  ) as PestAnalysis["overallSeasonal"];

  const monthly = Object.fromEntries(
    pestTypes.map((pest) => [
      pest,
      monthlyDenominators.map((denominator, monthIndex) => (
        denominator.size ? (monthlyNumerators[pest][monthIndex].size / denominator.size) * 100 : 0
      )),
    ]),
  ) as PestAnalysis["monthly"];

  return { inspectionCount, overallSeasonal, seasonal, monthly };
}

export function peakSeason(values: Record<Season, number>): Season {
  return seasons.reduce((peak, season) => (values[season] > values[peak] ? season : peak), seasons[0]);
}

export function peakMonth(values: number[]): number {
  return values.reduce((peak, value, index) => (value > values[peak] ? index : peak), 0);
}

export function buildPestDataUrl(): string {
  const params = new URLSearchParams({
    "$select": "camis,inspection_date,inspection_type,violation_code,critical_flag",
    "$where": "inspection_date between '2025-01-01T00:00:00.000' and '2025-12-31T23:59:59.999' AND inspection_type like '%Initial Inspection%'",
    "$limit": "50000",
  });
  return `https://data.cityofnewyork.us/resource/43nn-pn8j.json?${params.toString()}`;
}
