"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, AlertCircle, Camera } from "lucide-react";
import { compressAvatar } from "@/lib/avatar-upload";

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "datetime-local" | "checkbox" | "tags" | "photo";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  required?: boolean;
  fullWidth?: boolean;
}

interface AdminFormProps {
  entity: string;
  initialData?: Record<string, unknown>;
  fields: FieldDef[];
  redirectTo: string;
  title: string;
  subtitle?: string;
}

export function AdminForm({
  entity,
  initialData,
  fields,
  redirectTo,
  title,
  subtitle,
}: AdminFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ⭐ V2.7 — Champs « photo » : valeur gérée hors FormData (data URL
  // compressée côté client, impossible via un <input type=text> classique)
  const photoFileRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [photoValues, setPhotoValues] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const f of fields) {
      if (f.type === "photo") initial[f.name] = (initialData?.[f.name] as string | null) ?? null;
    }
    return initial;
  });
  const [photoProcessing, setPhotoProcessing] = useState<string | null>(null);

  const handlePhotoChange = async (fieldName: string, file: File | undefined) => {
    if (!file) return;
    setPhotoProcessing(fieldName);
    setError("");
    try {
      const dataUrl = await compressAvatar(file);
      setPhotoValues((prev) => ({ ...prev, [fieldName]: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setPhotoProcessing(null);
      const input = photoFileRef.current[fieldName];
      if (input) input.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, unknown> = {};

      for (const field of fields) {
        if (field.type === "photo") {
          // ⭐ V2.7 — Valeur photo gérée en React state (data URL ou null)
          data[field.name] = photoValues[field.name] ?? null;
          continue;
        }
        const value = formData.get(field.name);

        if (field.type === "checkbox") {
          data[field.name] = value === "on";
        } else if (field.type === "number") {
          data[field.name] = value ? parseFloat(value as string) : null;
        } else if (field.type === "tags") {
          data[field.name] = (value as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (field.type === "datetime-local") {
          data[field.name] = value ? new Date(value as string).toISOString() : null;
        } else if (field.type === "date") {
          data[field.name] = value ? new Date(value as string).toISOString() : null;
        } else {
          data[field.name] = value || null;
        }
      }

      const id = initialData?.id as string | undefined;
      const url = id ? `/admin/api/${entity}/${id}` : `/admin/api/${entity}`;
      const method = id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Échec de l'enregistrement");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  // Préparer les valeurs initiales
  const getValue = (field: FieldDef) => {
    const v = initialData?.[field.name];
    if (v == null) return "";
    if (field.type === "tags") return Array.isArray(v) ? (v as string[]).join(", ") : "";
    if (field.type === "datetime-local" || field.type === "date") {
      try {
        const d = new Date(v as string);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60 * 1000);
        return local.toISOString().slice(0, field.type === "date" ? 10 : 16);
      } catch {
        return "";
      }
    }
    return String(v);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-stone">{subtitle}</p>}
      </div>

      <form onSubmit={handleSubmit} className="card-gold-top p-6 space-y-5">
        {fields.map((field) => (
          <div
            key={field.name}
            className={field.type === "textarea" || field.fullWidth ? "" : "grid md:grid-cols-2 gap-5"}
          >
            <div className={field.type === "textarea" || field.fullWidth ? "" : ""}>
              <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-1.5 block">
                {field.label}
                {field.required && <span className="text-state-danger ml-1">*</span>}
              </label>

              {field.type === "photo" ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A227] to-[#A3821C] flex items-center justify-center text-white font-bold text-2xl overflow-hidden border-2 border-[#C9A227]/30 flex-shrink-0">
                    {photoValues[field.name] ? (
                      <img src={photoValues[field.name] as string} alt={field.label} className="w-full h-full object-cover" />
                    ) : (
                      "📷"
                    )}
                    {photoProcessing === field.name && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={(el) => { photoFileRef.current[field.name] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoChange(field.name, e.target.files?.[0])}
                      className="hidden"
                      id={`photo-${field.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => photoFileRef.current[field.name]?.click()}
                      disabled={photoProcessing === field.name}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-xs font-bold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {photoValues[field.name] ? "Changer la photo" : "Ajouter une photo"}
                    </button>
                    {photoValues[field.name] && (
                      <button
                        type="button"
                        onClick={() => setPhotoValues((prev) => ({ ...prev, [field.name]: null }))}
                        className="block px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Retirer la photo
                      </button>
                    )}
                    <p className="text-[10px] text-stone">JPG/PNG · carré · compressée ≤ 60 KB</p>
                  </div>
                </div>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={getValue(field) as string}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={6}
                  className="w-full px-4 py-2.5 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-y"
                />
              ) : field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={getValue(field) as string}
                  required={field.required}
                  className="w-full px-4 py-2.5 rounded border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                >
                  <option value="">— Choisir —</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name={field.name}
                    defaultChecked={!!initialData?.[field.name]}
                    className="w-4 h-4 rounded border-stone/30 text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-ink">{field.help || "Oui"}</span>
                </label>
              ) : (
                <input
                  type={field.type}
                  name={field.name}
                  defaultValue={getValue(field) as string}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full px-4 py-2.5 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              )}

              {field.help && field.type !== "checkbox" && (
                <p className="text-xs text-stone mt-1">{field.help}</p>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 text-state-danger text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-stone/15">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => router.push(redirectTo)}
            className="px-5 py-2.5 rounded border border-stone/30 text-stone font-semibold text-sm hover:bg-stone/10 transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
