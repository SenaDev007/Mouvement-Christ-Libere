"use client";

/**
 * ⭐ V3.47 — MODAL BIOGRAPHIQUE PROFESSIONNEL (back-office /admin/biographies).
 *
 * Remplace l'ancienne page pleine /admin/biographies/[id]/edit (bouton
 * stylo → navigation) par UN SEUL modal professionnel (pattern
 * AdminModal/EditServantModal) : la liste reste visible derrière, la
 * modification est immédiate — MÊME modal pour la création (« Nouveau
 * jalon ») et l'édition (bouton stylo).
 *
 * Contient, en plus des champs classiques du jalon (date, titre, récit,
 * verset, ordre) :
 *   1. LA PHOTO DU JALON — nouvelle colonne Biography.photoUrl, affichée
 *      sur la frise chronologique de la page publique (/pam, /pasteur-kongo).
 *      Upload compressé côté client (ratio préservé, ≤ 150 Ko —
 *      compressHeroImage, HEIC/EXIF robustes).
 *   2. LA PHOTO DE BIOGRAPHIE DE LA PAGE PUBLIQUE — le grand portrait
 *      affiché à côté du texte biographique (HeroSection.dataJson.bioPhoto,
 *      configurable jusqu'ici uniquement via /admin/heroes). Le pasteur
 *      peut désormais la changer DIRECTEMENT depuis le modal biographique
 *      du serviteur concerné (Pam → page « pam », Pasteur Kongo → page
 *      « pasteur-kongo ») : la modification est enregistrée en même temps
 *      que le jalon (une seule action « Enregistrer »).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Loader2, Save, Trash2, Image as ImageIcon, BookOpen, CheckCircle2, Pencil,
} from "lucide-react";
import { AdminModal, ModalField, ModalError, modalInputClass } from "./admin-modal";
import { compressHeroImage } from "@/lib/avatar-upload";
import { DEFAULT_HEROES } from "@/lib/hero-defaults";

export interface ServantLiteBio {
  id: string;
  code: string;
  shortName: string;
}

export interface BiographyLite {
  id: string;
  servantId: string;
  date: string;
  title: string;
  description: string;
  verseRef?: string | null;
  verseText?: string | null;
  photoUrl?: string | null;
  order: number;
}

interface HeroRowLite {
  id: string;
  page: string;
  dataJson: string | null;
}

/** Page hero (sections paramétrables) correspondant au code serviteur. */
function heroPageForCode(code: string): string | null {
  if (code === "pam") return "pam";
  if (code === "kongo") return "pasteur-kongo";
  return null;
}

interface BiographyModalProps {
  open: boolean;
  onClose: () => void;
  servants: ServantLiteBio[];
  /** null/undefined = mode création. */
  biography?: BiographyLite | null;
  accentColor?: string;
}

