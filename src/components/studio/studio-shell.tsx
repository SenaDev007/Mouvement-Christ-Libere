"use client";

/**
 * ⭐ V3.89 → V3.90 — MCL CREATIVE STUDIO : coquille UI partagée.
 *
 * Le MÊME composant sert le back-office (super admins) et le secrétariat
 * (directive : « le back-office, le super admin ainsi que le secrétariat
 * vont partager ce même composant Studio Design »). Toute la logique est
 * pilotée par `apiBase` :
 *   · /admin/api/studio/…       (back-office) ;
 *   · /secretariat/api/studio/… (secrétariat).
 *
 * Onglets (spec §4) : Créer · Mes créations · Templates · Fonds · Photos.
 * Desktop : paramètres à gauche + aperçu à droite ; mobile : vertical (§42).
 *
 * ⭐ V3.90 (directives du pasteur) :
 *   · BROUILLON AUTO-SAUVEGARDÉ + bouton « Sauvegarder » — le travail en
 *     cours survit à un rafraîchissement, une fermeture d'onglet, une
 *     coupure de courant (localStorage, débounced 800 ms) ;
 *   · INTERVENANTS LIBRES — noms éditables (pas de noms figés), autant
 *     de noms que voulu, une photo par personne ;
 *   · UPLOAD DIRECT avec ROGNAGE façon Canva (glisser, zoom, rotation,
 *     ratios 3:4 / 1:1 / 4:3) + DÉTOURAGE automatique à l'import ;
 *   · IA NVIDIA (build.nvidia.com) : « Peaufiner la photo » (FLUX.1
 *     Kontext — éclairage studio, identité conservée) et génération de
 *     fonds (FLUX.1) à la palette du ministère.
 *
 * ⭐ V3.91 (directives du pasteur — round 3) :
 *   · BUG « Unexpected token '<' » CORRIGÉ — tout fetch passe par
 *     lireJsonSur() : une page HTML (intermédiaire réseau) devient un
 *     message pastoral, JAMAIS un crash de parsing ;
 *   · DIRECTEUR IA (gpt-oss-20b) — décrire le visuel en français comme
 *     dans ChatGPT : spécification (prompt FLUX + palette LIBRE +
 *     ambiance + suggestions) → fond généré + palette appliquée, avec
 *     SYSTÈME D'ITÉRATION (« corrige telle chose » jusqu'au rendu final) ;
 *   · PALETTE DE COULEURS LIBRE — plus de palette figée : 3 sélecteurs
 *     (accent / texte / fond) + la palette du Directeur IA ;
 *   · SYSTÈME DE CALQUES — ordre de superposition réglable (↑↓),
 *     masquage (œil), décalage fin par calque (±) — aperçu en direct ;
 *   · MODALS DE CONFIRMATION PERSONNALISÉES — icône, couleurs, message
 *     et libellés propres à chaque action (plus jamais confirm() générique).
 *
 * ⭐ V3.92 (directive du pasteur — round 4) :
 *   · FINI LE DÉFILEMENT VERTICAL INTERMINABLE — le panneau de gauche ne
 *     garde que le contenu (titre, intervenants, Directeur IA) ;
 *   · RÉGLAGES EN BOUTONS façon Photoshop — toutes les sections à partir
 *     de « Style & palette » (Template, Fond, Événement, Calques, Formats)
 *     deviennent des BOUTONS COMPACTS alignés juste sous « Générer le
 *     visuel », avec le réglage en cours affiché sur chaque bouton ;
 *   · CLIC sur un bouton → la section s'ouvre en MODAL (réglages en direct,
 *     fermeture par ✕ / Échap / clic extérieur / « Terminer »).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Wand2,
  Images,
  LayoutTemplate,
  ImageIcon,
  Users,
  Loader2,
  AlertCircle,
  Download,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Upload,
  Plus,
  Film,
  X,
  Save,
  FilePlus2,
  CheckCircle2,
  UserRound,
  Layers,
  ArrowDown,
  ArrowUp,
  Palette,
  RotateCcw,
  MessageSquareText,
  CalendarDays,
  Frame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CleCalque,
  CleFormat,
  CleVariante,
  DecalageCalque,
  PalettePerso,
  TypeVisuel,
} from "@/lib/visual-generator/types";
import { FORMATS, ORDRE_CALQUES_DEFAUT } from "@/lib/visual-generator/types";
import {
  ZoneToasts,
  afficherToast,
  ModalRogner,
  ModalSection,
  lireJsonSur,
  useConfirmation,
} from "./studio-ui";

// ─── Types client ──────────────────────────────────────────────────────

interface StyleStudioClient {
  key: string;
  label: string;
  ambiance: string;
}

interface TemplateStudio {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  styleKey: string;
  isActive: boolean;
}

interface FondStudio {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
}

interface PhotoIntervenant {
  id: string;
  speakerName: string;
  originalUrl: string;
  cutoutUrl: string | null;
  thumbnailUrl: string | null;
  isProcessed: boolean;
}

interface CreationStudio {
  id: string;
  visualType: string;
  videoId: string | null;
  titleText: string;
  subtitleText: string | null;
  variant: string;
  status: string;
  outputUrls: Record<string, string>;
  createdAt: string;
}

/** ⭐ V3.90 — un intervenant SAISI LIBREMENT : nom éditable + sa photo. */
interface IntervenantSaisi {
  nom: string;
  photoId: string;
}

/** ⭐ V3.90 — brouillon auto-sauvegardé (localStorage). */
interface BrouillonStudio {
  sauveA: string;
  typeVisuel: TypeVisuel;
  titre: string;
  accroche: string;
  intervenants: IntervenantSaisi[];
  fondId: string;
  style: string;
  templateId: string;
  formatsChoisis: CleFormat[];
  dateEvenement: string;
  heureEvenement: string;
  lieuEvenement: string;
  verset: string;
  videoId: string;
  /** ⭐ V3.91 — palette libre + calques + itération Directeur IA. */
  palettePerso?: PalettePerso | null;
  calques?: {
    ordre?: CleCalque[];
    masques?: CleCalque[];
    decalages?: Partial<Record<CleCalque, DecalageCalque>>;
  } | null;
}

/** ⭐ V3.91 — spécification renvoyée par le Directeur IA (miroir client). */
interface SpecDirecteurClient {
  prompt_flux: string;
  palette: PalettePerso;
  ambiance: string;
  suggestion_titre?: string;
  suggestion_accroche?: string;
}

/** Messages du Directeur IA (itération — « corrige telle chose »). */
interface MessageDirecteur {
  role: "user" | "assistant";
  content: string;
}

type Onglet = "creer" | "creations" | "templates" | "fonds" | "photos";

/** ⭐ V3.92 — sections de réglage ouvrables en modal (façon Photoshop). */
type SectionOuverte =
  | "style"
  | "template"
  | "fond"
  | "evenement"
  | "calques"
  | "formats";

export interface StudioShellProps {
  /** Base des routes API — détermine l'espace (admin ou secrétariat). */
  apiBase: string;
  /** Espace d'affichage (textes d'aide). */
  espace: "admin" | "secretariat";
}

const VARIANTES: CleVariante[] = ["A", "B", "C", "D"];

/** Clé localStorage du brouillon (commune aux deux espaces — même base). */
const CLE_BROUILLON = "mcl-studio-brouillon-v3";

/** Suggestions de consignes pour les fonds générés par l'IA. */
const PRESETS_FOND_IA = [
  "flammes dans la nuit",
  "lumière dorée traversant la poussière",
  "ciel orageux percé de lumière",
  "croix lumineuse dans l'obscurité",
  "nuages dorés au coucher du soleil",
  "texture noir et or abstraite",
];

/** ⭐ V3.91 — descriptions d'exemple pour le Directeur IA (le pasteur voit
 * tout de suite le niveau de détail attendu, comme dans ChatGPT). */
const EXEMPLES_DIRECTEUR = [
  "Affiche pour une nuit de prière de feu le 21 septembre à Cotonou : ambiance royale, fond violet profond avec des rayons dorés, croix lumineuse à l'arrière-plan",
  "Miniature pour un enseignement sur la puissance de la résurrection : bleu profond océanique, lumière percant l'obscurité, ambiance solennelle et puissante",
  "Affiche de conférence « Femmes de foi » : bordeaux élégant, roses dorées stylisées, lumière douce et chaleureuse",
];

/** ⭐ V3.91 — libellés des calques (langage du studio, pas technique). */
const LIBELLES_CALQUES: Record<CleCalque, string> = {
  fond: "Fond (image ou style)",
  voile: "Voile de lisibilité",
  sujet: "Photos des intervenants",
  titre: "Titre",
  sousTitre: "Noms des intervenants",
  evenement: "Date, heure & lieu",
  verset: "Verset biblique",
  logo: "Logo Christ Libère",
};

/** Préréglages de palettes libres (point de départ modifiable). */
const PRESETS_PALETTE: Array<{ nom: string; palette: PalettePerso }> = [
  { nom: "Or royal", palette: { accent: "#C9A227", secondary: "#FAF6EF", background: "#141009" } },
  { nom: "Feu", palette: { accent: "#FF6A00", secondary: "#FFFFFF", background: "#0A0A0C" } },
  { nom: "Pourpre", palette: { accent: "#8C5FA8", secondary: "#EDE6F2", background: "#1A0826" } },
  { nom: "Émeraude", palette: { accent: "#2E9E6B", secondary: "#EAF5EE", background: "#08251A" } },
  { nom: "Océan", palette: { accent: "#2F7FBF", secondary: "#E8F1F8", background: "#0A1B2E" } },
  { nom: "Bordeaux", palette: { accent: "#A83A50", secondary: "#F8E8EC", background: "#26060D" } },
];

const MOTIF_COULEUR = /^#[0-9a-fA-F]{6}$/;

// ─── Composant principal ──────────────────────────────────────────────

