"use client";

import { useState, useEffect, useRef } from "react";

// Electron API 类型声明（Electron 环境下由 preload.js 注入）
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      loadPet: (glbUrl: string) => Promise<{ success: boolean; error?: string }>;
      loadPetWithAnimations: (data: {
        animUrls: Record<string, string>;
        currentPreset: string;
        characterName?: string;
        characterId?: string;
        characterProfile?: {
          background?: string;
          facts?: string;
          summary?: string;
        };
      }) => Promise<{ success: boolean; error?: string }>;
      deleteCharacterData: (data: {
        characterId: string;
        characterName?: string;
        clearGlobalModels?: boolean;
      }) => Promise<{ success: boolean; error?: string }>;
      setIgnoreMouse: (ignore: boolean) => void;
      movePetWindow: (dx: number, dy: number) => void;
      showPetMenu: () => void;
      onLoadGlb: (callback: (url: string) => void) => void;
      onPlayAnimation: (callback: (preset: string) => void) => void;
    };
  }
}
import { AnimatePresence, motion } from "framer-motion";
import LandingPage from "@/components/LandingPage";
import CreateModal from "@/components/CreateModal";
import ProcessingScreen from "@/components/ProcessingScreen";
import Preview2DScreen from "@/components/Preview2DScreen";
import ConfirmStepScreen from "@/components/ConfirmStepScreen";
import PreviewScreen from "@/components/PreviewScreen";
import GalleryScreen from "@/components/GalleryScreen";
import {
  compressImage,
  loadGallery,
  upsertGalleryItem,
  generateId,
  type GalleryItem,
} from "@/lib/gallery";
import {
  cacheModelFromUrl,
  getCachedModelObjectUrl,
  revokeModelObjectUrl,
} from "@/lib/modelCache";

// ─── 状态机 ────────────────────────────────────────────────────────────────
export type AppState =
  | "landing"
  | "gallery"            // 我的角色库
  | "upload"
  | "processing2d"
  | "preview2d"
  | "processing_model"
  | "confirm_model"
  | "processing_rig"
  | "confirm_rig"
  | "processing_anim"
  | "preview3d";

export type Processing3DStep = "modeling" | "rigging" | "animating";
type Preview3DSource = "flow" | "gallery";

// ─── localStorage 存档 ────────────────────────────────────────────────────
const SESSION_KEY = "amico_session";

interface AmicoSession {
  characterName?: string;
  characterGender?: "male" | "female";
  characterProfile?: {
    background?: string;
    facts?: string;
    summary?: string;
  };
  uploadedImage: string;
  styledImage: string;
  styledImageBase64?: string;
  modelTaskId?: string;
  modelUrl?: string;
  rigTaskId?: string;
  riggedModelUrl?: string;
  animUrls?: Record<string, string>;
  savedAt: number;
}

function saveSession(data: Partial<AmicoSession>) {
  try {
    const existing = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}") as AmicoSession;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...data, savedAt: Date.now() }));
  } catch { /* storage 满或隐私模式 */ }
}

function loadSession(): AmicoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AmicoSession : null;
  } catch { return null; }
}

function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ─── 通用 URL 提取（兼容字符串/对象两种格式）────────────────────────────
function extractUrl(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const out = output as Record<string, unknown>;
  for (const key of ["model", "pbr_model", "base_model"]) {
    const val = out[key];
    if (typeof val === "string" && val.startsWith("http")) return val;
    if (val && typeof val === "object") {
      const url = (val as { url?: string }).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }
  return null;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  return atob(padded);
}

function getSignedUrlExpiryEpoch(url: string | undefined): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const policy = parsed.searchParams.get("Policy");
    if (!policy) return null;

    const payload = JSON.parse(decodeBase64Url(policy)) as {
      Statement?: Array<{
        Condition?: { DateLessThan?: { "AWS:EpochTime"?: number | string } };
      }>;
    };

    const raw = payload.Statement?.[0]?.Condition?.DateLessThan?.["AWS:EpochTime"];
    const epoch = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(epoch) ? Number(epoch) : null;
  } catch {
    return null;
  }
}

