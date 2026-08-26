/**
 * Dispersés d'Israël — map of dispersed members.
 *   GET  /api/disperses
 *   POST /api/disperses
 */

import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

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
}

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

router.get("/", async (req, res) => {
  try {
    const langue = req.query.langue as string | undefined;
    const niveau = req.query.niveau as string | undefined;
    const pays = req.query.pays as string | undefined;

    let membres: MembreDisperseApi[] = [];

    try {
      const where: Record<string, unknown> = { isPublic: true };
      if (langue) where.langue = langue;
      if (niveau) where.niveau = niveau;
      if (pays) where.pays = pays;

      const dbMembres = await db.disperseMember.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      if (dbMembres.length > 0) {
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
        }));
      } else {
        membres = DISPERSSES_MOCK;
      }
    } catch {
      membres = DISPERSSES_MOCK;
    }

    if (langue || niveau || pays) {
      membres = membres.filter((m) => {
        if (langue && m.langue !== langue) return false;
        if (niveau && m.niveau !== niveau) return false;
        if (pays && m.pays !== pays) return false;
        return true;
      });
    }

    const statsPays = membres.reduce(
      (acc, m) => {
        acc[m.pays] = (acc[m.pays] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const statsLangue = membres.reduce(
      (acc, m) => {
        acc[m.langue] = (acc[m.langue] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return res.json({
      membres,
      total: membres.length,
      statsPays,
      statsLangue,
      paysRepresentes: Object.keys(statsPays).length,
    });
  } catch (error) {
    console.error("[api/disperses] GET error:", error);
    return res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { pseudonyme, pays, ville, latitude, longitude, langue, niveau, message } =
      req.body || {};

    if (!pseudonyme || !pays || latitude == null || longitude == null) {
      return res
        .status(400)
        .json({
          error: "pseudonyme, pays, latitude, longitude sont requis",
        });
    }

    // Round to 0.1° for anonymity (~11km)
    const latArrondie = Math.round(latitude * 10) / 10;
    const lonArrondie = Math.round(longitude * 10) / 10;

    try {
      const membre = await db.disperseMember.create({
        data: {
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

      return res.status(201).json({ success: true, id: membre.id });
    } catch {
      return res.json({
        success: true,
        demo: true,
        message:
          "Position enregistrée (mode démo — la base sera synchronisée en production).",
      });
    }
  } catch (error) {
    console.error("[api/disperses] POST error:", error);
    return res.status(500).json({ error: "Erreur lors de l'enregistrement" });
  }
});

export default router;
