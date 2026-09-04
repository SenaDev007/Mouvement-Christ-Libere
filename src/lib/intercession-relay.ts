import { db } from "@/lib/db";
import { ensureChannelIsIntercessionColumn } from "@/lib/ensure-schema";
import { sendPushToUser } from "@/lib/push-notifications";

/**
 * ⭐ V3.30 — RELAI DES DEMANDES D'INTERCESSION VERS YESHUA CONNECT.
 *
 * Directive du pasteur : quand un membre transmet sa demande depuis la page
 * /intercession (bouton « Transmettre ma demande à l'équipe pastorale »),
 * elle doit arriver AUSSI dans la communauté Yeshua Connect, dans un CANAL
 * DÉDIÉ « Sujets de prière », sous forme de message structuré :
 *   - qui a envoyé (nom complet) ;
 *   - d'où vient la personne (pays, ville) et comment la recontacter
 *     (téléphone, email) — ⭐ V3.32 ;
 *   - la catégorie de prière (santé, famille, spirituel…) ;
 *   - le caractère urgent ou non ;
 *   - le sujet et la description ;
 *   - la note vocale éventuelle, relayée telle quelle.
 *
 * CONFIDENTIALITÉ (directive explicite) : ce canal n'est accessible QUE aux
 * SUPER_ADMIN et ADMIN — pas les membres, pas même les MODERATORs. Les
 * membres qui déposent un sujet ne voient pas le canal et ne savent pas qui
 * a envoyé quoi. Le cloisonnement est appliqué dans les routes de lecture :
 *   - GET /api/yeshua-connect/channels        → canal masqué aux non SA/ADMIN ;
 *   - GET /api/yeshua-connect/conversations   → idem ;
 *   - GET/POST …/conversations/:id/messages   → 403 pour les non SA/ADMIN ;
 *   - POST  …/conversations/:id/messages/attachment → 403 idem.
 *
 * Ce module est appelé par POST /api/intercession APRÈS création de la
 * demande. Il est BEST-EFFORT : aucune erreur ici ne doit faire échouer le
 * dépôt de la demande (elle reste garantie dans le back-office) — tout est
 * tracé en console et avalé.
 */

/** Nom du canal dédié (find-or-create, renommable ensuite via le back-office). */
export const CANAL_INTERCESSION_NOM = "Sujets de prière";

/** Rôles autorisés à voir/lire le canal dédié (directive : admins + super admins). */
export const ROLES_CANAL_INTERCESSION = ["SUPER_ADMIN", "ADMIN"] as const;

/** Utilisateur SYSTÈME qui poste les messages (find-or-create). */
const BOT_EMAIL = "intercession@system.christ-libere";
const BOT_NAME = "Chaîne d'intercession";

/** Libellés humains des catégories (alignés sur /admin/intercession). */
export const CATEGORIES_INTERCESSION: Record<string, string> = {
  general: "Général",
  sante: "Santé",
  famille: "Famille",
  spiritual: "Spirituel",
  action_graces: "Action de grâces",
};

export interface DemandeIntercessionRelais {
  id: string;
  auteur: string;
  pays?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
  sujet: string;
  description: string;
  categorie: string;
  isUrgent: boolean;
  audioUrl?: string | null;
  audioDuration?: number | null;
  audioMime?: string | null;
  audioSize?: number | null;
}

