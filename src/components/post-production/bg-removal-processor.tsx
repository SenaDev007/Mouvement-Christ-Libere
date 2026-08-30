"use client";

import { useRef, useState, useCallback } from "react";
import { Loader2, Eraser, CheckCircle2 } from "lucide-react";

interface BgRemovalProcessorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoId: string;
  onProcessed: (newVideoUrl: string) => void;
}

/**
 * BgRemovalProcessor — Suppression de fond IA via MediaPipe Selfie Segmentation.
 *
 * Fonctionnement :
 * 1. Charge le modèle MediaPipe Selfie Segmentation (WASM, ~6MB)
 * 2. Lit la vidéo frame par frame
 * 3. Pour chaque frame, MediaPipe génère un masque de segmentation (personne vs fond)
 * 4. Le masque est appliqué sur un canvas : la personne est gardée,
 *    le fond est remplacé par une couleur (vert chroma key par défaut, ou noir)
 * 5. Le canvas est enregistré via MediaRecorder → WebM
 * 6. Le résultat est uploadé vers R2 et remplace la vidéo source
 *
 * Le résultat peut ensuite être utilisé avec chroma key (si fond vert)
 * ou directement comme vidéo transparente.
 *
 * Note : le traitement est fait côté client (browser) car MediaPipe
 * n'est pas disponible sur Vercel serverless. Pour une vidéo de 10 min
 * à 30fps, le traitement prend ~2-3 min (plus lent que realtime).
 */
export function BgRemovalProcessor({ videoRef, videoId, onProcessed }: BgRemovalProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [bgColor, setBgColor] = useState("#00FF00"); // vert pour chroma key
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState("");
  const segmenterRef = useRef<unknown>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Callback appelé pour chaque frame traitée par MediaPipe
  const handleResults = useCallback((results: { segmentationMask: HTMLCanvasElement; image: HTMLCanvasElement }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dessiner le fond (couleur unie)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Appliquer le masque de segmentation
    ctx.save();
    ctx.drawImage(results.segmentationMask, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(results.image, 0, 0, w, h);
    ctx.restore();
  }, [bgColor]);

  // Charger le modèle MediaPipe à la demande
  const loadModel = useCallback(async () => {
    if (modelLoaded || segmenterRef.current) return;
    setStage("Chargement du modèle IA...");
    try {
      const SelfieSegmentation = (await import("@mediapipe/selfie_segmentation")).SelfieSegmentation;
      const segmenter = new SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      segmenter.setOptions({ modelSelection: 1, selfieMode: true });
      segmenter.onResults(handleResults as never);
      segmenterRef.current = segmenter;
      setModelLoaded(true);
      setStage("");
    } catch (err) {
      setError("Impossible de charger le modèle MediaPipe: " + (err instanceof Error ? err.message : "erreur"));
    }
  }, [modelLoaded, handleResults]);

  // Traiter la vidéo complète
  const processVideo = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setProcessing(true);
    setError("");
    setProgress(0);

    try {
      // 1. Charger le modèle
      await loadModel();

      // 2. Préparer le canvas
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non disponible");

      // 3. Configurer MediaRecorder sur le canvas
      const stream = canvas.captureStream(30); // 30 fps
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm;codecs=vp8";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // 4. Démarrer l'enregistrement
      recorder.start(1000);
      setStage("Traitement IA en cours...");

      // 5. Lire la vidéo frame par frame et traiter
      video.currentTime = 0;
      video.muted = true;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      const duration = video.duration;
      const fps = 30;
      const frameTime = 1 / fps;
      let currentTime = 0;

      const segmenter = segmenterRef.current as { send: (input: HTMLVideoElement) => Promise<void> } | null;

      while (currentTime < duration) {
        video.currentTime = currentTime;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        // Envoyer la frame à MediaPipe
        if (segmenter) {
          await segmenter.send(video);
        }

        currentTime += frameTime;
        setProgress(Math.round((currentTime / duration) * 100));

        // Laisser le navigateur respirer
        await new Promise((r) => setTimeout(r, 0));
      }

      // 6. Arrêter l'enregistrement
      recorder.stop();
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      // 7. Créer le blob et uploader
      setStage("Upload du résultat...");
      const blob = new Blob(chunks, { type: "video/webm" });

      // Uploader via presigned R2
      const presignRes = await fetch(`/api/videos/${videoId}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "video/webm", filename: "bg-removed.webm" }),
      });

      if (!presignRes.ok) throw new Error("Impossible de générer l'URL d'upload");

      const { uploadUrl, publicUrl } = await presignRes.json();

      // Upload direct vers R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload échoué: HTTP ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "video/webm");
        xhr.send(blob);
      });

      // Commit en base
      await fetch(`/api/videos/${videoId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ r2Url: publicUrl }),
      });

      setStage("Terminé !");
      setProgress(100);
      onProcessed(publicUrl);

      // Recharger la page après 2s
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du traitement");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eraser className="w-4 h-4 text-[#C9A227]" />
        <span className="text-xs font-bold">Suppression de fond IA</span>
        {modelLoaded && (
          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3" /> Modèle chargé
          </span>
        )}
      </div>

      {!processing && !modelLoaded && (
        <>
          <p className="text-[10px] text-[#8A8378] leading-relaxed">
            Supprime automatiquement le fond de la vidéo en gardant uniquement la personne.
            Utilise MediaPipe Selfie Segmentation (IA Google). Le traitement prend ~2-3 min pour 10 min de vidéo.
          </p>
          <div>
            <label className="text-[10px] text-[#8A8378] uppercase font-bold">Couleur de fond de remplacement</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-7 rounded" />
              <span className="text-xs text-[#8A8378]">
                {bgColor === "#00FF00" ? "Vert (pour chroma key)" : bgColor === "#000000" ? "Noir" : "Personnalisé"}
              </span>
            </div>
          </div>
          <button onClick={loadModel}
            className="w-full px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/30 transition-colors">
            Charger le modèle IA
          </button>
        </>
      )}

      {modelLoaded && !processing && (
        <>
          <div>
            <label className="text-[10px] text-[#8A8378] uppercase font-bold">Couleur de fond</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-7 rounded" />
              <span className="text-xs text-[#8A8378]">
                {bgColor === "#00FF00" ? "Vert (chroma key)" : bgColor === "#000000" ? "Noir" : "Personnalisé"}
              </span>
            </div>
          </div>
          <button onClick={processVideo}
            className="w-full px-3 py-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-xs font-bold hover:bg-[#DDBE55] transition-colors flex items-center justify-center gap-1.5">
            <Eraser className="w-3.5 h-3.5" />
            Lancer le traitement IA
          </button>
        </>
      )}

      {processing && (
        <div className="text-center py-4">
          <Loader2 className="w-8 h-8 text-[#C9A227] mx-auto mb-3 animate-spin" />
          <p className="text-xs font-bold text-[#1E0F2B] mb-2">{stage || "Traitement..."} {progress}%</p>
          <div className="w-full bg-[#2A0E3D]/10 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#C9A227] to-[#DDBE55] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-[#8A8378] mt-2">Ne fermez pas cette page</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Canvas caché pour le traitement */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
