"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, AlertCircle } from "lucide-react";

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "datetime-local" | "checkbox" | "tags";
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, unknown> = {};

      for (const field of fields) {
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

              {field.type === "textarea" ? (
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
