/** GET /api/bible-v2/versions — Liste toutes les versions disponibles */
import { NextResponse } from "next/server";
import { listerVersions } from "@/lib/bible/data-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ versions: listerVersions() });
}
