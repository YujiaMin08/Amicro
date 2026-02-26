"use client";

import { useState, useEffect } from "react";

// Electron API 类型声明（Electron 环境下由 preload.js 注入）
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      loadPet: (glbUrl: string) => Promise<{ success: boolean; error?: string }>;
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
  upsertGalleryItem,
  generateId,
  type GalleryItem,
} from "@/lib/gallery";

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

// ─── localStorage 存档 ────────────────────────────────────────────────────
const SESSION_KEY = "amico_session";

interface AmicoSession {
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
            ? "Your companion has appeared on your desktop! Drag it anywhere you like."
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
  // 当前角色的 gallery ID（用于更新保存记录）
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSavedSession, setHasSavedSession] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session?.styledImage) setHasSavedSession(true);
  }, []);

  // ── 恢复存档 ───────────────────────────────────────────────────────────
  const handleRestoreSession = () => {
    const session = loadSession();
    if (!session) return;
    setUploadedImage(session.uploadedImage ?? null);
    setStyledImage(session.styledImage);
    setStyledImageBase64(session.styledImageBase64 ?? null);
    setModelTaskId(session.modelTaskId ?? null);
    setRigTaskId(session.rigTaskId ?? null);
    setHasSavedSession(false);

    if (session.animUrls && Object.keys(session.animUrls).length > 0) {
      const urls = session.animUrls;
      const preset = Object.keys(urls)[0];
      setAnimUrls(urls);
      setActiveAnimPreset(preset);
      setCurrentModelUrl(urls[preset]);
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
      saveSession({ uploadedImage: preview, styledImage: dataUrl, styledImageBase64: base64 });
      if (!isRegen) setAppState("preview2d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Style generation failed.");
      if (!isRegen) setAppState("landing");
    } finally {
      setIsRegenerating2D(false);
    }
  };

  // ── PHASE 1: 上传 → 2D 风格图 ─────────────────────────────────────────
  const handleImageUploaded = (file: File, preview: string) =>
    runStyleGeneration(file, preview, false);

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
      saveSession({ modelTaskId: taskId, modelUrl: proxiedUrl });
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
      saveSession({ rigTaskId: taskId, riggedModelUrl: proxiedRigUrl });
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
  const handleRandomGenerate = async (gender: "male" | "female", name: string) => {
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
        body: JSON.stringify({ gender, name }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? "Character generation failed");

      const dataUrl = data.styledImageDataUrl as string;
      const base64 = dataUrl.split(",")[1];

      setStyledImage(dataUrl);
      setStyledImageBase64(base64);
      saveSession({ styledImage: dataUrl, styledImageBase64: base64 });
      setAppState("preview2d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Character generation failed.");
      setAppState("landing");
    } finally {
      setIsGeneratingRandom(false);
    }
  };

  // ── PHASE 4: 生成 idle 动画 ───────────────────────────────────────────
  const handleGenerateAnimation = async () => {
    if (!rigTaskId) return;
    setProcessing3DStep("animating");
    setAppState("processing_anim");

    try {
      const taskData = await tripoCall("/api/tripo/task", {
        type: "animate_retarget",
        original_model_task_id: rigTaskId,
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
      setCurrentModelUrl(proxiedAnimUrl);
      saveSession({ animUrls: urls });
      // 自动保存到角色库
      await saveToGallery(proxiedAnimUrl);
      setAppState("preview3d");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Animation generation failed.");
      setAppState("confirm_rig");
    }
  };

  // ── 追加动画（preview3d 页面用户点击 Walk/Run/Wave）────────────────────
  const handleRequestAnimation = async (preset: string) => {
    if (!rigTaskId || generatingAnim) return;
    if (animUrls[preset]) {
      setActiveAnimPreset(preset);
      setCurrentModelUrl(animUrls[preset]);
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
      setCurrentModelUrl(proxied);
      saveSession({ animUrls: updated });
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
        gender: characterGender,
        createdAt: Date.now(),
        thumbnail,
        modelTaskId: modelTaskId ?? undefined,
        rigTaskId: rigTaskId ?? undefined,
        lastModelUrl: idleUrl,
      };
      upsertGalleryItem(item);
      console.log("[gallery] 已保存:", item.name);
    } catch (err) {
      console.error("[gallery] 保存失败:", err);
    }
  };

  // ── 从 Gallery 加载角色（重新进入 preview3d）──────────────────────────
  const handleLoadFromGallery = (item: GalleryItem) => {
    // 恢复角色状态
    setCurrentGalleryId(item.id);
    setCharacterName(item.name);
    if (item.gender) setCharacterGender(item.gender);
    setModelTaskId(item.modelTaskId ?? null);
    setRigTaskId(item.rigTaskId ?? null);
    setStyledImage(item.thumbnail); // 用缩略图作为参考图

    if (item.lastModelUrl) {
      // 有缓存 URL，直接跳到 3D 预览（URL 可能过期，加载失败时用缩略图代替）
      const urls = { idle: item.lastModelUrl };
      setAnimUrls(urls);
      setActiveAnimPreset("idle");
      setCurrentModelUrl(item.lastModelUrl);
      setAppState("preview3d");
    } else if (item.rigTaskId) {
      // 没有缓存 URL 但有 rig task → 重新生成动画
      setAppState("processing_anim");
      handleGenerateAnimation();
    } else {
      // 没有任何 3D 数据 → 回到 2D 预览
      setAppState("preview2d");
    }
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
    setCurrentModelUrl(null);
    setGeneratingAnim(null);
    setCurrentGalleryId(null);
    setCharacterName("");
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
              onConfirm={handleGenerateAnimation}
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
                // Electron 环境：直接加载到桌面
                if (typeof window !== "undefined" && window.electronAPI?.isElectron && currentModelUrl) {
                  const result = await window.electronAPI.loadPet(currentModelUrl);
                  if (!result.success) {
                    setErrorMessage(`Failed to load desktop pet: ${result.error}`);
                    return;
                  }
                }
                setShowSuccess(true);
              }}
              onBack={() => setAppState("confirm_rig")}
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
    </main>
  );
}
