/** GET /api/bible-v2/strong/[numero] — Définition Strong */
import { NextRequest, NextResponse } from "next/server";
import { chercherStrong } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { numero } = await params;
  const entree = chercherStrong(numero);

  if (!entree) {
    return NextResponse.json({ error: "Entrée Strong non trouvée" }, { status: 404 });
  }

  return NextResponse.json(entree);
}
