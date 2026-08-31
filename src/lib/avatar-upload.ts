/**
 * ⭐ V2.7 — Utilitaire partagé : upload d'avatar photo côté client.
 *
 * Compresse une image carrée (recadrage centré) via canvas en JPEG
 * qualité adaptative ≤ 60 KB, retournée en data URL directement
 * stockable en base (User.avatarUrl / Servant.portraitUrl — TEXT).
 *
 * Réutilisé par :
 *   - le profil public /profil (membres/viewers),
 *   - le back-office /admin/users (EditUserModal),
 *   - le back-office /admin/servants (AdminForm champ « photo »).
 *
 * Le stockage en data URL évite toute dépendance filesystem (Vercel est
 * en lecture seule) — même approche que Channel.avatarUrl (V2.5).
 */
export async function compressAvatar(file: File, size = 256): Promise<string> {
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
