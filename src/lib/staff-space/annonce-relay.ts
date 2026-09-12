/**
 * ⭐ V3.66 — Relais des ANNONCES DU MINISTÈRE dans Yeshua Connect.
 * ============================================================================
 *
 * Directive : « la secrétaire sera chargée de faire les annonces… tout ce
 * qui est annonce par rapport au ministère en général ». Depuis l'espace
 * secrétariat, chaque annonce publiée peut être RELAYÉE dans le canal
 * d'annonces de la communauté (lives, événements, communiqués urgents).
 *
 * Même philosophie que le relais des lives V3.36 (live-announcement-relay) :
 *   - find-or-create du canal ANNOUNCEMENT + utilisateur système ;
 *   - message structuré signé « Annonces Christ Libère » ;
 *   - notification push aux membres (notifAnnouncements) — best-effort ;
 *   - AUCUNE erreur ici ne fait échouer la publication dans le
 *     secrétariat (le registre du secrétariat reste la source de vérité).
 */

import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push-notifications";
import { ANNONCE_CATEGORIES } from "@/lib/staff-space/constants";

/** Utilisateur SYSTÈME qui signe les messages (find-or-create). */
const BOT_EMAIL = "annonces@system.christ-libere";
const BOT_NAME = "Annonces Christ Libère";

/** Libellés humains des catégories d'annonces (emoji d'en-tête). */
const ENTETES: Record<string, string> = {
  generale: "📢 ANNONCE — Christ Libère",
  live: "🔴 LIVE — Christ Libère",
  evenement: "📅 ÉVÉNEMENT — Christ Libère",
  urgence: "⚠️ COMMUNIQUÉ URGENT — Christ Libère",
};

export interface AnnonceMinistere {
  titre: string;
  contenu: string;
  categorie: string;
}

/** Message structuré publié dans le canal d'annonces. */
function formaterMessageAnnonceMinistere(a: AnnonceMinistere): string {
  const entete = ENTETES[a.categorie] || ENTETES.generale;
  const lignes: string[] = [entete, "", `Titre : ${a.titre}`];
  if (a.contenu?.trim()) {
    lignes.push("", a.contenu.trim().substring(0, 1500));
  }
  return lignes.join("\n");
}

/** Find-or-create du canal d'annonces (même logique que V3.36). */
async function assurerCanalAnnonces(): Promise<{ id: string } | null> {
  const existants = await db.channel.findMany({
    where: { type: "ANNOUNCEMENT" },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true },
  });
  if (existants.length > 0) {
    const nomme = existants.find((c) => /annonce/i.test(c.name || ""));
    return nomme ?? existants[0];
  }

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

  try {
    return await db.channel.create({
      data: {
        communityId: communaute.id,
        name: "Annonces",
        description:
          "Annonces officielles du Mouvement Christ Libère : lives programmés, " +
          "événements et informations importantes. Canal de diffusion — la " +
          "secrétariat du ministère y publie.",
        type: "ANNOUNCEMENT",
        order: 10,
      },
      select: { id: true },
    });
  } catch {
    return db.channel.findFirst({
      where: { type: "ANNOUNCEMENT" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  }
}

/** Find-or-create de l'utilisateur système (même logique que V3.36). */
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
    return db.user.findUnique({ where: { email: BOT_EMAIL }, select: { id: true } });
  }
}

/** Push best-effort aux membres abonnés aux annonces. */
async function notifierMembres(titre: string, corps: string): Promise<void> {
  try {
    const membres = await db.user.findMany({
      where: { pushEnabled: true, notifAnnouncements: true },
      select: { id: true },
      take: 500,
    });
    await Promise.all(
      membres.map((m) =>
        sendPushToUser(m.id, {
          title: titre,
          body: corps,
          data: { type: "annonce_ministere" },
          androidChannelId: "yeshua_messages",
        }),
      ),
    );
  } catch (e) {
    console.warn(
      "[annonce-ministere] Push membres impossible :",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Publie une annonce du ministère dans le canal d'annonces Yeshua Connect.
 * BEST-EFFORT intégral : n'JETTE JAMAIS.
 */
export async function relayerAnnonceMinistere(
  annonce: AnnonceMinistere
): Promise<{ ok: boolean }> {
  try {
    const canal = await assurerCanalAnnonces();
    const bot = await assurerUtilisateurSysteme();
    if (!canal || !bot) {
      console.error("[annonce-ministere] Canal ou bot introuvable — relais ignoré");
      return { ok: false };
    }

    await db.message.create({
      data: {
        channelId: canal.id,
        userId: bot.id,
        content: formaterMessageAnnonceMinistere(annonce),
        type: "TEXT",
      },
    });

    await db.channel
      .update({ where: { id: canal.id }, data: { lastMessageAt: new Date() } })
      .catch(() => {});

    const categorieLibelle =
      (ANNONCE_CATEGORIES as Record<string, { libelle: string }>)[annonce.categorie]
        ?.libelle || "Annonce";
    await notifierMembres(
      `📢 ${categorieLibelle} : ${annonce.titre}`.substring(0, 100),
      annonce.contenu.substring(0, 140),
    );

    console.log(`[annonce-ministere] « ${annonce.titre} » relayée dans le canal ${canal.id}`);
    return { ok: true };
  } catch (e) {
    console.error(
      "[annonce-ministere] Échec du relais (l'annonce reste publiée dans le secrétariat) :",
      e instanceof Error ? e.message : e,
    );
    return { ok: false };
  }
}
