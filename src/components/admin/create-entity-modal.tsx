"use client";

import { useState, useEffect, ReactNode } from "react";
import { AdminModal, ModalField, ModalSubmit, ModalError, modalInputClass } from "@/components/admin/admin-modal";
import { semanticInputProps } from "@/lib/form-semantics";

interface FieldOption {
  value: string;
  label: string;
}

export interface CreateField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "checkbox" | "tags" | "datetime-local" | "date";
  placeholder?: string;
  help?: string;
  required?: boolean;
  fullWidth?: boolean;
  options?: FieldOption[];
  defaultValue?: string | number | boolean;
}

interface CreateEntityModalProps {
  open: boolean;
  onClose: () => void;
  entity: string; // URL path: /admin/api/{entity}
  title: string;
  subtitle?: string;
  fields: CreateField[];
  accentColor?: string;
  size?: "sm" | "md" | "lg" | "xl";
  // Permet de pré-remplir des champs (ex: servantId depuis un onglet actif)
  initialValues?: Record<string, string | number | boolean>;
  // Callback après création réussie (par défaut: reload la page)
  onSuccess?: () => void;
}

/**
 * Modal générique pour créer une entité via l'API CRUD /admin/api/{entity}.
 * Réutilisable pour serviteurs, biographies, témoignages, enseignements, etc.
 */
