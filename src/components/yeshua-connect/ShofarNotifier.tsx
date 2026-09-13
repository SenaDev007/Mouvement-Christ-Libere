"use client";

/**
 * ⭐ V3.6 — SHOFAR NOTIFIER (Yeshua Connect)
 * ============================================================================
 *
 * Cœur de la demande : « à chaque entrée dans le Shabbat, dès le coucher
 * du soleil, le son du shofar retentit — et de même pour toutes les fêtes
 * bibliques. Pour les grandes solennités : notification à 7 jours, à 3
 * jours et à 24 heures, puis sonnerie du shofar à l'entrée. »
 *
 * Fonctionnement :
 * 1. Au montage (ouverture de la communauté), charge les prochains
 *    événements depuis /api/calendrier-biblique/evenements (Shabbats +
 *    fêtes de l'Éternel, heures de coucher de soleil réelles à Jérusalem).
 * 2. Arme l'audio au premier geste utilisateur (règle des navigateurs).
 * 3. Vérifie toutes les 30 s (et au retour d'onglet) si un jalon ou une
 *    sonnerie est dû — fenêtre de grâce de 2 h pour rattraper un tick.
 * 4. Déclenche : shofar (Web Audio) + bannière dans le chat + notification
 *    système (Notification API) — selon les préférences.
 *
 * Les préférences (son / notifications) sont partagées avec le workspace
 * calendrier via localStorage + événement custom.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sunset, X, CalendarDays, Volume2, VolumeX } from "lucide-react";
import type { EvenementShofar, JalonNotification } from "@/lib/calendrier/evenements-shofar";
import { armerAudioShofar, jouerAnnonceShofar } from "@/lib/shofar/shofar-audio";

// ─── Préférences partagées (workspace calendrier ↔ notifier) ─────────────

export const CLE_PREFS_SHOFAR = "mcl-shofar-prefs";
export const EVENEMENT_PREFS_SHOFAR = "mcl-shofar-prefs-change";

export interface PrefsShofar {
  sound: boolean; // le shofar retentit
  notif: boolean; // notifications système + bannière
}

export function lirePrefsShofar(): PrefsShofar {
  if (typeof window === "undefined") return { sound: true, notif: true };
  try {
    const brut = window.localStorage.getItem(CLE_PREFS_SHOFAR);
    if (!brut) return { sound: true, notif: true };
    const p = JSON.parse(brut) as Partial<PrefsShofar>;
    return { sound: p.sound !== false, notif: p.notif !== false };
  } catch {
    return { sound: true, notif: true };
  }
}

export function ecrirePrefsShofar(prefs: PrefsShofar): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_PREFS_SHOFAR, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(EVENEMENT_PREFS_SHOFAR, { detail: prefs }));
  } catch {
    /* stockage indisponible : la session vit sans préférences */
  }
}

// ─── Constantes du scheduler ──────────────────────────────────────────────

const CLE_FIRED = "mcl-shofar-fired";
const FENETRE_MS = 2 * 60 * 60 * 1000; // 2 h de grâce après l'instant exact
const INTERVAL_MS = 30 * 1000;
const PURGE_MS = 9 * 24 * 60 * 60 * 1000;

interface BanniereShofar {
  cle: string; // clé de dédoublonnage
  type: "sonnerie" | "jalon";
  evenement: EvenementShofar;
  jalon: JalonNotification | null;
  instant: number; // Date.now() du déclenchement
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function lireFired(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(CLE_FIRED);
    if (!brut) return {};
    const map = JSON.parse(brut) as Record<string, number>;
    // Purge des entrées trop anciennes (Shabbats passés, etc.)
    const limite = Date.now() - PURGE_MS;
    const nettoyee: Record<string, number> = {};
    for (const [cle, ts] of Object.entries(map)) {
      if (typeof ts === "number" && ts >= limite) nettoyee[cle] = ts;
    }
    return nettoyee;
  } catch {
    return {};
  }
}

