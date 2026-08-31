import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureVoiceVideoColumns } from "@/lib/ensure-schema";

/**
 * POST /api/auth/register
 * Register a new user.
 * Body: { name, email, password, isMinor, country?, city?, phone? }
 *
 * ⭐ V2.7 — Les informations du formulaire d'inscription (pays, ville,
 * téléphone) sont désormais PERSISTÉES (elles étaient ignorées avant) —
 * le membre peut les compléter/corriger plus tard depuis /profil, et les
 * administrateurs les voient dans le back-office /admin/users.
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
