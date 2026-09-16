"use client";

/**
 * ⭐ V3.90 → V3.91 — MCL CREATIVE STUDIO : briques UI partagées du studio.
 *
 *  · ZoneToasts / afficherToast — retours visuels légers (succès, info,
 *    erreur) en remplacement des alert() bloquants ;
 *  · ModalRogner — ROGNAGE façon Canva (directive : « créer exactement
 *    comme dans Canva… faire un bon montage et faire du rognage ») :
 *    glisser pour recadrer, zoom, rotation 90°, ratios 3:4 / 1:1 / 4:3,
 *    grille des tiers — export PNG à pleine résolution ;
 *  · ⭐ V3.91 useConfirmation / ModalConfirmation — confirmations
 *    PERSONNALISÉES (directive : « les modals de confirmation [doivent
 *    être] personnalisés et non génériques ») : icône, couleurs, titre,
 *    message et libellé ADAPTÉS à l'action (supprimer une création,
 *    appliquer une miniature, effacer le brouillon…), jamais le confirm()
 *    gris du navigateur.
 *
 * Aucune dépendance externe : tout est canvas + pointer events.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Info,
  AlertCircle,
  RotateCw,
  X,
  Trash2,
  Image as ImageIcon,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Toasts (singleton par événement — utilisable depuis tout le studio) ──

interface Toast {
  id: number;
  message: string;
  type: "succes" | "info" | "erreur";
}

let compteurToasts = 0;

/** Affiche un toast studio (coin bas-droit, 5 s). */
export function afficherToast(
  message: string,
  type: Toast["type"] = "info"
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("mcl-studio-toast", { detail: { message, type } })
  );
}

