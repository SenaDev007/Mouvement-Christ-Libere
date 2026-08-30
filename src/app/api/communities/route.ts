import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * GET /api/communities
 *
 * Liste les communautés visibles par l'utilisateur courant.
 * Utilisé notamment par NewChannelModal pour récupérer le `communityId` à
 * passer lors de la création d'un canal (au lieu d'écrire "default").
 *
 * - 🔒 Authentification NextAuth requise.
 * - Trie par date de création (la première communauté = la plus ancienne).
 *
 * Response: Array<{ id, name, description?, icon?, isPublic, createdAt }>
 */
export async function GET() {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const communities = await db.community.findMany({
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        isPublic: true,
        createdAt: true,
      },
    });

    return NextResponse.json(communities);
  } catch (error) {
    console.error("[api/communities] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des communautés" },
      { status: 500 },
    );
  }
}
