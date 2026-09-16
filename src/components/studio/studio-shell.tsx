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
  Check,
  Upload,
  Plus,
  Film,
  X,
  Save,
  FilePlus2,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CleFormat,
  CleVariante,
  TypeVisuel,
} from "@/lib/visual-generator/types";
import { FORMATS } from "@/lib/visual-generator/types";
import { ZoneToasts, afficherToast, ModalRogner } from "./studio-ui";

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
}

type Onglet = "creer" | "creations" | "templates" | "fonds" | "photos";

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
    }),
    [
      typeVisuel, titre, accroche, intervenants, fondId, style, templateId,
      formatsChoisis, dateEvenement, heureEvenement, lieuEvenement, verset,
      videoId,
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

  /** Efface tout et repart de zéro (brouillon compris). */
  const repartirDeZero = useCallback(() => {
    if (
      !confirm(
        "Effacer le travail en cours (titre, intervenants, photos sélectionnées) et repartir de zéro ?"
      )
    ) {
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
    afficherToast("Nouveau visuel — page réinitialisée.", "info");
  }, [templates]);

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
          const meta = await rMeta.json();
          setStyles(meta.styles || []);
          setIaActive(Boolean(meta.ia?.active));
        }
        let listeTemplates: TemplateStudio[] = [];
        if (rTemplates.ok) {
          listeTemplates = (await rTemplates.json()).items || [];
          setTemplates(listeTemplates);
        }
        let listeFonds: FondStudio[] = [];
        if (rFonds.ok) {
          listeFonds = (await rFonds.json()).items || [];
          setFonds(listeFonds);
        }
        let listePhotos: PhotoIntervenant[] = [];
        if (rPhotos.ok) {
          listePhotos = (await rPhotos.json()).items || [];
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import impossible");
        setPhotos((anciennes) => [data.item, ...anciennes]);
        setIntervenants((liste) =>
          liste.map((iv, j) => (j === index ? { ...iv, photoId: data.item.id } : iv))
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Peaufinage impossible");
        setPhotos((anciennes) => [data.item, ...anciennes]);
        setIntervenants((liste) =>
          liste.map((iv, j) => (j === index ? { ...iv, photoId: data.item.id } : iv))
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Génération impossible");
      setFonds((anciens) => [data.item, ...anciens]);
      setFondId(data.item.id);
      afficherToast("Fond généré par l'IA et sélectionné.", "succes");
    } catch (e) {
      afficherToast(e instanceof Error ? e.message : "Génération impossible", "erreur");
    } finally {
      setFondIAOccupe(false);
    }
  }, [apiBase, fondIAPrompt, fondIAOccupe, style]);

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
        const data = await res.json();
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
          formats: formatsChoisis,
          variants: variantesCiblees,
          event_date: dateEvenement || undefined,
          event_time: heureEvenement || undefined,
          event_location: lieuEvenement || undefined,
          bible_verse: verset || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Génération impossible");
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

        {/* Étape 3 — Style */}
        <Section label="3. Style">
          <div className="grid grid-cols-2 gap-1.5">
            {styles.map((s) => (
              <button
                key={s.key}
                onClick={() => setStyle(s.key)}
                title={s.ambiance}
                className={cn(
                  "px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-all text-left",
                  style === s.key
                    ? "border-[#C9A227] bg-[#C9A227]/5 text-[#A3821C]"
                    : "border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Étape 4 — Template */}
        <Section label="4. Template">
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
        </Section>

        {/* Étape 5 — Fond (facultatif) + IA */}
        <Section label="5. Fond (facultatif)">
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
        </Section>

        {/* Événement (affiches) */}
        {typeVisuel === "affiche" && (
          <Section label="6. Informations événement">
            <div className="grid grid-cols-2 gap-2">
              <Champ label="Date" type="date" value={dateEvenement} onChange={setDateEvenement} />
              <Champ label="Heure" value={heureEvenement} onChange={setHeureEvenement} placeholder="19h00" />
            </div>
            <Champ label="Lieu" value={lieuEvenement} onChange={setLieuEvenement} placeholder="Cotonou" />
            <Champ label="Référence biblique" value={verset} onChange={setVerset} placeholder="Ésaïe 61:1" />
          </Section>
        )}

        {/* Formats */}
        <Section
          label={typeVisuel === "miniature" ? "6. Formats d'export" : "7. Formats d'export"}
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
        </Section>
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
      if (res.ok) setItems((await res.json()).items || []);
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

  const dupliquer = async () => {
    setOccupe(true);
    await fetch(`${apiBase}/creations/${creation.id}`, { method: "POST" });
    setOccupe(false);
    afficherToast("Création dupliquée — la copie est modifiable depuis « Créer ».");
    onSupprime?.();
  };
  const supprimer = async () => {
    if (!confirm("Supprimer définitivement cette création (fichiers cloud inclus) ?")) return;
    setOccupe(true);
    await fetch(`${apiBase}/creations/${creation.id}`, { method: "DELETE" });
    setOccupe(false);
    onSupprime?.();
  };
  const appliquerVideo = async () => {
    if (
      !confirm("Utiliser ce visuel comme miniature de la vidéo associée (remplace l'actuelle) ?")
    )
      return;
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
      if (res.ok) setItems((await res.json()).items || []);
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

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`${apiBase}/backgrounds?tous=1`, { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items || []);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ajout impossible");
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
                      if (!confirm(`Supprimer le fond « ${f.name} » ?`)) return;
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
    </div>
  );
}

// ─── Onglet PHOTOS DES INTERVENANTS (§11/§12 — V3.90 : noms libres) ────

function OngletPhotos({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<PhotoIntervenant[]>([]);
  const [chargement, setChargement] = useState(true);
  const [intervenant, setIntervenant] = useState("Pasteur Kongo");
  const [rogner, setRogner] = useState<File | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`${apiBase}/speakers`, { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items || []);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ajout impossible");
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

  const parIntervenant = useMemo(() => {
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
                      if (!confirm("Supprimer cette photo ?")) return;
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