function isSignedUrlExpired(url: string | undefined, leewaySeconds = 45): boolean {
  const epoch = getSignedUrlExpiryEpoch(url);
  if (!epoch) return false;
  return epoch <= Math.floor(Date.now() / 1000) + leewaySeconds;
}

// ─── 弹窗 ─────────────────────────────────────────────────────────────────
function SuccessToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onDismiss} />
      <motion.div className="relative z-10 card-cute p-10 max-w-sm mx-4 text-center"
        initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-2xl font-black text-primary">✓</span>
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">Your Amico is ready!</h2>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          {typeof window !== "undefined" && window.electronAPI?.isElectron
            ? "Your companion has appeared on your desktop! Drag to move. Right-click for options. Press ⌘⇧A to show/hide."
            : "In the full version, your companion will appear right on your desktop."}
        </p>
        <motion.button className="btn-primary w-full py-3" onClick={onDismiss}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Done</motion.button>
      </motion.div>
    </motion.div>
  );
}

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onDismiss} />
      <motion.div className="relative z-10 card-cute p-8 max-w-sm mx-4 text-center"
        initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-xl font-black text-red-500">!</span>
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Something went wrong</h2>
        <p className="text-xs text-muted mb-6 leading-relaxed whitespace-pre-wrap wrap-break-word">{message}</p>
        <motion.button className="btn-primary w-full py-3" onClick={onDismiss}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Try Again</motion.button>
      </motion.div>
    </motion.div>
  );
}

