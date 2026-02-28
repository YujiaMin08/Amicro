"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadGallery, deleteGalleryItem, type GalleryItem } from "@/lib/gallery";
import { removeCachedModelsForCharacter } from "@/lib/modelCache";

interface GalleryScreenProps {
  onBack: () => void;
  onLoadCharacter: (item: GalleryItem) => void;
  onCreateNew: () => void;
  onDeleteCharacter?: (item: GalleryItem) => Promise<void> | void;
}

// ── 单个角色卡片 ─────────────────────────────────────────────────────────────
function CharacterCard({
  item,
  onLoad,
  onDelete,
}: {
  item: GalleryItem;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const timeAgo = formatTimeAgo(item.createdAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group card-cute overflow-hidden cursor-pointer"
      onClick={onLoad}
    >
      {/* Preview image */}
      <div className="aspect-square bg-linear-to-b from-[#faf5ef] to-[#f0e8da] relative overflow-hidden">
        <img
          src={item.thumbnail}
          alt={item.name || "Amico"}
          className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
          <motion.div
            className="opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-md"
            initial={false}
          >
            <span className="text-xs font-bold text-foreground">View in 3D</span>
          </motion.div>
        </div>
      </div>

      {/* Info bar */}
      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">
            {item.name || "My Amico"}
          </p>
          <p className="text-xs text-muted/70">{timeAgo}</p>
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="w-7 h-7 rounded-full hover:bg-surface-hover flex items-center justify-center text-muted hover:text-foreground transition-colors"
          >
            ···
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                />
                <motion.div
                  className="absolute right-0 bottom-8 z-20 bg-card shadow-lg rounded-2xl border border-primary/10 overflow-hidden min-w-[156px]"
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onLoad(); }}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface transition-colors"
                  >
                    View in 3D
                  </button>
                  <div className="h-px bg-muted/10 mx-3" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm("Delete this character?")) onDelete();
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50/80 transition-colors"
                  >
                    Delete Character
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Badges */}
      {item.gender && (
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            item.gender === "female"
              ? "bg-pink-100 text-pink-600"
              : "bg-blue-100 text-blue-600"
          }`}>
            {item.gender === "female" ? "Female" : "Male"}
          </span>
        </div>
      )}

      {/* Rig badge */}
      {item.rigTaskId && (
        <div className="absolute top-2 right-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">
            Rigged
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-24 px-6 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-6">
        <span className="text-3xl">🐾</span>
      </div>
      <h2 className="text-xl font-black text-foreground mb-2">No creations yet</h2>
      <p className="text-sm text-muted mb-8 max-w-xs leading-relaxed">
        Create your first Amico companion and it will appear here for easy access.
      </p>
      <motion.button
        onClick={onCreateNew}
        className="btn-primary px-8 py-3"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        Create your first Amico
      </motion.button>
    </motion.div>
  );
}

// ── Main gallery screen ──────────────────────────────────────────────────────
export default function GalleryScreen({
  onBack,
  onLoadCharacter,
  onCreateNew,
  onDeleteCharacter,
}: GalleryScreenProps) {
  const [items, setItems] = useState<GalleryItem[]>(() => loadGallery());

  const handleDelete = async (item: GalleryItem) => {
    deleteGalleryItem(item.id);
    await removeCachedModelsForCharacter(item.id);
    if (onDeleteCharacter) {
      try {
        await onDeleteCharacter(item);
      } catch (err) {
        console.warn("[gallery] onDeleteCharacter failed:", err);
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-dots">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-primary/8"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card hover:bg-surface-hover transition-colors shadow-sm border border-primary/10 text-sm font-semibold text-foreground"
          >
            ← Back
          </button>

          <h1 className="text-lg font-black text-foreground">My Creations</h1>

          <motion.button
            onClick={onCreateNew}
            className="btn-primary px-5 py-2 text-sm"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            + New
          </motion.button>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {items.length === 0 ? (
          <EmptyState onCreateNew={onCreateNew} />
        ) : (
          <>
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
              {items.length} character{items.length !== 1 ? "s" : ""}
            </p>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
              layout
            >
              <AnimatePresence>
                {items.map((item) => (
                  <CharacterCard
                    key={item.id}
                    item={item}
                    onLoad={() => onLoadCharacter(item)}
                    onDelete={() => { void handleDelete(item); }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
