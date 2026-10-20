import { Hono } from "hono";

export type Env = {
  DB: D1Database;
};

export type Spot = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  created_at: string;
};

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/spots", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, description, lat, lng, created_at FROM spots ORDER BY created_at DESC"
  ).all<Spot>();
  return c.json(results ?? []);
});

app.post("/api/spots", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { name, description, lat, lng } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
    return c.json({ error: "name is required (max 100 characters)" }, 400);
  }
  if (description !== undefined && typeof description !== "string") {
    return c.json({ error: "description must be a string" }, 400);
  }
  const desc = (description as string | undefined)?.trim() ?? "";
  if (desc.length > 1000) {
    return c.json({ error: "description too long (max 1000 characters)" }, 400);
  }
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return c.json({ error: "lat must be a number between -90 and 90" }, 400);
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return c.json({ error: "lng must be a number between -180 and 180" }, 400);
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO spots (id, name, description, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, name.trim(), desc, lat, lng, created_at)
    .run();

  const spot: Spot = { id, name: name.trim(), description: desc, lat, lng, created_at };
  return c.json(spot, 201);
});
