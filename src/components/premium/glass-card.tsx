"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  delay?: number;
  variant?: "default" | "imperial" | "gold-accent";
}

export function GlassCard({
  children,
  className,
  href,
  delay = 0,
  variant = "default",
}: GlassCardProps) {
  const baseClass = cn(
    "group relative rounded-card overflow-hidden transition-all duration-500",
    "backdrop-blur-md border",
    variant === "default" && "bg-ivory/80 border-stone/20 hover:border-gold/40 hover:shadow-[0_10px_40px_-10px_rgba(42,14,61,0.15)]",
    variant === "imperial" && "bg-imperial-light/40 border-gold/20 hover:border-gold/50 hover:shadow-[0_10px_40px_-10px_rgba(201,162,39,0.2)]",
    variant === "gold-accent" && "bg-ivory border-gold/30 hover:border-gold hover:shadow-[0_10px_40px_-10px_rgba(201,162,39,0.3)]",
    className
  );

  const content = (
    <>
      {/* Filet or supérieur qui s'étend au hover */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-light to-gold opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Halo lumineux au hover */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gold/0 group-hover:bg-gold/10 blur-3xl transition-all duration-700 pointer-events-none" />

      <div className="relative z-10">{children}</div>
    </>
  );

  if (href) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, delay }}
      >
        <Link href={href} className={cn(baseClass, "block")}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={baseClass}
    >
      {content}
    </motion.div>
  );
}

interface ServantCardProps {
  portrait: string;
  name: string;
  fullName: string;
  role: string;
  bio: string;
  href: string;
  ctaLabel: string;
  delay?: number;
}

export function ServantCard({
  portrait,
  name,
  fullName,
  role,
  bio,
  href,
  ctaLabel,
  delay = 0,
}: ServantCardProps) {
  return (
    <GlassCard variant="gold-accent" delay={delay} className="p-8 h-full">
      <div className="flex flex-col h-full">
        {/* Portrait + nom */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-gold bg-gold/10">
              <span className="font-serif text-lg font-semibold text-gold">
                {portrait}
              </span>
            </div>
            {/* Anneau or pulsant */}
            <div className="absolute inset-0 rounded-full border border-gold/30 animate-ping opacity-50" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone font-semibold">
              {role}
            </div>
            <div className="font-serif text-xl font-semibold text-ink mt-0.5">
              {name}
            </div>
            <div className="text-xs text-stone mt-0.5">{fullName}</div>
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-ink/75 leading-relaxed mb-6 flex-1">
          {bio}
        </p>

        {/* CTA */}
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-imperial hover:text-gold transition-colors group/cta mt-auto"
        >
          {ctaLabel}
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-1" />
        </Link>
      </div>
    </GlassCard>
  );
}
