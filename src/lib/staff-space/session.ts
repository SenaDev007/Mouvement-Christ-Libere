/**
 * ⭐ V3.66 — Session & gardes de rôles des espaces Secrétariat/Trésorerie.
 *
 * Les deux espaces réutilisent À DESSEIN l'infrastructure de session du
 * back-office (src/lib/auth.ts) : même cookie signé « admin_session »,
 * même format de payload « admin:<userId>:<role> », même durée (8 h).
 *
 * Le cookie est HOST-SCOPED (pas d'attribut domain) : la session ouverte
 * sur secretariat.mouvementchristlibere.com est indépendante de celle de
 * tresorerie.mouvementchristlibere.com ou du back-office — chacun des
 * espaces exige SA connexion, avec SES rôles autorisés.
 *
 * Les rôles autorisés diffèrent de /admin/api/login : la secrétaire
 * n'accède qu'au secrétariat, le trésorier qu'à la trésorerie — et les
 * deux super admins (Pam, Pasteur Kongo) accèdent à tout (directive :
 * « les deux pasteurs ont le contrôle sur le secrétariat… ils ont accès »).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  createSessionToken,
  SESSION_MAX_AGE,
} from "@/lib/auth";

/** Rôles autorisés dans l'espace Secrétariat. */
export const ROLES_SECRETARIAT = ["SECRETARY", "SUPER_ADMIN"] as const;
/** Rôles autorisés dans l'espace Trésorerie. */
export const ROLES_TRESORERIE = ["TREASURER", "SUPER_ADMIN"] as const;

interface SessionPayload {
  user: string;
  exp: number;
}

/** Décode (sans vérifier) le payload d'un token de session. */
function decoderPayload(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    return JSON.parse(Buffer.from(parts[0], "base64url").toString()) as SessionPayload;
  } catch {
    return null;
  }
}

export interface SessionStaff {
  userId: string;
  role: string;
}

/** Vérifie la signature du token et extrait { userId, role }. */
export function lireSessionStaff(token: string): SessionStaff | null {
  if (!verifySessionToken(token)) return null;
  const payload = decoderPayload(token);
  if (!payload?.user) return null;
  const morceaux = payload.user.split(":");
  if (morceaux.length < 3 || morceaux[0] !== "admin") return null;
  return { userId: morceaux[1], role: morceaux[2] };
}

/**
 * Garde API : 401 JSON si session absente/invalide, 403 JSON si le rôle
 * n'est pas dans la liste. Retourne la session sinon.
 *
 * Contrairement à la garde du proxy (redirection 302 vers le login —
 * pratique pour les PAGES), les routes API répondent en JSON : un fetch
 * client reçoit un statut exploitable au lieu de suivre une redirection
 * vers du HTML.
 */
export function exigerSession(
  request: NextRequest,
  rolesAutorises: readonly string[]
): { session: SessionStaff } | { reponse: NextResponse } {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return {
      reponse: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  const session = lireSessionStaff(token);
  if (!session) {
    return {
      reponse: NextResponse.json({ error: "Session expirée ou invalide" }, { status: 401 }),
    };
  }
  if (!rolesAutorises.includes(session.role)) {
    return {
      reponse: NextResponse.json(
        { error: "Votre compte n'a pas accès à cet espace." },
        { status: 403 }
      ),
    };
  }
  return { session };
}

/**
 * Handler de connexion partagé des deux espaces.
 *
 * Identique à /admin/api/login (recherche par nom OU email, bcrypt,
 * compte vérifié) — seule la liste de rôles change : seuls la secrétaire
 * (resp. le trésorier) et les super admins ouvrent une session ici.
 * ⭐ V3.67 — gouvernance : chaque connexion réussie est tracée dans
 * l'AuditLog (actionAudit = « TRESORERIE_LOGIN » / « SECRETARIAT_LOGIN »).
 */
export async function handlerConnexionStaff(
  request: NextRequest,
  rolesAutorises: readonly string[],
  actionAudit?: string
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, password } = body as { name?: string; password?: string };

    if (!name || !password) {
      return NextResponse.json(
        { error: "Nom et mot de passe requis" },
        { status: 400 }
      );
    }

    const nettoyé = name.trim();

    // Recherche par email OU par nom (insensible à la casse) — même
    // logique que /admin/api/login.
    const { db } = await import("@/lib/db");
    const candidats = nettoyé.includes("@")
      ? await db.user.findMany({
          where: { email: nettoyé.toLowerCase() },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            isVerified: true,
          },
          take: 1,
        })
      : await db.user.findMany({
          where: { name: { equals: nettoyé, mode: "insensitive" } },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            isVerified: true,
          },
          take: 5,
        });

    const utilisateur =
      candidats.find((c) => rolesAutorises.includes(c.role)) || null;

    if (!utilisateur || !utilisateur.passwordHash) {
      return NextResponse.json(
        { error: "Nom ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const { default: bcrypt } = await import("bcryptjs");
    const motDePasseValide = await bcrypt.compare(
      password,
      utilisateur.passwordHash
    );
    if (!motDePasseValide) {
      return NextResponse.json(
        { error: "Nom ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const token = createSessionToken(
      `admin:${utilisateur.id}:${utilisateur.role}`
    );

    const reponse = NextResponse.json({
      success: true,
      userId: utilisateur.id,
      name: utilisateur.name,
      role: utilisateur.role,
    });

    // ⭐ V3.67 — Gouvernance : trace de connexion (best-effort).
    if (actionAudit) {
      try {
        await (await import("@/lib/db")).db.auditLog.create({
          data: {
            action: actionAudit,
            userId: utilisateur.id,
            metadata: {
              compte: utilisateur.name,
              role: utilisateur.role,
            } as never,
          },
        });
      } catch (e) {
        console.warn("[staff/login] AuditLog impossible :", e);
      }
    }

    reponse.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return reponse;
  } catch (error) {
    console.error("[staff/login] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}

/** Déconnexion : efface le cookie de session de l'espace courant. */
export function handlerDeconnexionStaff(): NextResponse {
  const reponse = NextResponse.json({ success: true });
  reponse.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return reponse;
}
