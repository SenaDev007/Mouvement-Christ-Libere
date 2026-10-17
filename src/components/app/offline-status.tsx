"use client";

/**
 * ⭐ V4.10 — INDICATEURS HORS LIGNE de l'application « Christ Libère ».
 *
 * Exigence : « le hors ligne doit fonctionner pour toutes les pages…
 * même on peut envoyer les messages et quand la connexion sera rétablie,
 * les messages vont charger et être envoyés » → l'app doit TOUJOURS
 * montrer clairement son état de connexion :
 *
 *  • <OfflineChip/> — pastille compacte pour l'EN-TÊTE (h-16) : quand la
 *    connexion est coupée elle remplace visuellement le bouton Rendez-vous
 *    (même gabarit size-11 → AUCUN décalage de mise en page, la hauteur du
 *    header restant calibrée avec MessagingView). Cliquer affiche l'état.
 *
 *  • <DrawerSyncStatus/> — ligne d'état du TIROIR : en ligne (contenu
 *    synchronisé, dernière maj) / hors ligne (lecture locale + messages
 *    en attente d'envoi).
 *
 *  • useOfflineStatus() — état partagé : en ligne, nb de messages en
 *    file d'attente, date de dernière synchro du contenu.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { countPending } from "@/lib/offline/engine";

/* ============================================================
   État de connexion (partagé)
   ============================================================ */

export function useOfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    // État initial réel.
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const refreshPending = (e?: Event) => {
      const detail = (e as CustomEvent | undefined)?.detail as { pending?: number } | undefined;
      if (typeof detail?.pending === "number") setPending(detail.pending);
      else void countPending().then(setPending);
    };
    const onSynced = (e: Event) => {
      setLastSync(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      refreshPending(e);
    };

    window.addEventListener("ycl:online", goOnline);
    window.addEventListener("ycl:offline", goOffline);
    window.addEventListener("ycl:outbox-updated", refreshPending);
    window.addEventListener("ycl:content-updated", onSynced);

    refreshPending();

    return () => {
      window.removeEventListener("ycl:online", goOnline);
      window.removeEventListener("ycl:offline", goOffline);
      window.removeEventListener("ycl:outbox-updated", refreshPending);
      window.removeEventListener("ycl:content-updated", onSynced);
    };
  }, []);

  return { online, pending, lastSync };
}

/* ============================================================
   Pastille d'en-tête (hors ligne)
   ============================================================ */

export function OfflineChip() {
  return (
    <span
      role="status"
      aria-label="Hors ligne — les messages seront envoyés à la reconnexion"
      title="Hors ligne — l'application fonctionne en local. Vos messages seront envoyés dès le retour de la connexion."
      className="flex items-center justify-center size-11 rounded-xl bg-red-500/15 border border-red-400/40 text-red-300"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.78A4 4 0 0 1 19 18" />
        <path d="M5 12.85a4 4 0 0 1 7.83-1.17" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    </span>
  );
}

/* ============================================================
   Ligne d'état de synchro (tiroir)
   ============================================================ */

export function DrawerSyncStatus() {
  const { online, pending, lastSync } = useOfflineStatus();

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] leading-snug",
        online
          ? "text-emerald-300/90 bg-emerald-500/8 border border-emerald-400/20"
          : "text-amber-300/90 bg-amber-500/10 border border-amber-400/25"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          online ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
        )}
        aria-hidden="true"
      />
      {online ? (
        <span>
          En ligne — contenu synchronisé
          {lastSync ? ` · ${lastSync}` : ""}
          {pending > 0 && (
            <> — <b className="font-semibold">{pending} message{pending > 1 ? "s" : ""} en envoi…</b></>
          )}
        </span>
      ) : (
        <span>
          Hors ligne — lecture locale. Vos messages partent
          automatiquement au retour de la connexion
          {pending > 0 && (
            <> (<b className="font-semibold">{pending} en attente</b>)</>
          )}
          .
        </span>
      )}
    </div>
  );
}