export function BiographyModal({
  open,
  onClose,
  servants,
  biography,
  accentColor = "#C9A227",
}: BiographyModalProps) {
  const router = useRouter();
  const isEdit = !!biography;

  // ─── Champs du jalon ───
  const [form, setForm] = useState({
    servantId: "",
    date: "",
    title: "",
    description: "",
    verseRef: "",
    verseText: "",
    order: 1,
  });

  // ─── Photo du jalon (Biography.photoUrl) ───
  const [photoJalon, setPhotoJalon] = useState<string | null>(null);
  const [photoJalonProcessing, setPhotoJalonProcessing] = useState(false);

  // ─── Photo de biographie de la page publique (HeroSection.dataJson.bioPhoto) ───
  const [heroRows, setHeroRows] = useState<HeroRowLite[] | null>(null);
  const [bioPhotoDirty, setBioPhotoDirty] = useState(false);
  const [bioPhotoValue, setBioPhotoValue] = useState<string | null>(null);
  const [bioPhotoProcessing, setBioPhotoProcessing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Réinitialiser le formulaire à l'ouverture (mode création ou édition)
  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      servantId: biography?.servantId || "",
      date: biography?.date || "",
      title: biography?.title || "",
      description: biography?.description || "",
      verseRef: biography?.verseRef || "",
      verseText: biography?.verseText || "",
      order: biography?.order ?? 1,
    });
    setPhotoJalon(biography?.photoUrl ?? null);
    setBioPhotoDirty(false);
    setBioPhotoValue(null);
  }, [open, biography]);

  // Charger (une seule fois par ouverture) les lignes hero pour connaître
  // l'id de la ligne du serviteur + la bioPhoto publique actuelle.
  useEffect(() => {
    if (!open || heroRows !== null) return;
    fetch("/admin/api/heroes?limit=100")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: HeroRowLite[] }) => setHeroRows(d.items || []))
      .catch(() => setHeroRows([]));
  }, [open, heroRows]);

  // Serviteur sélectionné → page hero correspondante
  const selectedServant = servants.find((s) => s.id === form.servantId);
  const heroPage = selectedServant ? heroPageForCode(selectedServant.code) : null;
  const heroRow = useMemo(
    () => (heroPage && heroRows ? heroRows.find((r) => r.page === heroPage) ?? null : null),
    [heroPage, heroRows]
  );

  // bioPhoto actuellement en base (ou défaut du site) pour le serviteur choisi
  const bioPhotoActuelle = useMemo(() => {
    if (!heroPage) return null;
    let data: Record<string, string> = {};
    if (heroRow?.dataJson) {
      try {
        data = JSON.parse(heroRow.dataJson) as Record<string, string>;
      } catch {
        data = {};
      }
    }
    return data.bioPhoto || DEFAULT_HEROES[heroPage]?.data?.bioPhoto || null;
  }, [heroPage, heroRow]);

  const bioPhotoAffichee = bioPhotoDirty ? bioPhotoValue : bioPhotoActuelle;

  // ─── Upload photo du jalon ───
  const handlePhotoJalonChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoJalonProcessing(true);
    setError("");
    try {
      const dataUrl = await compressHeroImage(file);
      setPhotoJalon(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setPhotoJalonProcessing(false);
      e.target.value = "";
    }
  };

  // ─── Upload photo de biographie (page publique) ───
  const handleBioPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBioPhotoProcessing(true);
    setError("");
    try {
      const dataUrl = await compressHeroImage(file);
      setBioPhotoValue(dataUrl);
      setBioPhotoDirty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setBioPhotoProcessing(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.servantId || !form.date.trim() || !form.title.trim() || !form.description.trim()) {
      setError("Serviteur, date, titre et récit sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 1) Enregistrer le jalon (création ou édition)
      const data = {
        servantId: form.servantId,
        date: form.date.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        verseRef: form.verseRef.trim() || null,
        verseText: form.verseText.trim() || null,
        order: Number(form.order) || 0,
        photoUrl: photoJalon,
      };
      const res = await fetch(
        isEdit ? `/admin/api/biographies/${biography!.id}` : "/admin/api/biographies",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Échec de l'enregistrement du jalon");
      }

      // 2) Enregistrer la photo de biographie publique si elle a été changée
      if (bioPhotoDirty && heroRow) {
        let dataJson: Record<string, string> = {};
        if (heroRow.dataJson) {
          try {
            dataJson = JSON.parse(heroRow.dataJson) as Record<string, string>;
          } catch {
            dataJson = {};
          }
        }
        if (bioPhotoValue) dataJson.bioPhoto = bioPhotoValue;
        else delete dataJson.bioPhoto; // retirée → retombe sur la photo par défaut
        const heroRes = await fetch(`/admin/api/heroes/${heroRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataJson: JSON.stringify(dataJson) }),
        });
        if (!heroRes.ok) {
          // Le jalon est déjà enregistré : on signale sans tout casser.
          setError(
            "Jalon enregistré ✓ — mais la photo de biographie publique n'a pas pu être sauvegardée. Réessayez via « Contenu → Sections Hero »."
          );
          router.refresh();
          return;
        }
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier le jalon biographique" : "Nouveau jalon biographique"}
      subtitle={isEdit ? biography!.title : "Ajouter une étape à la frise chronologique d'un serviteur"}
      size="lg"
      accentColor={accentColor}
    >
      <div className="space-y-5">
        <ModalError error={error} />

        <div className="grid grid-cols-2 gap-4">
          <ModalField label="Serviteur" required>
            <select
              value={form.servantId}
              onChange={(e) => set("servantId", e.target.value)}
              className={modalInputClass()}
            >
              <option value="">Choisir...</option>
              {servants.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Ordre" help="Plus petit = plus tôt dans la frise">
            <input
              type="number"
              value={form.order}
              onChange={(e) => set("order", Number(e.target.value))}
              className={modalInputClass()}
            />
          </ModalField>
          <ModalField label="Date / Période" required>
            <input
              type="text"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              placeholder="Enfance, 2024-03, etc."
              className={modalInputClass()}
            />
          </ModalField>
          <ModalField label="Titre court" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Le premier appel"
              className={modalInputClass()}
            />
          </ModalField>
          <ModalField label="Récit" required fullWidth>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="2 à 4 phrases de récit, ton sobre..."
              className={`${modalInputClass()} resize-none`}
            />
          </ModalField>
          <ModalField label="Référence biblique">
            <input
              type="text"
              value={form.verseRef}
              onChange={(e) => set("verseRef", e.target.value)}
              placeholder="Genèse 5:24"
              className={modalInputClass()}
            />
          </ModalField>
          <ModalField label="Texte du verset" fullWidth>
            <textarea
              value={form.verseText}
              onChange={(e) => set("verseText", e.target.value)}
              rows={2}
              placeholder="« Et Hénoch marcha avec Dieu... »"
              className={`${modalInputClass()} resize-none`}
            />
          </ModalField>
        </div>

        {/* ─── Photo du jalon (affichée sur la page publique) ─── */}
        <div className="rounded-xl border-2 border-[#8A8378]/15 bg-[#FAF6EF]/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="w-4 h-4 text-[#C9A227]" />
            <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">
              Photo de ce jalon
            </p>
            <span className="text-[10px] text-[#8A8378] font-medium">
              (affichée sur la frise de la page publique)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-36 h-[90px] rounded-lg border-2 border-[#C9A227]/30 overflow-hidden bg-[#2A0E3D] flex items-center justify-center shadow-md">
                {photoJalon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoJalon} alt="Photo du jalon" className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-6 h-6 text-[#C9A227]/50" />
                )}
                {photoJalonProcessing && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-lg hover:bg-[#DDBE55] transition-colors border-2 border-white cursor-pointer"
                title="Ajouter / changer la photo du jalon"
              >
                {photoJalonProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoJalonChange}
                  className="hidden"
                  aria-label="Photo du jalon"
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#1E0F2B]/70 leading-relaxed">
                Illustration de cette étape (enfance, appel, ministère…) — apparaît sur la
                frise chronologique publique du serviteur. Format paysage de préférence,
                compressée automatiquement (≤ 150 Ko, HEIC accepté).
              </p>
              {photoJalon && (
                <button
                  type="button"
                  onClick={() => setPhotoJalon(null)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Retirer la photo du jalon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Photo de biographie de la page publique ─── */}
        {heroPage && (
          <div className="rounded-xl border-2 border-[#C9A227]/30 bg-[#C9A227]/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-[#C9A227]" />
              <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">
                Photo de la biographie — page publique
              </p>
            </div>
            <p className="text-[11px] text-[#8A8378] mb-3 leading-relaxed">
              {selectedServant?.code === "pam"
                ? "Grand portrait affiché à côté du texte biographique sur /pam — commun à toute la frise de Pam."
                : "Grand portrait affiché à côté du texte biographique sur /pasteur-kongo — commun à toute la frise du Pasteur Kongo."}
            </p>
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-[90px] h-[120px] rounded-lg border-2 border-[#C9A227]/40 overflow-hidden bg-[#2A0E3D] flex items-center justify-center shadow-md">
                  {bioPhotoAffichee ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bioPhotoAffichee}
                      alt="Photo de biographie publique"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-5 h-5 text-[#C9A227]/50" />
                  )}
                  {bioPhotoProcessing && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <label
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-lg hover:bg-[#DDBE55] transition-colors border-2 border-white cursor-pointer"
                  title="Changer la photo de biographie (page publique)"
                >
                  {bioPhotoProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBioPhotoChange}
                    className="hidden"
                    aria-label="Photo de biographie publique"
                  />
                </label>
              </div>
              <div className="min-w-0 flex-1">
                {heroRows === null && (
                  <p className="text-[11px] text-[#8A8378] italic flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Chargement de la photo actuelle…
                  </p>
                )}
                {heroRows !== null && (
                  <p className="text-[11px] text-[#1E0F2B]/70 leading-relaxed">
                    Portrait vertical de préférence (ratio 3/4). Compressée automatiquement
                    (≤ 150 Ko, HEIC accepté).
                  </p>
                )}
                {bioPhotoDirty && bioPhotoValue && (
                  <p className="mt-2 text-[11px] font-semibold text-[#A3821C] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Nouvelle photo — enregistrée en même temps que le jalon
                  </p>
                )}
                {bioPhotoDirty && bioPhotoValue && (
                  <button
                    type="button"
                    onClick={() => {
                      setBioPhotoDirty(false);
                      setBioPhotoValue(null);
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Annuler le changement de photo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {heroRows !== null && !heroPage && form.servantId && (
          <p className="text-[11px] text-[#8A8378] italic px-1">
            Ce serviteur n&apos;a pas de page publique dédiée — la photo de biographie
            publique ne s&apos;applique qu&apos;à Pam et au Pasteur Kongo.
          </p>
        )}

        {/* ─── Actions ─── */}
        <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-[#8A8378]/10">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:bg-[#8A8378]/10 transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || photoJalonProcessing || bioPhotoProcessing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
    </AdminModal>
  );
}

// ============ Bouton stylo → modal d'édition (remplace le lien /edit) ============

interface BiographyEditButtonProps {
  biography: BiographyLite;
  servants: ServantLiteBio[];
  accentColor?: string;
}

export function BiographyEditButton({ biography, servants, accentColor }: BiographyEditButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
        aria-label="Modifier"
        title="Modifier ce jalon"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <BiographyModal
        open={open}
        onClose={() => setOpen(false)}
        servants={servants}
        biography={biography}
        accentColor={accentColor}
      />
    </>
  );
}

// ============ ⭐ V3.48 — Routes /new et /[id]/edit : le modal s'ouvre D'EMBLÉE ============
//
// Le pasteur a signalé que « le stylo ouvre toujours /edit » : son onglet avait
// été chargé AVANT le déploiement V3.47 (l'ancien JS y naviguait vers /edit),
// et la page /edit affichait encore l'ancien formulaire plein écran. Désormais
// les ROUTES elles-mêmes (/admin/biographies/new et /admin/biographies/[id]/edit)
// rendent le MODAL professionnel ouvert d'emblée — quel que soit le chemin
// d'accès (stylo frais, onglet obsolète, bookmark, historique), le pasteur voit
// TOUJOURS le même modal que la création. Fermer le modal revient à la liste.

interface BiographyAutoModalProps {
  servants: ServantLiteBio[];
  /** null/undefined = mode création (route /new). */
  biography?: BiographyLite | null;
  accentColor?: string;
}

export function BiographyAutoModal({ servants, biography, accentColor = "#C9A227" }: BiographyAutoModalProps) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <BookOpen className="w-10 h-10 text-[#C9A227]/30" aria-hidden />
      <p className="text-sm text-[#8A8378] font-medium">
        {biography ? `Jalon « ${biography.title} »` : "Nouveau jalon biographique"}
      </p>
      <p className="text-xs text-[#8A8378]/70 max-w-sm">
        La fenêtre d&apos;édition est ouverte — fermez-la pour revenir à la liste des biographies.
      </p>
      <BiographyModal
        open={true}
        onClose={() => router.push("/admin/biographies")}
        servants={servants}
        biography={biography ?? null}
        accentColor={accentColor}
      />
    </div>
  );
}
