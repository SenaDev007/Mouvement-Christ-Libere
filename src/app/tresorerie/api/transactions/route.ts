import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_TRESORERIE } from "@/lib/staff-space/session";
import {
  MOUVEMENT_TYPE_VALEURS,
  MOUVEMENT_TYPE_TOUS,
  RECETTE_CATEGORIES_VALEURS,
  DEPENSE_CATEGORIES_VALEURS,
  MOUVEMENT_METHOD_VALEURS,
  DEVISE_CODES,
  TRANSFERT_CATEGORIE,
} from "@/lib/staff-space/constants";
import { libelleCategorie, libelleMethode } from "@/lib/staff-space/constants";

/**
 * ⭐ V3.66/V3.67 — Trésorerie : journal des recettes et dépenses.
 *
 *   GET   /tresorerie/api/transactions?type=&categorie=&devise=&caisse=&du=&au=&q=&limit=&offset=
 *         — registre filtrable ; les lignes portent le NOM des caisses
 *           (source/destination) pour l'affichage ;
 *         — &format=csv : export CSV complet des écritures FILTRÉES
 *           (insécables français, BOM UTF-8 pour Excel — V3.67).
 *   POST  /tresorerie/api/transactions — création :
 *         · RECETTE / DEPENSE { type, category, amount, currency, method?,
 *           label, date?, reference?, donorName?, isAnonymous?, note?, caisseId? }
 *         · TRANSFERT (V3.67) { type: "TRANSFERT", caisseId (source),
 *           caisseDestinationId (destination), amount, label, date?,
 *           reference?, note? } — même devise obligatoire.
 *
 * Chaque écriture est journalisée dans AuditLog (traçabilité financière).
 * ⚠️ Rôles : TREASURER, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    const categorie = url.searchParams.get("categorie") || "";
    const devise = url.searchParams.get("devise") || "";
    const caisse = url.searchParams.get("caisse") || "";
    const du = url.searchParams.get("du") || "";
    const au = url.searchParams.get("au") || "";
    const recherche = (url.searchParams.get("q") || "").trim();
    const format = url.searchParams.get("format") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (type && (MOUVEMENT_TYPE_TOUS as readonly string[]).includes(type))
      where.type = type;
    if (categorie) where.category = categorie;
    if (devise) where.currency = devise;
    if (caisse) {
      // Filtre multicaisse : la caisse concernée comme source OU destination.
      where.OR = [
        { caisseId: caisse },
        { caisseDestinationId: caisse },
      ];
    }
    if (du && /^\d{4}-\d{2}-\d{2}$/.test(du) || au && /^\d{4}-\d{2}-\d{2}$/.test(au)) {
      const filtreDate: Record<string, Date> = {};
      if (du && /^\d{4}-\d{2}-\d{2}$/.test(du)) filtreDate.gte = new Date(`${du}T00:00:00`);
      if (au && /^\d{4}-\d{2}-\d{2}$/.test(au)) filtreDate.lte = new Date(`${au}T23:59:59`);
      where.date = filtreDate;
    }
    if (recherche) {
      where.OR = [
        { label: { contains: recherche, mode: "insensitive" } },
        { reference: { contains: recherche, mode: "insensitive" } },
        { donorName: { contains: recherche, mode: "insensitive" } },
        { note: { contains: recherche, mode: "insensitive" } },
      ];
    }

    const [items, total, sommeRecettes, sommeDepenses, caisses] =
      await Promise.all([
        format === "csv"
          ? db.treasuryTransaction.findMany({ where, orderBy: { date: "desc" } })
          : db.treasuryTransaction.findMany({
              where,
              orderBy: { date: "desc" },
              take: limit,
              skip: offset,
            }),
        db.treasuryTransaction.count({ where }),
        db.treasuryTransaction.aggregate({
          where: { ...where, type: "RECETTE" },
          _sum: { amount: true },
        }),
        db.treasuryTransaction.aggregate({
          where: { ...where, type: "DEPENSE" },
          _sum: { amount: true },
        }),
        db.treasuryCashAccount.findMany({
          select: { id: true, name: true },
        }),
      ]);

    const nomsCaisses = new Map(caisses.map((c) => [c.id, c.name]));
    const enrichies = items.map((t) => ({
      ...t,
      caisseNom: t.caisseId ? nomsCaisses.get(t.caisseId) || null : null,
      caisseDestinationNom: t.caisseDestinationId
        ? nomsCaisses.get(t.caisseDestinationId) || null
        : null,
    }));

    // ── Export CSV (filtres actifs, toutes les lignes — pas de pagination). ──
    if (format === "csv") {
      const separer = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lignes: string[] = [];
      lignes.push(
        [
          "Date",
          "Type",
          "Caisse (source)",
          "Caisse (destination)",
          "Catégorie",
          "Libellé",
          "Montant",
          "Devise",
          "Méthode",
          "Référence",
          "Donateur",
          "Anonyme",
          "Note",
        ]
          .map(separer)
          .join(";")
      );
      for (const t of enrichies) {
        lignes.push(
          [
            new Date(t.date).toISOString().substring(0, 10),
            t.type === "TRANSFERT"
              ? "Transfert interne"
              : t.type === "RECETTE"
                ? "Recette"
                : "Dépense",
            t.caisseNom || "",
            t.caisseDestinationNom || "",
            libelleCategorie(t.category, t.type),
            t.label,
            (t.type === "DEPENSE" || t.type === "TRANSFERT" ? "-" : "+") +
              t.amount.toFixed(2).replace(".", ","),
            t.currency,
            libelleMethode(t.method),
            t.reference || "",
            t.isAnonymous ? "Anonyme" : t.donorName || "",
            t.isAnonymous ? "oui" : "non",
            (t.note || "").replace(/[\r\n]+/g, " "),
          ]
            .map((v) => separer(String(v)))
            .join(";")
        );
      }
      // BOM UTF-8 : Excel reconnaît les accents sans import manuel.
      const csv = "\uFEFF" + lignes.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="journal-tresorerie-${new Date()
            .toISOString()
            .substring(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      items: enrichies,
      total,
      totaux: {
        recettes: sommeRecettes._sum.amount || 0,
        depenses: sommeDepenses._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error("[tresorerie/api/transactions] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du journal" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_TRESORERIE);
  if ("reponse" in garde) return garde.reponse;
  const { userId } = garde.session;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const {
      type,
      category,
      amount,
      currency,
      method,
      label,
      date,
      reference,
      donorName,
      isAnonymous,
      note,
      caisseId,
      caisseDestinationId,
    } = body as {
      type?: string;
      category?: string;
      amount?: number;
      currency?: string;
      method?: string;
      label?: string;
      date?: string;
      reference?: string;
      donorName?: string;
      isAnonymous?: boolean;
      note?: string;
      caisseId?: string;
      caisseDestinationId?: string;
    };

    if (!label?.trim()) {
      return NextResponse.json(
        { error: "Le libellé est requis" },
        { status: 400 }
      );
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Le montant doit être un nombre strictement positif" },
        { status: 400 }
      );
    }

    let dateFinale = new Date();
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(`${date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) dateFinale = d;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ⭐ V3.67 — TRANSFERT INTERNE ENTRE CAISSES
    // ═══════════════════════════════════════════════════════════════════
    if (type === "TRANSFERT") {
      if (!caisseId || !caisseDestinationId) {
        return NextResponse.json(
          { error: "Un transfert exige une caisse source et une caisse de destination." },
          { status: 400 }
        );
      }
      if (caisseId === caisseDestinationId) {
        return NextResponse.json(
          { error: "La caisse source et la caisse de destination doivent être différentes." },
          { status: 400 }
        );
      }
      const [source, destination] = await Promise.all([
        db.treasuryCashAccount.findUnique({ where: { id: caisseId } }),
        db.treasuryCashAccount.findUnique({ where: { id: caisseDestinationId } }),
      ]);
      if (!source || !destination) {
        return NextResponse.json(
          { error: "Caisse source ou destination introuvable." },
          { status: 404 }
        );
      }
      if (!source.isActive || !destination.isActive) {
        return NextResponse.json(
          { error: "Le transfert exige deux caisses actives." },
          { status: 400 }
        );
      }
      if (source.currency !== destination.currency) {
        return NextResponse.json(
          {
            error: `Transfert impossible entre devises (${source.currency} → ${destination.currency}) : saisissez une écriture par devise.`,
          },
          { status: 400 }
        );
      }
      // Prévention : ne pas vider une caisse en dessous de zéro (les
      // écarts de caisse réels se traitent par écriture de régularisation).
      const situation = await db.treasuryTransaction.aggregate({
        where: { caisseId, type: "RECETTE" },
        _sum: { amount: true },
      });
      // (le contrôle exact se fait sur la situation recalculée — ici un
      // simple avertissement métier si le montant dépasse le solde connu).
      const depensesSource = await db.treasuryTransaction.aggregate({
        where: { caisseId, type: "DEPENSE" },
        _sum: { amount: true },
      });
      const sortantsSource = await db.treasuryTransaction.aggregate({
        where: { caisseId, type: "TRANSFERT" },
        _sum: { amount: true },
      });
      const entrantsSource = await db.treasuryTransaction.aggregate({
        where: { caisseDestinationId: caisseId, type: "TRANSFERT" },
        _sum: { amount: true },
      });
      const soldeConnu =
        source.openingBalance +
        (situation._sum.amount || 0) -
        (depensesSource._sum.amount || 0) -
        (sortantsSource._sum.amount || 0) +
        (entrantsSource._sum.amount || 0);
      if (amount > soldeConnu + 0.01) {
        return NextResponse.json(
          {
            error: `Fonds insuffisants en caisse « ${source.name} » : solde courant ${soldeConnu.toFixed(2)} ${source.currency}, transfert demandé ${amount.toFixed(2)} ${source.currency}.`,
          },
          { status: 400 }
        );
      }

      const mouvement = await db.treasuryTransaction.create({
        data: {
          type: "TRANSFERT",
          category: TRANSFERT_CATEGORIE,
          amount: Math.round(amount * 100) / 100,
          currency: source.currency,
          method: null,
          label: label.trim().substring(0, 200),
          date: dateFinale,
          reference: reference?.trim()?.substring(0, 80) || null,
          donorName: null,
          isAnonymous: false,
          note: note?.trim()?.substring(0, 3000) || null,
          caisseId,
          caisseDestinationId,
          createdBy: userId,
        },
      });

      try {
        await db.auditLog.create({
          data: {
            action: "TRESORERIE_TRANSFERT",
            userId,
            targetId: mouvement.id,
            metadata: {
              montant: mouvement.amount,
              devise: mouvement.currency,
              source: source.name,
              destination: destination.name,
              libelle: mouvement.label,
            },
          },
        });
      } catch (e) {
        console.warn("[tresorerie/api/transactions] AuditLog impossible :", e);
      }

      return NextResponse.json({ item: mouvement }, { status: 201 });
    }

    // ═══════════════════════════════════════════════════════════════════
    // RECETTE / DEPENSE (chemin V3.66 + rattachement de caisse V3.67)
    // ═══════════════════════════════════════════════════════════════════
    if (!type || !(MOUVEMENT_TYPE_VALEURS as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: "Type invalide (RECETTE ou DEPENSE)" },
        { status: 400 }
      );
    }
    const categoriesAdmises =
      type === "RECETTE" ? RECETTE_CATEGORIES_VALEURS : DEPENSE_CATEGORIES_VALEURS;
    if (!category || !(categoriesAdmises as readonly string[]).includes(category)) {
      return NextResponse.json(
        { error: "Catégorie invalide pour ce type de mouvement" },
        { status: 400 }
      );
    }
    const deviseFinale = currency && DEVISE_CODES.includes(currency) ? currency : "EUR";
    if (method && !(MOUVEMENT_METHOD_VALEURS as readonly string[]).includes(method)) {
      return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
    }

    // Rattachement de caisse (facultatif — affiché « non affecté » sinon).
    let caisseFinale: string | null = null;
    if (caisseId) {
      const caisse = await db.treasuryCashAccount.findUnique({
        where: { id: caisseId },
      });
      if (!caisse || !caisse.isActive) {
        return NextResponse.json(
          { error: "Caisse introuvable ou désactivée" },
          { status: 400 }
        );
      }
      if (caisse.currency !== deviseFinale) {
        return NextResponse.json(
          {
            error: `La caisse « ${caisse.name} » tient la devise ${caisse.currency} — incompatible avec une écriture en ${deviseFinale}.`,
          },
          { status: 400 }
        );
      }
      caisseFinale = caisse.id;
    }

    const mouvement = await db.treasuryTransaction.create({
      data: {
        type,
        category,
        amount: Math.round(amount * 100) / 100,
        currency: deviseFinale,
        method: method || null,
        label: label.trim().substring(0, 200),
        date: dateFinale,
        reference: reference?.trim()?.substring(0, 80) || null,
        donorName: type === "RECETTE" ? donorName?.trim()?.substring(0, 120) || null : null,
        isAnonymous: Boolean(isAnonymous),
        note: note?.trim()?.substring(0, 3000) || null,
        caisseId: caisseFinale,
        createdBy: userId,
      },
    });

    // Traçabilité financière.
    try {
      await db.auditLog.create({
        data: {
          action: "TRESORERIE_CREATE",
          userId,
          targetId: mouvement.id,
          metadata: {
            type,
            category,
            amount,
            currency: deviseFinale,
            caisse: caisseFinale
              ? (await db.treasuryCashAccount.findUnique({
                  where: { id: caisseFinale },
                  select: { name: true },
                }))?.name
              : null,
            label: mouvement.label,
          },
        },
      });
    } catch (e) {
      console.warn("[tresorerie/api/transactions] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: mouvement }, { status: 201 });
  } catch (error) {
    console.error("[tresorerie/api/transactions] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du mouvement" },
      { status: 500 }
    );
  }
}