function CharacterProfileModal({
  initialName,
  initialBackground,
  initialFacts,
  initialSummary,
  onClose,
  onSave,
}: {
  initialName: string;
  initialBackground: string;
  initialFacts: string;
  initialSummary: string;
  onClose: () => void;
  onSave: (data: { name: string; background: string; facts: string; summary: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [background, setBackground] = useState(initialBackground);
  const [facts, setFacts] = useState(initialFacts);
  const [summary, setSummary] = useState(initialSummary);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative z-10 card-cute w-full max-w-xl p-6 md:p-8"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-foreground">Optional Character Memory</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-hover text-muted hover:text-foreground transition-colors">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              maxLength={24}
              className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground text-sm focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Background / Personality</p>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Tone, background, role..."
              maxLength={600}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground text-sm focus:outline-none focus:border-primary/30 transition-colors resize-none"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">User Facts</p>
            <textarea
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              placeholder="Things this character should remember about you"
              maxLength={600}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground text-sm focus:outline-none focus:border-primary/30 transition-colors resize-none"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Summary / Notes</p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Optional relationship summary"
              maxLength={2000}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground text-sm focus:outline-none focus:border-primary/30 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full bg-surface hover:bg-surface-hover transition-colors font-semibold text-foreground text-sm"
          >
            Later
          </button>
          <button
            onClick={() => onSave({
              name: name.trim(),
              background: background.trim(),
              facts: facts.trim(),
              summary: summary.trim(),
            })}
            className="flex-1 btn-primary py-3 text-sm"
          >
            Save Info
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 主页面 ────────────────────────────────────────────────────────────────
export default function Home() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [styledImage, setStyledImage] = useState<string | null>(null);
  const [styledImageBase64, setStyledImageBase64] = useState<string | null>(null);

  // 3D pipeline 中间产物
  const [modelTaskId, setModelTaskId] = useState<string | null>(null);
  const [baseModelUrl, setBaseModelUrl] = useState<string | null>(null);   // confirm_model 用
  const [rigTaskId, setRigTaskId] = useState<string | null>(null);
  const [riggedModelUrl, setRiggedModelUrl] = useState<string | null>(null); // confirm_rig 用

  // 最终动画
  const [animUrls, setAnimUrls] = useState<Record<string, string>>({});
  const [activeAnimPreset, setActiveAnimPreset] = useState("idle");
  const [currentModelUrl, setCurrentModelUrl] = useState<string | null>(null);
  const [generatingAnim, setGeneratingAnim] = useState<string | null>(null);

  const [processing3DStep, setProcessing3DStep] = useState<Processing3DStep>("modeling");
  const [isRegenerating2D, setIsRegenerating2D] = useState(false);
  const [isRegenerating3D, setIsRegenerating3D] = useState(false);
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [characterGender, setCharacterGender] = useState<"male" | "female">("female");
  const [characterProfile, setCharacterProfile] = useState<{ background?: string; facts?: string; summary?: string }>({});
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  // 当前角色的 gallery ID（用于更新保存记录）
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [preview3DSource, setPreview3DSource] = useState<Preview3DSource>("flow");
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const localModelObjectUrlRef = useRef<string | null>(null);

  const setCurrentModelUrlSafe = (url: string | null, isObjectUrl = false) => {
    if (localModelObjectUrlRef.current && localModelObjectUrlRef.current !== url) {
      revokeModelObjectUrl(localModelObjectUrlRef.current);
      localModelObjectUrlRef.current = null;
    }

    if (isObjectUrl && url?.startsWith("blob:")) {
      localModelObjectUrlRef.current = url;
    }
    setCurrentModelUrl(url);
  };

  useEffect(() => {
    const session = loadSession();
    if (session?.styledImage) setHasSavedSession(true);
  }, []);

  useEffect(() => {
    return () => {
      if (localModelObjectUrlRef.current) {
        revokeModelObjectUrl(localModelObjectUrlRef.current);
        localModelObjectUrlRef.current = null;
      }
    };
  }, []);

  // ── 恢复存档 ───────────────────────────────────────────────────────────
  const handleRestoreSession = () => {
    const session = loadSession();
    if (!session) return;
    setPreview3DSource("flow");
    setUploadedImage(session.uploadedImage ?? null);
    setStyledImage(session.styledImage);
    setStyledImageBase64(session.styledImageBase64 ?? null);
    setModelTaskId(session.modelTaskId ?? null);
    setRigTaskId(session.rigTaskId ?? null);
    setCharacterName(session.characterName ?? "");
    setCharacterGender(session.characterGender ?? "female");
    setCharacterProfile(session.characterProfile ?? {});
    setHasSavedSession(false);

    if (session.animUrls && Object.keys(session.animUrls).length > 0) {
      const urls = session.animUrls;
      const preset = Object.keys(urls)[0];
      setAnimUrls(urls);
      setActiveAnimPreset(preset);
      setCurrentModelUrlSafe(urls[preset]);
      setAppState("preview3d");
    } else if (session.riggedModelUrl) {
      setRiggedModelUrl(session.riggedModelUrl);
      setAppState("confirm_rig");
    } else if (session.modelUrl) {
      setBaseModelUrl(session.modelUrl);
      setAppState("confirm_model");
    } else {
      setAppState("preview2d");
    }
  };

  // ── Tripo3D 签名 URL → 服务端代理 URL（解决 CORS 问题）────────────────
  const toProxied = (url: string | null): string | null =>
    url ? `/api/proxy/glb?url=${encodeURIComponent(url)}` : null;

  // ── 公共辅助 ───────────────────────────────────────────────────────────
  const tripoCall = async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const detail = (data.detail as string) ?? "";
      throw new Error(((data.error as string) ?? "Request failed") + (detail ? `\n${detail}` : ""));
    }
    return data;
  };

  const pollTripoStatus = async (taskId: string): Promise<Record<string, unknown>> => {
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const data = await tripoCall(`/api/tripo/status?taskId=${taskId}`);
      const status = data.status as string;
      if (status === "success") return data;
      if (status === "failed" || status === "cancelled") throw new Error(`Tripo task failed (${status})`);
    }
    throw new Error("Tripo task timed out");
  };

  // ── 公共风格生成函数 ───────────────────────────────────────────────────
  const runStyleGeneration = async (file: File, preview: string, isRegen = false) => {
    if (!isRegen) {
      setUploadedFile(file);
      setUploadedImage(preview);
      setStyledImage(null);
      setAppState("processing2d");
    } else {
      setIsRegenerating2D(true);
    }
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/generate/style", { method: "POST", body: formData });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? "Style failed");

      const dataUrl = data.styledImageDataUrl as string;
      const base64 = dataUrl.split(",")[1];
      setStyledImage(dataUrl);
      setStyledImageBase64(base64);
      saveSession({
        uploadedImage: preview,
        styledImage: dataUrl,
        styledImageBase64: base64,
        characterName,
        characterGender,
        characterProfile,
      });
      if (!isRegen) setAppState("preview2d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Style generation failed.");
      if (!isRegen) setAppState("landing");
    } finally {
      setIsRegenerating2D(false);
    }
  };

  // ── PHASE 1: 上传 → 2D 风格图 ─────────────────────────────────────────
  const handleImageUploaded = (
    file: File,
    preview: string,
    profile?: { name?: string; gender?: "male" | "female" }
  ) => {
    const nextName = profile?.name?.trim() ?? "";
    const nextGender = profile?.gender ?? characterGender;
    if (nextName) setCharacterName(nextName);
    setCharacterGender(nextGender);
    saveSession({
      characterName: nextName || characterName,
      characterGender: nextGender,
      characterProfile: characterProfile,
    });
    runStyleGeneration(file, preview, false);
  };

  // ── 重新生成 2D 风格（图片流程用原图，随机流程用存档 gender/name）──────
  const handleRegenerateStyle = () => {
    if (uploadedFile && uploadedImage) {
      // 照片流程：用同一张原图重新跑
      runStyleGeneration(uploadedFile, uploadedImage, true);
    } else {
      // 随机流程：用相同 gender + name 重新生成
      handleRandomGenerate(characterGender, characterName);
    }
  };

  const updateCharacterProfile = (data: {
    name?: string;
    background?: string;
    facts?: string;
    summary?: string;
  }) => {
    const nextName = data.name?.trim() || characterName;
    const nextProfile = {
      background: data.background?.trim() || "",
      facts: data.facts?.trim() || "",
      summary: data.summary?.trim() || "",
    };
    setCharacterName(nextName);
    setCharacterProfile(nextProfile);

    saveSession({
      characterName: nextName,
      characterGender,
      characterProfile: nextProfile,
    });

    if (currentGalleryId) {
      const existingItem = loadGallery().find((i) => i.id === currentGalleryId);
      const item: GalleryItem = {
        id: currentGalleryId,
        name: nextName || "My Amico",
        gender: characterGender,
        characterProfile: nextProfile,
        createdAt: existingItem?.createdAt || Date.now(),
        thumbnail: styledImage || existingItem?.thumbnail || "",
        modelTaskId: modelTaskId ?? undefined,
        rigTaskId: rigTaskId ?? undefined,
        lastModelUrl: currentModelUrl ?? undefined,
      };
      if (item.thumbnail) upsertGalleryItem(item);
    }
  };

  // ── PHASE 2: 生成 3D 网格（首次 or 重新生成）────────────────────────
  const runGenerate3DModel = async (isRegen = false) => {
    if (!styledImageBase64) return;
    if (isRegen) {
      setIsRegenerating3D(true);
    } else {
      setProcessing3DStep("modeling");
      setAppState("processing_model");
    }
    try {
      const uploadData = await tripoCall("/api/tripo/upload", {
        base64: styledImageBase64,
        mimeType: "image/png",
      });
      const fileToken = uploadData.fileToken as string;

      const taskData = await tripoCall("/api/tripo/task", {
        type: "image_to_model",
        file: { type: "png", file_token: fileToken },
        // 提高网格细节，保留四肢分离结构，便于后续骨骼绑定
        texture_quality: "detailed",
        model_seed: 42,
      });
      const taskId = taskData.taskId as string;
      const result = await pollTripoStatus(taskId);

      const url = extractUrl(result.output);
      if (!url) throw new Error(`No model URL in output: ${JSON.stringify(result.output)}`);

      const proxiedUrl = toProxied(url)!;
      setModelTaskId(taskId);
      setBaseModelUrl(proxiedUrl);
      saveSession({
        modelTaskId: taskId,
        modelUrl: proxiedUrl,
        characterName,
        characterGender,
        characterProfile,
      });
      if (!isRegen) setAppState("confirm_model");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "3D model generation failed.");
      if (!isRegen) setAppState("preview2d");
    } finally {
      setIsRegenerating3D(false);
    }
  };

  const handleGenerate3DModel = () => runGenerate3DModel(false);
  const handleRegenerate3DModel = () => runGenerate3DModel(true);

  // ── PHASE 3: 绑骨骼（首次 or 重新绑定）──────────────────────────────
  const runBindSkeleton = async (isRegen = false) => {
    if (!modelTaskId) return;
    if (isRegen) {
      setIsRegenerating3D(true);
    } else {
      setProcessing3DStep("rigging");
      setAppState("processing_rig");
    }
    try {
      const taskData = await tripoCall("/api/tripo/task", {
        type: "animate_rig",
        original_model_task_id: modelTaskId,
        // 指定 biped rig 版本，支持 preset:biped:xxx 系列动画
        rig_type: "biped",
      });
      const taskId = taskData.taskId as string;
      const result = await pollTripoStatus(taskId);

      const url = extractUrl(result.output);
      if (!url) throw new Error(`No rigged model URL: ${JSON.stringify(result.output)}`);

      const proxiedRigUrl = toProxied(url)!;
      setRigTaskId(taskId);
      setRiggedModelUrl(proxiedRigUrl);
      saveSession({
        rigTaskId: taskId,
        riggedModelUrl: proxiedRigUrl,
        characterName,
        characterGender,
        characterProfile,
      });
      if (!isRegen) setAppState("confirm_rig");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Skeleton binding failed.");
      if (!isRegen) setAppState("confirm_model");
    } finally {
      setIsRegenerating3D(false);
    }
  };

  const handleBindSkeleton = () => runBindSkeleton(false);
  const handleRebindSkeleton = () => runBindSkeleton(true);

  // ── 随机生成角色（text→2D黏土图→preview2D，与照片流程完全相同）──────
  const handleRandomGenerate = async (
    gender: "male" | "female",
    name: string
  ) => {
    setIsGeneratingRandom(true);
    setCharacterName(name);
    setCharacterGender(gender);
    setUploadedImage(null);   // 无原始照片
    setUploadedFile(null);
    setStyledImage(null);
    setAppState("processing2d");

    try {
      const res = await fetch("/api/generate/text-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          name,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? "Character generation failed");

      const dataUrl = data.styledImageDataUrl as string;
      const base64 = dataUrl.split(",")[1];

      setStyledImage(dataUrl);
      setStyledImageBase64(base64);
      saveSession({
        styledImage: dataUrl,
        styledImageBase64: base64,
        characterName: name,
        characterGender: gender,
        characterProfile,
      });
      setAppState("preview2d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Character generation failed.");
      setAppState("landing");
    } finally {
      setIsGeneratingRandom(false);
    }
  };

  // ── PHASE 4: 生成 idle 动画 ───────────────────────────────────────────
  const handleGenerateAnimation = async (rigTaskIdOverride?: string) => {
    const rigTaskIdToUse = rigTaskIdOverride ?? rigTaskId;
    if (!rigTaskIdToUse) return;
    setProcessing3DStep("animating");
    setAppState("processing_anim");

    try {
      const taskData = await tripoCall("/api/tripo/task", {
        type: "animate_retarget",
        original_model_task_id: rigTaskIdToUse,
        animation: "preset:idle",
      });
      const taskId = taskData.taskId as string;
      const result = await pollTripoStatus(taskId);

      const url = extractUrl(result.output);
      if (!url) throw new Error(`No animated model URL: ${JSON.stringify(result.output)}`);

      const proxiedAnimUrl = toProxied(url)!;
      const urls = { idle: proxiedAnimUrl };
      setAnimUrls(urls);
      setActiveAnimPreset("idle");
      setCurrentModelUrlSafe(proxiedAnimUrl);
      saveSession({
        animUrls: urls,
        characterName,
        characterGender,
        characterProfile,
      });
      // 自动保存到角色库
      await saveToGallery(proxiedAnimUrl);
      setAppState("preview3d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Animation generation failed.");
      if (preview3DSource === "gallery") {
        setAppState("gallery");
      } else {
        setAppState("confirm_rig");
      }
    }
  };

  // ── 追加动画（preview3d 页面用户点击 Walk/Run/Wave）────────────────────
  const handleRequestAnimation = async (preset: string) => {
    if (!rigTaskId || generatingAnim) return;
    if (animUrls[preset]) {
      setActiveAnimPreset(preset);
      setCurrentModelUrlSafe(animUrls[preset]);
      return;
    }
    setGeneratingAnim(preset);
    try {
      // key 格式：
      //   "idle"          → "preset:idle"       （基础预设）
      //   "biped:agree"   → "preset:biped:agree"（biped 预设）
      const animationKey = `preset:${preset}`;
      const taskData = await tripoCall("/api/tripo/task", {
        type: "animate_retarget",
        original_model_task_id: rigTaskId,
        animation: animationKey,
      });
      const taskId = taskData.taskId as string;
      const result = await pollTripoStatus(taskId);
      const url = extractUrl(result.output);
      if (!url) throw new Error("Animation URL not found");
      const proxied = toProxied(url)!;
      const updated = { ...animUrls, [preset]: proxied };
      setAnimUrls(updated);
      setActiveAnimPreset(preset);
      setCurrentModelUrlSafe(proxied);
      saveSession({
        animUrls: updated,
        characterName,
        characterGender,
        characterProfile,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Animation generation failed.");
    } finally {
      setGeneratingAnim(null);
    }
  };

  // ── 保存角色到 Gallery ─────────────────────────────────────────────────
  const saveToGallery = async (idleUrl: string) => {
    if (!styledImage) return;
    try {
      const thumbnail = await compressImage(styledImage, 240, 0.82);
      const id = currentGalleryId ?? generateId();
      setCurrentGalleryId(id);
      const item: GalleryItem = {
        id,
        name: characterName || "My Amico",
        characterProfile,
        gender: characterGender,
        createdAt: Date.now(),
        thumbnail,
        modelTaskId: modelTaskId ?? undefined,
        rigTaskId: rigTaskId ?? undefined,
        lastModelUrl: idleUrl,
      };
      upsertGalleryItem(item);
      // 将 idle GLB 持久化到浏览器本地，避免签名 URL 过期后无法加载
      void cacheModelFromUrl({ characterId: id, preset: "idle", url: idleUrl });
      console.log("[gallery] 已保存:", item.name);
    } catch (err) {
      console.error("[gallery] 保存失败:", err);
    }
  };

  // ── 从 Gallery 加载角色（重新进入 preview3d）──────────────────────────
  const handleLoadFromGallery = async (item: GalleryItem) => {
    // 恢复角色状态
    setPreview3DSource("gallery");
    setCurrentGalleryId(item.id);
    setCharacterName(item.name);
    setCharacterProfile(item.characterProfile ?? {});
    if (item.gender) setCharacterGender(item.gender);
    setModelTaskId(item.modelTaskId ?? null);
    setRigTaskId(item.rigTaskId ?? null);
    setStyledImage(item.thumbnail); // 用缩略图作为参考图

    const cachedIdleObjectUrl = await getCachedModelObjectUrl({
      characterId: item.id,
      preset: "idle",
    });

    if (cachedIdleObjectUrl) {
      // 优先使用本地缓存的 GLB（二进制持久化，不受签名过期影响）
      const urls = { idle: cachedIdleObjectUrl };
      setAnimUrls(urls);
      setActiveAnimPreset("idle");
      setCurrentModelUrlSafe(cachedIdleObjectUrl, true);
      setAppState("preview3d");
      return;
    }

    if (item.lastModelUrl && !isSignedUrlExpired(item.lastModelUrl)) {
      // 其次使用远端 URL（仍可在后台补一份本地缓存）
      const urls = { idle: item.lastModelUrl };
      setAnimUrls(urls);
      setActiveAnimPreset("idle");
      setCurrentModelUrlSafe(item.lastModelUrl);
      setAppState("preview3d");
      void cacheModelFromUrl({ characterId: item.id, preset: "idle", url: item.lastModelUrl });
      return;
    }

    if (item.rigTaskId) {
      // 没有缓存 URL 但有 rig task → 重新生成动画
      setAppState("processing_anim");
      void handleGenerateAnimation(item.rigTaskId);
      return;
    }

    if (item.lastModelUrl) {
      // 没有 rig task，只能尝试一次旧 URL（可能失败）
      const urls = { idle: item.lastModelUrl };
      setAnimUrls(urls);
      setActiveAnimPreset("idle");
      setCurrentModelUrlSafe(item.lastModelUrl);
      setAppState("preview3d");
      return;
    }

    // 没有任何 3D 数据 → 回到 2D 预览
    setAppState("preview2d");
  };

  const handleDeleteCharacter = async (item: GalleryItem) => {
    const isCurrentCharacter = currentGalleryId === item.id;

    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      try {
        await window.electronAPI.deleteCharacterData({
          characterId: item.id,
          characterName: item.name || undefined,
          // 当前角色被删时，一并清空桌宠侧当前模型/动画文件
          clearGlobalModels: isCurrentCharacter,
        });
      } catch (err) {
        console.warn("[desktop] deleteCharacterData failed:", err);
      }
    }

    if (!isCurrentCharacter) return;

    setCurrentGalleryId(null);
    setCharacterName("");
    setCharacterProfile({});
    setModelTaskId(null);
    setBaseModelUrl(null);
    setRigTaskId(null);
    setRiggedModelUrl(null);
    setAnimUrls({});
    setActiveAnimPreset("idle");
    setCurrentModelUrlSafe(null);
    clearSession();
  };

  const handlePreview3DBack = () => {
    if (preview3DSource === "gallery") {
      setAppState("gallery");
      return;
    }
    if (riggedModelUrl) {
      setAppState("confirm_rig");
      return;
    }
    if (styledImage) {
      setAppState("preview2d");
      return;
    }
    setAppState("landing");
  };

  // ── 重置 ───────────────────────────────────────────────────────────────
  const resetAll = () => {
    clearSession();
    setUploadedImage(null);
    setUploadedFile(null);
    setStyledImage(null);
    setStyledImageBase64(null);
    setModelTaskId(null);
    setBaseModelUrl(null);
    setRigTaskId(null);
    setRiggedModelUrl(null);
    setAnimUrls({});
    setActiveAnimPreset("idle");
    setCurrentModelUrlSafe(null);
    setGeneratingAnim(null);
    setCurrentGalleryId(null);
    setCharacterName("");
    setCharacterGender("female");
    setCharacterProfile({});
    setIsProfileEditorOpen(false);
    setPreview3DSource("flow");
  };

  const handleSuccessDismiss = () => {
    setShowSuccess(false);
    resetAll();
    setAppState("landing");
  };

  const wrap = (key: string, children: React.ReactNode) => (
    <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );

  return (
    <main className="min-h-screen relative">
      {/* 存档恢复提示 */}
      <AnimatePresence>
        {hasSavedSession && appState === "landing" && (
          <motion.div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-40 card-cute px-5 py-3 flex items-center gap-4 shadow-md"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          >
            <span className="text-sm font-semibold text-foreground">You have a saved session</span>
            <button onClick={handleRestoreSession}
              className="text-sm font-bold text-primary hover:text-primary-dark transition-colors">Resume</button>
            <button onClick={() => { clearSession(); setHasSavedSession(false); }}
              className="text-xs text-muted hover:text-foreground transition-colors">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主内容 */}
      <AnimatePresence mode="wait">
        {appState === "landing" &&
          wrap("landing",
            <LandingPage
              onCreateClick={() => setAppState("upload")}
              onGalleryClick={() => setAppState("gallery")}
            />
          )}

        {appState === "gallery" &&
          wrap("gallery",
            <GalleryScreen
              onBack={() => setAppState("landing")}
              onLoadCharacter={handleLoadFromGallery}
              onCreateNew={() => setAppState("upload")}
              onDeleteCharacter={handleDeleteCharacter}
            />
          )}

        {appState === "processing2d" &&
          wrap("processing2d",
            <ProcessingScreen
              uploadedImage={uploadedImage}
              mode={uploadedFile ? "2d" : "2d-random"}
            />
          )}

        {appState === "preview2d" && styledImage &&
          wrap("preview2d",
            <Preview2DScreen
              originalImage={uploadedImage}
              styledImage={styledImage}
              isRegenerating={isRegenerating2D}
              onConfirm={handleGenerate3DModel}
              onRegenerateStyle={handleRegenerateStyle}
              onChangePhoto={() => setAppState("upload")}
              onBack={() => setAppState("landing")}
            />)}

        {appState === "processing_model" &&
          wrap("processing_model",
            <ProcessingScreen uploadedImage={styledImage} mode="3d" currentStep="modeling" />)}

        {appState === "confirm_model" && baseModelUrl &&
          wrap("confirm_model",
            <ConfirmStepScreen
              step="model"
              modelUrl={baseModelUrl}
              referenceImage={styledImage}
              isRegenerating={isRegenerating3D}
              onConfirm={handleBindSkeleton}
              onRegenerate={handleRegenerate3DModel}
              onStartOver={() => { resetAll(); setAppState("upload"); }}
            />)}

        {appState === "processing_rig" &&
          wrap("processing_rig",
            <ProcessingScreen uploadedImage={styledImage} mode="3d" currentStep="rigging" />)}

        {appState === "confirm_rig" && riggedModelUrl &&
          wrap("confirm_rig",
            <ConfirmStepScreen
              step="rig"
              modelUrl={riggedModelUrl}
              referenceImage={styledImage}
              isRegenerating={isRegenerating3D}
              onConfirm={() => {
                setPreview3DSource("flow");
                void handleGenerateAnimation();
              }}
              onRegenerate={handleRebindSkeleton}
              onStartOver={() => { resetAll(); setAppState("upload"); }}
            />)}

        {appState === "processing_anim" &&
          wrap("processing_anim",
            <ProcessingScreen uploadedImage={styledImage} mode="3d" currentStep="animating" />)}

        {appState === "preview3d" &&
          wrap("preview3d",
            <PreviewScreen
              uploadedImage={styledImage}
              modelUrl={currentModelUrl}
              rigTaskId={rigTaskId}
              animUrls={animUrls}
              activeAnimPreset={activeAnimPreset}
              generatingAnim={generatingAnim}
              onRequestAnimation={handleRequestAnimation}
              onRecreate={() => { resetAll(); setAppState("upload"); }}
              onConfirm={async () => {
                if (typeof window !== "undefined" && window.electronAPI?.isElectron && currentModelUrl) {
                  // 发送所有已生成的动画 URL，让 Electron 批量下载
                  const result = await window.electronAPI.loadPetWithAnimations({
                    animUrls,
                    currentPreset: activeAnimPreset,
                    characterName: characterName.trim() || undefined,
                    characterId: currentGalleryId ?? undefined,
                    characterProfile: characterProfile,
                  });
                  if (!result?.success) {
                    const detail = typeof result?.error === "string" ? result.error : "";
                    setErrorMessage(`Failed to load desktop pet.${detail ? `\n${detail}` : ""}`);
                    return;
                  }
                }
                setShowSuccess(true);
              }}
              onBack={handlePreview3DBack}
              extraPanel={
                <div className="card-cute p-4">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Character Info</p>
                  <p className="text-sm font-semibold text-foreground mb-1">{characterName || "My Amico"}</p>
                  <p className="text-xs text-muted mb-3">
                    {characterProfile.background || characterProfile.facts || characterProfile.summary
                      ? "Memory profile configured"
                      : "No memory profile yet (optional)"}
                  </p>
                  <button
                    onClick={() => setIsProfileEditorOpen(true)}
                    className="w-full py-2.5 rounded-full bg-surface hover:bg-surface-hover transition-colors text-sm font-semibold text-foreground"
                  >
                    Edit Name & Memory
                  </button>
                </div>
              }
            />)}
      </AnimatePresence>

      {/* 创建弹窗（上传照片 或 随机生成） */}
      <AnimatePresence>
        {appState === "upload" && (
          <CreateModal
            key="create"
            onClose={() => setAppState("landing")}
            onImageUploaded={handleImageUploaded}
            onRandomGenerate={handleRandomGenerate}
            isGeneratingRandom={isGeneratingRandom}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && <SuccessToast key="success" onDismiss={handleSuccessDismiss} />}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <ErrorToast key="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileEditorOpen && (
          <CharacterProfileModal
            initialName={characterName}
            initialBackground={characterProfile.background || ""}
            initialFacts={characterProfile.facts || ""}
            initialSummary={characterProfile.summary || ""}
            onClose={() => setIsProfileEditorOpen(false)}
            onSave={(data) => {
              updateCharacterProfile(data);
              setIsProfileEditorOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
