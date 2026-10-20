import type { Spot, SpotInput } from "../../shared/spot";

export type { Spot, SpotInput } from "../../shared/spot";
export { DANGER_DEFAULT, DANGER_MAX, DANGER_MIN, NAME_MAX, DESCRIPTION_MAX } from "../../shared/spot";

/** An API failure; `status` lets callers react to e.g. 401 (session expired). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function errorFrom(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new ApiError(body?.error ?? `${fallback} (${res.status})`, res.status);
}

export async function fetchSpots(): Promise<Spot[]> {
  const res = await fetch("/api/spots");
  if (!res.ok) throw await errorFrom(res, "Failed to load spots");
  return (await res.json()) as Spot[];
}

export async function createSpot(input: SpotInput): Promise<Spot> {
  const res = await fetch("/api/spots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to add spot");
  return (await res.json()) as Spot;
}

export async function updateSpot(id: string, input: SpotInput): Promise<Spot> {
  const res = await fetch(`/api/spots/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to update spot");
  return (await res.json()) as Spot;
}

export async function deleteSpot(id: string): Promise<void> {
  const res = await fetch(`/api/spots/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await errorFrom(res, "Failed to delete spot");
}
