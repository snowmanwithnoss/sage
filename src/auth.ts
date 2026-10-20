import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { NAME_MAX } from "../shared/spot";
import type { Env } from "./env";

const DEV_ORIGIN = "http://localhost:5173"; // Vite dev server (proxies /api to wrangler dev)
const SECRET_MIN = 32;

/** Display names are capped like spot names; reject rather than truncate. */
function checkName(name: unknown): void {
  if (typeof name !== "string" || name.trim().length === 0 || name.length > NAME_MAX) {
    throw new APIError("BAD_REQUEST", { message: `Name is required (max ${NAME_MAX} characters)` });
  }
}

/**
 * Build a Better Auth instance for this request. D1 bindings only exist on the
 * per-request `env`, so this can't be a module-level singleton.
 */
export function createAuth(env: Env) {
  // Without a secret Better Auth falls back to a public default (it only
  // throws when NODE_ENV=production, which Workers don't set). Fail closed.
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < SECRET_MIN) {
    throw new Error(`BETTER_AUTH_SECRET must be set (at least ${SECRET_MIN} characters)`);
  }
  const isLocal = env.BETTER_AUTH_URL.startsWith("http://localhost");
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    // Native D1 support: Better Auth wraps the binding with its own Kysely dialect.
    database: env.DB,
    trustedOrigins: isLocal ? [DEV_ORIGIN] : [],
    emailAndPassword: {
      enabled: true,
      // No email service yet: no verification, no password reset.
      requireEmailVerification: false,
    },
    rateLimit: {
      // Default is production-only; force it on. Worker isolates don't share
      // memory, so counters live in D1 (`rateLimit` table).
      enabled: true,
      storage: "database",
    },
    databaseHooks: {
      user: {
        create: {
          // We never show avatars, so don't store client-supplied image URLs.
          before: async (user) => {
            checkName(user.name);
            return { data: { ...user, image: null } };
          },
        },
        update: {
          // Also reachable via /api/auth/update-user; only touch fields being changed.
          before: async (user) => {
            if ("name" in user) checkName(user.name);
            if ("image" in user) return { data: { ...user, image: null } };
          },
        },
      },
    },
    advanced: {
      // Cloudflare sets this header itself; x-forwarded-for is client-spoofable.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
