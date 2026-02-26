"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { loadGallery } from "@/lib/gallery";

interface LandingPageProps {
  onCreateClick: () => void;
  onGalleryClick: () => void;
}

// 几何装饰（替换原来的 emoji 装饰）
function FloatingDecorations() {
  return (
    <>
      <motion.div
        className="absolute top-[15%] left-[10%] w-8 h-8 rounded-full bg-primary/15"
        animate={{ y: [-10, 10, -10], scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] right-[15%] w-5 h-5 rounded-full bg-secondary/20"
        animate={{ y: [10, -10, 10] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[25%] left-[8%] w-10 h-10 rounded-full bg-accent/15"
        animate={{ y: [-8, 8, -8], x: [-5, 5, -5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[30%] right-[10%] w-6 h-6 rounded-full bg-primary/10"
        animate={{ y: [5, -15, 5], scale: [1, 1.3, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[40%] left-[20%] w-3 h-3 rounded-full bg-secondary/25"
        animate={{ y: [-5, 12, -5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[35%] right-[25%] w-4 h-4 rounded-full bg-accent/20"
        animate={{ y: [8, -8, 8] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[10%] right-[30%] w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-accent/10"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[15%] left-[25%] w-20 h-20 rounded-full bg-gradient-to-br from-secondary/10 to-primary/10"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.6, 0.3, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

// 吉祥物（CSS 绘制，无 emoji）
function MascotIllustration() {
  return (
    <motion.div
      className="relative w-48 h-48 mx-auto mb-8"
      animate={{ y: [-8, 8, -8] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 flex items-center justify-center shadow-lg">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#ffe8d6] to-[#ffd4b0] flex items-center justify-center relative">
            <div className="absolute top-8 left-6 w-5 h-5 rounded-full bg-[#3d3329]">
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white" />
            </div>
            <div className="absolute top-8 right-6 w-5 h-5 rounded-full bg-[#3d3329]">
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white" />
            </div>
            <div className="absolute top-14 left-3 w-5 h-3 rounded-full bg-pink-200/60" />
            <div className="absolute top-14 right-3 w-5 h-3 rounded-full bg-pink-200/60" />
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
              <div className="w-6 h-3 border-b-[3px] border-[#3d3329] rounded-b-full" />
            </div>
            <div className="absolute -top-3 left-2 w-6 h-8 bg-gradient-to-t from-[#ffd4b0] to-[#ffbf8a] rounded-full -rotate-12" />
            <div className="absolute -top-3 right-2 w-6 h-8 bg-gradient-to-t from-[#ffd4b0] to-[#ffbf8a] rounded-full rotate-12" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage({ onCreateClick, onGalleryClick }: LandingPageProps) {
  const [galleryCount, setGalleryCount] = useState(0);

  useEffect(() => {
    setGalleryCount(loadGallery().length);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-dots">
      <FloatingDecorations />

      <motion.div
        className="text-center z-10 px-6 max-w-2xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <MascotIllustration />

        <motion.h1
          className="text-6xl md:text-7xl font-black mb-4 gradient-text tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Amico
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-muted font-semibold mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          A companion that stays with you.
        </motion.p>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.button
            className="btn-primary text-lg px-10 py-4"
            onClick={onCreateClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Create your Amico
          </motion.button>

          {galleryCount > 0 && (
            <motion.button
              onClick={onGalleryClick}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-card hover:bg-surface-hover transition-colors shadow-sm border border-primary/10 text-sm font-bold text-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              My Creations
              <span className="bg-primary text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                {galleryCount}
              </span>
            </motion.button>
          )}
        </motion.div>

        <motion.p
          className="text-sm text-muted/70 mt-6 max-w-sm mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          Turn a portrait or pet photo into a living desktop presence.
        </motion.p>
      </motion.div>

      <motion.footer
        className="absolute bottom-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
      >
        <p className="text-xs text-muted/50 font-medium">
          Currently optimized for portraits and pets.
        </p>
      </motion.footer>
    </div>
  );
}
