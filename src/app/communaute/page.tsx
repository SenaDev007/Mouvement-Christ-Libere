"use client";

import { useServant } from "@/components/site/servant-context";
import { CHANNELS } from "@/lib/data/content";
import { CTAButton } from "@/components/section-primitives/section-heading";
import Link from "next/link";
import {
  ChevronRight,
  Lock,
  Hash,
  Volume2,
  Megaphone,
  Users,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS = {
  texte: Hash,
  voix: Volume2,
  annonce: Megaphone,
  "groupe restreint": Lock,
};

const ROLE_DOTS = {
  "super-admin": "bg-gold",
  "modérateur": "bg-lavender",
  "membre": "bg-stone",
};

export default function CommunautePage() {
  const { servants } = useServant();

  return (
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Espaces d'échange
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Communauté
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Des espaces d'échange organisés par thème, modérés avec attention,
            pour grandir ensemble dans la foi.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Rôles */}
      <section className="bg-ivory border-b border-stone/15 py-8">
        <div className="container mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-4 text-center">
            Rôles dans la communauté
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gold" />
              <span className="text-ink font-medium">PAM / Pasteur Kongo</span>
              <span className="text-stone text-xs">— super-admin</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-lavender" />
              <span className="text-ink font-medium">Modérateur</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-stone" />
              <span className="text-ink font-medium">Membre</span>
            </span>
          </div>
        </div>
      </section>

      {/* Liste des canaux */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-2 gap-6">
            {CHANNELS.map((c) => {
              const Icon = CHANNEL_ICONS[c.type];
              return (
                <article
                  key={c.id}
                  className={cn(
                    "p-6 rounded-card border transition-all",
                    c.encrypted
                      ? "bg-imperial/5 border-gold/30 hover:border-gold/50"
                      : "bg-ivory border-stone/30 hover:border-gold/40"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded",
                          c.encrypted
                            ? "bg-gold/10 text-gold"
                            : "bg-imperial/10 text-imperial"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-semibold text-ink leading-tight">
                          {c.name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-stone font-semibold mt-0.5">
                          Canal {c.type}
                        </p>
                      </div>
                    </div>
                    {c.encrypted && (
                      <span
                        title="Canal chiffré de bout en bout"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gold/15 text-gold-dark border border-gold/30"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        E2E
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink/70 leading-relaxed mb-4">
                    {c.description}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-stone/15">
                    {c.members > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-stone">
                        <Users className="w-3 h-3" />
                        {c.members} membres
                      </span>
                    ) : (
                      <span className="text-xs text-stone italic">
                        Canal d'écoute
                      </span>
                    )}
                    <Link
                      href={`/communaute/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-imperial hover:text-gold transition-colors group"
                    >
                      {c.type === "groupe restreint" ? "Demander l'accès" : "Rejoindre"}
                      <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Bandeau confidentialité */}
          <div className="mt-12 p-6 bg-imperial text-ivory rounded-card border border-gold/30">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-ivory mb-2">
                  Confidentialité des échanges
                </h3>
                <p className="text-sm text-ivory/80 leading-relaxed">
                  Les échanges des canaux restreints sont chiffrés de bout en
                  bout : ni l'équipe technique ni les hébergeurs n'y ont
                  accès. Seuls les participants du canal disposent des clés de
                  déchiffrement.
                </p>
              </div>
            </div>
          </div>

          {/* Charte */}
          <div className="mt-8 text-center">
            <Link
              href="/communaute/charte"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors"
            >
              <FileText className="w-4 h-4" />
              Lire la charte de la communauté
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
