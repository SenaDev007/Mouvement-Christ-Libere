"use client";

import { motion, useInView, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface AnimatedStatProps {
  value: string | number;
  label: string;
  suffix?: string;
  delay?: number;
}

export function AnimatedStat({ value, label, suffix = "", delay = 0 }: AnimatedStatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  // Pour les valeurs numériques pures, on anime ; sinon on affiche direct
  const numericValue = typeof value === "number" ? value : parseInt(String(value));
  const isNumeric = !isNaN(numericValue) && String(numericValue) === String(value);

  const initialValue = isNumeric ? "0" : String(value);
  const [displayValue, setDisplayValue] = useState(initialValue);

  useEffect(() => {
    if (!isInView || !isNumeric) return;

    const controls = animate(0, numericValue, {
      duration: 1.8,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setDisplayValue(Math.floor(v).toLocaleString("fr-FR")),
    });

    return () => controls.stop();
  }, [isInView, numericValue, isNumeric, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="relative group"
    >
      {/* Filet or supérieur qui s'étend au hover */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 group-hover:w-12 h-[2px] bg-[#C9A227] transition-all duration-500" />

      <div className="text-center pt-4">
        <div className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-[#2A0E3D] mb-2 tracking-tight">
          {displayValue}
          {suffix && <span className="text-[#C9A227]">{suffix}</span>}
        </div>
        <div className="text-xs md:text-sm text-[#8A8378] leading-snug max-w-[120px] mx-auto">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

interface StatsGridProps {
  stats: Array<{ value: string | number; label: string; suffix?: string }>;
  title?: string;
}

export function StatsGrid({ stats, title }: StatsGridProps) {
  return (
    <section className="bg-[#FAF6EF] py-20 md:py-28 relative overflow-hidden">
      {/* Décoration fond */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative container mx-auto max-w-7xl px-4">
        {title && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs uppercase tracking-[0.25em] text-[#8A8378] font-semibold mb-12"
          >
            {title}
          </motion.p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <AnimatedStat key={i} {...stat} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
