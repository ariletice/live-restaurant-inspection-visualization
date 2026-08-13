export type RestaurantMatch = {
  camis: string;
  name: string;
  borough: string;
  building: string;
  street: string;
  zipcode: string;
};

export type PestViolation = {
  code: "04K" | "04L" | "04M" | "04N";
  description: string;
};

export type RestaurantInspection = {
  key: string;
  date: string;
  type: string;
  action: string;
  grade: string;
  score: string;
  pestViolations: PestViolation[];
};

export type RestaurantHistory = {
  restaurant: RestaurantMatch;
  inspections: RestaurantInspection[];
  nearbyComparison: {
    status: "available";
    radiusMeters: number;
    comparisonYear: number;
    targetInspection: {
      date: string;
      type: string;
      score: number;
      grade: string;
    };
    nearbyRestaurantCount: number;
    nearbyMedianScore: number;
    nearbyARangeCount: number;
    nearbyARangeRate: number;
  } | {
    status: "unavailable";
    reason: string;
  };
  sourceUrl: string;
};

export const pestGuidance: Record<PestViolation["code"], {
  label: string;
  plainLanguage: string;
  nextStep: string;
}> = {
  "04K": {
    label: "Rat evidence",
    plainLanguage: "An inspector recorded evidence of rats or live rats in a food or non-food area.",
    nextStep: "Inspect exterior gaps, basement areas, garbage storage, and door sweeps; document findings for a licensed pest professional.",
  },
  "04L": {
    label: "Mouse evidence",
    plainLanguage: "An inspector recorded evidence of mice or live mice in a food or non-food area.",
    nextStep: "Check small openings around pipes, cabinets, storage areas, and equipment; remove accessible food and nesting material.",
  },
  "04M": {
    label: "Live roaches",
    plainLanguage: "An inspector recorded live roaches in a food or non-food area.",
    nextStep: "Review moisture, grease buildup, cracks, warm equipment areas, and monitoring logs with a licensed pest professional.",
  },
  "04N": {
    label: "Flies or related pests",
    plainLanguage: "An inspector recorded filth flies, food-, refuse-, or sewage-associated flies, or another nuisance pest covered by this code.",
    nextStep: "Inspect drains, waste areas, standing water, produce storage, and door or window screens; correct breeding and entry conditions.",
  },
};
