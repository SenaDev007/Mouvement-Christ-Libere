"use client";

/**
 * ⭐ V3.6 — CALENDAR WORKSPACE (Yeshua Connect)
 * ============================================================================
 *
 * Le calendrier biblique INTÉGRÉ à la communauté : plus besoin de sortir
 * de Yeshua Connect pour consulter les fêtes de l'Éternel. S'ouvre en
 * plein écran par-dessus la conversation (même pattern que la Bible
 * intégrée V2.6) via le bouton calendrier du header du chat.
 *
 * Contenu :
 * 1. Bloc « Shofar & solennités » : prochaine sonnerie avec compte à
 *    rebours en direct, heure du coucher à Jérusalem ET en heure locale,
 *    préférences (son / notifications), écoute de l'annonce, annonce
 *    partageable dans la conversation active.
 * 2. Les vues du calendrier public : Aujourd'hui, Mois, Année, Fêtes,
 *    Équivalence — réutilisées à l'identique (données complètes 3 années).
 * 3. En-têtes de semaine enrichis des noms hébreux des jours (Vue
 *    Mensuelle + Vue Aujourd'hui — jour un יום ראשון … Shabbat שבת).
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ChevronRight, Clock, Grid3x3, Calendar as CalendarIcon,
  List, BookOpen, Sunset, Volume2, VolumeX, Bell, BellOff, Send, RefreshCw, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnneeBibliqueData } from "@/components/calendrier-biblique/calendrier-app";
import { VueAujourdhui } from "@/components/calendrier-biblique/vue-aujourdhui";
import { VueAnnuelle } from "@/components/calendrier-biblique/vue-annuelle";
import { VueMensuelle } from "@/components/calendrier-biblique/vue-mensuelle";
import { TimelineFetes } from "@/components/calendrier-biblique/timeline-fetes";
import { TableEquivalence } from "@/components/calendrier-biblique/table-equivalence";
import type { EvenementShofar } from "@/lib/calendrier/evenements-shofar";
import {
  jouerAnnonceShofar, armerAudioShofar,
} from "@/lib/shofar/shofar-audio";
import { lirePrefsShofar, ecrirePrefsShofar, type PrefsShofar } from "./ShofarNotifier";

// ─── Types locaux ──────────────────────────────────────────────────────────

type Vue = "aujourdhui" | "annuelle" | "mensuelle" | "timeline" | "equivalence";

const VUES: Array<{ id: Vue; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "aujourdhui", label: "Aujourd'hui", icon: Clock },
  { id: "mensuelle", label: "Mois", icon: CalendarIcon },
  { id: "annuelle", label: "Année", icon: Grid3x3 },
  { id: "timeline", label: "Fêtes", icon: List },
  { id: "equivalence", label: "Équivalence", icon: BookOpen },
];

interface DonneesCalendrier {
  maintenant: string;
  annees: AnneeBibliqueData[];
  evenements: EvenementShofar[];
}

interface CalendarWorkspaceProps {
  onClose: () => void;
  /** Partage une annonce (Shabbat / solennité) dans la conversation active. */
  onShareAnnonce: (texte: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function heureJerusalem(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function heureLocale(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formaterDuree(ms: number): { jours: number; heures: number; minutes: number; secondes: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    jours: Math.floor(total / 86400),
    heures: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    secondes: total % 60,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// ─── Composant ─────────────────────────────────────────────────────────────

export function CalendarWorkspace({ onClose, onShareAnnonce }: CalendarWorkspaceProps) {
  const [donnees, setDonnees] = useState<DonneesCalendrier | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vueActive, setVueActive] = useState<Vue>("aujourdhui");
  const [anneeIndex, setAnneeIndex] = useState(1);
  const [maintenantLive, setMaintenantLive] = useState(() => new Date());
  const [prefs, setPrefs] = useState<PrefsShofar>({ sound: true, notif: true });
  const [permissionNotif, setPermissionNotif] = useState<string>("default");
  const [audioBloque, setAudioBloque] = useState(false);
  const [annonceEnvoyee, setAnnonceEnvoyee] = useState(false);
  const [compteARebours, setCompteARebours] = useState({ jours: 0, heures: 0, minutes: 0, secondes: 0 });

  const annonceEnvoyeeRef = useRef(false);
  // Référence stable des événements (lue par l'horloge ci-dessous)
  const evenementsRef = useRef<EvenementShofar[]>([]);

  // ── Chargement des données complètes (3 années + événements) ───────────
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch("/api/calendrier-biblique/evenements?full=1", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as DonneesCalendrier;
      setDonnees(data);
      // Positionner l'index d'année : l'année contenant « aujourd'hui »
      setMaintenantLive(new Date(data.maintenant));
    } catch {
      setErreur("Impossible de charger le calendrier biblique. Vérifiez votre connexion puis réessayez.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // ── Préférences + permission notifications ─────────────────────────────
  useEffect(() => {
    setPrefs(lirePrefsShofar());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionNotif(Notification.permission);
    }
    // Armement audio au premier geste DANS le workspace (le chat arme déjà
    // globalement, mais l'utilisateur peut ouvrir le workspace d'abord)
    const armer = () => armerAudioShofar();
    window.addEventListener("pointerdown", armer, { once: true, capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", armer, { capture: true } as AddEventListenerOptions);
    };
  }, []);

  // ── Horloge live : 1 s pour le compte à rebours, 1 min pour la vue ─────
  useEffect(() => {
    const timer = setInterval(() => {
      const maintenant = new Date();
      setMaintenantLive(maintenant);
      const prochain = evenementsRef.current.find((e) => new Date(e.entree).getTime() > maintenant.getTime());
      if (prochain) {
        setCompteARebours(formaterDuree(new Date(prochain.entree).getTime() - maintenant.getTime()));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Données dérivées ────────────────────────────────────────────────────
  const annees = donnees?.annees ?? [];
  const annee = annees[Math.min(anneeIndex, Math.max(0, annees.length - 1))];

  const prochainsEvenements = useMemo(() => {
    const maintenant = Date.now();
    return (donnees?.evenements ?? []).filter((e) => new Date(e.entree).getTime() > maintenant).slice(0, 6);
  }, [donnees]);

  const prochainEvenement = prochainsEvenements[0] ?? null;

  // Positionner l'année courante quand les données arrivent + premier compte à rebours
  useEffect(() => {
    if (!donnees || donnees.annees.length === 0) return;
    evenementsRef.current = donnees.evenements;
    const aujourdhui = new Date(donnees.maintenant).getTime();
    const idx = donnees.annees.findIndex(
      (a) => new Date(a.debut).getTime() <= aujourdhui && new Date(a.fin).getTime() + 86400000 >= aujourdhui
    );
    setAnneeIndex(idx >= 0 ? idx : 1);
    const prochain = donnees.evenements.find((e) => new Date(e.entree).getTime() > Date.now());
    if (prochain) {
      setCompteARebours(formaterDuree(new Date(prochain.entree).getTime() - Date.now()));
    }
  }, [donnees]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const basculerPrefs = (maj: Partial<PrefsShofar>) => {
    const nouvelles = { ...prefs, ...maj };
    setPrefs(nouvelles);
    ecrirePrefsShofar(nouvelles);
  };

  const demanderPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    try {
      const resultat = await Notification.requestPermission();
      setPermissionNotif(resultat);
      if (resultat === "granted") basculerPrefs({ notif: true });
    } catch {
      /* refus silencieux */
    }
  };

  const ecouterAnnonce = () => {
    const ok = jouerAnnonceShofar();
    setAudioBloque(!ok);
  };

  const partagerAnnonce = () => {
    if (!prochainEvenement || annonceEnvoyeeRef.current) return;
    const e = prochainEvenement;
    const heureJer = heureJerusalem(e.entree);
    const heureLoc = heureLocale(e.entree);

    let texte: string;
    if (e.type === "shabbat") {
      texte =
        `📯 Shabbat Shalom !\n\n` +
        `Le Shabbat entre ${dateLongue(e.entree).toLowerCase()}, au coucher du soleil — ${heureJer} à Jérusalem (${heureLoc} heure locale).\n\n` +
        `« Souviens-toi du jour du sabbat, pour le sanctifier. » — Exode 20:8`;
    } else {
      texte =
        `📯 ${e.titre}${e.titreHebreu ? ` (${e.titreHebreu})` : ""}\n\n` +
        `La solennité de l'Éternel entre ${dateLongue(e.entree).toLowerCase()}, au coucher du soleil — ${heureJer} à Jérusalem (${heureLoc} heure locale).` +
        `${e.dateBiblique ? `\nDate biblique : ${e.dateBiblique}.` : ""}\n\n` +
        `« ${e.description?.split(".")[0]}. »\n${e.reference ?? "Lévitique 23"}\n\n` +
        `Le shofar retentira dans la communauté à l'entrée de la fête.`;
    }

    onShareAnnonce(texte);
    annonceEnvoyeeRef.current = true;
    setAnnonceEnvoyee(true);
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#FAF6EF] overflow-hidden" role="dialog" aria-label="Calendrier biblique">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="flex items-center gap-3 px-3 md:px-5 py-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Fermer le calendrier (Échap)"
            aria-label="Fermer le calendrier"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg md:text-xl font-bold leading-tight truncate">
              Calendrier biblique
            </h2>
            <p className="text-[10px] md:text-xs text-[#FAF6EF]/60 uppercase tracking-[0.14em] font-bold truncate">
              Fêtes de l'Éternel · 364 jours · Shofar au coucher du soleil
            </p>
          </div>
          {annees.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAnneeIndex((i) => Math.max(0, i - 1))}
                disabled={anneeIndex === 0}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Année précédente"
                aria-label="Année précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[#C9A227] tabular-nums whitespace-nowrap">
                {annee?.libelle ?? ""}
              </span>
              <button
                onClick={() => setAnneeIndex((i) => Math.min(annees.length - 1, i + 1))}
                disabled={anneeIndex === annees.length - 1}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Année suivante"
                aria-label="Année suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1 px-2 md:px-4 pb-2 overflow-x-auto scrollbar-thin">
          {VUES.map((vue) => {
            const Icon = vue.icon;
            const actif = vueActive === vue.id;
            return (
              <button
                key={vue.id}
                onClick={() => setVueActive(vue.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                  actif ? "bg-[#C9A227] text-[#2A0E3D] shadow-sm" : "text-[#FAF6EF]/70 hover:text-[#FAF6EF] hover:bg-white/10"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {vue.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Corps scrollable ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {chargement && (
          <div className="p-8 md:p-12 max-w-6xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-28 rounded-2xl bg-[#2A0E3D]/10" />
              <div className="h-64 rounded-2xl bg-[#2A0E3D]/5" />
              <div className="h-40 rounded-2xl bg-[#2A0E3D]/5" />
            </div>
          </div>
        )}

        {erreur && !chargement && (
          <div className="p-8 max-w-md mx-auto text-center">
            <p className="text-sm text-[#B5502F] mb-4">{erreur}</p>
            <button
              onClick={() => void charger()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-bold hover:bg-[#1E0F2B] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}

        {donnees && !chargement && (
          <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-5 md:space-y-6">
            {/* ══ Bloc SHOFAR & solennités ══════════════════════════════ */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-[#C9A227]/30 bg-[#2A0E3D] relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
              <div className="relative p-4 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sunset className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#C9A227] font-bold">
                    Prochaine sonnerie de shofar
                  </span>
                </div>

                {prochainEvenement ? (
                  <div className="grid md:grid-cols-[1fr_auto] gap-4 md:gap-8 items-start">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl md:text-2xl font-bold text-[#FAF6EF] leading-tight">
                        {prochainEvenement.type === "shabbat" ? "Shabbat" : prochainEvenement.titre}
                      </h3>
                      {prochainEvenement.titreHebreu && (
                        <p className="text-sm text-[#C9A227] font-serif mt-0.5" dir="rtl">
                          {prochainEvenement.titreHebreu}
                          {prochainEvenement.dateBiblique ? (
                            <span dir="ltr" className="text-[#FAF6EF]/60 not-italic ml-2 text-xs">
                              · {prochainEvenement.dateBiblique}
                            </span>
                          ) : null}
                        </p>
                      )}
                      <div className="mt-3 space-y-1.5">
                        <p className="flex items-center gap-2 text-xs text-[#FAF6EF]/75">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: prochainEvenement.couleur === "#2A0E3D" ? "#C9A227" : prochainEvenement.couleur }} />
                          Entrée {dateLongue(prochainEvenement.entree)}
                        </p>
                        <p className="flex items-center gap-2 text-xs text-[#FAF6EF]/75">
                          <MapPin className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                          Coucher du soleil : {heureJerusalem(prochainEvenement.entree)} à Jérusalem ·{" "}
                          {heureLocale(prochainEvenement.entree)} chez vous
                        </p>
                        {prochainEvenement.type === "fete" && prochainEvenement.jalons.length > 0 && (
                          <p className="flex items-center gap-2 text-xs text-[#FAF6EF]/75">
                            <Bell className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                            Rappels automatiques : 7 jours, 3 jours et 24 heures avant
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Compte à rebours */}
                    <div className="flex items-center gap-2 md:grid md:grid-cols-4 md:gap-1.5 md:justify-items-center">
                      <CaseCompte valeur={compteARebours.jours} label="jours" accent />
                      <CaseCompte valeur={compteARebours.heures} label="heures" />
                      <CaseCompte valeur={compteARebours.minutes} label="min" />
                      <CaseCompte valeur={compteARebours.secondes} label="sec" />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#FAF6EF]/60 italic">Aucune sonnerie à venir dans la fenêtre de calcul.</p>
                )}

                {/* Actions + préférences */}
                <div className="mt-4 pt-4 border-t border-[#C9A227]/20 flex flex-wrap items-center gap-2">
                  <button
                    onClick={ecouterAnnonce}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#C9A227] text-[#2A0E3D] text-xs font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors shadow-sm"
                    title="Écouter la séquence complète (Tekiah, Shevarim, Teruah, Tekiah Gedolah)"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Écouter l&apos;annonce du shofar
                  </button>

                  {prochainEvenement && (
                    <button
                      onClick={partagerAnnonce}
                      disabled={annonceEnvoyee}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#C9A227]/40 text-[#FAF6EF] text-xs font-bold hover:bg-[#C9A227]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Partager l'annonce dans la conversation active"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {annonceEnvoyee ? "Annonce partagée" : "Annoncer dans le chat"}
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Toggle son */}
                    <button
                      onClick={() => basculerPrefs({ sound: !prefs.sound })}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border",
                        prefs.sound
                          ? "bg-[#C9A227]/15 border-[#C9A227]/40 text-[#C9A227]"
                          : "bg-white/5 border-white/10 text-[#FAF6EF]/50"
                      )}
                      title="Le shofar retentit-il à l'entrée du Shabbat et des fêtes ?"
                    >
                      {prefs.sound ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                      Shofar {prefs.sound ? "activé" : "désactivé"}
                    </button>

                    {/* Toggle notifications */}
                    <button
                      onClick={() => {
                        if (!prefs.notif && permissionNotif !== "granted") {
                          void demanderPermission();
                        } else {
                          basculerPrefs({ notif: !prefs.notif });
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border",
                        prefs.notif
                          ? "bg-[#C9A227]/15 border-[#C9A227]/40 text-[#C9A227]"
                          : "bg-white/5 border-white/10 text-[#FAF6EF]/50"
                      )}
                      title="Notifications à 7 jours, 3 jours, 24 heures et à l'entrée"
                    >
                      {prefs.notif ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                      Notifs {prefs.notif ? "activées" : "désactivées"}
                    </button>
                  </div>
                </div>

                {/* Aides contextuelles */}
                {audioBloque && (
                  <p className="mt-3 text-[11px] text-[#E8B04B] bg-[#B5502F]/15 border border-[#B5502F]/30 rounded-lg px-3 py-2">
                    Le navigateur bloque le son : cliquez d&apos;abord n&apos;importe où sur la page, puis réessayez.
                  </p>
                )}
                {permissionNotif !== "granted" && (
                  <p className="mt-3 text-[11px] text-[#FAF6EF]/60 leading-snug">
                    {permissionNotif === "denied" ? (
                      <>Notifications système bloquées dans les réglages du navigateur — les rappels 7 j / 3 j / 24 h
                      resteront visibles dans la communauté sous forme de bannières.</>
                    ) : (
                      <>
                        Activez le bouton « Notifs » pour recevoir les rappels système à 7 jours, 3 jours et 24 heures
                        de chaque solennité — même hors de l&apos;application grâce aux notifications push.
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* ══ Prochaines sonneries ══════════════════════════════════ */}
            {prochainsEvenements.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-4 md:p-5">
                <h4 className="font-serif text-sm font-bold text-[#1E0F2B] mb-3 flex items-center gap-2">
                  <Sunset className="w-4 h-4 text-[#C9A227]" />
                  Les prochaines sonneries
                </h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {prochainsEvenements.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-[#FAF6EF]/60 border border-[#8A8378]/10"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[#FAF6EF] text-sm"
                        style={{ backgroundColor: e.couleur }}
                      >
                        {e.type === "shabbat" ? "🕯️" : "📯"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1E0F2B] truncate">
                          {e.type === "shabbat" ? "Shabbat" : e.titre}
                        </p>
                        <p className="text-[10px] text-[#8A8378] truncate">
                          {new Date(e.entree).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {heureLocale(e.entree)}
                          {" · "}
                          <span className="text-[#C9A227]">{heureJerusalem(e.entree)} Jér.</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ Vues du calendrier ════════════════════════════════════ */}
            {annee && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={vueActive}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {vueActive === "aujourdhui" && <VueAujourdhui annee={annee} maintenant={maintenantLive} />}
                  {vueActive === "annuelle" && <VueAnnuelle annee={annee} />}
                  {vueActive === "mensuelle" && <VueMensuelle annee={annee} />}
                  {vueActive === "timeline" && <TimelineFetes fetes={annee.fetes} />}
                  {vueActive === "equivalence" && <TableEquivalence annee={annee} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants ───────────────────────────────────────────────────────

function CaseCompte({ valeur, label, accent }: { valeur: number; label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "text-center px-2.5 py-2 rounded-xl border backdrop-blur-sm min-w-[3.5rem]",
        accent ? "bg-[#C9A227]/15 border-[#C9A227]/40" : "bg-white/5 border-white/10"
      )}
    >
      <div className={cn("font-serif text-xl md:text-2xl font-bold tabular-nums", accent ? "text-[#C9A227]" : "text-[#FAF6EF]")}>
        {pad(valeur)}
      </div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#FAF6EF]/50 font-bold">{label}</div>
    </div>
  );
}
