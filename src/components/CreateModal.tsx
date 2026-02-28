"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "photo" | "random";
type Gender = "male" | "female";

interface CreateModalProps {
  onClose: () => void;
  // Photo flow
  onImageUploaded: (
    file: File,
    preview: string,
    profile?: { name?: string; gender?: Gender }
  ) => void;
  // Random flow
  onRandomGenerate: (gender: Gender, name: string) => void;
  isGeneratingRandom?: boolean;
}

// ─── 小型装饰人物预览 ─────────────────────────────────────────────────────
function CharacterPreview({ gender }: { gender: Gender }) {
  const skinColor = gender === "female" ? "#ffe0d0" : "#f5d0b0";
  const hairColor = gender === "female" ? "#5c3d2e" : "#2d1b00";
  const accentColor = gender === "female" ? "#ffb3cc" : "#89c4e1";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Simple SVG chibi figure */}
      <svg width="80" height="100" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="40" cy="72" rx="18" ry="20" fill={accentColor} />
        {/* Head */}
        <circle cx="40" cy="40" r="24" fill={skinColor} />
        {/* Hair */}
        {gender === "female" ? (
          <>
            <ellipse cx="40" cy="22" rx="22" ry="10" fill={hairColor} />
            <ellipse cx="20" cy="38" rx="6" ry="14" fill={hairColor} />
            <ellipse cx="60" cy="38" rx="6" ry="14" fill={hairColor} />
          </>
        ) : (
          <ellipse cx="40" cy="22" rx="22" ry="9" fill={hairColor} />
        )}
        {/* Eyes */}
        <circle cx="32" cy="40" r="4" fill="#2d1b00" />
        <circle cx="48" cy="40" r="4" fill="#2d1b00" />
        <circle cx="33" cy="38" r="1.5" fill="white" />
        <circle cx="49" cy="38" r="1.5" fill="white" />
        {/* Blush */}
        <ellipse cx="26" cy="47" rx="5" ry="3" fill="#ffb3b3" opacity="0.5" />
        <ellipse cx="54" cy="47" rx="5" ry="3" fill="#ffb3b3" opacity="0.5" />
        {/* Smile */}
        <path d="M33 52 Q40 58 47 52" stroke="#a06040" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Arms */}
        <ellipse cx="18" cy="70" rx="6" ry="12" fill={skinColor} transform="rotate(-10 18 70)" />
        <ellipse cx="62" cy="70" rx="6" ry="12" fill={skinColor} transform="rotate(10 62 70)" />
        {/* Legs */}
        <ellipse cx="33" cy="96" rx="7" ry="6" fill={skinColor} />
        <ellipse cx="47" cy="96" rx="7" ry="6" fill={skinColor} />
      </svg>
      <p className="text-xs font-semibold text-muted capitalize">{gender}</p>
    </div>
  );
}

export default function CreateModal({
  onClose,
  onImageUploaded,
  onRandomGenerate,
  isGeneratingRandom = false,
}: CreateModalProps) {
  const [tab, setTab] = useState<Tab>("photo");
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Random form
  const [gender, setGender] = useState<Gender>("female");
  const [name, setName] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoGender, setPhotoGender] = useState<Gender>("female");

  // ── Photo handlers ─────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleReset = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmPhoto = () => {
    if (selectedFile && previewUrl) {
      onImageUploaded(selectedFile, previewUrl, {
        name: photoName.trim(),
        gender: photoGender,
      });
    }
  };

  const handleConfirmRandom = () => {
    onRandomGenerate(gender, name.trim());
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Modal */}
      <motion.div
        className="relative z-10 card-cute w-full max-w-lg mx-4 overflow-hidden"
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors text-muted hover:text-foreground font-bold"
        >
          ×
        </button>

        {/* Tab selector */}
        <div className="flex border-b border-primary/10">
          {([
            { key: "photo", label: "Upload Photo" },
            { key: "random", label: "Random Character" },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-4 text-sm font-bold transition-all relative ${
                tab === key ? "text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
              {tab === key && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === "photo" ? (
            <motion.div
              key="photo"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Upload a Photo</h2>
                <p className="text-xs text-muted">Best results with a single human portrait on a plain background.</p>
              </div>

              {!previewUrl ? (
                <div
                  className={`upload-area p-8 text-center ${isDragging ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    className="hidden"
                  />
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface flex items-center justify-center">
                    <span className="text-2xl font-light text-muted">+</span>
                  </div>
                  <p className="text-foreground font-semibold mb-2">
                    {isDragging ? "Drop it here!" : "Drag & drop your photo here"}
                  </p>
                  <p className="text-muted text-sm mb-4">or</p>
                  <span className="inline-block px-6 py-2 rounded-full bg-surface text-primary font-semibold text-sm hover:bg-surface-hover transition-colors">
                    Browse Files
                  </span>
                  <p className="text-muted/60 text-xs mt-4">JPG, PNG, WEBP — Max 10MB</p>
                </div>
              ) : (
                <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="relative inline-block mb-4">
                    <img src={previewUrl} alt="Preview" className="max-h-48 rounded-2xl shadow-lg object-cover" />
                    <button
                      onClick={handleReset}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-400 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors shadow-md font-bold"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-muted mb-1">{selectedFile?.name}</p>
                  <p className="text-xs text-muted/60 mb-4">
                    {selectedFile && (selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <div className="text-left mb-4">
                    <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Character Name (optional)</p>
                    <input
                      type="text"
                      value={photoName}
                      onChange={(e) => setPhotoName(e.target.value)}
                      placeholder="e.g. Nana"
                      maxLength={24}
                      className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground font-semibold text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary/30 transition-colors"
                    />
                  </div>
                  <div className="text-left mb-4">
                    <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Gender</p>
                    <div className="flex gap-3">
                      {(["female", "male"] as Gender[]).map((g) => (
                        <button
                          key={`photo-${g}`}
                          onClick={() => setPhotoGender(g)}
                          className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all capitalize ${
                            photoGender === g
                              ? "bg-primary text-white shadow-md"
                              : "bg-surface text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          {g === "female" ? "Female" : "Male"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleConfirmPhoto} className="btn-primary w-full py-4">
                    Start Creating
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="random"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Create a Random Character</h2>
                <p className="text-xs text-muted">No photo needed — AI will design a unique chibi companion for you.</p>
              </div>

              {/* Character preview */}
              <div className="flex justify-center mb-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={gender}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CharacterPreview gender={gender} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Gender selector */}
              <div className="mb-5">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Gender</p>
                <div className="flex gap-3">
                  {(["female", "male"] as Gender[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all capitalize ${
                        gender === g
                          ? "bg-primary text-white shadow-md"
                          : "bg-surface text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      {g === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name input */}
              <div className="mb-6">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Name <span className="text-muted/50 font-normal normal-case">(optional)</span>
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Give your Amico a name..."
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-2xl bg-surface border border-primary/10 text-foreground font-semibold text-sm placeholder:text-muted/50 focus:outline-none focus:border-primary/30 transition-colors"
                />
              </div>

              <button
                onClick={handleConfirmRandom}
                disabled={isGeneratingRandom}
                className={`btn-primary w-full py-4 flex items-center justify-center gap-2 ${isGeneratingRandom ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isGeneratingRandom ? (
                  <>
                    <motion.span
                      className="w-4 h-4 rounded-full border-2 border-white/40 inline-block"
                      style={{ borderTopColor: "#fff" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    Generating...
                  </>
                ) : "Generate My Amico"}
              </button>

              <p className="text-center text-xs text-muted/50 mt-3">
                Currently optimized for human characters only
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
