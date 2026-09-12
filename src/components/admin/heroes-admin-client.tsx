"use client";

/**
 * ============================================================
 * ⭐ V3.45 — BACK-OFFICE : SECTIONS HERO DU SITE (/admin/heroes)
 * ============================================================
 *
 * Le pasteur peut modifier, POUR CHAQUE PAGE PUBLIQUE, sans toucher
 * au code :
 *   - la PHOTO D'ARRIÈRE-PLAN de la section hero (upload compressé
 *     ≤ 150 Ko, ratio préservé — bannières paysage ou portraits) ;
 *   - l'accroche dorée (kicker), le titre, la partie dorée du titre,
 *     le sous-titre ;
 *   - les boutons (libellé + lien) ;
 *   - les champs spécifiques : photos de Pam et du Pasteur Kongo sur
 *     la landing, photo + biographie markdown complète des serviteurs,
 *     badges, libellés des cartes…
 *
 * Flux : lignes de la table HeroSection (une par page, semées à partir
 * des valeurs par défaut du code) → fusion client avec les défauts →
 * formulaires générés depuis le schéma HERO_FIELDS →
 * PATCH /admin/api/heroes/[id] (ou POST si la ligne manque).
 *
 * « Réinitialiser » remet TOUTES les valeurs par défaut du code.
 * NB : dans les textes, « Israël » s'affichera automatiquement
 * « Isolélé (Israël) » avec Isolélé en gras sur le site public.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, Loader2, Save, RotateCcw, ExternalLink,
  Sparkles, Image as ImageIcon, FileText, AlertCircle, CheckCircle2,
} from "lucide-react";
import { compressHeroImage } from "@/lib/avatar-upload";
import {
  DEFAULT_HEROES, HERO_PAGES, getHeroFields,
  type HeroConfig, type HeroFieldDef,
} from "@/lib/hero-defaults";
import { IsololeText } from "@/lib/isolole";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────

interface HeroRow {
  id: string;
  page: string;
  kicker: string | null;
  title: string | null;
  titleAccent: string | null;
  titleSuffix: string | null;
  subtitle: string | null;
  backgroundImage: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  cta2Label: string | null;
  cta2Href: string | null;
  dataJson: string | null;
  updatedAt: string;
}

/** Fusion ligne DB + défauts (même logique que src/lib/heroes.ts). */
function mergeRow(row: HeroRow): HeroConfig {
  const base = DEFAULT_HEROES[row.page];
  if (!base) return base ?? rowToConfig(row);
  let data = { ...base.data };
  if (row.dataJson) {
    try {
      const parsed = JSON.parse(row.dataJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string") data[k] = v;
        }
      }
    } catch { /* JSON corrompu → défauts */ }
  }
  return {
    page: row.page,
    kicker: row.kicker ?? base.kicker,
    title: row.title ?? base.title,
    titleAccent: row.titleAccent ?? base.titleAccent,
    titleSuffix: row.titleSuffix ?? base.titleSuffix,
    subtitle: row.subtitle ?? base.subtitle,
    backgroundImage: row.backgroundImage ?? base.backgroundImage,
    ctaLabel: row.ctaLabel ?? base.ctaLabel,
    ctaHref: row.ctaHref ?? base.ctaHref,
    cta2Label: row.cta2Label ?? base.cta2Label,
    cta2Href: row.cta2Href ?? base.cta2Href,
    data,
  };
}