export function CreateEntityModal({
  open,
  onClose,
  entity,
  title,
  subtitle,
  fields,
  accentColor = "#C9A227",
  size = "lg",
  initialValues,
  onSuccess,
}: CreateEntityModalProps) {
  // Construire l'état initial du formulaire
  const buildInitialState = (): Record<string, string | number | boolean> => {
    const state: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      if (initialValues?.[field.name] !== undefined) {
        state[field.name] = initialValues[field.name];
      } else if (field.defaultValue !== undefined) {
        state[field.name] = field.defaultValue;
      } else if (field.type === "checkbox") {
        state[field.name] = false;
      } else if (field.type === "number") {
        state[field.name] = 0;
      } else {
        state[field.name] = "";
      }
    }
    return state;
  };

  const [form, setForm] = useState<Record<string, string | number | boolean>>(buildInitialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tagsInput, setTagsInput] = useState<Record<string, string>>({});

  // Réinitialiser le formulaire quand le modal s'ouvre
  useEffect(() => {
    if (open) {
      setForm(buildInitialState());
      setTagsInput({});
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setValue = (name: string, value: string | number | boolean) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleTagsKey = (name: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = tagsInput[name]?.trim();
      if (!value) return;
      const currentTags = (form[name] as string) || "";
      const tagsArray = currentTags ? currentTags.split(",").map((t) => t.trim()) : [];
      if (!tagsArray.includes(value)) {
        tagsArray.push(value);
        setValue(name, tagsArray.join(", "));
      }
      setTagsInput((t) => ({ ...t, [name]: "" }));
    }
  };

  const removeTag = (name: string, tagToRemove: string) => {
    const currentTags = (form[name] as string) || "";
    const tagsArray = currentTags.split(",").map((t) => t.trim()).filter((t) => t && t !== tagToRemove);
    setValue(name, tagsArray.join(", "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation des champs requis
    for (const field of fields) {
      if (field.required) {
        const value = form[field.name];
        if (field.type === "checkbox") {
          // ok, toujours valide
        } else if (!value || (typeof value === "string" && !value.trim())) {
          setError(`Le champ "${field.label}" est requis`);
          return;
        }
      }
    }

    setLoading(true);
    setError("");

    try {
      // Préparer le body : convertir les nombres et dates
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        const value = form[field.name];
        if (field.type === "number") {
          body[field.name] = Number(value) || 0;
        } else if (field.type === "datetime-local" || field.type === "date") {
          // Convertir en ISO string si valeur présente
          body[field.name] = value ? new Date(value as string).toISOString() : null;
        } else {
          body[field.name] = value;
        }
      }

      const res = await fetch(`/admin/api/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      // Succès
      if (onSuccess) {
        onSuccess();
      } else {
        // Par défaut : recharger la page
        window.location.reload();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Rendu d'un champ
  const renderField = (field: CreateField): ReactNode => {
    const value = form[field.name];
    const colSpan = field.fullWidth ? "col-span-2" : "";

    if (field.type === "checkbox") {
      return (
        <div key={field.name} className={colSpan}>
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setValue(field.name, e.target.checked)}
              className="w-4 h-4 accent-[#C9A227]"
            />
            <div>
              <div className="text-sm font-semibold text-[#1E0F2B]">{field.label}</div>
              {field.help && <div className="text-xs text-[#8A8378] mt-0.5">{field.help}</div>}
            </div>
          </label>
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <ModalField key={field.name} label={field.label} required={field.required} fullWidth={field.fullWidth}>
          <select
            value={String(value)}
            onChange={(e) => setValue(field.name, e.target.value)}
            required={field.required}
            className={modalInputClass()}
          >
            <option value="">Choisir...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.help && <p className="text-[10px] text-[#8A8378] mt-1">{field.help}</p>}
        </ModalField>
      );
    }

    if (field.type === "textarea") {
      return (
        <ModalField key={field.name} label={field.label} required={field.required} fullWidth={field.fullWidth}>
          <textarea
            value={String(value)}
            onChange={(e) => setValue(field.name, e.target.value)}
            required={field.required}
            rows={3}
            placeholder={field.placeholder}
            className={`${modalInputClass()} resize-none`}
          />
          {field.help && <p className="text-[10px] text-[#8A8378] mt-1">{field.help}</p>}
        </ModalField>
      );
    }

    if (field.type === "tags") {
      const currentTags = (form[field.name] as string) || "";
      const tagsArray = currentTags ? currentTags.split(",").map((t) => t.trim()).filter(Boolean) : [];

      return (
        <ModalField key={field.name} label={field.label} required={field.required} fullWidth={field.fullWidth}>
          <div className="rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] p-2 focus-within:border-[#C9A227] transition-colors">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagsArray.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C9A227]/15 text-[#A3821C] text-xs font-semibold"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(field.name, tag)}
                    className="hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagsInput[field.name] || ""}
              onChange={(e) => setTagsInput((t) => ({ ...t, [field.name]: e.target.value }))}
              onKeyDown={(e) => handleTagsKey(field.name, e)}
              placeholder={field.placeholder || "Tapez un mot + Entrée"}
              className="w-full bg-transparent text-sm text-[#1E0F2B] outline-none placeholder:text-[#8A8378]/50"
            />
          </div>
          {field.help && <p className="text-[10px] text-[#8A8378] mt-1">{field.help}</p>}
        </ModalField>
      );
    }

    // text / number
    // text / number / datetime-local / date
    const inputType = field.type === "number"
      ? "number"
      : field.type === "datetime-local"
        ? "datetime-local"
        : field.type === "date"
          ? "date"
          : "text";

    const sem = field.type === "text" ? semanticInputProps(field.name) : {};

    return (
      <ModalField key={field.name} label={field.label} required={field.required} fullWidth={field.fullWidth}>
        <input
          type={sem.type ?? inputType}
          inputMode={sem.inputMode}
          autoComplete={sem.autoComplete ?? "off"}
          value={String(value)}
          onChange={(e) =>
            setValue(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)
          }
          required={field.required}
          placeholder={field.placeholder}
          className={modalInputClass()}
        />
        {field.help && <p className="text-[10px] text-[#8A8378] mt-1">{field.help}</p>}
      </ModalField>
    );
  };

  // Champs requis manquants pour le bouton
  const hasMissingRequired = fields.some((f) => {
    if (!f.required) return false;
    if (f.type === "checkbox") return false;
    const v = form[f.name];
    return !v || (typeof v === "string" && !v.trim());
  });

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size={size}
      accentColor={accentColor}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map((field) => renderField(field))}
        </div>

        <ModalError error={error} />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
          >
            Annuler
          </button>
          <ModalSubmit loading={loading} disabled={hasMissingRequired} label={`Créer`} />
        </div>
      </form>
    </AdminModal>
  );
}
