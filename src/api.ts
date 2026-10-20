import { Hono, type MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import {
  DANGER_DEFAULT,
  DANGER_MAX,
  DANGER_MIN,
  DESCRIPTION_MAX,
  NAME_MAX,
  type Spot,
  type SpotInput,
} from "../shared/spot";
import { createAuth } from "./auth";
import type { Env } from "./env";

type SessionUser = { id: string };
type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const app = new Hono<AppEnv>();

// ---- auth ----

app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

/** Puts the signed-in user (or null) on the context. */
const session: MiddlewareHandler<AppEnv> = async (c, next) => {
  const result = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  c.set("user", result ? { id: result.user.id } : null);
  await next();
};

/** Rejects the request with 401 unless someone is signed in. Use after `session`. */
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Sign in required" }, 401);
  await next();
};

// ---- spots ----

type SpotRow = Omit<Spot, "is_mine"> & { user_id: string };

function toSpot(row: SpotRow, userId: string | null): Spot {
  const { user_id, ...rest } = row;
  return { ...rest, is_mine: userId !== null && user_id === userId };
}

/** Validates a create/update body. Returns the cleaned input or an error message. */
function parseSpotInput(body: unknown): SpotInput | string {
  const { name, description, lat, lng, danger } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > NAME_MAX) {
    return `name is required (max ${NAME_MAX} characters)`;
  }
  if (description !== undefined && typeof description !== "string") {
    return "description must be a string";
  }
  const desc = description?.trim() ?? "";
  if (desc.length > DESCRIPTION_MAX) {
    return `description too long (max ${DESCRIPTION_MAX} characters)`;
  }
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return "lat must be a number between -90 and 90";
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return "lng must be a number between -180 and 180";
  }
  if (
    danger !== undefined &&
    (typeof danger !== "number" || !Number.isInteger(danger) || danger < DANGER_MIN || danger > DANGER_MAX)
  ) {
    return `danger must be an integer between ${DANGER_MIN} and ${DANGER_MAX}`;
  }
  return { name: name.trim(), description: desc, lat, lng, danger: danger ?? DANGER_DEFAULT };
}

async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

const SPOT_COLUMNS = "id, user_id, name, description, lat, lng, danger, created_at";

// Defence in depth on top of SameSite=Lax session cookies: reject cross-origin
// form-style posts (the only cross-site requests that skip CORS preflight).
app.use("/api/spots", csrf());
app.use("/api/spots/*", csrf());
app.use("/api/spots", session);
app.use("/api/spots/*", session);

app.get("/api/spots", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT ${SPOT_COLUMNS} FROM spots ORDER BY created_at DESC`
  ).all<SpotRow>();
  return c.json((results ?? []).map((row) => toSpot(row, user?.id ?? null)));
});

app.post("/api/spots", requireUser, async (c) => {
  const user = c.get("user")!;
  const body = await readJson(c.req.raw);
  if (body === undefined) return c.json({ error: "Invalid JSON body" }, 400);
  const input = parseSpotInput(body);
  if (typeof input === "string") return c.json({ error: input }, 400);

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO spots (id, user_id, name, description, lat, lng, danger, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, user.id, input.name, input.description, input.lat, input.lng, input.danger, created_at)
    .run();

  const spot: Spot = { id, ...input, created_at, is_mine: true };
  return c.json(spot, 201);
});

// Full replace of the editable fields (same validation as POST). Only the
// owner can update; anyone else gets 404 so we don't reveal which ids exist.
app.patch("/api/spots/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const body = await readJson(c.req.raw);
  if (body === undefined) return c.json({ error: "Invalid JSON body" }, 400);
  const input = parseSpotInput(body);
  if (typeof input === "string") return c.json({ error: input }, 400);

  const row = await c.env.DB.prepare(
    `UPDATE spots SET name = ?, description = ?, lat = ?, lng = ?, danger = ?
     WHERE id = ? AND user_id = ? RETURNING ${SPOT_COLUMNS}`
  )
    .bind(input.name, input.description, input.lat, input.lng, input.danger, c.req.param("id"), user.id)
    .first<SpotRow>();

  if (!row) return c.json({ error: "Spot not found" }, 404);
  return c.json(toSpot(row, user.id));
});

app.delete("/api/spots/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const result = await c.env.DB.prepare("DELETE FROM spots WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.id)
    .run();

  if (result.meta.changes === 0) return c.json({ error: "Spot not found" }, 404);
  return c.body(null, 204);
});
