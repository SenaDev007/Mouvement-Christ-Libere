import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureDisperseUserIdColumn, ensureMessageTypeEnum, ensureVoiceVideoColumns } from "@/lib/ensure-schema";
import { COUNTRIES } from "@/lib/data/countries";

/**
 * POST /api/auth/register
 * Register a new user.
 * Body: { name, email, password, isMinor, country?, city?, phone? }
 *
 * ⭐ V2.7 — Les informations du formulaire d'inscription (pays, ville,
 * téléphone) sont désormais PERSISTÉES (elles étaient ignorées avant) —
 * le membre peut les compléter/corriger plus tard depuis /profil, et les
 * administrateurs les voient dans le back-office /admin/users.
 *
 * ⭐ V3.11 — CARTOGRAPHIE AUTOMATIQUE : dès la création du compte, le
 * nouveau membre apparaît sur la carte des dispersés (/disperses). Le
 * formulaire d'inscription collectait déjà pseudonyme (« Nom sur la
 * carte des dispersés »), pays, ville, langue, niveau et message — ces
 * champs sont désormais persistés en position cartographique (arrondie
 * à 0.1° comme le reste de la carte, anonymat préservé). L'ancienne
 * inscription anonyme (« Ajouter ma position ») a été retirée : seul un
 * compte de membre crée un point sur la carte.
 *
 * ⭐ V3.13 — ANNONCE D'ARRIVÉE DANS LA COMMUNAUTÉ : à l'inscription, une
 * petite pastille système « Baruch haba ! [nom] a rejoint la communauté »
 * (façon journal d'appel — exactement comme Telegram/WhatsApp) est postée
 * dans le canal d'accueil, suivie d'une invitation automatique demandant
 * aux frères et sœurs de souhaiter shalom et bienvenue au nouveau membre.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    // ⭐ V2.7 — Le formulaire /register envoie « pays »/« ville » (libellés
    // français) — on mappe vers country/city (+ champs anglais acceptés).
    const {
      name, email, password, isMinor,
      country: countryEn, city: cityEn,
    } = raw;
    const country = countryEn ?? raw.pays;
    const city = cityEn ?? raw.ville;
    const phone = raw.phone ?? raw.telephone;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 8 caractères" },
        { status: 400 },
      );
    }

    if (isMinor) {
      return NextResponse.json(
        { error: "Vous devez être majeur pour créer un compte" },
        { status: 403 },
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // ⭐ V2.7 — Auto-réparation colonne User.phone avant le create
    await ensureVoiceVideoColumns();
    // ⭐ V3.12 — Auto-réparation colonne DisperseMember.userId avant le
    // placement automatique sur la carte des dispersés.
    await ensureDisperseUserIdColumn();

    // Create user
    // Les membres (rôle MEMBER) sont auto-validés — pas besoin d'approbation admin.
    // Seuls les rôles supérieurs (ADMIN, MODERATOR, ANIMATOR) nécessitent validation.
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "MEMBER",
        // ⭐ V2.7 — Informations du formulaire d'inscription persistées
        ...(typeof country === "string" && country.trim() && { country: country.trim() }),
        ...(typeof city === "string" && city.trim() && { city: city.trim() }),
        ...(typeof phone === "string" && phone.trim() && { phone: phone.trim() }),
        isVerified: true, // Auto-validation pour les membres
        isMinor: false,
        acceptedTerms: new Date(),
      },
    });

    // ⭐ V2.9 — Inscription automatique aux canaux PUBLICS de la communauté
    // (annonces officielles, intercession, canal vocal…). Avant : un nouvel
    // inscrit voyait les canaux dans la sidebar mais recevait 403 en ouvrant
    // les messages (aucun ChannelMember créé) — « je ne vois pas les messages ».
    // L'auto-join paresseux (route messages V2.9) couvre aussi ce cas, mais
    // l'inscription directe rend le compte immédiatement complet (compte de
    // membres juste, unread actifs dès le départ).
    try {
      const publicChannels = await db.channel.findMany({
        where: { isRestricted: false, type: { not: "RESTRICTED" } },
        select: { id: true },
      });
      if (publicChannels.length > 0) {
        await db.channelMember.createMany({
          data: publicChannels.map((ch) => ({
            channelId: ch.id,
            userId: user.id,
            role: "MEMBER" as const,
          })),
          skipDuplicates: true,
        });
        console.log(
          `[auth/register] Nouveau membre inscrit à ${publicChannels.length} canal(aux) public(s)`
        );
      }
    } catch (chError) {
      // Non bloquant : l'auto-join paresseux (messages route V2.9) rattrape.
      console.error("[auth/register] Auto-enrollment canaux impossible :", chError);
    }

    // ⭐ V3.13 — ANNONCE D'ARRIVÉE « BARUCH HABA ! » : petite pastille
    // système dans le canal d'accueil (journal de membre, façon WhatsApp/
    // Telegram — même famille visuelle que les journaux d'appel V3.1).
    // La communauté voit qu'un nouveau membre arrive et est invitée à lui
    // souhaiter shalom et bienvenue. Non bloquant : le compte reste créé
    // si l'annonce échoue.
    try {
      // Canal d'accueil : « Nouveaux croyants Yeshoua » (seed), à défaut le
      // premier canal public de discussion (type TEXT, non restreint).
      const canalAccueil =
        (await db.channel.findFirst({
          where: {
            isRestricted: false,
            type: { in: ["TEXT", "ANNOUNCEMENT"] },
            name: { contains: "Nouveaux croyants", mode: "insensitive" },
          },
          orderBy: { order: "asc" },
          select: { id: true },
        })) ??
        (await db.channel.findFirst({
          where: { isRestricted: false, type: "TEXT" },
          orderBy: { order: "asc" },
          select: { id: true },
        }));
      if (canalAccueil) {
        // L'enum Postgres doit connaître MEMBER_LOG avant l'insertion brute
        // (même stratégie que CALL_LOG — le client Prisma régénéré au build
        // connaît déjà la valeur côté lecture).
        await ensureMessageTypeEnum();
        const nomAffiche =
          (typeof name === "string" && name.trim()) ||
          (typeof raw.pseudonyme === "string" && raw.pseudonyme.trim()) ||
          String(email).split("@")[0] ||
          "Nouveau membre";
        const texte =
          `Baruch haba ! ${nomAffiche} a rejoint la communauté — ` +
          `souhaitez-lui shalom et bienvenue 🙏`;
        await db.$executeRawUnsafe(
          `INSERT INTO "Message" ("id", "channelId", "userId", "content", "type", "verseRef", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'MEMBER_LOG', $5, now(), now())`,
          randomUUID(),
          canalAccueil.id,
          user.id,
          texte,
          JSON.stringify({
            kind: "member_join",
            name: nomAffiche,
            userId: user.id,
            country: typeof country === "string" ? country : undefined,
          }),
        );
        console.log(
          `[auth/register] Annonce d'arrivée postée pour « ${nomAffiche} » (canal ${canalAccueil.id})`
        );
      }
    } catch (annonceError) {
      console.error("[auth/register] Annonce d'arrivée impossible :", annonceError);
    }

    // ⭐ V3.11 — Placement automatique sur la carte des dispersés :
    // le membre apparaît aussitôt qu'il crée son compte. Le pays du
    // formulaire est un code ISO (FR, CI…) — on tolère aussi un libellé.
    // Non bloquant : si la carte est indisponible, le compte reste créé.
    try {
      const paysBrut = (typeof country === "string" ? country : "").trim();
      const code = paysBrut.toUpperCase();
      const cible =
        COUNTRIES.find((c) => c.code === code) ||
        COUNTRIES.find((c) => c.name.toLowerCase() === paysBrut.toLowerCase());
      if (cible) {
        const pseudonymeCarte =
          (typeof raw.pseudonyme === "string" && raw.pseudonyme.trim()) ||
          name ||
          email.split("@")[0];
        const NIVEAUX_VALIDES = ["chercheur", "croyant", "disciple", "pasteur"];
        await db.disperseMember.create({
          data: {
            pseudonyme: pseudonymeCarte.toString().trim().substring(0, 100),
            userId: user.id, // ⭐ V3.12 — lien direct avec le compte officiel
            pays: cible.code,
            ville: (typeof city === "string" ? city : "").trim().substring(0, 100) || null,
            latitude: Math.round(cible.lat * 10) / 10,
            longitude: Math.round(cible.lng * 10) / 10,
            langue: (raw.langue || "FR").toString().toUpperCase().substring(0, 5),
            niveau:
              typeof raw.niveau === "string" && NIVEAUX_VALIDES.includes(raw.niveau)
                ? raw.niveau
                : "chercheur",
            message:
              typeof raw.message === "string" && raw.message.trim()
                ? raw.message.trim().substring(0, 1000)
                : null,
            isPublic: true,
          },
        });
        console.log(
          `[auth/register] Nouveau membre placé sur la carte des dispersés (${cible.code})`
        );
      }
    } catch (carteError) {
      console.error("[auth/register] Placement sur la carte des dispersés impossible :", carteError);
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      autoVerified: true,
    });
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription" },
      { status: 500 },
    );
  }
}
