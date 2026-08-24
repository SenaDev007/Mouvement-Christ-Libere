/**
 * GET /api/dead-mans-switch/cron — Vérifier et déclencher
 *
 * Appelé par Vercel Cron Jobs (chaque jour à 3h00 UTC).
 * Vérifie si un commutateur a dépassé son délai sans activité.
 * Si oui, marque comme déclenché et publie le contenu.
 *
 * Configuration vercel.json :
 * "crons": [{ "path": "/api/dead-mans-switch/cron", "schedule": "0 3 * * *" }]
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vérifier le secret (Vercel Cron envoie un header Authorization)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const maintenant = new Date();
    const switches = await db.deadMansSwitch.findMany({
      where: { estDeclenche: false },
    });

    const declenches: string[] = [];

    for (const dms of switches) {
      const delaiMs = dms.delaiJours * 24 * 60 * 60 * 1000;
      const derniereActivite = new Date(dms.derniereActivite);

      if (maintenant.getTime() - derniereActivite.getTime() > delaiMs) {
        // Déclencher !
        await db.deadMansSwitch.update({
          where: { id: dms.id },
          data: {
            estDeclenche: true,
            dateDeclenchement: maintenant,
          },
        });

        // TODO: Publier le contenu (envoyer email, push notification,
        // upload sur Arweave, publier sur le site, etc.)
        console.log(`[DMS] Contenu déclenché: ${dms.contenuTitre} (${dms.contenuId})`);

        declenches.push(dms.contenuId);
      }
    }

    return NextResponse.json({
      checked: switches.length,
      triggered: declenches.length,
      declenches,
      timestamp: maintenant.toISOString(),
    });
  } catch (error) {
    console.error("[DMS cron] error:", error);
    return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
  }
}
