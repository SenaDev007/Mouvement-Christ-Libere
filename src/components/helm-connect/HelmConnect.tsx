"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Megaphone,
  BarChart3,
  Radio,
  BookOpen,
  Phone,
  Settings,
  Search,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommDashboard } from "./CommDashboard";
import { MessagingView } from "./MessagingView";
import { AnnouncementsView } from "./AnnouncementsView";
import { CallsView } from "./CallsView";
import { BiblePanel } from "./BiblePanel";

type Tab = "dashboard" | "messages" | "announcements" | "calls" | "bible";

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
  { id: "dashboard", label: "Tableau de bord", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare, badge: 9 },
  { id: "announcements", label: "Annonces", icon: Megaphone, badge: 2 },
  { id: "calls", label: "Appels", icon: Phone },
  { id: "bible", label: "Bible", icon: BookOpen },
];

export function HelmConnect() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* Barre d'onglets */}
      <div className="sticky top-0 z-40 bg-[#2A0E3D] border-b border-[#C9A227]/20">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-3">
            {/* Logo Helm Connect */}
            <div className="flex items-center gap-2 mr-6 flex-shrink-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#C9A227]/15 border border-[#C9A227]/30">
                <Zap className="w-4 h-4 text-[#C9A227]" />
              </div>
              <span className="font-serif text-lg font-semibold text-[#FAF6EF] hidden sm:block">
                Helm Connect
              </span>
            </div>

            {/* Tabs */}
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-[#C9A227]/15 text-[#C9A227]"
                      : "text-[#FAF6EF]/60 hover:text-[#FAF6EF] hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B]">
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="helm-tab-indicator"
                      className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#C9A227]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "dashboard" && <CommDashboard />}
            {activeTab === "messages" && <MessagingView />}
            {activeTab === "announcements" && <AnnouncementsView />}
            {activeTab === "calls" && <CallsView />}
            {activeTab === "bible" && <BiblePanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