/** Formate une durée en secondes → « 1:23 ». */
function formaterDuree(secondes: number | null | undefined): string {
  const s = Math.max(0, Math.round(secondes ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Find-or-create du canal dédié « Sujets de prière » + inscription des
 * SUPER_ADMIN/ADMIN en membres (pour le suivi des messages lus).
 */
async function assurerCanalIntercession(): Promise<{ id: string } | null> {
  await ensureChannelIsIntercessionColumn();

  // 1. Canal existant ?
  const existant = await db.channel.findFirst({
    where: { isIntercession: true },
    select: { id: true },
  });
  if (existant) return existant;

  // 2. Communauté d'accueil : la première créée (communauté principale du
  //    mouvement dans le seed ; en prod c'est la communauté historique).
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

  // 3. Création du canal RESTRICTED (invisible des membres ET des
  //    MODERATORs — le filtrage isIntercession est appliqué dans les routes
  //    de liste ; isRestricted bloque de son côté les non-privilégiés).
  try {
    const canal = await db.channel.create({
      data: {
        communityId: communaute.id,
        name: CANAL_INTERCESSION_NOM,
        description:
          "Demandes d'intercession déposées sur le site (texte et notes vocales). " +
          "Canal strictement réservé aux super administrateurs — confidentiel.",
        type: "TEXT",
        isRestricted: true,
        isIntercession: true,
        order: 900,
      },
      select: { id: true },
    });
    return canal;
  } catch {
    // Course concurrentielle (deux dépôts simultanés au tout premier
    // envoi) → l'un des deux a créé le canal : on le retrouve.
    const apresEchec = await db.channel.findFirst({
      where: { isIntercession: true },
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

/** Inscrit (idempotent) les SUPER_ADMIN/ADMIN comme membres du canal. */
async function inscrireAdmins(canalId: string): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    if (admins.length === 0) return;
    const membres = await db.channelMember.findMany({
      where: { channelId: canalId },
      select: { userId: true },
    });
    const connus = new Set(membres.map((m) => m.userId));
    const manquants = admins.filter((a) => !connus.has(a.id));
    if (manquants.length === 0) return;
    await db.channelMember.createMany({
      data: manquants.map((a) => ({ channelId: canalId, userId: a.id, role: "ADMIN" })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.warn("[intercession-relay] Inscription admins impossible :", e instanceof Error ? e.message : e);
  }
}

/** Message texte structuré (lisible d'un coup d'œil dans le canal). */
function formaterMessageTexte(d: DemandeIntercessionRelais): string {
  const lignes: string[] = [
    "🕊️ NOUVELLE DEMANDE D'INTERCESSION",
    "",
    `De : ${d.auteur}`,
  ];
  // ⭐ V3.32 — Localisation (pays, ville) + coordonnées de contact.
  const localisation = [d.ville, d.pays].filter(Boolean).join(", ");
  if (localisation) lignes.push(`Provenance : ${localisation}`);
  if (d.telephone) lignes.push(`Téléphone : ${d.telephone}`);
  if (d.email) lignes.push(`Email : ${d.email}`);
  lignes.push(`Catégorie : ${CATEGORIES_INTERCESSION[d.categorie] || d.categorie}`);
  if (d.isUrgent) lignes.push("URGENTE : oui — à traiter en priorité");
  lignes.push(`Sujet : ${d.sujet}`);
  lignes.push("");
  if (d.audioUrl && d.description.trim()) {
    lignes.push(d.description.trim());
    lignes.push("");
    lignes.push("🎙️ Note vocale ci-dessous.");
  } else if (d.audioUrl) {
    lignes.push("🎙️ La personne s'est exprimée en note vocale (ci-dessous).");
  } else {
    lignes.push(d.description.trim());
  }
  return lignes.join("\n");
}

/** Notification push (best effort) aux SUPER_ADMIN/ADMIN abonnés. */
async function notifierAdmins(titre: string, corps: string, canalId: string): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, pushEnabled: true },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        sendPushToUser(a.id, {
          title: titre,
          body: corps,
          data: { type: "intercession", conversationId: canalId },
          androidChannelId: "yeshua_messages",
        }),
      ),
    );
  } catch (e) {
    console.warn("[intercession-relay] Push admins impossible :", e instanceof Error ? e.message : e);
  }
}

/**
 * Relie une demande d'intercession dans le canal dédié Yeshua Connect.
 * BEST-EFFORT : retourne { ok } et n'JETTE JAMAIS (le dépôt back-office
 * reste la source de vérité garantie).
 */
export async function relayerDemandeIntercession(
  demande: DemandeIntercessionRelais,
): Promise<{ ok: boolean; canalId?: string }> {
  try {
    const canal = await assurerCanalIntercession();
    const bot = await assurerUtilisateurSysteme();
    if (!canal || !bot) {
      console.error("[intercession-relay] Canal ou utilisateur système introuvable — relais ignoré");
      return { ok: false };
    }

    await inscrireAdmins(canal.id);

    // ─── Message 1 : la demande structurée (texte) ───
    await db.message.create({
      data: {
        channelId: canal.id,
        userId: bot.id,
        content: formaterMessageTexte(demande),
        type: "TEXT",
      },
    });

    // ─── Message 2 : la note vocale, telle quelle ───
    if (demande.audioUrl) {
      await db.message.create({
        data: {
          channelId: canal.id,
          userId: bot.id,
          content: `Note vocale de ${demande.auteur} — ${formaterDuree(demande.audioDuration)}`,
          type: "AUDIO",
          attachmentUrl: demande.audioUrl,
          attachmentName: `intercession-${demande.id}`,
          attachmentMime: demande.audioMime ?? undefined,
          attachmentSize: demande.audioSize ?? undefined,
          duration: demande.audioDuration ?? undefined,
        },
      });
    }

    // Tri de la sidebar + horodatage du canal
    await db.channel
      .update({ where: { id: canal.id }, data: { lastMessageAt: new Date() } })
      .catch(() => {});

    // Push aux admins : « X a déposé un sujet de prière »
    const apercu = demande.isUrgent
      ? `⚠️ URGENT — ${demande.auteur} : ${demande.sujet}`
      : `${demande.auteur} : ${demande.sujet}`;
    await notifierAdmins("🕊️ Nouvelle demande d'intercession", apercu, canal.id);

    console.log(`[intercession-relay] Demande ${demande.id} relayée dans le canal ${canal.id}`);
    return { ok: true, canalId: canal.id };
  } catch (e) {
    console.error(
      "[intercession-relay] Échec du relais (la demande reste enregistrée dans le back-office) :",
      e instanceof Error ? e.message : e,
    );
    return { ok: false };
  }
}
