import { routesStudio } from "@/lib/studio/studio-routes";
import { ROLES_ADMIN_STUDIO } from "@/lib/studio/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r = routesStudio(ROLES_ADMIN_STUDIO);
export const PATCH = r.templateId.PATCH;
export const DELETE = r.templateId.DELETE;
