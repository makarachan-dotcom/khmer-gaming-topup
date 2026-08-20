import { makeRequest, type GeocodingResult } from "./_core/map";

export type LocationRisk = "low" | "medium" | "high";

export function deriveLocationRisk(accuracyMeters: number): LocationRisk {
  if (accuracyMeters <= 250) return "low";
  if (accuracyMeters <= 5_000) return "medium";
  return "high";
}

export async function resolveLocationCountry(latitude: number, longitude: number) {
  const response = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { latlng: `${latitude},${longitude}`, result_type: "country" });
  const country = response.results.flatMap((result) => result.address_components).find((component) => component.types.includes("country"))?.short_name?.toUpperCase();
  if (!country) throw new Error("Unable to confirm the country from this location");
  return country;
}
