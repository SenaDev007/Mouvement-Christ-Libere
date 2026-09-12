"use client";

/**
 * ⭐ V3.66 — Annonces officielles du ministère (Secrétariat).
 *
 * Directive : « la secrétaire sera chargée de faire les annonces… tout ce
 * qui est annonce par rapport au ministère en général ». Module :
 *  · rédaction (titre, contenu, catégorie : générale / live / événement /
 *    urgente) ;
 *  · brouillon → publication (avec date) ;
 *  · RELAIS dans le canal d'annonces Yeshua Connect (communauté) ;
 *  · édition / suppression.
 *
 * Données : /secretariat/api/annonces (rôles SECRETARY / SUPER_ADMIN).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Loader2,
  AlertCircle,
  Plus,
  Send,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Radio,
  Calendar,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";
import { ANNONCE_CATEGORIES } from "@/lib/staff-space/constants";

interface Annonce {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
  publishedAt: string | null;
  relayedToYeshua: boolean;
  relayedAt: string | null;
  createdAt: string;
}

const ICONE_CATEGORIES: Record<string, React.ComponentType<{ className?: string }>> = {
  generale: Megaphone,
  live: Radio,
  evenement: Calendar,
  urgence: AlertTriangle,
};

const FORM_VIDE = {
  title: "",
  content: "",
  category: "generale",
  isPublished: true,
  relayYeshua: false,
};

export default function SecretariatAnnoncesPage() {
  const [items, setItems] = useState<Annonce[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"" | "publiee" | "brouillon">("");

  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...FORM_VIDE });
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurForm, setErreurForm] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (filtreStatut) params.set("statut", filtreStatut);
      const res = await fetch(`/secretariat/api/annonces?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setItems(data.items || []);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [filtreStatut]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirCreation = () => {
    setEditionId(null);
    setForm({ ...FORM_VIDE });
    setErreurForm("");
    setEditeurOuvert(true);
  };

  const ouvrirEdition = (annonce: Annonce) => {
    setEditionId(annonce.id);
    setForm({
      title: annonce.title,
      content: annonce.content,
      category: annonce.category,
      isPublished: annonce.isPublished,
      relayYeshua: false,
    });
    setErreurForm("");
    setEditeurOuvert(true);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setEnregistrement(true);
    setErreurForm("");
    try {
      const res = await fetch(
        editionId ? `/secretariat/api/annonces/${editionId}` : "/secretariat/api/annonces",
        {
          method: editionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEditeurOuvert(false);
      charger();
    } catch (err) {
      setErreurForm(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnregistrement(false);
    }
  };

  const basculerPublication = async (annonce: Annonce) => {
    const res = await fetch(`/secretariat/api/annonces/${annonce.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !annonce.isPublished }),
    });
    if (res.ok) charger();
  };

  const relayer = async (annonce: Annonce) => {
    const res = await fetch(`/secretariat/api/annonces/${annonce.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relayYeshua: true }),
    });
    if (res.ok) charger();
  };

  const supprimer = async (annonce: Annonce) => {
    if (!confirm(`Supprimer définitivement « ${annonce.title} » ?`)) return;
    const res = await fetch(`/secretariat/api/annonces/${annonce.id}`, {
      method: "DELETE",
    });
    if (res.ok) charger();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
            Annonces du ministère
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Lives programmés, événements, communiqués — la voix officielle du
            Mouvement Christ Libère.
          </p>
        </div>
        <button
          onClick={ouvrirCreation}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Rédiger une annonce
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(
          [
            { v: "", l: "Toutes" },
            { v: "publiee", l: "Publiées" },
            { v: "brouillon", l: "Brouillons" },
          ] as const
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltreStatut(f.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtreStatut === f.v
                ? "bg-[#2A0E3D] text-[#FAF6EF]"
                : "bg-white border border-[#8A8378]/15 text-[#8A8378] hover:bg-[#FAF6EF]"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <Megaphone className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucune annonce — rédigez la première pour le ministère.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((annonce) => {
            const categorie =
              ANNONCE_CATEGORIES[annonce.category as keyof typeof ANNONCE_CATEGORIES];
            const Icone =
              ICONE_CATEGORIES[annonce.category] || Megaphone;
            return (
              <div
                key={annonce.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: `${categorie?.couleur ?? "#C9A227"}15`,
                          color: categorie?.couleur ?? "#A3821C",
                          borderColor: `${categorie?.couleur ?? "#C9A227"}30`,
                        }}
                      >
                        <Icone className="w-3 h-3" />
                        {categorie?.libelle ?? annonce.category}
                      </span>
                      {annonce.isPublished ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#5B7052]/10 text-[#3F5039] border border-[#5B7052]/30">
                          Publiée
                          {annonce.publishedAt &&
                            ` le ${new Date(annonce.publishedAt).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8A8378]/10 text-[#6B6459] border border-[#8A8378]/30">
                          Brouillon
                        </span>
                      )}
                      {annonce.relayedToYeshua && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C9A227]/10 text-[#A3821C] border border-[#C9A227]/30">
                          <Check className="w-3 h-3" />
                          Relayée Yeshua Connect
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-bold text-[#1E0F2B]">
                      {annonce.title}
                    </h2>
                    <p className="text-xs text-[#8A8378] whitespace-pre-wrap leading-relaxed mt-1.5 line-clamp-4">
                      {annonce.content}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#8A8378]/10">
                  <button
                    onClick={() => ouvrirEdition(annonce)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A227]/40 text-[#A3821C] text-xs font-semibold hover:bg-[#C9A227]/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                  <button
                    onClick={() => basculerPublication(annonce)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8A8378]/25 text-[#8A8378] text-xs font-semibold hover:bg-[#FAF6EF] transition-colors"
                  >
                    {annonce.isPublished ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Dépublier
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Publier
                      </>
                    )}
                  </button>
                  {annonce.isPublished && !annonce.relayedToYeshua && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Relayer cette annonce dans le canal d'annonces de Yeshua Connect (toute la communauté la recevra) ?"
                          )
                        )
                          relayer(annonce);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8C5FA8] text-white text-xs font-semibold hover:bg-[#6B4480] transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Relayer à la communauté
                    </button>
                  )}
                  <button
                    onClick={() => supprimer(annonce)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#B3452E]/30 text-[#B3452E] text-xs font-semibold hover:bg-[#B3452E]/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Éditeur ── */}
      {editeurOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/60 overflow-y-auto">
          <form
            onSubmit={enregistrer}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-[#1E0F2B]">
                {editionId ? "Modifier l'annonce" : "Nouvelle annonce"}
              </h2>
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:bg-[#FAF6EF]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1.5">
                Titre *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex. Live spécial délivrance — vendredi 20 h"
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1.5">
                Catégorie
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(ANNONCE_CATEGORIES).map(([v, c]) => {
                  const Icone = ICONE_CATEGORIES[v];
                  const actif = form.category === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, category: v })}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border-2 text-[11px] font-semibold transition-all ${
                        actif
                          ? "border-[#C9A227] bg-[#C9A227]/5 text-[#A3821C]"
                          : "border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40"
                      }`}
                    >
                      {Icone && <Icone className="w-4 h-4" />}
                      {c.libelle}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1.5">
                Contenu *
              </label>
              <textarea
                required
                rows={7}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Rédigez l'annonce complète — elle sera visible par le serviteur concerné et, si publiée, dans le registre du ministère…"
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm resize-none"
              />
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A227]"
                />
                <span className="text-xs font-semibold text-[#1E0F2B]">
                  Publier immédiatement
                  <span className="text-[#8A8378] font-normal">
                    {" "}
                    (sinon : enregistrer comme brouillon)
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.relayYeshua}
                  onChange={(e) => setForm({ ...form, relayYeshua: e.target.checked })}
                  className="w-4 h-4 accent-[#8C5FA8]"
                />
                <span className="text-xs font-semibold text-[#1E0F2B]">
                  Relayer dans Yeshua Connect
                  <span className="text-[#8A8378] font-normal">
                    {" "}
                    (canal d&apos;annonces — toute la communauté)
                  </span>
                </span>
              </label>
            </div>

            {erreurForm && <p className="text-xs text-[#B3452E]">{erreurForm}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditeurOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A8378] hover:text-[#1E0F2B]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
              >
                {enregistrement && <Loader2 className="w-4 h-4 animate-spin" />}
                {editionId ? "Enregistrer" : "Créer l'annonce"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
