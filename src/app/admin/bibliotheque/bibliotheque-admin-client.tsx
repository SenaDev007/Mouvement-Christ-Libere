"use client";

/**
 * Client — /admin/bibliotheque
 * Gestion CRUD de la bibliothèque documentaire.
 */

import { useState } from "react";
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

export function BibliothequeAdminClient({ books: booksInit, servants }: Props) {
  const [books, setBooks] = useState<Book[]>(booksInit);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<Book>>({
    title: "",
    author: "",
    description: "",
    category: "Enseignements",
    coverUrl: "",
    fileUrl: "",
    pageCount: null,
    language: "Français",
    publishedYear: null,
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
      pageCount: null,
      language: "Français",
      publishedYear: null,
      isPublished: true,
      sortOrder: 0,
      servantId: null,
    });
    setEditionId(null);
    setShowForm(false);
  };

  const ouvrirEdition = (book: Book) => {
    setForm(book);
    setEditionId(book.id);
    setShowForm(true);
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
    if (!confirm(`Supprimer « ${book.title} » ?`)) return;
    setEnCours(`del-${book.id}`);
    try {
      const res = await fetch(`/admin/api/books/${book.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec suppression");
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      setInfo("Livre supprimé.");
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
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Titre *</label>
                <input
                  type="text"
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Auteur *</label>
                <input
                  type="text"
                  value={form.author || ""}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Catégorie</label>
                <select
                  value={form.category || "Autres"}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Serviteur</label>
                <select
                  value={form.servantId || ""}
                  onChange={(e) => setForm({ ...form, servantId: e.target.value || null })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="">— Collectif —</option>
                  {servants.map((s) => (
                    <option key={s.id} value={s.id}>{s.shortName} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Description</label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227] resize-y"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">URL miniature (couverture)</label>
                <input
                  type="text"
                  value={form.coverUrl || ""}
                  onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                  placeholder="https://... ou chemin R2"
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] text-sm focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">URL fichier PDF</label>
                <input
                  type="text"
                  value={form.fileUrl || ""}
                  onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                  placeholder="https://... ou chemin R2"
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] text-sm focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Nombre de pages</label>
                <input
                  type="number"
                  value={form.pageCount ?? ""}
                  onChange={(e) => setForm({ ...form, pageCount: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Année de publication</label>
                <input
                  type="number"
                  value={form.publishedYear ?? ""}
                  onChange={(e) => setForm({ ...form, publishedYear: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Langue</label>
                <input
                  type="text"
                  value={form.language || "Français"}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Ordre d'affichage</label>
                <input
                  type="number"
                  value={form.sortOrder ?? 0}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isPublished !== false}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <label className="text-sm">Publié (visible sur le site public)</label>
            </div>
            <button
              onClick={sauvegarder}
              disabled={enCours === "save"}
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
                  </div>
                  <p className="text-xs text-[#FAF6EF]/50">
                    {book.author} · {book.category}
                    {book.servantShortName ? ` · ${book.servantShortName}` : ""}
                    {book.pageCount ? ` · ${book.pageCount}p` : ""}
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
