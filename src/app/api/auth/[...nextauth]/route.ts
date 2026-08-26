import { handlers } from "@/auth";

/**
 * NextAuth v5 API route handler.
 * Mounts at /api/auth/* (signin, signout, session, csrf, etc.)
 */
export const { GET, POST } = handlers;
