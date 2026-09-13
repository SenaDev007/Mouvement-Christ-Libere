"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Save, ShieldCheck, UserCog } from "lucide-react";

const ROLES = [
  {
    value: "ADMIN",
    label: "Administrateur",
    desc: "Accès complet au back-office (contenu, médias, communauté) — sauf gestion des admins.",
  },
  {
    value: "MODERATOR",
    label: "Modérateur",
    desc: "Modération des témoignages, messages et commentaires communautaires.",
  },
  {
    value: "ANIMATOR",
    label: "Animateur",
    desc: "Animation des canaux de communauté (publier des messages, gérer les membres).",
  },
];

export default function NewAdminUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
    bio: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/admin/api/users/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-[#8A8378] hover:text-[#C9A227] mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux utilisateurs
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1 flex items-center gap-3">
          <UserCog className="w-7 h-7 text-[#C9A227]" />
          Créer un compte administrateur
        </h1>
        <p className="text-sm text-[#8A8378]">
          Réservé aux super administrateurs (Pam, Pasteur Kongo).
        </p>
      </div>

      {/* Avertissement */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/30">
        <ShieldCheck className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#1E0F2B] leading-relaxed">
          Le compte créé sera <strong>immédiatement actif</strong> et pourra se
          connecter au back-office. Choisissez un mot de passe robuste et
          communiquez-le de façon sécurisée au destinataire. Il pourra le changer
          lui-même après connexion.
        </p>
      </div>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#8A8378]/15 p-6 space-y-5"
      >
        {/* Nom */}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
            Nom affiché *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
            placeholder="Ex : Marie Dubois"
            className="w-full px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          />
          <p className="text-xs text-[#8A8378] mt-1">
            Ce nom sera utilisé pour la connexion au back-office.
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
            Email *
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
            placeholder="marie@christ-libere.org"
            className="w-full px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          />
        </div>

        {/* Mot de passe */}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
            Mot de passe initial *
          </label>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimum 8 caractères"
            className="w-full px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] font-mono"
          />
          <p className="text-xs text-[#8A8378] mt-1">
            L&apos;utilisateur devra le changer après sa première connexion.
          </p>
        </div>

        {/* Rôle */}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
            Rôle *
          </label>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                  form.role === r.value
                    ? "border-[#C9A227] bg-[#C9A227]/5"
                    : "border-[#8A8378]/20 hover:border-[#8A8378]/40"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={form.role === r.value}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 accent-[#C9A227]"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[#1E0F2B]">
                    {r.label}
                  </div>
                  <div className="text-xs text-[#8A8378] mt-0.5">{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Bio optionnelle */}
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
            Note / Bio <span className="normal-case font-normal">(optionnel)</span>
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="Fonction, responsabilité, contexte..."
            className="w-full px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] resize-none"
          />
        </div>

        {/* Erreur */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
          <Link
            href="/admin/users"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading || !form.name || !form.email || !form.password}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-semibold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Créer le compte
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
