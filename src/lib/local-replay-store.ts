/**
 * ⭐ V3.37 — COPIE LOCALE DE SÉCURITÉ DU REPLAY (IndexedDB).
 * ============================================================================
 *
 * Demande du pasteur : « si après le live le site R2 ne marche pas, je
 * voudrais quand même qu'on puisse télécharger et que ça télécharge de
 * façon automatique le fichier vidéo du live enregistré sur le PC ou le
 * smartphone, afin que l'admin puisse réuploader la vidéo et la travailler
 * simplement. »
 *
 * Avant V3.37, le replay enregistré côté navigateur (MediaRecorder) n'existait
 * qu'en MÉMOIRE : au premier rechargement de page — ou à la redirection auto
 * vers /admin/videos 2 s après l'arrêt — le fichier était PERDU, et le
 * « téléchargement de secours » était fragile (URL révoquée immédiatement
 * après le clic, ce qui peut couper un téléchargement en cours sur Safari/
 * Firefox ; pas d'enregistrement du tout sur iPhone car le webm n'y est pas
 * supporté par MediaRecorder).
 *
 * Ce module fournit :
 *  - un STOCKAGE DURABLE du blob vidéo dans IndexedDB (la copie survit aux
 *    rechargements, aux crashes et à la navigation — elle est propre à
 *    l'APPAREIL qui a fait le direct, ce qui est exactement la sémantique
 *    voulue : le fichier est sur le PC/smartphone de l'admin) ;
 *  - un TÉLÉCHARGEMENT ROBUSTE (PC + smartphone) : URL objet conservée 60 s
 *    (le téléchargement a le temps de démarrer), attribut download, nom de
 *    fichier lisible ;
 *  - un nettoyage auto (≤ 6 copies, ≤ 30 jours) pour ne pas remplir l'appareil.
 *
 * Tout est « best effort » : si IndexedDB est indisponible (navigation
 * privée, très vieux navigateur), chaque fonction échoue proprement
 * (null/false) et l'appelant retombe sur le blob en mémoire.
 */

export interface LocalReplayMeta {
  liveId: string;
  title: string;
  /** ISO — moment de la sauvegarde (arrêt du live). */
  savedAt: string;
  sizeBytes: number;
  mimeType: string;
  /** true = l'upload R2 a échoué → copie à récupérer (bannières/panneau). */
  uploadFailed: boolean;
}

export interface LocalReplayRecord extends LocalReplayMeta {
  blob: Blob;
}

const DB_NAME = "mcl-replay-local";
const DB_VERSION = 1;
const STORE = "replays";
/** Rétention : au plus 6 copies, purge au-delà de 30 jours. */
const MAX_COPIES = 6;
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

/** Chaîne des opérations en vol : un delete doit attendre la sauvegarde
 * en cours (sinon la suppression passe AVANT l'écriture d'un gros blob et
 * le fichier réapparaît). */
let operations: Promise<unknown> = Promise.resolve();

function chainer<T>(p: Promise<T>): Promise<T> {
  operations = operations.then(() => p, () => p);
  return p;
}

/** IndexedDB indisponible (SSR, navigation privée, vieux navigateur) ? */
function idbDisponible(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function ouvrirDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "liveId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function requete<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return ouvrirDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

function versMeta(rec: LocalReplayRecord): LocalReplayMeta {
  return {
    liveId: rec.liveId,
    title: rec.title,
    savedAt: rec.savedAt,
    sizeBytes: rec.sizeBytes,
    mimeType: rec.mimeType,
    uploadFailed: rec.uploadFailed,
  };
}

/** Demande (best effort) le stockage persistant : Chrome peut sinon évacuer
 * l'IndexedDB sous pression disque — pour une copie de secours c'est exactement
 * ce qu'il faut éviter. */
async function demanderStockagePersistant(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist().catch(() => {});
    }
  } catch {}
}

/** Purge des copies trop anciennes (> 30 j) et du surplus (> 6).
 * ⚠ Piège IndexedDB : les suppressions doivent être émises DANS le callback
 * onsuccess du getAll (même transaction) — les émettre après un await
 * laisserait la transaction se committer avant (deletes perdus). */
async function purger(): Promise<void> {
  try {
    const db = await ouvrirDb();
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const req = st.getAll();
    req.onsuccess = () => {
      try {
        const tous = req.result as LocalReplayRecord[];
        const maintenant = Date.now();
        const aSupprimer = new Set(
          tous
            .filter((r) => maintenant - new Date(r.savedAt).getTime() > MAX_AGE_MS)
            .map((r) => r.liveId)
        );
        const restants = tous
          .filter((r) => !aSupprimer.has(r.liveId))
          .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        restants.slice(MAX_COPIES).forEach((r) => aSupprimer.add(r.liveId));
        for (const liveId of aSupprimer) {
          st.delete(liveId);
        }
      } catch {}
    };
  } catch (e) {
    console.warn("[replay-local] Purge impossible :", e instanceof Error ? e.message : e);
  }
}

