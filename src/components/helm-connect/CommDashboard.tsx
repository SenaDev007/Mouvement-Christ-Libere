"use client";

import { motion } from "framer-motion";
import {
  Send, CheckCircle2, AlertCircle, Clock, BarChart3, Zap,
  Radio, MessageSquare, Mail, Bell, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_CHANNELS, MOCK_CAMPAIGNS } from "@/lib/helm-connect/types";

const KPIS = [
  { label: "Messages aujourd'hui", value: "47", icon: Send, color: "text-[#C9A227]", bg: "bg-[#C9A227]/10" },
  { label: "Membres actifs", value: "124", icon: BarChart3, color: "text-[#8C5FA8]", bg: "bg-[#8C5FA8]/10" },
  { label: "Annonces en cours", value: "2", icon: AlertCircle, color: "text-[#B5502F]", bg: "bg-[#B5502F]/10" },
  { label: "Prières exprimées", value: "238", icon: CheckCircle2, color: "text-[#5B7052]", bg: "bg-[#5B7052]/10" },
];

const RECENT_ACTIVITY = [
  { title: "Annonce — Live spécial ce soir", target: "Toute la communauté", channel: "Site/Push", status: "SENT", time: "Il y a 1h" },
  { title: "Demande de prière — Rébecca", target: "Intercession", channel: "Communauté", status: "DELIVERED", time: "Il y a 2h" },
  { title: "Enseignement — Hénoch", target: "Disciples", channel: "Portail", status: "READ", time: "Il y a 5h" },
  { title: "Rappel live hebdomadaire", target: "Tous les membres", channel: "Push", status: "SENT", time: "Hier" },
];

export function CommDashboard() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all"
            >
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{kpi.label}</p>
                <p className="text-2xl font-black text-[#1E0F2B] mt-1">{kpi.value}</p>
              </div>
              <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", kpi.bg, kpi.color)}>
                <Icon className="w-5 h-5" />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activité récente */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-[#1E0F2B] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#8C5FA8]" /> Activité récente
            </h3>
          </div>
          <div className="divide-y divide-stone-50">
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="p-5 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    item.status === "SENT" ? "bg-blue-50 text-blue-600" :
                    item.status === "DELIVERED" ? "bg-emerald-50 text-emerald-600" :
                    "bg-violet-50 text-violet-600"
                  )}>
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1E0F2B]">{item.title}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">Pour : {item.target} · {item.channel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-400">{item.time}</p>
                  <span className={cn(
                    "text-[10px] font-bold",
                    item.status === "FAILED" ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* État des canaux */}
        <div className="bg-[#1E0F2B] rounded-[2.5rem] p-8 text-white shadow-xl">
          <h3 className="font-bold flex items-center gap-2 mb-8 text-[#C9A227] uppercase text-xs tracking-widest">
            <Zap className="w-4 h-4" /> État des canaux
          </h3>
          <div className="space-y-6">
            {MOCK_CHANNELS.map((channel, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{channel.name}</p>
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                    channel.status === "ONLINE" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {channel.status}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-1000", channel.status === "ONLINE" ? "bg-emerald-500" : "bg-amber-500")}
                    style={{ width: `${channel.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campagnes */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
        <h3 className="font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#C9A227]" /> Campagnes de communication
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {MOCK_CAMPAIGNS.map((camp) => (
            <div key={camp.id} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
              <div className="flex items-center justify-between mb-3">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  camp.status === "RUNNING" ? "bg-emerald-100 text-emerald-700" :
                  camp.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
                  "bg-amber-100 text-amber-700"
                )}>
                  {camp.status === "RUNNING" ? "En cours" : camp.status === "COMPLETED" ? "Terminé" : "Planifié"}
                </span>
                <span className="text-xs text-stone-400">{camp.channel}</span>
              </div>
              <p className="font-bold text-sm text-[#1E0F2B] mb-1">{camp.name}</p>
              <p className="text-xs text-stone-400 mb-3">{camp.target}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#C9A227] transition-all duration-1000" style={{ width: `${camp.progress}%` }} />
                </div>
                <span className="text-xs font-bold text-stone-600">{camp.sent}/{camp.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
