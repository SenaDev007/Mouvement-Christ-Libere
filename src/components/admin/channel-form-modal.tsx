"use client";

/**
 * ⭐ V2.5 — Modal professionnel de création / modification de canal.
 *
 * Remplace l'ancienne page /admin/channels/new (AdminForm plein écran) par
 * un modal cohérent avec le module Lives (AdminModal + ModalField).
 *
 * Fonctionnalités :
 *   - Création ET édition (initialData fourni → PATCH)
 *   - Photo du canal : compression côté client (canvas, ≤ 80 KB en JPEG),
 *     stockée en data URL dans Channel.avatarUrl (PostgreSQL TEXT) —
 *     aucun stockage externe requis, visible immédiatement dans Yeshua Connect
 *   - Correction du bug « création déréglée » : l'ancien AdminForm envoyait
 *     `order: null` quand le champ était vide → erreur Prisma. Ici on
 *     n'envoie que des valeurs valides (order: number | undefined)
 *   - Après enregistrement : router.refresh() → la liste back-office ET
 *     Yeshua Connect (même table Channel) se synchronisent
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, ImagePlus, Check } from "lucide-react";
import {
  AdminModal, ModalField, ModalSubmit, ModalError, modalInputClass,
} from "@/components/admin/admin-modal";

export interface ChannelLite {
  id: string;
  name: string;
  description?: string | null;
  communityId: string;
  type: string;
  isEncrypted: boolean;
  isRestricted: boolean;
  order: number;
  avatarUrl?: string | null;
}

interface CommunityLite {
  id: string;
  name: string;
}

interface ChannelFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Communautés disponibles (pour le select). */
  communities: CommunityLite[];
  /** Canal à modifier — undefined = création. */
  channel?: ChannelLite;
  /** Message de confirmation affiché après enregistrement (optionnel). */
  onSaved?: (msg: string) => void;
}

const CHANNEL_TYPES = [
  { value: "TEXT", label: "Texte — groupe de discussion", hint: "Tous les membres peuvent écrire" },
  { value: "ANNOUNCEMENT", label: "Canal d'annonce — diffusion", hint: "Style Telegram : diffusion aux abonnés" },
  { value: "VOICE", label: "Vocal — salon audio", hint: "Canaux vocaux persistants (LiveKit)" },
  { value: "VIDEO", label: "Vidéo — salon visio", hint: "Appels vidéo communautaires" },
  { value: "RESTRICTED", label: "Restreint — cercle privé", hint: "Visible uniquement des rôles pastoraux" },
];

/**
 * Compresse une image carrée côté client via canvas.
 * - Recadrage centré en carré (avatars de canal)
 * - Résolution 256×256, JPEG qualité adaptative ≤ 60 KB
 * - Retourne une data URL directement stockable en base
 */
async function compressAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Recadrage carré centré
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas non supporté"));
          return;
        }
        // Fond blanc (PNG transparents → JPEG)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

        // Compression adaptative ≤ 60 KB
        const MAX_KB = 60;
        let quality = 0.85;
        let out = canvas.toDataURL("image/jpeg", quality);
        let kb = Math.round((out.length * 3) / 4 / 1024);
        while (kb > MAX_KB && quality > 0.3) {
          quality -= 0.1;
          out = canvas.toDataURL("image/jpeg", quality);
          kb = Math.round((out.length * 3) / 4 / 1024);
        }
        resolve(out);
      };
      img.onerror = () => reject(new Error("Image invalide (utilisez JPG ou PNG)"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Lecture du fichier échouée"));
    reader.readAsDataURL(file);
  });
}

