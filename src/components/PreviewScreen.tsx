"use client";

import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="loading-ring" />
    </div>
  ),
});

// ─── 动画预设配置（桌宠专用）────────────────────────────────────────────────
// 使用 Tripo3D biped preset 格式：preset:biped:xxx
const ANIMATION_PRESETS = [
  { key: "idle",        label: "Idle",   desc: "Breathing loop", icon: "○" },
  { key: "biped:agree", label: "Agree",  desc: "Nodding",        icon: "✓" },
  { key: "biped:clap",  label: "Clap",   desc: "Clapping hands", icon: "◇" },
  { key: "biped:afraid",label: "Afraid", desc: "Scared",         icon: "!" },
];

interface PreviewScreenProps {
  uploadedImage: string | null;
  modelUrl: string | null;
  rigTaskId: string | null;
  animUrls: Record<string, string>;
  activeAnimPreset: string;
  generatingAnim: string | null;
  onRequestAnimation: (preset: string) => void;
  onRecreate: () => void;
  onConfirm: () => void;
  onBack: () => void;
  extraPanel?: React.ReactNode;
}

// ─── 小型 Loading Spinner ────────────────────────────────────────────────────
function Spinner() {
  return (
    <motion.div
      className="w-4 h-4 rounded-full border-2 border-surface"
      style={{ borderTopColor: "#ff8c42" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─── 主组件 ─────────────────────────────────────────────────────────────────
export default function PreviewScreen({
  uploadedImage,
  modelUrl,
  rigTaskId,
  animUrls,
  activeAnimPreset,
  generatingAnim,
  onRequestAnimation,
  onRecreate,
  onConfirm,
  onBack,
  extraPanel,
}: PreviewScreenProps) {

  const handleDownload = () => {
    if (!modelUrl) return;
    const a = document.createElement("a");
    a.href = modelUrl;
    a.download = `amico_${activeAnimPreset}.glb`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #fdf6ee 0%, #f5ede0 100%)" }}
    >
      {/* Top bar */}
      <motion.div
        className="flex items-center justify-between p-4 md:p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-card hover:bg-surface-hover transition-colors shadow-sm border border-primary/10 text-sm font-semibold text-foreground"
        >
          ← Back
        </button>
      </motion.div>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pb-6 min-h-0">

        {/* ── 3D Viewer ──────────────────────────────────────────────── */}
        <motion.div
          className="flex-1 relative rounded-3xl overflow-hidden bg-linear-to-b from-[#faf5ef] to-[#f0e8da] shadow-inner"
          style={{ minHeight: "400px" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ModelViewer modelUrl={modelUrl} />

          {/* Current animation badge */}
          <AnimatePresence>
            {modelUrl && (
              <motion.div
                key={activeAnimPreset}
                className="absolute top-4 left-1/2 -translate-x-1/2"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="bg-card/90 backdrop-blur-sm border border-primary/15 rounded-full px-4 py-1.5 shadow-sm">
                  <span className="text-xs font-bold text-foreground capitalize">
                    {activeAnimPreset.replace("_", " ")} animation
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls hint */}
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <div className="bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-xs text-muted font-medium">Drag to rotate</span>
            </div>
            <div className="bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-xs text-muted font-medium">Scroll to zoom</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Right Panel ────────────────────────────────────────────── */}
        <motion.div
          className="w-full lg:w-72 flex flex-col gap-4"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Animations section */}
          <div className="card-cute p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
              Animations
            </p>
            <div className="space-y-2">
              {ANIMATION_PRESETS.map(({ key, label, desc, icon }) => {
                const hasUrl = !!animUrls[key];
                const isActive = activeAnimPreset === key;
                const isGenerating = generatingAnim === key;
                const canGenerate = !!rigTaskId && !generatingAnim;

                return (
                  <button
                    key={key}
                    onClick={() => onRequestAnimation(key)}
                    disabled={isActive || (!hasUrl && !canGenerate)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 text-sm font-semibold
                      ${isActive
                        ? "bg-primary text-white shadow-md cursor-default"
                        : hasUrl
                        ? "bg-surface hover:bg-surface-hover text-foreground"
                        : canGenerate
                        ? "bg-surface hover:bg-surface-hover text-foreground"
                        : "bg-surface/50 text-muted/50 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isActive ? "bg-white/20" : "bg-foreground/5"
                      }`}>
                        {icon}
                      </span>
                      <div className="text-left">
                        <div>{label}</div>
                        <div className={`text-xs font-normal ${isActive ? "text-white/70" : "text-muted/60"}`}>
                          {desc}
                        </div>
                      </div>
                    </div>

                    {/* Right indicator */}
                    <div className="shrink-0">
                      {isGenerating ? (
                        <Spinner />
                      ) : isActive ? (
                        <span className="text-white text-xs">Playing</span>
                      ) : hasUrl ? (
                        <span className="text-xs text-muted">Switch</span>
                      ) : canGenerate ? (
                        <span className="text-xs text-primary font-bold">Generate</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {!rigTaskId && (
              <p className="text-xs text-muted/50 mt-3 text-center leading-relaxed">
                Additional animations available after 3D generation.
              </p>
            )}
          </div>

          {/* Reference image */}
          {uploadedImage && (
            <div className="card-cute p-4">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Reference</p>
              <img
                src={uploadedImage}
                alt="Source"
                className="w-full max-h-36 rounded-xl object-contain"
              />
            </div>
          )}

          {extraPanel}

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-auto">
            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!modelUrl}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-full border-2 font-semibold text-sm transition-all ${
                modelUrl
                  ? "border-primary/20 text-foreground hover:border-primary/40 hover:bg-primary/5"
                  : "border-muted/20 text-muted/40 cursor-not-allowed"
              }`}
            >
              Download GLB
              {modelUrl && (
                <span className="text-xs text-muted capitalize">({activeAnimPreset})</span>
              )}
            </button>

            {/* Recreate */}
            <button
              onClick={onRecreate}
              className="w-full flex items-center justify-center py-3 rounded-full bg-surface hover:bg-surface-hover transition-colors font-semibold text-foreground text-sm"
            >
              Start Over
            </button>

            {/* Confirm / Create */}
            <motion.button
              onClick={onConfirm}
              disabled={!modelUrl}
              className={`btn-primary w-full py-4 text-center ${!modelUrl ? "opacity-50 cursor-not-allowed" : ""}`}
              whileHover={modelUrl ? { scale: 1.02 } : {}}
              whileTap={modelUrl ? { scale: 0.98 } : {}}
            >
              Create My Amico
            </motion.button>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