/** Monté UNE fois par page studio — écoute les afficherToast(). */
export function ZoneToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const ecouteur = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type: Toast["type"] }>)
        .detail;
      if (!detail?.message) return;
      const id = ++compteurToasts;
      setToasts((anciens) => [
        ...anciens,
        { id, message: detail.message, type: detail.type || "info" },
      ]);
      window.setTimeout(() => {
        setToasts((anciens) => anciens.filter((t) => t.id !== id));
      }, 5000);
    };
    window.addEventListener("mcl-studio-toast", ecouteur);
    return () => window.removeEventListener("mcl-studio-toast", ecouteur);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[130] space-y-2 max-w-[calc(100vw-2rem)] w-80">
      {toasts.map((t) => {
        const Icone =
          t.type === "succes" ? CheckCircle2 : t.type === "erreur" ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 px-3.5 py-3 rounded-xl shadow-xl border text-xs font-medium animate-[ fadeIn_.18s_ease-out]",
              t.type === "succes" &&
                "bg-[#3F5039] text-[#FAF6EF] border-[#5B7052]",
              t.type === "erreur" &&
                "bg-[#7A2A1C] text-[#FAF6EF] border-[#B3452E]",
              t.type === "info" &&
                "bg-[#2A0E3D] text-[#FAF6EF] border-[#8C5FA8]"
            )}
            role="status"
          >
            <Icone className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal de rognage (façon Canva) ───────────────────────────────────

const RATIOS: Array<{ cle: string; libelle: string; valeur: number }> = [
  { cle: "3:4", libelle: "Portrait 3:4", valeur: 3 / 4 },
  { cle: "1:1", libelle: "Carré 1:1", valeur: 1 },
  { cle: "4:3", libelle: "Paysage 4:3", valeur: 4 / 3 },
];

interface ModalRognerProps {
  /** Fichier image choisi (JPEG/PNG/WEBP). */
  fichier: File;
  /** Appelé avec l'image ROGNÉE (PNG) — à envoyer au serveur. */
  onValide: (blob: Blob) => void;
  onFerme: () => void;
}

/**
 * Rogne une photo avant l'upload : cadre fixe au ratio choisi, l'image se
 * déplace DESSOUS (glisser), zoom, rotation 90°. L'export est calculé en
 * résolution NATURELLE (jusqu'à 1600 px de haut) — pas de perte de qualité.
 */
export function ModalRogner({ fichier, onValide, onFerme }: ModalRognerProps) {
  const refViewport = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [ratio, setRatio] = useState(RATIOS[0].valeur);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [echec, setEchec] = useState("");
  const [exporte, setExporte] = useState(false);
  const [cadre, setCadre] = useState({ w: 280, h: 373 });

  // Échelle de base (cover du cadre par l'image pivotée) + bornage.
  const dims = source
    ? rotation % 180 === 90
      ? { w: source.height, h: source.width }
      : { w: source.width, h: source.height }
    : { w: 1, h: 1 };
  const base = source
    ? Math.max(cadre.w / dims.w, cadre.h / dims.h)
    : 1;
  const echelle = base * zoom;
  const maxDx = Math.max(0, (dims.w * echelle - cadre.w) / 2);
  const maxDy = Math.max(0, (dims.h * echelle - cadre.h) / 2);
  const dx = Math.min(maxDx, Math.max(-maxDx, offset.x));
  const dy = Math.min(maxDy, Math.max(-maxDy, offset.y));

  // ① Chargement : normalisation EXIF + plafonnement 2600 px.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const bitmap = await createImageBitmap(fichier, {
          imageOrientation: "from-image",
        });
        const cible = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
        const canevas = document.createElement("canvas");
        canevas.width = Math.round(bitmap.width * cible);
        canevas.height = Math.round(bitmap.height * cible);
        canevas
          .getContext("2d")
          ?.drawImage(bitmap, 0, 0, canevas.width, canevas.height);
        bitmap.close();
        if (!annule) setSource(canevas);
      } catch {
        if (!annule) setEchec("Impossible de lire cette image.");
      }
    })();
    return () => {
      annule = true;
    };
  }, [fichier]);

  // ② Taille du cadre selon le viewport réel.
  useEffect(() => {
    const mesurer = () => {
      const vp = refViewport.current;
      if (!vp) return;
      const h = Math.max(220, Math.min(vp.clientHeight - 24, 420));
      setCadre({ w: Math.round(h * ratio), h: h });
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  }, [ratio]);

  // Échap pour fermer.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFerme();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFerme]);

  // ③ Glisser pour recadrer (pointer events, souris + tactile).
  const pointerActif = useRef<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const surPointeurBas = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      pointerActif.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dx,
        dy,
      };
    },
    [dx, dy]
  );
  const surPointeurBouge = useCallback(
    (e: React.PointerEvent) => {
      const p = pointerActif.current;
      if (!p || p.id !== e.pointerId) return;
      setOffset({ x: p.dx + (e.clientX - p.x), y: p.dy + (e.clientY - p.y) });
    },
    []
  );
  const surPointeurHaut = useCallback(() => {
    pointerActif.current = null;
  }, []);

  // ④ Export : découpe de la zone du cadre en résolution naturelle.
  const valider = useCallback(async () => {
    if (!source) return;
    setExporte(true);
    try {
      const canevasSource = source;
      const rw = rotation % 180 === 90 ? canevasSource.height : canevasSource.width;
      const rh = rotation % 180 === 90 ? canevasSource.width : canevasSource.height;
      // Zone du cadre exprimée en pixels de l'image pivotée.
      const fw = cadre.w / echelle;
      const fh = cadre.h / echelle;
      const cx = rw / 2 - dx / echelle;
      const cy = rh / 2 - dy / echelle;
      const sx = cx - fw / 2;
      const sy = cy - fh / 2;
      // Sortie : jusqu'à 1600 px de haut, jamais agrandie au-delà de la source.
      const sortH = Math.min(1600, Math.round(fh));
      const sortW = Math.max(1, Math.round((sortH * cadre.w) / cadre.h));

      // Rotation en canvas (résolution naturelle).
      const pivote = document.createElement("canvas");
      pivote.width = rw;
      pivote.height = rh;
      const ctxP = pivote.getContext("2d");
      if (!ctxP) throw new Error("canvas");
      ctxP.translate(rw / 2, rh / 2);
      ctxP.rotate((rotation * Math.PI) / 180);
      ctxP.drawImage(
        canevasSource,
        -canevasSource.width / 2,
        -canevasSource.height / 2
      );

      const sortie = document.createElement("canvas");
      sortie.width = sortW;
      sortie.height = sortH;
      const ctxS = sortie.getContext("2d");
      if (!ctxS) throw new Error("canvas");
      ctxS.drawImage(pivote, sx, sy, fw, fh, 0, 0, sortW, sortH);

      const blob = await new Promise<Blob | null>((resoudre) =>
        sortie.toBlob((b) => resoudre(b), "image/png")
      );
      if (!blob) throw new Error("blob");
      onValide(blob);
    } catch {
      setEchec("Impossible de rogner cette image — réessayez.");
    } finally {
      setExporte(false);
    }
  }, [source, rotation, cadre, echelle, dx, dy, onValide]);

  const urlSource = source ? source.toDataURL("image/png") : "";

  return (
    <div
      className="fixed inset-0 z-[125] bg-[#1A0826]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Rogner la photo"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Barre de titre */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#8A8378]/10">
          <div>
            <p className="text-sm font-bold text-[#1E0F2B]">Rogner la photo</p>
            <p className="text-[11px] text-[#8A8378] mt-0.5">
              Glissez la photo pour la positionner — le détourage sera
              automatique après validation.
            </p>
          </div>
          <button
            onClick={onFerme}
            className="p-2 rounded-lg hover:bg-[#FAF6EF] text-[#8A8378]"
            aria-label="Annuler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport de rognage */}
        <div className="px-5 pt-4">
          <div
            ref={refViewport}
            className="relative w-full h-[46vh] min-h-[300px] rounded-xl overflow-hidden bg-[#1A0826] touch-none select-none flex items-center justify-center"
            onPointerDown={surPointeurBas}
            onPointerMove={surPointeurBouge}
            onPointerUp={surPointeurHaut}
            onPointerCancel={surPointeurHaut}
            style={{ cursor: source ? "grab" : "default" }}
          >
            {!source && !echec && (
              <div className="text-[#DDBE55]/70 text-xs">Chargement…</div>
            )}
            {echec && (
              <div className="text-[#E88] text-xs px-6 text-center">{echec}</div>
            )}
            {source && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlSource}
                  alt="Photo à rogner"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotation}deg) scale(${echelle})`,
                    transformOrigin: "center",
                  }}
                />
                {/* Cadre : son OMBRE EXTERIEURE géante assombrit tout ce
                    qui est rogné (le tour reste visible net). */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-[#DDBE55] rounded-md overflow-hidden pointer-events-none"
                  style={{
                    width: cadre.w,
                    height: cadre.h,
                    boxShadow: "0 0 0 9999px rgba(10,4,16,0.62)",
                  }}
                >
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/10" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contrôles */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {RATIOS.map((r) => (
              <button
                key={r.cle}
                onClick={() => {
                  setRatio(r.valeur);
                  setOffset({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  ratio === r.valeur
                    ? "border-[#C9A227] bg-[#C9A227]/10 text-[#A3821C]"
                    : "border-[#8A8378]/20 text-[#8A8378] hover:bg-[#FAF6EF]"
                )}
              >
                {r.libelle}
              </button>
            ))}
            <span className="flex-1" />
            <button
              onClick={() => {
                setRotation((r) => (r + 90) % 360);
                setOffset({ x: 0, y: 0 });
                setZoom(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#8A8378]/20 text-[#8A8378] hover:bg-[#FAF6EF]"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Pivoter
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-[#8A8378]">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#C9A227]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onFerme}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:bg-[#FAF6EF]"
          >
            Annuler
          </button>
          <button
            onClick={valider}
            disabled={!source || exporte}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#B3261E] text-white text-sm font-bold hover:opacity-95 disabled:opacity-40"
          >
            {exporte ? "Préparation…" : "Utiliser cette photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ⭐ V3.91 — Confirmations PERSONNALISÉES (jamais confirm() générique) ──

/** Variante visuelle — chaque action a sa couleur, son icône, son ton. */
export type VarianteConfirmation = "suppression" | "application" | "nouveau";

export interface ConfigConfirmation {
  /** Titre court et CONCRET (ex. « Supprimer ce fond ? »). */
  titre: string;
  /** Explication de ce qui se passe VRAIMENT (irréversible ? fichiers ?). */
  message: string;
  /** Détail contextuel (nom de l'élément) — affiché en exergue. */
  detail?: string;
  /** Libellé du bouton de confirmation (ex. « Supprimer définitivement »). */
  libelleConfirmer: string;
  /** Variante visuelle — détermine icône et couleurs par défaut. */
  variante: VarianteConfirmation;
  /** Icône personnalisée (sinon celle de la variante). */
  icone?: LucideIcon;
}

const STYLES_VARIANTES: Record<
  VarianteConfirmation,
  { icone: LucideIcon; fondIcone: string; bouton: string; bord: string; texte: string }
> = {
  suppression: {
    icone: Trash2,
    fondIcone: "bg-[#7A2A1C] text-[#FAF6EF]",
    bouton: "bg-[#B3452E] hover:bg-[#9A3A24] text-white",
    bord: "border-[#B3452E]/30",
    texte: "text-[#7A2A1C]",
  },
  application: {
    icone: ImageIcon,
    fondIcone: "bg-[#A3821C] text-[#1E0F2B]",
    bouton: "bg-[#C9A227] hover:bg-[#A3821C] text-[#1E0F2B]",
    bord: "border-[#C9A227]/40",
    texte: "text-[#A3821C]",
  },
  nouveau: {
    icone: FilePlus2,
    fondIcone: "bg-[#5B7052] text-[#FAF6EF]",
    bouton: "bg-[#5B7052] hover:bg-[#3F5039] text-white",
    bord: "border-[#5B7052]/30",
    texte: "text-[#3F5039]",
  },
};

/** La modal de confirmation — Personnalisée par action (V3.91). */
export function ModalConfirmation({
  config,
  onConfirme,
  onFerme,
}: {
  config: ConfigConfirmation;
  onConfirme: () => void;
  onFerme: () => void;
}) {
  const styles = STYLES_VARIANTES[config.variante];
  const Icone = config.icone || styles.icone;

  useEffect(() => {
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFerme();
    };
    window.addEventListener("keydown", surEchap);
    return () => window.removeEventListener("keydown", surEchap);
  }, [onFerme]);

  return (
    <div
      className="fixed inset-0 z-[135] bg-[#1A0826]/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFerme}
      role="dialog"
      aria-modal="true"
      aria-label={config.titre}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 max-w-md w-full overflow-hidden animate-[fadeIn_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-start gap-3.5 p-5 border-b", styles.bord)}>
          <span
            className={cn(
              "inline-flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0",
              styles.fondIcone
            )}
          >
            <Icone className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-base font-bold leading-snug", styles.texte)}>
              {config.titre}
            </p>
            {config.detail && (
              <p className="text-sm font-semibold text-[#1E0F2B] bg-[#FAF6EF] border border-[#8A8378]/15 rounded-lg px-2.5 py-1.5 mt-2 truncate">
                {config.detail}
              </p>
            )}
            <p className="text-[13px] text-[#8A8378] leading-relaxed mt-2 whitespace-pre-line">
              {config.message}
            </p>
          </div>
          <button
            onClick={onFerme}
            className="p-1.5 rounded-lg text-[#8A8378] hover:bg-[#FAF6EF] flex-shrink-0"
            aria-label="Annuler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2.5 justify-end p-4 bg-[#FAF6EF]/60">
          <button
            onClick={onFerme}
            className="px-4 py-2.5 rounded-xl border border-[#8A8378]/25 text-[#1E0F2B] text-sm font-semibold hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={onConfirme}
            autoFocus
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors",
              styles.bouton
            )}
          >
            <Icone className="w-4 h-4" />
            {config.libelleConfirmer}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook de confirmation ASYNCHRONE — `const ok = await demander({...})`.
 * Une seule modal à la fois, rendue par le composant retourné. */
export function useConfirmation(): {
  demander: (config: ConfigConfirmation) => Promise<boolean>;
  modal: React.ReactNode;
} {
  const [enAttente, setEnAttente] = useState<{
    config: ConfigConfirmation;
    resoudre: (ok: boolean) => void;
  } | null>(null);

  const fermer = useCallback((ok: boolean) => {
    setEnAttente((actuel) => {
      actuel?.resoudre(ok);
      return null;
    });
  }, []);

  const demander = useCallback(
    (config: ConfigConfirmation) =>
      new Promise<boolean>((resoudre) => {
        setEnAttente({ config, resoudre });
      }),
    []
  );

  const modal = enAttente ? (
    <ModalConfirmation
      config={enAttente.config}
      onConfirme={() => fermer(true)}
      onFerme={() => fermer(false)}
    />
  ) : null;

  return { demander, modal };
}

/** ⭐ V3.91 — lecture JSON SÛRE d'une réponse fetch : si le serveur (ou un
 * intermédiaire réseau type Cloudflare) renvoie du HTML au lieu du JSON,
 * retourne un objet d'erreur propre — JAMAIS « Unexpected token '<' ». */
export async function lireJsonSur(res: Response): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") || "";
  let texte = "";
  try {
    texte = await res.text();
  } catch {
    return { error: "Le serveur n'a pas répondu — vérifiez la connexion puis réessayez." };
  }
  if (texte.trimStart().startsWith("<") || type.includes("text/html")) {
    // Une page HTML au lieu du JSON (ex. page d'erreur réseau) — message
    // pastoral, jamais technique (§38).
    return {
      error:
        res.status >= 500
          ? "Le serveur est momentanément indisponible — réessayez dans un instant."
          : "Le serveur a répondu de façon inattendue — rechargez la page puis réessayez.",
    };
  }
  try {
    return JSON.parse(texte) as Record<string, unknown>;
  } catch {
    return { error: "Réponse illisible du serveur — réessayez." };
  }
}

