"use client";

/**
 * ⭐ V3.30 — ENREGISTREUR DE NOTE VOCALE pour la page /intercession.
 *
 * Directive du pasteur : « possibilité de faire un audio en dehors du champ
 * texte pour permettre à la personne de s'exprimer librement ». La note
 * vocale accompagne (ou remplace) la description écrite — l'une OU l'autre
 * suffit pour transmettre la demande.
 *
 * UX : un bouton micro → enregistrement (chrono, pastille pulsante, arrêt
 * automatique à 2 min) → aperçu (lecteur) → supprimer / réenregistrer.
 * Cibles tactiles ≥ 44 px (spec responsive V3.28). Mêmes cascade de formats
 * et garde-fous que le recorder de Yeshua Connect (Safari → audio/mp4).
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, RotateCcw, AudioLines } from "lucide-react";

const DUREE_MAX_S = 120; // 2 minutes
const TAILLE_MAX_OCTETS = 4 * 1024 * 1024; // 4 Mo (limite upload API)
// ⭐ V3.30.1 — Bitrate explicite : sans lui, Chrome encode l'opus à ~128 kbit/s
// → 2 min ≈ 1,9 Mo > 1,2 Mo (seuil du secours data-URL serveur quand R2
// est indisponible) → « Impossible d'enregistrer la note vocale ».
// À 48 kbit/s (qualité très correcte pour la voix), 2 min ≈ 720 Ko : la
// note passe TOUJOURS, même en secours data-URL.
const BITRATE_AUDIO = 48_000;

type Etat = "idle" | "recording" | "preview" | "error";

interface AudioRecorderProps {
  /** Fichier sélectionné (null = aucune note). */
  onFileChange: (file: File | null, durationSec: number) => void;
}

/** Détection du format audio supporté (Safari utilise mp4, pas webm). */
function getSupportedAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

