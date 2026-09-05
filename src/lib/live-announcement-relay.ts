import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push-notifications";

/**
 * ⭐ V3.36 — ANNONCE AUTOMATIQUE DES LIVES PROGRAMMÉS DANS YESHUA CONNECT.
 * ⭐ V3.38 — étendue à la REPROGRAMMATION (PATCH back-office) et à
 *            l'ANNULATION d'un live.
 * ============================================================================
 *
 * Directive du pasteur : quand un admin programme un live depuis le
 * back-office (module Lives — « Programmer un live »), l'information doit
 * être annoncée AUTOMATIQUEMENT dans Yeshoua Connect, précisément dans le
 * canal d'annonces, sous une forme « nickel et pro » :
 *   - la MINIATURE du live, intacte ;
 *   - un message structuré : qui anime le live, le thème (titre), la
 *     description, le JOUR et l'HEURE ;
 *   - le lien public de la page du live.
 *
 * V3.38 : « programmer » couvre aussi « REprogrammer » — quand l'admin
 * modifie un live déjà annoncé (date, heure, serviteur, thème, description)
 * depuis le modal « Modifier le live » (PATCH /admin/api/lives/[id]), la
 * communauté doit être tenue au courant de la NOUVELLE date/heure. Et si le
 * live est annulé, un message d'annulation clair évite que les membres se
 * connectent pour rien.
 *
 * Fonctionnement (même philosophie que le relais d'intercession V3.30) :
 *   - appelé par POST /admin/api/lives (création) et PATCH
 *     /admin/api/lives/[id] (reprogrammation / annulation) APRÈS écriture ;
 *   - BEST-EFFORT : aucune erreur ici ne fait échouer la programmation (le
 *     back-office reste la source de vérité) ;
 *   - find-or-create du canal d'annonces (type ANNOUNCEMENT) : on réutilise
 *     le canal existant (« Annonces », renommable via le back-office), sinon
 *     on le crée dans la communauté principale ;
 *   - message texte structuré signé par un utilisateur système ;
 *   - miniature relayée telle quelle (message IMAGE) ;
 *   - notification push aux membres qui suivent les lives (notifLive).
 *
 * Le canal ANNOUNCEMENT est un canal de diffusion : visible de tous les
 * membres de la communauté (cf. conversations/route.ts — seuls les PRIVÉS
 * isDirect sont filtrés), lecture autorisée à tous, l'écriture restant
 * réservée aux rôles d'annonce (cf. /api/yeshua-connect/announcements).
 */

/** Nom du canal dédié (find-or-create, renommable ensuite via le back-office). */
export const CANAL_ANNONCES_NOM = "Annonces";

/** Utilisateur SYSTÈME qui signe les messages (find-or-create). */
const BOT_EMAIL = "annonces@system.christ-libere";
const BOT_NAME = "Annonces Christ Libère";

/** Durée maximum d'une miniature relayée (data URL) — garde-fou mémoire. */
const TAILLE_MINIATURE_MAX = 900_000;

export interface LiveProgrammeAnnonce {
  liveId: string;
  titre: string;
  description?: string | null;
  scheduledAt: Date;
  servantNom: string;
  thumbnailUrl?: string | null;
}

/** Mode d'annonce : création ou mise à jour d'un live déjà annoncé. */
export type ModeAnnonce = "PROGRAMME" | "REPROGRAMME";

/** Données minimales pour annoncer l'annulation d'un live. */
export interface LiveAnnuleAnnonce {
  liveId: string;
  titre: string;
  scheduledAt: Date;
  servantNom: string;
}

/**
 * Find-or-create du canal d'annonces : on privilégie un canal existant de
 * type ANNOUNCEMENT (idéalement nommé « Annonces »), sinon on le crée dans
 * la première communauté (communauté principale du mouvement).
 */
