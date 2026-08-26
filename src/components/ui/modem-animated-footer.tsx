"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Mail,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  brandIcon?: React.ReactNode;
  className?: string;
}

export const Footer = ({
  brandName = "Mouvement Christ Libère",
  brandDescription = "Témoignages, enseignements et vie de communauté — au service du rassemblement, au son du chofar.",
  socialLinks = [],
  navLinks = [],
  creatorName,
  creatorUrl,
  brandIcon,
  className,
}: FooterProps) => {
  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
      <footer className="border-t border-[#C9A227]/20 bg-[#2A0E3D] mt-20 relative">
        <div className="max-w-7xl flex flex-col justify-between mx-auto min-h-[30rem] sm:min-h-[35rem] md:min-h-[40rem] relative p-4 py-10">
          <div className="flex flex-col mb-12 sm:mb-20 md:mb-0 w-full">
            <div className="w-full flex flex-col items-center">
              <div className="space-y-2 flex flex-col items-center flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[#C9A227]" />
                  <span className="text-[#FAF6EF] text-2xl md:text-3xl font-bold font-serif">
                    {brandName}
                  </span>
                </div>
                <p className="text-[#FAF6EF]/60 font-medium text-center w-full max-w-sm sm:w-96 px-4 sm:px-0 text-sm">
                  {brandDescription}
                </p>
              </div>

              {/* Baseline */}
              <div className="mt-3 mb-2 flex items-center gap-2">
                <span className="text-[#C9A227] text-sm font-semibold tracking-widest uppercase">
                  Au son du
                </span>
                <span className="text-[#C9A227] text-lg">✦</span>
                <span className="text-[#C9A227] text-sm font-semibold tracking-widest uppercase font-serif">
                  chofar
                </span>
              </div>

              {socialLinks.length > 0 && (
                <div className="flex mb-8 mt-3 gap-4">
                  {socialLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      className="text-[#FAF6EF]/50 hover:text-[#C9A227] transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="w-5 h-5 hover:scale-110 duration-300">
                        {link.icon}
                      </div>
                      <span className="sr-only">{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}

              {navLinks.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 text-xs font-medium text-[#FAF6EF]/50 max-w-full px-4">
                  {navLinks.map((link, index) => (
                    <Link
                      key={index}
                      className="hover:text-[#C9A227] duration-300 hover:font-semibold"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-20 md:mt-24 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0">
            <p className="text-xs text-[#FAF6EF]/40 text-center md:text-left">
              © {new Date().getFullYear()} {brandName}. Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
            </p>
          </div>
        </div>

        {/* Large background text — sur une seule ligne */}
        <div
          className="bg-gradient-to-b from-[#C9A227]/15 via-[#C9A227]/5 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-44 md:bottom-36 font-extrabold tracking-tighter pointer-events-none select-none text-center font-serif whitespace-nowrap"
          style={{
            fontSize: "clamp(2rem, 8vw, 6rem)",
          }}
        >
          CHRIST LIBÈRE
        </div>

        {/* Bottom logo — image de shofar */}
        <div className="absolute hover:border-[#C9A227] duration-400 drop-shadow-[0_0px_20px_rgba(201,162,39,0.3)] bottom-28 md:bottom-24 backdrop-blur-sm rounded-3xl bg-[#1A0826]/60 left-1/2 border-2 border-[#C9A227]/30 flex items-center justify-center p-2 -translate-x-1/2 z-10">
          <img
            src="/shofar.png"
            alt="Shofar"
            className="w-14 sm:w-20 md:w-28 h-14 sm:h-20 md:h-28 object-contain rounded-2xl"
          />
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-36 md:bottom-32 backdrop-blur-sm h-1 bg-gradient-to-r from-transparent via-[#C9A227]/30 to-transparent w-full left-1/2 -translate-x-1/2"></div>

        {/* Bottom shadow */}
        <div className="bg-gradient-to-t from-[#2A0E3D] via-[#2A0E3D]/80 blur-[1em] to-[#2A0E3D]/40 absolute bottom-32 w-full h-24"></div>
      </footer>
    </section>
  );
};
