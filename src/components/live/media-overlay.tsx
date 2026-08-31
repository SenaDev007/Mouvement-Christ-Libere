"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Image as ImageIcon, FileText, Type, ChevronLeft, ChevronRight,
  Upload, X, Trash2, Eye, EyeOff, GripVertical,
} from "lucide-react";

interface MediaOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoSourceRef: React.RefObject<HTMLVideoElement | null>;
  onCanvasStream?: (stream: MediaStream | null) => void;
  isLive: boolean;
  isPaused?: boolean;
  mirror?: boolean;
}

interface OverlayImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

interface Slide {
  id: string;
  src: string;
}

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  visible: boolean;
  size: number;
  color: string;
}

const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  let img = imageCache.get(src);
  if (img) return img.complete && img.naturalWidth > 0 ? img : null;
  img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return null;
}

export function MediaOverlay({
  canvasRef, videoSourceRef, onCanvasStream, isLive, isPaused = false, mirror = false,
}: MediaOverlayProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"images" | "slides" | "text">("images");
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [textOverlay, setTextOverlay] = useState<TextOverlay>({
    text: "", x: 50, y: 50, visible: false, size: 32, color: "#C9A227",
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Drag state for overlays on canvas
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    type: "image" | "text" | "resize" | null;
    id: string | null;
    offsetX: number;
    offsetY: number;
  }>({ type: null, id: null, offsetX: 0, offsetY: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (panelPos === null && typeof window !== "undefined") {
      const w = Math.min(600, window.innerWidth - 32);
      setPanelPos({ x: (window.innerWidth - w) / 2, y: 80 });
    }
  }, [panelPos]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDraggingPanel(true);
  };

  useEffect(() => {
    if (!isDraggingPanel) return;
    const handleMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      setPanelPos({
        x: Math.max(-300, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    };
    const handleUp = () => setIsDraggingPanel(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingPanel]);

  // ─── Convert screen coords to canvas coords (1280×720) ───
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  // ─── Hit test: find which overlay is at the given canvas coords ───
  const hitTest = useCallback((canvasX: number, canvasY: number): { type: "image" | "text"; id: string } | null => {
    // Check text first (drawn on top)
    if (textOverlay.visible && textOverlay.text) {
      const tx = (textOverlay.x / 100) * 1280;
      const ty = (textOverlay.y / 100) * 720;
      // Approximate text bounds (generous hit area)
      const halfW = Math.min(textOverlay.text.length * textOverlay.size * 0.4, 600);
      const halfH = textOverlay.size * 0.7;
      if (Math.abs(canvasX - tx) < halfW && Math.abs(canvasY - ty) < halfH) {
        return { type: "text", id: "text" };
      }
    }
    // Check images (reverse order — topmost first)
    for (let i = overlayImages.length - 1; i >= 0; i--) {
      const img = overlayImages[i];
      if (!img.visible) continue;
      if (canvasX >= img.x && canvasX <= img.x + img.width &&
          canvasY >= img.y && canvasY <= img.y + img.height) {
        return { type: "image", id: img.id };
      }
    }
    return null;
  }, [textOverlay, overlayImages]);

  // ─── Canvas interaction: pointer down (mouse + touch) ───
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (!showOverlay || isPaused) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (hit) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStateRef.current = {
        type: hit.type,
        id: hit.id,
        offsetX: x,
        offsetY: y,
      };
      // Store original position for delta calculation
      if (hit.type === "image") {
        const img = overlayImages.find((i) => i.id === hit.id);
        if (img) {
          dragStateRef.current.offsetX = x - img.x;
          dragStateRef.current.offsetY = y - img.y;
        }
      } else if (hit.type === "text") {
        dragStateRef.current.offsetX = x - (textOverlay.x / 100) * 1280;
        dragStateRef.current.offsetY = y - (textOverlay.y / 100) * 720;
      }
      setSelectedOverlayId(hit.id);
    } else {
      setSelectedOverlayId(null);
    }
  }, [showOverlay, isPaused, getCanvasCoords, hitTest, overlayImages, textOverlay]);

  // ─── Canvas interaction: pointer move (drag) ───
  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds.type || !ds.id) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const newX = x - ds.offsetX;
    const newY = y - ds.offsetY;

    if (ds.type === "image") {
      setOverlayImages((prev) => prev.map((img) =>
        img.id === ds.id ? { ...img, x: Math.max(0, Math.min(1280 - img.width, newX)), y: Math.max(0, Math.min(720 - img.height, newY)) } : img
      ));
    } else if (ds.type === "text") {
      const xPct = Math.max(0, Math.min(100, (newX / 1280) * 100));
      const yPct = Math.max(0, Math.min(100, (newY / 720) * 100));
      setTextOverlay((prev) => ({ ...prev, x: xPct, y: yPct }));
    }
  }, [getCanvasCoords]);

  // ─── Canvas interaction: pointer up ───
  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStateRef.current.type) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    dragStateRef.current = { type: null, id: null, offsetX: 0, offsetY: 0 };
  }, []);

  // ─── Attach interaction listeners to canvas ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Make canvas interactive when overlays are visible
    const updateCursor = () => {
      if (!showOverlay || isPaused) {
        canvas.style.cursor = "default";
        canvas.style.pointerEvents = "none";
      } else {
        canvas.style.pointerEvents = "auto";
      }
    };
    updateCursor();
    // Use pointer events for unified mouse + touch
    const pointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      const scaleY = 720 / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      // Vérifier si on clique sur la poignée de redimensionnement de l'image sélectionnée
      if (selectedOverlayId) {
        const selectedImg = overlayImages.find((i) => i.id === selectedOverlayId);
        if (selectedImg && selectedImg.visible) {
          const handleSize = 12;
          const hx = selectedImg.x + selectedImg.width - handleSize / 2;
          const hy = selectedImg.y + selectedImg.height - handleSize / 2;
          if (cx >= hx && cx <= hx + handleSize && cy >= hy && cy <= hy + handleSize) {
            e.preventDefault();
            canvas.setPointerCapture(e.pointerId);
            dragStateRef.current = { type: "resize", id: selectedImg.id, offsetX: cx, offsetY: cy };
            canvas.style.cursor = "nwse-resize";
            return;
          }
        }
      }

      const hit = hitTest(cx, cy);
      if (hit) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        if (hit.type === "image") {
          const img = overlayImages.find((i) => i.id === hit.id);
          if (img) {
            dragStateRef.current = { type: "image", id: hit.id, offsetX: cx - img.x, offsetY: cy - img.y };
          }
        } else {
          dragStateRef.current = { type: "text", id: "text", offsetX: cx - (textOverlay.x / 100) * 1280, offsetY: cy - (textOverlay.y / 100) * 720 };
        }
        setSelectedOverlayId(hit.id);
        canvas.style.cursor = "grabbing";
      } else {
        setSelectedOverlayId(null);
      }
    };
    const pointerMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds.type) {
        // Update cursor for hover
        const rect = canvas.getBoundingClientRect();
        const scaleX = 1280 / rect.width;
        const scaleY = 720 / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;

        // Vérifier si on survole la poignée de redimensionnement
        if (selectedOverlayId) {
          const selectedImg = overlayImages.find((i) => i.id === selectedOverlayId);
          if (selectedImg && selectedImg.visible) {
            const handleSize = 12;
            const hx = selectedImg.x + selectedImg.width - handleSize / 2;
            const hy = selectedImg.y + selectedImg.height - handleSize / 2;
            if (cx >= hx && cx <= hx + handleSize && cy >= hy && cy <= hy + handleSize) {
              canvas.style.cursor = "nwse-resize";
              return;
            }
          }
        }

        const hit = hitTest(cx, cy);
        canvas.style.cursor = hit ? "grab" : "default";
        return;
      }
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      const scaleY = 720 / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const newX = cx - ds.offsetX;
      const newY = cy - ds.offsetY;
      if (ds.type === "image") {
        setOverlayImages((prev) => prev.map((img) =>
          img.id === ds.id ? { ...img, x: Math.max(0, Math.min(1280 - img.width, newX)), y: Math.max(0, Math.min(720 - img.height, newY)) } : img
        ));
      } else if (ds.type === "resize") {
        // Redimensionner l'image sélectionnée en préservant le ratio
        setOverlayImages((prev) => prev.map((img) => {
          if (img.id !== ds.id) return img;
          const selectedImg = overlayImages.find((i) => i.id === ds.id);
          if (!selectedImg) return img;
          // Calculer la nouvelle largeur basée sur la position du curseur
          const newWidth = Math.max(50, Math.min(1280 - img.x, cx - img.x));
          // Préserver le ratio original
          const originalRatio = selectedImg.height / selectedImg.width;
          const newHeight = Math.round(newWidth * originalRatio);
          return { ...img, width: newWidth, height: newHeight };
        }));
      } else if (ds.type === "text") {
        const xPct = Math.max(0, Math.min(100, (newX / 1280) * 100));
        const yPct = Math.max(0, Math.min(100, (newY / 720) * 100));
        setTextOverlay((prev) => ({ ...prev, x: xPct, y: yPct }));
      }
    };
    const pointerUp = (e: PointerEvent) => {
      if (dragStateRef.current.type) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
      }
      dragStateRef.current = { type: null, id: null, offsetX: 0, offsetY: 0 };
      canvas.style.cursor = "default";
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [canvasRef, showOverlay, isPaused, hitTest, overlayImages, textOverlay]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== 1280 || canvas.height !== 720) {
      canvas.width = 1280;
      canvas.height = 720;
    }
    // ⭐ V2.9 — Rendu des overlays plus net (qualité haute au redimensionnement)
    try { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; } catch {}

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const video = videoSourceRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      ctx.save();
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvas.width / canvas.height;
      let dw, dh, dx, dy;
      if (videoAspect > canvasAspect) {
        dh = canvas.height;
        dw = dh * videoAspect;
        dx = (canvas.width - dw) / 2;
        dy = 0;
      } else {
        dw = canvas.width;
        dh = dw / videoAspect;
        dx = 0;
        dy = (canvas.height - dh) / 2;
      }
      try { ctx.drawImage(video, dx, dy, dw, dh); } catch {}
      ctx.restore();
    }

    if (isPaused) {
      ctx.fillStyle = "rgba(26, 8, 38, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#C9A227";
      ctx.font = "bold 48px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⏸ Diffusion en pause", canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = "#FAF6EF";
      ctx.font = "20px 'Segoe UI', sans-serif";
      ctx.fillText("Le diffuseur a mis le live en pause", canvas.width / 2, canvas.height / 2 + 30);
    }

    if (showOverlay && !isPaused) {
      if (activeTab === "slides" && slides.length > 0) {
        const slide = slides[currentSlide];
        if (slide) {
          const img = getCachedImage(slide.src);
          if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      } else {
        for (const overlayImg of overlayImages) {
          if (!overlayImg.visible) continue;
          const img = getCachedImage(overlayImg.src);
          if (img) {
            ctx.drawImage(img, overlayImg.x, overlayImg.y, overlayImg.width, overlayImg.height);
            // Draw selection border + resize handle if selected
            if (selectedOverlayId === overlayImg.id) {
              ctx.strokeStyle = "#C9A227";
              ctx.lineWidth = 3;
              ctx.setLineDash([8, 4]);
              ctx.strokeRect(overlayImg.x, overlayImg.y, overlayImg.width, overlayImg.height);
              ctx.setLineDash([]);
              // Poignée de redimensionnement (coin inférieur droit)
              const handleSize = 12;
              const hx = overlayImg.x + overlayImg.width - handleSize / 2;
              const hy = overlayImg.y + overlayImg.height - handleSize / 2;
              ctx.fillStyle = "#C9A227";
              ctx.fillRect(hx, hy, handleSize, handleSize);
              ctx.strokeStyle = "#FFFFFF";
              ctx.lineWidth = 2;
              ctx.strokeRect(hx, hy, handleSize, handleSize);
            }
          }
        }
      }

      if (textOverlay.visible && textOverlay.text) {
        ctx.font = `bold ${textOverlay.size}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = textOverlay.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(textOverlay.text, (textOverlay.x / 100) * canvas.width, (textOverlay.y / 100) * canvas.height);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        // Draw selection border for text
        if (selectedOverlayId === "text") {
          const tx = (textOverlay.x / 100) * canvas.width;
          const ty = (textOverlay.y / 100) * canvas.height;
          const halfW = Math.min(textOverlay.text.length * textOverlay.size * 0.4, 600);
          const halfH = textOverlay.size * 0.7;
          ctx.strokeStyle = "#C9A227";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(tx - halfW, ty - halfH, halfW * 2, halfH * 2);
          ctx.setLineDash([]);
        }
      }
    }
  }, [canvasRef, videoSourceRef, overlayImages, activeTab, slides, currentSlide, showOverlay, textOverlay, isPaused, mirror, selectedOverlayId]);

  useEffect(() => {
    const render = () => {
      drawCanvas();
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [drawCanvas]);

  useEffect(() => {
    if (!canvasRef.current || !onCanvasStream) return;
    try {
      const stream = canvasRef.current.captureStream(30);
      onCanvasStream(stream);
    } catch (err) {
      console.error("[MediaOverlay] captureStream failed:", err);
    }
    return () => { onCanvasStream(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        // Charger l'image pour récupérer ses dimensions réelles et préserver le ratio
        const img = new Image();
        img.onload = () => {
          const maxW = 400;
          const ratio = img.naturalHeight / img.naturalWidth;
          const w = Math.min(maxW, img.naturalWidth);
          const h = Math.round(w * ratio);
          setOverlayImages((prev) => [...prev, {
            id: `img-${Date.now()}-${Math.random()}`, src, x: 100, y: 50, width: w, height: h, visible: true,
          }]);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSlidesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setSlides((prev) => [...prev, { id: `slide-${Date.now()}-${Math.random()}`, src }]);
      };
      reader.readAsDataURL(file);
    });
    if (slideInputRef.current) slideInputRef.current.value = "";
  };

  const toggleImageVisibility = (id: string) => {
    setOverlayImages((prev) => prev.map((img) => img.id === id ? { ...img, visible: !img.visible } : img));
  };

  const deleteImage = (id: string) => {
    setOverlayImages((prev) => prev.filter((img) => img.id !== id));
  };

  const deleteSlide = (id: string) => {
    setSlides((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (currentSlide >= filtered.length) setCurrentSlide(Math.max(0, filtered.length - 1));
      return filtered;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          showOverlay ? "bg-[#C9A227]/20 text-[#C9A227] hover:bg-[#C9A227]/30" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"
        }`}
      >
        <ImageIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Médias</span>
      </button>

      <button
        type="button"
        onClick={() => setShowOverlay(!showOverlay)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          showOverlay ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-[#2A0E3D]/5 text-[#1E0F2B] hover:bg-[#2A0E3D]/10"
        }`}
        title={showOverlay ? "Overlay actif — glissez les éléments sur la vidéo" : "Overlay inactif"}
      >
        {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        <span className="hidden sm:inline">{showOverlay ? "Overlay ON" : "Overlay OFF"}</span>
      </button>

      {/* Hint when overlay is active */}
      {showOverlay && (
        <span className="hidden md:inline text-[10px] text-[#1E0F2B]/40 px-2">
          ↑ Glissez les éléments sur la vidéo
        </span>
      )}

      {showPanel && panelPos !== null && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-[#8A8378]/20 w-[600px] max-w-[90vw] overflow-hidden"
          style={{ left: `${panelPos.x}px`, top: `${panelPos.y}px` }}
        >
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#2A0E3D] to-[#3D1A54] cursor-move select-none"
          >
            <div className="flex items-center gap-2 text-[#FAF6EF]">
              <GripVertical className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs font-bold uppercase tracking-wider">Gestion des médias</span>
              <span className="text-[10px] text-[#1E0F2B]/40 ml-2">Glissez pour déplacer</span>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1 rounded hover:bg-[#2A0E3D]/5 text-[#FAF6EF]/70 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1 bg-[#2A0E3D]/5 p-1 border-b border-[#8A8378]/15">
            <button onClick={() => setActiveTab("images")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "images" ? "bg-white text-[#0F0F0F]" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <ImageIcon className="w-3.5 h-3.5 inline mr-1" />Images
            </button>
            <button onClick={() => setActiveTab("slides")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "slides" ? "bg-white text-[#0F0F0F]" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <FileText className="w-3.5 h-3.5 inline mr-1" />Slides
            </button>
            <button onClick={() => setActiveTab("text")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "text" ? "bg-white text-[#0F0F0F]" : "text-[#1E0F2B]/50 hover:text-[#1E0F2B]"}`}>
              <Type className="w-3.5 h-3.5 inline mr-1" />Texte
            </button>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto">
            {activeTab === "images" && (
              <div className="space-y-3">
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-sm text-[#1E0F2B]/50 hover:text-[#C9A227] transition-colors">
                  <Upload className="w-4 h-4" />Uploader une image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                <div className="grid grid-cols-3 gap-2">
                  {overlayImages.map((img) => (
                    <div key={img.id} className={`relative group rounded-lg overflow-hidden border-2 ${selectedOverlayId === img.id ? "border-[#C9A227]" : "border-[#8A8378]/20"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt="overlay" className="w-full aspect-video object-cover" />
                      {!img.visible && <div className="absolute inset-0 bg-black/60" />}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center gap-1 transition-opacity">
                        <button onClick={() => toggleImageVisibility(img.id)} className="p-1.5 rounded-lg bg-white/90 text-[#0F0F0F] hover:bg-white">
                          {img.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteImage(img.id)} className="p-1.5 rounded-lg bg-red-600/90 text-[#1E0F2B] hover:bg-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {overlayImages.length === 0 && <p className="text-xs text-[#1E0F2B]/30 text-center italic py-4">Aucune image uploadée</p>}
                {overlayImages.length > 0 && (
                  <p className="text-[10px] text-[#1E0F2B]/40 italic">Astuce : activez l'overlay ON, puis glissez les images directement sur la vidéo</p>
                )}
              </div>
            )}

            {activeTab === "slides" && (
              <div className="space-y-3">
                <button onClick={() => slideInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-sm text-[#1E0F2B]/50 hover:text-[#C9A227] transition-colors">
                  <Upload className="w-4 h-4" />Uploader des slides
                </button>
                <input ref={slideInputRef} type="file" accept="image/*" multiple onChange={handleSlidesUpload} className="hidden" />
                {slides.length > 0 && (
                  <>
                    <div className="flex items-center justify-between bg-[#2A0E3D]/5 rounded-xl p-2">
                      <button onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))} disabled={currentSlide === 0}
                        className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 text-[#1E0F2B] disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-[#1E0F2B]">Slide {currentSlide + 1} / {slides.length}</span>
                      <button onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))} disabled={currentSlide >= slides.length - 1}
                        className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 text-[#1E0F2B] disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="relative rounded-xl overflow-hidden border-2 border-[#8A8378]/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slides[currentSlide]?.src} alt="slide" className="w-full aspect-video object-contain bg-[#FAF6EF]" />
                      {slides[currentSlide] && (
                        <button onClick={() => deleteSlide(slides[currentSlide].id)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-[#1E0F2B] hover:bg-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "text" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B]/70 uppercase tracking-wider mb-1.5">Texte à afficher</label>
                  <input type="text" value={textOverlay.text}
                    onChange={(e) => setTextOverlay({ ...textOverlay, text: e.target.value })}
                    placeholder="Ex: Verset du jour..." maxLength={100}
                    className="w-full px-3 py-2 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] placeholder:text-[#1E0F2B]/30 focus:outline-none focus:border-[#C9A227]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B]/70 uppercase tracking-wider mb-1.5">Taille : {textOverlay.size}px</label>
                    <input type="range" min="16" max="72" value={textOverlay.size}
                      onChange={(e) => setTextOverlay({ ...textOverlay, size: parseInt(e.target.value) })}
                      className="w-full accent-[#C9A227]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B]/70 uppercase tracking-wider mb-1.5">Couleur</label>
                    <input type="color" value={textOverlay.color}
                      onChange={(e) => setTextOverlay({ ...textOverlay, color: e.target.value })}
                      className="w-full h-9 rounded-lg border border-[#8A8378]/20 bg-[#FAF6EF]" />
                  </div>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A0E3D]/5 cursor-pointer">
                  <input type="checkbox" checked={textOverlay.visible}
                    onChange={(e) => setTextOverlay({ ...textOverlay, visible: e.target.checked })}
                    className="w-4 h-4 accent-[#C9A227]" />
                  <span className="text-sm text-[#1E0F2B]">Afficher le texte</span>
                </label>
                {textOverlay.visible && (
                  <p className="text-[10px] text-[#1E0F2B]/40 italic">Astuce : glissez le texte directement sur la vidéo pour le repositionner</p>
                )}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-[#8A8378]/15 flex items-center justify-between">
            <span className="text-xs text-[#1E0F2B]/40">{showOverlay ? "● Overlay actif" : "○ Overlay inactif"}</span>
            <button onClick={() => setShowOverlay(!showOverlay)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${showOverlay ? "bg-emerald-600 text-[#1E0F2B]" : "bg-[#C9A227] text-[#0F0F0F]"}`}>
              {showOverlay ? "Désactiver" : "Activer l'overlay"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