export function StudioShell({ apiBase, espace }: StudioShellProps) {
  const [onglet, setOnglet] = useState<Onglet>("creer");

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B] flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#B3261E] text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            Studio Créatif
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Miniatures vidéo et affiches du Mouvement Christ Libère — sans
            Canva, sans Photoshop : l&apos;identité visuelle est respectée
            automatiquement.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 overflow-x-auto scrollbar-discrete pb-1">
        {(
          [
            { v: "creer", l: "Créer", icone: Wand2 },
            { v: "creations", l: "Mes créations", icone: Images },
            { v: "templates", l: "Templates", icone: LayoutTemplate },
            { v: "fonds", l: "Fonds", icone: ImageIcon },
            { v: "photos", l: "Photos des intervenants", icone: Users },
          ] as const
        ).map((o) => {
          const Icone = o.icone;
          return (
            <button
              key={o.v}
              onClick={() => setOnglet(o.v)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                onglet === o.v
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "bg-white border border-[#8A8378]/15 text-[#8A8378] hover:bg-[#FAF6EF]"
              )}
            >
              <Icone className="w-4 h-4" />
              {o.l}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {onglet === "creer" && <OngletCreer apiBase={apiBase} espace={espace} />}
      {onglet === "creations" && <OngletCreations apiBase={apiBase} />}
      {onglet === "templates" && <OngletTemplates apiBase={apiBase} />}
      {onglet === "fonds" && <OngletFonds apiBase={apiBase} />}
      {onglet === "photos" && <OngletPhotos apiBase={apiBase} />}

      {/* Toasts (montés UNE fois). */}
      <ZoneToasts />
    </div>
  );
}

// ─── Onglet CRÉER (formulaire + brouillon + aperçu live + génération) ──

function OngletCreer({ apiBase, espace }: { apiBase: string; espace: string }) {
  // Données de référence.
  const [styles, setStyles] = useState<StyleStudioClient[]>([]);
  const [templates, setTemplates] = useState<TemplateStudio[]>([]);
  const [fonds, setFonds] = useState<FondStudio[]>([]);
  const [photos, setPhotos] = useState<PhotoIntervenant[]>([]);
  const [iaActive, setIaActive] = useState(false);

  // Paramètres de la création (§6).
  const [typeVisuel, setTypeVisuel] = useState<TypeVisuel>("miniature");
  const [titre, setTitre] = useState("");
  const [accroche, setAccroche] = useState("");
  // ⭐ V3.90 — intervenants LIBRES : noms éditables, illimités, une photo
  // par personne (le moteur les dessine côte à côte).
  const [intervenants, setIntervenants] = useState<IntervenantSaisi[]>([
    { nom: "Pasteur Kongo", photoId: "" },
  ]);
  const [fondId, setFondId] = useState("");
  const [style, setStyle] = useState("noir-or");
  const [templateId, setTemplateId] = useState("");
  const [formatsChoisis, setFormatsChoisis] = useState<CleFormat[]>(["youtube", "square", "reels"]);
  // Affiche.
  const [dateEvenement, setDateEvenement] = useState("");
  const [heureEvenement, setHeureEvenement] = useState("");
  const [lieuEvenement, setLieuEvenement] = useState("");
  const [verset, setVerset] = useState("");

  // Association vidéo (depuis le module Vidéos → « Créer une miniature »).
  const [videoId, setVideoId] = useState<string>("");

  // Aperçu.
  const [apercuUrl, setApercuUrl] = useState<string>("");
  const [apercuFormat, setApercuFormat] = useState<CleFormat>("youtube");
  const [apercuVariante, setApercuVariante] = useState<CleVariante>("A");
  const [apercuCharge, setApercuCharge] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [resultats, setResultats] = useState<CreationStudio[]>([]);
  const [erreur, setErreur] = useState("");

  // ⭐ V3.90 — IA NVIDIA.
  const [iaPhotoOccupee, setIaPhotoOccupee] = useState("");
  const [fondIAPrompt, setFondIAPrompt] = useState("");
  const [fondIAOccupe, setFondIAOccupe] = useState(false);

  // ⭐ V3.91 — confirmations PERSONNALISÉES (plus jamais confirm()).
  const confirmation = useConfirmation();

  // ⭐ V3.91 — palette LIBRE (accent / texte / fond).
  const [palettePerso, setPalettePerso] = useState<PalettePerso | null>(null);

  // ⭐ V3.91 — DIRECTEUR IA (gpt-oss-20b) : description française →
  // spécification (prompt FLUX + palette + ambiance), avec ITÉRATIONS.
  const [directeurDescription, setDirecteurDescription] = useState("");
  const [directeurOccupe, setDirecteurOccupe] = useState(false);
  const [directeurSpec, setDirecteurSpec] = useState<SpecDirecteurClient | null>(null);
  const [directeurHistorique, setDirecteurHistorique] = useState<MessageDirecteur[]>([]);
  const [directeurCorrection, setDirecteurCorrection] = useState("");
  const [directeurFondEnCours, setDirecteurFondEnCours] = useState(false);
  const [promptFluxVisible, setPromptFluxVisible] = useState(false);

  // ⭐ V3.91 — CALQUES : ordre, masques, décalages (aperçu en direct).
  const [ordreCalques, setOrdreCalques] = useState<CleCalque[]>(ORDRE_CALQUES_DEFAUT);
  const [calquesMasques, setCalquesMasques] = useState<CleCalque[]>([]);
  const [decalagesCalques, setDecalagesCalques] = useState<
    Partial<Record<CleCalque, DecalageCalque>>
  >({});

  // ⭐ V3.92 — section de réglage ouverte en modal (façon Photoshop).
  const [sectionOuverte, setSectionOuverte] = useState<SectionOuverte | null>(null);

  /** Réglages calques sérialisables (aperçu + génération + brouillon). */
  const reglagesCalques = useMemo(() => {
    const ordreIdentique =
      JSON.stringify(ordreCalques) === JSON.stringify(ORDRE_CALQUES_DEFAUT);
    const quelconque =
      !ordreIdentique || calquesMasques.length > 0 || Object.keys(decalagesCalques).length > 0;
    if (!quelconque) return undefined;
    return {
      ordre: ordreIdentique ? undefined : ordreCalques,
      masques: calquesMasques.length ? calquesMasques : undefined,
      decalages: Object.keys(decalagesCalques).length ? decalagesCalques : undefined,
    };
  }, [ordreCalques, calquesMasques, decalagesCalques]);

  /** Déplacer un calque dans la pile (monter / descendre d'un rang). */
  const deplacerCalque = useCallback((cle: CleCalque, sens: 1 | -1) => {
    setOrdreCalques((ordre) => {
      const i = ordre.indexOf(cle);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= ordre.length) return ordre;
      const copie = [...ordre];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });
  }, []);

  /** Basculer la visibilité d'un calque (œil). */
  const basculerCalque = useCallback((cle: CleCalque) => {
    setCalquesMasques((masques) =>
      masques.includes(cle) ? masques.filter((c) => c !== cle) : [...masques, cle]
    );
  }, []);

  /** Décaler finement un calque (± 2 % par clic — borné ± 30 %). */
  const decalerCalque = useCallback((cle: CleCalque, dx: number, dy: number) => {
    setDecalagesCalques((decalages) => {
      const actuel = decalages[cle] || { x: 0, y: 0 };
      const borne = (v: number) => Math.max(-0.3, Math.min(0.3, Math.round(v * 100) / 100));
      const suivant = {
        x: borne(actuel.x + dx),
        y: borne(actuel.y + dy),
      };
      if (Math.abs(suivant.x) < 0.0001 && Math.abs(suivant.y) < 0.0001) {
        const copie = { ...decalages };
        delete copie[cle];
        return copie;
      }
      return { ...decalages, [cle]: suivant };
    });
  }, []);

  /** Réinitialiser TOUS les réglages de calques. */
  const reinitialiserCalques = useCallback(() => {
    setOrdreCalques(ORDRE_CALQUES_DEFAUT);
    setCalquesMasques([]);
    setDecalagesCalques({});
  }, []);

  // ⭐ V3.90 — upload direct + rognage.
  const refFichier = useRef<HTMLInputElement>(null);
  const [uploadPour, setUploadPour] = useState(0);
  const [rogner, setRogner] = useState<{ fichier: File; index: number } | null>(null);

  // ⭐ V3.90 — brouillon.
  const [pret, setPret] = useState(false);
  const [brouillonRestaure, setBrouillonRestaure] = useState<Date | null>(null);
  const [derniereSauvegarde, setDerniereSauvegarde] = useState<Date | null>(null);

  const templatesDuType = useMemo(
    () => templates.filter((t) => t.templateType === typeVisuel && t.isActive),
    [templates, typeVisuel]
  );

  const formatsDisponibles = useMemo(
    () => Object.values(FORMATS).filter((f) => f.types.includes(typeVisuel)),
    [typeVisuel]
  );

  // Photos réellement sélectionnées (dédupliquées — 2 noms peuvent
  // pointer la même photo), dans l'ordre des intervenants.
  const photosChoisies = useMemo(() => {
    const uniques: PhotoIntervenant[] = [];
    for (const iv of intervenants) {
      if (!iv.photoId) continue;
      const trouvee = photos.find((p) => p.id === iv.photoId);
      if (trouvee && !uniques.some((u) => u.id === trouvee.id)) uniques.push(trouvee);
    }
    return uniques;
  }, [intervenants, photos]);

  const fondSelectionne = fonds.find((f) => f.id === fondId);

  /** Change le type de visuel en réinitialisant template + formats. */
  const changerType = useCallback(
    (nouveau: TypeVisuel, listeTemplates: TemplateStudio[]) => {
      setTypeVisuel(nouveau);
      const premiers = listeTemplates.filter((t) => t.templateType === nouveau);
      if (premiers.length) {
        setTemplateId(premiers[0].id);
        setStyle(premiers[0].styleKey);
      } else {
        setTemplateId("");
      }
      setFormatsChoisis(
        Object.values(FORMATS)
          .filter((f) => f.types.includes(nouveau))
          .map((f) => f.cle)
      );
      setResultats([]);
      setApercuFormat(
        Object.values(FORMATS).find((f) => f.types.includes(nouveau))?.cle || "youtube"
      );
    },
    []
  );

  // ── Brouillon : instantané + écriture debouncée ──────────────────────

  const donneesBrouillon = useMemo(
    () => ({
      typeVisuel,
      titre,
      accroche,
      intervenants,
      fondId,
      style,
      templateId,
      formatsChoisis,
      dateEvenement,
      heureEvenement,
      lieuEvenement,
      verset,
      videoId,
      // ⭐ V3.91 — palette libre + calques suivis par le brouillon.
      palettePerso,
      calques: reglagesCalques || null,
    }),
    [
      typeVisuel, titre, accroche, intervenants, fondId, style, templateId,
      formatsChoisis, dateEvenement, heureEvenement, lieuEvenement, verset,
      videoId, palettePerso, reglagesCalques,
    ]
  );

  const ecrireBrouillon = useCallback((): boolean => {
    try {
      localStorage.setItem(
        CLE_BROUILLON,
        JSON.stringify({
          sauveA: new Date().toISOString(),
          ...donneesBrouillon,
        } satisfies BrouillonStudio)
      );
      setDerniereSauvegarde(new Date());
      return true;
    } catch {
      return false;
    }
  }, [donneesBrouillon]);

  // Sauvegarde AUTOMATIQUE (800 ms après la dernière modification).
  useEffect(() => {
    if (!pret) return;
    const minuteur = setTimeout(ecrireBrouillon, 800);
    return () => clearTimeout(minuteur);
  }, [pret, donneesBrouillon, ecrireBrouillon]);

  /** Bouton « Sauvegarder » — écriture immédiate + retour visible. */
  const sauvegarderMaintenant = useCallback(() => {
    if (ecrireBrouillon()) {
      afficherToast("Brouillon sauvegardé — votre travail est protégé.", "succes");
    } else {
      afficherToast("Sauvegarde impossible (stockage du navigateur).", "erreur");
    }
  }, [ecrireBrouillon]);

  /** Efface tout et repart de zéro (brouillon compris) — modal
   * PERSONNALISÉE V3.91 (plus jamais le confirm() gris du navigateur). */
  const repartirDeZero = useCallback(async () => {
    const confirme = await confirmation.demander({
      titre: "Repartir de zéro ?",
      message:
        "Le travail en cours sera effacé : titre, intervenants, photos sélectionnées, palette et réglages de calques.\nLes photos déjà importées dans la bibliothèque sont conservées.",
      libelleConfirmer: "Effacer et repartir de zéro",
      variante: "nouveau",
    });
    if (!confirme) {
      return;
    }
    try {
      localStorage.removeItem(CLE_BROUILLON);
    } catch {
      /* silencieux */
    }
    setTypeVisuel("miniature");
    setTitre("");
    setAccroche("");
    setIntervenants([{ nom: "Pasteur Kongo", photoId: "" }]);
    setFondId("");
    setStyle("noir-or");
    const premiers = templates.filter((t) => t.templateType === "miniature");
    setTemplateId(premiers[0]?.id || "");
    if (premiers[0]) setStyle(premiers[0].styleKey);
    setFormatsChoisis(["youtube", "square", "reels"]);
    setDateEvenement("");
    setHeureEvenement("");
    setLieuEvenement("");
    setVerset("");
    setVideoId("");
    setResultats([]);
    setBrouillonRestaure(null);
    setDerniereSauvegarde(null);
    setApercuFormat("youtube");
    setApercuVariante("A");
    // ⭐ V3.91 — reset des nouveautés.
    setPalettePerso(null);
    setDirecteurSpec(null);
    setDirecteurHistorique([]);
    setDirecteurDescription("");
    setDirecteurCorrection("");
    setPromptFluxVisible(false);
    reinitialiserCalques();
    afficherToast("Nouveau visuel — page réinitialisée.", "info");
  }, [templates, confirmation, reinitialiserCalques]);

  // ── Chargement initial (+ URL + brouillon) ───────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [rMeta, rTemplates, rFonds, rPhotos] = await Promise.all([
          fetch(`${apiBase}/meta`, { cache: "no-store" }),
          fetch(`${apiBase}/templates`, { cache: "no-store" }),
          fetch(`${apiBase}/backgrounds`, { cache: "no-store" }),
          fetch(`${apiBase}/speakers`, { cache: "no-store" }),
        ]);
        if (rMeta.ok) {
          const meta = (await lireJsonSur(rMeta)) as {
            styles?: StyleStudioClient[];
            ia?: { active?: boolean };
          };
          setStyles(meta.styles || []);
          setIaActive(Boolean(meta.ia?.active));
        }
        let listeTemplates: TemplateStudio[] = [];
        if (rTemplates.ok) {
          listeTemplates = ((await lireJsonSur(rTemplates)) as { items?: TemplateStudio[] }).items || [];
          setTemplates(listeTemplates);
        }
        let listeFonds: FondStudio[] = [];
        if (rFonds.ok) {
          listeFonds = ((await lireJsonSur(rFonds)) as { items?: FondStudio[] }).items || [];
          setFonds(listeFonds);
        }
        let listePhotos: PhotoIntervenant[] = [];
        if (rPhotos.ok) {
          listePhotos = ((await lireJsonSur(rPhotos)) as { items?: PhotoIntervenant[] }).items || [];
          setPhotos(listePhotos);
        }

        // ① Pré-remplissage explicite depuis une vidéo (§6.1) — prioritaire
        //    sur le brouillon (intention explicite).
        const params = new URLSearchParams(window.location.search);
        const v = params.get("video");
        const t = params.get("titre");
        const type = params.get("type");
        const depuisVideo = Boolean(v || t || type === "affiche");
        if (v) setVideoId(v);
        if (t) setTitre(t);
        if (type === "affiche") {
          changerType("affiche", listeTemplates);
          setPret(true);
          return;
        }

        // Dernière photo de Pasteur Kongo par défaut (comportement V3.89).
        const derniereKongo = listePhotos.find((p) => p.speakerName === "Pasteur Kongo");
        const defauts = () => {
          const premiers = listeTemplates.filter((tm) => tm.templateType === "miniature");
          if (premiers.length) {
            setTemplateId(premiers[0].id);
            setStyle(premiers[0].styleKey);
          }
          if (derniereKongo) {
            setIntervenants((liste) =>
              liste.map((iv) =>
                iv.nom === "Pasteur Kongo" ? { ...iv, photoId: derniereKongo.id } : iv
              )
            );
          }
        };

        if (depuisVideo) {
          defauts();
          setPret(true);
          return;
        }

        // ② ⭐ V3.90 — BROUILLON restauré (travail en cours préservé).
        let brouillon: BrouillonStudio | null = null;
        try {
          const brut = localStorage.getItem(CLE_BROUILLON);
          if (brut) brouillon = JSON.parse(brut) as BrouillonStudio;
        } catch {
          brouillon = null;
        }
        const significatif =
          brouillon &&
          (brouillon.titre?.trim() ||
            brouillon.accroche?.trim() ||
            (brouillon.intervenants || []).some((i) => i?.photoId) ||
            brouillon.lieuEvenement?.trim() ||
            brouillon.dateEvenement?.trim() ||
            brouillon.verset?.trim());

        if (brouillon && significatif) {
          const typeBrouillon: TypeVisuel =
            brouillon.typeVisuel === "affiche" ? "affiche" : "miniature";
          setTypeVisuel(typeBrouillon);
          setTitre(brouillon.titre || "");
          setAccroche(brouillon.accroche || "");

          // Intervenants : noms conservés, photos validées contre la base.
          const ivs = (brouillon.intervenants || [])
            .filter((x) => x && typeof x.nom === "string")
            .slice(0, 6)
            .map((x) => ({
              nom: x.nom.substring(0, 80),
              photoId: listePhotos.some((p) => p.id === x.photoId) ? x.photoId : "",
            }));
          setIntervenants(
            ivs.length
              ? ivs
              : [{ nom: "Pasteur Kongo", photoId: derniereKongo?.id || "" }]
          );

          // Fond : conservé s'il existe toujours.
          if (brouillon.fondId && listeFonds.some((f) => f.id === brouillon.fondId)) {
            setFondId(brouillon.fondId);
          }

          // Style + template : le template doit exister ET matcher le type.
          const templateBrouillon = listeTemplates.find(
            (tm) => tm.id === brouillon!.templateId && tm.templateType === typeBrouillon
          );
          if (templateBrouillon) {
            setTemplateId(templateBrouillon.id);
            setStyle(brouillon.style || templateBrouillon.styleKey);
          } else {
            const premiers = listeTemplates.filter((tm) => tm.templateType === typeBrouillon);
            setTemplateId(premiers[0]?.id || "");
            setStyle(brouillon.style || premiers[0]?.styleKey || "noir-or");
          }

          // Formats : filtrés selon le type du brouillon.
          const formatsValides = (brouillon.formatsChoisis || []).filter((f) =>
            FORMATS[f]?.types.includes(typeBrouillon)
          ) as CleFormat[];
          setFormatsChoisis(
            formatsValides.length
              ? formatsValides
              : Object.values(FORMATS)
                  .filter((f) => f.types.includes(typeBrouillon))
                  .map((f) => f.cle)
          );
          setApercuFormat(
            (formatsValides[0] as CleFormat) ||
              Object.values(FORMATS).find((f) => f.types.includes(typeBrouillon))?.cle ||
              "youtube"
          );

          setDateEvenement(brouillon.dateEvenement || "");
          setHeureEvenement(brouillon.heureEvenement || "");
          setLieuEvenement(brouillon.lieuEvenement || "");
          setVerset(brouillon.verset || "");
          // ⭐ V3.91 — palette libre + calques du brouillon.
          const paletteBrute = brouillon.palettePerso;
          if (
            paletteBrute &&
            MOTIF_COULEUR.test(paletteBrute.accent || "") &&
            MOTIF_COULEUR.test(paletteBrute.background || "")
          ) {
            setPalettePerso(paletteBrute);
          }
          const calquesBruts = brouillon.calques;
          if (calquesBruts?.ordre?.length) {
            const valides = calquesBruts.ordre.filter((c) =>
              ORDRE_CALQUES_DEFAUT.includes(c)
            );
            if (valides.length) {
              setOrdreCalques([
                ...valides,
                ...ORDRE_CALQUES_DEFAUT.filter((c) => !valides.includes(c)),
              ]);
            }
          }
          if (calquesBruts?.masques?.length) {
            setCalquesMasques(
              calquesBruts.masques.filter((c) => ORDRE_CALQUES_DEFAUT.includes(c))
            );
          }
          if (calquesBruts?.decalages) {
            const propres: Partial<Record<CleCalque, DecalageCalque>> = {};
            for (const [cle, dec] of Object.entries(calquesBruts.decalages)) {
              if (
                (ORDRE_CALQUES_DEFAUT as string[]).includes(cle) &&
                dec &&
                typeof dec.x === "number" &&
                typeof dec.y === "number"
              ) {
                propres[cle as CleCalque] = {
                  x: Math.max(-0.3, Math.min(0.3, dec.x)),
                  y: Math.max(-0.3, Math.min(0.3, dec.y)),
                };
              }
            }
            setDecalagesCalques(propres);
          }
          if (typeof brouillon.videoId === "string" && brouillon.videoId) {
            setVideoId(brouillon.videoId);
          }
          const dateBrouillon = new Date(brouillon.sauveA);
          setBrouillonRestaure(dateBrouillon);
          setDerniereSauvegarde(dateBrouillon);
        } else {
          defauts();
        }
      } catch {
        setErreur("Impossible de charger le studio — réessayez.");
      } finally {
        setPret(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // ── Édition des intervenants ─────────────────────────────────────────

  const modifierIntervenant = useCallback((index: number, champ: Partial<IntervenantSaisi>) => {
    setIntervenants((liste) =>
      liste.map((iv, j) => (j === index ? { ...iv, ...champ } : iv))
    );
  }, []);

  const ajouterIntervenant = useCallback(() => {
    setIntervenants((liste) => [...liste, { nom: "", photoId: "" }]);
  }, []);

  const supprimerIntervenant = useCallback((index: number) => {
    setIntervenants((liste) => liste.filter((_, j) => j !== index));
  }, []);

  // ── Upload direct avec ROGNAGE (façon Canva) ─────────────────────────

  const televerserPhotoRognee = useCallback(
    async (index: number, blob: Blob) => {
      const nom =
        intervenants[index]?.nom.replace(/\s+/g, " ").trim() || "Intervenant";
      try {
        const form = new FormData();
        form.append(
          "file",
          new File([blob], "photo-rognee.png", { type: "image/png" })
        );
        form.append("speaker_name", nom);
        const res = await fetch(`${apiBase}/speakers/upload-photo`, {
          method: "POST",
          body: form,
        });
        // ⭐ V3.91 — lecture blindée : jamais « Unexpected token '<' ».
        const data = (await lireJsonSur(res)) as {
          error?: string;
          item?: PhotoIntervenant;
          detourage?: { ok?: boolean; couverture?: number };
        };
        if (!res.ok || !data.item) throw new Error(String(data.error || "Import impossible"));
        const item = data.item;
        setPhotos((anciennes) => [item, ...anciennes]);
        setIntervenants((liste) =>
          liste.map((iv, j) => (j === index ? { ...iv, photoId: item.id } : iv))
        );
        afficherToast(
          data.detourage?.ok
            ? `Photo de ${nom} enregistrée — détourage automatique réussi (${data.detourage.couverture} % du fond supprimé).`
            : `Photo de ${nom} enregistrée — fond trop complexe pour le détourage, la photo originale sera utilisée.`,
          data.detourage?.ok ? "succes" : "info"
        );
      } catch (e) {
        afficherToast(e instanceof Error ? e.message : "Import impossible", "erreur");
      }
    },
    [apiBase, intervenants]
  );

  // ── IA : peaufiner la photo d'un intervenant ─────────────────────────

  const peaufinerPhoto = useCallback(
    async (index: number) => {
      const cible = intervenants[index];
      if (!cible?.photoId || iaPhotoOccupee) return;
      setIaPhotoOccupee(cible.photoId);
      try {
        const res = await fetch(`${apiBase}/ai/peaufiner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker_photo_id: cible.photoId }),
        });
        const data = (await lireJsonSur(res)) as {
          error?: string;
          item?: PhotoIntervenant;
          detourage?: { ok?: boolean; couverture?: number };
        };
        if (!res.ok || !data.item) throw new Error(String(data.error || "Peaufinage impossible"));
        const item = data.item;
        setPhotos((anciennes) => [item, ...anciennes]);
        setIntervenants((liste) =>
          liste.map((iv, j) => (j === index ? { ...iv, photoId: item.id } : iv))
        );
        afficherToast(
          data.detourage?.ok
            ? `Photo peaufinée par l'IA — détourage réussi (${data.detourage.couverture} % du fond supprimé).`
            : "Photo peaufinée par l'IA — fond complexe, version opaque conservée.",
          "succes"
        );
      } catch (e) {
        afficherToast(e instanceof Error ? e.message : "Peaufinage impossible", "erreur");
      } finally {
        setIaPhotoOccupee("");
      }
    },
    [apiBase, intervenants, iaPhotoOccupee]
  );

  // ── IA : générer un fond ─────────────────────────────────────────────

  const genererFondIA = useCallback(async () => {
    const intention = fondIAPrompt.trim();
    if (!intention || fondIAOccupe) return;
    setFondIAOccupe(true);
    try {
      const res = await fetch(`${apiBase}/ai/fond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: intention,
          style,
          categorie: "general",
          nom: `IA — ${intention.substring(0, 44)}`,
          // ⭐ V3.91 — palette libre : le fond suit les couleurs choisies.
          palette_perso: palettePerso || undefined,
        }),
      });
      const data = (await lireJsonSur(res)) as { error?: string; item?: FondStudio };
      if (!res.ok || !data.item) throw new Error(String(data.error || "Génération impossible"));
      const item = data.item;
      setFonds((anciens) => [item, ...anciens]);
      setFondId(item.id || "");
      afficherToast("Fond généré par l'IA et sélectionné.", "succes");
    } catch (e) {
      afficherToast(e instanceof Error ? e.message : "Génération impossible", "erreur");
    } finally {
      setFondIAOccupe(false);
    }
  }, [apiBase, fondIAPrompt, fondIAOccupe, style, palettePerso]);

  // ── ⭐ V3.91 — DIRECTEUR IA (gpt-oss-20b) ────────────────────────────
  // Description française complète → spécification (prompt FLUX + palette
  // + ambiance + suggestions). Puis fond généré + palette APPLIQUÉE.
  // ITÉRATION : chaque correction repart de la spécification précédente.

  const appliquerSpecDirecteur = useCallback(
    async (spec: SpecDirecteurClient, historique: MessageDirecteur[]) => {
      // ① Palette appliquée immédiatement (l'aperçu change de couleurs).
      setPalettePerso(spec.palette);
      // ② Fond généré avec le prompt du directeur + sa palette.
      setDirecteurFondEnCours(true);
      try {
        const res = await fetch(`${apiBase}/ai/fond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: spec.prompt_flux.substring(0, 900) || "fond premium sombre élégant",
            style,
            categorie: "general",
            nom: `Directeur IA — ${spec.ambiance?.substring(0, 40) || "visuel"}`,
            palette_perso: spec.palette,
          }),
        });
        const data = (await lireJsonSur(res)) as { error?: string; item?: FondStudio };
        if (!res.ok) throw new Error(String(data.error || "Génération du fond impossible"));
        if (data.item?.id) {
          const item = data.item;
          setFonds((anciens) => [item, ...anciens]);
          setFondId(item.id);
        }
      } catch (e) {
        afficherToast(
          e instanceof Error
            ? `${e.message} (la palette reste appliquée)`
            : "Génération du fond impossible (la palette reste appliquée)",
          "erreur"
        );
      } finally {
        setDirecteurFondEnCours(false);
      }
      void historique;
    },
    [apiBase, style]
  );

  /** Lance le Directeur IA (1re fois) ou une ITÉRATION (correction). */
  const lancerDirecteur = useCallback(
    async (correction?: string) => {
      const description = directeurDescription.trim();
      if (directeurOccupe || directeurFondEnCours) return;
      if (!correction && description.length < 5) {
        afficherToast("Décrivez d'abord le visuel souhaité (une phrase suffit).", "info");
        return;
      }
      if (correction && !correction.trim()) {
        afficherToast("Écrivez la correction à apporter (ex. « assombrit le haut »).", "info");
        return;
      }
      setDirecteurOccupe(true);
      try {
        const res = await fetch(`${apiBase}/ai/directeur`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description || "visuel selon la correction précédente",
            correction: correction || undefined,
            historique: directeurHistorique,
          }),
        });
        const data = await lireJsonSur(res); // ⭐ V3.91 — blindé
        if (!res.ok) throw new Error(String(data.error || "Le directeur IA n'a pas répondu"));
        const spec = data.spec as SpecDirecteurClient | undefined;
        const historique = (data.historique || []) as MessageDirecteur[];
        if (!spec?.prompt_flux) throw new Error("Le directeur IA n'a rien proposé — reformulez.");
        setDirecteurSpec(spec);
        setDirecteurHistorique(historique);
        setDirecteurCorrection("");
        // Applique palette + fond immédiatement (le pasteur VOIT le résultat).
        await appliquerSpecDirecteur(spec, historique);
        const iteration = (data.iteration as number) || 1;
        // ⭐ V3.93 — repli : le directeur IA était saturé, le fond a été
        // généré directement depuis la description (info ambrée, pas
        // d'erreur — le visuel EST là).
        const repli = Boolean(data.repli);
        afficherToast(
          repli
            ? String(
                data.info ||
                  "Le directeur IA était saturé — le fond a été généré directement depuis votre description."
              )
            : iteration > 1
              ? `Itération ${iteration} appliquée — continuez à corriger jusqu'au rendu final.`
              : "Spécification appliquée — palette et fond générés. Affinez avec une correction.",
          repli ? "info" : "succes"
        );
      } catch (e) {
        afficherToast(e instanceof Error ? e.message : "Directeur IA indisponible", "erreur");
      } finally {
        setDirecteurOccupe(false);
      }
    },
    [
      apiBase,
      directeurDescription,
      directeurHistorique,
      directeurOccupe,
      directeurFondEnCours,
      appliquerSpecDirecteur,
    ]
  );

  // ⭐ Aperçu live (debounce 700 ms — le MÊME moteur que la génération).
  const numeroApercu = useRef(0);
  useEffect(() => {
    if (!templateId || !titre.trim()) {
      setApercuUrl("");
      return;
    }
    const numero = ++numeroApercu.current;
    const minuteur = setTimeout(async () => {
      try {
        setApercuCharge(true);
        const res = await fetch(`${apiBase}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: typeVisuel,
            titre,
            accroche: accroche || undefined,
            speaker_names: intervenants
              .map((iv) => iv.nom.replace(/\s+/g, " ").trim())
              .filter(Boolean),
            photos_sujet: photosChoisies.slice(0, 4).map((p) => ({
              url: p.cutoutUrl || p.originalUrl,
              decoupee: Boolean(p.cutoutUrl),
            })),
            fond_url: fondSelectionne?.imageUrl,
            style,
            // ⭐ V3.91 — palette libre + calques dans l'aperçu live.
            palette_perso: palettePerso || undefined,
            calques: reglagesCalques,
            template_id: templateId,
            variant: apercuVariante,
            format: apercuFormat,
            event_date: dateEvenement || undefined,
            event_time: heureEvenement || undefined,
            event_location: lieuEvenement || undefined,
            bible_verse: verset || undefined,
          }),
        });
        if (!res.ok) return;
        const data = (await lireJsonSur(res)) as { dataUrl?: string };
        if (numero === numeroApercu.current && data.dataUrl) {
          setApercuUrl(data.dataUrl);
        }
      } catch {
        // silencieux : l'aperçu se reprendra à la prochaine saisie.
      } finally {
        if (numero === numeroApercu.current) setApercuCharge(false);
      }
    }, 700);
    return () => clearTimeout(minuteur);
  }, [
    apiBase, typeVisuel, titre, accroche, intervenants, photosChoisies,
    fondSelectionne, style, templateId, apercuVariante, apercuFormat,
    dateEvenement, heureEvenement, lieuEvenement, verset,
    palettePerso, reglagesCalques,
  ]);

  // Génération.
  const generer = async (variantesCiblees: CleVariante[]) => {
    if (!templateId || !titre.trim()) return;
    setGeneration(true);
    setErreur("");
    try {
      const res = await fetch(`${apiBase}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visual_type: typeVisuel,
          video_id: videoId || null,
          template_id: templateId,
          title_text: titre,
          accroche: accroche || undefined,
          speaker_names: intervenants
            .map((iv) => iv.nom.replace(/\s+/g, " ").trim())
            .filter(Boolean),
          speaker_photo_ids: photosChoisies.slice(0, 4).map((p) => p.id),
          speaker_photo_id: photosChoisies[0]?.id || null,
          fond_id: fondId || null,
          style,
          // ⭐ V3.91 — palette libre + calques dans la GÉNÉRATION finale.
          palette_perso: palettePerso || undefined,
          calques: reglagesCalques,
          formats: formatsChoisis,
          variants: variantesCiblees,
          event_date: dateEvenement || undefined,
          event_time: heureEvenement || undefined,
          event_location: lieuEvenement || undefined,
          bible_verse: verset || undefined,
        }),
      });
      const data = (await lireJsonSur(res)) as { error?: string; creations?: CreationStudio[] };
      if (!res.ok) throw new Error(String(data.error || "Génération impossible"));
      setResultats(data.creations || []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setGeneration(false);
    }
  };

  // Noms saisis, propres, pour l'affichage.
  const nomsIntervenants = intervenants
    .map((iv) => iv.nom.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  void nomsIntervenants;

  return (
    <div className="space-y-4">
      {/* ⭐ Bandeau de restauration du brouillon. */}
      {brouillonRestaure && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-[#5B7052]/10 border border-[#5B7052]/30 text-xs text-[#3F5039]">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 min-w-[220px]">
            Brouillon restauré (
            {brouillonRestaure.toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            ) — votre travail en cours est préservé.
          </span>
          <button
            onClick={repartirDeZero}
            className="font-bold underline underline-offset-2 whitespace-nowrap"
          >
            Repartir de zéro
          </button>
          <button
            onClick={() => setBrouillonRestaure(null)}
            className="p-1 rounded hover:bg-[#5B7052]/10"
            aria-label="Masquer le message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
      {/* ── Panneau des paramètres (§24) ── */}
      <div className="space-y-5 bg-white rounded-2xl border border-[#8A8378]/15 p-5">
        {/* ⭐ Brouillon : sauvegarde automatique + bouton. */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF6EF] border border-[#8A8378]/10 px-3 py-2">
          <span className="text-[10px] text-[#8A8378] flex items-center gap-1.5 min-w-0">
            <Save className="w-3.5 h-3.5 text-[#5B7052] flex-shrink-0" />
            {derniereSauvegarde
              ? `Brouillon sauvegardé à ${derniereSauvegarde.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Sauvegarde automatique du brouillon"}
          </span>
          <span className="flex items-center gap-1.5">
            <button
              onClick={sauvegarderMaintenant}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5B7052] text-white text-[10px] font-bold hover:bg-[#3F5039]"
            >
              <Save className="w-3 h-3" />
              Sauvegarder
            </button>
            <button
              onClick={repartirDeZero}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#8A8378]/25 text-[#8A8378] text-[10px] font-semibold hover:bg-white"
            >
              <FilePlus2 className="w-3 h-3" />
              Nouveau
            </button>
          </span>
        </div>

        {/* Type de visuel */}
        <div className="grid grid-cols-2 gap-2">
          {(["miniature", "affiche"] as TypeVisuel[]).map((t) => (
            <button
              key={t}
              onClick={() => changerType(t, templates)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                typeVisuel === t
                  ? "border-[#C9A227] bg-[#C9A227]/5 text-[#A3821C]"
                  : "border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40"
              )}
            >
              {t === "miniature" ? "Miniature vidéo" : "Affiche événement"}
            </button>
          ))}
        </div>

        {videoId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#8C5FA8]/10 border border-[#8C5FA8]/25 text-xs text-[#6B4480]">
            <Film className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              Vidéo associée — la miniature générée pourra lui être appliquée.
            </span>
            <button
              onClick={() => setVideoId("")}
              className="p-1 rounded hover:bg-[#8C5FA8]/15"
              aria-label="Dissocier"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Étape 1 — Contenu */}
        <Section label="1. Contenu">
          <Champ
            label={typeVisuel === "miniature" ? "Titre de la vidéo *" : "Titre de l'événement *"}
            value={titre}
            onChange={setTitre}
            placeholder="Ex. Comment vaincre les attaques de l'ennemi ?"
          />
          {typeVisuel === "miniature" && (
            <Champ
              label="Accroche miniature (facultatif)"
              value={accroche}
              onChange={setAccroche}
              placeholder="Ex. VAINCRE LES ATTAQUES DE L'ENNEMI !"
            />
          )}
        </Section>

        {/* Étape 2 — Intervenants (noms LIBRES — V3.90) */}
        <Section label="2. Intervenants">
          <p className="text-[10px] text-[#8A8378] -mt-0.5">
            Modifiez les noms librement (il peut s&apos;agir d&apos;autres
            personnes) — ajoutez autant d&apos;intervenants que vous voulez,
            chacun avec sa photo.
          </p>
          <div className="space-y-2.5">
            {intervenants.map((iv, i) => {
              const photosDuNom = photos.filter(
                (p) => p.speakerName === iv.nom.replace(/\s+/g, " ").trim()
              );
              const iaEnCours = iaPhotoOccupee && iaPhotoOccupee === iv.photoId;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-[#8A8378]/15 bg-[#FAF6EF]/40 p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-1.5">
                    <UserRound className="w-4 h-4 text-[#A3821C] flex-shrink-0" />
                    <input
                      value={iv.nom}
                      onChange={(e) => modifierIntervenant(i, { nom: e.target.value })}
                      placeholder="Nom de l'intervenant (modifiable)"
                      maxLength={80}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[#8A8378]/25 bg-white text-sm"
                    />
                    {iaActive && iv.photoId && (
                      <button
                        onClick={() => peaufinerPhoto(i)}
                        disabled={Boolean(iaPhotoOccupee)}
                        title="Peaufiner la photo avec l'IA — éclairage studio, netteté (10 à 30 s)"
                        className={cn(
                          "p-1.5 rounded-lg border flex-shrink-0 disabled:opacity-40",
                          iaEnCours
                            ? "border-[#8C5FA8] text-[#8C5FA8]"
                            : "border-[#8C5FA8]/40 text-[#8C5FA8] hover:bg-[#8C5FA8]/10"
                        )}
                      >
                        {iaEnCours ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => supprimerIntervenant(i)}
                      title="Retirer cet intervenant"
                      className="p-1.5 rounded-lg text-[#B3452E]/70 hover:bg-[#B3452E]/10 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Photos de CET intervenant + import direct (rognage). */}
                  <div className="flex gap-2 overflow-x-auto scrollbar-discrete pb-1">
                    {photosDuNom.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => modifierIntervenant(i, { photoId: p.id })}
                        className={cn(
                          "relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all",
                          iv.photoId === p.id
                            ? "border-[#C9A227] ring-2 ring-[#C9A227]/30"
                            : "border-transparent opacity-70 hover:opacity-100"
                        )}
                        title={`${p.speakerName}${p.isProcessed ? " (détourée)" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.thumbnailUrl || p.cutoutUrl || p.originalUrl}
                          alt={p.speakerName}
                          className="w-full h-full object-cover bg-[#2A0E3D]"
                        />
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setUploadPour(i);
                        refFichier.current?.click();
                      }}
                      title="Importer une photo pour cet intervenant — rognage façon Canva + détourage automatique"
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-[#C9A227]/60 text-[#A3821C] hover:bg-[#C9A227]/5 flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-[8px] font-bold leading-none">Photo</span>
                    </button>
                  </div>

                  {photosDuNom.length === 0 && (
                    <p className="text-[10px] text-[#8A8378]">
                      Aucune photo pour «&nbsp;{iv.nom.trim() || "…"}&nbsp;» —
                      «&nbsp;+&nbsp;Photo&nbsp;» importe une image (rognage,
                      puis détourage automatique).
                    </p>
                  )}
                  {iaEnCours && (
                    <p className="text-[10px] text-[#8C5FA8] font-semibold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Peaufinage IA en cours (10 à 30 s)…
                    </p>
                  )}
                </div>
              );
            })}
            <button
              onClick={ajouterIntervenant}
              className="w-full px-3 py-2 rounded-xl border-2 border-dashed border-[#C9A227]/50 text-xs font-semibold text-[#A3821C] hover:bg-[#C9A227]/5 inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un intervenant
            </button>
          </div>
        </Section>

        {/* ⭐ V3.91 — Étape 2bis : DIRECTEUR IA (décrire le visuel comme
            dans ChatGPT — gpt-oss-20b structure, FLUX.1 génère). */}
        {iaActive && (
          <Section label="2bis. Décrire le visuel (IA)">
            <div className="rounded-xl border border-[#8C5FA8]/30 bg-[#8C5FA8]/[0.06] p-3 space-y-2.5">
              <p className="text-[11px] font-bold text-[#6B4480] flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5" />
                Directeur IA — décrivez, il crée
              </p>
              <p className="text-[10px] text-[#8A8378] leading-relaxed">
                Comme dans ChatGPT : donnez TOUTE la description (ambiance,
                couleurs, lumière, sujet). Le directeur structure votre demande,
                choisit la palette, génère le fond — puis corrigez jusqu&apos;au
                rendu final.
              </p>
              <textarea
                value={directeurDescription}
                onChange={(e) => setDirecteurDescription(e.target.value)}
                placeholder={EXEMPLES_DIRECTEUR[0]}
                rows={4}
                maxLength={4000}
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-white text-xs leading-relaxed resize-y"
              />
              <div className="flex flex-wrap gap-1.5">
                {EXEMPLES_DIRECTEUR.slice(0, 2).map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDirecteurDescription(ex)}
                    className="px-2 py-1 rounded-full text-[9px] font-semibold border border-[#8C5FA8]/25 text-[#6B4480] hover:bg-[#8C5FA8]/10 max-w-full truncate"
                    title={ex}
                  >
                    {ex.substring(0, 52)}…
                  </button>
                ))}
              </div>
              <button
                onClick={() => lancerDirecteur()}
                disabled={directeurOccupe || directeurFondEnCours || directeurDescription.trim().length < 5}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#8C5FA8] text-white text-xs font-bold hover:bg-[#7A4E97] disabled:opacity-40 disabled:pointer-events-none"
              >
                {directeurOccupe ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {directeurOccupe
                  ? "Le directeur réfléchit (15 à 50 s)…"
                  : directeurSpec
                    ? "Recréer depuis la description"
                    : "Créer le visuel avec l'IA"}
              </button>

              {/* Résultat du directeur + ITÉRATION. */}
              {directeurSpec && (
                <div className="rounded-lg border border-[#8C5FA8]/25 bg-white p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-[#6B4480] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#5B7052]" />
                      {directeurSpec.ambiance || "Spécification prête"}
                    </p>
                    <span className="text-[9px] text-[#8A8378] font-semibold">
                      itération {directeurHistorique.filter((m) => m.role === "user").length}
                    </span>
                  </div>

                  {/* Palette proposée. */}
                  <div className="flex items-center gap-2">
                    {(
                      [
                        ["accent", directeurSpec.palette.accent],
                        ["texte", directeurSpec.palette.secondary],
                        ["fond", directeurSpec.palette.background],
                      ] as const
                    ).map(([libelle, couleur]) => (
                      <span
                        key={libelle}
                        className="flex items-center gap-1 text-[9px] font-semibold text-[#8A8378]"
                      >
                        <span
                          className="w-4 h-4 rounded border border-[#8A8378]/30"
                          style={{ backgroundColor: couleur }}
                        />
                        {libelle}
                      </span>
                    ))}
                  </div>

                  {/* Suggestions de textes (cliquer = appliquer). */}
                  {(directeurSpec.suggestion_titre || directeurSpec.suggestion_accroche) && (
                    <div className="flex flex-wrap gap-1.5">
                      {directeurSpec.suggestion_titre && (
                        <button
                          onClick={() => setTitre(directeurSpec.suggestion_titre || "")}
                          className="px-2 py-1 rounded-full text-[9px] font-semibold border border-[#C9A227]/40 text-[#A3821C] hover:bg-[#C9A227]/10"
                          title="Cliquer pour utiliser comme titre"
                        >
                          Titre : {directeurSpec.suggestion_titre}
                        </button>
                      )}
                      {directeurSpec.suggestion_accroche && (
                        <button
                          onClick={() => setAccroche(directeurSpec.suggestion_accroche || "")}
                          className="px-2 py-1 rounded-full text-[9px] font-semibold border border-[#C9A227]/40 text-[#A3821C] hover:bg-[#C9A227]/10"
                          title="Cliquer pour utiliser comme accroche"
                        >
                          Accroche : {directeurSpec.suggestion_accroche}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Prompt FLUX (technique — dépliable). */}
                  <button
                    onClick={() => setPromptFluxVisible((v) => !v)}
                    className="text-[9px] font-semibold text-[#8A8378] underline underline-offset-2"
                  >
                    {promptFluxVisible ? "Masquer" : "Voir"} le prompt image (anglais)
                  </button>
                  {promptFluxVisible && (
                    <p className="text-[9px] text-[#8A8378] bg-[#FAF6EF] border border-[#8A8378]/15 rounded px-2 py-1.5 leading-relaxed break-words">
                      {directeurSpec.prompt_flux}
                    </p>
                  )}

                  {/* ITÉRATION : « corrige telle chose ». */}
                  <div className="flex gap-1.5 pt-0.5">
                    <input
                      value={directeurCorrection}
                      onChange={(e) => setDirecteurCorrection(e.target.value)}
                      placeholder="Correction… ex. « plus de flammes en bas »"
                      maxLength={2000}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-[11px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          lancerDirecteur(directeurCorrection);
                        }
                      }}
                    />
                    <button
                      onClick={() => lancerDirecteur(directeurCorrection)}
                      disabled={directeurOccupe || directeurFondEnCours || !directeurCorrection.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-[10px] font-bold hover:bg-[#3D1A54] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                    >
                      {directeurFondEnCours ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Corriger
                    </button>
                  </div>
                  {directeurFondEnCours && (
                    <p className="text-[10px] text-[#8C5FA8] font-semibold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Régénération du fond (10 à 30 s)…
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ⭐ V3.92 — Où sont passés les réglages ? (orientation pasteur) */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#FAF6EF] border border-dashed border-[#C9A227]/40 text-[10px] text-[#8A8378] leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 text-[#A3821C] flex-shrink-0 mt-0.5" />
          <span>
            Style, template, fond, calques et formats se règlent désormais avec
            les boutons « Réglages du visuel », juste sous « Générer le
            visuel » — cliquez pour ouvrir, ajustez, puis fermez.
          </span>
        </div>
      </div>

      {/* ── Aperçu + génération ── */}
      <div className="space-y-4">
        {/* Sélecteurs d'aperçu */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-white rounded-lg border border-[#8A8378]/15 p-1">
            {formatsDisponibles.slice(0, 3).map((f) => (
              <button
                key={f.cle}
                onClick={() => setApercuFormat(f.cle)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                  apercuFormat === f.cle
                    ? "bg-[#2A0E3D] text-[#FAF6EF]"
                    : "text-[#8A8378] hover:bg-[#FAF6EF]"
                )}
              >
                {f.libelle}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white rounded-lg border border-[#8A8378]/15 p-1">
            {VARIANTES.map((v) => (
              <button
                key={v}
                onClick={() => setApercuVariante(v)}
                className={cn(
                  "w-9 h-8 rounded-md text-xs font-bold transition-colors",
                  apercuVariante === v
                    ? "bg-[#C9A227] text-[#1E0F2B]"
                    : "text-[#8A8378] hover:bg-[#FAF6EF]"
                )}
                title={`Variante ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
          {apercuCharge && <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />}
        </div>

        {/* Zone d'aperçu */}
        <div className="bg-[#1A0826] rounded-2xl border border-[#C9A227]/20 p-4 flex items-center justify-center min-h-[280px] md:min-h-[380px]">
          {apercuUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={apercuUrl}
              alt="Aperçu du visuel"
              className="max-w-full max-h-[62vh] rounded-lg shadow-2xl"
            />
          ) : (
            <div className="text-center text-[#DDBE55]/60">
              <Wand2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {titre.trim()
                  ? "Génération de l'aperçu…"
                  : "Saisissez un titre pour voir l'aperçu en direct."}
              </p>
            </div>
          )}
        </div>

        {erreur && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
            <AlertCircle className="w-4 h-4" />
            {erreur}
          </div>
        )}

        {/* Génération */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => generer([apercuVariante])}
            disabled={generation || !templateId || !titre.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#B3261E] text-white text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg"
          >
            {generation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Générer le visuel
          </button>
          <button
            onClick={() => generer(VARIANTES)}
            disabled={generation || !templateId || !titre.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Copy className="w-4 h-4" />
            Générer 4 variantes
          </button>
        </div>
        {/* ⭐ V3.92 — RÉGLAGES DU VISUEL EN BOUTONS (façon Photoshop) :
            chaque section s'ouvre en modal, se règle, se ferme. */}
        <div className="bg-white rounded-2xl border border-[#8A8378]/15 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A3821C]">
              Réglages du visuel
            </p>
            <p className="text-[10px] text-[#8A8378] hidden sm:block">
              Cliquez sur un réglage pour l&apos;ouvrir, ajustez puis fermez —
              comme dans Photoshop.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <BoutonSection
              icone={Palette}
              titre="Style & palette"
              valeur={
                palettePerso ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex flex-shrink-0">
                      {[palettePerso.accent, palettePerso.secondary, palettePerso.background].map((c) => (
                        <span
                          key={c}
                          className="w-2.5 h-2.5 rounded-full border border-white ring-1 ring-[#8A8378]/25"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    Palette perso
                  </span>
                ) : (
                  styles.find((s) => s.key === style)?.label || "noir-or"
                )
              }
              modifie={Boolean(palettePerso)}
              onClick={() => setSectionOuverte("style")}
            />
            <BoutonSection
              icone={LayoutTemplate}
              titre="Template"
              valeur={
                templatesDuType.find((t) => t.id === templateId)?.name ||
                "Aucun template actif"
              }
              avertissement={!templateId}
              onClick={() => setSectionOuverte("template")}
            />
            <BoutonSection
              icone={ImageIcon}
              titre="Fond"
              valeur={
                fondSelectionne ? (
                  <span className="inline-flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fondSelectionne.imageUrl}
                      alt=""
                      className="w-4 h-3.5 rounded-[3px] object-cover flex-shrink-0"
                    />
                    <span className="truncate">{fondSelectionne.name}</span>
                  </span>
                ) : (
                  "Style seul (couleurs)"
                )
              }
              modifie={Boolean(fondId)}
              onClick={() => setSectionOuverte("fond")}
            />
            {typeVisuel === "affiche" && (
              <BoutonSection
                icone={CalendarDays}
                titre="Événement"
                valeur={
                  [dateEvenement, heureEvenement, lieuEvenement]
                    .filter(Boolean)
                    .map((v, k) =>
                      k === 0 && /^\d{4}-\d{2}-\d{2}$/.test(v)
                        ? v.split("-").reverse().join("/")
                        : v
                    )
                    .join(" · ") || "À compléter"
                }
                modifie={Boolean(dateEvenement || heureEvenement || lieuEvenement || verset)}
                onClick={() => setSectionOuverte("evenement")}
              />
            )}
            <BoutonSection
              icone={Layers}
              titre="Calques"
              valeur={
                `${ordreCalques.length - calquesMasques.length}/${ordreCalques.length} visibles` +
                (reglagesCalques ? " · réglés" : "")
              }
              modifie={Boolean(reglagesCalques)}
              onClick={() => setSectionOuverte("calques")}
            />
            <BoutonSection
              icone={Frame}
              titre="Formats"
              valeur={`${formatsChoisis.length} sélectionné${formatsChoisis.length > 1 ? "s" : ""}`}
              avertissement={formatsChoisis.length === 0}
              modifie={formatsChoisis.length !== formatsDisponibles.length}
              onClick={() => setSectionOuverte("formats")}
            />
          </div>
        </div>

        {/* ⭐ V3.92 — MODALS DE RÉGLAGE (une section à la fois, façon Photoshop). */}
        {sectionOuverte === "style" && (
          <ModalSection
            titre="Style & palette"
            sousTitre="Un style du studio, ou vos couleurs libres — la palette proposée par l'IA aussi."
            icone={Palette}
            onFerme={() => setSectionOuverte(null)}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {styles.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  title={s.ambiance}
                  className={cn(
                    "px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-all text-left",
                    style === s.key && !palettePerso
                      ? "border-[#C9A227] bg-[#C9A227]/5 text-[#A3821C]"
                      : "border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* ⭐ Palette LIBRE : n'importe quelles couleurs — sélecteurs. */}
            <div className="mt-3 rounded-xl border border-[#8A8378]/15 bg-[#FAF6EF]/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-[#1E0F2B] flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#A3821C]" />
                  Palette personnalisée
                  {palettePerso && (
                    <span className="text-[9px] font-semibold text-[#5B7052]">
                      active
                    </span>
                  )}
                </p>
                {palettePerso && (
                  <button
                    onClick={() => setPalettePerso(null)}
                    className="text-[9px] font-semibold text-[#B3452E] hover:underline"
                  >
                    Revenir aux styles du studio
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#8A8378] leading-relaxed">
                Choisissez les couleurs que VOUS voulez (le pasteur peut varier
                de palette) — ou prenez celle proposée par le directeur IA.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["Couleur du titre", "accent"],
                    ["Couleur des textes", "secondary"],
                    ["Couleur du fond", "background"],
                  ] as const
                ).map(([libelle, cle]) => (
                  <label key={cle} className="space-y-1">
                    <span className="block text-[9px] font-semibold text-[#8A8378] leading-tight">
                      {libelle}
                    </span>
                    <input
                      type="color"
                      value={(palettePerso?.[cle] as string) || ""}
                      onChange={(e) =>
                        setPalettePerso((actuelle) => ({
                          accent: actuelle?.accent || "#C9A227",
                          secondary: actuelle?.secondary || "#FAF6EF",
                          background: actuelle?.background || "#141009",
                          [cle]: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full h-8 rounded-lg border border-[#8A8378]/25 bg-white cursor-pointer p-0.5"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS_PALETTE.map((p) => (
                  <button
                    key={p.nom}
                    onClick={() => setPalettePerso(p.palette)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full border border-[#8A8378]/20 text-[9px] font-semibold text-[#8A8378] hover:border-[#C9A227]/50"
                    title={`${p.palette.accent} / ${p.palette.secondary} / ${p.palette.background}`}
                  >
                    <span className="flex">
                      {[p.palette.accent, p.palette.secondary, p.palette.background].map((c) => (
                        <span
                          key={c}
                          className="w-2.5 h-2.5 rounded-full border border-white"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    {p.nom}
                  </button>
                ))}
              </div>
            </div>
          </ModalSection>
        )}
        {sectionOuverte === "template" && (
          <ModalSection
            titre="Template"
            sousTitre="La disposition des éléments sur le visuel."
            icone={LayoutTemplate}
            large
            onFerme={() => setSectionOuverte(null)}
          >
            {templatesDuType.length === 0 ? (
              <p className="text-xs text-[#8A8378]">
                Aucun template actif pour ce type.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {templatesDuType.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTemplateId(t.id);
                      setStyle(t.styleKey);
                    }}
                    className={cn(
                      "rounded-xl border-2 p-2.5 text-left transition-all",
                      templateId === t.id
                        ? "border-[#C9A227] bg-[#C9A227]/5"
                        : "border-[#8A8378]/15 hover:border-[#C9A227]/40"
                    )}
                  >
                    <p className="text-xs font-bold text-[#1E0F2B] truncate">{t.name}</p>
                    <p className="text-[10px] text-[#8A8378] line-clamp-2 mt-0.5">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ModalSection>
        )}
        {sectionOuverte === "fond" && (
          <ModalSection
            titre="Fond (facultatif)"
            sousTitre="Une image de la bibliothèque, ou un fond généré par l'IA."
            icone={ImageIcon}
            onFerme={() => setSectionOuverte(null)}
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-discrete pb-1">
              <button
                onClick={() => setFondId("")}
                className={cn(
                  "w-20 h-14 rounded-lg border-2 flex-shrink-0 text-[10px] font-semibold text-[#8A8378] transition-all",
                  !fondId
                    ? "border-[#C9A227] bg-[#C9A227]/5"
                    : "border-[#8A8378]/15 hover:border-[#C9A227]/40"
                )}
              >
                Style seul
              </button>
              {fonds.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFondId(f.id)}
                  className={cn(
                    "w-20 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all",
                    fondId === f.id
                      ? "border-[#C9A227] ring-2 ring-[#C9A227]/30"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  title={f.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.imageUrl} alt={f.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {iaActive ? (
              <div className="mt-3 rounded-xl border border-[#8C5FA8]/30 bg-[#8C5FA8]/[0.06] p-3 space-y-2">
                <p className="text-[11px] font-bold text-[#6B4480] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Générer un fond avec l&apos;IA
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS_FOND_IA.map((s) => (
                    <button
                      key={s}
                      onClick={() => setFondIAPrompt(s)}
                      className="px-2 py-1 rounded-full text-[10px] font-semibold border border-[#8C5FA8]/30 text-[#6B4480] hover:bg-[#8C5FA8]/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={fondIAPrompt}
                    onChange={(e) => setFondIAPrompt(e.target.value)}
                    placeholder="Décrivez le fond… ex. flammes dans la nuit"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-white text-xs"
                  />
                  <button
                    onClick={genererFondIA}
                    disabled={fondIAOccupe || !fondIAPrompt.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8C5FA8] text-white text-xs font-bold hover:bg-[#7A4E97] disabled:opacity-40 whitespace-nowrap"
                  >
                    {fondIAOccupe ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Générer
                  </button>
                </div>
                <p className="text-[10px] text-[#8A8378]">
                  10 à 30 s — le fond rejoint la bibliothèque et est sélectionné.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[#8A8378] mt-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#C9A227] flex-shrink-0" />
                Fonds par IA : ajoutez la clé NVIDIA_API_KEY (build.nvidia.com)
                pour l&apos;activer.
              </p>
            )}
          </ModalSection>
        )}
        {sectionOuverte === "evenement" && typeVisuel === "affiche" && (
          <ModalSection
            titre="Informations événement"
            sousTitre="Date, heure, lieu et référence biblique affichés sur l'affiche."
            icone={CalendarDays}
            onFerme={() => setSectionOuverte(null)}
          >
            <div className="grid grid-cols-2 gap-2">
              <Champ label="Date" type="date" value={dateEvenement} onChange={setDateEvenement} />
              <Champ label="Heure" value={heureEvenement} onChange={setHeureEvenement} placeholder="19h00" />
            </div>
            <Champ label="Lieu" value={lieuEvenement} onChange={setLieuEvenement} placeholder="Cotonou" />
            <Champ label="Référence biblique" value={verset} onChange={setVerset} placeholder="Ésaïe 61:1" />
          </ModalSection>
        )}
        {sectionOuverte === "calques" && (
          <ModalSection
            titre="Calques (superpositions)"
            sousTitre="Ordre, visibilité et décalages fins — l'aperçu suit en direct."
            icone={Layers}
            large
            onFerme={() => setSectionOuverte(null)}
          >
            <div className="rounded-xl border border-[#8A8378]/15 bg-[#FAF6EF]/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-[#1E0F2B] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#A3821C]" />
                  Ordre des calques
                </p>
                <button
                  onClick={reinitialiserCalques}
                  className="text-[9px] font-semibold text-[#8A8378] hover:text-[#B3452E] inline-flex items-center gap-1"
                  title="Restaurer l'ordre et les réglages d'origine"
                >
                  <RotateCcw className="w-3 h-3" />
                  Réinitialiser
                </button>
              </div>
              <p className="text-[10px] text-[#8A8378] leading-relaxed">
                Le HAUT de la liste est dessiné DEVANT (comme une pile de papiers).
                Œil : masquer un calque. Flèches ± : l&apos;ajuster finement —
                l&apos;aperçu suit en direct.
              </p>
              <div className="space-y-1.5">
                {[...ordreCalques].reverse().map((cle) => {
                  const masque = calquesMasques.includes(cle);
                  const decalage = decalagesCalques[cle];
                  return (
                    <div
                      key={cle}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 space-y-1.5",
                        masque
                          ? "border-[#8A8378]/10 bg-[#8A8378]/5 opacity-60"
                          : "border-[#8A8378]/15 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => basculerCalque(cle)}
                          title={masque ? "Afficher ce calque" : "Masquer ce calque"}
                          className={cn(
                            "p-1 rounded",
                            masque
                              ? "text-[#8A8378] hover:bg-[#8A8378]/10"
                              : "text-[#A3821C] hover:bg-[#C9A227]/10"
                          )}
                        >
                          {masque ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <span className={cn("flex-1 text-[11px] font-semibold truncate", masque ? "text-[#8A8378]" : "text-[#1E0F2B]")}>
                          {LIBELLES_CALQUES[cle]}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => deplacerCalque(cle, 1)}
                            title="Monter (devant)"
                            className="p-1 rounded text-[#8A8378] hover:bg-[#C9A227]/10 hover:text-[#A3821C]"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deplacerCalque(cle, -1)}
                            title="Descendre (derrière)"
                            className="p-1 rounded text-[#8A8378] hover:bg-[#C9A227]/10 hover:text-[#A3821C]"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Décalage fin du calque (±). */}
                      <div className="flex items-center gap-1.5 pl-6">
                        <span className="text-[9px] text-[#8A8378] font-semibold">Ajuster</span>
                        <div className="flex items-center rounded-md border border-[#8A8378]/20 overflow-hidden">
                          <button
                            onClick={() => decalerCalque(cle, -0.02, 0)}
                            title="Décaler à gauche"
                            className="px-1.5 py-0.5 text-[#8A8378] hover:bg-[#FAF6EF] text-[11px] font-bold"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => decalerCalque(cle, 0.02, 0)}
                            title="Décaler à droite"
                            className="px-1.5 py-0.5 text-[#8A8378] hover:bg-[#FAF6EF] text-[11px] font-bold border-l border-r border-[#8A8378]/20"
                          >
                            →
                          </button>
                        </div>
                        <div className="flex items-center rounded-md border border-[#8A8378]/20 overflow-hidden">
                          <button
                            onClick={() => decalerCalque(cle, 0, -0.02)}
                            title="Monter le calque"
                            className="px-1.5 py-0.5 text-[#8A8378] hover:bg-[#FAF6EF] text-[11px] font-bold"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => decalerCalque(cle, 0, 0.02)}
                            title="Descendre le calque"
                            className="px-1.5 py-0.5 text-[#8A8378] hover:bg-[#FAF6EF] text-[11px] font-bold border-l border-[#8A8378]/20"
                          >
                            ↓
                          </button>
                        </div>
                        {decalage && (Math.abs(decalage.x) > 0.0001 || Math.abs(decalage.y) > 0.0001) && (
                          <button
                            onClick={() => decalerCalque(cle, -decalage.x, -decalage.y)}
                            className="text-[9px] font-semibold text-[#B3452E] hover:underline"
                            title="Remettre ce calque en position d'origine"
                          >
                            recentrer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalSection>
        )}
        {sectionOuverte === "formats" && (
          <ModalSection
            titre="Formats d'export"
            sousTitre="Les tailles d'image générées lors du téléchargement."
            icone={Frame}
            onFerme={() => setSectionOuverte(null)}
          >
            <div className="flex flex-wrap gap-1.5">
              {formatsDisponibles.map((f) => {
                const actif = formatsChoisis.includes(f.cle);
                return (
                  <button
                    key={f.cle}
                    onClick={() =>
                      setFormatsChoisis((anciens) =>
                        actif ? anciens.filter((x) => x !== f.cle) : [...anciens, f.cle]
                      )
                    }
                    title={f.description}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                      actif
                        ? "border-[#C9A227] bg-[#C9A227]/10 text-[#A3821C]"
                        : "border-[#8A8378]/20 text-[#8A8378]"
                    )}
                  >
                    {f.libelle}
                  </button>
                );
              })}
            </div>
          </ModalSection>
        )}

        {/* Résultats */}
        {resultats.length > 0 && (
          <div className="bg-[#5B7052]/10 border border-[#5B7052]/30 rounded-xl p-4">
            <p className="text-sm font-bold text-[#3F5039] mb-3 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Génération terminée — {resultats.length} création
              {resultats.length > 1 ? "s" : ""}
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {resultats.map((c) => (
                <CarteCreation key={c.id} creation={c} apiBase={apiBase} />
              ))}
            </div>
            <p className="text-[11px] text-[#8A8378] mt-3">
              Retrouvez toutes vos créations dans l&apos;onglet « Mes
              créations » (téléchargement, duplication, association vidéo).
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Input fichier caché + modal de rognage (upload direct V3.90). */}
      <input
        ref={refFichier}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setRogner({ fichier: f, index: uploadPour });
          e.target.value = "";
        }}
      />
      {rogner && (
        <ModalRogner
          fichier={rogner.fichier}
          onFerme={() => setRogner(null)}
          onValide={(blob) => {
            const cible = rogner;
            setRogner(null);
            televerserPhotoRognee(cible.index, blob);
          }}
        />
      )}
      {/* ⭐ V3.91 — modal de confirmation PERSONNALISÉE (OngletCréer). */}
      {confirmation.modal}
      {espace === "jamais" && <span className="hidden" />}
    </div>
  );
}

// ─── Onglet MES CRÉATIONS ──────────────────────────────────────────────

function OngletCreations({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<CreationStudio[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<"" | "miniature" | "affiche">("");

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = new URLSearchParams();
      if (filtre) params.set("type", filtre);
      const res = await fetch(`${apiBase}/creations?${params}`, { cache: "no-store" });
      if (res.ok) {
        setItems(((await lireJsonSur(res)) as { items?: CreationStudio[] }).items || []);
      }
    } finally {
      setChargement(false);
    }
  }, [apiBase, filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            { v: "", l: "Toutes" },
            { v: "miniature", l: "Miniatures" },
            { v: "affiche", l: "Affiches" },
          ] as const
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltre(f.v)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              filtre === f.v
                ? "bg-[#2A0E3D] text-[#FAF6EF]"
                : "bg-white border border-[#8A8378]/15 text-[#8A8378] hover:bg-[#FAF6EF]"
            )}
          >
            {f.l}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="flex justify-center py-16 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <Images className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucune création pour l&apos;instant — commencez par l&apos;onglet
            « Créer ».
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <CarteCreation key={c.id} creation={c} apiBase={apiBase} onSupprime={() => charger()} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Carte d'une création (aperçu + actions §25). */
function CarteCreation({
  creation,
  apiBase,
  onSupprime,
}: {
  creation: CreationStudio;
  apiBase: string;
  onSupprime?: () => void;
}) {
  const urlApercu =
    creation.outputUrls?.youtube ||
    creation.outputUrls?.square ||
    creation.outputUrls?.instagram ||
    Object.values(creation.outputUrls || {})[0] ||
    "";

  const [applique, setApplique] = useState(false);
  const [occupe, setOccupe] = useState(false);
  // ⭐ V3.91 — confirmations PERSONNALISÉES (jamais confirm() générique).
  const confirmation = useConfirmation();

  const dupliquer = async () => {
    setOccupe(true);
    await fetch(`${apiBase}/creations/${creation.id}`, { method: "POST" });
    setOccupe(false);
    afficherToast("Création dupliquée — la copie est modifiable depuis « Créer ».");
    onSupprime?.();
  };
  const supprimer = async () => {
    const confirme = await confirmation.demander({
      titre: "Supprimer cette création ?",
      message:
        "La création et ses fichiers exportés (tous formats) seront définitivement effacés du stockage cloud. Cette action est irréversible.",
      detail: creation.titleText,
      libelleConfirmer: "Supprimer définitivement",
      variante: "suppression",
    });
    if (!confirme) return;
    setOccupe(true);
    await fetch(`${apiBase}/creations/${creation.id}`, { method: "DELETE" });
    setOccupe(false);
    onSupprime?.();
  };
  const appliquerVideo = async () => {
    const confirme = await confirmation.demander({
      titre: "Appliquer comme miniature ?",
      message:
        "Ce visuel remplacera la miniature actuelle de la vidéo associée — les croyants verront cette image sur la page Vidéos.",
      libelleConfirmer: "Appliquer la miniature",
      variante: "application",
    });
    if (!confirme) return;
    setOccupe(true);
    const res = await fetch(`${apiBase}/creations/${creation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliquer_video: true }),
    });
    setOccupe(false);
    if (res.ok) {
      setApplique(true);
      afficherToast("Miniature appliquée à la vidéo.", "succes");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden">
      {urlApercu ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlApercu} alt={creation.titleText} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-[#1A0826] flex items-center justify-center text-[#DDBE55]/50">
          <Eye className="w-6 h-6" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-[#1E0F2B] line-clamp-2">{creation.titleText}</p>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#C9A227]/10 text-[#A3821C] whitespace-nowrap">
            {creation.variant}
          </span>
        </div>
        <p className="text-[10px] text-[#8A8378]">
          {creation.visualType === "affiche" ? "Affiche" : "Miniature"} ·{" "}
          {new Date(creation.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {creation.videoId && " · vidéo liée"}
          {creation.status === "selected" && " · ⭐ miniature active"}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Object.entries(creation.outputUrls || {}).map(([format, url]) => (
            <a
              key={format}
              href={url}
              download
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#C9A227]/40 text-[#A3821C] text-[10px] font-semibold hover:bg-[#C9A227]/10"
            >
              <Download className="w-3 h-3" />
              {FORMATS[format as CleFormat]?.libelle || format}
            </a>
          ))}
          <button
            onClick={dupliquer}
            disabled={occupe}
            title="Dupliquer"
            className="p-1.5 rounded-md border border-[#8A8378]/20 text-[#8A8378] hover:bg-[#FAF6EF] disabled:opacity-40"
          >
            <Copy className="w-3 h-3" />
          </button>
          {creation.videoId && creation.status !== "selected" && (
            <button
              onClick={appliquerVideo}
              disabled={occupe || applique}
              title="Utiliser comme miniature de la vidéo"
              className="p-1.5 rounded-md border border-[#5B7052]/40 text-[#3F5039] hover:bg-[#5B7052]/10 disabled:opacity-40"
            >
              {applique ? <Check className="w-3 h-3" /> : <Film className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={supprimer}
            disabled={occupe}
            title="Supprimer"
            className="p-1.5 rounded-md border border-[#B3452E]/30 text-[#B3452E] hover:bg-[#B3452E]/10 disabled:opacity-40 ml-auto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {/* ⭐ V3.91 — confirmation personnalisée de CETTE création. */}
      {confirmation.modal}
    </div>
  );
}

// ─── Onglet TEMPLATES (administration §39) ─────────────────────────────

function OngletTemplates({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<TemplateStudio[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`${apiBase}/templates?tous=1`, { cache: "no-store" });
      if (res.ok) {
        setItems(((await lireJsonSur(res)) as { items?: TemplateStudio[] }).items || []);
      }
    } finally {
      setChargement(false);
    }
  }, [apiBase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const basculerActif = async (t: TemplateStudio) => {
    await fetch(`${apiBase}/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    charger();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#8A8378]">
        Les templates définissent l&apos;ADN graphique (polices, effets,
        voiles) — le moteur applique ensuite la composition par format.
        Désactiver un template le retire des créations sans casser
        l&apos;historique.
      </p>
      {chargement ? (
        <div className="flex justify-center py-12 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((t) => (
            <div
              key={t.id}
              className={cn(
                "bg-white rounded-xl border p-4",
                t.isActive ? "border-[#8A8378]/15" : "border-[#8A8378]/10 opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B]">{t.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#A3821C] font-bold mt-0.5">
                    {t.templateType}
                  </p>
                </div>
                <button
                  onClick={() => basculerActif(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                    t.isActive
                      ? "bg-[#5B7052]/10 text-[#3F5039] border-[#5B7052]/30"
                      : "bg-[#8A8378]/10 text-[#8A8378] border-[#8A8378]/30"
                  )}
                >
                  {t.isActive ? "Actif" : "Inactif"}
                </button>
              </div>
              <p className="text-xs text-[#8A8378] mt-2 line-clamp-3">{t.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Onglet FONDS (§40) ────────────────────────────────────────────────

function OngletFonds({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<FondStudio[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("general");
  const [upload, setUpload] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);

  // ⭐ V3.91 — confirmations PERSONNALISÉES pour chaque action sensible.
  const confirmation = useConfirmation();

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`${apiBase}/backgrounds?tous=1`, { cache: "no-store" });
      if (res.ok) {
        setItems(((await lireJsonSur(res)) as { items?: FondStudio[] }).items || []);
      }
    } finally {
      setChargement(false);
    }
  }, [apiBase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ajouter = async () => {
    if (!fichier || !nom.trim()) return;
    setUpload(true);
    try {
      const form = new FormData();
      form.append("file", fichier);
      form.append("name", nom.trim());
      form.append("category", categorie);
      const res = await fetch(`${apiBase}/backgrounds`, { method: "POST", body: form });
      const data = (await lireJsonSur(res)) as { error?: string };
      if (!res.ok) throw new Error(String(data.error || "Ajout impossible"));
      setNom("");
      setFichier(null);
      afficherToast("Fond ajouté à la bibliothèque.", "succes");
      charger();
    } catch (e) {
      afficherToast(e instanceof Error ? e.message : "Ajout impossible", "erreur");
    } finally {
      setUpload(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Ajout */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
        <Champ label="Nom du fond *" value={nom} onChange={setNom} placeholder="Ex. Feu nocturne" />
        <div>
          <label className="block text-[11px] font-semibold text-[#1E0F2B] mb-1.5">Catégorie</label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
          >
            {[
              "general", "predication", "enseignement", "delivrance",
              "priere", "evenement", "conference", "louange", "jeunesse",
            ].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#1E0F2B] mb-1.5">
            Image (1920×1080+)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="text-xs text-[#8A8378] file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[#2A0E3D] file:text-[#FAF6EF] file:text-xs file:font-semibold"
          />
        </div>
        <button
          onClick={ajouter}
          disabled={upload || !fichier || !nom.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] disabled:opacity-40"
        >
          {upload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ajouter
        </button>
      </div>

      {/* Galerie */}
      {chargement ? (
        <div className="flex justify-center py-12 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-12 text-center">
          <ImageIcon className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucun fond — ajoutez des arrière-plans 1920×1080 ou plus.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.imageUrl} alt={f.name} className="w-full aspect-video object-cover" />
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1E0F2B] truncate">{f.name}</p>
                  <p className="text-[10px] text-[#8A8378]">{f.category}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      await fetch(`${apiBase}/backgrounds/${f.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: !f.isActive }),
                      });
                      charger();
                    }}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold border",
                      f.isActive
                        ? "bg-[#5B7052]/10 text-[#3F5039] border-[#5B7052]/30"
                        : "bg-[#8A8378]/10 text-[#8A8378] border-[#8A8378]/30"
                    )}
                  >
                    {f.isActive ? "Actif" : "Inactif"}
                  </button>
                  <button
                    onClick={async () => {
                      const confirme = await confirmation.demander({
                        titre: "Supprimer ce fond ?",
                        message:
                          "Le fond sera retiré de la bibliothèque. Les créations déjà générées avec ce fond sont conservées.",
                        detail: f.name,
                        libelleConfirmer: "Supprimer le fond",
                        variante: "suppression",
                      });
                      if (!confirme) return;
                      await fetch(`${apiBase}/backgrounds/${f.id}`, { method: "DELETE" });
                      charger();
                    }}
                    className="p-1.5 rounded-md border border-[#B3452E]/30 text-[#B3452E] hover:bg-[#B3452E]/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ⭐ V3.91 — confirmation personnalisée (suppression d'un fond). */}
      {confirmation.modal}
    </div>
  );
}

// ─── Onglet PHOTOS DES INTERVENANTS (§11/§12 — V3.90 : noms libres) ────

function OngletPhotos({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<PhotoIntervenant[]>([]);
  const [chargement, setChargement] = useState(true);
  const [intervenant, setIntervenant] = useState("Pasteur Kongo");
  const [rogner, setRogner] = useState<File | null>(null);
  // ⭐ V3.91 — confirmation personnalisée pour la suppression d'une photo.
  const confirmation = useConfirmation();

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`${apiBase}/speakers`, { cache: "no-store" });
      if (res.ok) {
        setItems(((await lireJsonSur(res)) as { items?: PhotoIntervenant[] }).items || []);
      }
    } finally {
      setChargement(false);
    }
  }, [apiBase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ajouter = async (blob: Blob) => {
    const nom = intervenant.replace(/\s+/g, " ").trim() || "Intervenant";
    try {
      const form = new FormData();
      form.append("file", new File([blob], "photo-rognee.png", { type: "image/png" }));
      form.append("speaker_name", nom);
      const res = await fetch(`${apiBase}/speakers/upload-photo`, {
        method: "POST",
        body: form,
      });
      const data = (await lireJsonSur(res)) as {
        error?: string;
        detourage?: { ok?: boolean; couverture?: number };
      };
      if (!res.ok) throw new Error(String(data.error || "Ajout impossible"));
      afficherToast(
        data.detourage?.ok
          ? `Photo de ${nom} enregistrée — détourage réussi (${data.detourage.couverture} % du fond supprimé).`
          : `Photo de ${nom} enregistrée — fond complexe, photo originale conservée.`,
        data.detourage?.ok ? "succes" : "info"
      );
      charger();
    } catch (e) {
      afficherToast(e instanceof Error ? e.message : "Ajout impossible", "erreur");
    }
  };

  const parIntervenant = useMemo<Record<string, PhotoIntervenant[]>>(() => {
    const groupes: Record<string, PhotoIntervenant[]> = {};
    for (const p of items) {
      groupes[p.speakerName] = groupes[p.speakerName] || [];
      groupes[p.speakerName].push(p);
    }
    return groupes;
  }, [items]);

  const nomsExistants = useMemo(
    () => Object.keys(parIntervenant).sort((a, b) => a.localeCompare(b, "fr")),
    [parIntervenant]
  );

  return (
    <div className="space-y-5">
      {/* Ajout — nom LIBRE + rognage façon Canva */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-[#1E0F2B] mb-1.5">
            Intervenant (nom libre)
          </label>
          <input
            value={intervenant}
            onChange={(e) => setIntervenant(e.target.value)}
            list="noms-intervenants-studio"
            maxLength={80}
            placeholder="Ex. Pasteur Kongo, chanteur Jean…"
            className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
          />
          <datalist id="noms-intervenants-studio">
            {nomsExistants.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className="text-[10px] text-[#8A8378] mt-1">
            Tapez n&apos;importe quel nom — les photos sont rangées par
            intervenant.
          </p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#1E0F2B] mb-1.5">
            Photo (fond uni de préférence)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f) setRogner(f);
              e.target.value = "";
            }}
            className="text-xs text-[#8A8378] file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[#2A0E3D] file:text-[#FAF6EF] file:text-xs file:font-semibold"
          />
          <p className="text-[10px] text-[#8A8378] mt-1">
            Rognage à l&apos;import, puis détourage automatique (une seule fois).
          </p>
        </div>
        <p className="text-[10px] text-[#8A8378] sm:hidden">
          Choisissez d&apos;abord un fichier — rognez puis validez.
        </p>
      </div>

      {chargement ? (
        <div className="flex justify-center py-12 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        Object.entries(parIntervenant).map(([nom, photos]) => (
          <div key={nom} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A3821C]">
              {nom} ({photos.length})
            </p>
            <div className="flex gap-3 overflow-x-auto scrollbar-discrete pb-2">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative w-28 h-28 rounded-xl overflow-hidden border border-[#8A8378]/15 bg-[#1A0826] flex-shrink-0 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.cutoutUrl || p.originalUrl}
                    alt={p.speakerName}
                    className="w-full h-full object-contain"
                  />
                  {p.isProcessed && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#5B7052] text-white text-[9px] font-bold">
                      détourée
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      const confirme = await confirmation.demander({
                        titre: "Supprimer cette photo ?",
                        message:
                          "La photo sera retirée de la bibliothèque de l'intervenant. Les visuels déjà générés restent intacts.",
                        detail: p.speakerName,
                        libelleConfirmer: "Supprimer la photo",
                        variante: "suppression",
                      });
                      if (!confirme) return;
                      await fetch(`${apiBase}/speakers/${p.id}`, { method: "DELETE" });
                      charger();
                    }}
                    className="absolute inset-0 bg-[#1A0826]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[#FAF6EF]"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal de rognage partagée avec l'onglet Créer. */}
      {rogner && (
        <ModalRogner
          fichier={rogner}
          onFerme={() => setRogner(null)}
          onValide={(blob) => {
            setRogner(null);
            ajouter(blob);
          }}
        />
      )}
      {/* ⭐ V3.91 — confirmation personnalisée (suppression d'une photo). */}
      {confirmation.modal}
    </div>
  );
}

// ─── Petits composants utilitaires ─────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A3821C]">
        {label}
      </p>
      {children}
    </div>
  );
}

/** ⭐ V3.92 — bouton compact de réglage (ouvre sa section en modal).
 * Affiche le réglage EN COURS + un point doré si personnalisé. */
function BoutonSection({
  icone: Icone,
  titre,
  valeur,
  modifie = false,
  avertissement = false,
  onClick,
}: {
  icone: typeof Palette;
  titre: string;
  valeur: React.ReactNode;
  modifie?: boolean;
  avertissement?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Ouvrir le réglage : ${titre}`}
      className={cn(
        "relative flex flex-col items-start justify-center gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-all min-h-[64px]",
        modifie
          ? "border-[#C9A227] bg-[#C9A227]/[0.07]"
          : "border-[#8A8378]/15 bg-white hover:border-[#C9A227]/50 hover:bg-[#C9A227]/[0.04]"
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#1E0F2B] leading-none w-full">
        <Icone
          className={cn(
            "w-4 h-4 flex-shrink-0",
            modifie ? "text-[#A3821C]" : "text-[#8A8378]"
          )}
        />
        <span className="truncate">{titre}</span>
      </span>
      <span
        className={cn(
          "text-[10px] leading-snug font-semibold w-full truncate",
          avertissement ? "text-[#B3452E]" : "text-[#8A8378]"
        )}
      >
        {valeur}
      </span>
      {modifie && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#C9A227]"
          title="Réglage personnalisé"
        />
      )}
    </button>
  );
}

function Champ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#1E0F2B] mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
      />
    </div>
  );
}
