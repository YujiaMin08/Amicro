"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Preview2DScreenProps {
  originalImage: string | null;
  styledImage: string;
  isRegenerating?: boolean;        // 正在重新生成风格图
  onConfirm: () => void;
  onRegenerateStyle: () => void;   // 用同一张原图重新跑 nanobanana
  onChangePhoto: () => void;       // 重新上传新照片
  onBack: () => void;
}

// ─── 图片灯箱 ────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative max-w-2xl max-h-[85vh] mx-4"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain rounded-2xl shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card shadow-lg flex items-center justify-center text-foreground font-bold hover:bg-surface-hover transition-colors"
        >
          ×
        </button>
        <p className="text-center text-xs text-white/60 mt-2 font-medium">{alt}</p>
      </motion.div>
    </motion.div>
  );
}

// ─── 可点击图片卡片 ──────────────────────────────────────────────────────────
function ImageCard({
  src,
  label,
  badge,
  onClick,
}: {
  src: string;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">{label}</p>
      <motion.div
        className="relative cursor-zoom-in group"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
      >
        <img
          src={src}
          alt={label}
          className="w-48 h-48 md:w-56 md:h-56 rounded-2xl object-cover shadow-lg border-2 border-white"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-2xl bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold bg-foreground/50 rounded-full px-3 py-1">
            Click to enlarge
          </span>
        </div>
        {badge && (
          <div className="absolute top-2 right-2 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
            <span className="text-xs text-green-700 font-semibold">{badge}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────────────────────────────────────
export default function Preview2DScreen({
  originalImage,
  styledImage,
  isRegenerating = false,
  onConfirm,
  onRegenerateStyle,
  onChangePhoto,
  onBack,
}: Preview2DScreenProps) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

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
        <span className="text-sm font-semibold text-muted">Style Preview</span>
      </motion.div>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 px-6 pb-8">

        {/* Image comparison */}
        <motion.div
          className="flex gap-6 items-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Original */}
          {originalImage && (
            <ImageCard
              src={originalImage}
              label="Original"
              onClick={() => setLightbox({ src: originalImage, alt: "Original Photo" })}
            />
          )}

          {/* Arrow */}
          {originalImage && (
            <div className="flex items-center pt-16 text-muted text-2xl font-light select-none">→</div>
          )}

          {/* Styled */}
          <div className="relative">
            {isRegenerating && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <motion.div
                  className="w-8 h-8 rounded-full border-3 border-surface"
                  style={{ borderTopColor: "#ff8c42" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <span className="text-xs font-semibold text-muted">Regenerating...</span>
              </div>
            )}
            <ImageCard
              src={styledImage}
              label="Clay Style"
              badge="AI"
              onClick={() => !isRegenerating && setLightbox({ src: styledImage, alt: "Clay Style" })}
            />
          </div>
        </motion.div>

        {/* Action panel */}
        <motion.div
          className="w-full max-w-xs flex flex-col gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="card-cute p-5">
            <p className="text-sm font-bold text-foreground mb-1">Looks good?</p>
            <p className="text-xs text-muted leading-relaxed">
              Click either image to enlarge. If you are happy with the clay style, continue to generate the 3D model.
            </p>
          </div>

          {/* Generate 3D */}
          <motion.button
            onClick={onConfirm}
            disabled={isRegenerating}
            className={`btn-primary w-full py-4 ${isRegenerating ? "opacity-50 cursor-not-allowed" : ""}`}
            whileHover={!isRegenerating ? { scale: 1.02 } : {}}
            whileTap={!isRegenerating ? { scale: 0.98 } : {}}
          >
            Generate 3D Model
          </motion.button>

          {/* Regenerate style with same photo */}
          <button
            onClick={onRegenerateStyle}
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
                Regenerating style...
              </>
            ) : (
              "Regenerate Style"
            )}
          </button>

          {/* Change photo entirely */}
          <button
            onClick={onChangePhoto}
            disabled={isRegenerating}
            className="w-full flex items-center justify-center py-2.5 rounded-full border border-muted/20 text-muted hover:text-foreground hover:border-muted/40 transition-colors text-sm font-medium"
          >
            Change Photo
          </button>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            src={lightbox.src}
            alt={lightbox.alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
