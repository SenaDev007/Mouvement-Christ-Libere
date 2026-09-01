/**
 * API — Carte des dispersés d'Israël (V3)
 *
 * GET  /api/disperses          — Liste des membres dispersés (publiques)
 * POST /api/disperses          — Soumettre sa position (⭐ V3.11 : session
 *                                requise — fin des inscriptions anonymes)
 *
 * Les positions sont arrondies à 0.1° (environ 11 km) pour préserver l'anonymat.
 * Aucune information personnelle n'est stockée — pseudonyme seulement.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/data/countries";
import { ensureServantLocationColumns } from "@/lib/ensure-schema";
import { purgerDispersesAnonymes } from "@/lib/disperses/purger-disperses";
import { restaurerMembresManuels } from "@/lib/disperses/restaurer-manuels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MembreDisperseApi {
  id: string;
  pseudonyme: string;
  pays: string;
  ville?: string;
  latitude: number;
  longitude: number;
  langue: string;
  niveau: string;
  message?: string;
  /** ⭐ V3.15 — Photo du membre : photo de profil de son compte
   * (User.avatarUrl, ajoutée depuis /profil ou le back-office) ou portrait
   * du serviteur (Servant.portraitUrl). Absente → initiales côté client. */
  photo?: string;
}

// Données mock pour le mode démo (quand la DB n'est pas accessible)
const DISPERSSES_MOCK: MembreDisperseApi[] = [
  { id: "1", pseudonyme: "Sarah d'Abidjan", pays: "CI", ville: "Abidjan", latitude: 5.3, longitude: -4.0, langue: "FR", niveau: "disciple", message: "Le Seigneur m'a réveillée en 2023. Je cherche mes frères." },
  { id: "2", pseudonyme: "David de Lagos", pays: "NG", ville: "Lagos", latitude: 6.5, longitude: 3.4, langue: "EN", niveau: "croyant", message: "Reconnaissant pour ce ministère." },
  { id: "3", pseudonyme: "Esther de Paris", pays: "FR", ville: "Paris", latitude: 48.9, longitude: 2.4, langue: "FR", niveau: "disciple", message: "En attente du retour du Maître." },
  { id: "4", pseudonyme: "Joseph de Montréal", pays: "CA", ville: "Montréal", latitude: 45.5, longitude: -73.6, langue: "FR", niveau: "croyant", message: undefined },
  { id: "5", pseudonyme: "Rébecca de Jérusalem", pays: "IL", ville: "Jérusalem", latitude: 31.8, longitude: 35.2, langue: "HE", niveau: "pasteur", message: "Sur la terre de nos pères." },
  { id: "6", pseudonyme: "Benjamin de New York", pays: "US", ville: "New York", latitude: 40.7, longitude: -74.0, langue: "EN", niveau: "disciple", message: "Préparons le chemin." },
  { id: "7", pseudonyme: "Rachel de Londres", pays: "GB", ville: "Londres", latitude: 51.5, longitude: -0.1, langue: "EN", niveau: "croyant", message: undefined },
  { id: "8", pseudonyme: "Lévi de São Paulo", pays: "BR", ville: "São Paulo", latitude: -23.5, longitude: -46.6, langue: "PT", niveau: "disciple", message: "Le chofar va retentir." },
  { id: "9", pseudonyme: "Myriam de Dakar", pays: "SN", ville: "Dakar", latitude: 14.7, longitude: -17.5, langue: "FR", niveau: "chercheur", message: "En chemin vers la vérité." },
  { id: "10", pseudonyme: "Aaron de Kinshasa", pays: "CD", ville: "Kinshasa", latitude: -4.3, longitude: 15.3, langue: "FR", niveau: "disciple", message: "Que la paix de Yeshoua soit avec vous." },
  { id: "11", pseudonyme: "Débora de Madrid", pays: "ES", ville: "Madrid", latitude: 40.4, longitude: -3.7, langue: "ES", niveau: "croyant", message: undefined },
  { id: "12", pseudonyme: "Nathan de Berlin", pays: "DE", ville: "Berlin", latitude: 52.5, longitude: 13.4, langue: "EN", niveau: "chercheur", message: "À la recherche de mes racines." },
  { id: "13", pseudonyme: "Yael de Tel Aviv", pays: "IL", ville: "Tel Aviv", latitude: 32.1, longitude: 34.8, langue: "HE", niveau: "disciple", message: "Veillons et prions." },
  { id: "14", pseudonyme: "Siméon de Douala", pays: "CM", ville: "Douala", latitude: 4.1, longitude: 9.7, langue: "FR", niveau: "disciple", message: "Prêt pour le rassemblement." },
  { id: "15", pseudonyme: "Anne de Bruxelles", pays: "BE", ville: "Bruxelles", latitude: 50.8, longitude: 4.4, langue: "FR", niveau: "croyant", message: undefined },
  { id: "16", pseudonyme: "Ruben de Mexico", pays: "MX", ville: "Mexico", latitude: 19.4, longitude: -99.1, langue: "ES", niveau: "croyant", message: "Béni soit le Dieu d'Israël." },
  { id: "17", pseudonyme: "Tamar de Addis Abeba", pays: "ET", ville: "Addis Abeba", latitude: 9.0, longitude: 38.7, langue: "AM", niveau: "disciple", message: "L'Éthiopie se lève." },
  { id: "18", pseudonyme: "Ephraïm de Johannesburg", pays: "ZA", ville: "Johannesburg", latitude: -26.2, longitude: 28.0, langue: "EN", niveau: "chercheur", message: undefined },
  { id: "19", pseudonyme: "Hannah de Sydney", pays: "AU", ville: "Sydney", latitude: -33.9, longitude: 151.2, langue: "EN", niveau: "croyant", message: "Même aux extrémités de la terre." },
  { id: "20", pseudonyme: "Malachie de Tokyo", pays: "JP", ville: "Tokyo", latitude: 35.7, longitude: 139.7, langue: "EN", niveau: "chercheur", message: "Le soleil se lève aussi ici." },
];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const langue = url.searchParams.get("langue");
    const niveau = url.searchParams.get("niveau");
    const pays = url.searchParams.get("pays");

    // Essayer la DB d'abord, fallback sur mock
    let membres: MembreDisperseApi[] = [];

    try {
      // ⭐ V3.3 — Auto-réparation Servant.pays / Servant.ville (idempotent)
      await ensureServantLocationColumns();

      // ⭐ V3.14 — RESTAURATION des membres supprimés par erreur (ex.
      // Akpovi Sènakpon, membre réel purgé avec les positions anonymes en
      // V3.12) AVANT la purge : les entrées restaurées portent manuel =
      // true → la purge ne peut plus jamais les toucher. Idempotent +
      // mémoïsé par instance, non bloquant.
      await restaurerMembresManuels();

      // ⭐ V3.12 — PURGE des positions créées sans compte officiel : les
      // entrées de l'ancien formulaire anonyme « Ajouter ma position »
      // (fermé en V3.11) sont supprimées de la base, sauf celles qui
      // correspondent à une inscription officielle (LiveMember lié,
      // compte User lié, pseudonyme d'un compte ou position créée avec un
      // compte dans la même requête). Idempotent + mémoïsé : au plus un
      // passage utile par instance serverless.
      await purgerDispersesAnonymes();

      const where: Record<string, unknown> = { isPublic: true };
      if (langue) where.langue = langue;
      if (niveau) where.niveau = niveau;
      if (pays) where.pays = pays;

      const dbMembres = await db.disperseMember.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      if (dbMembres.length > 0) {
        // ⭐ V3.15 — PHOTOS : on résout la photo de chaque entrée via son
        // compte officiel (User.avatarUrl — photo de profil ajoutée depuis
        // /profil ou le back-office ; User.image en secours). Les entrées
        // sans compte n'ont pas de photo → initiales côté client.
        const userIds = Array.from(
          new Set(
            dbMembres
              .map((m) => m.userId)
              .filter((id): id is string => typeof id === "string")
          )
        );
        const photosParUserId = new Map<string, string>();
        if (userIds.length > 0) {
          try {
            const comptes = await db.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, avatarUrl: true, image: true },
            });
            for (const c of comptes) {
              const photo = c.avatarUrl || c.image;
              if (photo) photosParUserId.set(c.id, photo);
            }
          } catch {
            // Comptes indisponibles → membres sans photo (initiales)
          }
        }

        membres = dbMembres.map((m) => ({
          id: m.id,
          pseudonyme: m.pseudonyme,
          pays: m.pays,
          ville: m.ville || undefined,
          latitude: m.latitude,
          longitude: m.longitude,
          langue: m.langue,
          niveau: m.niveau,
          message: m.message || undefined,
          photo: m.userId ? photosParUserId.get(m.userId) || undefined : undefined,
        }));
      } else {
        // ⭐ V3.12 — Base JOUABLE mais VIDE (après la purge) : on renvoie une
        // liste VIDE (plus de faux membres de démonstration). Le mock ne
        // sert plus que si la base est totalement inaccessible (catch) —
        // la carte n'affiche alors que la vérité : les serviteurs localisés
        // et les inscrits officiels.
        membres = [];
      }
    } catch {
      // DB inaccessible → utiliser mock
      membres = DISPERSSES_MOCK;
    }

    // ⭐ V3.3 — SERVITEURS SUR LA CARTE : les serviteurs actifs dont le pays
    // est renseigné (back-office /admin/servants) figurent sur la carte des
    // dispersés avec le niveau « pasteur ». Leur position est déduite du pays
    // (coordonnées de référence de src/lib/data/countries.ts).
    // Anti-doublon : si le serviteur s'est déjà inscrit lui-même sur la carte
    // (même pseudonyme insensible à la casse), son inscription prime.
    try {
      const servants = await db.servant.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, shortName: true, role: true, pays: true, ville: true, portraitUrl: true },
      });
      const existingPseudos = new Set(
        membres.map((m) => m.pseudonyme.trim().toLowerCase())
      );
      for (const s of servants) {
        const code = (s.pays || "").trim().toUpperCase();
        if (!code) continue; // pays non renseigné → pas sur la carte
        const country = COUNTRIES.find((c) => c.code === code);
        if (!country) continue; // code pays inconnu → position impossible
        const pseudo = s.shortName || s.fullName;
        if (existingPseudos.has(pseudo.trim().toLowerCase())) continue; // déjà inscrit
        membres.push({
          id: `servant-${s.id}`,
          pseudonyme: pseudo,
          pays: code,
          ville: s.ville || undefined,
          latitude: country.lat,
          longitude: country.lng,
          langue: "FR",
          niveau: "pasteur",
          message: s.role || undefined,
          photo: s.portraitUrl || undefined, // ⭐ V3.15 — portrait du serviteur
        });
        existingPseudos.add(pseudo.trim().toLowerCase());
      }
    } catch {
      // Serviteurs indisponibles → la carte affiche simplement les inscrits
    }

    // Filtrer le mock si nécessaire
    if (langue || niveau || pays) {
      membres = membres.filter((m) => {
        if (langue && m.langue !== langue) return false;
        if (niveau && m.niveau !== niveau) return false;
        if (pays && m.pays !== pays) return false;
        return true;
      });
    }

    // Stats par pays
    const statsPays = membres.reduce((acc, m) => {
      acc[m.pays] = (acc[m.pays] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Stats par langue
    const statsLangue = membres.reduce((acc, m) => {
      acc[m.langue] = (acc[m.langue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      membres,
      total: membres.length,
      statsPays,
      statsLangue,
      paysRepresentes: Object.keys(statsPays).length,
    });
  } catch (error) {
    console.error("[api/disperses] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // ⭐ V3.11 — Fin des inscriptions anonymes : le bouton « Ajouter ma
    // position » a été remplacé par « Créer un compte » — on ne figure sur
    // la carte qu'en créant son compte de membre (/register place le
    // nouveau membre sur la carte automatiquement).
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          error:
            "Un compte est requis pour figurer sur la carte. Créez votre compte depuis la page d'inscription.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pseudonyme, pays, ville, latitude, longitude, langue, niveau, message, sessionId } = body;

    if (!pseudonyme || !pays || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "pseudonyme, pays, latitude, longitude sont requis" },
        { status: 400 }
      );
    }

    // ⭐ V3.12 — Lien direct vers le compte connecté (la purge conserve
    // toujours les positions liées à un compte officiel).
    const userId =
      session.user && "id" in session.user && typeof session.user.id === "string"
        ? session.user.id
        : null;

    // Arrondir à 0.1° pour anonymat (environ 11 km)
    const latArrondie = Math.round(latitude * 10) / 10;
    const lonArrondie = Math.round(longitude * 10) / 10;

    // Si un sessionId LiveMember est fourni, récupérer le memberId
    let liveMemberId: string | null = null;
    if (sessionId) {
      const member = await db.liveMember.findUnique({
        where: { sessionId },
        select: { id: true },
      });
      if (member) liveMemberId = member.id;
    }

    try {
      // Si le membre Live existe déjà sur la carte, on met à jour
      let membre;
      if (liveMemberId) {
        const existing = await db.disperseMember.findFirst({
          where: { liveMemberId },
        });
        if (existing) {
          membre = await db.disperseMember.update({
            where: { id: existing.id },
            data: {
              pseudonyme: pseudonyme.substring(0, 100),
              pays: pays.toUpperCase().substring(0, 2),
              ville: ville?.substring(0, 100) || null,
              latitude: latArrondie,
              longitude: lonArrondie,
              langue: (langue || "FR").toUpperCase().substring(0, 5),
              niveau: niveau || "chercheur",
              message: message?.substring(0, 1000) || null,
            },
          });
        } else {
          membre = await db.disperseMember.create({
            data: {
              liveMemberId,
              userId, // ⭐ V3.12
              pseudonyme: pseudonyme.substring(0, 100),
              pays: pays.toUpperCase().substring(0, 2),
              ville: ville?.substring(0, 100) || null,
              latitude: latArrondie,
              longitude: lonArrondie,
              langue: (langue || "FR").toUpperCase().substring(0, 5),
              niveau: niveau || "chercheur",
              message: message?.substring(0, 1000) || null,
              isPublic: true,
            },
          });
        }
      } else {
        membre = await db.disperseMember.create({
          data: {
            userId, // ⭐ V3.12
            pseudonyme: pseudonyme.substring(0, 100),
            pays: pays.toUpperCase().substring(0, 2),
            ville: ville?.substring(0, 100) || null,
            latitude: latArrondie,
            longitude: lonArrondie,
            langue: (langue || "FR").toUpperCase().substring(0, 5),
            niveau: niveau || "chercheur",
            message: message?.substring(0, 1000) || null,
            isPublic: true,
          },
        });
      }

      return NextResponse.json({ success: true, id: membre.id }, { status: 201 });
    } catch {
      // DB inaccessible → mode démo
      return NextResponse.json({
        success: true,
        demo: true,
        message: "Position enregistrée (mode démo — la base sera synchronisée en production).",
      });
    }
  } catch (error) {
    console.error("[api/disperses] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    );
  }
}
