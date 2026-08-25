"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, CheckCircle2, X, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_ANNOUNCEMENTS, PRIORITY_STYLES, TARGET_LABELS, type Announcement } from "@/lib/helm-connect/types";

const PRIORITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INFO: Info,
  NORMAL: Megaphone,
  IMPORTANT: AlertTriangle,
  URGENT: AlertCircle,
};

export function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);
  const [showCreate, setShowCreate] = useState(false);

  const handleConfirm = (id: string) => {
    setAnnouncements(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, confirmedByCurrentUser: true, confirmCount: a.confirmCount + 1 }
          : a
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-[#1E0F2B] flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-[#C9A227]" />
          Annonces officielles
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
          {showCreate ? "Annuler" : "Nouvelle annonce"}
        </button>
      </div>

      {/* Formulaire de création */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1 block">Priorité</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20">
                  <option value="INFO">Info</option>
                  <option value="NORMAL">Annonce</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1 block">Cible</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20">
                  <option value="ALL">Toute la communauté</option>
                  <option value="PASTORS">Pasteurs affiliés</option>
                  <option value="DISCIPLES">Disciples</option>
                  <option value="NEW_BELIEVERS">Nouveaux croyants</option>
                  <option value="INTERCESSION">Chaîne d'intercession</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1 block">Titre</label>
              <input type="text" placeholder="Titre de l'annonce" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1 block">Message</label>
              <textarea rows={4} placeholder="Contenu de l'annonce..." className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20 resize-none font-serif" />
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors"
            >
              Publier l'annonce
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des annonces */}
      <div className="space-y-4">
        {announcements.map((ann, i) => {
          const Icon = PRIORITY_ICONS[ann.priority] || Megaphone;
          const style = PRIORITY_STYLES[ann.priority];
          return (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 relative overflow-hidden"
            >
              {/* Barre de priorité */}
              <div className={cn("absolute top-0 left-0 right-0 h-1", style.bg.replace("/15", ""))} />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", style.bg, style.text)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full", style.bg, style.text)}>
                      {style.label}
                    </span>
                    <p className="text-sm font-bold text-[#1E0F2B] mt-1">{ann.title}</p>
                  </div>
                </div>
                <span className="text-xs text-stone-400">
                  {new Date(ann.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>

              <p className="text-sm text-[#1E0F2B]/70 leading-relaxed mb-4">{ann.body}</p>

              <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#2A0E3D] flex items-center justify-center text-white text-xs font-bold">
                    {ann.authorName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1E0F2B]">{ann.authorName}</p>
                    <p className="text-[10px] text-stone-400">{ann.authorRole} · {TARGET_LABELS[ann.target]}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {ann.requiresConfirmation && (
                    <>
                      <span className="text-xs text-stone-500">
                        {ann.confirmCount}/{ann.totalRecipients} confirmés
                      </span>
                      <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5B7052] transition-all duration-1000"
                          style={{ width: `${(ann.confirmCount / ann.totalRecipients) * 100}%` }}
                        />
                      </div>
                      {ann.confirmedByCurrentUser ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5B7052]/15 text-[#5B7052] text-xs font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Confirmé
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirm(ann.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-xs font-bold hover:bg-[#DDBE55] transition-colors whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Confirmer
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
