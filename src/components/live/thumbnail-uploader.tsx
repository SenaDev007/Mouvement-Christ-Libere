"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ThumbnailUploaderProps {
  liveId?: string;
  currentThumbnail?: string | null;
  onThumbnailChange: (url: string | null) => void;
}

/**
 * Compresse une image côté client via canvas.
 * - Redimensionne à max 1280x720 (16:9)
 * - Compresse en JPEG qualité 0.85
 * - Retourne un base64 optimisé (< 200KB typiquement)
 */
async function compressImage(file: File, maxWidth = 1280, maxHeight = 720, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Redimensionner en gardant le ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas non supporté"));
          return;
        }

        // Fond blanc pour les PNG transparents (évite fond noir après JPEG)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convertir en JPEG compressé
        const compressed = canvas.toDataURL("image/jpeg", quality);

        // Vérifier la taille finale — si trop grosse, recompresser avec qualité moindre
        const sizeKB = Math.round((compressed.length * 3) / 4 / 1024); // base64 → bytes
        if (sizeKB > 500) {
          // Recompresser avec qualité 0.6
          const recompressed = canvas.toDataURL("image/jpeg", 0.6);
          resolve(recompressed);
        } else {
          resolve(compressed);
        }
      };
      img.onerror = () => reject(new Error("Image invalide ou format non supporté (utilisez JPG ou PNG)"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Lecture du fichier échouée"));
    reader.readAsDataURL(file);
  });
}

export function ThumbnailUploader({ liveId, currentThumbnail, onThumbnailChange }: ThumbnailUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image trop lourde (max 10MB)");
      return;
    }

    setError("");
    setUploading(true);

    try {
      // Compresser l'image côté client (rapide, < 1s)
      const compressed = await compressImage(file);

      // Aperçu immédiat
      setPreview(compressed);

      // Upload si on a un liveId
      if (liveId) {
        const res = await fetch(`/api/live/${liveId}/thumbnail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thumbnail: compressed }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur upload");
        }
        const data = await res.json();
        onThumbnailChange(data.thumbnailUrl);
      } else {
        // Pas de liveId (modal de création) — garder le base64 compressé
        onThumbnailChange(compressed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setError(msg);
      // Ne pas écraser le preview si la compression a réussi mais l'upload a échoué
      if (preview) onThumbnailChange(preview);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onThumbnailChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
        Miniature du live
      </label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-[#8A8378]/20 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Miniature" className="w-full aspect-video object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white/90 text-[#1E0F2B] text-xs font-bold hover:bg-white transition-colors"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex flex-col items-center justify-center gap-2 transition-colors bg-[#FAF6EF]"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-[#C9A227]/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#C9A227]" />
              </div>
              <span className="text-xs font-medium text-[#8A8378]">Cliquez pour uploader une miniature</span>
              <span className="text-[10px] text-[#8A8378]/60">JPG, PNG — max 10MB — format 16:9 recommandé</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
