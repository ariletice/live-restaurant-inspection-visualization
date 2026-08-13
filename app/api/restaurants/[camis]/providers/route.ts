import type {
  ProviderSearchResponse,
  RegisteredPestProvider,
  RestaurantMatch,
} from "../../../../restaurant/restaurant-types";

const restaurantEndpoint = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";
const providerEndpoint = "https://data.ny.gov/resource/h8u2-6ejg.json";
const providerDatasetUrl = "https://data.ny.gov/Energy-Environment/Currently-Registered-Pesticide-Businesses-and-Agen/h8u2-6ejg";
const officialVerificationUrl = "https://extapps.dec.ny.gov/nyspad/find?1";

type RestaurantRow = {
  camis?: string;
  dba?: string;
  boro?: string;
  building?: string;
  street?: string;
  zipcode?: string;
  latitude?: string;
  longitude?: string;
};

type ProviderRow = {
  business_agency_name?: string;
  registration_number?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  registration_expiration_date?: string;
  pesticide_category_code?: string;
  pesticide_category_desc?: string;
  location_1?: {
    latitude?: string;
    longitude?: string;
  };
};

function milesBetween(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const startLatitude = radians(latitudeA);
  const endLatitude = radians(latitudeB);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function googleMapsSearchUrl(row: ProviderRow) {
  const query = [row.business_agency_name, row.city, row.state, row.zip_code].filter(Boolean).join(", ");
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}

function restaurantProfile(row: RestaurantRow): RestaurantMatch | null {
  if (!row.camis || !row.dba) return null;
  return {
    camis: row.camis,
    name: row.dba,
    borough: row.boro || "Borough unavailable",
    building: row.building || "",
    street: row.street || "Address unavailable",
    zipcode: row.zipcode || "",
  };
}

export async function GET(request: Request, context: { params: Promise<{ camis: string }> }) {
  const { camis } = await context.params;
  if (!/^\d{8}$/.test(camis)) {
    return Response.json({ error: "That restaurant identifier is invalid." }, { status: 400 });
  }

  const radiusValue = new URL(request.url).searchParams.get("radius") ?? "5";
  if (radiusValue !== "5" && radiusValue !== "15") {
    return Response.json({ error: "Choose a provider radius of 5 or 15 miles." }, { status: 400 });
  }
  const radiusMiles = Number(radiusValue) as 5 | 15;

  try {
    const restaurantParams = new URLSearchParams({
      "$select": "camis,dba,boro,building,street,zipcode,latitude,longitude",
      "$where": `camis='${camis}'`,
      "$limit": "1",
    });
    const restaurantResponse = await fetch(`${restaurantEndpoint}?${restaurantParams}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!restaurantResponse.ok) throw new Error("NYC Open Data request failed");
    const restaurantRows = (await restaurantResponse.json()) as RestaurantRow[];
    const row = restaurantRows[0];
    const restaurant = row ? restaurantProfile(row) : null;
    if (!row || !restaurant) {
      return Response.json({ error: "We couldn't find that restaurant in NYC inspection records." }, { status: 404 });
    }

    const restaurantLatitude = Number(row.latitude);
    const restaurantLongitude = Number(row.longitude);
    if (!Number.isFinite(restaurantLatitude) || !Number.isFinite(restaurantLongitude) || restaurantLatitude === 0 || restaurantLongitude === 0) {
      return Response.json({ error: "NYC Open Data does not provide a usable location for this restaurant." }, { status: 422 });
    }

    const radiusMeters = Math.ceil(radiusMiles * 1609.344);
    const today = new Date().toISOString().slice(0, 10);
    const providerParams = new URLSearchParams({
      "$select": "business_agency_name,registration_number,city,state,zip_code,registration_expiration_date,pesticide_category_code,pesticide_category_desc,location_1",
      "$where": `pesticide_category_code='7f' AND registration_expiration_date >= '${today}T00:00:00.000' AND within_circle(location_1,${restaurantLatitude},${restaurantLongitude},${radiusMeters})`,
      "$limit": "2000",
    });
    const providerResponse = await fetch(`${providerEndpoint}?${providerParams}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!providerResponse.ok) throw new Error("NYS Open Data request failed");
    const providerRows = (await providerResponse.json()) as ProviderRow[];

    const providersByRegistration = new Map<string, RegisteredPestProvider>();
    for (const providerRow of providerRows) {
      const latitude = Number(providerRow.location_1?.latitude);
      const longitude = Number(providerRow.location_1?.longitude);
      if (!providerRow.business_agency_name || !providerRow.registration_number || !providerRow.registration_expiration_date) continue;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const approximateDistanceMiles = milesBetween(
        restaurantLatitude,
        restaurantLongitude,
        latitude,
        longitude,
      );
      if (approximateDistanceMiles > radiusMiles) continue;

      const provider: RegisteredPestProvider = {
        businessName: providerRow.business_agency_name,
        registrationNumber: providerRow.registration_number,
        registrationStatus: "Listed in current NYS registration data",
        categoryCode: "7F",
        categoryDescription: "Food Processing",
        expirationDate: providerRow.registration_expiration_date,
        city: providerRow.city || "City unavailable",
        state: providerRow.state || "NY",
        zipcode: providerRow.zip_code || "ZIP unavailable",
        approximateDistanceMiles,
        googleMapsSearchUrl: googleMapsSearchUrl(providerRow),
        officialVerificationUrl,
      };
      const existing = providersByRegistration.get(provider.registrationNumber);
      if (!existing || provider.approximateDistanceMiles < existing.approximateDistanceMiles) {
        providersByRegistration.set(provider.registrationNumber, provider);
      }
    }

    const providers = [...providersByRegistration.values()]
      .sort((providerA, providerB) => providerA.approximateDistanceMiles - providerB.approximateDistanceMiles
        || providerA.businessName.localeCompare(providerB.businessName))
      .slice(0, 10);

    const payload: ProviderSearchResponse = {
      restaurant,
      radiusMiles,
      providers,
      orderingExplanation: "All results are currently listed in New York State Category 7F and are ordered by approximate distance from the restaurant. Ratings do not influence placement.",
      source: {
        name: "Currently Registered Pesticide Businesses and Agencies",
        url: providerDatasetUrl,
        retrievedAt: new Date().toISOString(),
      },
    };
    return Response.json(payload);
  } catch {
    return Response.json(
      { error: "We couldn't retrieve New York State provider records right now. Please try again." },
      { status: 503 },
    );
  }
}
