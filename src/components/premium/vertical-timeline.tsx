"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/site/markdown-text";

export interface TimelineItem {
  date: string;
  title: string;
  description: string;
  verseRef?: string;
  verseText?: string;
  icon?: React.ReactNode;
}

interface VerticalTimelineProps {
  items: TimelineItem[];
  variant?: "light" | "dark";
}

export function VerticalTimeline({ items, variant = "light" }: VerticalTimelineProps) {
  const isDark = variant === "dark";

  return (
    <div className="relative">
      {/* Ligne verticale or dégradée */}
      <div
        className={cn(
          "absolute left-4 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-1/2",
          "bg-gradient-to-b from-transparent via-[#C9A227]/60 to-transparent"
        )}
      />

      <div className="space-y-16 md:space-y-24">
        {items.map((item, i) => (
          <TimelineNode
            key={i}
            item={item}
            index={i}
            isDark={isDark}
            isLeft={i % 2 === 0}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineNode({
  item,
  index,
  isDark,
  isLeft,
}: {
  item: TimelineItem;
  index: number;
  isDark: boolean;
  isLeft: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay: index * 0.05 }}
      className={cn(
        "relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-12 md:items-center",
        !isLeft && "md:[direction:rtl]"
      )}
    >
      {/* Point sur la ligne */}
      <div className="absolute left-4 md:left-1/2 top-2 md:-translate-x-1/2 z-10">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.05 + 0.3, type: "spring" }}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border-2 backdrop-blur-sm",
            isDark
              ? "bg-[#2A0E3D] border-[#C9A227]"
              : "bg-[#FAF6EF] border-[#C9A227] shadow-[0_0_20px_rgba(201,162,39,0.3)]"
          )}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#C9A227]" />
          {/* Halo pulsant */}
          <div className="absolute inset-0 rounded-full border border-[#C9A227]/30 animate-ping opacity-50" />
        </motion.div>
      </div>

      {/* Contenu */}
      <div className={cn("md:[direction:ltr]", !isLeft && "md:col-start-2")}>
        <div
          className={cn(
            "group relative p-6 md:p-8 rounded-2xl border transition-all duration-500",
            isDark
              ? "bg-[#3D1A54]/30 border-[#C9A227]/20 hover:border-[#C9A227]/50"
              : "bg-[#FAF6EF] border-[#8A8378]/20 hover:border-[#C9A227]/40 hover:shadow-[0_15px_50px_-15px_rgba(42,14,61,0.2)]"
          )}
        >
          {/* Date */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px w-6 bg-[#C9A227]" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] font-semibold">
              {item.date}
            </span>
          </div>

          {/* Titre */}
          <h3
            className={cn(
              "font-serif text-2xl md:text-3xl font-semibold leading-snug mb-3",
              isDark ? "text-[#FAF6EF]" : "text-[#1E0F2B]"
            )}
          >
            {item.title}
          </h3>

          {/* Description */}
          <div
            className={cn(
              "text-sm md:text-base leading-relaxed mb-4",
              isDark ? "text-[#FAF6EF]/75" : "text-[#1E0F2B]/75"
            )}
          >
            <MarkdownText variant={isDark ? "dark" : "light"}>{item.description}</MarkdownText>
          </div>

          {/* Verset biblique */}
          {item.verseRef && item.verseText && (
            <div className="mt-4 pt-4 border-t border-[#C9A227]/20">
              <div className="flex items-start gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0 mt-1" />
                <div>
                  <p
                    className={cn(
                      "font-serif italic text-sm leading-relaxed mb-1",
                      isDark ? "text-[#DDBE55]/90" : "text-[#2A0E3D]/90"
                    )}
                  >
                    « {item.verseText} »
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-semibold">
                    {item.verseRef}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
