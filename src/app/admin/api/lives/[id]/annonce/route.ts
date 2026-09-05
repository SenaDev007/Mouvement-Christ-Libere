/**
 * ⭐ V3.40 — ANNONCE D'UN LIVE : REJEU MANUEL + DIAGNOSTIC TRANSPARENT.
 * POST /admin/api/lives/[id]/annonce
 * ============================================================================
 *
 * CONTEXTE (incident production 2026-09-05) : le relay automatique
 * (V3.36 création / V3.38 reprogrammation) est BEST-EFFORT et silencieux.
 * Le live « De l'épreuve à la destinée » reprogrammé à 18:44:39 (6 min
 * AVANT la fin du déploiement V3.38 à 18:50:53 → l'ancien code a traité
 * le PATCH) n'a jamais été annoncé. Un PATCH de vérification a ensuite
 * prouvé que le relay se déclenche (le bot système est créé 62 s plus
 * tard) mais que les MESSAGES ne sont pas créés : l'erreur réelle est
 * avalée par le catch du relay et les logs Vercel ne sont pas consultables
 * depuis le back-office.
 *
 * Cette route donne à l'administrateur :
 *   1. UN REJEU MANUEL FIABLE — « Annoncer maintenant » : filet de
 *      sécurité si le relay automatique échoue (ou si la reprogrammation a
 *      été traitée par une version antérieure du code) ;
 *   2. UN DIAGNOSTIC TRANSPARENT — chaque étape du relay est exécutée et
 *      rapportée individuellement (live, serviteur, canal, bot, message
 *      texte, miniature, horodatage, push) avec l'erreur EXACTE et sa
 *      durée : la cause d'un échec est lisible dans la réponse JSON, sans
 *      accès aux logs Vercel ;
 *   3. dryRun=true — tout diagnostiquer SANS rien publier (aucun message
 *      créé, aucun push envoyé).
 *
 * Le message publié est EXACTEMENT celui du relay automatique (les
 * formatteurs formaterMessageAnnonce / formaterMessageAnnulation sont
 * importés du relay — zéro divergence de formulation).
 *
 * Body JSON optionnel : { mode?: "PROGRAMME"|"REPROGRAMME"|"ANNULE",
 *                         dryRun?: boolean }
 * Réponse : { succes, mode, dryRun, etapes: [{ etape, ok, ms, detail?,
 *              erreur?, codeErreur? }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push-notifications";
import {
  formaterMessageAnnonce,
  formaterMessageAnnulation,
  CANAL_ANNONCES_NOM,
} from "@/lib/live-announcement-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Utilisateur SYSTÈME qui signe les messages (identique au relay). */
const BOT_EMAIL = "annonces@system.christ-libere";
const BOT_NAME = "Annonces Christ Libère";

/** Durée maximum d'une miniature relayée (data URL) — garde-fou mémoire. */
const TAILLE_MINIATURE_MAX = 900_000;

type ModeDemande = "PROGRAMME" | "REPROGRAMME" | "ANNULE";

interface EtapeRapport {
  etape: string;
  ok: boolean;
  ms: number;
  detail?: string;
  erreur?: string;
  codeErreur?: string;
}

function decrireErreur(e: unknown): { erreur: string; codeErreur?: string } {
  if (e instanceof Error) {
    // Code Prisma (P2002, P2022, P2024…) quand il est disponible.
    const code = (e as { code?: string }).code;
    return { erreur: e.message, codeErreur: code };
  }
  return { erreur: String(e) };
}

