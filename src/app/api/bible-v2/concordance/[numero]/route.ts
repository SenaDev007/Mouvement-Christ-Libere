/** GET /api/bible-v2/concordance/[numero] — Concordance Strong */
import { NextRequest, NextResponse } from "next/server";
import { concordanceStrong, chercherStrong } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { numero } = await params;
  const url = new URL(request.url);
  const limite = parseInt(url.searchParams.get("limite") || "50");

  const entree = chercherStrong(numero);
  const versets = concordanceStrong(numero, limite);

  return NextResponse.json({
    strong: entree,
    nombreVersets: versets.length,
    versets,
  });
}
