"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { loadGallery } from "@/lib/gallery";

interface LandingPageProps {
  onCreateClick: () => void;
  onGalleryClick: () => void;
}

function FloatingDecorations() {
  return (
    <>
      <motion.div
        className="absolute left-[8%] top-[12%] h-10 w-10 rounded-full bg-primary/15"
        animate={{ y: [-10, 10, -10], scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[12%] top-[18%] h-6 w-6 rounded-full bg-secondary/20"
        animate={{ y: [10, -10, 10] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[22%] left-[10%] h-12 w-12 rounded-full bg-accent/15"
        animate={{ y: [-8, 8, -8], x: [-5, 5, -5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[28%] right-[8%] h-7 w-7 rounded-full bg-primary/10"
        animate={{ y: [5, -15, 5], scale: [1, 1.3, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[28%] top-[8%] h-20 w-20 rounded-full bg-linear-to-br from-primary/10 to-accent/10"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[24%] h-24 w-24 rounded-full bg-linear-to-br from-secondary/10 to-primary/10"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.6, 0.3, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

export default function LandingPage({ onCreateClick, onGalleryClick }: LandingPageProps) {
  const [galleryCount, setGalleryCount] = useState(0);
  const [isElectron, setIsElectron] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setGalleryCount(loadGallery().length);
    setIsElectron(!!(window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-dots">
      <FloatingDecorations />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center gap-10 px-6 pb-16 pt-16 md:pt-0 md:min-h-screen md:flex-row flex-col">

        {/* ── Demo video（左侧）──────────────────────────────────────── */}
        <motion.div
          className="w-full md:w-[42%] shrink-0"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative overflow-hidden rounded-2xl shadow-lg">
            <video
              ref={videoRef}
              className="w-full object-cover"
              src="/Amico.mp4"
              autoPlay
              muted
              playsInline
              preload="metadata"
              onEnded={() => setVideoEnded(true)}
            />
            {videoEnded && (
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={() => {
                    videoRef.current?.play();
                    setVideoEnded(false);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-black/30 hover:text-white"
                >
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 2.5a.5.5 0 0 1 .765-.424l10 5.5a.5.5 0 0 1 0 .848l-10 5.5A.5.5 0 0 1 3 13.5v-11z"/>
                  </svg>
                  Replay
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs font-medium text-muted/40">
            Currently optimized for single-person portraits
          </p>
        </motion.div>

        {/* ── Hero（右侧）──────────────────────────────────────────── */}
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        >
          <h1 className="gradient-text text-6xl font-black tracking-tight md:text-7xl">Amico</h1>
          <p className="mt-4 text-xl font-semibold text-muted md:text-2xl">
            Always with you. Ready to help.
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted/70">
            Turn a human portrait into a living desktop companion with style transfer, 3D rigging, and expressive animation.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <motion.button
              className="btn-primary text-lg px-10 py-4"
              onClick={onCreateClick}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              Create your Amico
            </motion.button>

            {galleryCount > 0 && (
              <motion.button
                onClick={onGalleryClick}
                className="flex items-center gap-2 rounded-full border border-primary/10 bg-card px-6 py-3 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-surface-hover"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                My Creations
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                  {galleryCount}
                </span>
              </motion.button>
            )}
          </div>

          {isElectron && (
            <motion.button
              onClick={() => (window as Window & { electronAPI?: { showPet?: () => void } }).electronAPI?.showPet?.()}
              className="mt-5 text-xs font-medium text-muted/60 transition-colors hover:text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              Show Desktop Pet (⌘⇧A)
            </motion.button>
          )}
        </motion.div>

      </div>
    </div>
  );
}
