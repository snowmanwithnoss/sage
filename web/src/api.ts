export type Spot = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
  created_at: string;
};

export const DANGER_MAX = 5;
export const DANGER_DEFAULT = 3;

export async function fetchSpots(): Promise<Spot[]> {
  const res = await fetch("/api/spots");
  if (!res.ok) throw new Error(`Failed to load spots (${res.status})`);
  return (await res.json()) as Spot[];
}

export async function createSpot(input: {
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
}): Promise<Spot> {
  const res = await fetch("/api/spots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to add spot (${res.status})`);
  }
  return (await res.json()) as Spot;
}
