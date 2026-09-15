import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import {
  DEVISE_PAR_DEFAUT,
  convertirMontant,
} from "@/lib/staff-space/devises";

/**
 * ⭐ V3.88 — GET /tresorerie/api/donateurs?du=&au=
 *
 * HISTORIQUE DES DONATEURS — la demande du pasteur : « pour qu'on puisse
 * avoir vraiment une historique de tous ceux qui ont fait le don sur une
 * certaine période, pour que les serviteurs de Dieu puissent prier pour
 * ces personnes. »
 *
 * Sources fusionnées (sans doublon) :
 *  · journal : chaque RECETTE (dons, offrandes, dîmes…) — saisie manuelle
 *    (donorName) ou générée automatiquement par un don en ligne ;
 *  · table Donation : les coordonnées complètes du donateur (email,
 *    message, passerelle, statut) sont rattachées par référence don_xxx ;
 *  · les dons EN LIGNE approuvés SANS écriture au journal (rares —
 *    antérieurs au dispatch V3.82) sont inclus depuis Donation seule.
 *
 * Regroupement par donateur IDENTIFIÉ (nom, sinon email) ; les dons
 * anonymes sont comptés à part (total + nombre) sans identité.
 * Agrégats exprimés en XOF (conversion des devises — taux de référence).
 *
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DonAgrege {
  date: string;
  categorie: string;
  montant: number;
  devise: string;
  montantXof: number;
  methode: string | null;
  reference: string | null;
  enLigne: boolean;
  provider: string | null;
  statut: string | null;
  message: string | null;
}

interface Donateur {
  identite: string;
  email: string | null;
  nbDons: number;
  totalXof: number;
  types: Record<string, number>;
  premierDon: string;
  dernierDon: string;
  dons: DonAgrege[];
}

function normaliserNom(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const url = new URL(request.url);
    const du = url.searchParams.get("du") || "";
    const au = url.searchParams.get("au") || "";

    const filtreJournal: Record<string, unknown> = { type: "RECETTE" };
    const filtreDon: Record<string, unknown> = { statut: "approved" };
    const borneJournal: Record<string, Date> = {};
    const borneDon: Record<string, Date> = {};
    if (du && /^\d{4}-\d{2}-\d{2}$/.test(du)) {
      borneJournal.gte = new Date(`${du}T00:00:00`);
      borneDon.gte = new Date(`${du}T00:00:00`);
    }
    if (au && /^\d{4}-\d{2}-\d{2}$/.test(au)) {
      borneJournal.lte = new Date(`${au}T23:59:59`);
      borneDon.lte = new Date(`${au}T23:59:59`);
    }
    if (Object.keys(borneJournal).length > 0) filtreJournal.date = borneJournal;
    if (Object.keys(borneDon).length > 0) {
      filtreDon.OR = [{ confirmedAt: borneDon }, { confirmedAt: null, createdAt: borneDon }];
    }

    // ① Journal (source de vérité comptable) + ② dons en ligne approuvés
    // de la période (coordonnées complètes des donateurs).
    const [recettes, dons] = await Promise.all([
      db.treasuryTransaction.findMany({
        where: filtreJournal,
        orderBy: { date: "desc" },
        select: {
          id: true,
          category: true,
          amount: true,
          currency: true,
          method: true,
          date: true,
          reference: true,
          donorName: true,
          isAnonymous: true,
        },
      }),
      db.donation.findMany({
        where: filtreDon,
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          donorName: true,
          donorEmail: true,
          message: true,
          provider: true,
          typeDon: true,
          statut: true,
          confirmedAt: true,
          createdAt: true,
          amount: true,
          currency: true,
        },
      }),
    ]);

    const donsParReference = new Map(
      dons.filter((d) => d.reference).map((d) => [d.reference as string, d])
    );
    const referencesAuJournal = new Set(
      recettes.map((t) => t.reference).filter((r): r is string => Boolean(r))
    );

    // Regroupement par donateur identifié.
    const donateurs = new Map<string, Donateur>();
    const anonymes = { nb: 0, totalXof: 0 };

    const ajouter = (
      cle: string,
      identite: string,
      email: string | null,
      don: DonAgrege
    ) => {
      const existant = donateurs.get(cle) || {
        identite,
        email,
        nbDons: 0,
        totalXof: 0,
        types: {},
        premierDon: don.date,
        dernierDon: don.date,
        dons: [],
      };
      existant.nbDons += 1;
      existant.totalXof += don.montantXof;
      existant.types[don.categorie] = (existant.types[don.categorie] || 0) + 1;
      if (don.date < existant.premierDon) existant.premierDon = don.date;
      if (don.date > existant.dernierDon) existant.dernierDon = don.date;
      existant.dons.push(don);
      if (!existant.email && email) existant.email = email;
      donateurs.set(cle, existant);
    };

    // ① Écritures du journal (recettes) — enrichies des dons en ligne.
    for (const t of recettes) {
      const lie = t.reference ? donsParReference.get(t.reference) : undefined;
      const nom = (lie?.donorName || t.donorName || "").trim();
      const email = lie?.donorEmail || null;
      const montantXof = convertirMontant(t.amount, t.currency, DEVISE_PAR_DEFAUT);
      const don: DonAgrege = {
        date: t.date.toISOString(),
        categorie: t.category,
        montant: t.amount,
        devise: t.currency,
        montantXof,
        methode: t.method,
        reference: t.reference,
        enLigne: Boolean(lie),
        provider: lie?.provider || null,
        statut: lie?.statut || null,
        message: lie?.message || null,
      };

      if (nom) {
        ajouter(`nom:${normaliserNom(nom)}`, nom, email, don);
      } else if (email) {
        ajouter(`email:${email.toLowerCase()}`, email, email, don);
      } else {
        anonymes.nb += 1;
        anonymes.totalXof += montantXof;
      }
    }

    // ② Dons en ligne approuvés SANS écriture au journal (antérieurs au
    // dispatch V3.82) — intégrés pour ne perdre aucun donateur.
    for (const d of dons) {
      if (!d.reference || referencesAuJournal.has(d.reference)) continue;
      const nom = (d.donorName || "").trim();
      const email = d.donorEmail || null;
      const date = (d.confirmedAt || d.createdAt).toISOString();
      const montantXof = convertirMontant(d.amount, d.currency, DEVISE_PAR_DEFAUT);
      const don: DonAgrege = {
        date,
        categorie: d.typeDon || "don",
        montant: d.amount,
        devise: d.currency,
        montantXof,
        methode: d.provider === "fedapay" ? "mobile_money" : "carte",
        reference: d.reference,
        enLigne: true,
        provider: d.provider,
        statut: d.statut,
        message: d.message,
      };
      if (nom) {
        ajouter(`nom:${normaliserNom(nom)}`, nom, email, don);
      } else if (email) {
        ajouter(`email:${email.toLowerCase()}`, email, email, don);
      } else {
        anonymes.nb += 1;
        anonymes.totalXof += montantXof;
      }
    }

    const liste = Array.from(donateurs.values())
      .map((d) => ({
        ...d,
        dons: d.dons.sort((a, b) => (a.date < b.date ? 1 : -1)),
      }))
      .sort((a, b) => b.totalXof - a.totalXof);

    const nbDons = liste.reduce((s, d) => s + d.nbDons, 0) + anonymes.nb;
    const totalXof =
      liste.reduce((s, d) => s + d.totalXof, 0) + anonymes.totalXof;

    return NextResponse.json({
      periode: { du: du || null, au: au || null },
      devise: DEVISE_PAR_DEFAUT,
      totaux: {
        nbDonateurs: liste.length,
        nbDons,
        totalXof,
      },
      anonymes,
      donateurs: liste,
    });
  } catch (error) {
    console.error("[tresorerie/api/donateurs] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des donateurs" },
      { status: 500 }
    );
  }
}
