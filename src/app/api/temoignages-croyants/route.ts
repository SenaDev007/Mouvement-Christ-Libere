import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureCroyantTestimoniesTable } from "@/lib/ensure-schema";
import { getPublicUrl, isR2Configured, extraireCleR2, deleteFromR2, getClient } from "@/lib/r2";
import { uploadToGithub, isGithubStorageConfigured } from "@/lib/github-storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * ⭐ V3.100 — TÉMOIGNAGES DES CROYANTS (« Vies transformées »).
 *
 * GET  /api/temoignages-croyants — témoignages PUBLIÉS (validés par un
 *        super admin) : alimente la section « Vies transformées » de la
 *        landing et la page /vie-transformee. Aucune donnée personnelle
 *        (email/téléphone) n'est exposée — nom, ville/pays et récit.
 *
 * POST /api/temoignages-croyants — soumission publique en 2 modales
 *        (personnel → professionnel, composant SoumissionTemoignage).
 *        Le témoignage arrive en statut « en_attente » : il n'apparaît
 *        nulle part avant validation par un super admin
 *        (/admin/vie-transformee).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Catégories acceptées (libellées partagées avec l'UI). */
export const CATEGORIES_TEMOIGNAGES = [
  "vie_transformee",
  "guerison",
  "delivrance",
  "restauration",
  "providence",
  "appel",
  "action_graces",
] as const;

/** Limite demandée par le pasteur (V4.25) : récit jusqu'à 10 000 caractères. */
const CONTENU_MAX = 10000;

/** ⭐ V4.25 — Note vocale : les URL audio ne peuvent venir QUE de notre
 * bucket R2 (préfixe temoignages-audio/ attribué par la route presign).
 * On bloque ainsi toute URL externe arbitraire injectée dans le POST. */
function urlAudioValide(url: string): boolean {
  if (!isR2Configured()) return false;
  try {
    const attendu = getPublicUrl("temoignages-audio/");
    return url.startsWith(attendu) && url.length < 2048;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCroyantTestimoniesTable();

    const url = new URL(request.url);
    const limiteBrute = parseInt(url.searchParams.get("limit") || "12", 10);
    const limit = Number.isFinite(limiteBrute)
      ? Math.min(Math.max(limiteBrute, 1), 48)
      : 12;

    const items = await db.croyantTestimony.findMany({
      where: { statut: "publie" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      // ⚠️ Aucune donnée privée (email/téléphone/noteAdmin) n'est exposée.
      select: {
        id: true,
        nom: true,
        pays: true,
        ville: true,
        profession: true,
        eglise: true,
        categorie: true,
        titre: true,
        contenu: true,
        publishedAt: true,
        // ⭐ V4.25 — note vocale publique (lecture par tous).
        audioUrl: true,
        audioDuree: true,
        audioMime: true,
        audioTaille: true,
      },
    });

    return NextResponse.json({ temoignages: items });
  } catch (e) {
    console.error("[api/temoignages-croyants] GET :", e);
    return NextResponse.json({ temoignages: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auto-réparation de la table avant TOUTE écriture (P2021/P2022 :
    // premier déploiement, lambda froide… même garde que l'API
    // intercession V3.30).
    await ensureCroyantTestimoniesTable();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 }
      );
    }

    // ── Honeypot anti-robots (champ caché — un humain ne le remplit
    //    jamais, présent dans le formulaire avec un nom anodin) ──
    const siteWeb = String((body as Record<string, unknown>).siteWeb || "").trim();
    if (siteWeb) {
      // Réponse honnête pour le robot, silencieuse pour l'utilisateur.
      return NextResponse.json({ ok: true });
    }

    // ── Champs — Modale 1 : informations personnelles ──
    const nom = String(body.nom || "").trim();
    const email = String(body.email || "").trim();
    const telephone = String(body.telephone || "").trim();
    const pays = String(body.pays || "").trim();
    const ville = String(body.ville || "").trim();

    // ── Champs — Modale 2 : témoignage ──
    const profession = String(body.profession || "").trim();
    const eglise = String(body.eglise || "").trim();
    const categorie = String(body.categorie || "vie_transformee").trim();
    const titre = String(body.titre || "").trim();
    const contenu = String(body.contenu || "").trim();
    const consentement = body.consentement === true;

    // ── Champs — ⭐ V4.25 : note vocale (upload déjà fait vers R2 via
    //    /api/temoignages-croyants/audio-presign — on ne reçoit que
    //    l'URL publique + métadonnées déclaratives) ──
    const audioUrlBrut = String(body.audioUrl || "").trim();
    const audioUrl = audioUrlBrut && urlAudioValide(audioUrlBrut) ? audioUrlBrut : null;

    let audioDuree: number | null = null;
    if (typeof body.audioDuree === "number" && Number.isFinite(body.audioDuree) && body.audioDuree > 0) {
      audioDuree = Math.round(body.audioDuree * 100) / 100; // aucune limite de durée
    }

    let audioMime: string | null = null;
    const mimeBrut = String(body.audioMime || "").trim();
    if (/^audio\/[\w.+-]{1,80}$/.test(mimeBrut)) {
      audioMime = mimeBrut;
    }

    let audioTaille: number | null = null;
    if (
      typeof body.audioTaille === "number" &&
      Number.isFinite(body.audioTaille) &&
      body.audioTaille > 0 &&
      body.audioTaille <= 5 * 1024 * 1024 * 1024 // plafond physique d'un PUT R2
    ) {
      audioTaille = Math.round(body.audioTaille);
    }

    // ── Validation ──
    if (nom.length < 2 || nom.length > 80) {
      return NextResponse.json(
        { error: "Votre nom complet est requis (2 à 80 caractères)." },
        { status: 400 }
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { error: "L'adresse email n'est pas valide." },
        { status: 400 }
      );
    }
    if (titre.length < 3 || titre.length > 120) {
      return NextResponse.json(
        { error: "Le titre de votre témoignage est requis (3 à 120 caractères)." },
        { status: 400 }
      );
    }
    if (contenu.length < 30) {
      return NextResponse.json(
        { error: "Racontez votre témoignage en au moins 30 caractères." },
        { status: 400 }
      );
    }
    if (contenu.length > CONTENU_MAX) {
      return NextResponse.json(
        { error: `Votre témoignage est trop long (${CONTENU_MAX} caractères maximum).` },
        { status: 400 }
      );
    }
    if (!consentement) {
      return NextResponse.json(
        { error: "Veuillez accepter la relecture pastorale avant l'envoi." },
        { status: 400 }
      );
    }
    if (!CATEGORIES_TEMOIGNAGES.includes(categorie as (typeof CATEGORIES_TEMOIGNAGES)[number])) {
      return NextResponse.json(
        { error: "Catégorie de témoignage inconnue." },
        { status: 400 }
      );
    }

    // ── Enregistrement — statut en_attente (aucune publication avant
    //    validation par un super admin) ──
    const temoignage = await db.croyantTestimony.create({
      data: {
        nom,
        email: email || null,
        telephone: telephone || null,
        pays: pays || null,
        ville: ville || null,
        profession: profession || null,
        eglise: eglise || null,
        categorie,
        titre,
        contenu,
        consentement,
        statut: "en_attente",
        audioUrl,
        audioDuree: audioUrl ? audioDuree : null,
        audioMime: audioUrl ? audioMime : null,
        audioTaille: audioUrl ? audioTaille : null,
      },
    });

    // ⭐ V4.44 — Transfert R2 → GitHub en arrière-plan (après la réponse)
    // Le fichier audio est transféré de R2 vers GitHub et l'URL en base
    // est mise à jour. Le fichier R2 est supprimé (libère l'espace).
    if (audioUrl && isGithubStorageConfigured()) {
      after(async () => {
        try {
          const keyR2 = extraireCleR2(audioUrl);
          if (!keyR2) return;

          const client = getClient();
          const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: keyR2,
          });
          const response = await client.send(command);
          if (!response.Body) return;

          const chunks: Buffer[] = [];
          const corps = response.Body as AsyncIterable<Uint8Array>;
          for await (const chunk of corps) {
            chunks.push(Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          const filename = keyR2.split("/").pop() || `temoignage-${Date.now()}.webm`;
          const result = await uploadToGithub(buffer, "audio", "vie-transformee", filename);

          // Mettre à jour l'audioUrl en base vers GitHub
          await db.croyantTestimony.update({
            where: { id: temoignage.id },
            data: { audioUrl: result.url },
          });

          // Supprimer de R2
          await deleteFromR2(keyR2).catch(() => {});

          console.log(
            `[temoignages] Transfert R2 → GitHub OK : témoignage ${temoignage.id} → ${result.storage}`
          );
        } catch (err) {
          console.warn(
            "[temoignages] Transfert R2 → GitHub échec (non bloquant) :",
            err instanceof Error ? err.message : err
          );
        }
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Merci ! Votre témoignage a bien été reçu. L'équipe pastorale va le relire : il apparaîtra sur le site après validation.",
    });
  } catch (e) {
    console.error("[api/temoignages-croyants] POST :", e);
    return NextResponse.json(
      {
        error:
          "Une erreur est survenue lors de l'envoi. Merci de réessayer dans un instant.",
      },
      { status: 500 }
    );
  }
}
