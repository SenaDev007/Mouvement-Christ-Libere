/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : service partagé back-office / secrétariat.
 *
 * Toute la logique API du studio (templates, fonds, photos, génération,
 * aperçu, créations) vit ICI, UNE SEULE FOIS. Les routes fines des deux
 * espaces appellent ces handlers avec leurs rôles :
 *   · /admin/api/studio/*        → super admins (back-office) ;
 *   · /secretariat/api/studio/*  → secrétariat (SECRETARY / SUPER_ADMIN).
 *
 * Sécurité (§35) : chaque handler appelle exigerSession (401/403 JSON),
 * valide les paramètres (types MIME, tailles, formats autorisés §36) et
 * n'expose JAMAIS d'erreur technique au client (§38).
 *
 * Stockage : Cloudflare R2 existant (r2.ts — « ne pas introduire un
 * nouveau fournisseur » §33). Clés :
 *   studio/backgrounds/<id>.<ext>
 *   studio/speakers/<id>-<orig|cut|thumb>.<ext>
 *   studio/visuels/<id>/<format>-<variante>.png
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { ensureStudioTables } from "@/lib/ensure-schema";
import { exigerSession } from "@/lib/staff-space/session";
import { uploadToR2, isR2Configured, deleteFromR2, extraireCleR2 } from "@/lib/r2";
import { ensureSeedStudio } from "@/lib/studio/templates-seed";
import {
  estIAActive,
  peaufinerPhotoNvidia,
  genererFondNvidia,
  consigneFond,
  ErreurNvidia,
} from "@/lib/studio/nvidia-ai";
import {
  FORMATS,
  FORMATS_PAR_DEFAUT,
  type CleFormat,
  type CleVariante,
  type ConfigLayout,
  type DonneesVisuel,
  type TypeVisuel,
} from "@/lib/visual-generator/types";
import { rendreVisuel } from "@/lib/visual-generator/renderer";
import { detourerPhoto } from "@/lib/visual-generator/cutout";

// ─────────────────────────────────────────────────────────────────────
// Constantes de validation (§36)
// ─────────────────────────────────────────────────────────────────────

const TAILLE_IMAGE_MAX = 15 * 1024 * 1024; // 15 Mo
const MIMES_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const CLES_VARIANTES: CleVariante[] = ["A", "B", "C", "D"];

function erreurJson(message: string, statut = 400, code?: string): NextResponse {
  return NextResponse.json({ error: message, code }, { status: statut });
}

/** Réponse d'erreur non technique (§38). */
function messageErreurGenere(): string {
  return "Impossible de générer le visuel. Vérifiez la photo sélectionnée puis réessayez.";
}

// ─────────────────────────────────────────────────────────────────────
// TEMPLATES — liste, création, modification, suppression
// ─────────────────────────────────────────────────────────────────────

const POLICES_VALIDES = new Set([
  "anton", "bebas", "oswald-600", "oswald-700", "montserrat-700",
  "montserrat-800", "montserrat-900", "inter-400", "inter-700", "poppins-600",
]);

/** Valide et normalise un layoutConfig (zones dangereuses rejetées). */
function validerLayout(valeur: unknown): ConfigLayout | null {
  if (!valeur || typeof valeur !== "object") return null;
  const l = valeur as Record<string, unknown>;
  const policeTitre = typeof l.policeTitre === "string" && POLICES_VALIDES.has(l.policeTitre)
    ? (l.policeTitre as ConfigLayout["policeTitre"])
    : "anton";
  const policeSousTitre =
    typeof l.policeSousTitre === "string" && POLICES_VALIDES.has(l.policeSousTitre)
      ? (l.policeSousTitre as ConfigLayout["policeSousTitre"])
      : "montserrat-700";
  const sujet = (l.sujet && typeof l.sujet === "object" ? l.sujet : {}) as Record<string, unknown>;
  const voile = (l.voile && typeof l.voile === "object" ? l.voile : {}) as Record<string, unknown>;
  const typesVoile = new Set(["aucun", "bas", "cote", "plein", "cinema"]);
  return {
    policeTitre,
    policeSousTitre,
    degradeTitre: Boolean(l.degradeTitre),
    sujet: {
      ombre: sujet.ombre !== false,
      halo: Boolean(sujet.halo),
      contour: typeof sujet.contour === "number" ? Math.min(0.05, Math.max(0, sujet.contour)) : undefined,
      luminosite: typeof sujet.luminosite === "number" ? Math.min(1.5, Math.max(0.5, sujet.luminosite)) : undefined,
      contraste: typeof sujet.contraste === "number" ? Math.min(1.5, Math.max(0.5, sujet.contraste)) : undefined,
      saturation: typeof sujet.saturation === "number" ? Math.min(2, Math.max(0, sujet.saturation)) : undefined,
    },
    voile: {
      type: typesVoile.has(voile.type as string) ? (voile.type as ConfigLayout["voile"]["type"]) : "cote",
      intensite: typeof voile.intensite === "number" ? Math.min(1, Math.max(0, voile.intensite)) : 0.8,
    },
    tailleTitre: typeof l.tailleTitre === "number" ? Math.min(1.6, Math.max(0.6, l.tailleTitre)) : 1,
    overrides: (l.overrides && typeof l.overrides === "object" ? l.overrides : undefined) as ConfigLayout["overrides"],
  };
}

