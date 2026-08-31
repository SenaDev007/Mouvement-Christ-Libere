/**
 * ⭐ V3.2 — Utilitaire partagé : upload d'avatar photo côté client, ROBUSTE.
 *
 * Corrige « la photo est rejetée automatiquement / ne charge pas » :
 *   1. Photos iPhone HEIC/HEIF → décodées via heic2any (import dynamique,
 *      chunk séparé chargé UNIQUEMENT si une photo HEIC est choisie).
 *   2. Type MIME vide (certains navigateurs Android / fichiers traînés) →
 *      le format est détecté par les OCTETS MAGIQUES du fichier.
 *   3. Orientation EXIF (photos prises en portrait) → corrigée via
 *      createImageBitmap({ imageOrientation: "from-image" }) + repli <img>.
 *
 * Pipeline : File → (décodage) → recadrage carré centré → canvas 256×256
 * → JPEG qualité adaptative ≤ 60 KB → data URL stockable en base
 * (User.avatarUrl / Servant.portraitUrl / Channel.avatarUrl — TEXT).
 *
 * Réutilisé par :
 *   - le profil public /profil (membres/viewers),
 *   - le modal Yeshua Connect (ProfileSettingsModal),
 *   - le back-office /admin/users (EditUserModal),
 *   - le back-office /admin/servants (AdminForm / EditServantModal),
 *   - le back-office /admin/channels (ChannelFormModal).
 */

/** Détection du format réel par octets magiques (le MIME peut mentir/vide). */
async function detectImageKind(file: File): Promise<"jpeg" | "png" | "webp" | "gif" | "bmp" | "avif" | "heic" | "unknown"> {
  // 1) Extension en indice rapide (certains Android donnent un type vide)
  const name = (file.name || "").toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const heicByExt = ["heic", "heif", "hif"].includes(ext);

  // 2) Octets magiques
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...Array.from(head.slice(start, start + len)));

  // ISO BMFF (HEIC / HEIF / AVIF) : « ....ftypXXXX »
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    if (brand.startsWith("avi")) return "avif";
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
    return heicByExt ? "heic" : "unknown";
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head[0] === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(0, 3) === "GIF") return "gif";
  if (head[0] === 0x42 && head[1] === 0x4d) return "bmp";
  if (heicByExt) return "heic";
  return "unknown";
}

/** HEIC/HEIF → JPEG blob via heic2any (script auto-hébergé, chargé à la demande). */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  // heic2any.min.js (1,3 Mo, libheif compilé) est servi depuis /public et
  // chargé UNIQUEMENT quand une photo HEIC est choisie — jamais pour les
  // JPG/PNG classiques. (Auto-hébergé : le chunking dynamique du bundler
  // provoquait un 404 sur ce paquet UMD.)
  const w = window as unknown as { heic2any?: (opts: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]> };
  if (!w.heic2any) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/heic2any.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("heic2any-load-failed"));
      document.head.appendChild(s);
    });
  }
  if (!w.heic2any) throw new Error("heic2any-unavailable");
  // ⚠️ API heic2any : UN SEUL argument objet { blob, toType, quality }.
  const out = await w.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

interface DecodedImage {
  width: number;
  height: number;
  /** Dessine la zone source (sx,sy,sw,sh) vers (dx,dy,dw,dh) du canvas. */
  draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void;
}

/** Décodage multi-stratégies : createImageBitmap (EXIF) puis <img> en repli. */
async function decodeImage(source: Blob): Promise<DecodedImage> {
  // a) createImageBitmap — corrige l'orientation EXIF nativement.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
          ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh),
      };
    } catch { /* repli ci-dessous */ }
  }
  // b) <img> + data URL (navigateurs anciens / WebView).
  return new Promise<DecodedImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh),
      });
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(source);
  });
}

export async function compressAvatar(file: File, size = 256): Promise<string> {
  // ─── Garde-fou taille (évite de figer le navigateur sur des fichiers XXL) ───
  if (file.size > 40 * 1024 * 1024) {
    throw new Error("Photo trop volumineuse (plus de 40 Mo). Choisissez une photo plus légère.");
  }

  // ─── Détection du format réel (le type MIME peut être vide) ───
  const mimeLooksImage = (file.type || "").startsWith("image/");
  const kind = await detectImageKind(file);
  const isHeic = kind === "heic" || ((file.type === "image/heic" || file.type === "image/heif"));

  if (kind === "unknown" && !mimeLooksImage) {
    throw new Error("Format non reconnu. Utilisez une photo JPG, PNG ou WEBP.");
  }

  // ─── Source à décoder : conversion HEIC si besoin ───
  let source: Blob = file;
  if (isHeic) {
    try {
      source = await convertHeicToJpeg(file);
    } catch {
      throw new Error(
        "Photo iPhone (HEIC) non lisible par votre navigateur. " +
        "Ouvrez-la et enregistrez-la en JPG (ou envoyez-la par WhatsApp puis réenregistrez) avant de la choisir ici."
      );
    }
  }

  // ─── Décodage ───
  let image: DecodedImage;
  try {
    image = await decodeImage(source);
  } catch {
    throw new Error(
      "Image illisible par le navigateur. Essayez une photo JPG ou PNG " +
      "(les photos iPhone HEIC doivent être converties)."
    );
  }
  if (!image.width || !image.height) {
    throw new Error("Image vide ou corrompue.");
  }

  // ─── Recadrage carré centré + fond blanc (transparences → JPEG) ───
  const side = Math.min(image.width, image.height);
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supporté par votre navigateur.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  image.draw(ctx, sx, sy, side, side, 0, 0, size, size);

  // ─── Compression adaptative ≤ 60 KB ───
  const MAX_KB = 60;
  let quality = 0.85;
  let out = canvas.toDataURL("image/jpeg", quality);
  let kb = Math.round((out.length * 3) / 4 / 1024);
  while (kb > MAX_KB && quality > 0.3) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
    kb = Math.round((out.length * 3) / 4 / 1024);
  }
  return out;
}
