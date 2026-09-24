import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCroyantTestimoniesTable } from "@/lib/ensure-schema";

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

/** Limite anti-abus : un témoignage raison fait moins de 6 000 caractères. */
const CONTENU_MAX = 6000;

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
    await db.croyantTestimony.create({
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
      },
    });

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