export function ChannelFormModal({
  open,
  onClose,
  communities,
  channel,
  onSaved,
}: ChannelFormModalProps) {
  const router = useRouter();
  const isEdit = !!channel;

  const [communityId, setCommunityId] = useState(channel?.communityId || communities[0]?.id || "");
  const [name, setName] = useState(channel?.name || "");
  const [description, setDescription] = useState(channel?.description || "");
  const [type, setType] = useState(channel?.type || "TEXT");
  const [isEncrypted, setIsEncrypted] = useState(channel?.isEncrypted ?? false);
  const [isRestricted, setIsRestricted] = useState(channel?.isRestricted ?? false);
  const [order, setOrder] = useState(channel?.order != null ? String(channel.order) : "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(channel?.avatarUrl || null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (JPG ou PNG)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image trop lourde (max 10 Mo)");
      return;
    }
    setError("");
    setUploadingPhoto(true);
    try {
      const compressed = await compressAvatar(file);
      setAvatarUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de compression");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !communityId) {
      setError("Le nom du canal et la communauté sont requis");
      return;
    }
    setSaving(true);
    setError("");

    try {
      // ⭐ V2.5 — Ne PAS envoyer order: null (bug de l'ancien AdminForm :
      // Prisma refusait `null` pour un Int avec default). On n'envoie que
      // des valeurs valides.
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        communityId,
        type,
        isEncrypted,
        isRestricted,
        avatarUrl: avatarUrl || null,
      };
      const orderValue = parseInt(order, 10);
      if (order && !Number.isNaN(orderValue)) {
        body.order = orderValue;
      } else if (isEdit) {
        // En édition sans saisie : conserver l'ordre existant
        if (channel?.order != null) body.order = channel.order;
      }

      const url = isEdit ? `/admin/api/channels/${channel!.id}` : "/admin/api/channels";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Échec de l'enregistrement");
      }

      onSaved?.(
        isEdit
          ? `Canal « ${name.trim()} » mis à jour ✓ — visible immédiatement dans Yeshua Connect`
          : `Canal « ${name.trim()} » créé ✓ — il apparaît désormais dans Yeshua Connect`
      );

      // Reset (mode création) + fermeture + rafraîchissement des listes
      if (!isEdit) {
        setName("");
        setDescription("");
        setType("TEXT");
        setIsEncrypted(false);
        setIsRestricted(false);
        setOrder("");
        setAvatarUrl(null);
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier le canal" : "Nouveau canal"}
      subtitle={
        isEdit
          ? "Les changements sont visibles immédiatement dans Yeshua Connect."
          : "Le canal créé apparaîtra directement dans Yeshua Connect."
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalError error={error} />

        {/* Photo du canal */}
        <ModalField label="Photo du canal" help="Carrée, compressée automatiquement (≤ 60 Ko) — affichée dans la liste Yeshua Connect.">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#C9A227]/30 bg-[#FAF6EF] flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Photo du canal" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-8 h-8 text-[#8A8378]/40" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#C9A227]" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#1E0F2B] text-xs font-bold hover:bg-[#C9A227]/20 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {avatarUrl ? "Changer la photo" : "Choisir une photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X className="w-3 h-3" /> Retirer
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
          </div>
        </ModalField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModalField label="Communauté" required>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className={modalInputClass()}
            >
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </ModalField>

          <ModalField label="Type" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={modalInputClass()}
            >
              {CHANNEL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </ModalField>
        </div>

        <ModalField label="Nom du canal" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Intercession communautaire"
            maxLength={80}
            className={modalInputClass()}
          />
        </ModalField>

        <ModalField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="À quoi sert ce canal / groupe ?"
            rows={2}
            maxLength={280}
            className={`${modalInputClass()} resize-none`}
          />
        </ModalField>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalField label="Ordre d'affichage" help="Position dans la sidebar (optionnel)">
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0"
              min={0}
              className={modalInputClass()}
            />
          </ModalField>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEncrypted}
                onChange={(e) => setIsEncrypted(e.target.checked)}
                className="w-4 h-4 accent-[#C9A227]"
              />
              <span className="text-sm font-semibold text-[#1E0F2B]">🔒 Chiffré E2E</span>
            </label>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRestricted}
                onChange={(e) => setIsRestricted(e.target.checked)}
                className="w-4 h-4 accent-[#C9A227]"
              />
              <span className="text-sm font-semibold text-[#1E0F2B]">🛡️ Accès restreint</span>
            </label>
          </div>
        </div>

        {/* Aperçu live */}
        <div className="p-3 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-2 flex items-center gap-1">
            <Check className="w-3 h-3 text-[#C9A227]" /> Aperçu dans Yeshua Connect
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#2A0E3D] text-white text-sm font-bold">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (name.trim() || "?").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1E0F2B] truncate">
                {name.trim() || "Nom du canal"}
              </p>
              <p className="text-xs text-[#8A8378] truncate">
                {description.trim() || CHANNEL_TYPES.find((t) => t.value === type)?.hint}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:bg-[#8A8378]/10 transition-colors"
          >
            Annuler
          </button>
          <ModalSubmit
            loading={saving}
            disabled={!name.trim() || !communityId}
            label={isEdit ? "Enregistrer les modifications" : "Créer le canal"}
            loadingLabel="Enregistrement..."
          />
        </div>
      </form>
    </AdminModal>
  );
}
