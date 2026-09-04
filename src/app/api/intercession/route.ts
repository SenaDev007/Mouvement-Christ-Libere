/** API Chaîne d'intercession — GET (liste, réservée à l'administration) + POST (créer, public)
 *
 * ⭐ V3.2 — CONFIDENTIALITÉ (demande explicite) : les demandes de prière
 * contiennent le nom de la personne, son sujet et sa description → elles
 * ne doivent PLUS être publiques. Le GET est désormais réservé aux membres
 * de l'administration (session NextAuth, rôle ADMIN+). Le public ne voit
 * que le formulaire de dépôt (page /intercession) ; les demandes arrivent
 * directement dans le back-office (/admin/intercession).
 *
 * ⭐ V3.32 — LOCALISATION + CONTACT (demande du pasteur) : le POST recueille
 * désormais le nom complet (champ auteur), le pays (requis), la ville, le
 * téléphone et l'email — « afin de savoir d'où vient la personne qui fait la
 * demande ». Ces informations confidentielles sont visibles uniquement dans
 * le back-office et le canal dédié « Sujets de prière » de Yeshua Connect.
 *
 * ⭐ V3.30 — NOTE VOCALE + RELAIS YESHUA CONNECT (demandes du pasteur) :
 *   - POST accepte désormais multipart/form-data avec un fichier audio
 *     facultatif (« possibilité de faire un audio pour permettre à la
 *     personne de s'exprimer librement »). La description devient
 *     facultative QUAND une note vocale est jointe. Stockage : R2 (fallback
 *     data URL ≤ 1,2 Mo — même stratégie que les pièces jointes Yeshua
 *     Connect).
 *   - Après enregistrement, la demande est RELAYÉE dans le canal dédié
 *     « Sujets de prière » de Yeshua Connect (message structuré : auteur,
 *     catégorie, urgence, sujet, description + note vocale) — canal visible
 *     UNIQUEMENT des SUPER_ADMIN/ADMIN (best-effort : le back-office reste
 *     la source de vérité garantie).
 *   - Le JSON historique (sans fichier) reste accepté (compatibilité).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ensureIntercessionAudioColumns, ensureIntercessionContactColumns } from "@/lib/ensure-schema";
import { relayerDemandeIntercession } from "@/lib/intercession-relay";
import { uploadToR2, isR2Configured, generateKey } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rôles autorisés à consulter / gérer les demandes d'intercession. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "PASTOR", "ANIMATOR"]);

/** Garde-fous de la note vocale. */
const AUDIO_MAX_OCTETS = 4 * 1024 * 1024; // 4 Mo (limite body serverless ~4,5 Mo)
const AUDIO_DUREE_MAX_S = 180; // 3 min (le front coupe à 2 min, marge serveur)
const INLINE_MAX_OCTETS = 1.2 * 1024 * 1024; // 1,2 Mo en data URL si R2 absent

