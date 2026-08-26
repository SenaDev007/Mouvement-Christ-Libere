"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
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
  brandName = "Christ Libère",
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
        <div className="max-w-7xl flex flex-col justify-between mx-auto min-h-[30rem] sm:min-h-[35rem] md:min-h-[40rem] relative p-4 py-10 pb-56 md:pb-64">
          <div className="flex flex-col mb-12 sm:mb-20 md:mb-0 w-full">
            <div className="w-full flex flex-col items-center">
              <div className="space-y-2 flex flex-col items-center flex-1">
                <div className="flex items-center gap-3">
                  <Image
                    src="/logo-christ-libere.png"
                    alt="Christ Libère"
                    width={72}
                    height={72}
                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                    priority
                  />
                  <span className="text-[#FAF6EF] text-2xl md:text-4xl font-bold font-serif">
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
                <div className="flex mb-6 mt-3 gap-4">
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
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-[#FAF6EF]/50 max-w-full px-4 z-20 relative">
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
        </div>

        {/* Large background text — responsive (visible sur mobile) */}
        <div
          className="bg-gradient-to-b from-[#C9A227]/20 via-[#C9A227]/8 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-32 md:bottom-28 font-extrabold tracking-tighter pointer-events-none select-none text-center font-serif whitespace-nowrap z-0"
          style={{
            fontSize: "clamp(1.5rem, 9vw, 6rem)",
          }}
        >
          CHRIST LIBÈRE
        </div>

        {/* Bottom logo — logo Christ Libère dans conteneur carré */}
        <div className="absolute hover:border-[#C9A227] duration-400 drop-shadow-[0_0px_25px_rgba(201,162,39,0.4)] bottom-14 md:bottom-16 backdrop-blur-[2px] rounded-3xl bg-[#1A0826]/20 left-1/2 border-2 border-[#C9A227]/30 flex items-center justify-center p-4 md:p-5 -translate-x-1/2 z-10">
          <Image
            src="/logo-christ-libere.png"
            alt="Christ Libère"
            width={140}
            height={140}
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain"
            priority
          />
        </div>

        {/* Copyright — tout en bas, après le logo */}
        <div className="relative z-20 flex justify-center pb-3 pt-2">
          <p className="text-xs text-[#FAF6EF]/40 text-center px-4">
            © {new Date().getFullYear()} {brandName}. Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
          </p>
        </div>
      </footer>
    </section>
  );
};
