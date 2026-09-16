import { routesStudio } from "@/lib/studio/studio-routes";
import { ROLES_SECRETARIAT } from "@/lib/studio/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r = routesStudio(ROLES_SECRETARIAT);
export const PATCH = r.creationId.PATCH;
export const DELETE = r.creationId.DELETE;
export const POST = r.creationId.POST;