export async function GET(request: NextRequest) {
  // ⭐ V3.2 — Réservé à l'administration : aucune demande n'est publique.
  const session = await auth();
  if (!session?.user?.id || !PRIVILEGED_ROLES.has((session.user as { role?: string }).role || "")) {
    return NextResponse.json({ error: "Accès réservé à l'administration" }, { status: 401 });
  }

  const url = new URL(request.url);
  const categorie = url.searchParams.get("categorie");
  const urgent = url.searchParams.get("urgent");
  const statut = url.searchParams.get("statut");

  // ⭐ V3.30.1 — Auto-réparation des colonnes audio AVANT lecture (le POST
  // l'avait, pas le GET : findMany sans select → P2022 sur base froide).
  // ⭐ V3.32 — Idem pour les colonnes pays/ville/telephone/email.
  await ensureIntercessionAudioColumns();
  await ensureIntercessionContactColumns();

  const where: Record<string, unknown> = {};
  if (categorie && categorie !== "tous") where.categorie = categorie;
  if (urgent === "true") where.isUrgent = true;
  if (statut && statut !== "tous") where.statut = statut;

  try {
    const demandes = await db.intercessionRequest.findMany({
      where,
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const all = await db.intercessionRequest.findMany({ select: { statut: true, prayCount: true } });
    const stats = {
      total: all.length,
      enPriere: all.filter((d) => d.statut === "en_priere").length,
      exauces: all.filter((d) => d.statut === "exauce").length,
      priersTotal: all.reduce((sum, d) => sum + d.prayCount, 0),
    };

    return NextResponse.json({ demandes, stats });
  } catch {
    return NextResponse.json({ error: "Erreur de base de données" }, { status: 500 });
  }
}

/** ⭐ V3.30 — Stocke la note vocale (R2, fallback data URL ≤ 1,2 Mo). */
async function stockerAudio(
  fichier: File,
): Promise<{ url: string; taille: number; mime: string } | { erreur: string }> {
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const mime = fichier.type || "audio/webm";
  const taille = buffer.length;

  if (!mime.startsWith("audio/")) {
    return { erreur: "Le fichier joint n'est pas un fichier audio." };
  }
  if (taille > AUDIO_MAX_OCTETS) {
    return { erreur: "La note vocale dépasse 4 Mo — enregistrez moins de 2 minutes." };
  }

  const ext = (fichier.name.split(".").pop() || "webm").toLowerCase().replace(/[^a-z0-9]/g, "") || "webm";

  if (isR2Configured()) {
    const key = generateKey("intercession", `${Date.now()}`, ext);
    // ⭐ V3.30.1 — 2 tentatives : un échec R2 transitoire (DNS, 5xx, token
    // provisoirement refusé) ne doit pas faire échouer la note vocale.
    const NB_TENTATIVES_R2 = 2;
    for (let tentative = 1; tentative <= NB_TENTATIVES_R2; tentative++) {
      try {
        const url = await uploadToR2(key, buffer, mime);
        return { url, taille, mime };
      } catch (e) {
        console.error(
          `[intercession] Upload R2 tentative ${tentative}/${NB_TENTATIVES_R2} échouée ` +
            `(${taille} octets, ${mime}, clé ${key}) :`,
          e instanceof Error ? e.message : e,
        );
        if (tentative < NB_TENTATIVES_R2) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }
    // Fallback data URL si raisonnable, sinon erreur explicite.
    if (taille <= INLINE_MAX_OCTETS) {
      return { url: bufferVersDataUrl(buffer, mime), taille, mime };
    }
    return {
      erreur:
        "Impossible d'enregistrer la note vocale pour le moment. Réessayez, ou envoyez votre demande sans note vocale.",
    };
  }

  if (taille <= INLINE_MAX_OCTETS) {
    return { url: bufferVersDataUrl(buffer, mime), taille, mime };
  }
  return {
    erreur:
      "Impossible d'enregistrer la note vocale pour le moment. Réessayez, ou envoyez votre demande sans note vocale.",
  };
}

/** Data URL base64 (même helper que les pièces jointes Yeshua Connect). */
function bufferVersDataUrl(buffer: Buffer, mime: string): string {
  const safeMime = /^\w+\/[\w.+-]+$/.test(mime) ? mime : "audio/webm";
  return `data:${safeMime};base64,${buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    // ⭐ V3.30 — Auto-réparation des colonnes audio avant TOUTE écriture.
    // ⭐ V3.32 — Idem localisation/contact (pays, ville, téléphone, email).
    await ensureIntercessionAudioColumns();
    await ensureIntercessionContactColumns();

    // ─── Parse : multipart (avec note vocale) OU JSON (historique) ───
    let auteur = "";
    let pays = "";
    let ville = "";
    let telephone = "";
    let email = "";
    let sujet = "";
    let description = "";
    let categorie = "general";
    let isUrgent = false;
    let fichierAudio: File | null = null;
    let audioDuration: number | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      auteur = String(formData.get("auteur") || "").trim();
      pays = String(formData.get("pays") || "").trim();
      ville = String(formData.get("ville") || "").trim();
      telephone = String(formData.get("telephone") || "").trim();
      email = String(formData.get("email") || "").trim();
      sujet = String(formData.get("sujet") || "").trim();
      description = String(formData.get("description") || "").trim();
      categorie = String(formData.get("categorie") || "general");
      isUrgent = String(formData.get("isUrgent") || "") === "true";
      const brut = formData.get("audio");
      if (brut && typeof brut !== "string" && brut.size > 0) {
        fichierAudio = brut as File;
      }
      const dureeBrute = parseFloat(String(formData.get("audioDuration") || ""));
      audioDuration = Number.isFinite(dureeBrute) ? Math.min(Math.max(dureeBrute, 0), AUDIO_DUREE_MAX_S) : null;
    } else {
      const body = await request.json();
      auteur = (body.auteur || "").trim();
      pays = (body.pays || "").trim();
      ville = (body.ville || "").trim();
      telephone = (body.telephone || "").trim();
      email = (body.email || "").trim();
      sujet = (body.sujet || "").trim();
      description = (body.description || "").trim();
      categorie = body.categorie || "general";
      isUrgent = !!body.isUrgent;
    }

    // ─── Validation ───
    if (!auteur || !sujet) {
      return NextResponse.json({ error: "Votre nom complet et le sujet sont requis" }, { status: 400 });
    }
    // ⭐ V3.32 — Le pays est requis (directive : savoir d'où vient la
    // demande). Ville, téléphone et email restent facultatifs.
    if (!pays) {
      return NextResponse.json({ error: "Indiquez votre pays — il aide l'équipe à savoir d'où vient votre demande" }, { status: 400 });
    }
    // ⭐ V3.32 — Validation douce des coordonnées FACULTATIVES : on ne
    // rejette pas la demande, on nettoie/normalise simplement.
    const telNettoye = telephone.replace(/[\s().-]/g, "");
    if (telNettoye && !/^\+?\d{6,20}$/.test(telNettoye)) {
      return NextResponse.json({ error: "Le numéro de téléphone semble invalide. Vérifiez-le, ou laissez le champ vide." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: "L'adresse email semble invalide. Vérifiez-la, ou laissez le champ vide." }, { status: 400 });
    }
    // ⭐ V3.30 — La description devient facultative SI une note vocale est
    // jointe (« que ça soit par texte, que ça soit par note vocale »).
    if (!description && !fichierAudio) {
      return NextResponse.json(
        { error: "Décrivez votre demande, ou enregistrez plutôt une note vocale." },
        { status: 400 },
      );
    }

    // ─── Stockage de la note vocale ───
    let audioUrl: string | null = null;
    let audioTaille: number | null = null;
    let audioMime: string | null = null;
    if (fichierAudio) {
      const resultat = await stockerAudio(fichierAudio);
      if ("erreur" in resultat) {
        return NextResponse.json({ error: resultat.erreur }, { status: 507 });
      }
      audioUrl = resultat.url;
      audioTaille = resultat.taille;
      audioMime = resultat.mime;
    }

    // ─── Enregistrement back-office (source de vérité garantie) ───
    try {
      const demande = await db.intercessionRequest.create({
        data: {
          auteur: auteur.substring(0, 100),
          // ⭐ V3.32 — Localisation + contact (confidentiels, back-office +
          // canal Yeshua Connect uniquement).
          pays: pays.substring(0, 100) || null,
          ville: ville.substring(0, 100) || null,
          telephone: telNettoye || null,
          email: email.substring(0, 150) || null,
          sujet: sujet.substring(0, 200),
          description: (description || "— (demande exprimée en note vocale)").substring(0, 2000),
          categorie: categorie || "general",
          isUrgent,
          // ⭐ V3.2 — isPublic: false : la demande arrive DIRECTEMENT dans le
          // back-office, elle n'est plus affichée sur la page publique.
          isPublic: false,
          statut: "ouvert",
          // ⭐ V3.30 — métadonnées de la note vocale
          audioUrl,
          audioDuration: audioUrl ? audioDuration : null,
          audioMime: audioUrl ? audioMime : null,
          audioSize: audioUrl ? audioTaille : null,
        },
      });

      // ⭐ V3.30 — RELAIS Yeshua Connect (canal dédié « Sujets de prière »,
      // réservé aux SUPER_ADMIN/ADMIN). Best-effort : un échec ici ne fait
      // PAS échouer le dépôt — la demande est déjà enregistrée.
      await relayerDemandeIntercession({
        id: demande.id,
        auteur: demande.auteur,
        pays: demande.pays,
        ville: demande.ville,
        telephone: demande.telephone,
        email: demande.email,
        sujet: demande.sujet,
        description: description || "— (demande exprimée en note vocale)",
        categorie: demande.categorie,
        isUrgent: demande.isUrgent,
        audioUrl: demande.audioUrl,
        audioDuration: demande.audioDuration,
        audioMime: demande.audioMime,
        audioSize: demande.audioSize,
      });

      return NextResponse.json({ success: true, id: demande.id }, { status: 201 });
    } catch (e) {
      console.error("[intercession] Erreur DB :", e instanceof Error ? e.message : e);
      return NextResponse.json({ success: true, demo: true });
    }
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
