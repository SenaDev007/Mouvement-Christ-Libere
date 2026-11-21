"use client";

/**
 * ⭐ V4.25 — LECTEUR AUDIO DES TÉMOIGNAGES « VIES TRANSFORMÉES ».
 *
 * La note vocale enregistrée par le témoin (durée illimitée, stockée sur
 * Cloudflare R2) doit pouvoir être ÉCOUTÉE PAR TOUT LE MONDE sur le site
 * public : cartes du marquee de la landing, page /vie-transformee et
 * carte de modération du back-office.
 *
 * Deux variantes :
 *   - « pilule » : bouton compact pour les cartes du marquee (340×220 —
 *     pas de place pour une barre complète) ;
 *   - « barre » : play + progression cliquable + temps, pour les grandes
 *     cartes de /vie-transformee et du back-office (sombre ou clair).
 *
 * ⚠️ Détail technique : les webm produits par MediaRecorder n'ont SOUVENT
 * PAS de métadonnée de durée — on affiche donc la durée déclarée par le
 * témoin (audioDuree stockée en base) et on retombe sur audio.duration
 * quand elle est exploitable.
 *
 * Un SEUL vocal à la fois : démarrer une lecture met en pause la
 * précédente (singleton au niveau du module).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";

/* ── Singleton : un seul vocal joué à la fois sur la page ── */
let stopperPrecedent: (() => void) | null = null;

function formaterDuree(secondes: number | null | undefined): string {
  if (secondes == null || !Number.isFinite(secondes) || secondes < 0) return "";
  const s = Math.floor(secondes);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function LecteurAudioTemoignage({
  url,
  duree,
  variante = "barre",
  theme = "clair",
}: {
  url: string;
  /** Durée déclarée en secondes (base) — repli si metadata webm absente. */
  duree?: number | null;
  /** « pilule » : compact (marquee) · « barre » : complète (pages, admin). */
  variante?: "pilule" | "barre";
  /** « clair » : fond ivoire · « sombre » : carte du back-office. */
  theme?: "clair" | "sombre";
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0);
  const [dureeConnue, setDureeConnue] = useState<number | null>(
    typeof duree === "number" && Number.isFinite(duree) && duree > 0 ? duree : null
  );

  const arreter = useCallback(() => {
    setEnCours(false);
    setPosition(0);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, []);

  /* Nettoyage systématique au démontage. */
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (stopperPrecedent === arreter) stopperPrecedent = null;
    };
  }, [arreter]);

  const basculer = useCallback(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audio.preload = "none";
      audioRef.current = audio;

      audio.addEventListener("playing", () => {
        setChargement(false);
        setEnCours(true);
      });
      audio.addEventListener("timeupdate", () => {
        setPosition(audio!.currentTime);
        // Certains navigateurs ne découvrent la durée qu'à la lecture.
        if (
          audio!.duration &&
          Number.isFinite(audio!.duration) &&
          audio!.duration > 0
        ) {
          setDureeConnue((d) => (d == null ? audio!.duration : d));
        }
      });
      audio.addEventListener("pause", () => setEnCours(false));
      audio.addEventListener("ended", () => {
        setEnCours(false);
        setPosition(0);
        if (stopperPrecedent === arreter) stopperPrecedent = null;
      });
      audio.addEventListener("error", () => {
        setChargement(false);
        setEnCours(false);
      });
    }

    if (enCours) {
      audio.pause();
      return;
    }

    // Un seul vocal à la fois : on coupe le précédent.
    if (stopperPrecedent && stopperPrecedent !== arreter) {
      stopperPrecedent();
    }
    stopperPrecedent = arreter;

    setChargement(true);
    audio.play().catch(() => setChargement(false));
  }, [url, enCours, arreter]);

  const naviguer = useCallback((fraction: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d =
      a.duration && Number.isFinite(a.duration) && a.duration > 0
        ? a.duration
        : dureeConnue;
    if (!d) return;
    a.currentTime = Math.min(Math.max(fraction * d, 0), d - 0.2);
    setPosition(a.currentTime);
  }, [dureeConnue]);

  const progression = dureeConnue ? Math.min(position / dureeConnue, 1) : 0;
  const libelleTemps = formaterDuree(dureeConnue);
  const positionTemps = formaterDuree(position);

  /* ═══ Variante PILULE — cartes du marquee (compacte) ═══ */
  if (variante === "pilule") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          basculer();
        }}
        aria-label={enCours ? "Mettre en pause le témoignage vocal" : "Écouter le témoignage vocal"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer select-none ${
          theme === "sombre"
            ? "bg-[#C9A227]/15 text-[#DDBE55] border border-[#C9A227]/40 hover:bg-[#C9A227]/25"
            : "bg-accent-yellow/15 text-accent-dark border border-accent-yellow/50 hover:bg-accent-yellow/25"
        }`}
      >
        {chargement ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : enCours ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" fill="currentColor" />
        )}
        {enCours ? positionTemps || "En cours" : "Écouter"}
        {libelleTemps && !enCours && (
          <span className={theme === "sombre" ? "text-[#BDB4C9]" : "text-gray-text"}>
            · {libelleTemps}
          </span>
        )}
      </button>
    );
  }

  /* ═══ Variante BARRE — pages publiques + back-office ═══ */
  const sombre = theme === "sombre";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        sombre
          ? "bg-[#150920]/80 border border-[#C9A227]/25"
          : "bg-primary-pale/60 border border-primary-green/15"
      }`}
    >
      <button
        type="button"
        onClick={basculer}
        aria-label={enCours ? "Mettre en pause" : "Écouter la note vocale"}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all cursor-pointer ${
          sombre
            ? "bg-[#C9A227] text-[#1A0826]"
            : "bg-primary-deep text-accent-yellow"
        }`}
      >
        {chargement ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : enCours ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Barre de progression cliquable */}
        <div
          role="slider"
          aria-label="Progression de la note vocale"
          aria-valuenow={Math.round(progression * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            naviguer((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") naviguer(progression + 0.05);
            if (e.key === "ArrowLeft") naviguer(progression - 0.05);
          }}
          className={`h-2 rounded-full cursor-pointer overflow-hidden ${
            sombre ? "bg-[#3D1A54]" : "bg-white"
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${
              sombre ? "bg-[#C9A227]" : "bg-accent-yellow"
            }`}
            style={{ width: `${Math.round(progression * 100)}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between mt-1 text-[10.5px] font-semibold ${
            sombre ? "text-[#BDB4C9]" : "text-gray-text"
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> Note vocale
          </span>
          <span>
            {positionTemps || "0:00"} {libelleTemps ? `/ ${libelleTemps}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