function marquerFired(map: Record<string, number>, cle: string): void {
  map[cle] = Date.now();
  try {
    window.localStorage.setItem(CLE_FIRED, JSON.stringify(map));
  } catch {
    /* stockage indisponible */
  }
}

function heureJerusalem(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function heureLocale(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function texteJalon(cle: string): string {
  if (cle === "j7") return "Dans 7 jours";
  if (cle === "j3") return "Dans 3 jours";
  return "Demain soir";
}

function tronquer(texte: string | null, max: number): string {
  if (!texte) return "";
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

// ─── Composant ─────────────────────────────────────────────────────────────

interface ShofarNotifierProps {
  onOpenCalendar: () => void;
}

export function ShofarNotifier({ onOpenCalendar }: ShofarNotifierProps) {
  const [banniere, setBanniere] = useState<BanniereShofar | null>(null);
  const [audioDisponible, setAudioDisponible] = useState(true);
  // Préférences en STATE pour le rendu (le ref reste pour les callbacks)
  const [prefs, setPrefs] = useState<PrefsShofar>({ sound: true, notif: true });

  // Références stables (les effets lisent toujours les dernières valeurs
  // sans se réabonner à chaque rendu)
  const evenementsRef = useRef<EvenementShofar[]>([]);
  const offsetHorlogeRef = useRef(0); // heure serveur - heure client
  const prefsRef = useRef<PrefsShofar>({ sound: true, notif: true });
  const firedRef = useRef<Record<string, number>>({});
  const banniereTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Déclenchement d'une sonnerie ou d'un jalon ─────────────────────────
  const declencher = useCallback(
    (cle: string, evenement: EvenementShofar, jalon: JalonNotification | null, type: "sonnerie" | "jalon") => {
      const prefs = prefsRef.current;

      // Son du shofar — uniquement pour une ENTRÉE (Shabbat / fête)
      let sonEmis = false;
      if (type === "sonnerie" && prefs.sound) {
        sonEmis = jouerAnnonceShofar();
        setAudioDisponible(sonEmis);
      }

      // Bannière dans le chat
      if (prefs.notif || type === "sonnerie") {
        setBanniere({ cle, type, evenement, jalon, instant: Date.now() });
        if (banniereTimerRef.current) clearTimeout(banniereTimerRef.current);
        const duree = type === "sonnerie" ? 45000 : 25000;
        banniereTimerRef.current = setTimeout(() => setBanniere(null), duree);
      }

      // Notification système
      if (
        prefs.notif &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const options: NotificationOptions = {
            tag: `mcl-shofar-${cle}`,
            icon: "/icons/icon-192.png",
          };
          if (type === "sonnerie") {
            if (evenement.type === "shabbat") {
              new Notification("📯 Shabbat Shalom !", {
                ...options,
                body: "Le Shabbat est entré au coucher du soleil. Que ce jour de repos soit béni sur votre maison.",
              });
            } else {
              new Notification(`📯 Le shofar retentit — ${evenement.titre}`, {
                ...options,
                body: `${evenement.dateBiblique ?? ""}${evenement.reference ? ` · ${evenement.reference}` : ""} — la solennité de l'Éternel commence maintenant (coucher à ${heureJerusalem(evenement.entree)} à Jérusalem).`,
              });
            }
          } else if (jalon) {
            new Notification(`${texteJalon(jalon.cle)} : ${evenement.titre}`, {
              ...options,
              body: `La fête de l'Éternel ${evenement.titre}${evenement.titreHebreu ? ` (${evenement.titreHebreu})` : ""} approche — le shofar retentira à l'entrée, au coucher du soleil.`,
            });
          }
        } catch {
          /* notifications indisponibles : la bannière reste là */
        }
      }

      // Journal discret (aide au support)
      console.info(`[shofar] ${type} déclenchée : ${cle}${sonEmis ? " (avec son)" : ""}`);
    },
    []
  );

  // ── Tick : vérifie tous jalons/sonneries dus ───────────────────────────
  const verifier = useCallback(() => {
    const nowCorrige = Date.now() + offsetHorlogeRef.current;
    const fired = firedRef.current;

    for (const evenement of evenementsRef.current) {
      // Jalons J-7 / J-3 / J-24 h — uniquement les solennités
      for (const jalon of evenement.jalons) {
        const cle = `${evenement.id}:jalon:${jalon.cle}`;
        if (fired[cle]) continue;
        const dateJalon = new Date(jalon.date).getTime();
        if (nowCorrige >= dateJalon && nowCorrige <= dateJalon + FENETRE_MS) {
          marquerFired(fired, cle);
          declencher(cle, evenement, jalon, "jalon");
        }
      }

      // Sonnerie d'entrée — Shabbat et fêtes
      const cleSonnerie = `${evenement.id}:entree`;
      if (!fired[cleSonnerie]) {
        const entree = new Date(evenement.entree).getTime();
        if (nowCorrige >= entree && nowCorrige <= entree + FENETRE_MS) {
          marquerFired(fired, cleSonnerie);
          declencher(cleSonnerie, evenement, null, "sonnerie");
        }
      }
    }
  }, [declencher]);

  // ── Chargement des événements + armement audio + boucle ───────────────
  useEffect(() => {
    let annule = false;

    const prefsInitiales = lirePrefsShofar();
    prefsRef.current = prefsInitiales;
    setPrefs(prefsInitiales);
    firedRef.current = lireFired();

    // Préférences modifiées depuis le workspace → relecture en direct
    const onPrefsChange = () => {
      const nouvelles = lirePrefsShofar();
      prefsRef.current = nouvelles;
      setPrefs(nouvelles);
    };
    window.addEventListener(EVENEMENT_PREFS_SHOFAR, onPrefsChange);

    // Armement audio au premier geste utilisateur (règle des navigateurs)
    const armer = () => armerAudioShofar();
    window.addEventListener("pointerdown", armer, { once: true, capture: true, passive: true });

    // Charger les prochains événements
    const charger = async () => {
      try {
        const res = await fetch("/api/calendrier-biblique/evenements", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          maintenant: string;
          evenements: EvenementShofar[];
        };
        if (annule || !Array.isArray(data.evenements)) return;
        offsetHorlogeRef.current = new Date(data.maintenant).getTime() - Date.now();
        evenementsRef.current = data.evenements;
        verifier();
      } catch {
        /* hors-ligne : on retentera au prochain interval */
      }
    };
    void charger();

    // Boucle de vérification (30 s) + au retour d'onglet
    const timer = setInterval(verifier, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Rechargement des événements toutes les 30 min (roulement des Shabbats)
    const timerRecharge = setInterval(() => void charger(), 30 * 60 * 1000);

    return () => {
      annule = true;
      clearInterval(timer);
      clearInterval(timerRecharge);
      window.removeEventListener(EVENEMENT_PREFS_SHOFAR, onPrefsChange);
      window.removeEventListener("pointerdown", armer, { capture: true } as AddEventListenerOptions);
      document.removeEventListener("visibilitychange", onVisible);
      if (banniereTimerRef.current) clearTimeout(banniereTimerRef.current);
    };
  }, [verifier]);

  // ─── Rendu : bannière flottante (coin supérieur droit) ─────────────────

  return (
    <AnimatePresence>
      {banniere && (
        <motion.div
          key={banniere.cle}
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed top-3 right-3 z-[95] w-[min(370px,calc(100vw-1.5rem))] pointer-events-auto"
          role="alert"
          aria-live="assertive"
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl border bg-[#2A0E3D]"
            style={{ borderColor: `${banniere.evenement.couleur}66` }}
          >
            {/* Liseré de fête */}
            <div className="h-1" style={{ backgroundColor: banniere.evenement.couleur }} />

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${banniere.evenement.couleur}2E` }}
                >
                  {banniere.type === "sonnerie" ? (
                    banniere.evenement.type === "shabbat" ? (
                      <span className="text-xl leading-none select-none">🕯️</span>
                    ) : (
                      <span className="text-xl leading-none select-none">📯</span>
                    )
                  ) : (
                    <CalendarDays className="w-5 h-5 text-[#C9A227]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {banniere.type === "sonnerie" ? (
                    banniere.evenement.type === "shabbat" ? (
                      <>
                        <p className="font-serif text-base font-bold text-[#FAF6EF] leading-tight">
                          Shabbat Shalom !
                        </p>
                        <p className="text-xs text-[#FAF6EF]/70 mt-1 leading-snug">
                          Le Shabbat est entré au coucher du soleil ({heureJerusalem(banniere.evenement.entree)} à Jérusalem).
                          Jour de repos et de sainte convocation — Exode 20:8.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-serif text-base font-bold text-[#FAF6EF] leading-tight">
                          📯 Le shofar retentit — {banniere.evenement.titre}
                        </p>
                        {banniere.evenement.titreHebreu && (
                          <p className="text-xs text-[#C9A227] font-serif mt-0.5" dir="rtl">
                            {banniere.evenement.titreHebreu}
                          </p>
                        )}
                        <p className="text-xs text-[#FAF6EF]/70 mt-1 leading-snug">
                          {banniere.evenement.dateBiblique}
                          {banniere.evenement.reference ? ` · ${banniere.evenement.reference}` : ""} — la solennité
                          commence maintenant, au coucher du soleil ({heureJerusalem(banniere.evenement.entree)} à Jérusalem).
                        </p>
                        {tronquer(banniere.evenement.description, 110) && (
                          <p className="text-[11px] text-[#FAF6EF]/55 mt-1.5 leading-snug italic">
                            {tronquer(banniere.evenement.description, 110)}
                          </p>
                        )}
                      </>
                    )
                  ) : (
                    banniere.jalon && (
                      <>
                        <p className="font-serif text-base font-bold text-[#FAF6EF] leading-tight">
                          {texteJalon(banniere.jalon.cle)} : {banniere.evenement.titre}
                        </p>
                        <p className="text-xs text-[#FAF6EF]/70 mt-1 leading-snug">
                          La fête de l&apos;Éternel approche — elle entre{" "}
                          {banniere.jalon.cle === "j24h" ? "demain soir" : `${banniere.jalon.label} avant l&apos;entrée`},
                          au coucher du soleil. Le shofar retentira dans la communauté.
                        </p>
                        <p className="text-[11px] text-[#C9A227]/80 mt-1.5 font-mono">
                          {new Date(banniere.evenement.entree).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}{" "}
                          · {heureJerusalem(banniere.evenement.entree)} Jérusalem / {heureLocale(banniere.evenement.entree)}{" "}
                          chez vous
                        </p>
                      </>
                    )
                  )}

                  {/* Indicateur son */}
                  {banniere.type === "sonnerie" && (
                    <p className="flex items-center gap-1.5 text-[10px] mt-2 font-semibold">
                      {prefs?.sound && audioDisponible ? (
                        <span className="inline-flex items-center gap-1 text-[#C9A227]">
                          <Volume2 className="w-3 h-3" /> Shofar sonné
                        </span>
                      ) : prefs?.sound && !audioDisponible ? (
                        <span className="inline-flex items-center gap-1 text-[#B5502F]">
                          <VolumeX className="w-3 h-3" /> Son bloqué par le navigateur — cliquez sur la page
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#FAF6EF]/50">
                          <VolumeX className="w-3 h-3" /> Son désactivé
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => {
                        setBanniere(null);
                        onOpenCalendar();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#2A0E3D] text-[11px] font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors"
                    >
                      <Sunset className="w-3.5 h-3.5" />
                      Voir le calendrier
                    </button>
                    <button
                      onClick={() => setBanniere(null)}
                      className="p-1.5 rounded-lg text-[#FAF6EF]/50 hover:text-[#FAF6EF] hover:bg-white/10 transition-colors"
                      title="Fermer"
                      aria-label="Fermer la notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
