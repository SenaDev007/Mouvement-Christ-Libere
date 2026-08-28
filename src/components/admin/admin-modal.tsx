"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, AlertCircle } from "lucide-react";

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  accentColor?: string;
}

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  accentColor = "#C9A227",
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll body quand modal ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Fermer avec Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#1A0826]/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative ${SIZES[size]} w-full bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 max-h-[90vh] flex flex-col overflow-hidden`}
        style={{ animation: "modalIn 200ms ease-out" }}
      >
        {/* Header avec accent */}
        <div
          className="px-6 py-4 border-b border-[#8A8378]/10 relative overflow-hidden flex-shrink-0"
          style={{
            background: `linear-gradient(90deg, ${accentColor}10 0%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: accentColor }}
          />
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-[#1E0F2B]">{title}</h2>
              {subtitle && (
                <p className="text-xs text-[#8A8378] mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378] hover:text-[#1E0F2B] transition-colors flex-shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

// Hook utilitaire pour gérer l'état du modal
export function useModal() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openModal: () => setOpen(true),
    closeModal: () => setOpen(false),
  };
}

// Composant de champ de formulaire stylisé pour les modals
interface ModalFieldProps {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  help?: string;
}

export function ModalField({ label, required, fullWidth, children, help }: ModalFieldProps) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {help && <p className="text-[10px] text-[#8A8378] mt-1">{help}</p>}
    </div>
  );
}

// Wrapper pour les inputs/selects avec border-radius élégant
export function modalInputClass() {
  return "w-full px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15 transition-all placeholder:text-[#8A8378]/50";
}

// Bouton de soumission du modal
interface ModalSubmitProps {
  loading: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel?: string;
}

export function ModalSubmit({ loading, disabled, label, loadingLabel = "Enregistrement..." }: ModalSubmitProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

// Affichage d'erreur dans le modal
export function ModalError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm col-span-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}