/**
 * Sauvegarde durable de la copie locale (appelée par le studio DÈS l'arrêt de
 * l'enregistrement, AVANT toute tentative d'upload : quoi qu'il arrive
 * ensuite — échec R2, crash, navigation — le fichier reste récupérable).
 */
export async function saveLocalReplay(input: {
  liveId: string;
  title: string;
  blob: Blob;
  uploadFailed: boolean;
}): Promise<boolean> {
  if (!idbDisponible()) return false;
  const tache = (async () => {
    const rec: LocalReplayRecord = {
      liveId: input.liveId,
      title: input.title,
      savedAt: new Date().toISOString(),
      sizeBytes: input.blob.size,
      mimeType: input.blob.type || "video/webm",
      uploadFailed: input.uploadFailed,
      blob: input.blob,
    };
    await requete("readwrite", (st) => st.put(rec));
    await demanderStockagePersistant();
    await purger();
    return true;
  })();
  return chainer(tache).catch((e) => {
    console.warn(
      "[replay-local] Sauvegarde locale impossible (quota ? navigation privée ?) :",
      e instanceof Error ? e.message : e
    );
    return false;
  });
}

/** Met à jour uniquement les indicateurs (pas de ré-écriture du blob). */
export async function updateLocalReplayFlags(
  liveId: string,
  flags: { uploadFailed: boolean }
): Promise<void> {
  if (!idbDisponible()) return;
  const tache = (async () => {
    const rec = await requete<LocalReplayRecord | undefined>("readonly", (st) => st.get(liveId));
    if (rec) {
      await requete("readwrite", (st) => st.put({ ...rec, ...flags }));
    }
  })();
  await chainer(tache).catch(() => {});
}

/** Récupère la copie complète (avec le blob) — null si absente. */
export async function getLocalReplay(liveId: string): Promise<LocalReplayRecord | null> {
  if (!idbDisponible()) return null;
  try {
    const rec = await requete<LocalReplayRecord | undefined>("readonly", (st) => st.get(liveId));
    return rec ?? null;
  } catch {
    return null;
  }
}

/** Métadonnées de toutes les copies locales (sans les blobs — léger). */
export async function listLocalReplays(): Promise<LocalReplayMeta[]> {
  if (!idbDisponible()) return [];
  try {
    const tous = await requete<LocalReplayRecord[]>("readonly", (st) => st.getAll());
    return tous
      .map(versMeta)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

/** Supprime la copie locale (après un upload réussi, ou à la demande). */
export async function deleteLocalReplay(liveId: string): Promise<void> {
  if (!idbDisponible()) return;
  // Attendre les écritures en vol : sinon la suppression d'« après succès »
  // peut passer AVANT la sauvegarde initiale et le fichier revient.
  const tache = (async () => {
    try { await operations; } catch {}
    await requete("readwrite", (st) => st.delete(liveId));
  })();
  await chainer(tache).catch(() => {});
}

/* ─────────────────────────────────────────────────────────────────────────
 * TÉLÉCHARGEMENT ROBUSTE (PC + smartphone)
 * =========================================================================
 * L'URL objet est conservée 60 s après le clic : la révoquer immédiatement
 * (ancien code) peut AVORTER un téléchargement encore en initialisation sur
 * Safari/Firefox. 60 s couvre le démarrage même sur connexion lente.
 * ──────────────────────────────────────────────────────────────────────── */
export function telechargerBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
      URL.revokeObjectURL(url);
    }, 60_000);
    return true;
  } catch (e) {
    console.warn("[replay-local] Téléchargement impossible :", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Nom de fichier lisible : replay-<titre-slug>-<AAAAMMJJ-HHmm>.<webm|mp4> */
export function nomFichierReplay(title: string, mimeType: string, savedAt: string): string {
  const slug =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "live";
  const d = new Date(savedAt);
  const dateStr = isNaN(d.getTime())
    ? ""
    : `-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const ext = (mimeType || "").includes("mp4") ? "mp4" : "webm";
  return `replay-${slug}${dateStr}.${ext}`;
}

/** Taille lisible : « 1,4 Go » / « 382 Mo » / « 900 Ko ». */
export function tailleLisible(sizeBytes: number): string {
  if (!sizeBytes || sizeBytes <= 0) return "0 Mo";
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1).replace(".", ",")} Go`;
  }
  if (sizeBytes >= 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / (1024 * 1024)))} Mo`;
  }
  return `${Math.max(1, Math.round(sizeBytes / 1024))} Ko`;
}
