import { createAuthClient } from "better-auth/react";

// Same origin as the SPA: /api/auth/* (proxied to wrangler dev by Vite in development).
export const authClient = createAuthClient();