export async function handlerListerTemplates(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureSeedStudio();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const inclureInactifs = url.searchParams.get("tous") === "1";

    const where: Record<string, unknown> = {};
    if (type === "miniature" || type === "affiche") where.templateType = type;
    if (!inclureInactifs) where.isActive = true;

    const items = await db.thumbnailTemplate.findMany({
      where,
      orderBy: [{ templateType: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[studio/templates] GET :", e);
    return erreurJson("Impossible de charger les templates.", 500);
  }
}

export async function handlerCreerTemplate(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const body = await request.json();
    const { name, description, templateType, styleKey, layoutConfig } = body as {
      name?: string; description?: string; templateType?: string; styleKey?: string; layoutConfig?: unknown;
    };
    if (!name?.trim()) return erreurJson("Le nom du template est requis.");
    if (templateType !== "miniature" && templateType !== "affiche") {
      return erreurJson("Type de template invalide (miniature ou affiche).");
    }
    const layout = validerLayout(layoutConfig);
    if (!layout) return erreurJson("Configuration du template invalide.", 400, "INVALID_TEMPLATE");

    const item = await db.thumbnailTemplate.create({
      data: {
        name: name.trim().substring(0, 120),
        description: description?.trim()?.substring(0, 500) || null,
        templateType,
        styleKey: styleKey || "noir-or",
        layoutConfig: layout as unknown as object,
        isActive: true,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error("[studio/templates] POST :", e);
    return erreurJson("Impossible de créer le template.", 500);
  }
}

export async function handlerModifierTemplate(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.thumbnailTemplate.findUnique({ where: { id } });
    if (!existant) return erreurJson("Le template sélectionné n'est plus disponible.", 404, "INVALID_TEMPLATE");

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim().substring(0, 120);
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().substring(0, 500) || null;
    }
    if (body.templateType === "miniature" || body.templateType === "affiche") {
      data.templateType = body.templateType;
    }
    if (typeof body.styleKey === "string") data.styleKey = body.styleKey;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.layoutConfig !== undefined) {
      const layout = validerLayout(body.layoutConfig);
      if (!layout) return erreurJson("Configuration du template invalide.", 400, "INVALID_TEMPLATE");
      data.layoutConfig = layout as unknown as object;
    }

    const item = await db.thumbnailTemplate.update({ where: { id }, data: data as never });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("[studio/templates] PATCH :", e);
    return erreurJson("Impossible de modifier le template.", 500);
  }
}

export async function handlerSupprimerTemplate(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.thumbnailTemplate.findUnique({ where: { id } });
    if (!existant) return erreurJson("Template introuvable.", 404);
    // Les créations référencent le template → désactivation plutôt que
    // suppression dure (l'historique reste consultable).
    await db.thumbnailTemplate.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, desactive: true });
  } catch (e) {
    console.error("[studio/templates] DELETE :", e);
    return erreurJson("Impossible de supprimer le template.", 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// FONDS (backgrounds)
// ─────────────────────────────────────────────────────────────────────

export async function handlerListerBackgrounds(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const url = new URL(request.url);
    const categorie = url.searchParams.get("categorie");
    const inclureInactifs = url.searchParams.get("tous") === "1";
    const where: Record<string, unknown> = {};
    if (categorie) where.category = categorie;
    if (!inclureInactifs) where.isActive = true;
    const items = await db.thumbnailBackground.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[studio/backgrounds] GET :", e);
    return erreurJson("Impossible de charger les fonds.", 500);
  }
}

export async function handlerCreerBackground(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    if (!isR2Configured()) {
      return erreurJson("Le stockage cloud n'est pas configuré — contactez l'administrateur.", 503);
    }

    const form = await request.formData();
    const fichier = form.get("file");
    const nom = (form.get("name") as string | null)?.trim();
    const categorie = (form.get("category") as string | null) || "general";
    const tags = (form.get("tags") as string | null) || "";

    if (!(fichier instanceof File)) return erreurJson("Image du fond requise.");
    if (fichier.size > TAILLE_IMAGE_MAX) return erreurJson("Image trop volumineuse (15 Mo maximum).");
    if (!MIMES_IMAGES.includes(fichier.type)) {
      return erreurJson("Format non supporté (JPEG, PNG ou WEBP uniquement).");
    }

    const tampon = Buffer.from(await fichier.arrayBuffer());
    const image = sharp(tampon);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return erreurJson("Image illisible.");

    // Conversion systématique en JPEG haute qualité (fonds opaques).
    const jpeg = await image.jpeg({ quality: 90 }).toBuffer();
    const id = crypto.randomUUID();
    const cle = `studio/backgrounds/${id}.jpg`;
    const url = await uploadToR2(cle, jpeg, "image/jpeg");

    const item = await db.thumbnailBackground.create({
      data: {
        name: (nom || "Fond").substring(0, 120),
        imageUrl: url,
        category: categorie,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        width: meta.width,
        height: meta.height,
        isActive: true,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error("[studio/backgrounds] POST :", e);
    return erreurJson("Impossible d'enregistrer le fond.", 500);
  }
}

export async function handlerModifierBackground(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().substring(0, 120);
    if (typeof body.category === "string") data.category = body.category;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const item = await db.thumbnailBackground.update({ where: { id }, data: data as never });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("[studio/backgrounds] PATCH :", e);
    return erreurJson("Impossible de modifier le fond.", 500);
  }
}

export async function handlerSupprimerBackground(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.thumbnailBackground.findUnique({ where: { id } });
    if (!existant) return erreurJson("Fond introuvable.", 404);
    const cle = extraireCleR2(existant.imageUrl);
    if (cle) await deleteFromR2(cle).catch(() => {});
    await db.thumbnailBackground.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[studio/backgrounds] DELETE :", e);
    return erreurJson("Impossible de supprimer le fond.", 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PHOTOS DES INTERVENANTS (upload + détourage §11/§12)
// ─────────────────────────────────────────────────────────────────────

export async function handlerListerPhotos(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const items = await db.speakerPhoto.findMany({
      orderBy: [{ speakerName: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[studio/speakers] GET :", e);
    return erreurJson("Impossible de charger les photos.", 500);
  }
}

export async function handlerUploaderPhoto(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    if (!isR2Configured()) {
      return erreurJson("Le stockage cloud n'est pas configuré — contactez l'administrateur.", 503);
    }

    const form = await request.formData();
    const fichier = form.get("file");
    const intervenant = (form.get("speaker_name") as string | null)?.trim();

    if (!(fichier instanceof File)) return erreurJson("Photo requise.");
    if (fichier.size > TAILLE_IMAGE_MAX) return erreurJson("Photo trop volumineuse (15 Mo maximum).");
    if (!MIMES_IMAGES.includes(fichier.type)) {
      return erreurJson("Format non supporté (JPEG, PNG ou WEBP uniquement).");
    }
    // ⭐ V3.90 — noms LIBRES (directive : « éditer les noms, ajouter autant
    // de noms qu'on veut ») : n'importe quel nom lisible de 1 à 80 caractères.
    const nomIntervenant = (intervenant || "").replace(/\s+/g, " ").trim();
    if (!nomIntervenant || nomIntervenant.length > 80) {
      return erreurJson("Nom d'intervenant invalide (1 à 80 caractères).");
    }

    const tampon = Buffer.from(await fichier.arrayBuffer());
    const id = crypto.randomUUID();

    // ① Original — PNG sans perte (préserve les futurs re-traitements).
    const original = await sharp(tampon).rotate().png({ compressionLevel: 9 }).toBuffer();
    const urlOriginale = await uploadToR2(
      `studio/speakers/${id}-orig.png`,
      original,
      "image/png"
    );

    // ② Détourage automatique (best-effort §12) — une seule fois.
    const detourage = await detourerPhoto(tampon);
    let urlDetouree: string | null = null;
    if (detourage.ok && detourage.tamponPng) {
      urlDetouree = await uploadToR2(
        `studio/speakers/${id}-cut.png`,
        detourage.tamponPng,
        "image/png"
      );
    }

    // ③ Miniature légère pour les galeries (WEBP 256 px).
    const miniature = await sharp(tampon)
      .rotate()
      .resize({ width: 256, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const urlMiniature = await uploadToR2(
      `studio/speakers/${id}-thumb.webp`,
      miniature,
      "image/webp"
    );

    const item = await db.speakerPhoto.create({
      data: {
        speakerName: nomIntervenant,
        originalUrl: urlOriginale,
        cutoutUrl: urlDetouree,
        thumbnailUrl: urlMiniature,
        isProcessed: Boolean(urlDetouree),
      },
    });

    return NextResponse.json(
      {
        item,
        detourage: detourage.ok
          ? { ok: true, couverture: Math.round(detourage.couverture * 100) }
          : { ok: false, raison: "fond trop complexe — photo originale conservée" },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[studio/speakers] POST :", e);
    return erreurJson("Impossible d'enregistrer la photo.", 500);
  }
}

export async function handlerSupprimerPhoto(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.speakerPhoto.findUnique({ where: { id } });
    if (!existant) return erreurJson("Photo introuvable.", 404);

    // Purge R2 best-effort des trois variantes.
    for (const url of [existant.originalUrl, existant.cutoutUrl, existant.thumbnailUrl]) {
      if (!url) continue;
      const cle = extraireCleR2(url);
      if (cle) await deleteFromR2(cle).catch(() => {});
    }
    await db.speakerPhoto.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[studio/speakers] DELETE :", e);
    return erreurJson("Impossible de supprimer la photo.", 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// APERÇU (rendu réduit — aucun stockage)
// ─────────────────────────────────────────────────────────────────────

export async function handlerApercu(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    // Tables + seed (première ouverture du studio dans un espace).
    await ensureSeedStudio();
    const body = await request.json();
    const donnees = body as Partial<DonneesVisuel> & {
      template_id?: string; variant?: CleVariante; format?: CleFormat;
    };

    const template = await db.thumbnailTemplate.findUnique({
      where: { id: donnees.template_id || "" },
    });
    if (!template || !template.isActive) {
      return erreurJson("Le template sélectionné n'est plus disponible.", 404, "INVALID_TEMPLATE");
    }
    const format: CleFormat =
      donnees.format && donnees.format in FORMATS ? donnees.format : "youtube";
    const variante: CleVariante =
      donnees.variant && CLES_VARIANTES.includes(donnees.variant) ? donnees.variant : "A";

    const visuel = construireDonneesVisuel(donnees, template.styleKey);
    const resultat = await rendreVisuel({
      donnees: visuel,
      layout: template.layoutConfig as unknown as ConfigLayout,
      format,
      variante,
      echelle: 0.5, // aperçu rapide : moitié de résolution
    });

    return NextResponse.json({
      dataUrl: `data:image/png;base64,${resultat.png.toString("base64")}`,
      largeur: resultat.largeur,
      hauteur: resultat.hauteur,
    });
  } catch (e) {
    console.error("[studio/preview] :", e);
    return erreurJson(messageErreurGenere(), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// GÉNÉRATION (multi-formats × variantes → R2 → base §28)
// ─────────────────────────────────────────────────────────────────────

/** Construit les DonneesVisuel normalisées depuis le corps de requête. */
function construireDonneesVisuel(
  body: Record<string, unknown>,
  styleParDefaut: string
): DonneesVisuel {
  // ⭐ V3.90 — noms libres : speaker_names (génération, ids de photos) ou
  // speakerNames (aperçu, déjà résolus côté client).
  const nomsBruts = Array.isArray(body.speaker_names)
    ? body.speaker_names
    : Array.isArray(body.speakerNames)
      ? body.speakerNames
      : [];
  const speakerNames = (nomsBruts as unknown[])
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);

  // ⭐ V3.90 — photos multiples pour l'APERÇU : [{ url, decoupee }] déjà
  // résolues par le client (aucune base dans ce chemin).
  const photosApercu = Array.isArray(body.photos_sujet)
    ? (body.photos_sujet as Array<Record<string, unknown>>)
        .filter(
          (p) =>
            p &&
            typeof p === "object" &&
            typeof p.url === "string" &&
            (/^https?:\/\//i.test(p.url) || p.url.startsWith("data:"))
        )
        .slice(0, 4)
        .map((p) => ({
          url: String(p.url),
          decoupee: p.decoupee === true,
        }))
    : [];

  const donnees: DonneesVisuel = {
    type: body.type === "affiche" || body.visual_type === "affiche" ? "affiche" : "miniature",
    titre: String(body.titre || body.title_text || "").substring(0, 300),
    accroche: body.accroche ? String(body.accroche).substring(0, 300) : undefined,
    sousTitre:
      body.sous_titre || body.subtitle_text
        ? String(body.sous_titre || body.subtitle_text).substring(0, 160)
        : undefined,
    speakerNames: speakerNames.length ? speakerNames : undefined,
    intervenant: (["kongo", "pam", "kongo-pam", "aucun"].includes(String(body.intervenant))
      ? body.intervenant
      : "aucun") as DonneesVisuel["intervenant"],
    photoUrl: body.photo_url ? String(body.photo_url) : undefined,
    photoDecoupee: body.photo_decoupee === true || body.photoDecoupee === true,
    photosSujet: photosApercu.length ? photosApercu : undefined,
    fondUrl: body.fond_url ? String(body.fond_url) : undefined,
    style: String(body.style || styleParDefaut || "noir-or"),
    dateEvenement: body.event_date ? String(body.event_date).substring(0, 10) : undefined,
    heureEvenement: body.event_time ? String(body.event_time).substring(0, 20) : undefined,
    lieuEvenement: body.event_location ? String(body.event_location).substring(0, 120) : undefined,
    verset: body.bible_verse ? String(body.bible_verse).substring(0, 120) : undefined,
  };
  // Sous-titre affiché : noms libres > sous-titre explicite > ancien champ.
  if (speakerNames.length) donnees.sousTitre = speakerNames.join(" & ").substring(0, 160);
  return donnees;
}

/** Résout la photo effective d'un intervenant (dernière importée). */
async function photoEffective(
  intervenant: DonneesVisuel["intervenant"],
  photoId?: string
): Promise<{ url: string; decoupee: boolean; nom: string } | null> {
  if (intervenant === "aucun") return null;

  if (photoId) {
    const photo = await db.speakerPhoto.findUnique({ where: { id: photoId } });
    if (photo) {
      return {
        url: photo.cutoutUrl || photo.originalUrl,
        decoupee: Boolean(photo.cutoutUrl),
        nom: photo.speakerName,
      };
    }
  }
  // Dernière photo de l'intervenant (mode rapide §44).
  const nomAttendu =
    intervenant === "kongo" ? "Pasteur Kongo" : intervenant === "pam" ? "Pam" : "Kongo & Pam";
  const derniere = await db.speakerPhoto.findFirst({
    where: { speakerName: nomAttendu },
    orderBy: { createdAt: "desc" },
  });
  if (derniere) {
    return {
      url: derniere.cutoutUrl || derniere.originalUrl,
      decoupee: Boolean(derniere.cutoutUrl),
      nom: derniere.speakerName,
    };
  }
  return null;
}

/**
 * ⭐ V3.90 — Résout TOUTES les photos d'une génération : les ids choisis
 * (speaker_photo_ids, une photo par intervenant, 4 max) ; à défaut, repli
 * sur le chemin historique (intervenant énuméré + id unique + mode rapide).
 */
async function photosEffectives(
  donnees: DonneesVisuel,
  body: Record<string, unknown>
): Promise<Array<{ url: string; decoupee: boolean; nom: string }>> {
  const idsBruts = Array.isArray(body.speaker_photo_ids) ? body.speaker_photo_ids : [];
  const ids = (idsBruts as unknown[])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, 4);

  const resolutions: Array<{ url: string; decoupee: boolean; nom: string } | null> =
    await Promise.all(
      ids.map(async (id) => {
        const photo = await db.speakerPhoto.findUnique({ where: { id } });
        if (!photo) return null;
        return {
          url: photo.cutoutUrl || photo.originalUrl,
          decoupee: Boolean(photo.cutoutUrl),
          nom: photo.speakerName,
        };
      })
    );
  const trouves = resolutions.filter(
    (r): r is { url: string; decoupee: boolean; nom: string } => r !== null
  );
  if (trouves.length) return trouves;

  // Repli historique (mode rapide §44 / anciens appels).
  const unique = await photoEffective(
    donnees.intervenant,
    typeof body.speaker_photo_id === "string" ? body.speaker_photo_id : undefined
  );
  return unique ? [unique] : [];
}

export async function handlerGenerer(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  const debut = Date.now();
  try {
    await ensureStudioTables();
    if (!isR2Configured()) {
      return erreurJson("Le stockage cloud n'est pas configuré — contactez l'administrateur.", 503);
    }

    let body = (await request.json()) as Record<string, unknown>;

    // ⭐ Mode rapide (§44) : depuis une vidéo — titre, intervenant, photo,
    // template et fond recommandés automatiquement.
    if (body.rapide === true && typeof body.video_id === "string") {
      body = await completerGenerationRapide(body);
    }

    const typeVisuel: TypeVisuel =
      body.visual_type === "affiche" ? "affiche" : "miniature";
    const templateId = String(body.template_id || "");
    const template = await db.thumbnailTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) {
      return erreurJson("Le template sélectionné n'est plus disponible.", 404, "INVALID_TEMPLATE");
    }
    if (template.templateType !== typeVisuel) {
      return erreurJson(
        `Ce template est conçu pour les ${template.templateType}s — choisissez-en un autre.`
      );
    }

    // Validation des champs requis (§37).
    const donnees = construireDonneesVisuel(body, template.styleKey);
    if (!donnees.titre.trim()) {
      return erreurJson("Le titre est requis.");
    }
    if (typeVisuel === "affiche" && !donnees.dateEvenement && !donnees.lieuEvenement) {
      return erreurJson(
        "Pour une affiche, renseignez au moins la date ou le lieu de l'événement."
      );
    }

    // Formats autorisés pour ce type (§37).
    const formatsDemandes = Array.isArray(body.formats)
      ? (body.formats as string[])
      : FORMATS_PAR_DEFAUT[typeVisuel];
    const formats = formatsDemandes.filter(
      (f): f is CleFormat =>
        f in FORMATS && FORMATS[f as CleFormat].types.includes(typeVisuel)
    );
    if (!formats.length) {
      return erreurJson("Aucun format valide sélectionné.");
    }

    const variantes = Array.isArray(body.variants) && body.variants.length
      ? (body.variants as string[]).filter((v): v is CleVariante =>
          CLES_VARIANTES.includes(v as CleVariante)
        )
      : (["A"] as CleVariante[]);
    if (!variantes.length) variantes.push("A");

    // Photos des intervenants (V3.90 : une par personne — ids multiples,
    // repli historique pour le mode rapide).
    const photos = await photosEffectives(donnees, body);
    if (photos.length) {
      donnees.photosSujet = photos.map((p) => ({ url: p.url, decoupee: p.decoupee }));
      donnees.photoUrl = photos[0].url;
      donnees.photoDecoupee = photos[0].decoupee;
      if (!donnees.sousTitre) donnees.sousTitre = photos.map((p) => p.nom).join(" & ");
    }

    // Fond sélectionné.
    if (typeof body.fond_id === "string" && body.fond_id) {
      const fond = await db.thumbnailBackground.findUnique({ where: { id: body.fond_id } });
      if (fond && fond.isActive) donnees.fondUrl = fond.imageUrl;
    }

    const layout = template.layoutConfig as unknown as ConfigLayout;
    const creations: Array<Record<string, unknown>> = [];

    // Génération : chaque variante = une création distincte (§7).
    for (const variante of variantes) {
      const sortieUrls: Record<string, string> = {};
      for (const format of formats) {
        const resultat = await rendreVisuel({ donnees, layout, format, variante });
        const nomFichier = `${format}-${variante.toLowerCase()}.png`;
        const cle = `studio/visuels/${crypto.randomUUID()}/${nomFichier}`;
        const url = await uploadToR2(cle, resultat.png, "image/png");
        sortieUrls[format] = url;
      }

      const creation = await db.generatedVisual.create({
        data: {
          visualType: typeVisuel,
          videoId: typeof body.video_id === "string" ? body.video_id : null,
          templateId: template.id,
          variant: variante,
          titleText: donnees.titre,
          subtitleText: donnees.sousTitre || null,
          speakerPhotoId:
            typeof body.speaker_photo_id === "string" ? body.speaker_photo_id : null,
          speakerName:
            donnees.speakerNames?.length
              ? donnees.speakerNames.join(" & ")
              : photos.length
                ? photos.map((p) => p.nom).join(" & ")
                : null,
          eventDate: donnees.dateEvenement ? new Date(`${donnees.dateEvenement}T12:00:00Z`) : null,
          eventTime: donnees.heureEvenement || null,
          eventLocation: donnees.lieuEvenement || null,
          bibleVerse: donnees.verset || null,
          status: "generated",
          outputUrls: sortieUrls,
          metadata: {
            accroche: donnees.accroche || null,
            style: donnees.style,
            fondId: typeof body.fond_id === "string" ? body.fond_id : null,
            formats,
            dureeMs: Date.now() - debut,
          } as unknown as object,
          createdBy: userId,
        },
      });
      creations.push(creation);
    }

    return NextResponse.json(
      { creations, dureeMs: Date.now() - debut },
      { status: 201 }
    );
  } catch (e) {
    console.error("[studio/generate] :", e);
    return erreurJson(messageErreurGenere(), 500);
  }
}

/**
 * ⭐ Mode rapide (§44/§45) : complète le corps avec le titre de la vidéo,
 * l'intervenant, sa dernière photo et le template recommandé selon la
 * catégorie (Saint-Esprit → Fire Sermon…).
 */
async function completerGenerationRapide(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const video = await db.video.findUnique({
    where: { id: String(body.video_id) },
    include: { servant: { select: { fullName: true, code: true } } },
  });
  if (!video) return body;

  const corps: Record<string, unknown> = { ...body };
  if (!corps.titre && !corps.title_text) corps.title_text = video.title;

  // Intervenant depuis le serviteur de la vidéo (code « kongo »/« afrika »
  // fiable, repli sur le nom complet).
  const servantVideo = (video as { servant?: { fullName?: string; code?: string } }).servant;
  const nomServiteur = `${servantVideo?.code || ""} ${servantVideo?.fullName || ""}`.toLowerCase();
  if (!corps.intervenant) {
    if (nomServiteur.includes("kongo")) corps.intervenant = "kongo";
    else if (nomServiteur.includes("afrika") || nomServiteur.includes("pam")) corps.intervenant = "pam";
  }

  // Template recommandé selon la catégorie (§45).
  if (!corps.template_id) {
    const categorie = (video.category || "").toLowerCase();
    let styleRecommande = "noir-or";
    if (categorie.includes("saint-esprit") || categorie.includes("delivrance")) {
      styleRecommande = "feu-puissance";
    } else if (categorie.includes("rhema") || categorie.includes("enseignement")) {
      styleRecommande = "enseignement";
    } else if (categorie.includes("adoration") || categorie.includes("louange")) {
      styleRecommande = "royal";
    }
    const candidats = await db.thumbnailTemplate.findMany({
      where: { templateType: "miniature", isActive: true, styleKey: styleRecommande },
      take: 1,
    });
    if (candidats.length) corps.template_id = candidats[0].id;
  }
  return corps;
}

// ─────────────────────────────────────────────────────────────────────
// CRÉATIONS — historique, duplication, suppression, sélection vidéo
// ─────────────────────────────────────────────────────────────────────

export async function handlerListerCreations(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const videoId = url.searchParams.get("video_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "60"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (type === "miniature" || type === "affiche") where.visualType = type;
    if (videoId) where.videoId = videoId;

    const [items, total] = await Promise.all([
      db.generatedVisual.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.generatedVisual.count({ where }),
    ]);
    return NextResponse.json({ items, total });
  } catch (e) {
    console.error("[studio/creations] GET :", e);
    return erreurJson("Impossible de charger les créations.", 500);
  }
}

export async function handlerDupliquerCreation(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;
  try {
    await ensureStudioTables();
    const origine = await db.generatedVisual.findUnique({ where: { id } });
    if (!origine) return erreurJson("Création introuvable.", 404);

    // §26 : la copie est modifiable ensuite depuis le studio (les textes
    // sont ré-éditables, la composition est conservée).
    const copie = await db.generatedVisual.create({
      data: {
        visualType: origine.visualType,
        videoId: origine.videoId,
        templateId: origine.templateId,
        variant: origine.variant,
        titleText: origine.titleText,
        subtitleText: origine.subtitleText,
        speakerPhotoId: origine.speakerPhotoId,
        speakerName: origine.speakerName,
        eventDate: origine.eventDate,
        eventTime: origine.eventTime,
        eventLocation: origine.eventLocation,
        bibleVerse: origine.bibleVerse,
        status: "draft",
        outputUrls: origine.outputUrls as object,
        metadata: {
          ...((origine.metadata as Record<string, unknown>) || {}),
          dupliqueeDe: origine.id,
        } as unknown as object,
        createdBy: userId,
      },
    });
    return NextResponse.json({ item: copie }, { status: 201 });
  } catch (e) {
    console.error("[studio/creations] POST duplicate :", e);
    return erreurJson("Impossible de dupliquer la création.", 500);
  }
}

export async function handlerModifierCreation(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.generatedVisual.findUnique({ where: { id } });
    if (!existant) return erreurJson("Création introuvable.", 404);

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.status === "string" && ["draft", "generated", "selected", "archived"].includes(body.status)) {
      data.status = body.status;
    }

    // ⭐ §28 — Association aux vidéos : « Utiliser comme miniature ».
    if (body.appliquer_video === true && existant.videoId) {
      const sorties = (existant.outputUrls as Record<string, string>) || {};
      const miniature = sorties.youtube || sorties.square || Object.values(sorties)[0];
      if (!miniature) {
        return erreurJson("Cette création n'a pas encore de format exploitable.");
      }
      await db.video.update({
        where: { id: existant.videoId },
        data: { thumbnailUrl: miniature },
      });
      data.status = "selected";
    }

    const item = await db.generatedVisual.update({ where: { id }, data: data as never });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("[studio/creations] PATCH :", e);
    return erreurJson("Impossible de modifier la création.", 500);
  }
}

export async function handlerSupprimerCreation(
  request: NextRequest,
  roles: readonly string[],
  id: string
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    const existant = await db.generatedVisual.findUnique({ where: { id } });
    if (!existant) return erreurJson("Création introuvable.", 404);

    // Purge R2 best-effort de tous les formats exportés.
    const sorties = (existant.outputUrls as Record<string, string>) || {};
    for (const url of Object.values(sorties)) {
      const cle = extraireCleR2(url);
      if (cle) await deleteFromR2(cle).catch(() => {});
    }
    await db.generatedVisual.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[studio/creations] DELETE :", e);
    return erreurJson("Impossible de supprimer la création.", 500);
  }
}

// ─────────────────────────────────────────────────────────────────────
// MÉTADONNÉES du studio (styles + formats + polices — pour l'UI)
// ─────────────────────────────────────────────────────────────────────

export async function handlerMetaStudio(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  // marques des styles & formats : ré-export des constantes partagées.
  const { STYLES_STUDIO } = await import("@/lib/studio/brand-tokens");
  return NextResponse.json({
    styles: STYLES_STUDIO,
    formats: FORMATS,
    formatsParDefaut: FORMATS_PAR_DEFAUT,
    variantes: CLES_VARIANTES,
    polices: [...POLICES_VALIDES],
    // ⭐ V3.90 — l'IA NVIDIA est-elle configurée ? (la clé n'est JAMAIS
    // exposée — seulement son état, pour afficher ou non les boutons IA).
    ia: { active: estIAActive() },
  });
}

// ─────────────────────────────────────────────────────────────────────
// ⭐ V3.90 — IA NVIDIA (build.nvidia.com)
//   · peaufiner une photo d'intervenant (FLUX.1 Kontext [dev]) : éclairage
//     studio, netteté, fond nettoyé — identité conservée, puis
//     DÉTOURAGE AUTOMATIQUE par notre moteur (cutout.ts) ;
//   · générer un fond (FLUX.1 [dev]) à la palette du ministère.
// ─────────────────────────────────────────────────────────────────────

/** Traduit une erreur NVIDIA en message pastoral (jamais technique). */
function messageIA(e: unknown): string {
  if (e instanceof ErreurNvidia) {
    if (e.statut === 503) return "L'IA n'est pas encore configurée — ajoutez la clé NVIDIA (NVIDIA_API_KEY).";
    if (e.statut === 401 || e.statut === 403)
      return "Clé NVIDIA refusée — vérifiez qu'elle est active sur build.nvidia.com.";
    if (e.statut === 429)
      return "L'IA est très sollicitée pour le moment — patientez un instant puis réessayez.";
    if (e.statut >= 500)
      return "Le service IA est momentanément indisponible — réessayez dans quelques instants.";
    return "L'IA n'a pas pu traiter cette demande — ajustez la photo ou la consigne puis réessayez.";
  }
  return "L'IA n'a pas abouti — réessayez dans un instant.";
}

export async function handlerPeaufinerPhotoIA(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    if (!estIAActive()) {
      return erreurJson(
        "L'IA n'est pas configurée — ajoutez la clé NVIDIA_API_KEY (Vercel → Paramètres → Variables d'environnement).",
        503,
        "IA_INACTIVE"
      );
    }
    if (!isR2Configured()) {
      return erreurJson("Le stockage cloud n'est pas configuré — contactez l'administrateur.", 503);
    }

    const body = await request.json();
    const idPhoto = String(body.speaker_photo_id || "");
    const consigne =
      typeof body.consigne === "string" ? body.consigne.substring(0, 400) : undefined;
    const origine = await db.speakerPhoto.findUnique({ where: { id: idPhoto } });
    if (!origine) return erreurJson("Photo introuvable.", 404);

    // ① Peaufinage IA — la photo ORIGINALE (opaque) est envoyée : le
    //    modèle conserve la personne, la pose et les vêtements.
    let pngIA: Buffer;
    try {
      pngIA = await peaufinerPhotoNvidia(origine.originalUrl, consigne);
    } catch (e) {
      console.error("[studio/ai/peaufiner] NVIDIA :", e);
      return erreurJson(messageIA(e), 502, "IA_ECHEC");
    }
    if (pngIA.length < 1024) {
      return erreurJson("L'IA a renvoyé un résultat inexploitable — réessayez.", 502, "IA_ECHEC");
    }

    // ② Post-traitement : bornage 2048 px + PNG sans perte.
    const travaille = await sharp(pngIA)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    // ③ DÉTOURAGE AUTOMATIQUE du résultat IA (best-effort — silhouettes
    //    propres dans le moteur de composition).
    const detourage = await detourerPhoto(travaille);

    // ④ Enregistrement : NOUVELLE photo (l'originale reste intacte dans
    //    la bibliothèque — on ne détruit jamais le travail).
    const id = crypto.randomUUID();
    const urlOriginale = await uploadToR2(
      `studio/speakers/${id}-orig.png`,
      travaille,
      "image/png"
    );
    let urlDetouree: string | null = null;
    if (detourage.ok && detourage.tamponPng) {
      urlDetouree = await uploadToR2(
        `studio/speakers/${id}-cut.png`,
        detourage.tamponPng,
        "image/png"
      );
    }
    const miniature = await sharp(travaille)
      .resize({ width: 256, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const urlMiniature = await uploadToR2(
      `studio/speakers/${id}-thumb.webp`,
      miniature,
      "image/webp"
    );

    const item = await db.speakerPhoto.create({
      data: {
        speakerName: origine.speakerName,
        originalUrl: urlOriginale,
        cutoutUrl: urlDetouree,
        thumbnailUrl: urlMiniature,
        isProcessed: Boolean(urlDetouree),
      },
    });

    return NextResponse.json(
      {
        item,
        source: { id: origine.id },
        detourage: detourage.ok
          ? { ok: true, couverture: Math.round(detourage.couverture * 100) }
          : { ok: false, raison: "fond trop complexe — photo IA conservée opaque" },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[studio/ai/peaufiner] :", e);
    return erreurJson("Impossible de peaufiner la photo — réessayez.", 500);
  }
}

export async function handlerGenererFondIA(
  request: NextRequest,
  roles: readonly string[]
): Promise<NextResponse> {
  const garde = exigerSession(request, roles);
  if ("reponse" in garde) return garde.reponse;
  try {
    await ensureStudioTables();
    if (!estIAActive()) {
      return erreurJson(
        "L'IA n'est pas configurée — ajoutez la clé NVIDIA_API_KEY (Vercel → Paramètres → Variables d'environnement).",
        503,
        "IA_INACTIVE"
      );
    }
    if (!isR2Configured()) {
      return erreurJson("Le stockage cloud n'est pas configuré — contactez l'administrateur.", 503);
    }

    const body = await request.json();
    const intention = String(body.prompt || "").substring(0, 300).trim();
    if (!intention) return erreurJson("Décrivez le fond souhaité (quelques mots suffisent).");
    const style = typeof body.style === "string" ? body.style : undefined;
    const categorie =
      typeof body.categorie === "string" && body.categorie.length <= 30
        ? body.categorie
        : "general";
    const nom = String(body.nom || intention).substring(0, 80);

    // ① Génération IA à la palette du ministère.
    let pngIA: Buffer;
    try {
      pngIA = await genererFondNvidia(consigneFond(intention, style));
    } catch (e) {
      console.error("[studio/ai/fond] NVIDIA :", e);
      return erreurJson(messageIA(e), 502, "IA_ECHEC");
    }
    if (pngIA.length < 1024) {
      return erreurJson("L'IA a renvoyé un résultat inexploitable — reformulez et réessayez.", 502, "IA_ECHEC");
    }

    // ② Post-traitement : 1920×1080 JPEG Q90 (même format que la
    //    bibliothèque de fonds).
    const fond = await sharp(pngIA)
      .rotate()
      .resize(1920, 1080, { fit: "cover", position: "attention" })
      .jpeg({ quality: 90 })
      .toBuffer();
    const meta = await sharp(fond).metadata();
    const url = await uploadToR2(
      `studio/backgrounds/${crypto.randomUUID()}.jpg`,
      fond,
      "image/jpeg"
    );

    const item = await db.thumbnailBackground.create({
      data: {
        name: nom,
        imageUrl: url,
        category: categorie,
        tags: { ia: true, intention } as unknown as object,
        width: meta.width || 1920,
        height: meta.height || 1080,
        isActive: true,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error("[studio/ai/fond] :", e);
    return erreurJson("Impossible de générer le fond — reformulez et réessayez.", 500);
  }
}