function rowToConfig(row: HeroRow): HeroConfig {
  let data: Record<string, string> = {};
  try {
    const parsed = row.dataJson ? JSON.parse(row.dataJson) : {};
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string") data[k] = v;
      }
    }
  } catch { /* ignore */ }
  return {
    page: row.page,
    kicker: row.kicker ?? "",
    title: row.title ?? row.page,
    titleAccent: row.titleAccent ?? "",
    titleSuffix: row.titleSuffix ?? "",
    subtitle: row.subtitle ?? "",
    backgroundImage: row.backgroundImage ?? "",
    ctaLabel: row.ctaLabel ?? "",
    ctaHref: row.ctaHref ?? "",
    cta2Label: row.cta2Label ?? "",
    cta2Href: row.cta2Href ?? "",
    data,
  };
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15 transition-all placeholder:text-[#8A857C]/50";

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────

export function HeroesAdminClient() {
  const router = useRouter();
  const [rows, setRows] = useState<HeroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Éditeur
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busyImage, setBusyImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/admin/api/heroes?limit=100");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setRows((data.items || []) as HeroRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Config fusionnée d'une page (défauts ↔ ligne DB). */
  const getConfig = (page: string): HeroConfig => {
    const row = rows.find((r) => r.page === page);
    if (row) return mergeRow(row);
    return DEFAULT_HEROES[page] ?? rowToConfig({
      id: "", page, kicker: null, title: null, titleAccent: null, titleSuffix: null,
      subtitle: null, backgroundImage: null, ctaLabel: null, ctaHref: null,
      cta2Label: null, cta2Href: null, dataJson: null, updatedAt: "",
    });
  };

  const rowFor = (page: string): HeroRow | undefined => rows.find((r) => r.page === page);

  // ─── Ouvrir l'éditeur d'une page ───────────────────────────
  const startEdit = (page: string) => {
    const cfg = getConfig(page);
    const fields = getHeroFields(page);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = f.key.startsWith("data.")
        ? cfg.data[f.key.slice(5)] ?? ""
        : (cfg as unknown as Record<string, string>)[f.key] ?? "";
    }
    setForm(initial);
    setEditingPage(page);
    setSaveError("");
    setJustSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingPage(null);
    setForm({});
    setSaveError("");
  };

  // ─── Upload d'image (compression ratio préservé) ───────────
  const handleImage = async (fieldKey: string, file: File) => {
    setBusyImage(fieldKey);
    setSaveError("");
    try {
      const dataUrl = await compressHeroImage(file);
      setForm((f) => ({ ...f, [fieldKey]: dataUrl }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Image invalide");
    } finally {
      setBusyImage(null);
    }
  };

  // ─── Enregistrer ───────────────────────────────────────────
  const handleSave = async () => {
    if (!editingPage) return;
    setSaving(true);
    setSaveError("");
    setJustSaved(false);
    try {
      const page = editingPage;
      const fields = getHeroFields(page);
      const body: Record<string, string> = {};
      const data: Record<string, string> = {};
      for (const f of fields) {
        const value = (form[f.key] ?? "").trim();
        if (f.key.startsWith("data.")) {
          const k = f.key.slice(5);
          if (value || getConfig(page).data[k]) data[k] = form[f.key] ?? "";
        } else {
          body[f.key] = value;
        }
      }
      // dataJson : clés présentes dans le schéma (les clés retirées
      // retombent sur les défauts côté rendu public)
      body.dataJson = JSON.stringify(data);

      const row = rowFor(page);
      const res = row
        ? await fetch(`/admin/api/heroes/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/admin/api/heroes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page, ...body }),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      await load();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  // ─── Réinitialiser aux valeurs par défaut ──────────────────
  const handleReset = async () => {
    if (!editingPage) return;
    const page = editingPage;
    const def = DEFAULT_HEROES[page];
    const row = rowFor(page);
    if (!def || !row) {
      setSaveError("Cette page est déjà aux valeurs par défaut.");
      return;
    }
    if (!window.confirm(
      "Remettre cette page aux valeurs par défaut du site ?\nToutes vos personnalisations (photo, textes) de cette page seront perdues."
    )) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/admin/api/heroes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kicker: def.kicker,
          title: def.title,
          titleAccent: def.titleAccent,
          titleSuffix: def.titleSuffix,
          subtitle: def.subtitle,
          backgroundImage: def.backgroundImage,
          ctaLabel: def.ctaLabel,
          ctaHref: def.ctaHref,
          cta2Label: def.cta2Label,
          cta2Href: def.cta2Href,
          dataJson: JSON.stringify(def.data ?? {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      await load();
      startEdit(page);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDU 1 : éditeur d'une page
  // ─────────────────────────────────────────────────────────
  if (editingPage) {
    const meta = HERO_PAGES.find((p) => p.page === editingPage);
    const fields = getHeroFields(editingPage);
    const cfg = getConfig(editingPage);

    return (
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={cancelEdit}
              className="w-10 h-10 flex-shrink-0 rounded-xl border-2 border-[#8A857C]/20 text-[#8A857C] hover:border-[#FF7A1A] hover:text-[#FF7A1A] transition-colors flex items-center justify-center"
              aria-label="Retour à la liste"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-[#000000] truncate">
                Section hero — {meta?.label || editingPage}
              </h1>
              <p className="text-xs text-[#8A857C] truncate">
                {meta?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#8A857C] hover:bg-[#8A857C]/10 transition-colors disabled:opacity-40"
              title="Remettre les valeurs par défaut"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Par défaut
            </button>
            <a
              href={meta?.href || "/"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#C9A227] hover:bg-[#FF7A1A]/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Voir la page
            </a>
          </div>
        </div>

        {/* Aperçu du hero */}
        <div className="mb-6 rounded-2xl overflow-hidden border-2 border-[#8A857C]/15 shadow-sm">
          <div className="relative h-40 md:h-48 bg-[#000000] flex items-center justify-center overflow-hidden">
            {form.backgroundImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.backgroundImage}
                alt="Aperçu"
                className="absolute inset-0 w-full h-full object-cover opacity-25"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/70 via-[#000000]/80 to-[#000000]" />
            <div className="relative z-10 text-center px-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-3 h-3 text-[#C9A227]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C9A227]">
                  <IsololeText>{form.kicker || "Accroche"}</IsololeText>
                </span>
              </div>
              <p className="font-serif font-extrabold text-lg md:text-xl text-[#F0E9DE] leading-tight">
                <IsololeText>{form.title || "Titre"}</IsololeText>
                {form.titleAccent ? (
                  <>
                    {" "}
                    <span className="text-[#C9A227]">
                      <IsololeText>{form.titleAccent}</IsololeText>
                    </span>
                  </>
                ) : null}
                {form.titleSuffix ? (
                  <> <IsololeText>{form.titleSuffix}</IsololeText></>
                ) : null}
              </p>
              {form.subtitle && (
                <p className="text-[11px] md:text-xs text-[#F0E9DE]/70 leading-relaxed max-w-lg mx-auto mt-2 line-clamp-2">
                  <IsololeText>{form.subtitle}</IsololeText>
                </p>
              )}
            </div>
          </div>
          <div className="bg-[#F0E9DE] px-4 py-2 text-[10px] text-[#8A857C] italic border-t border-[#8A857C]/10">
            Aperçu simplifié — le rendu réel reprend la mise en page de la page concernée.
          </div>
        </div>

        {/* Messages */}
        {saveError && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
          </div>
        )}
        {justSaved && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Enregistré — les modifications sont visibles immédiatement sur le site public.
          </div>
        )}

        {/* Formulaire — généré depuis le schéma de champs */}
        <div className="bg-white rounded-2xl border border-[#8A857C]/15 shadow-sm p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                value={form[f.key] ?? ""}
                busy={busyImage === f.key}
                onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                onImage={(file) => handleImage(f.key, file)}
                defaultPreview={
                  f.key.startsWith("data.")
                    ? cfg.data[f.key.slice(5)] ?? ""
                    : (cfg as unknown as Record<string, string>)[f.key] ?? ""
                }
                fullWidth={f.type !== "text" || !!f.key.match(/subtitle|Desc|quote|Quote|help|Help|href|Href|Text/i)}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A857C] hover:bg-[#8A857C]/10 transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !!busyImage}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#000000] text-[#F0E9DE] font-bold text-sm hover:bg-[#161513] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDU 2 : liste des pages
  // ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[#000000] flex items-center gap-2.5">
          <ImageIcon className="w-6 h-6 text-[#C9A227]" />
          Sections Hero du site
        </h1>
        <p className="text-sm text-[#8A857C] mt-1 max-w-2xl leading-relaxed">
          Modifiez la photo d&apos;arrière-plan, les titres et les textes de la
          grande bannière de chaque page — ainsi que les photos de Pam et du
          Pasteur Kongo et les biographies. Les changements sont visibles
          immédiatement sur le site public.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#C9A227] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {HERO_PAGES.map((meta) => {
            const cfg = getConfig(meta.page);
            const row = rowFor(meta.page);
            const modifie = row?.updatedAt
              ? new Date(row.updatedAt).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "short", year: "numeric",
                })
              : null;
            return (
              <button
                key={meta.page}
                onClick={() => startEdit(meta.page)}
                className="group text-left bg-white rounded-2xl border border-[#8A857C]/15 shadow-sm hover:shadow-xl hover:border-[#FF7A1A]/50 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Aperçu miniature */}
                <div className="relative h-28 bg-[#000000] overflow-hidden flex items-center justify-center">
                  {cfg.backgroundImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cfg.backgroundImage}
                      alt={meta.label}
                      className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-40 transition-opacity"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/60 to-[#000000]" />
                  <div className="relative z-10 text-center px-3">
                    <span className="block text-[9px] uppercase tracking-[0.2em] font-semibold text-[#C9A227] truncate">
                      {cfg.kicker || "—"}
                    </span>
                    <span className="block font-serif font-bold text-sm text-[#F0E9DE] truncate mt-0.5">
                      {cfg.title}
                      {cfg.titleAccent ? ` ${cfg.titleAccent}` : ""}
                    </span>
                  </div>
                  {/* Badge caméra */}
                  <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#C9A227] text-[#000000] flex items-center justify-center shadow-lg opacity-90">
                    <Camera className="w-4 h-4" />
                  </span>
                </div>

                {/* Corps */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-sm font-bold text-[#000000]">{meta.label}</p>
                  <p className="text-xs text-[#8A857C] leading-relaxed mt-1 flex-1">
                    {meta.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-[#8A857C]/70">
                      {modifie ? `Modifié le ${modifie}` : "Valeurs par défaut"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] group-hover:gap-2 transition-all">
                      Modifier <FileText className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Rendu d'un champ (texte / zone / markdown / image)
// ─────────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  busy,
  defaultPreview,
  onChange,
  onImage,
  fullWidth,
}: {
  field: HeroFieldDef;
  value: string;
  busy: boolean;
  defaultPreview: string;
  onChange: (v: string) => void;
  onImage: (file: File) => void;
  fullWidth: boolean;
}) {
  const isData = value.startsWith("data:");
  const preview = value || defaultPreview;

  return (
    <div className={cn(fullWidth || field.type === "image" || field.type === "markdown" ? "md:col-span-2" : "")}>
      <label className="block text-xs font-bold text-[#000000] mb-1.5">
        {field.label}
      </label>
      {field.help && (
        <p className="text-[11px] text-[#8A857C]/90 leading-relaxed mb-2 -mt-1">
          {field.help}
        </p>
      )}

      {field.type === "text" && (
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Laisser vide pour masquer"}
        />
      )}

      {(field.type === "textarea" || field.type === "markdown") && (
        <textarea
          className={cn(inputClass, "resize-y font-mono")}
          style={{ minHeight: field.type === "markdown" ? (field.rows ?? 14) * 20 : (field.rows ?? 3) * 24 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.type === "image" && (
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-28 h-20 rounded-xl border-2 border-[#C9A227]/30 overflow-hidden bg-[#000000] flex items-center justify-center shadow">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={field.label} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-[#C9A227]/50" />
              )}
              {busy && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <label
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227] text-[#000000] font-bold text-xs hover:bg-[#FF7A1A] transition-colors cursor-pointer shadow"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              Choisir une image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                aria-label={field.label}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImage(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[10px] text-[#8A857C]/80 leading-relaxed">
              {isData
                ? "Image personnalisée — compressée automatiquement (≤ 150 Ko)."
                : preview
                  ? "Image par défaut du site (ou URL externe)."
                  : "Aucune image."}
            </p>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
              >
                Retirer l&apos;image personnalisée
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
