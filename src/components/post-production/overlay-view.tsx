"use client";

/**
 * ⭐ V3.16 — OverlayView : rendu INTERACTIF d'un overlay sur le preview.
 * ============================================================================
 * Directive du pasteur : « par rapport aux images ajoutées, il faut que les
 * images aient des bords pour qu'on puisse redimensionner la taille sans
 * détériorer la qualité de l'image ».
 *
 * - CLIC → sélection (bordure dorée + 4 poignées de coin).
 * - GLISSER → déplacement (x/y en %).
 * - POIGNÉES DE COIN → redimensionnement UNIFORME (ratio préservé : l'image
 *   affichée est mise à l'échelle depuis la source PLEINE RÉSOLUTION —
 *   la data URL d'origine n'est jamais ré-échantillonnée, aucune perte).
 * - `ratio` (largeur preview ÷ largeur export) met le preview à l'échelle du
 *   rendu final (WYSIWYG) : tailles de texte/stickers/images proportionnelles.
 *
 * Types supportés : image (redimensionnement), texte (taille), sticker (taille).
 */
import { useRef, useState } from "react";
import type { Overlay, TextOverlay, ImageOverlay, StickerOverlay } from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface OverlayViewProps {
  overlay: Overlay;
  selected: boolean;
  /** largeur preview ÷ largeur export — échelle WYSIWYG. */
  ratio: number;
  onSelect: () => void;
  onChange: (updates: Partial<Overlay>) => void;
  /** Appelé en fin de glisser/redimensionner (snapshot undo). */
  onCommit: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const COINS = ["nw", "ne", "sw", "se"] as const;
type Coin = (typeof COINS)[number];

export function OverlayView({
  overlay,
  selected,
  ratio,
  onSelect,
  onChange,
  onCommit,
  containerRef,
}: OverlayViewProps) {
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);
  const activeRef = useRef(false);

  // ─── Taille du contenu, à l'échelle WYSIWYG ───
  const boxStyle: React.CSSProperties = {};
  let content: React.ReactNode = null;

  if (overlay.type === "image") {
    const img = overlay as ImageOverlay;
    if (natSize) {
      boxStyle.width = Math.max(8, natSize.w * img.scale * ratio);
      boxStyle.height = Math.max(8, natSize.h * img.scale * ratio);
    }
    boxStyle.opacity = img.opacity;
    content = (
       
      <img
        src={img.url}
        alt=""
        draggable={false}
        className="w-full h-full object-fill select-none block"
        onLoad={(e) =>
          setNatSize({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
      />
    );
  } else if (overlay.type === "text") {
    const t = overlay as TextOverlay;
    boxStyle.fontSize = Math.max(6, t.fontSize * ratio);
    boxStyle.color = t.fontColor;
    boxStyle.fontWeight = t.bold ? 700 : 400;
    boxStyle.fontStyle = t.italic ? "italic" : "normal";
    boxStyle.whiteSpace = "nowrap";
    if (t.bgColor) {
      boxStyle.backgroundColor = t.bgColor;
      boxStyle.padding = `${4 * ratio}px ${8 * ratio}px`;
      boxStyle.borderRadius = 4 * ratio;
    }
    content = t.content;
  } else {
    const s = overlay as StickerOverlay;
    boxStyle.fontSize = Math.max(6, s.size * ratio);
    boxStyle.lineHeight = 1;
    boxStyle.transform = `rotate(${s.rotation}deg)`;
    boxStyle.opacity = s.opacity;
    content = s.emoji;
  }

  // ─── Glisser : déplacer l'overlay (x/y en %) ───
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: overlay.x, y: overlay.y };
    activeRef.current = true;
    document.body.style.cursor = "grabbing";

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      onChange({ x: clamp(orig.x + dx, 0, 100), y: clamp(orig.y + dy, 0, 100) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      activeRef.current = false;
      onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ─── Poignées de coin : redimensionnement uniforme (ratio préservé) ───
  const startResize = (e: React.PointerEvent, _coin: Coin) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Centre de l'overlay en px écran (fixe pendant le redimensionnement)
    const centerX = rect.left + (overlay.x / 100) * rect.width;
    const centerY = rect.top + (overlay.y / 100) * rect.height;
    const startDist = Math.max(10, Math.hypot(e.clientX - centerX, e.clientY - centerY));
    const startVal =
      overlay.type === "image"
        ? (overlay as ImageOverlay).scale
        : overlay.type === "text"
          ? (overlay as TextOverlay).fontSize
          : (overlay as StickerOverlay).size;
    activeRef.current = true;

    const move = (ev: PointerEvent) => {
      const dist = Math.max(10, Math.hypot(ev.clientX - centerX, ev.clientY - centerY));
      const factor = dist / startDist;
      if (overlay.type === "image") {
        // Échelle de la source pleine résolution — qualité intacte.
        onChange({ scale: clamp(startVal * factor, 0.05, 12) });
      } else if (overlay.type === "text") {
        onChange({ fontSize: clamp(Math.round(startVal * factor), 8, 400) });
      } else {
        onChange({ size: clamp(Math.round(startVal * factor), 8, 800) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      activeRef.current = false;
      onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const isImage = overlay.type === "image";

  return (
    <div
      className="absolute touch-none"
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: "translate(-50%, -50%)",
        ...boxStyle,
      }}
      onPointerDown={startDrag}
    >
      {content}

      {/* Bordure de survol (subtile) pour les images — directive « bords » */}
      {isImage && !selected && (
        <div className="absolute -inset-[2px] rounded pointer-events-none border border-dashed border-[#C9A227]/60" />
      )}

      {/* Sélection : bordure dorée + poignées de redimensionnement */}
      {selected && (
        <>
          <div className="absolute -inset-[2px] rounded pointer-events-none border-2 border-[#C9A227]" />
          {COINS.map((coin) => (
            <div
              key={coin}
              onPointerDown={(e) => startResize(e, coin)}
              className="absolute w-3 h-3 bg-[#C9A227] border-2 border-white rounded-sm shadow cursor-nwse-resize"
              style={{
                ...(coin === "nw" || coin === "ne" ? { top: -6 } : { bottom: -6 }),
                ...(coin === "nw" || coin === "sw" ? { left: -6 } : { right: -6 }),
                ...(coin === "ne" || coin === "se" ? { cursor: "nesw-resize" } : {}),
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
