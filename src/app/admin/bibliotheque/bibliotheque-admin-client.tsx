"use client";

/**
 * Client — /admin/bibliotheque
 * Gestion CRUD de la bibliothèque documentaire.
 *
 * ⭐ V4.40 — Uploads DIRECTS : la couverture et le PDF partent du navigateur
 * vers Cloudflare R2 via une URL pré-signée (aucune limite de taille
 * Vercel — le fichier ne transite pas par le serveur), avec barre de
 * progression. Le PDF est ensuite ANALYSÉ automatiquement par le serveur
 * (pdf-lib) : nombre de pages réel, taille exacte, titre / auteur / année
 * des métadonnées du document — les champs vides du formulaire sont
 * pré-remplis (l'humain garde le dernier mot).
 *
 * Nouveaux champs professionnels : ISBN, éditeur, mots-clés (tags),
 * téléchargeable (lecture en ligne seule si décoché).
 */

import { useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Upload,
  FileText,
  ImagePlus,
  Sparkles,
  X,
} from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  coverUrl: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  pageCount: number | null;
  language: string;
  publishedYear: number | null;
  isbn: string | null;
  editeur: string | null;
  tags: string | null;
  isDownloadable: boolean;
  downloadCount: number;
  isPublished: boolean;
  sortOrder: number;
  servantId: string | null;
  servantCode: string | null;
  servantShortName: string | null;
  createdAt: string;
}

interface ServantLite {
  id: string;
  code: string;
  shortName: string;
  fullName: string;
}

interface Props {
  books: Book[];
  servants: ServantLite[];
}

const CATEGORIES = [
  "Enseignements",
  "Prière & Intercession",
  "Révélations",
  "Délivrance",
  "Vie Chrétienne",
  "Prophéties",
  "Jeunesse",
  "Santé & Guérison",
  "Famille & Couple",
  "Finances Royaume",
  "Adoration & Louanges",
  "Autres",
];

// Plafonds côté navigateur (avant même l'envoi) — guardrails UX.
const TAILLE_MAX_PDF = 100 * 1024 * 1024; // 100 Mo
const TAILLE_MAX_COUVERTURE = 10 * 1024 * 1024; // 10 Mo

/** État d'un upload en cours (PDF ou couverture). */
interface EtatUpload {
  enCours: boolean;
  progres: number; // 0 → 100
  nomFichier: string | null;
  erreur: string | null;
}

const ETAT_UPLOAD_VIDE: EtatUpload = {
  enCours: false,
  progres: 0,
  nomFichier: null,
  erreur: null,
};

/** Taille lisible en français (ex. « 2,4 Mo »). */
function formatTaille(octets: number | null | undefined): string {
  if (octets == null || octets <= 0) return "";
  if (octets < 1024) return `${octets} o`;
  const ko = octets / 1024;
  if (ko < 1024) return `${ko.toFixed(ko < 10 ? 1 : 0).replace(".", ",")} Ko`;
  const mo = ko / 1024;
  return `${mo.toFixed(mo < 10 ? 1 : 0).replace(".", ",")} Mo`;
}

/**
 * Envoie le fichier DIRECTEMENT au stockage R2 via une URL pré-signée
 * (XHR : seul moyen d'avoir la progression d'envoi dans le navigateur).
 * Retourne l'URL publique finale du fichier.
 */
async function envoyerVersR2(
  file: File,
  type: "pdf" | "couverture",
  onProgress: (pct: number) => void
): Promise<string> {
  const pres = await fetch("/admin/api/books/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      filename: file.name,
      contentType: file.type || (type === "pdf" ? "application/pdf" : "image/jpeg"),
    }),
  });
  const presData = (await pres.json().catch(() => ({}))) as {
    uploadUrl?: string;
    publicUrl?: string;
    error?: string;
  };
  if (!pres.ok) {
    throw new Error(presData.error || `Échec de la préparation de l'envoi (${pres.status})`);
  }
  if (!presData.uploadUrl || !presData.publicUrl) {
    throw new Error("Réponse d'upload incomplète du serveur.");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presData.uploadUrl as string);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || (type === "pdf" ? "application/pdf" : "image/jpeg")
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Envoi refusé par le stockage (HTTP ${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Envoi interrompu (réseau ou CORS) — réessayez ; si l'échec persiste, /admin/r2-test diagnostique le stockage."
        )
      );
    xhr.send(file);
  });

  return presData.publicUrl;
}

