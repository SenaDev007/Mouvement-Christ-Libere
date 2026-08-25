"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, ChevronRight, Loader2, User, Mail, MapPin, Calendar,
  Bell, BellOff, Save, LogOut, Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";

export default function ProfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Notification preferences
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);
  const [notifLive, setNotifLive] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/profil");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch user profile
      fetch(api.url("/api/user/profile"))).then(r => r.json()).then(data => {
        if (data.name) setName(data.name);
        if (data.bio) setBio(data.bio);
        if (data.country) setCountry(data.country);
        if (data.city) setCity(data.city);
        setNotifMessages(data.notifMessages ?? true);
        setNotifAnnouncements(data.notifAnnouncements ?? true);
        setNotifLive(data.notifLive ?? true);
        setNotifCommunity(data.notifCommunity ?? true);
        setDndEnabled(data.dndEnabled ?? false);
      }).catch(() => {});
    }
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(api.url("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, bio, country, city,
          notifMessages, notifAnnouncements, notifLive, notifCommunity,
          dndEnabled,
        }),
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      console.error("save:", e);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#FAF6EF] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#2A0E3D] border-2 border-[#C9A227]/30 mb-4">
            <span className="font-serif text-2xl font-semibold text-[#C9A227]">
              {(session.user?.name || session.user?.email || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Mon profil
          </h1>
          <p className="text-sm text-[#8A8378]">{session.user?.email}</p>
        </motion.div>

        {/* Profile form */}
        <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-5 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] flex items-center gap-2">
            <User className="w-4 h-4 text-[#C9A227]" /> Informations
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Nom</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Bio</label>
            <textarea
              value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Quelques mots sur vous..."
              className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Pays</label>
              <input
                type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="Côte d'Ivoire"
                className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Ville</label>
              <input
                type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Abidjan"
                className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-4 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#C9A227]" /> Notifications
          </h2>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Messages directs</span>
            <input type="checkbox" checked={notifMessages} onChange={(e) => setNotifMessages(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Annonces officielles</span>
            <input type="checkbox" checked={notifAnnouncements} onChange={(e) => setNotifAnnouncements(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Lives et vidéos</span>
            <input type="checkbox" checked={notifLive} onChange={(e) => setNotifLive(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Activité communauté</span>
            <input type="checkbox" checked={notifCommunity} onChange={(e) => setNotifCommunity(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>

          <div className="pt-4 border-t border-stone-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-[#1E0F2B] flex items-center gap-1.5">
                  {dndEnabled ? <BellOff className="w-4 h-4 text-red-500" /> : <Bell className="w-4 h-4" />}
                  Ne pas déranger (DND)
                </span>
                <p className="text-xs text-[#8A8378] mt-0.5">Coupe toutes les notifications</p>
              </div>
              <input type="checkbox" checked={dndEnabled} onChange={(e) => setDndEnabled(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm rounded-md hover:bg-[#DDBE55] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savedMsg ? "Enregistré ✓" : "Enregistrer"}
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full py-3 border border-red-200 text-red-600 font-semibold text-sm rounded-md hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
