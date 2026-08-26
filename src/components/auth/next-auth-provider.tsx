"use client";

import { SessionProvider } from "next-auth/react";

/**
 * NextAuth SessionProvider wrapper.
 * Must be a client component — wrap the app in layout.tsx.
 */
export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