/**
 * GET /admin/api/lives/[id]/annonce — DIAGNOSTIC en lecture seule.
 *
 * Compte les messages du canal d'annonces et retourne les derniers avec
 * leur `isDeleted` BRUT : permet de vérifier en production, sans accès
 * aux logs ni à la base, que les messages publiés par le relay sont bien
 * en base et avec quel état `isDeleted` (la route publique des messages
 * filtre `isDeleted = false` — un défaut SQL absent fait disparaître les
 * annonces du canal alors que la sidebar les voit encore).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🔒 Authentification back-office.
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  try {
    // Canal d'annonces (même sélection que le relay).
    const existants = await db.channel.findMany({
      where: { type: "ANNOUNCEMENT" },
      orderBy: [{ createdAt: "asc" }],
      select: { id: true, name: true },
    });
    const nomme = existants.find((c) => /annonce/i.test(c.name || ""));
    const canal = nomme ?? existants[0] ?? null;
    if (!canal) {
      return NextResponse.json({ canal: null, total: 0, message: "Aucun canal ANNOUNCEMENT" });
    }

    // Comptages par état isDeleted (NULL compris).
    const parEtat = await db.message.groupBy({
      by: ["isDeleted"],
      where: { channelId: canal.id },
      _count: { _all: true },
    });

    // Les 3 derniers messages, isDeleted brut inclus.
    const derniers = await db.message.findMany({
      where: { channelId: canal.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        id: true,
        content: true,
        type: true,
        isDeleted: true,
        createdAt: true,
        userId: true,
      },
    });

    return NextResponse.json({
      canal: { id: canal.id, nom: canal.name },
      total: parEtat.reduce((s, g) => s + g._count._all, 0),
      parEtat: parEtat.map((g) => ({ isDeleted: g.isDeleted, count: g._count._all })),
      derniers: derniers.map((m) => ({
        id: m.id,
        type: m.type,
        isDeleted: m.isDeleted,
        createdAt: m.createdAt,
        auteurId: m.userId,
        contenu: m.content?.substring(0, 120) ?? null,
      })),
    });
  } catch (error) {
    const { erreur, codeErreur } = decrireErreur(error);
    return NextResponse.json({ error: erreur, codeErreur }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🔒 Authentification back-office (même garde que les routes admin).
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  // Body optionnel : mode + dryRun.
  let mode: ModeDemande = "PROGRAMME";
  let dryRun = false;
  try {
    const body = (await request.json()) as {
      mode?: ModeDemande;
      dryRun?: boolean;
    };
    if (body?.mode === "REPROGRAMME" || body?.mode === "ANNULE" || body?.mode === "PROGRAMME") {
      mode = body.mode;
    }
    dryRun = Boolean(body?.dryRun);
  } catch {
    // Pas de body (ou body non JSON) : valeurs par défaut.
  }

  const etapes: EtapeRapport[] = [];
  const debut = Date.now();

  try {
    // ─── Étape 1 : le live ────────────────────────────────────────────
    let t = Date.now();
    let live: {
      id: string;
      title: string;
      description: string | null;
      scheduledAt: Date;
      servantId: string | null;
      status: string | null;
      thumbnailUrl: string | null;
    } | null = null;
    try {
      live = await db.liveStream.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          scheduledAt: true,
          servantId: true,
          status: true,
          thumbnailUrl: true,
        },
      });
      etapes.push({
        etape: "live",
        ok: !!live,
        ms: Date.now() - t,
        detail: live
          ? `« ${live.title} » · ${new Date(live.scheduledAt).toISOString()} · statut ${live.status || "?"}`
          : "Live introuvable",
      });
      if (!live) {
        return NextResponse.json(
          { succes: false, mode, dryRun, etapes },
          { status: 404 }
        );
      }
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "live", ok: false, ms: Date.now() - t, erreur, codeErreur });
      return NextResponse.json({ succes: false, mode, dryRun, etapes });
    }

    // ─── Étape 2 : le serviteur (nom affiché dans l'annonce) ──────────
    t = Date.now();
    let servantNom = "Serviteur de Dieu";
    try {
      if (live.servantId) {
        const servant = await db.servant.findUnique({
          where: { id: live.servantId },
          select: { shortName: true },
        });
        if (servant?.shortName) servantNom = servant.shortName;
      }
      etapes.push({
        etape: "serviteur",
        ok: true,
        ms: Date.now() - t,
        detail: servantNom,
      });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "serviteur", ok: false, ms: Date.now() - t, erreur, codeErreur });
    }

    // ─── Étape 3 : le canal d'annonces (MÊME logique que le relay) ────
    t = Date.now();
    let canalId: string | null = null;
    try {
      const existants = await db.channel.findMany({
        where: { type: "ANNOUNCEMENT" },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true, name: true },
      });
      const nomme = existants.find((c) => /annonce/i.test(c.name || ""));
      const choisi = nomme ?? existants[0] ?? null;
      canalId = choisi?.id ?? null;
      etapes.push({
        etape: "canal-annonces",
        ok: !!canalId,
        ms: Date.now() - t,
        detail: canalId
          ? `« ${choisi?.name} » (${existants.length} canal(aux) ANNOUNCEMENT)`
          : `Aucun canal ANNOUNCEMENT — ${CANAL_ANNONCES_NOM} serait créé à la publication`,
      });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "canal-annonces", ok: false, ms: Date.now() - t, erreur, codeErreur });
    }

    // dryRun → on s'arrête avant toute écriture : rapport de principe.
    if (dryRun) {
      // Vérification du bot sans création (lecture seule).
      t = Date.now();
      try {
        const bot = await db.user.findUnique({
          where: { email: BOT_EMAIL },
          select: { id: true },
        });
        etapes.push({
          etape: "bot-systeme",
          ok: true,
          ms: Date.now() - t,
          detail: bot ? "existant" : "sera créé à la publication",
        });
      } catch (e) {
        const { erreur, codeErreur } = decrireErreur(e);
        etapes.push({ etape: "bot-systeme", ok: false, ms: Date.now() - t, erreur, codeErreur });
      }
      etapes.push({
        etape: "publication",
        ok: true,
        ms: 0,
        detail: "dryRun — aucune écriture effectuée",
      });
      return NextResponse.json({ succes: true, mode, dryRun, etapes });
    }

    // ─── Étape 4 : le bot système (find-or-create) ────────────────────
    t = Date.now();
    let botId: string | null = null;
    try {
      const existant = await db.user.findUnique({
        where: { email: BOT_EMAIL },
        select: { id: true },
      });
      botId = existant?.id ?? null;
      if (!botId) {
        const cree = await db.user.create({
          data: {
            email: BOT_EMAIL,
            name: BOT_NAME,
            role: "MEMBER",
            isVerified: true,
            acceptedTerms: new Date(),
            notifMessages: false,
            notifAnnouncements: false,
            notifCommunity: false,
            notifLive: false,
          },
          select: { id: true },
        });
        botId = cree.id;
      }
      etapes.push({
        etape: "bot-systeme",
        ok: !!botId,
        ms: Date.now() - t,
        detail: existant ? "existant" : "créé",
      });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "bot-systeme", ok: false, ms: Date.now() - t, erreur, codeErreur });
    }

    if (!canalId || !botId) {
      return NextResponse.json({
        succes: false,
        mode,
        dryRun,
        etapes,
        conclusion:
          "Canal d'annonces ou bot système indisponible — voir l'étape en échec ci-dessus.",
      });
    }

    // ─── Étape 5 : le message texte (l'annonce structurée) ────────────
    // MÊME format que le relay automatique (formatteurs importés).
    t = Date.now();
    const contenu =
      mode === "ANNULE"
        ? formaterMessageAnnulation({
            liveId: live.id,
            titre: live.title,
            scheduledAt: new Date(live.scheduledAt),
            servantNom,
          })
        : formaterMessageAnnonce(
            {
              liveId: live.id,
              titre: live.title,
              description: live.description ?? null,
              scheduledAt: new Date(live.scheduledAt),
              servantNom,
              thumbnailUrl: live.thumbnailUrl ?? null,
            },
            mode === "REPROGRAMME" ? "REPROGRAMME" : "PROGRAMME"
          );
    try {
      await db.message.create({
        data: {
          channelId: canalId,
          userId: botId,
          content: contenu,
          type: "TEXT",
        },
      });
      etapes.push({
        etape: "message-texte",
        ok: true,
        ms: Date.now() - t,
        detail: `${contenu.length} caractères publiés`,
      });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "message-texte", ok: false, ms: Date.now() - t, erreur, codeErreur });
      return NextResponse.json({ succes: false, mode, dryRun, etapes });
    }

    // ─── Étape 6 : la miniature, intacte (message IMAGE) ──────────────
    const miniature = live.thumbnailUrl;
    if (miniature && miniature.length <= TAILLE_MINIATURE_MAX) {
      t = Date.now();
      try {
        await db.message.create({
          data: {
            channelId: canalId,
            userId: botId,
            content: `Miniature du live : ${live.title}`,
            type: "IMAGE",
            attachmentUrl: miniature,
            attachmentName: `live-${live.id}`,
            ...(miniature.startsWith("data:")
              ? { attachmentMime: miniature.match(/^data:([^;,]+)/)?.[1] || "image/jpeg" }
              : {}),
          },
        });
        etapes.push({
          etape: "message-miniature",
          ok: true,
          ms: Date.now() - t,
          detail: `${miniature.length} caractères`,
        });
      } catch (e) {
        const { erreur, codeErreur } = decrireErreur(e);
        etapes.push({ etape: "message-miniature", ok: false, ms: Date.now() - t, erreur, codeErreur });
      }
    } else if (miniature) {
      etapes.push({
        etape: "message-miniature",
        ok: true,
        ms: 0,
        detail: `ignorée (${miniature.length} caractères > garde-fou)`,
      });
    }

    // ─── Étape 7 : horodatage du canal (tri sidebar + aperçu) ─────────
    t = Date.now();
    try {
      await db.channel.update({
        where: { id: canalId },
        data: { lastMessageAt: new Date() },
      });
      etapes.push({ etape: "horodatage-canal", ok: true, ms: Date.now() - t });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "horodatage-canal", ok: false, ms: Date.now() - t, erreur, codeErreur });
    }

    // ─── Étape 8 : notification push (best-effort) ────────────────────
    t = Date.now();
    try {
      const membres = await db.user.findMany({
        where: { pushEnabled: true, notifLive: true },
        select: { id: true },
        take: 500,
      });
      let pushes = 0;
      await Promise.all(
        membres.map((m) =>
          sendPushToUser(m.id, {
            title:
              mode === "ANNULE"
                ? "⚠️ Live annulé"
                : mode === "REPROGRAMME"
                  ? "🔴 Live reprogrammé"
                  : "🔴 Live programmé",
            body: `${servantNom} — ${live.title}`,
            data: { type: "live_annonce", conversationId: canalId! },
            androidChannelId: "yeshua_messages",
          })
            .then(() => {
              pushes++;
            })
            .catch(() => {}),
        ),
      );
      etapes.push({
        etape: "push",
        ok: true,
        ms: Date.now() - t,
        detail: `${pushes}/${membres.length} notifications`,
      });
    } catch (e) {
      const { erreur, codeErreur } = decrireErreur(e);
      etapes.push({ etape: "push", ok: false, ms: Date.now() - t, erreur, codeErreur });
    }

    return NextResponse.json({
      succes: true,
      mode,
      dryRun,
      etapes,
      totalMs: Date.now() - debut,
    });
  } catch (error) {
    const { erreur, codeErreur } = decrireErreur(error);
    return NextResponse.json(
      { succes: false, mode, dryRun, etapes, erreur, codeErreur },
      { status: 500 }
    );
  }
}
