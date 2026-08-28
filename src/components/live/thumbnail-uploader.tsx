"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ThumbnailUploaderProps {
  liveId?: string;
  currentThumbnail?: string | null;
  onThumbnailChange: (url: string | null) => void;
}

export function ThumbnailUploader({ liveId, currentThumbnail, onThumbnailChange }: ThumbnailUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image trop lourde (max 2MB)");
      return;
    }

    setError("");
    setUploading(true);

    // Convertir en base64 pour l'aperçu
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setPreview(base64);

      // Si on a un liveId, uploader vers le serveur
      if (liveId) {
        try {
          const res = await fetch(`/api/live/${liveId}/thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnail: base64 }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erreur upload");
          }
          const data = await res.json();
          onThumbnailChange(data.thumbnailUrl);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
          // Garder le base64 comme aperçu même si l'upload échoue
          onThumbnailChange(base64);
        }
      } else {
        // Pas de liveId (modal de création) — garder le base64
        onThumbnailChange(base64);
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
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
          {/* Overlay actions */}
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
              <span className="text-[10px] text-[#8A8378]/60">JPG, PNG — max 2MB — format 16:9 recommandé</span>
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
