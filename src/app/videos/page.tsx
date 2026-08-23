"use client";

import { useState } from "react";
import { useServant } from "@/components/site/servant-context";
import { VIDEOS } from "@/lib/data/content";
import Link from "next/link";
import {
  ChevronRight,
  Radio,
  Play,
  Bell,
  Eye,
  Clock,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function VideosPage() {
  const { servants } = useServant();
  const [servantFilter, setServantFilter] = useState<"all" | "pam" | "kongo">(
    "all"
  );

  const filtered = VIDEOS.filter(
    (v) => servantFilter === "all" || v.servant === servantFilter
  );
  const liveVideo = VIDEOS.find((v) => v.isLive);
  const regularVideos = filtered.filter((v) => !v.isLive);
  const nextLive = VIDEOS.find((v) => !v.isLive); // mock prochain live

  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial-deep py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Vidéos & Lives
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Vidéos & Lives
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Retrouvez ici l'intégralité des enseignements vidéo et des directs,
            dans leur version originale et complète.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Filtre serviteur */}
      <section className="bg-imperial border-b border-gold/15 py-6">
        <div className="container mx-auto max-w-7xl px-4 flex items-center justify-center gap-4">
          <span className="text-xs uppercase tracking-[0.18em] text-gold-light/70 font-semibold">
            Serviteur :
          </span>
          {(["all", "pam", "kongo"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setServantFilter(s)}
              className={cn(
                "px-4 py-2 rounded text-sm font-semibold transition-all",
                servantFilter === s
                  ? "bg-gold text-ink"
                  : "border border-gold/30 text-ivory hover:bg-gold/10"
              )}
            >
              {s === "all" ? "Tous" : servants[s].shortName}
            </button>
          ))}
        </div>
      </section>

      {/* Bandeau live */}
      {liveVideo && (
        <section className="bg-state-danger/10 border-y border-state-danger/30 py-6">
          <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-bold bg-state-danger text-ivory animate-pulse">
                <Radio className="w-2.5 h-2.5" />
                EN DIRECT MAINTENANT
              </span>
              <span className="text-sm font-semibold text-ink">
                {liveVideo.title}
              </span>
            </div>
            <Link
              href={`/videos/${liveVideo.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-state-danger text-ivory text-sm font-semibold hover:bg-state-danger/90 transition-colors"
            >
              Rejoindre le direct
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* Grille vidéos */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularVideos.map((v) => (
              <article
                key={v.id}
                className="card-gold-top overflow-hidden flex flex-col group"
              >
                {/* Thumbnail / Player placeholder */}
                <Link
                  href={`/videos/${v.id}`}
                  className="relative aspect-video bg-imperial flex items-center justify-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-imperial via-imperial-light to-imperial-dark opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center group-hover:bg-gold/30 transition-colors">
                      <Play className="w-6 h-6 text-gold fill-gold ml-1" />
                    </div>
                  </div>
                  {/* Duration */}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-imperial-dark/80 text-ivory text-[10px] font-semibold">
                    {v.duration}
                  </span>
                  {/* Initiales serviteur */}
                  <span className="absolute top-2 left-2 flex items-center justify-center w-8 h-8 rounded-full border border-gold/40 bg-imperial-dark/60">
                    <span className="font-serif text-[10px] font-semibold text-gold">
                      {servants[v.servant].portrait}
                    </span>
                  </span>
                </Link>

                {/* Contenu */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-serif text-lg font-semibold text-ink leading-snug mb-2">
                    {v.title}
                  </h3>
                  <p className="text-sm text-ink/70 leading-relaxed mb-4 flex-1 line-clamp-2">
                    {v.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-stone pt-3 border-t border-stone/15">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(v.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {v.views.toLocaleString("fr-FR")} vues
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Bandeau permanent */}
          <div className="mt-12 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <p className="text-xs text-ink/70 leading-relaxed text-center">
              Ce direct est aussi diffusé sur YouTube, Facebook et TikTok.
              Cette page reste la version de référence, conservée dans son
              intégralité — même en cas de suppression par les plateformes
              externes.
            </p>
          </div>

          {/* Prochain direct — rappel */}
          <div className="mt-8 p-6 bg-imperial text-ivory rounded-card border border-gold/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gold-light/70 font-semibold mb-1">
                  Prochain direct programmé
                </p>
                <p className="font-serif text-lg font-semibold">
                  {nextLive?.title}
                </p>
                <p className="text-xs text-ivory/60 mt-1">
                  {new Date(nextLive?.date || "").toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  — 20:00
                </p>
              </div>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light transition-colors">
                <Bell className="w-3.5 h-3.5" />
                Recevoir une notification
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
