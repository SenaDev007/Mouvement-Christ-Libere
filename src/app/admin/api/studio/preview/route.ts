import { routesStudio } from "@/lib/studio/studio-routes";
import { ROLES_ADMIN_STUDIO } from "@/lib/studio/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const r = routesStudio(ROLES_ADMIN_STUDIO);
export const POST = r.preview.POST;
