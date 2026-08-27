"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Video as VideoIcon, Radio, Eye, Clock, Crown } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import type { Video, Servant } from "@prisma/client";

type VideoWithServant = Video & { servant: Servant };

interface VideosTabsClientProps {
  videos: VideoWithServant[];
  servants: Servant[];
}

export function VideosTabsClient({ videos, servants }: VideosTabsClientProps) {
  // Récupère le serviteur depuis l'URL au chargement
  const initialServant =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("servant") || "all"
      : "all";

  const [activeTab, setActiveTab] = useState<string>(initialServant);

  // Filtrer les vidéos selon l'onglet actif
  const filteredVideos =
    activeTab === "all"
      ? videos
      : videos.filter((v) => v.servant.code === activeTab);

  // Compter par serviteur
  const counts = {
    all: videos.length,
    pam: videos.filter((v) => v.servant.code === "pam").length,
    kongo: videos.filter((v) => v.servant.code === "kongo").length,
  };

  const tabs = [
    { id: "all", label: "Toutes", count: counts.all, icon: VideoIcon },
    { id: "pam", label: "Pam", count: counts.pam, icon: Crown, color: "#C9A227" },
    { id: "kongo", label: "Pasteur Kongo", count: counts.kongo, icon: Crown, color: "#8C5FA8" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Bibliothèque vidéo
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Vidéos
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Vidéos archivées et lives enregistrés — {videos.length} au total.
          </p>
        </div>
        <Link
          href={activeTab === "all" ? "/admin/videos/new" : `/admin/videos/new?servant=${activeTab}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          {activeTab === "all"
            ? "Nouvelle vidéo"
            : activeTab === "pam"
              ? "Nouvelle vidéo · Pam"
              : "Nouvelle vidéo · Pasteur Kongo"}
        </Link>
      </div>

      {/* Onglets serviteurs */}
      <div className="flex items-center gap-2 border-b border-[#8A8378]/15">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "text-[#1E0F2B]"
                  : "text-[#8A8378] hover:text-[#1E0F2B]"
              }`}
            >
              <Icon
                className="w-4 h-4"
                style={tab.color && isActive ? { color: tab.color } : undefined}
              />
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? tab.color
                      ? "text-white"
                      : "bg-[#1E0F2B] text-white"
                    : "bg-[#8A8378]/15 text-[#8A8378]"
                }`}
                style={
                  isActive && tab.color
                    ? { backgroundColor: tab.color }
                    : undefined
                }
              >
                {tab.count}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ backgroundColor: tab.color || "#1E0F2B" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Grille vidéos */}
      {filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <VideoIcon className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">
            {activeTab === "all"
              ? "Aucune vidéo enregistrée."
              : `Aucune vidéo pour ${activeTab === "pam" ? "Pam" : "le Pasteur Kongo"}.`}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((v) => {
            const isPam = v.servant.code === "pam";
            const accentColor = isPam ? "#C9A227" : "#8C5FA8";

            return (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden hover:shadow-lg transition-all group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-[#1A0826] overflow-hidden">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <VideoIcon className="w-8 h-8 text-[#FAF6EF]/30" />
                    </div>
                  )}

                  {/* Overlay badge serviteur */}
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
                      style={{
                        backgroundColor: `${accentColor}DD`,
                        color: "#FFFFFF",
                      }}
                    >
                      <Crown className="w-2.5 h-2.5" />
                      {v.servant.shortName}
                    </span>
                  </div>

                  {/* Badge live */}
                  {v.isLive && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
                        <Radio className="w-2.5 h-2.5" />
                        LIVE
                      </span>
                    </div>
                  )}

                  {/* Duration */}
                  {v.duration && (
                    <div className="absolute bottom-2 right-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 text-white">
                        {v.duration}
                      </span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-[#1E0F2B] line-clamp-2 leading-tight">
                    {v.title}
                  </h3>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A8378]">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {v.views.toLocaleString("fr-FR")}
                    </span>
                    {v.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(v.publishedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#8A8378]/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/admin/videos/${v.id}/edit`}
                      className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="videos" id={v.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
