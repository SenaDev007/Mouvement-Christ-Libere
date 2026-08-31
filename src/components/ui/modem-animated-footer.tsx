"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
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
  className,
}: FooterProps) => {
  return (
    <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
      <footer className="border-t border-[#C9A227]/20 bg-[#2A0E3D] mt-8 relative">
        <div className="max-w-7xl flex flex-col justify-between mx-auto relative p-4 py-10 pb-6">
          <div className="flex flex-col w-full">
            <div className="w-full flex flex-col items-center">
              <div className="space-y-2 flex flex-col items-center flex-1">
                {/* Logo + nom — sans frame, sans halo */}
                <div className="flex items-center gap-1 group/logo">
                  <Image
                    src="/logo-christ-libere.png"
                    alt="Christ Libère"
                    width={72}
                    height={72}
                    className="relative w-16 h-16 md:w-20 md:h-20 object-contain"
                    priority
                  />
                  <span
                    className="text-2xl md:text-4xl font-bold whitespace-nowrap"
                    style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
                  >
                    <span style={{ color: "#C9A227" }}>Christ</span>
                    <span style={{ color: "#FAF6EF" }} className="ml-0.5">Libère</span>
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

          {/* Copyright */}
          <div className="relative z-20 flex justify-center pt-6 mt-6 border-t border-[#C9A227]/10">
            <p className="text-xs text-[#FAF6EF]/40 text-center px-4">
              © {new Date().getFullYear()} {brandName}. Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
            </p>
          </div>
        </div>
      </footer>
    </section>
  );
};
