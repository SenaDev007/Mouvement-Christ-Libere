import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        pseudonyme: { label: "Pseudonyme ou email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.pseudonyme || !credentials?.password) return null;

        const pseudo = (credentials.pseudonyme as string).trim();

        // Recherche par email OU par name (insensible à la casse)
        let user = null;
        if (pseudo.includes("@")) {
          // Recherche par email
          user = await db.user.findUnique({
            where: { email: pseudo.toLowerCase() },
          });
        } else {
          // Recherche par name (pseudonyme)
          const candidates = await db.user.findMany({
            where: { name: { equals: pseudo, mode: "insensitive" } },
            take: 5,
          });
          // Prendre le premier vérifié, sinon le premier
          user = candidates.find((c) => c.isVerified) || candidates[0] || null;
        }

        if (!user || !user.passwordHash) return null;

        // Vérifier le mot de passe
        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

        // Vérifier que le compte est validé
        if (!user.isVerified) {
          throw new Error("Votre compte est en attente de validation par un administrateur.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login", newUser: "/register", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "christ-libere-nextauth-secret-change-in-prod-2026",
});