/** Résultat de l'analyse automatique du PDF (scan-pdf). */
interface ResultatAnalyse {
  enCours: boolean;
  resume: string | null;
  erreur: string | null;
}

const ANALYSE_VIDE: ResultatAnalyse = { enCours: false, resume: null, erreur: null };

export function BibliothequeAdminClient({ books: booksInit, servants }: Props) {
  const [books, setBooks] = useState<Book[]>(booksInit);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Uploads + analyse
  const [uploadPdf, setUploadPdf] = useState<EtatUpload>(ETAT_UPLOAD_VIDE);
  const [uploadCouverture, setUploadCouverture] = useState<EtatUpload>(ETAT_UPLOAD_VIDE);
  const [analyse, setAnalyse] = useState<ResultatAnalyse>(ANALYSE_VIDE);
  const inputPdfRef = useRef<HTMLInputElement | null>(null);
  const inputCouvertureRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<Book>>({
    title: "",
    author: "",
    description: "",
    category: "Enseignements",
    coverUrl: "",
    fileUrl: "",
    fileSize: null,
    pageCount: null,
    language: "Français",
    publishedYear: null,
    isbn: "",
    editeur: "",
    tags: "",
    isDownloadable: true,
    isPublished: true,
    sortOrder: 0,
    servantId: null,
  });

  const resetForm = () => {
    setForm({
      title: "",
      author: "",
      description: "",
      category: "Enseignements",
      coverUrl: "",
      fileUrl: "",
      fileSize: null,
      pageCount: null,
      language: "Français",
      publishedYear: null,
      isbn: "",
      editeur: "",
      tags: "",
      isDownloadable: true,
      isPublished: true,
      sortOrder: 0,
      servantId: null,
    });
    setUploadPdf(ETAT_UPLOAD_VIDE);
    setUploadCouverture(ETAT_UPLOAD_VIDE);
    setAnalyse(ANALYSE_VIDE);
    setEditionId(null);
    setShowForm(false);
  };

  const ouvrirEdition = (book: Book) => {
    setForm({ ...book });
    setUploadPdf(ETAT_UPLOAD_VIDE);
    setUploadCouverture(ETAT_UPLOAD_VIDE);
    setAnalyse(ANALYSE_VIDE);
    setEditionId(book.id);
    setShowForm(true);
  };

  // ─── Upload du PDF (fichier choisi) ─────────────────────────────────

  const choisirPdf = async (file: File) => {
    setErreur(null);
    if (file.type && !/^application\/pdf$/i.test(file.type)) {
      setErreur("Ce fichier n'est pas un PDF. Choisissez un document .pdf.");
      return;
    }
    if (file.size > TAILLE_MAX_PDF) {
      setErreur(`PDF trop volumineux (${formatTaille(file.size)}) — plafond : 100 Mo.`);
      return;
    }

    setUploadPdf({ enCours: true, progres: 0, nomFichier: file.name, erreur: null });
    setAnalyse(ANALYSE_VIDE);
    try {
      const publicUrl = await envoyerVersR2(file, "pdf", (pct) =>
        setUploadPdf((prev) => ({ ...prev, progres: pct }))
      );
      setForm((prev) => ({ ...prev, fileUrl: publicUrl, fileSize: file.size }));
      setUploadPdf((prev) => ({ ...prev, enCours: false, progres: 100 }));

      // ─── Analyse intelligente : pages, taille, métadonnées ───
      setAnalyse({ enCours: true, resume: null, erreur: null });
      try {
        const res = await fetch("/admin/api/books/scan-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: publicUrl }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          analysed?: boolean;
          pageCount?: number;
          fileSize?: number;
          pdfTitle?: string | null;
          pdfAuthor?: string | null;
          pdfYear?: number | null;
          error?: string;
        };

        if (data.analysed) {
          // Pré-remplissage SEULEMENT des champs laissés vides : l'humain
          // garde le dernier mot sur ce qu'il a déjà saisi.
          const dejaTitre = !!form.title?.trim();
          const dejaAuteur = !!form.author?.trim();
          const pdfTitle = data.pdfTitle?.trim() || "";
          const pdfAuthor = data.pdfAuthor?.trim() || "";
          let morceaux = "";
          if (!dejaTitre && pdfTitle) morceaux += ` · titre : « ${pdfTitle} »`;
          if (!dejaAuteur && pdfAuthor) morceaux += ` · auteur : « ${pdfAuthor} »`;
          setForm((prev) => ({
            ...prev,
            pageCount: prev.pageCount ?? data.pageCount ?? null,
            fileSize: data.fileSize ?? prev.fileSize ?? null,
            title: dejaTitre ? prev.title : pdfTitle || prev.title,
            author: dejaAuteur ? prev.author : pdfAuthor || prev.author,
            publishedYear: prev.publishedYear ?? data.pdfYear ?? null,
          }));
          setAnalyse({
            enCours: false,
            resume: `✓ ${data.pageCount} page${(data.pageCount ?? 0) > 1 ? "s" : ""} détectée${
              (data.pageCount ?? 0) > 1 ? "s" : ""
            } · ${formatTaille(data.fileSize ?? file.size)}${morceaux}`,
            erreur: null,
          });
        } else {
          setForm((prev) => ({ ...prev, fileSize: data.fileSize ?? prev.fileSize ?? null }));
          setAnalyse({
            enCours: false,
            resume: null,
            erreur: data.error || "Analyse impossible — renseignez les pages manuellement.",
          });
        }
      } catch {
        setAnalyse({
          enCours: false,
          resume: null,
          erreur: "Analyse indisponible — renseignez les pages manuellement.",
        });
      }
    } catch (err) {
      setUploadPdf({
        enCours: false,
        progres: 0,
        nomFichier: file.name,
        erreur: err instanceof Error ? err.message : "Échec de l'envoi.",
      });
    }
  };

  // ─── Upload de la couverture (fichier choisi) ───────────────────────

  const choisirCouverture = async (file: File) => {
    setErreur(null);
    if (file.type && !/^image\/(jpeg|png|webp|avif)$/i.test(file.type)) {
      setErreur("Couverture : choisissez une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > TAILLE_MAX_COUVERTURE) {
      setErreur(`Image trop volumineuse (${formatTaille(file.size)}) — plafond : 10 Mo.`);
      return;
    }

    setUploadCouverture({ enCours: true, progres: 0, nomFichier: file.name, erreur: null });
    try {
      const publicUrl = await envoyerVersR2(file, "couverture", (pct) =>
        setUploadCouverture((prev) => ({ ...prev, progres: pct }))
      );
      setForm((prev) => ({ ...prev, coverUrl: publicUrl }));
      setUploadCouverture((prev) => ({ ...prev, enCours: false, progres: 100 }));
    } catch (err) {
      setUploadCouverture({
        enCours: false,
        progres: 0,
        nomFichier: file.name,
        erreur: err instanceof Error ? err.message : "Échec de l'envoi.",
      });
    }
  };

  const sauvegarder = async () => {
    if (!form.title?.trim() || !form.author?.trim()) {
      setErreur("Titre et auteur requis.");
      return;
    }
    setEnCours("save");
    setErreur(null);
    try {
      const isEdit = !!editionId;
      const res = await fetch(
        isEdit ? `/admin/api/books/${editionId}` : "/admin/api/books",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setInfo(isEdit ? "Livre modifié." : "Livre créé.");
      resetForm();
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur sauvegarde.");
    } finally {
      setEnCours(null);
    }
  };

  const supprimer = async (book: Book) => {
    if (!confirm(`Supprimer « ${book.title} » ?\n\nSa couverture et son PDF seront aussi retirés du stockage.`)) return;
    setEnCours(`del-${book.id}`);
    try {
      const res = await fetch(`/admin/api/books/${book.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec suppression");
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      setInfo("Livre supprimé (fichiers du stockage purgés).");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur suppression.");
    } finally {
      setEnCours(null);
    }
  };

  const basculerPublication = async (book: Book) => {
    setEnCours(`pub-${book.id}`);
    try {
      const res = await fetch(`/admin/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !book.isPublished }),
      });
      if (!res.ok) throw new Error("Échec");
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, isPublished: !book.isPublished } : b))
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setEnCours(null);
    }
  };

  const recharger = async () => {
    const res = await fetch("/admin/api/books");
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { books?: Book[] } | null;
      if (data?.books) setBooks(data.books);
    }
  };

  const inputCls =
    "w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]";
  const inputClsSm =
    "w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] text-sm focus:outline-none focus:border-[#C9A227]";
  const labelCls = "text-xs uppercase tracking-wide text-[#FAF6EF]/60";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A0826] to-[#2A0E3D] text-[#FAF6EF] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#C9A227]" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Bibliothèque</h1>
              <p className="text-sm text-[#FAF6EF]/60">
                {books.length} livre{books.length > 1 ? "s" : ""} ·{" "}
                {books.filter((b) => b.isPublished).length} publié{books.filter((b) => b.isPublished).length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-bold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showForm ? "Annuler" : "Nouveau livre"}
          </button>
        </div>

        {/* Notifications */}
        {erreur && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{erreur}</span>
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {/* Formulaire */}
        {showForm && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              {editionId ? "Modifier le livre" : "Nouveau livre"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Titre *</label>
                <input
                  type="text"
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Auteur *</label>
                <input
                  type="text"
                  value={form.author || ""}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Catégorie</label>
                <select
                  value={form.category || "Autres"}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                {/* ⭐ V4.40 — libellés SANS parenthèses : « Afrika », « Pasteur
                    Kongo » — le code technique n'a rien à faire ici. */}
                <label className={labelCls}>Serviteur</label>
                <select
                  value={form.servantId || ""}
                  onChange={(e) => setForm({ ...form, servantId: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— Collectif —</option>
                  {servants.map((s) => (
                    <option key={s.id} value={s.id}>{s.shortName}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className={`${inputCls} resize-y`}
                />
              </div>
            </div>

            {/* ─── ⭐ V4.40 — Zone fichier PDF (upload direct + analyse) ─── */}
            <div className="rounded-xl border border-white/10 bg-[#1A0826]/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-sm font-semibold">Fichier PDF du livre</span>
                </div>
                {form.fileUrl ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={form.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C9A227] hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ouvrir le PDF actuel
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, fileUrl: "", fileSize: null })
                      }
                      className="text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1"
                      title="Retirer le fichier"
                    >
                      <X className="w-3 h-3" />
                      Retirer
                    </button>
                  </div>
                ) : null}
              </div>

              <input
                ref={inputPdfRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = ""; // permet de re-choisir le même fichier
                  if (f) void choisirPdf(f);
                }}
              />
              {uploadPdf.enCours ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
                    <span className="truncate">{uploadPdf.nomFichier}</span>
                    <span className="ml-auto text-[#FAF6EF]/60">{uploadPdf.progres}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#C9A227] transition-all"
                      style={{ width: `${uploadPdf.progres}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputPdfRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-[#C9A227]/50 hover:border-[#C9A227] rounded-lg px-4 py-3 text-sm text-[#FAF6EF]/80 hover:text-[#C9A227] transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {form.fileUrl
                    ? "Remplacer le PDF…"
                    : "Choisir un fichier PDF… (jusqu'à 100 Mo)"}
                </button>
              )}
              {uploadPdf.erreur && (
                <p className="text-xs text-red-300 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {uploadPdf.erreur}
                </p>
              )}

              {/* Résultat de l'analyse automatique */}
              {analyse.enCours && (
                <p className="text-xs text-[#C9A227]/80 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyse du document (pages, métadonnées)…
                </p>
              )}
              {analyse.resume && (
                <p className="text-xs text-green-300 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Analyse automatique : {analyse.resume}</span>
                </p>
              )}
              {analyse.erreur && (
                <p className="text-xs text-amber-300 flex items-start gap-1.5">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{analyse.erreur}</span>
                </p>
              )}
            </div>

            {/* ─── ⭐ V4.40 — Zone couverture (upload direct) ─── */}
            <div className="rounded-xl border border-white/10 bg-[#1A0826]/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-[#C9A227]" />
                <span className="text-sm font-semibold">Miniature de couverture</span>
              </div>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-24 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#3D1A54] to-[#2A0E3D] flex items-center justify-center border border-white/10">
                  {form.coverUrl ? (
                    <img src={form.coverUrl} alt="Couverture" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-8 h-8 text-[#C9A227]/60" />
                  )}
                </div>
                <div className="flex-1 min-w-[220px] space-y-2">
                  <input
                    ref={inputCouvertureRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void choisirCouverture(f);
                    }}
                  />
                  {uploadCouverture.enCours ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
                        <span className="truncate">{uploadCouverture.nomFichier}</span>
                        <span className="ml-auto text-[#FAF6EF]/60">{uploadCouverture.progres}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-[#C9A227] transition-all"
                          style={{ width: `${uploadCouverture.progres}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => inputCouvertureRef.current?.click()}
                        className="inline-flex items-center gap-2 border border-dashed border-[#C9A227]/50 hover:border-[#C9A227] rounded-lg px-4 py-2.5 text-sm text-[#FAF6EF]/80 hover:text-[#C9A227] transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {form.coverUrl ? "Remplacer…" : "Choisir une image… (JPG, PNG, WebP)"}
                      </button>
                      {form.coverUrl && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, coverUrl: "" })}
                          className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 px-2"
                        >
                          <X className="w-3.5 h-3.5" />
                          Retirer
                        </button>
                      )}
                    </div>
                  )}
                  {uploadCouverture.erreur && (
                    <p className="text-xs text-red-300 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {uploadCouverture.erreur}
                    </p>
                  )}
                  <p className="text-[11px] text-[#FAF6EF]/40">
                    Format conseillé : portrait 3:4 (ex. 600 × 800 px). Sans couverture,
                    le site affiche un dégradé aux couleurs de la catégorie.
                  </p>
                </div>
              </div>
            </div>

            {/* URL manuelle — secours (PDF hébergé ailleurs, image externe) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-[#FAF6EF]/50 hover:text-[#C9A227] text-xs uppercase tracking-wide">
                Avancé — URL manuelle (PDF ou image hébergée ailleurs)
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="space-y-1">
                  <label className={labelCls}>URL miniature externe</label>
                  <input
                    type="text"
                    value={form.coverUrl || ""}
                    onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                    placeholder="https://…"
                    className={inputClsSm}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>URL PDF externe</label>
                  <input
                    type="text"
                    value={form.fileUrl || ""}
                    onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                    placeholder="https://…"
                    className={inputClsSm}
                  />
                </div>
              </div>
            </details>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Nombre de pages</label>
                <input
                  type="number"
                  value={form.pageCount ?? ""}
                  onChange={(e) => setForm({ ...form, pageCount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Auto si PDF analysé"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Taille du fichier</label>
                <input
                  type="text"
                  readOnly
                  value={form.fileSize ? formatTaille(form.fileSize) : ""}
                  placeholder="Auto à l'upload"
                  className={`${inputCls} opacity-70 cursor-not-allowed`}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Année de publication</label>
                <input
                  type="number"
                  value={form.publishedYear ?? ""}
                  onChange={(e) => setForm({ ...form, publishedYear: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Langue</label>
                <input
                  type="text"
                  value={form.language || "Français"}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                {/* ⭐ V4.40 — champ professionnel : ISBN */}
                <label className={labelCls}>ISBN</label>
                <input
                  type="text"
                  value={form.isbn || ""}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  placeholder="978-… (optionnel)"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                {/* ⭐ V4.40 — champ professionnel : éditeur */}
                <label className={labelCls}>Éditeur</label>
                <input
                  type="text"
                  value={form.editeur || ""}
                  onChange={(e) => setForm({ ...form, editeur: e.target.value })}
                  placeholder="Maison d'édition (optionnel)"
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                {/* ⭐ V4.40 — champ professionnel : mots-clés */}
                <label className={labelCls}>Mots-clés (séparés par des virgules)</label>
                <input
                  type="text"
                  value={form.tags || ""}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="jeunesse, prière, guérison…"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Ordre d'affichage</label>
                <input
                  type="number"
                  value={form.sortOrder ?? 0}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPublished !== false}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Publié (visible sur le site public)
              </label>
              {/* ⭐ V4.40 — contrôler le téléchargement (lecture en ligne seule) */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDownloadable !== false}
                  onChange={(e) => setForm({ ...form, isDownloadable: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                Téléchargeable (sinon lecture en ligne seule)
              </label>
            </div>
            <button
              onClick={sauvegarder}
              disabled={enCours === "save" || uploadPdf.enCours || uploadCouverture.enCours}
              className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-50 text-[#1E0F2B] font-bold px-5 py-2 rounded-lg transition-colors"
            >
              {enCours === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editionId ? "Enregistrer" : "Créer le livre"}
            </button>
          </div>
        )}

        {/* Liste des livres */}
        <div className="space-y-3">
          {books.length === 0 ? (
            <p className="text-center text-[#FAF6EF]/50 py-12">Aucun livre. Cliquez « Nouveau livre » pour commencer.</p>
          ) : (
            books.map((book) => (
              <div
                key={book.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-4"
              >
                {/* Miniature */}
                <div className="w-12 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#3D1A54] to-[#2A0E3D] flex items-center justify-center">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-[#C9A227]" />
                  )}
                </div>
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{book.title}</span>
                    {!book.isPublished && (
                      <span className="text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-full">
                        Brouillon
                      </span>
                    )}
                    {!book.isDownloadable && (
                      <span className="text-xs bg-[#C9A227]/20 text-[#DDBE55] px-2 py-0.5 rounded-full">
                        Lecture seule
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#FAF6EF]/50">
                    {book.author} · {book.category}
                    {book.servantShortName ? ` · ${book.servantShortName}` : ""}
                    {book.pageCount ? ` · ${book.pageCount}p` : ""}
                    {book.fileSize ? ` · ${formatTaille(book.fileSize)}` : ""}
                    {book.downloadCount > 0 ? ` · ${book.downloadCount} téléch.` : ""}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  {book.fileUrl && (
                    <a
                      href={book.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Ouvrir le PDF"
                    >
                      <ExternalLink className="w-4 h-4 text-[#C9A227]" />
                    </a>
                  )}
                  <button
                    onClick={() => basculerPublication(book)}
                    disabled={enCours === `pub-${book.id}`}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={book.isPublished ? "Masquer" : "Publier"}
                  >
                    {book.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => ouvrirEdition(book)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => supprimer(book)}
                    disabled={enCours === `del-${book.id}`}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-300"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
