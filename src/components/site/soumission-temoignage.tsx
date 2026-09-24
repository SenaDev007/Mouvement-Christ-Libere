"use client";

/**
 * ⭐ V3.100 — SOUMISSION DE TÉMOIGNAGE « VIE TRANSFORMÉE ».
 *
 * Demande du pasteur : offrir aux croyants le moyen de SOUMETTRE leur
 * avis / leur témoignage depuis le site public, en DEUX modales :
 *
 *   Modale 1 — VOUS PERSONNELLEMENT : nom, email, téléphone, pays,
 *   ville (le moyen d'être recontacté — jamais publié).
 *
 *   Modale 2 — VOTRE TÉMOIGNAGE (volet professionnel) : titre,
 *   catégorie, profession, église, récit complet, consentement à la
 *   relecture pastorale.
 *
 * Le témoignage arrive dans le back-office (/admin/vie-transformee)
 * en statut « en_attente » : un SUPER ADMIN le relit puis le valide
 * (publication sur la landing + /vie-transformee) ou le rejette avec
 * note. RIEN n'est publié sans validation.
 *
 * Style Win Agro (palette Christ Libère) : overlay violet nuit, carte
 * ivoire rounded-3xl bordure or, titres serif, bouton or btn-shimmer.
 */

import { useState, useEffect, useCallback } from "react";
import {
  User, Church, Heart, Sparkles, ArrowRight, ArrowLeft, X,
  Loader2, CheckCircle2, Send, Mail, Phone, MapPin, Briefcase,
} from "lucide-react";

/* ── Catégories proposées ── */
const CATEGORIES: { id: string; label: string }[] = [
  { id: "vie_transformee", label: "Vie transformée" },
  { id: "guerison", label: "Guérison" },
  { id: "delivrance", label: "Délivrance" },
  { id: "restauration", label: "Foyer restauré" },
  { id: "providence", label: "Providence" },
  { id: "appel", label: "Appel & consécration" },
  { id: "action_graces", label: "Action de grâces" },
];

const CONTENU_MAX = 6000;

interface Champs {
  nom: string;
  email: string;
  telephone: string;
  pays: string;
  ville: string;
  profession: string;
  eglise: string;
  categorie: string;
  titre: string;
  contenu: string;
  consentement: boolean;
  siteWeb: string; // honeypot anti-robots (invisible)
}

const CHAMPS_VIERGES: Champs = {
  nom: "",
  email: "",
  telephone: "",
  pays: "",
  ville: "",
  profession: "",
  eglise: "",
  categorie: "vie_transformee",
  titre: "",
  contenu: "",
  consentement: false,
  siteWeb: "",
};

