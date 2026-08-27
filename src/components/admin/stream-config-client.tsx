"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, AlertCircle, Youtube, Facebook, Music2, Video } from "lucide-react";

interface StreamConfigClientProps {
  servantId: string;
  servantName: string;
  initialConfig: {
    youtubeRtmpUrl?: string | null;
    youtubeRtmpKey?: string | null;
    facebookRtmpUrl?: string | null;
    facebookRtmpKey?: string | null;
    tiktokRtmpUrl?: string | null;
    tiktokRtmpKey?: string | null;
    odyseeRtmpUrl?: string | null;
    odyseeRtmpKey?: string | null;
  } | null;
}

const DEFAULT_URLS = {
  youtube: "rtmp://a.rtmp.youtube.com/live2",
  facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
  tiktok: "rtmp://push.tiktokcdn.com/live",
  odysee: "rtmp://a.rtmp.odysee.com/live",
};

export function StreamConfigClient({ servantId, servantName, initialConfig }: StreamConfigClientProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    youtubeRtmpUrl: initialConfig?.youtubeRtmpUrl || "",
    youtubeRtmpKey: initialConfig?.youtubeRtmpKey || "",
    facebookRtmpUrl: initialConfig?.facebookRtmpUrl || "",
    facebookRtmpKey: initialConfig?.facebookRtmpKey || "",
    tiktokRtmpUrl: initialConfig?.tiktokRtmpUrl || "",
    tiktokRtmpKey: initialConfig?.tiktokRtmpKey || "",
    odyseeRtmpUrl: initialConfig?.odyseeRtmpUrl || "",
    odyseeRtmpKey: initialConfig?.odyseeRtmpKey || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/admin/api/servants/${servantId}/stream-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      setSuccess(true);
      setTimeout(() => router.push("/admin/servants"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const platforms = [
    {
      key: "youtube" as const,
      label: "YouTube",
      icon: Youtube,
      color: "#FF0000",
      defaultUrl: DEFAULT_URLS.youtube,
      help: "Clé récupérable dans YouTube Studio → Créer → Lancer un streaming",
    },
    {
      key: "facebook" as const,
      label: "Facebook",
      icon: Facebook,
      color: "#1877F2",
      defaultUrl: DEFAULT_URLS.facebook,
      help: "Clé récupérable dans Facebook → Live Producer",
    },
    {
      key: "tiktok" as const,
      label: "TikTok",
      icon: Music2,
      color: "#000000",
      defaultUrl: DEFAULT_URLS.tiktok,
      help: "Compte business requis — Clé via TikTok Live Studio",
    },
    {
      key: "odysee" as const,
      label: "Odysee",
      icon: Video,
      color: "#FA326E",
      defaultUrl: DEFAULT_URLS.odysee,
      help: "Clé dans les paramètres de chaîne Odysee",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/servants"
          className="inline-flex items-center gap-1.5 text-xs text-[#8A8378] hover:text-[#C9A227] mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux serviteurs
        </Link>
        <h1
          className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
          style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        >
          Configuration RTMP
        </h1>
        <p className="text-sm text-[#8A8378] mt-1">
          Clés de streaming pour {servantName} — utilisées pour le multistreaming automatique
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <div
              key={platform.key}
              className="bg-white rounded-2xl border border-[#8A8378]/15 p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${platform.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: platform.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E0F2B]">{platform.label}</h3>
                  <p className="text-xs text-[#8A8378]">{platform.help}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                    URL RTMP
                  </label>
                  <input
                    type="text"
                    value={form[`${platform.key}RtmpUrl` as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [`${platform.key}RtmpUrl`]: e.target.value })}
                    placeholder={platform.defaultUrl}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                    Clé de stream
                  </label>
                  <input
                    type="password"
                    value={form[`${platform.key}RtmpKey` as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [`${platform.key}RtmpKey`]: e.target.value })}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] font-mono"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <Save className="w-4 h-4 flex-shrink-0" />
            <span>Configuration enregistrée avec succès !</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
          <Link
            href="/admin/servants"
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
