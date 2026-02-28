const DB_NAME = "amico_model_cache";
const STORE_NAME = "models";
const DB_VERSION = 1;

interface CachedModelRecord {
  bytes: ArrayBuffer;
  contentType: string;
  updatedAt: number;
}

interface ModelCacheParams {
  characterId: string;
  preset?: string;
}

interface CacheFromUrlParams extends ModelCacheParams {
  url: string;
}

function getModelKey({ characterId, preset = "idle" }: ModelCacheParams): string {
  return `${characterId}::${preset}`;
}

function indexedDbAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!indexedDbAvailable()) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open model cache"));
  });
}

async function putRecord(key: string, record: CachedModelRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to write model cache"));
      tx.onabort = () => reject(tx.error ?? new Error("Model cache write aborted"));
    });
  } finally {
    db.close();
  }
}

async function getRecord(key: string): Promise<CachedModelRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<CachedModelRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CachedModelRecord | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Failed to read model cache"));
    });
  } finally {
    db.close();
  }
}

async function deleteRecord(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete model cache"));
      tx.onabort = () => reject(tx.error ?? new Error("Model cache delete aborted"));
    });
  } finally {
    db.close();
  }
}

async function deleteRecordsByPrefix(prefix: string): Promise<number> {
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      let removed = 0;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          return;
        }
        const key = String(cursor.key ?? "");
        if (key.startsWith(prefix)) {
          cursor.delete();
          removed += 1;
        }
        cursor.continue();
      };

      req.onerror = () => reject(req.error ?? new Error("Failed to scan model cache"));
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete model cache by prefix"));
      tx.onabort = () => reject(tx.error ?? new Error("Model cache delete by prefix aborted"));
    });
  } finally {
    db.close();
  }
}

export async function cacheModelFromUrl({ characterId, preset = "idle", url }: CacheFromUrlParams): Promise<boolean> {
  if (!indexedDbAvailable()) return false;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;

    const bytes = await res.arrayBuffer();
    const contentType = res.headers.get("Content-Type") ?? "model/gltf-binary";

    await putRecord(getModelKey({ characterId, preset }), {
      bytes,
      contentType,
      updatedAt: Date.now(),
    });

    return true;
  } catch (err) {
    console.warn("[modelCache] cacheModelFromUrl failed:", err);
    return false;
  }
}

export async function getCachedModelObjectUrl({ characterId, preset = "idle" }: ModelCacheParams): Promise<string | null> {
  if (!indexedDbAvailable()) return null;

  try {
    const record = await getRecord(getModelKey({ characterId, preset }));
    if (!record?.bytes) return null;

    const blob = new Blob([record.bytes], {
      type: record.contentType || "model/gltf-binary",
    });

    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("[modelCache] getCachedModelObjectUrl failed:", err);
    return null;
  }
}

export function revokeModelObjectUrl(url?: string | null): void {
  if (!url || !url.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
}

export async function removeCachedModel({ characterId, preset = "idle" }: ModelCacheParams): Promise<boolean> {
  if (!indexedDbAvailable()) return false;
  try {
    await deleteRecord(getModelKey({ characterId, preset }));
    return true;
  } catch (err) {
    console.warn("[modelCache] removeCachedModel failed:", err);
    return false;
  }
}

export async function removeCachedModelsForCharacter(characterId: string): Promise<number> {
  if (!indexedDbAvailable()) return 0;
  if (!characterId) return 0;
  try {
    return await deleteRecordsByPrefix(`${characterId}::`);
  } catch (err) {
    console.warn("[modelCache] removeCachedModelsForCharacter failed:", err);
    return 0;
  }
}
