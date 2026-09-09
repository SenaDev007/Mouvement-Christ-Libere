import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { uploadToR2, isR2Configured } from "@/lib/r2";

/**
 * ⭐ V3.59 — POST /api/post-production/assets/import
 *
 * Télécharge un média depuis le CDN Mixkit (ou toute URL publique directe
 * soumise par l'utilisateur — p. ex. un mp3 Pixabay copié depuis le site) et
 * le stocke durablement sur R2, dans notre bucket, sous assets/…
 *
 * Body JSON :
 * {
 *   url: string,            // URL directe du fichier (.wav/.mp3/.mp4/.zip)
 *   name: string,           // nom affiché
 *   type: "sfx" | "music" | "video" | "template",
 *   fallbackUrl?: string    // URL de repli (p. ex. preview) si url 404
 * }
 *
 * Réponse : { success, url, key, size, contentType, fileName }
 *
 * GARDE-FOUS :
 *  - authentification par cookie de session (comme le reste du back-office) ;
 *  - anti-SSRF : uniquement https, pas d'IP privée / localhost ;
 *  - taille plafonnée (100 Mo) — refus anticipé via Content-Length, refus
 *    en cours de flux sinon ;
 *  - types MIME acceptés : audio/*, video/*, application/zip — sinon refus ;
 *  - durée totale bornée (Vercel maxDuration 30 s) : streaming direct vers
 *    un buffer, sans attente inutile.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAILLE_MAX = 100 * 1024 * 1024; // 100 Mo

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

function typeAutorise(ct: string): boolean {
  return (
    ct.startsWith("audio/") ||
    ct.startsWith("video/") ||
    ct === "application/zip" ||
    ct === "application/x-zip-compressed"
  );
}

/** Anti-SSRF : URL https valide, hôte public (pas d'IP privée/localhost). */
function urlAutorisee(urlBrute: string): URL | null {
  let u: URL;
  try {
    u = new URL(urlBrute);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return null;
  }
  // IPv4 privée / boucle / link-local
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return null;
    if (a === 192 && b === 168) return null;
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 169 && b === 254) return null;
  }
  return u;
}

function slugifier(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "asset"
  );
}

interface Reussi {
  contentType: string;
  size: number;
  buffer: Buffer;
}
type Tentative = Reussi | { erreur: string };

/** Télécharge avec garde-fous. */
async function telecharger(u: URL): Promise<Tentative> {
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MCL-PostProduction/3.59)" },
    redirect: "follow",
    signal: AbortSignal.timeout(22000),
  });
  if (!res.ok) return { erreur: `source ${res.status}` };
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ct || !typeAutorise(ct)) return { erreur: "type de fichier non autorisé" };
  const cl = Number(res.headers.get("content-length") || 0);
  if (cl && cl > TAILLE_MAX) return { erreur: "fichier trop volumineux (> 100 Mo)" };

  const morceaux: Buffer[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  if (!reader) return { erreur: "flux indisponible" };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAILLE_MAX) {
        await reader.cancel();
        return { erreur: "fichier trop volumineux (> 100 Mo)" };
      }
      morceaux.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return { contentType: ct, size: total, buffer: Buffer.concat(morceaux) };
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Stockage R2 non configuré (R2_PUBLIC_URL absent)" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const urlBrute: string = typeof body?.url === "string" ? body.url : "";
    const nom: string = typeof body?.name === "string" ? body.name.slice(0, 120) : "";
    const type: string = ["sfx", "music", "video", "template"].includes(body?.type)
      ? body.type
      : "asset";
    const fallbackBrute: string =
      typeof body?.fallbackUrl === "string" ? body.fallbackUrl : "";

    if (!urlBrute) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // ─── Anti-SSRF + https uniquement ───
    const u = urlAutorisee(urlBrute);
    if (!u) {
      return NextResponse.json({ error: "URL refusée (non publique)" }, { status: 400 });
    }
    if (u.protocol !== "https:") {
      return NextResponse.json({ error: "Seules les URLs https sont acceptées" }, { status: 400 });
    }

    // ─── Téléchargement (avec repli qualité p. ex. WAV 404 → preview mp3) ───
    let resultat = await telecharger(u);
    if ("erreur" in resultat) {
      const premiereErreur = resultat.erreur;
      let repli: string | null = null;
      if (fallbackBrute) {
        const uf = urlAutorisee(fallbackBrute);
        if (uf && uf.protocol === "https:") {
          const essaiRepli = await telecharger(uf);
          if ("erreur" in essaiRepli) {
            repli = essaiRepli.erreur;
          } else {
            resultat = essaiRepli;
          }
        }
      }
      if ("erreur" in resultat) {
        return NextResponse.json(
          {
            error:
              `Téléchargement impossible (${premiereErreur}` +
              (repli ? ` ; repli : ${repli}` : "") +
              ")",
          },
          { status: 502 }
        );
      }
    }

    const ext = EXTENSIONS[resultat.contentType] || u.pathname.split(".").pop() || "bin";

    // ─── Clé R2 : assets/<type>/<slug>-<ts>-<rand>.<ext> ───
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const base = slugifier(nom || "mixkit");
    const key = `assets/${type}/${base}-${ts}-${rand}.${ext}`;

    const urlPublique = await uploadToR2(key, resultat.buffer, resultat.contentType);

    return NextResponse.json({
      success: true,
      url: urlPublique,
      key,
      size: resultat.size,
      contentType: resultat.contentType,
      fileName: `${base}.${ext}`,
    });
  } catch (error) {
    console.error("[post-production/assets/import]", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Import impossible : ${message}` }, { status: 500 });
  }
}
