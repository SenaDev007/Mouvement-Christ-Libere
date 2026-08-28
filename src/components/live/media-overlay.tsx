"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Image as ImageIcon, FileText, Type, ChevronLeft, ChevronRight,
  Upload, X, Trash2, Eye, EyeOff,
} from "lucide-react";

interface MediaOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onCanvasStream?: (stream: MediaStream | null) => void;
  isLive: boolean;
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

/**
 * Overlay média pour le studio live.
 * Permet d'afficher des images, des slides et du texte sur le flux vidéo pendant le live.
 * Utilise un canvas HTML5 pour composer les overlays.
 */
export function MediaOverlay({ canvasRef, onCanvasStream, isLive }: MediaOverlayProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"images" | "slides" | "text">("images");
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [textOverlay, setTextOverlay] = useState({ text: "", x: 50, y: 50, visible: false, size: 32, color: "#C9A227" });
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Dessiner le canvas
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Taille du canvas
    canvas.width = 1280;
    canvas.height = 720;

    // Fond transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les images visibles
    for (const img of overlayImages) {
      if (!img.visible) continue;
      try {
        const image = new Image();
        image.src = img.src;
        await new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
        ctx.drawImage(image, img.x, img.y, img.width, img.height);
      } catch {}
    }

    // Dessiner le slide courant
    if (activeTab === "slides" && slides.length > 0 && showOverlay) {
      const slide = slides[currentSlide];
      if (slide) {
        try {
          const image = new Image();
          image.src = slide.src;
          await new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; });
          // Plein écran
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        } catch {}
      }
    }

    // Dessiner le texte
    if (textOverlay.visible && textOverlay.text) {
      ctx.font = `bold ${textOverlay.size}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = textOverlay.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Ombre
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(textOverlay.text, (textOverlay.x / 100) * canvas.width, (textOverlay.y / 100) * canvas.height);
      ctx.shadowColor = "transparent";
    }
  }, [canvasRef, overlayImages, activeTab, slides, currentSlide, showOverlay, textOverlay]);

  // Redessiner en boucle
  useEffect(() => {
    const render = () => {
      drawCanvas();
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [drawCanvas]);

  // Capturer le stream du canvas pour LiveKit
  useEffect(() => {
    if (!canvasRef.current || !onCanvasStream) return;
    if (showOverlay) {
      const stream = canvasRef.current.captureStream(30);
      onCanvasStream(stream);
    } else {
      onCanvasStream(null);
    }
  }, [showOverlay, canvasRef, onCanvasStream]);

  // Upload image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const newImg: OverlayImage = {
          id: `img-${Date.now()}-${Math.random()}`,
          src,
          x: 100,
          y: 50,
          width: 400,
          height: 225,
          visible: true,
        };
        setOverlayImages((prev) => [...prev, newImg]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload slides
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

  // Toggle image visibility
  const toggleImageVisibility = (id: string) => {
    setOverlayImages((prev) => prev.map((img) => img.id === id ? { ...img, visible: !img.visible } : img));
  };

  // Delete image
  const deleteImage = (id: string) => {
    setOverlayImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Delete slide
  const deleteSlide = (id: string) => {
    setSlides((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (currentSlide >= filtered.length) setCurrentSlide(Math.max(0, filtered.length - 1));
      return filtered;
    });
  };

  return (
    <>
      {/* Canvas caché pour la composition */}
      <canvas ref={canvasRef} className="hidden" width={1280} height={720} />

      {/* Bouton toggle overlay */}
      <button
        type="button"
        onClick={() => setShowPanel(!showPanel)}
        className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-colors ${showOverlay ? "bg-[#C9A227]/20 text-[#C9A227]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"}`}
      >
        <ImageIcon className="w-5 h-5" />
        <span className="text-[10px] font-medium">Médias</span>
      </button>

      {/* Toggle overlay on/off */}
      <button
        type="button"
        onClick={() => setShowOverlay(!showOverlay)}
        className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-colors ${showOverlay ? "bg-emerald-600/20 text-emerald-600" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"}`}
      >
        {showOverlay ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        <span className="text-[10px] font-medium">{showOverlay ? "On" : "Off"}</span>
      </button>

      {/* Panneau de gestion des médias */}
      {showPanel && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 w-[600px] max-w-[90vw] overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 bg-[#2A0E3D]/5 p-1 border-b border-[#8A8378]/10">
            <button onClick={() => setActiveTab("images")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "images" ? "bg-white text-[#1E0F2B] shadow-sm" : "text-[#8A8378]"}`}>
              <ImageIcon className="w-3.5 h-3.5 inline mr-1" />Images
            </button>
            <button onClick={() => setActiveTab("slides")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "slides" ? "bg-white text-[#1E0F2B] shadow-sm" : "text-[#8A8378]"}`}>
              <FileText className="w-3.5 h-3.5 inline mr-1" />Slides
            </button>
            <button onClick={() => setActiveTab("text")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "text" ? "bg-white text-[#1E0F2B] shadow-sm" : "text-[#8A8378]"}`}>
              <Type className="w-3.5 h-3.5 inline mr-1" />Texte
            </button>
            <button onClick={() => setShowPanel(false)} className="p-2 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto">
            {/* Tab Images */}
            {activeTab === "images" && (
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-sm text-[#8A8378] hover:text-[#C9A227] transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Uploader une image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

                <div className="grid grid-cols-3 gap-2">
                  {overlayImages.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border-2 border-[#8A8378]/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt="overlay" className="w-full aspect-video object-cover" />
                      {!img.visible && <div className="absolute inset-0 bg-black/60" />}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center gap-1 transition-opacity">
                        <button onClick={() => toggleImageVisibility(img.id)} className="p-1.5 rounded-lg bg-white/90 text-[#1E0F2B] hover:bg-white">
                          {img.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteImage(img.id)} className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {overlayImages.length === 0 && (
                  <p className="text-xs text-[#8A8378] text-center italic py-4">Aucune image uploadée</p>
                )}
              </div>
            )}

            {/* Tab Slides */}
            {activeTab === "slides" && (
              <div className="space-y-3">
                <button
                  onClick={() => slideInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-sm text-[#8A8378] hover:text-[#C9A227] transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Uploader des slides (images)
                </button>
                <input ref={slideInputRef} type="file" accept="image/*" multiple onChange={handleSlidesUpload} className="hidden" />

                {slides.length > 0 && (
                  <>
                    {/* Navigation slides */}
                    <div className="flex items-center justify-between bg-[#2A0E3D]/5 rounded-xl p-2">
                      <button
                        onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                        disabled={currentSlide === 0}
                        className="p-2 rounded-lg hover:bg-white text-[#1E0F2B] disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-[#1E0F2B]">
                        Slide {currentSlide + 1} / {slides.length}
                      </span>
                      <button
                        onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
                        disabled={currentSlide >= slides.length - 1}
                        className="p-2 rounded-lg hover:bg-white text-[#1E0F2B] disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Aperçu slide courant */}
                    <div className="relative rounded-xl overflow-hidden border-2 border-[#8A8378]/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slides[currentSlide]?.src} alt="slide" className="w-full aspect-video object-contain bg-[#1A0826]" />
                      <button
                        onClick={() => deleteSlide(slides[currentSlide].id)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab Texte */}
            {activeTab === "text" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Texte à afficher</label>
                  <input
                    type="text"
                    value={textOverlay.text}
                    onChange={(e) => setTextOverlay({ ...textOverlay, text: e.target.value })}
                    placeholder="Ex: Verset du jour..."
                    maxLength={100}
                    className="w-full px-3 py-2 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Taille: {textOverlay.size}px</label>
                    <input
                      type="range"
                      min="16" max="72"
                      value={textOverlay.size}
                      onChange={(e) => setTextOverlay({ ...textOverlay, size: parseInt(e.target.value) })}
                      className="w-full accent-[#C9A227]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Couleur</label>
                    <input
                      type="color"
                      value={textOverlay.color}
                      onChange={(e) => setTextOverlay({ ...textOverlay, color: e.target.value })}
                      className="w-full h-9 rounded-lg border border-[#8A8378]/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Position X: {textOverlay.x}%</label>
                    <input
                      type="range" min="0" max="100"
                      value={textOverlay.x}
                      onChange={(e) => setTextOverlay({ ...textOverlay, x: parseInt(e.target.value) })}
                      className="w-full accent-[#C9A227]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Position Y: {textOverlay.y}%</label>
                    <input
                      type="range" min="0" max="100"
                      value={textOverlay.y}
                      onChange={(e) => setTextOverlay({ ...textOverlay, y: parseInt(e.target.value) })}
                      className="w-full accent-[#C9A227]"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A0E3D]/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={textOverlay.visible}
                    onChange={(e) => setTextOverlay({ ...textOverlay, visible: e.target.checked })}
                    className="w-4 h-4 accent-[#C9A227]"
                  />
                  <span className="text-sm text-[#1E0F2B]">Afficher le texte</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#8A8378]/10 flex items-center justify-between">
            <span className="text-xs text-[#8A8378]">
              {showOverlay ? "● Overlay actif" : "○ Overlay inactif"}
            </span>
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${showOverlay ? "bg-emerald-600 text-white" : "bg-[#C9A227] text-[#1E0F2B]"}`}
            >
              {showOverlay ? "Désactiver" : "Activer l'overlay"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