function formaterDuree(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function AudioRecorder({ onFileChange }: AudioRecorderProps) {
  const [etat, setEtat] = useState<Etat>("idle");
  const [duree, setDuree] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercuUrl, setApercuUrl] = useState<string | null>(null);
  const [tailleKo, setTailleKo] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);
  const dureeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const notify = (file: File | null, d: number) => onFileChange(file, d);

  const demarrer = async () => {
    setErreur(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEtat("error");
      setErreur("Votre navigateur ne permet pas l'enregistrement audio. Vous pouvez écrire votre demande.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedAudioMime();
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        // ⭐ V3.30.1 — Bitrate plafonné (cf. constante) : garantit une note
        // légère, acceptée par le serveur même si le stockage R2 est absent.
        audioBitsPerSecond: BITRATE_AUDIO,
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size === 0 || blob.size > TAILLE_MAX_OCTETS) {
          setEtat("error");
          setErreur(
            blob.size === 0
              ? "Aucun son capté. Vérifiez votre micro puis réessayez."
              : `Note trop lourde (${Math.round(blob.size / 1024)} Ko, max 4 Mo) — enregistrez moins de 2 minutes.`,
          );
          setDuree(0);
          dureeRef.current = 0;
          notify(null, 0);
          return;
        }
        // ⭐ V3.30.1 — Garde douce : certains navigateurs (Safari/AAC) peuvent
        // ignorer le bitrate demandé ; si la note dépasse ~1,1 Mo (seuil du
        // secours serveur), on prévient AVANT l'envoi plutôt qu'un refus sec.
        if (blob.size > 1_100 * 1024) {
          setEtat("error");
          setErreur(
            "La note est trop volumineuse pour être transmise de façon fiable. Réenregistrez-vous en visant moins de 2 minutes, ou décrivez votre demande par écrit.",
          );
          setDuree(0);
          dureeRef.current = 0;
          notify(null, 0);
          return;
        }
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `note-vocale.${ext}`, { type: mime });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setApercuUrl(url);
        setTailleKo(Math.round(blob.size / 1024));
        setEtat("preview");
        notify(file, dureeRef.current);
      };

      recorder.start();
      recorderRef.current = recorder;
      setEtat("recording");
      setDuree(0);
      dureeRef.current = 0;
      timerRef.current = setInterval(() => {
        dureeRef.current += 1;
        setDuree(dureeRef.current);
        if (dureeRef.current >= DUREE_MAX_S) {
          // Arrêt automatique à 2 minutes
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        }
      }, 1000);
    } catch {
      setEtat("error");
      setErreur(
        "Impossible d'accéder au micro. Autorisez le microphone dans votre navigateur (ou écrivez votre demande).",
      );
    }
  };

  const arreter = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const supprimer = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setApercuUrl(null);
    setDuree(0);
    dureeRef.current = 0;
    setTailleKo(0);
    setErreur(null);
    setEtat("idle");
    notify(null, 0);
  };

  return (
    <div className="rounded-2xl border border-[#8A8378]/30 bg-white/60 p-4 space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <AudioLines className="w-4 h-4 text-[#C9A227] flex-shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A8378]">
          Note vocale <span className="normal-case tracking-normal font-normal">(facultative)</span>
        </p>
      </div>

      {etat === "idle" && (
        <div>
          <button
            type="button"
            onClick={demarrer}
            className="inline-flex items-center justify-center gap-2.5 min-h-[44px] px-5 rounded-full border-2 border-[#C9A227]/50 text-[#2A0E3D] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors"
          >
            <Mic className="w-4 h-4 text-[#C9A227]" />
            S&apos;exprimer en audio
          </button>
          <p className="text-[11px] text-[#8A8378] mt-2 leading-relaxed">
            Exprimez-vous librement avec votre voix, en plus du texte ou à la place de la
            description écrite. Maximum 2 minutes. La note vocale est transmise avec votre
            demande, en toute confidentialité.
          </p>
        </div>
      )}

      {etat === "recording" && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-state-danger/40 animate-ping" />
            <span className="relative inline-flex rounded-full w-4 h-4 bg-state-danger" />
          </span>
          <span className="font-mono text-lg font-bold text-[#1E0F2B] tabular-nums">
            {formaterDuree(duree)}
            <span className="text-[#8A8378] text-xs font-normal"> / {formaterDuree(DUREE_MAX_S)}</span>
          </span>
          <button
            type="button"
            onClick={arreter}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full bg-[#2A0E3D] text-[#FAF6EF] font-semibold text-sm hover:bg-[#1E0F2B] transition-colors ml-auto"
            aria-label="Arrêter l'enregistrement"
          >
            <Square className="w-4 h-4 fill-current" />
            Arrêter
          </button>
        </div>
      )}

      {etat === "preview" && apercuUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#8A8378] font-semibold flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C9A227]/15 text-[#A3821C]">
              <Mic className="w-3 h-3" /> {formaterDuree(duree)} · {tailleKo} Ko
            </span>
            <span className="font-normal">à transmettre avec votre demande</span>
          </div>
          { }
          <audio controls src={apercuUrl} className="w-full h-11" preload="metadata" />
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={demarrer}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full border border-[#8A8378]/30 text-[#1E0F2B] font-semibold text-sm hover:bg-[#FAF6EF] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Réenregistrer
            </button>
            <button
              type="button"
              onClick={supprimer}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full border border-state-danger/30 text-state-danger font-semibold text-sm hover:bg-state-danger/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        </div>
      )}

      {etat === "error" && erreur && (
        <div className="space-y-2">
          <p className="text-xs text-[#B5502F] font-semibold bg-[#B5502F]/10 rounded-lg px-3 py-2.5 leading-relaxed">
            {erreur}
          </p>
          <button
            type="button"
            onClick={demarrer}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-full border-2 border-[#C9A227]/50 text-[#2A0E3D] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors"
          >
            <Mic className="w-4 h-4 text-[#C9A227]" />
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
