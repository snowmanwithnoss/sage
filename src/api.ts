import { Hono, type MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import {
  DANGER_DEFAULT,
  DANGER_MAX,
  DANGER_MIN,
  DESCRIPTION_MAX,
  NAME_MAX,
  PHOTO_FULL_EDGE,
  PHOTO_FULL_MAX_BYTES,
  PHOTO_THUMB_MAX_BYTES,
  PHOTOS_MAX,
  type Spot,
  type SpotInput,
  type SpotPhoto,
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

type SpotRow = Omit<Spot, "is_mine" | "photos"> & { user_id: string };

function toSpot(row: SpotRow, userId: string | null, photos: SpotPhoto[] = []): Spot {
  const { user_id, ...rest } = row;
  return { ...rest, is_mine: userId !== null && user_id === userId, photos };
}

type PhotoRow = SpotPhoto & { spot_id: string };
const PHOTO_COLUMNS = "id, spot_id, width, height, position";

/** All photos of the given spot ids, grouped by spot (one query, ordered by position). */
async function photosBySpot(db: D1Database, spotId?: string): Promise<Map<string, SpotPhoto[]>> {
  const stmt = spotId
    ? db.prepare(`SELECT ${PHOTO_COLUMNS} FROM spot_photos WHERE spot_id = ? ORDER BY position, created_at`).bind(spotId)
    : db.prepare(`SELECT ${PHOTO_COLUMNS} FROM spot_photos ORDER BY spot_id, position, created_at`);
  const { results } = await stmt.all<PhotoRow>();
  const map = new Map<string, SpotPhoto[]>();
  for (const { spot_id, ...photo } of results ?? []) {
    const list = map.get(spot_id);
    if (list) list.push(photo);
    else map.set(spot_id, [photo]);
  }
  return map;
}

/** KV keys for a photo's two renditions. */
const photoKey = (photoId: string, size: "full" | "thumb") => `photo/${photoId}/${size}`;

/** Best-effort removal of a photo's bytes from KV (each delete counts as a KV write). */
async function deletePhotoBlobs(kv: KVNamespace, photoIds: string[]): Promise<void> {
  await Promise.allSettled(
    photoIds.flatMap((id) => [kv.delete(photoKey(id, "full")), kv.delete(photoKey(id, "thumb"))])
  );
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
  const [{ results }, photos] = await Promise.all([
    c.env.DB.prepare(`SELECT ${SPOT_COLUMNS} FROM spots ORDER BY created_at DESC`).all<SpotRow>(),
    photosBySpot(c.env.DB),
  ]);
  return c.json((results ?? []).map((row) => toSpot(row, user?.id ?? null, photos.get(row.id))));
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

  const spot: Spot = { id, ...input, created_at, is_mine: true, photos: [] };
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
  const photos = await photosBySpot(c.env.DB, row.id);
  return c.json(toSpot(row, user.id, photos.get(row.id)));
});

app.delete("/api/spots/:id", requireUser, async (c) => {
  const user = c.get("user")!;
  const spotId = c.req.param("id");
  // Read the photo ids first: the rows cascade away with the spot, but the
  // KV bytes don't.
  const { results: photoRows } = await c.env.DB.prepare(
    `SELECT p.id FROM spot_photos p JOIN spots s ON s.id = p.spot_id WHERE s.id = ? AND s.user_id = ?`
  )
    .bind(spotId, user.id)
    .all<{ id: string }>();
  const result = await c.env.DB.prepare("DELETE FROM spots WHERE id = ? AND user_id = ?")
    .bind(spotId, user.id)
    .run();

  if (result.meta.changes === 0) return c.json({ error: "Spot not found" }, 404);
  await deletePhotoBlobs(c.env.PHOTOS, (photoRows ?? []).map((r) => r.id));
  return c.body(null, 204);
});

// ---- photos ----
// Bytes live in KV (PHOTOS), the index in D1 (spot_photos). The client
// resizes and re-encodes before upload (which also strips EXIF/GPS), so the
// server only checks type, magic bytes, size and declared dimensions.

const PHOTO_TYPES = ["image/jpeg", "image/webp"] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

/** Sniffs JPEG (FF D8 FF) or WebP (RIFF....WEBP) from the first bytes. */
function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Validates one uploaded image part. Returns its bytes + type, or an error message. */
async function readImagePart(
  value: unknown,
  name: string,
  maxBytes: number
): Promise<{ bytes: ArrayBuffer; type: PhotoType } | string> {
  if (!(value instanceof File)) return `${name} image is required`;
  if (!(PHOTO_TYPES as readonly string[]).includes(value.type)) return `${name} must be image/jpeg or image/webp`;
  if (value.size === 0) return `${name} image is empty`;
  if (value.size > maxBytes) return `${name} image too large (max ${Math.round(maxBytes / 1000)} KB)`;
  const bytes = await value.arrayBuffer();
  const sniffed = sniffImageType(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
  if (sniffed !== value.type) return `${name} is not a valid ${value.type} file`;
  return { bytes, type: sniffed };
}

function parseDimension(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= PHOTO_FULL_EDGE ? n : null;
}

// Multipart body with the full image, thumb and full-size width/height.
const UPLOAD_MAX_BYTES = PHOTO_FULL_MAX_BYTES + PHOTO_THUMB_MAX_BYTES + 64_000;

app.post("/api/spots/:id/photos", requireUser, async (c) => {
  const user = c.get("user")!;
  const spotId = c.req.param("id");

  const length = Number(c.req.header("content-length") ?? "0");
  if (length > UPLOAD_MAX_BYTES) return c.json({ error: "Upload too large" }, 413);

  // Owner check + limit before touching KV (KV writes are the scarce resource).
  const spot = await c.env.DB.prepare(
    "SELECT s.id, (SELECT COUNT(*) FROM spot_photos p WHERE p.spot_id = s.id) AS count FROM spots s WHERE s.id = ? AND s.user_id = ?"
  )
    .bind(spotId, user.id)
    .first<{ id: string; count: number }>();
  if (!spot) return c.json({ error: "Spot not found" }, 404);
  if (spot.count >= PHOTOS_MAX) return c.json({ error: `A spot can have at most ${PHOTOS_MAX} photos` }, 409);

  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    return c.json({ error: "Expected a multipart/form-data body" }, 400);
  }
  const width = parseDimension(form.get("width"));
  const height = parseDimension(form.get("height"));
  if (width === null || height === null) {
    return c.json({ error: `width and height must be integers between 1 and ${PHOTO_FULL_EDGE}` }, 400);
  }
  const full = await readImagePart(form.get("full"), "full", PHOTO_FULL_MAX_BYTES);
  if (typeof full === "string") return c.json({ error: full }, 400);
  const thumb = await readImagePart(form.get("thumb"), "thumb", PHOTO_THUMB_MAX_BYTES);
  if (typeof thumb === "string") return c.json({ error: thumb }, 400);

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await Promise.all([
    c.env.PHOTOS.put(photoKey(id, "full"), full.bytes, { metadata: { contentType: full.type } }),
    c.env.PHOTOS.put(photoKey(id, "thumb"), thumb.bytes, { metadata: { contentType: thumb.type } }),
  ]);

  // Re-checks ownership and the limit atomically (two uploads may race).
  let row: { position: number } | null = null;
  try {
    row = await c.env.DB.prepare(
      `INSERT INTO spot_photos (id, spot_id, user_id, position, width, height, created_at)
       SELECT ?, s.id, s.user_id,
              (SELECT COALESCE(MAX(position) + 1, 0) FROM spot_photos WHERE spot_id = s.id),
              ?, ?, ?
       FROM spots s
       WHERE s.id = ? AND s.user_id = ?
         AND (SELECT COUNT(*) FROM spot_photos WHERE spot_id = s.id) < ?
       RETURNING position`
    )
      .bind(id, width, height, created_at, spotId, user.id, PHOTOS_MAX)
      .first<{ position: number }>();
  } catch (e) {
    await deletePhotoBlobs(c.env.PHOTOS, [id]);
    throw e;
  }
  if (!row) {
    await deletePhotoBlobs(c.env.PHOTOS, [id]);
    return c.json({ error: `A spot can have at most ${PHOTOS_MAX} photos` }, 409);
  }

  const photo: SpotPhoto = { id, width, height, position: row.position };
  return c.json(photo, 201);
});

app.delete("/api/spots/:id/photos/:photoId", requireUser, async (c) => {
  const user = c.get("user")!;
  const photoId = c.req.param("photoId");
  const result = await c.env.DB.prepare(
    "DELETE FROM spot_photos WHERE id = ? AND spot_id = ? AND spot_id IN (SELECT id FROM spots WHERE id = ? AND user_id = ?)"
  )
    .bind(photoId, c.req.param("id"), c.req.param("id"), user.id)
    .run();

  if (result.meta.changes === 0) return c.json({ error: "Photo not found" }, 404);
  await deletePhotoBlobs(c.env.PHOTOS, [photoId]);
  return c.body(null, 204);
});

// Public. Photo ids are random UUIDs and the bytes never change, so cache forever.
app.get("/api/photos/:photoId/:size", async (c) => {
  const photoId = c.req.param("photoId");
  const size = c.req.param("size");
  if ((size !== "full" && size !== "thumb") || !/^[0-9a-f-]{36}$/.test(photoId)) {
    return c.json({ error: "Photo not found" }, 404);
  }
  const etag = `"${photoId}-${size}"`;
  const cacheHeaders = {
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
  };
  if (c.req.header("if-none-match") === etag) return c.body(null, 304, cacheHeaders);

  const { value, metadata } = await c.env.PHOTOS.getWithMetadata<{ contentType?: string }>(
    photoKey(photoId, size),
    "stream"
  );
  if (!value) return c.json({ error: "Photo not found" }, 404);
  const type = metadata?.contentType;
  return c.body(value, 200, {
    ...cacheHeaders,
    "Content-Type": type === "image/webp" || type === "image/jpeg" ? type : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
});
