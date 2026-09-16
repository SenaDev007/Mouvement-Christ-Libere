import { routesStudio } from "@/lib/studio/studio-routes";
import { ROLES_SECRETARIAT } from "@/lib/studio/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const r = routesStudio(ROLES_SECRETARIAT);
export const POST = r.aiPeaufiner.POST;