/* ── Champ réutilisable ── */
function Champ({
  label, valeur, onChange, type = "text", placeholder, obligatoire,
  icone: Icone, indice, maxLength = 120,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  obligatoire?: boolean;
  icone?: typeof User;
  indice?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-deep mb-1.5">
        {Icone && <Icone className="w-3.5 h-3.5 text-accent-dark shrink-0" />}
        {label}
        {obligatoire && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={obligatoire}
        className="w-full px-4 py-2.5 rounded-xl border border-primary-green/25 bg-white text-sm text-primary-deep placeholder:text-gray-text/50 focus:outline-none focus:border-accent-yellow focus:ring-2 focus:ring-accent-yellow/25 transition-all"
      />
      {indice && <span className="block text-[11px] text-gray-text mt-1 italic">{indice}</span>}
    </label>
  );
}

export function SoumissionTemoignage({
  variante = "or",
  libelle = "Partager votre témoignage",
}: {
  variante?: "or" | "contour";
  libelle?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<1 | 2 | 3>(1); // 1 personnel · 2 témoignage · 3 succès
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIERGES);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  /* Fermeture : Échap */
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [ouvert]);

  const maj = useCallback(
    (cle: keyof Champs, valeur: string | boolean) =>
      setChamps((c) => ({ ...c, [cle]: valeur } as Champs)),
    []
  );

  const fermer = () => {
    setOuvert(false);
    setEtape(1);
    setErreur("");
    setChamps(CHAMPS_VIERGES);
    setEnvoi(false);
  };

  /* Étape 1 → 2 : validation des informations personnelles */
  const versEtape2 = () => {
    if (champs.nom.trim().length < 2) {
      setErreur("Indiquez votre nom complet.");
      return;
    }
    if (champs.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(champs.email.trim())) {
      setErreur("L'adresse email n'est pas valide.");
      return;
    }
    setErreur("");
    setEtape(2);
  };

  /* Envoi final */
  const envoyer = async () => {
    if (champs.titre.trim().length < 3) {
      setErreur("Donnez un titre à votre témoignage.");
      return;
    }
    if (champs.contenu.trim().length < 30) {
      setErreur("Racontez votre témoignage en au moins 30 caractères.");
      return;
    }
    if (!champs.consentement) {
      setErreur("Veuillez accepter la relecture pastorale avant l'envoi.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      const res = await fetch("/api/temoignages-croyants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...champs }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erreur");
      setEtape(3);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  };

  /* ── Bouton d'ouverture ── */
  const boutonOuverture =
    variante === "or" ? (
      <button
        onClick={() => setOuvert(true)}
        className="px-6 py-3 rounded-full bg-accent-yellow text-primary-deep font-sans font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 inline-flex items-center gap-2 cursor-pointer btn-shimmer"
      >
        <Send className="w-3.5 h-3.5" /> {libelle}
      </button>
    ) : (
      <button
        onClick={() => setOuvert(true)}
        className="px-6 py-3 rounded-full border-2 border-primary-green text-primary-deep font-sans font-bold text-xs hover:bg-primary-green/10 transition-all transform hover:-translate-y-0.5 inline-flex items-center gap-2 cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" /> {libelle}
      </button>
    );

  return (
    <>
      {boutonOuverture}

      {ouvert && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1A0826]/80 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && fermer()}
          role="dialog"
          aria-modal="true"
          aria-label="Partager votre témoignage"
        >
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-cream rounded-3xl border-2 border-accent-yellow/40 shadow-2xl card-shimmer">
            {/* Texture grain Win Agro */}
            <div className="absolute inset-0 bg-grain opacity-[0.04] pointer-events-none rounded-3xl" />

            {/* En-tête : progression + fermeture */}
            <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm border-b border-primary-pale/60 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      etape >= n ? "w-8 bg-accent-yellow" : "w-4 bg-primary-pale"
                    }`}
                  />
                ))}
                <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-gray-text">
                  {etape === 1 && "Étape 1 sur 2 · Vous"}
                  {etape === 2 && "Étape 2 sur 2 · Votre témoignage"}
                  {etape === 3 && "Reçu"}
                </span>
              </div>
              <button
                onClick={fermer}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-text hover:bg-primary-pale hover:text-primary-deep transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative px-6 py-6">
              {/* ══════ MODALE 1 — VOUS PERSONNELLEMENT ══════ */}
              {etape === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-[10px] font-bold uppercase tracking-wider mb-3">
                      <User className="w-3 h-3" /> Informations personnelles
                    </p>
                    <h3 className="font-serif text-2xl font-extrabold text-primary-deep leading-snug">
                      Dites-nous qui vous êtes.
                    </h3>
                    <p className="text-sm text-gray-text mt-2 leading-relaxed">
                      Ces informations servent uniquement à la relecture pastorale —
                      votre email et votre téléphone ne seront <strong>jamais publiés</strong>.
                    </p>
                  </div>

                  <Champ icone={User} label="Nom complet" obligatoire valeur={champs.nom}
                    onChange={(v) => maj("nom", v)} placeholder="Ex. Marie K." maxLength={80} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Champ icone={Mail} label="Email" type="email" valeur={champs.email}
                      onChange={(v) => maj("email", v)} placeholder="vous@exemple.com"
                      indice="Pour être recontacté" maxLength={120} />
                    <Champ icone={Phone} label="Téléphone" type="tel" valeur={champs.telephone}
                      onChange={(v) => maj("telephone", v)} placeholder="+229 …"
                      indice="Facultatif" maxLength={30} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Champ icone={MapPin} label="Pays" valeur={champs.pays}
                      onChange={(v) => maj("pays", v)} placeholder="Ex. Bénin" maxLength={60} />
                    <Champ icone={MapPin} label="Ville" valeur={champs.ville}
                      onChange={(v) => maj("ville", v)} placeholder="Ex. Cotonou" maxLength={60} />
                  </div>

                  {erreur && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{erreur}</p>
                  )}

                  <button
                    onClick={versEtape2}
                    className="w-full py-3.5 rounded-full bg-primary-green hover:bg-accent-dark text-[#1E0F2B] font-sans font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2 cursor-pointer btn-shimmer"
                  >
                    Continuer vers le témoignage <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ══════ MODALE 2 — VOTRE TÉMOIGNAGE ══════ */}
              {etape === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-[10px] font-bold uppercase tracking-wider mb-3">
                      <Church className="w-3 h-3" /> Votre témoignage
                    </p>
                    <h3 className="font-serif text-2xl font-extrabold text-primary-deep leading-snug">
                      Racontez ce que Dieu a fait.
                    </h3>
                  </div>

                  <Champ icone={Sparkles} label="Titre de votre témoignage" obligatoire
                    valeur={champs.titre} onChange={(v) => maj("titre", v)}
                    placeholder="Ex. Délivré après dix ans de ténèbres" maxLength={120} />

                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-deep mb-1.5">
                      <Heart className="w-3.5 h-3.5 text-accent-dark shrink-0" /> Catégorie
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => maj("categorie", c.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            champs.categorie === c.id
                              ? "bg-primary-deep text-accent-yellow border border-accent-yellow/50"
                              : "bg-white text-gray-text border border-primary-pale hover:border-accent-yellow/50 hover:text-primary-deep"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Champ icone={Briefcase} label="Profession" valeur={champs.profession}
                      onChange={(v) => maj("profession", v)} placeholder="Ex. Enseignante"
                      indice="Facultatif" maxLength={80} />
                    <Champ icone={Church} label="Église locale" valeur={champs.eglise}
                      onChange={(v) => maj("eglise", v)} placeholder="Ex. Assemblée de…"
                      indice="Facultatif" maxLength={120} />
                  </div>

                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-deep mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent-dark shrink-0" /> Votre récit <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={champs.contenu}
                      onChange={(e) => maj("contenu", e.target.value)}
                      placeholder="Ce que le Seigneur a fait dans votre vie, comment vous l'avez rencontré, ce qui a changé…"
                      rows={6}
                      maxLength={CONTENU_MAX}
                      className="w-full px-4 py-3 rounded-xl border border-primary-green/25 bg-white text-sm text-primary-deep placeholder:text-gray-text/50 focus:outline-none focus:border-accent-yellow focus:ring-2 focus:ring-accent-yellow/25 transition-all resize-y"
                    />
                    <div className="flex justify-between text-[11px] text-gray-text mt-1">
                      <span>Minimum 30 caractères.</span>
                      <span className={champs.contenu.length > CONTENU_MAX - 200 ? "text-red-500 font-bold" : ""}>
                        {champs.contenu.length} / {CONTENU_MAX}
                      </span>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={champs.consentement}
                      onChange={(e) => maj("consentement", e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#C9A227] shrink-0"
                    />
                    <span className="text-xs text-gray-text leading-relaxed">
                      J&apos;accepte que mon témoignage soit <strong>relu par l&apos;équipe
                      pastorale</strong> avant publication sur le site du Mouvement Christ
                      Libère. Je confirme que ce récit est vrai et personnel.
                    </span>
                  </label>

                  {/* Honeypot anti-robots — invisible pour l'humain */}
                  <input
                    type="text"
                    value={champs.siteWeb}
                    onChange={(e) => maj("siteWeb", e.target.value)}
                    name="siteWeb"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute left-[-9999px] w-0 h-0 opacity-0"
                  />

                  {erreur && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{erreur}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setEtape(1); setErreur(""); }}
                      className="px-5 py-3 rounded-full border border-primary-green/30 text-gray-text font-sans font-bold text-xs hover:bg-primary-pale transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Retour
                    </button>
                    <button
                      onClick={envoyer}
                      disabled={envoi}
                      className="flex-1 py-3.5 rounded-full bg-accent-yellow hover:bg-[#B8921F] text-primary-deep font-sans font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2 cursor-pointer btn-shimmer disabled:opacity-60 disabled:cursor-wait"
                    >
                      {envoi ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                      ) : (
                        <><Send className="w-4 h-4" /> Envoyer pour validation</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ══════ ÉTAPE 3 — CONFIRMATION ══════ */}
              {etape === 3 && (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-20 h-20 rounded-full bg-accent-yellow/15 flex items-center justify-center animate-pulse-slow">
                    <CheckCircle2 className="w-10 h-10 text-accent-dark" />
                  </div>
                  <h3 className="font-serif text-2xl font-extrabold text-primary-deep">
                    Merci pour votre témoignage !
                  </h3>
                  <p className="text-sm text-gray-text leading-relaxed max-w-sm mx-auto">
                    L&apos;équipe pastorale va le relire attentivement. Une fois validé,
                    il apparaîtra dans la section <strong>« Vies transformées »</strong> du
                    site — pour l&apos;édification de toute la communauté.
                  </p>
                  <button
                    onClick={fermer}
                    className="px-8 py-3 rounded-full bg-primary-green hover:bg-accent-dark text-[#1E0F2B] font-sans font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer btn-shimmer"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
