"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface UploadModalProps {
  onClose: () => void;
  onImageUploaded: (file: File, preview: string) => void;
}

export default function UploadModal({ onClose, onImageUploaded }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (JPG, PNG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = () => {
    if (selectedFile && previewUrl) onImageUploaded(selectedFile, previewUrl);
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        className="relative z-10 card-cute p-8 md:p-10 w-full max-w-lg mx-4"
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors text-muted hover:text-foreground font-bold"
        >
          x
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">Upload a Photo</h2>
          <p className="text-sm text-muted">Choose a portrait or pet photo to bring to life.</p>
        </div>

        {/* Upload area */}
        {!previewUrl ? (
          <div
            className={`upload-area p-8 text-center ${isDragging ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
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
            <p className="text-muted/60 text-xs mt-4">
              Supports JPG, PNG, WEBP — Max 10MB
            </p>
          </div>
        ) : (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="relative inline-block mb-4">
              <img
                src={previewUrl}
                alt="Upload preview"
                className="max-h-64 rounded-2xl shadow-lg object-cover"
              />
              <button
                onClick={handleReset}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-400 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors shadow-md font-bold"
              >
                x
              </button>
            </div>
            <p className="text-sm text-muted mb-1">{selectedFile?.name}</p>
            <p className="text-xs text-muted/60 mb-6">
              {selectedFile && (selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </motion.div>
        )}

        {/* Confirm */}
        {previewUrl && (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button onClick={handleConfirm} className="btn-primary w-full py-4">
              Generate My Amico
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
