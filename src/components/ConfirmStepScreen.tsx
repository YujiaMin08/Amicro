"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="loading-ring" />
    </div>
  ),
});

// 骨骼颜色说明
const BONE_LEGEND = [
  { color: "#ff4444", label: "Spine / Neck / Head" },
  { color: "#44ff44", label: "Arms / Hands" },
  { color: "#4488ff", label: "Legs / Feet" },
];

type Step = "model" | "rig";

const STEP_CONFIG: Record<Step, {
  badge: string;
  title: string;
  desc: string;
  confirmLabel: string;
  nextHint: string;
  regenerateLabel: string;  // 当前步骤的重新生成按钮文字
}> = {
  model: {
    badge: "Step 1 of 3 — 3D Model",
    title: "3D Model Generated",
    desc: "Check the shape and proportions. Drag to rotate and inspect from all angles.",
    confirmLabel: "Looks good — Add Skeleton",
    nextHint: "Next: automatic skeleton binding (~30s)",
    regenerateLabel: "Regenerate 3D Model",
  },
  rig: {
    badge: "Step 2 of 3 — Skeleton",
    title: "Skeleton Bound",
    desc: "A humanoid skeleton has been attached. Confirm to proceed with adding an idle animation.",
    confirmLabel: "Looks good — Add Animation",
    nextHint: "Next: apply idle animation (~30s)",
    regenerateLabel: "Rebind Skeleton",
  },
};

interface ConfirmStepScreenProps {
  step: Step;
  modelUrl: string;
  referenceImage: string | null;
  isRegenerating?: boolean;
  onConfirm: () => void;
  onRegenerate: () => void;   // 重新生成当前步骤（不重置之前步骤）
  onStartOver: () => void;    // 完全重新开始（回到上传）
}

// 小型 spinner
function Spinner() {
  return (
    <motion.span
      className="w-4 h-4 rounded-full border-2 border-white/40 inline-block"
      style={{ borderTopColor: "#fff" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}

export default function ConfirmStepScreen({
  step,
  modelUrl,
  referenceImage,
  isRegenerating = false,
  onConfirm,
  onRegenerate,
  onStartOver,
}: ConfirmStepScreenProps) {
  const config = STEP_CONFIG[step];
  const [showSkeleton, setShowSkeleton] = useState(step === "rig");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #fdf6ee 0%, #f5ede0 100%)" }}
    >
      {/* Top bar */}
      <motion.div
        className="flex items-center justify-between p-4 md:p-6"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="text-xs font-bold text-muted uppercase tracking-widest">
          {config.badge}
        </span>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {(["model", "rig", "anim"] as const).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                (step === "model" && i === 0) || (step === "rig" && i <= 1)
                  ? "w-6 bg-primary"
                  : "w-3 bg-muted/30"
              }`}
            />
          ))}
        </div>
      </motion.div>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 pb-6">

        {/* 3D viewer */}
        <motion.div
          className="flex-1 relative rounded-3xl overflow-hidden bg-linear-to-b from-[#faf5ef] to-[#f0e8da] shadow-inner"
          style={{ minHeight: "380px" }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ModelViewer modelUrl={modelUrl} showSkeleton={showSkeleton} />

          {/* Bottom controls */}
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <div className="bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-xs text-muted font-medium">Drag to inspect · Scroll to zoom</span>
            </div>
            {/* Skeleton toggle — only on rig step */}
            {step === "rig" && (
              <button
                onClick={() => setShowSkeleton((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all ${
                  showSkeleton
                    ? "bg-primary text-white"
                    : "bg-card/80 backdrop-blur-sm text-muted"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-current inline-block" />
                Skeleton {showSkeleton ? "ON" : "OFF"}
              </button>
            )}
          </motion.div>

          {/* Skeleton legend */}
          {step === "rig" && showSkeleton && (
            <motion.div
              className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 shadow-sm"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <p className="text-xs font-bold text-muted mb-1.5">Skeleton</p>
              {BONE_LEGEND.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted/70">{label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Right panel */}
        <motion.div
          className="w-full lg:w-72 flex flex-col gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Info */}
          <div className="card-cute p-5">
            <h2 className="text-lg font-black text-foreground mb-2">{config.title}</h2>
            <p className="text-sm text-muted leading-relaxed mb-4">{config.desc}</p>
            {referenceImage && (
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Reference</p>
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="w-full max-h-28 rounded-xl object-contain"
                />
              </div>
            )}
          </div>

          {/* Next hint */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3">
            <p className="text-xs text-primary/80 font-semibold">{config.nextHint}</p>
          </div>

          <div className="flex flex-col gap-3 mt-auto">
            {/* Confirm → next step */}
            <motion.button
              onClick={onConfirm}
              disabled={isRegenerating}
              className={`btn-primary w-full py-4 flex items-center justify-center gap-2 ${isRegenerating ? "opacity-50 cursor-not-allowed" : ""}`}
              whileHover={!isRegenerating ? { scale: 1.02 } : {}}
              whileTap={!isRegenerating ? { scale: 0.98 } : {}}
            >
              {config.confirmLabel}
            </motion.button>

            {/* Regenerate current step */}
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-full bg-surface hover:bg-surface-hover transition-colors font-semibold text-foreground text-sm ${isRegenerating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isRegenerating ? (
                <>
                  <motion.span
                    className="w-3.5 h-3.5 rounded-full border-2 border-muted/40 inline-block"
                    style={{ borderTopColor: "#ff8c42" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Regenerating...
                </>
              ) : config.regenerateLabel}
            </button>

            {/* Start Over (go back to upload) */}
            <button
              onClick={onStartOver}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center py-2.5 rounded-full border border-muted/20 text-muted hover:text-foreground hover:border-muted/40 transition-colors text-sm font-medium"
            >
              Start Over (Re-upload)
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
