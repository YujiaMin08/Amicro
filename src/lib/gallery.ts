/**
 * 角色库 — localStorage 持久化
 * 每个角色保存：缩略图、任务 ID、名字、创建时间
 * 通过 rigTaskId 可随时重新生成 3D 动画 URL
 */

const GALLERY_KEY = "amico_gallery";

export interface GalleryItem {
  id: string;
  name: string;
  characterProfile?: {
    background?: string;
    facts?: string;
    summary?: string;
  };
  gender?: "male" | "female";
  createdAt: number;
  /** 压缩后的 2D 黏土风格缩略图（JPEG data URL，约 30-60 KB） */
  thumbnail: string;
  /** Tripo3D 模型生成任务 ID（用于重新获取模型 URL） */
  modelTaskId?: string;
  /** Tripo3D 骨骼绑定任务 ID（用于生成新动画） */
  rigTaskId?: string;
  /** 最近一次 idle 动画 URL（可能过期，仅作缓存） */
  lastModelUrl?: string;
}

// ── 压缩图片 ─────────────────────────────────────────────────────────────────
export async function compressImage(
  dataUrl: string,
  maxSizePx = 240,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSizePx / img.width, maxSizePx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // 压缩失败返回原图
    img.src = dataUrl;
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    return raw ? (JSON.parse(raw) as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveGallery(items: GalleryItem[]): void {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
  } catch {
    // localStorage 满时静默忽略
    console.warn("[gallery] localStorage 存储空间不足");
  }
}

/** 添加或更新一个角色 */
export function upsertGalleryItem(item: GalleryItem): void {
  const items = loadGallery();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.unshift(item); // 最新的放最前
  }
  saveGallery(items);
}

/** 删除一个角色 */
export function deleteGalleryItem(id: string): void {
  const items = loadGallery().filter((i) => i.id !== id);
  saveGallery(items);
}

/** 更新角色的最新模型 URL */
export function updateGalleryItemUrl(id: string, modelUrl: string): void {
  const items = loadGallery();
  const item = items.find((i) => i.id === id);
  if (item) {
    item.lastModelUrl = modelUrl;
    saveGallery(items);
  }
}

/** 生成唯一 ID */
export function generateId(): string {
  return `amico_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
