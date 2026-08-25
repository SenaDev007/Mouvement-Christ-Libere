"use client";

import { motion } from "framer-motion";
import { Phone, PhoneCall, Video, PhoneMissed, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_CALLS } from "@/lib/helm-connect/types";

function formatDuration(seconds: number): string {
  if (seconds === 0) return "Manqué";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallsView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-[#1E0F2B] flex items-center gap-2">
          <Phone className="w-6 h-6 text-[#C9A227]" />
          Appels & Historique
        </h2>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors whitespace-nowrap">
          <PhoneCall className="w-4 h-4" />
          Nouvel appel
        </button>
      </div>

      {/* Contacts rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: "Pam", role: "Servante de l'Éternel", online: true, portrait: "AP" },
          { name: "Pasteur Kongo", role: "Pasteur", online: true, portrait: "PK" },
          { name: "Pasteur Samuel", role: "Pasteur affilié", online: false, portrait: "PS" },
          { name: "Équipe pastorale", role: "Modérateurs", online: false, portrait: "EP" },
        ].map((contact) => (
          <div key={contact.name} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 text-center">
            <div className="relative inline-block mb-3">
              <div className="w-14 h-14 rounded-full border-2 border-[#C9A227] bg-[#C9A227]/10 flex items-center justify-center">
                <span className="font-serif text-lg font-semibold text-[#C9A227]">{contact.portrait}</span>
              </div>
              {contact.online && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#5B7052] border-2 border-white" />
              )}
            </div>
            <p className="text-sm font-bold text-[#1E0F2B]">{contact.name}</p>
            <p className="text-[10px] text-stone-400 mb-3">{contact.role}</p>
            <div className="flex items-center justify-center gap-2">
              <button className="w-9 h-9 rounded-full bg-[#8C5FA8]/10 text-[#8C5FA8] hover:bg-[#8C5FA8]/20 flex items-center justify-center transition-colors">
                <PhoneCall className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 rounded-full bg-[#2A0E3D]/10 text-[#2A0E3D] hover:bg-[#2A0E3D]/20 flex items-center justify-center transition-colors">
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="font-bold text-[#1E0F2B]">Historique des appels</h3>
        </div>
        <div className="divide-y divide-stone-50">
          {MOCK_CALLS.map((call, i) => {
            const isMissed = call.status === "MISSED";
            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isMissed ? "bg-[#B5502F]/10 text-[#B5502F]" :
                    call.direction === "outgoing" ? "bg-[#5B7052]/10 text-[#5B7052]" :
                    "bg-[#8C5FA8]/10 text-[#8C5FA8]"
                  )}>
                    {isMissed ? <PhoneMissed className="w-5 h-5" /> :
                     call.direction === "outgoing" ? <ArrowUpRight className="w-5 h-5" /> :
                     <ArrowDownLeft className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1E0F2B]">{call.contact}</p>
                    <div className="flex items-center gap-2">
                      {call.type === "VIDEO" ? <Video className="w-3 h-3 text-stone-400" /> : <Phone className="w-3 h-3 text-stone-400" />}
                      <span className="text-xs text-stone-400">
                        {new Date(call.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-semibold", isMissed ? "text-[#B5502F]" : "text-stone-500")}>
                    {formatDuration(call.duration)}
                  </span>
                  <button className="w-9 h-9 rounded-full bg-[#8C5FA8]/10 text-[#8C5FA8] hover:bg-[#8C5FA8]/20 flex items-center justify-center transition-colors">
                    {call.type === "VIDEO" ? <Video className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
