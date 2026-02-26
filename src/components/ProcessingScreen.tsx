"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface ProcessingScreenProps {
  uploadedImage: string | null;
  mode: "2d" | "2d-random" | "3d";
  currentStep?: "modeling" | "rigging" | "animating";
}

const steps2D = [
  { text: "Analyzing your photo..." },
  { text: "Applying clay style..." },
];

const steps2DRandom = [
  { text: "Designing your character..." },
  { text: "Rendering clay style..." },
];

const steps3D = [
  { key: "modeling",  text: "Generating 3D model..." },
  { key: "rigging",   text: "Binding skeleton..." },
  { key: "animating", text: "Applying idle animation..." },
];

const STEP_LABELS: Record<string, string> = {
  modeling:  "Step 1 of 3 — Generating Model",
  rigging:   "Step 2 of 3 — Binding Skeleton",
  animating: "Step 3 of 3 — Applying Animation",
};

// 每步的鼓励文字，循环轮换
const ENCOURAGEMENTS: Record<string, string[]> = {
  "2d": [
    "Transforming your photo into a clay figurine...",
    "Analyzing shapes and colors...",
    "Crafting the perfect clay style...",
  ],
  "2d-random": [
    "Designing your unique character...",
    "Applying clay figurine style...",
    "Crafting a one-of-a-kind companion...",
    "Almost done, adding finishing touches...",
  ],
  modeling: [
    "Building your 3D character from scratch...",
    "Sculpting the mesh geometry...",
    "Generating detailed textures...",
    "Almost there, this takes about 1–2 min...",
  ],
  rigging: [
    "Placing joints and bones...",
    "Attaching skeleton to the mesh...",
    "Calibrating humanoid rig...",
  ],
  animating: [
    "Bringing your character to life...",
    "Applying idle breathing animation...",
    "Finalizing the animated model...",
  ],
};

export default function ProcessingScreen({ uploadedImage, mode, currentStep }: ProcessingScreenProps) {
  const steps = mode === "2d" ? steps2D : mode === "2d-random" ? steps2DRandom : steps3D;

  const [localStep, setLocalStep] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [encourageIdx, setEncourageIdx] = useState(0);

  const activeIndex = mode === "3d" && currentStep
    ? steps3D.findIndex((s) => s.key === currentStep)
    : localStep;

  const encourageKey = (mode === "2d" || mode === "2d-random") ? mode : (currentStep ?? "modeling");
  const encouragements = ENCOURAGEMENTS[encourageKey] ?? [];

  // 2D 本地步骤推进（包含 random 模式）
  useEffect(() => {
    if (mode !== "2d" && mode !== "2d-random") return;
    setLocalStep(0);
    setAllDone(false);
    const interval = setInterval(() => {
      setLocalStep((prev) => {
        if (prev < steps2D.length - 1) return prev + 1;
        setTimeout(() => setAllDone(true), 600);
        clearInterval(interval);
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [mode]);

  // 轮换鼓励文字
  useEffect(() => {
    setEncourageIdx(0);
    const interval = setInterval(() => {
      setEncourageIdx((prev) => (prev + 1) % encouragements.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [encourageKey, encouragements.length]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dots relative overflow-hidden px-6">

      {/* Background blobs */}
      <motion.div
        className="absolute top-[10%] left-[5%] w-64 h-64 rounded-full bg-primary/5 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[5%] w-48 h-48 rounded-full bg-secondary/8 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* ── Hero image ──────────────────────────────────────────── */}
        {uploadedImage && (
          <div className="flex justify-center mb-10">
            <div className="relative">
              {/* Outer pulsing ring */}
              <motion.div
                className="absolute -inset-4 rounded-3xl border-2 border-primary/20"
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Mid ring */}
              <motion.div
                className="absolute -inset-2 rounded-2xl border border-secondary/30"
                animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />
              {/* Image */}
              <motion.img
                src={uploadedImage}
                alt="Processing"
                className="w-52 h-52 md:w-60 md:h-60 rounded-2xl object-cover shadow-xl border-4 border-white"
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Spinning accent border */}
              <motion.div
                className="absolute -inset-1 rounded-2xl"
                style={{
                  background: "conic-gradient(from 0deg, #ff8c42, #6ec6ca, transparent, transparent)",
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  padding: "2px",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        )}

        {/* ── Stage label ─────────────────────────────────────────── */}
        <p className="text-center text-xs font-bold text-muted uppercase tracking-widest mb-6">
          {mode === "2d"
            ? "Step 1 of 2 — Style Transfer"
            : mode === "2d-random"
            ? "Step 1 of 2 — Generating Character"
            : STEP_LABELS[currentStep ?? "modeling"]}
        </p>

        {/* ── Step list ───────────────────────────────────────────── */}
        <div className="space-y-3 mb-8">
          {steps.map((step, index) => {
            const isDone = allDone || index < activeIndex;
            const isActive = !allDone && index === activeIndex;
            const isPending = !allDone && index > activeIndex;

            return (
              <motion.div
                key={index}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-500 ${
                  isDone ? "bg-primary/8" : isActive ? "bg-card shadow-sm" : "opacity-40"
                }`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: isPending ? 0.4 : 1, x: 0 }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
              >
                {/* Status icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all ${
                  isDone
                    ? "bg-primary text-white"
                    : isActive
                    ? "bg-foreground text-white"
                    : "border-2 border-muted/30 text-muted/40"
                }`}>
                  {isDone ? "✓" : index + 1}
                </div>

                <span className={`font-semibold text-sm flex-1 ${
                  isDone ? "text-primary" : isActive ? "text-foreground" : "text-muted/50"
                }`}>
                  {step.text}
                </span>

                {/* Active cursor blink */}
                {isActive && (
                  <motion.div
                    className="w-1.5 h-5 bg-primary rounded-full"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                {isDone && (
                  <div className="w-2 h-2 rounded-full bg-primary/40" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Spinner ─────────────────────────────────────────────── */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-10 h-10 rounded-full border-[3px] border-surface"
            style={{ borderTopColor: "#ff8c42", borderRightColor: "#6ec6ca" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* ── Encouragement text (rotating) ───────────────────────── */}
        <div className="text-center h-10 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={encourageIdx}
              className="text-sm text-muted/70 font-medium"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              {encouragements[encourageIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
