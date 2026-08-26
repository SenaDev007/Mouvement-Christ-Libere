"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageHero } from "@/components/site/page-hero";
import { VideoCard } from "@/components/premium/video-card";
import { LiveBanner, NextLiveCard } from "@/components/premium/live-banner";
import { QuoteBlock } from "@/components/premium/section-divider";
import { Loader2, ArrowRight, Play, Eye, Radio, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import Link from "next/link";

interface Video {
  id: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  isLive: boolean;
  servant: { code: string; shortName: string };
}

interface LiveStream {
  title: string;
  scheduledAt: string;
  servant: { shortName: string };
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [nextLive, setNextLive] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(api.url("/api/videos")).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(api.url("/api/liveStream/next")).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([vids, live]) => {
      setVideos(Array.isArray(vids) ? vids : (vids?.videos || []));
      setNextLive(live);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const liveVideo = videos.find((v) => v.isLive);
  const regularVideos = videos.filter((v) => !v.isLive);

  return (
    <div className="min-h-screen">
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1920&auto=format&fit=crop"
        kicker="Vidéos & Lives"
        title="Vidéos & Lives"
        subtitle="Retrouvez ici l'intégralité des enseignements vidéo et des directs, dans leur version originale et complète — même lorsque les plateformes externes suppriment."
        primaryCta={{ label: "Voir les enseignements", href: "/enseignements" }}
      />

      {/* Bandeau live */}
      {liveVideo && (
        <LiveBanner title={liveVideo.title} href="#" isLive />
      )}

      {/* Grille vidéos */}
      <section className="py-24 bg-[#FAF6EF] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Les dernières vidéos</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E0F2B] leading-tight">
              Enseignements vidéo et lives
            </h2>
            <p className="text-base text-[#8A8378] mt-4 max-w-2xl mx-auto">
              Chaque vidéo est conservée dans son intégralité, indépendamment des plateformes externes.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
            </div>
          ) : regularVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#8A8378]">Aucune vidéo disponible pour l'instant.</p>
            </div>
          ) : (
            <div className="videos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regularVideos.map((v, i) => (
                <VideoCard
                  key={v.id}
                  title={v.title}
                  description={v.description}
                  duration={v.duration}
                  views={v.views}
                  date={v.publishedAt}
                  href="#"
                  servantPortrait={v.servant?.code === "pam" ? "Pam" : "PK"}
                  servantName={v.servant?.shortName || ""}
                  isLive={v.isLive}
                  delay={i * 0.05}
                />
              ))}
            </div>
          )}

          {/* Bandeau permanent */}
          <div className="mt-16 p-6 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-2xl">
            <p className="text-xs text-[#1E0F2B]/70 leading-relaxed text-center">
              Ce direct est aussi diffusé sur YouTube, Facebook et TikTok.
              Cette page reste la version de référence, conservée dans son
              intégralité — même en cas de suppression par les plateformes externes.
            </p>
          </div>

          {/* Prochain live */}
          {nextLive && (
            <div className="mt-8 max-w-md mx-auto">
              <NextLiveCard
                title={nextLive.title}
                scheduledAt={nextLive.scheduledAt}
                servantName={nextLive.servant?.shortName || ""}
                href="#"
              />
            </div>
          )}
        </div>
      </section>

      {/* Citation */}
      <section className="py-24 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4">
          <QuoteBlock
            text="Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe."
            reference="Pam — Christ Libère"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
