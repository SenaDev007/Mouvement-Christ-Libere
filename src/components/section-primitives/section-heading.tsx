"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface SectionHeadingProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean; // sur fond violet
}

export function SectionHeading({
  kicker,
  title,
  subtitle,
  center,
  light,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-10", center && "text-center")}>
      {kicker && (
        <p
          className={cn(
            "text-xs uppercase tracking-[0.2em] font-semibold mb-3",
            light ? "text-gold-light/80" : "text-gold"
          )}
        >
          {kicker}
        </p>
      )}
      <h2
        className={cn(
          "font-serif font-semibold leading-tight text-3xl md:text-4xl",
          light ? "text-ivory" : "text-ink"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-base md:text-lg leading-relaxed max-w-2xl",
            center && "mx-auto",
            light ? "text-ivory/75" : "text-stone"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface CTAButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  light?: boolean;
  className?: string;
}

export function CTAButton({
  href,
  children,
  variant = "primary",
  light,
  className,
}: CTAButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-sm font-semibold transition-all group",
        variant === "primary"
          ? "bg-gold text-ink hover:bg-gold-light"
          : light
            ? "border border-gold/60 text-gold hover:bg-gold/10"
            : "border border-imperial/40 text-imperial hover:bg-imperial/5",
        className
      )}
    >
      {children}
      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function GoldRule({ className }: { className?: string }) {
  return <div className={cn("h-[3px] w-12 bg-gold", className)} />;
}
