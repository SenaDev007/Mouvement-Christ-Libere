"use client";

/**
 * ⭐ V3.59 — Bibliothèque de médias intégrée à la post-production.
 *
 * Catalogue Mixkit complet scrapé en build-time (métadonnées uniquement) :
 *  - 465 effets sonores (Guerre, Humain, Transport, Animaux, Notifications,
 *    Drôle, Technologie, Nature, Instruments + bonus)
 *  - 759 musiques (103 genres : cinématique, religieux, lo-fi, gospel…)
 *  - 258 vidéos stock 1080p (Nature, Louange, Villes, Espace…)
 *  - 313 templates Premiere Pro / After Effects / Final Cut Pro / DaVinci
 *    Resolve (titres, transitions, tiers inférieurs, intros, logos…)
 *
 * Deux modes d'ajout :
 *  ① « + »    → ajout IMMÉDIAT à la timeline via l'URL CDN (instantané) ;
 *  ② « ⤓ R2 » → téléchargement serveur → stockage DURABLE sur notre R2
 *                (route /api/post-production/assets/import) puis ajout.
 *
 * + Import par URL directe (Pixabay ou toute source https) : la licence
 *   Pixabay interdit le scraping massif — on ouvre la recherche sur leur
 *   site et l'utilisateur colle l'URL du fichier qu'il veut intégrer.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Play, Square, Plus, Download, Loader2, Search, Music, Video as VideoIcon,
  FileArchive, Link as LinkIcon, CheckCircle2, AlertCircle, ExternalLink,
  ChevronDown, Volume2, Library as LibraryIcon, Info,
} from "lucide-react";
import {
  chargerSfx, chargerMusiques, chargerVideos, chargerTemplates,
  CATEGORIES_SFX, CATEGORIES_VIDEOS, LOGICIELS_TEMPLATES, SOUS_CATS_TEMPLATES,
  PIXABAY_RECHERCHE, formaterDuree,
  type MixkitSfx, type MixkitMusic, type MixkitVideo, type MixkitTemplate,
} from "@/lib/data/mixkit-library";

// ─── Props ───

export interface AjoutAudio {
  name: string;
  url: string;
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

export interface AjoutClipVideo {
  name: string;
  url: string;
  duration?: number;
}

interface LibraryPanelProps {
  onAddAudio: (a: AjoutAudio) => void;
  onAddVideoClip: (c: AjoutClipVideo) => void;
}

type Vue = "sfx" | "music" | "videos" | "templates" | "url";

const VUES: { id: Vue; label: string; icone: typeof Music }[] = [
  { id: "sfx", label: "Sons", icone: Volume2 },
  { id: "music", label: "Musiques", icone: Music },
  { id: "videos", label: "Vidéos", icone: VideoIcon },
  { id: "templates", label: "Templates", icone: FileArchive },
  { id: "url", label: "Par URL", icone: LinkIcon },
];

const PAGE = 40; // items affichés par « page »

// ─── Types d'état d'import R2 par item ───
interface StatutImport {
  etat: "chargement" | "ok" | "erreur";
  message?: string;
  url?: string;
}

// ═══════════════════════ Composant ═══════════════════════

export function LibraryPanel({ onAddAudio, onAddVideoClip }: LibraryPanelProps) {
  const [vue, setVue] = useState<Vue>("sfx");

  // Catalogues (chargés paresseusement)
  const [sfx, setSfx] = useState<MixkitSfx[] | null>(null);
  const [musiques, setMusiques] = useState<MixkitMusic[] | null>(null);
  const [videos, setVideos] = useState<MixkitVideo[] | null>(null);
  const [templates, setTemplates] = useState<MixkitTemplate[] | null>(null);

  // Filtres
  const [recherche, setRecherche] = useState("");
  const [catSfx, setCatSfx] = useState<string>("warfare");
  const [catVideo, setCatVideo] = useState<string>("populaires");
  const [logiciel, setLogiciel] = useState<string>("premiere-pro");
  const [sousCat, setSousCat] = useState<string>("populaires");
  const [genre, setGenre] = useState<string>("populaires");

  // Affichage
  const [nbAffiches, setNbAffiches] = useState(PAGE);
  const [lectureEnCours, setLectureEnCours] = useState<string | null>(null);
  const [videoApercue, setVideoApercue] = useState<string | null>(null);

  // Import R2
  const [imports, setImports] = useState<Record<string, StatutImport>>({});
  const [templatesTelecharges, setTemplatesTelecharges] = useState<{ nom: string; url: string }[]>([]);

  // Import par URL
  const [urlImport, setUrlImport] = useState("");
  const [nomImport, setNomImport] = useState("");
  const [typeImport, setTypeImport] = useState<"audio" | "video" | "fichier">("audio");
  const [importStatut, setImportStatut] = useState<{ etat: "repos" | "chargement" | "ok" | "erreur"; message?: string; url?: string }>({ etat: "repos" });

  // Lecteur audio partagé
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Chargement paresseux des catalogues ───
  useEffect(() => {
    if (vue === "sfx" && !sfx) chargerSfx().then(setSfx).catch(() => setSfx([]));
    if (vue === "music" && !musiques) chargerMusiques().then(setMusiques).catch(() => setMusiques([]));
  }, [vue, sfx, musiques]);

  useEffect(() => {
    if (vue === "videos" && !videos) chargerVideos().then(setVideos).catch(() => setVideos([]));
    if (vue === "templates" && !templates) chargerTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, [vue, videos, templates]);

  // Nettoyage audio à la sortie
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // ─── Lecture / arrêt d'un aperçu audio ───
  const toggleLecture = useCallback((id: string, url: string) => {
    if (lectureEnCours === id) {
      audioRef.current?.pause();
      setLectureEnCours(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.onended = () => setLectureEnCours(null);
    audioRef.current.play().catch(() => setLectureEnCours(null));
    setLectureEnCours(id);
  }, [lectureEnCours]);

  // ─── Filtrage ───
  const q = recherche.trim().toLowerCase();
  const filtrer = <T,>(items: T[], champ: (t: T) => string) =>
    q ? items.filter((t) => champ(t).toLowerCase().includes(q)) : items;

  const sfxFiltres = useMemo(() => {
    if (!sfx) return [];
    return filtrer(sfx.filter((s) => s.c === catSfx), (s) => s.n);
  }, [sfx, catSfx, q]);

  const musiquesFiltrees = useMemo(() => {
    if (!musiques) return [];
    return filtrer(musiques.filter((m) => m.g === genre), (m) => m.n);
  }, [musiques, genre, q]);

  const genresDisponibles = useMemo(() => {
    if (!musiques) return [];
    const vus = new Set<string>();
    const out: { slug: string; label: string }[] = [];
    for (const m of musiques) {
      if (!vus.has(m.g)) {
        vus.add(m.g);
        out.push({ slug: m.g, label: m.gl });
      }
    }
    // Populaires d'abord, puis tri alphabétique
    return out.sort((a, b) =>
      a.slug === "populaires" ? -1 : b.slug === "populaires" ? 1 : a.label.localeCompare(b.label, "fr")
    );
  }, [musiques]);

  const videosFiltrees = useMemo(() => {
    if (!videos) return [];
    return filtrer(videos.filter((v) => v.c === catVideo), (v) => v.n);
  }, [videos, catVideo, q]);

  const templatesFiltres = useMemo(() => {
    if (!templates) return [];
    return filtrer(
      templates.filter((t) => t.s === logiciel && (q ? true : t.c === sousCat)),
      (t) => `${t.n} ${t.x} ${t.k}`
    );
  }, [templates, logiciel, sousCat, q]);

  // ─── Import R2 (route serveur) ───
  const importerVersR2 = useCallback(
    async (id: string, url: string, nom: string, type: string, fallbackUrl?: string) => {
      setImports((p) => ({ ...p, [id]: { etat: "chargement" } }));
      try {
        const res = await fetch("/api/post-production/assets/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, name: nom, type, fallbackUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
        setImports((p) => ({ ...p, [id]: { etat: "ok", url: data.url } }));
        return data.url as string;
      } catch (e) {
        setImports((p) => ({
          ...p,
          [id]: { etat: "erreur", message: e instanceof Error ? e.message : "Erreur" },
        }));
        return null;
      }
    },
    []
  );

  // ─── Actions d'ajout ───
  const ajouterSfx = (s: MixkitSfx, viaR2 = false) => {
    if (viaR2) {
      importerVersR2(`sfx-${s.id}`, s.w, s.n, "sfx", s.p).then((url) => {
        if (url) onAddAudio({ name: `${s.n} (R2)`, url, volume: 0.5, fadeIn: 0.1, fadeOut: 0.3 });
      });
    } else {
      onAddAudio({ name: s.n, url: s.p, volume: 0.5, fadeIn: 0.1, fadeOut: 0.3 });
    }
  };

  const ajouterMusique = (m: MixkitMusic, viaR2 = false) => {
    if (viaR2) {
      importerVersR2(`music-${m.id}`, m.p, m.n, "music").then((url) => {
        if (url) onAddAudio({ name: `${m.n} (R2)`, url, volume: 0.3, loop: true, fadeIn: 1, fadeOut: 2 });
      });
    } else {
      onAddAudio({ name: m.n, url: m.p, volume: 0.3, loop: true, fadeIn: 1, fadeOut: 2 });
    }
  };

  const ajouterVideo = (v: MixkitVideo, viaR2 = false) => {
    // Durée : mesurée côté client pour un clip correct dans la timeline
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = v.p;
    const ajouter = (url: string) => {
      onAddVideoClip({
        name: v.n,
        url,
        duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined,
      });
    };
    if (viaR2) {
      importerVersR2(`video-${v.id}`, v.f, v.n, "video", v.p).then((url) => {
        if (url) ajouter(url);
      });
    } else {
      ajouter(v.p);
    }
  };

  const telechargerTemplate = (t: MixkitTemplate) => {
    importerVersR2(`tpl-${t.id}`, t.z, `${t.sl} ${t.n}`, "template", t.p).then((url) => {
      if (url) {
        setTemplatesTelecharges((p) => [{ nom: `${t.sl} — ${t.n}`, url }, ...p].slice(0, 20));
        // Téléchargement navigateur immédiat
        const a = document.createElement("a");
        a.href = url;
        a.download = `${t.n}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    });
  };

  // ─── Import par URL (Pixabay & co) ───
  const importerDepuisUrl = async () => {
    if (!urlImport.trim()) return;
    setImportStatut({ etat: "chargement" });
    try {
      const res = await fetch("/api/post-production/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlImport.trim(),
          name: nomImport.trim() || undefined,
          type: typeImport === "fichier" ? "template" : typeImport,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setImportStatut({ etat: "ok", url: data.url, message: `${(data.size / 1024 / 1024).toFixed(1)} Mo — ${data.contentType}` });
      // Ajout automatique à la timeline pour audio/vidéo
      if (typeImport === "audio") {
        onAddAudio({
          name: nomImport.trim() || "Import URL",
          url: data.url,
          volume: 0.4,
          loop: true,
          fadeIn: 1,
          fadeOut: 2,
        });
      } else if (typeImport === "video") {
        onAddVideoClip({ name: nomImport.trim() || "Import URL", url: data.url });
      } else {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.fileName || "fichier";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setUrlImport("");
      setNomImport("");
    } catch (e) {
      setImportStatut({
        etat: "erreur",
        message: e instanceof Error ? e.message : "Import impossible",
      });
    }
  };

  // ─── Rendu commun ───
  const nbTotal =
    (sfx?.length ?? 0) + (musiques?.length ?? 0) + (videos?.length ?? 0) + (templates?.length ?? 0);

  const Puce = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${
        active ? "bg-[#2A0E3D] text-white" : "bg-[#2A0E3D]/5 text-[#8A8378] hover:bg-[#2A0E3D]/10"
      }`}
    >
      {children}
    </button>
  );

  const BoutonAjouter = ({ onClick, titre = "Ajouter à la timeline (instantané)" }: { onClick: () => void; titre?: string }) => (
    <button onClick={onClick} title={titre}
      className="flex-shrink-0 w-7 h-7 rounded-full bg-[#C9A227]/20 text-[#A3821C] hover:bg-[#C9A227]/30 flex items-center justify-center transition-colors">
      <Plus className="w-3.5 h-3.5" />
    </button>
  );

  const BoutonR2 = ({ id, onClick, titre = "Télécharger et stocker durablement sur R2, puis ajouter" }: { id: string; onClick: () => void; titre?: string }) => {
    const st = imports[id];
    if (st?.etat === "chargement") {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A227] flex-shrink-0" />;
    }
    if (st?.etat === "ok") {
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />;
    }
    return (
      <button onClick={onClick} title={titre}
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          st?.etat === "erreur" ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-[#2A0E3D]/10 text-[#2A0E3D] hover:bg-[#2A0E3D]/20"
        }`}>
        {st?.etat === "erreur" ? <AlertCircle className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
      </button>
    );
  };

  const ErreurImport = ({ id }: { id: string }) => {
    const st = imports[id];
    if (st?.etat !== "erreur" || !st.message) return null;
    return <p className="text-[9px] text-red-600 px-2 pb-1 -mt-1 leading-tight">{st.message}</p>;
  };

  const ListeAffichee = ({ total, children }: { total: number; children: React.ReactNode }) => (
    <div className="space-y-1">
      {children}
      {total > nbAffiches && (
        <button
          onClick={() => setNbAffiches((n) => n + PAGE)}
          className="w-full py-2 rounded-lg bg-[#2A0E3D]/5 text-[10px] font-bold text-[#8A8378] hover:bg-[#2A0E3D]/10 flex items-center justify-center gap-1 transition-colors"
        >
          Afficher plus ({total - nbAffiches} restants) <ChevronDown className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // ═══════ Rendu ═══════

  return (
    <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
      <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378] flex items-center gap-1.5">
        <LibraryIcon className="w-3.5 h-3.5" />
        Bibliothèque Mixkit {nbTotal > 0 && <span className="text-[#C9A227]">· {nbTotal} médias</span>}
      </h3>

      {/* Sous-onglets */}
      <div className="grid grid-cols-5 gap-1 bg-[#2A0E3D]/5 rounded-lg p-1">
        {VUES.map((v) => {
          const Ic = v.icone;
          return (
            <button key={v.id} onClick={() => { setVue(v.id); setNbAffiches(PAGE); setRecherche(""); setVideoApercue(null); }}
              className={`py-1.5 rounded-md text-[9px] font-bold transition-colors flex flex-col items-center gap-0.5 ${
                vue === v.id ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:bg-[#2A0E3D]/10"
              }`}>
              <Ic className="w-3.5 h-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Recherche (toutes vues sauf URL) */}
      {vue !== "url" && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8378]" />
          <input
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setNbAffiches(PAGE); }}
            placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
          />
        </div>
      )}

      {/* ─── VUE SONS ─── */}
      {vue === "sfx" && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES_SFX.map((c) => (
              <Puce key={c.slug} active={catSfx === c.slug} onClick={() => { setCatSfx(c.slug); setNbAffiches(PAGE); }}>
                {c.icone} {c.label}
              </Puce>
            ))}
          </div>
          {!sfx ? (
            <Chargement label="Chargement des effets sonores…" />
          ) : (
            <ListeAffichee total={sfxFiltres.length}>
              {sfxFiltres.slice(0, nbAffiches).map((s) => (
                <div key={s.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      // ⭐ V3.61 — glisser-déposer vers la timeline multi-pistes
                      e.dataTransfer.setData("application/x-pp-audio", JSON.stringify({
                        url: s.p, name: s.n, volume: 0.5, fadeIn: 0.1, fadeOut: 0.3,
                      }));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 transition-colors cursor-grab active:cursor-grabbing">
                    <button onClick={() => toggleLecture(`sfx-${s.id}`, s.p)}
                      title={lectureEnCours === `sfx-${s.id}` ? "Arrêter" : "Écouter"}
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        lectureEnCours === `sfx-${s.id}` ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/10 text-[#2A0E3D] hover:bg-[#2A0E3D]/20"
                      }`}>
                      {lectureEnCours === `sfx-${s.id}` ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <span className="text-xs font-bold flex-1 truncate" title={s.n}>{s.n}</span>
                    <span className="text-[10px] text-[#8A8378] flex-shrink-0">{formaterDuree(s.d)}</span>
                    <BoutonR2 id={`sfx-${s.id}`} onClick={() => ajouterSfx(s, true)} titre="Télécharger le WAV et le stocker sur R2" />
                    <BoutonAjouter onClick={() => ajouterSfx(s)} />
                  </div>
                  <ErreurImport id={`sfx-${s.id}`} />
                </div>
              ))}
              {sfxFiltres.length === 0 && <Vide label="Aucun son ne correspond." />}
            </ListeAffichee>
          )}
        </div>
      )}

      {/* ─── VUE MUSIQUES ─── */}
      {vue === "music" && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1">
            {genresDisponibles.slice(0, 24).map((g) => (
              <Puce key={g.slug} active={genre === g.slug} onClick={() => { setGenre(g.slug); setNbAffiches(PAGE); }}>
                {g.label}
              </Puce>
            ))}
          </div>
          {!musiques ? (
            <Chargement label="Chargement des musiques…" />
          ) : (
            <ListeAffichee total={musiquesFiltrees.length}>
              {musiquesFiltrees.slice(0, nbAffiches).map((m) => (
                <div key={m.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      // ⭐ V3.61 — glisser-déposer vers la timeline multi-pistes
                      e.dataTransfer.setData("application/x-pp-audio", JSON.stringify({
                        url: m.p, name: m.n, volume: 0.3, loop: true, fadeIn: 1, fadeOut: 2,
                      }));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 transition-colors cursor-grab active:cursor-grabbing">
                    <button onClick={() => toggleLecture(`music-${m.id}`, m.p)}
                      title={lectureEnCours === `music-${m.id}` ? "Arrêter" : "Écouter"}
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        lectureEnCours === `music-${m.id}` ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/10 text-[#2A0E3D] hover:bg-[#2A0E3D]/20"
                      }`}>
                      {lectureEnCours === `music-${m.id}` ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" title={m.n}>{m.n}</p>
                      <p className="text-[9px] text-[#8A8378] truncate">{m.gl}</p>
                    </div>
                    <span className="text-[10px] text-[#8A8378] flex-shrink-0">{formaterDuree(m.d)}</span>
                    <BoutonR2 id={`music-${m.id}`} onClick={() => ajouterMusique(m, true)} titre="Télécharger le mp3 et le stocker sur R2" />
                    <BoutonAjouter onClick={() => ajouterMusique(m)} />
                  </div>
                  <ErreurImport id={`music-${m.id}`} />
                </div>
              ))}
              {musiquesFiltrees.length === 0 && <Vide label="Aucune musique ne correspond." />}
            </ListeAffichee>
          )}
        </div>
      )}

      {/* ─── VUE VIDÉOS ─── */}
      {vue === "videos" && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES_VIDEOS.map((c) => (
              <Puce key={c.slug} active={catVideo === c.slug} onClick={() => { setCatVideo(c.slug); setNbAffiches(PAGE); setVideoApercue(null); }}>
                {c.icone} {c.label}
              </Puce>
            ))}
          </div>
          {!videos ? (
            <Chargement label="Chargement des vidéos…" />
          ) : (
            <ListeAffichee total={videosFiltrees.length}>
              {videosFiltrees.slice(0, nbAffiches).map((v) => (
                <div
                  key={v.id}
                  draggable
                  onDragStart={(e) => {
                    // ⭐ V3.61 — glisser-déposer vers la piste V1 de la timeline
                    // (durée mesurée automatiquement à l'ajout via <video> metadata)
                    e.dataTransfer.setData("application/x-pp-video", JSON.stringify({
                      url: v.p, name: v.n,
                    }));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 transition-colors overflow-hidden cursor-grab active:cursor-grabbing">
                  <div className="relative">
                    {videoApercue === v.id ? (
                      <video src={v.p} controls autoPlay muted={false} className="w-full aspect-video bg-black" />
                    ) : (
                      <button onClick={() => setVideoApercue(v.id)} className="relative w-full block group">
                        {v.th && <img src={v.th} alt={v.n} className="w-full aspect-video object-cover" loading="lazy" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 fill-white text-white" />
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <span className="text-[11px] font-bold flex-1 truncate" title={v.n}>{v.n}</span>
                    <BoutonR2 id={`video-${v.id}`} onClick={() => ajouterVideo(v, true)} titre="Télécharger la vidéo 1080p et la stocker sur R2" />
                    <BoutonAjouter onClick={() => ajouterVideo(v)} titre="Ajouter comme clip à la timeline (qualité preview)" />
                  </div>
                  <ErreurImport id={`video-${v.id}`} />
                </div>
              ))}
              {videosFiltrees.length === 0 && <Vide label="Aucune vidéo ne correspond." />}
            </ListeAffichee>
          )}
        </div>
      )}

      {/* ─── VUE TEMPLATES ─── */}
      {vue === "templates" && (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1">
            {LOGICIELS_TEMPLATES.map((l) => (
              <Puce key={l.slug} active={logiciel === l.slug} onClick={() => { setLogiciel(l.slug); setSousCat("populaires"); setNbAffiches(PAGE); setVideoApercue(null); }}>
                {l.icone} {l.label}
              </Puce>
            ))}
          </div>
          {!q && (
            <div className="flex flex-wrap gap-1 border-t border-[#8A8378]/10 pt-2">
              {SOUS_CATS_TEMPLATES.map((c) => (
                <Puce key={c.slug} active={sousCat === c.slug} onClick={() => { setSousCat(c.slug); setNbAffiches(PAGE); setVideoApercue(null); }}>
                  {c.label}
                </Puce>
              ))}
            </div>
          )}
          {templatesTelecharges.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 space-y-1">
              <p className="text-[9px] font-bold text-green-700 uppercase">Templates téléchargés (cette session)</p>
              {templatesTelecharges.map((t, i) => (
                <a key={i} href={t.url} download className="text-[10px] text-green-800 font-bold flex items-center gap-1 hover:underline">
                  <Download className="w-3 h-3" /> {t.nom}
                </a>
              ))}
            </div>
          )}
          {!templates ? (
            <Chargement label="Chargement des templates…" />
          ) : (
            <ListeAffichee total={templatesFiltres.length}>
              {templatesFiltres.slice(0, nbAffiches).map((t) => (
                <div key={t.id} className="rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 transition-colors overflow-hidden">
                  <div className="relative">
                    {videoApercue === t.id ? (
                      <video src={t.p} controls autoPlay loop className="w-full aspect-video bg-black" />
                    ) : (
                      <button onClick={() => setVideoApercue(t.id)} className="relative w-full block group">
                        {t.th && <img src={t.th} alt={t.n} className="w-full aspect-video object-cover" loading="lazy" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 fill-white text-white" />
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="px-2 py-1.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold flex-1 truncate" title={t.n}>{t.n}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#2A0E3D]/10 text-[#8A8378] flex-shrink-0">{t.k.replace(`${t.sl} / `, "")}</span>
                    </div>
                    {t.x && <p className="text-[9px] text-[#8A8378] leading-tight line-clamp-2">{t.x}</p>}
                    <div className="flex items-center gap-1.5">
                      <BoutonR2 id={`tpl-${t.id}`} onClick={() => telechargerTemplate(t)} titre="Télécharger le .zip du template (stocké sur R2)" />
                      <button onClick={() => telechargerTemplate(t)}
                        className="flex-1 py-1 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-[10px] font-bold hover:bg-[#A3821C] flex items-center justify-center gap-1 transition-colors">
                        <Download className="w-3 h-3" /> Télécharger (.zip)
                      </button>
                      {t.u && (
                        <a href={t.u} target="_blank" rel="noopener noreferrer" title="Voir sur Mixkit"
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2A0E3D]/10 text-[#8A8378] hover:bg-[#2A0E3D]/20 flex items-center justify-center">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <ErreurImport id={`tpl-${t.id}`} />
                </div>
              ))}
              {templatesFiltres.length === 0 && <Vide label="Aucun template ne correspond." />}
            </ListeAffichee>
          )}
        </div>
      )}

      {/* ─── VUE IMPORT PAR URL (PIXABAY & AUTRES) ─── */}
      {vue === "url" && (
        <div className="space-y-3">
          <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-bold text-[#1E0F2B] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
              Importer depuis Pixabay (ou toute URL directe)
            </p>
            <p className="text-[10px] text-[#8A8378] leading-relaxed">
              Pixabay autorise le téléchargement manuel (licence libre de droits) mais interdit
              l&apos;aspiration automatique. Ouvrez la recherche ci-dessous, choisissez un média,
              copiez l&apos;adresse du fichier (clic droit → copier l&apos;adresse) et collez-la ici :
              elle sera téléchargée et stockée sur notre R2, puis ajoutée à votre timeline.
            </p>
            <div className="flex gap-1.5 flex-wrap pt-1">
              <a href={PIXABAY_RECHERCHE.sfx} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-[#2A0E3D] text-white text-[10px] font-bold hover:bg-[#1E0F2B] flex items-center gap-1 transition-colors">
                Sons Pixabay <ExternalLink className="w-3 h-3" />
              </a>
              <a href={PIXABAY_RECHERCHE.music} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-[#2A0E3D] text-white text-[10px] font-bold hover:bg-[#1E0F2B] flex items-center gap-1 transition-colors">
                Musiques Pixabay <ExternalLink className="w-3 h-3" />
              </a>
              <a href={PIXABAY_RECHERCHE.video} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-[#2A0E3D] text-white text-[10px] font-bold hover:bg-[#1E0F2B] flex items-center gap-1 transition-colors">
                Vidéos Pixabay <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <input
              value={urlImport}
              onChange={(e) => setUrlImport(e.target.value)}
              placeholder="https://… (mp3, mp4 ou zip)"
              className="w-full px-3 py-1.5 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            />
            <input
              value={nomImport}
              onChange={(e) => setNomImport(e.target.value)}
              placeholder="Nom (optionnel)"
              className="w-full px-3 py-1.5 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            />
            <div className="flex gap-1">
              {(["audio", "video", "fichier"] as const).map((t) => (
                <Puce key={t} active={typeImport === t} onClick={() => setTypeImport(t)}>
                  {t === "audio" ? "Son" : t === "video" ? "Vidéo" : "Fichier (zip)"}
                </Puce>
              ))}
            </div>
            <button
              onClick={importerDepuisUrl}
              disabled={!urlImport.trim() || importStatut.etat === "chargement"}
              className="w-full py-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-xs font-bold hover:bg-[#A3821C] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
              {importStatut.etat === "chargement" ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Téléchargement en cours…</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Télécharger &amp; intégrer</>
              )}
            </button>
            {importStatut.etat === "ok" && (
              <p className="text-[10px] text-green-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Importé {importStatut.message} — ajouté à la timeline
              </p>
            )}
            {importStatut.etat === "erreur" && (
              <p className="text-[10px] text-red-600 font-bold flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {importStatut.message}
              </p>
            )}
          </div>

          <p className="text-[9px] text-[#8A8378] leading-relaxed border-t border-[#8A8378]/10 pt-2">
            Mixkit : licence libre de droits, usage commercial, sans attribution
            (<a href="https://mixkit.co/license/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C9A227]">mixkit.co/license</a>).
            Pixabay : licence Pixabay, conditions sur pixabay.com.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Petits utilitaires de rendu ───

function Chargement({ label }: { label: string }) {
  return (
    <div className="py-8 flex flex-col items-center gap-2 text-[#8A8378]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <p className="text-[10px] font-bold">{label}</p>
    </div>
  );
}

function Vide({ label }: { label: string }) {
  return <p className="py-4 text-center text-[10px] text-[#8A8378] font-bold">{label}</p>;
}