async function assurerCanalAnnonces(): Promise<{ id: string } | null> {
  // 1. Canal ANNOUNCEMENT existant ? (préférence : celui qui s'appelle
  //    « Annonces » — insensible à la casse — puis le premier trouvé.)
  const existants = await db.channel.findMany({
    where: { type: "ANNOUNCEMENT" },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true },
  });
  if (existants.length > 0) {
    const nomme = existants.find((c) => /annonce/i.test(c.name || ""));
    return nomme ?? existants[0];
  }

  // 2. Communauté d'accueil : la première créée (communauté principale dans
  //    le seed ; en prod c'est la communauté historique).
  let communaute = await db.community.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!communaute) {
    communaute = await db.community.create({
      data: { name: "Christ Libère", isPublic: true },
      select: { id: true },
    });
  }

  // 3. Création du canal de diffusion.
  try {
    const canal = await db.channel.create({
      data: {
        communityId: communaute.id,
        name: CANAL_ANNONCES_NOM,
        description:
          "Annonces officielles du Mouvement Christ Libère : lives programmés, " +
          "événements et informations importantes. Canal de diffusion — seuls les " +
          "administrateurs y publient.",
        type: "ANNOUNCEMENT",
        order: 10,
      },
      select: { id: true },
    });
    return canal;
  } catch {
    // Course concurrentielle (deux programmations simultanées au premier
    // envoi) → l'une des deux a créé le canal : on le retrouve.
    const apresEchec = await db.channel.findFirst({
      where: { type: "ANNOUNCEMENT" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return apresEchec;
  }
}

/** Find-or-create de l'utilisateur système qui signe les messages. */
async function assurerUtilisateurSysteme(): Promise<{ id: string } | null> {
  const existant = await db.user.findUnique({
    where: { email: BOT_EMAIL },
    select: { id: true },
  });
  if (existant) return existant;
  try {
    return await db.user.create({
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
  } catch {
    // Course concurrentielle → l'autre instance l'a créé entre-temps.
    return db.user.findUnique({ where: { email: BOT_EMAIL }, select: { id: true } });
  }
}

/**
 * Message texte structuré — lisible d'un coup d'œil dans le canal :
 * qui anime, le thème, le jour, l'heure, la description.
 * En mode REPROGRAMME, l'en-tête et les libellés signalent clairement que
 * la date/heure précédente est REMPLACÉE (les membres ne doivent pas se
 * présenter à l'ancienne heure).
 * ⭐ V3.40 — exporté pour la route /admin/api/lives/[id]/annonce (rejeu
 * manuel + diagnostic) : le rejeu produit EXACTEMENT le même message que
 * le relay automatique.
 */
export function formaterMessageAnnonce(l: LiveProgrammeAnnonce, mode: ModeAnnonce): string {
  const date = new Date(l.scheduledAt);
  const jour = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const reprogram = mode === "REPROGRAMME";

  const lignes: string[] = [
    reprogram
      ? "🔴 LIVE REPROGRAMMÉ — Christ Libère"
      : "🔴 LIVE PROGRAMMÉ — Christ Libère",
    "",
    `Thème : ${l.titre}`,
    `Avec : ${l.servantNom}`,
    `📅 ${reprogram ? "Nouveau jour" : "Jour"} : ${jour}`,
    `🕒 ${reprogram ? "Nouvelle heure" : "Heure"} : ${heure}`,
  ];
  if (l.description && l.description.trim()) {
    lignes.push("", l.description.trim().substring(0, 600));
  }
  if (reprogram) {
    lignes.push(
      "",
      "ℹ️ Ce live avait déjà été annoncé — la date et l'heure ci-dessus " +
        "REMPLACENT celles de l'annonce précédente.",
    );
  }
  lignes.push(
    "",
    "➡️ Rejoignez-nous sur la page Live du site le moment venu — la diffusion " +
      "démarrera automatiquement, et vous pourrez participer au chat en direct.",
  );
  return lignes.join("\n");
}

/**
 * Message d'annulation : thème, animateur et créneau prévu, pour que les
 * membres ne se connectent pas pour rien.
 * ⭐ V3.40 — exporté (cf. formaterMessageAnnonce).
 */
export function formaterMessageAnnulation(l: LiveAnnuleAnnonce): string {
  const date = new Date(l.scheduledAt);
  const jour = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return [
    "⚠️ LIVE ANNULÉ — Christ Libère",
    "",
    `Thème : ${l.titre}`,
    `Avec : ${l.servantNom}`,
    `📅 Était prévu le : ${jour}`,
    `🕒 à ${heure}`,
    "",
    "Le live prévu à ce créneau n'aura pas lieu. Merci de votre compréhension, " +
      "restez bénis 🙏",
  ].join("\n");
}

/** Notification push (best effort) aux membres abonnés aux lives. */
async function notifierMembres(titre: string, corps: string, canalId: string): Promise<void> {
  try {
    const membres = await db.user.findMany({
      where: { pushEnabled: true, notifLive: true },
      select: { id: true },
      take: 500,
    });
    await Promise.all(
      membres.map((m) =>
        sendPushToUser(m.id, {
          title: titre,
          body: corps,
          data: { type: "live_annonce", conversationId: canalId },
          androidChannelId: "yeshua_messages",
        }),
      ),
    );
  } catch (e) {
    console.warn(
      "[live-annonce] Push membres impossible :",
      e instanceof Error ? e.message : e,
    );
  }
}

/** Aperçu compact servant de corps de notification push. */
function apercuPush(l: { servantNom: string; titre: string; scheduledAt: Date }): string {
  const date = new Date(l.scheduledAt);
  return (
    `${l.servantNom} — ${l.titre} · ` +
    date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
    " " +
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Cœur partagé de publication : canal + bot + message texte + miniature +
 * tri sidebar + notification push. BEST-EFFORT intégral.
 */
async function publierAnnonce(
  live: { liveId: string; titre: string; thumbnailUrl?: string | null },
  message: string,
  push: { title: string; body: string },
  tagLog: string,
): Promise<{ ok: boolean; canalId?: string }> {
  try {
    const canal = await assurerCanalAnnonces();
    const bot = await assurerUtilisateurSysteme();
    if (!canal || !bot) {
      console.error(`[${tagLog}] Canal ou utilisateur système introuvable — annonce ignorée`);
      return { ok: false };
    }

    // ─── Message 1 : l'annonce structurée (texte) ───
    await db.message.create({
      data: {
        channelId: canal.id,
        userId: bot.id,
        content: message,
        type: "TEXT",
      },
    });

    // ─── Message 2 : la miniature, intacte (image) ───
    const miniature = live.thumbnailUrl;
    if (miniature && miniature.length <= TAILLE_MINIATURE_MAX) {
      await db.message.create({
        data: {
          channelId: canal.id,
          userId: bot.id,
          content: `Miniature du live : ${live.titre}`,
          type: "IMAGE",
          attachmentUrl: miniature,
          attachmentName: `live-${live.liveId}`,
          ...(miniature.startsWith("data:")
            ? { attachmentMime: miniature.match(/^data:([^;,]+)/)?.[1] || "image/jpeg" }
            : {}),
        },
      });
    } else if (miniature) {
      // Miniature trop lourde pour un message : on l'ignore proprement
      // (l'annonce texte reste complète).
      console.warn(
        `[${tagLog}] Miniature ignorée (${miniature.length} caractères > garde-fou)`,
      );
    }

    // Tri de la sidebar + horodatage du canal
    await db.channel
      .update({ where: { id: canal.id }, data: { lastMessageAt: new Date() } })
      .catch(() => {});

    // Push aux membres qui suivent les lives.
    await notifierMembres(push.title, push.body, canal.id);

    console.log(`[${tagLog}] Live ${live.liveId} annoncé dans le canal ${canal.id}`);
    return { ok: true, canalId: canal.id };
  } catch (e) {
    console.error(
      `[${tagLog}] Échec de l'annonce (le live reste enregistré dans le back-office) :`,
      e instanceof Error ? e.message : e,
    );
    return { ok: false };
  }
}

/**
 * Annonce un live programmé dans le canal d'annonces Yeshua Connect.
 * BEST-EFFORT : n'JETTE JAMAIS (la programmation back-office reste la
 * source de vérité garantie).
 * `opts.reprogramme = true` → message « LIVE REPROGRAMMÉ » (nouvelle
 * date/heure) au lieu de « LIVE PROGRAMMÉ ».
 */
export async function annoncerLiveProgramme(
  live: LiveProgrammeAnnonce,
  opts: { reprogramme?: boolean } = {},
): Promise<{ ok: boolean; canalId?: string }> {
  const mode: ModeAnnonce = opts.reprogramme ? "REPROGRAMME" : "PROGRAMME";
  return publierAnnonce(
    live,
    formaterMessageAnnonce(live, mode),
    {
      title: mode === "REPROGRAMME" ? "🔴 Live reprogrammé" : "🔴 Live programmé",
      body: apercuPush(live),
    },
    mode === "REPROGRAMME" ? "live-reprogramme" : "live-annonce",
  );
}

/**
 * Annonce l'ANNULATION d'un live dans le canal d'annonces Yeshua Connect.
 * BEST-EFFORT : n'JETTE JAMAIS.
 */
export async function annoncerLiveAnnule(
  live: LiveAnnuleAnnonce,
): Promise<{ ok: boolean; canalId?: string }> {
  return publierAnnonce(
    { liveId: live.liveId, titre: live.titre, thumbnailUrl: null },
    formaterMessageAnnulation(live),
    { title: "⚠️ Live annulé", body: apercuPush(live) },
    "live-annule",
  );
}
