/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : fabrique des routes API fines.
 *
 * Chaque fichier app/<espace>/api/studio/… instancie ces handlers avec
 * SES rôles (super admins au back-office, secrétariat dans son espace).
 * Aucune logique ici — uniquement le câblage (toute la logique vit dans
 * studio-service.ts).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  handlerApercu,
  handlerCreerBackground,
  handlerCreerTemplate,
  handlerDirecteurIA,
  handlerDupliquerCreation,
  handlerGenerer,
  handlerGenererFondIA,
  handlerListerBackgrounds,
  handlerListerCreations,
  handlerListerPhotos,
  handlerListerTemplates,
  handlerMetaStudio,
  handlerModifierBackground,
  handlerModifierCreation,
  handlerModifierTemplate,
  handlerPeaufinerPhotoIA,
  handlerSupprimerBackground,
  handlerSupprimerCreation,
  handlerSupprimerPhoto,
  handlerSupprimerTemplate,
  handlerUploaderPhoto,
} from "@/lib/studio/studio-service";

type Handler = (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>;

export interface RoutesStudio {
  meta: { GET: (request: NextRequest) => Promise<NextResponse> };
  templates: {
    GET: (request: NextRequest) => Promise<NextResponse>;
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  templateId: {
    PATCH: Handler;
    DELETE: Handler;
  };
  backgrounds: {
    GET: (request: NextRequest) => Promise<NextResponse>;
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  backgroundId: {
    PATCH: Handler;
    DELETE: Handler;
  };
  speakers: {
    GET: (request: NextRequest) => Promise<NextResponse>;
  };
  speakerUpload: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  speakerId: {
    DELETE: Handler;
  };
  generate: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  preview: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  /** ⭐ V3.90 — IA NVIDIA (build.nvidia.com). */
  aiPeaufiner: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  /** ⭐ V3.91 — Directeur IA (gpt-oss-20b) : description → spécification. */
  aiDirecteur: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  aiFond: {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  creations: {
    GET: (request: NextRequest) => Promise<NextResponse>;
  };
  creationId: {
    PATCH: Handler;
    DELETE: Handler;
    POST: Handler; // duplication
  };
}

/** Instancie toutes les routes du studio pour une liste de rôles. */
export function routesStudio(roles: readonly string[]): RoutesStudio {
  return {
    meta: {
      GET: (request) => handlerMetaStudio(request, roles),
    },
    templates: {
      GET: (request) => handlerListerTemplates(request, roles),
      POST: (request) => handlerCreerTemplate(request, roles),
    },
    templateId: {
      PATCH: async (request, ctx) =>
        handlerModifierTemplate(request, roles, (await ctx.params).id),
      DELETE: async (request, ctx) =>
        handlerSupprimerTemplate(request, roles, (await ctx.params).id),
    },
    backgrounds: {
      GET: (request) => handlerListerBackgrounds(request, roles),
      POST: (request) => handlerCreerBackground(request, roles),
    },
    backgroundId: {
      PATCH: async (request, ctx) =>
        handlerModifierBackground(request, roles, (await ctx.params).id),
      DELETE: async (request, ctx) =>
        handlerSupprimerBackground(request, roles, (await ctx.params).id),
    },
    speakers: {
      GET: (request) => handlerListerPhotos(request, roles),
    },
    speakerUpload: {
      POST: (request) => handlerUploaderPhoto(request, roles),
    },
    speakerId: {
      DELETE: async (request, ctx) =>
        handlerSupprimerPhoto(request, roles, (await ctx.params).id),
    },
    generate: {
      POST: (request) => handlerGenerer(request, roles),
    },
    preview: {
      POST: (request) => handlerApercu(request, roles),
    },
    aiPeaufiner: {
      POST: (request) => handlerPeaufinerPhotoIA(request, roles),
    },
    aiDirecteur: {
      POST: (request) => handlerDirecteurIA(request, roles),
    },
    aiFond: {
      POST: (request) => handlerGenererFondIA(request, roles),
    },
    creations: {
      GET: (request) => handlerListerCreations(request, roles),
    },
    creationId: {
      PATCH: async (request, ctx) =>
        handlerModifierCreation(request, roles, (await ctx.params).id),
      DELETE: async (request, ctx) =>
        handlerSupprimerCreation(request, roles, (await ctx.params).id),
      POST: async (request, ctx) =>
        handlerDupliquerCreation(request, roles, (await ctx.params).id),
    },
  };
}
