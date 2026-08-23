"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumSectionHeadingProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
  className?: string;
}

export function PremiumSectionHeading({
  kicker,
  title,
  subtitle,
  center,
  light,
  className,
}: PremiumSectionHeadingProps) {
  return (
    <div className={cn("mb-12", center && "text-center", className)}>
      {kicker && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={cn(
            "flex items-center gap-2 mb-4",
            center && "justify-center"
          )}
        >
          <div className="h-px w-8 bg-gold" />
          <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-gold">
            {kicker}
          </span>
          <div className="h-px w-8 bg-gold" />
        </motion.div>
      )}

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={cn(
          "font-serif font-semibold leading-[1.1] tracking-tight text-3xl md:text-4xl lg:text-5xl",
          light ? "text-ivory" : "text-ink"
        )}
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={cn(
            "mt-5 text-base md:text-lg leading-relaxed max-w-2xl font-light",
            center && "mx-auto",
            light ? "text-ivory/75" : "text-stone"
          )}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
